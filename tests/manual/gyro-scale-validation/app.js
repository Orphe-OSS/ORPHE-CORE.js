/* global buildCoreToolkit, bles */

'use strict';

// v1.4.0: gyro の deg/s 換算をレンジ別のデータシート感度に修正（理想 Q15 → LSM6DSOX 感度）。
// 回転テストでは新換算の積分角を基準に判定し、旧換算値は「修正前の値がどれだけズレていたか」の
// 参考表示として new / FACTOR で算出する。FACTOR はパケット形式で異なる:
//   ヘッダ 50（16bit, CORE 1.x / 3.0）: 旧 raw/32768×range → 新 raw×range×0.000035  … ×1.14688
//   ヘッダ 40（8bit,  CORE 2.0）      : 旧 int8/127×range   → 新 int8×256×range×0.000035 … ×1.13792
// ORPHE-INSOLE.js の tests/manual/gyro-scale-validation を CORE 向けに移植したもの。
const OLD_TO_NEW_FACTOR = {
    header50: 0.07 / (2000 / 32768),        // 1.14688
    header40: (256 * 0.000035) / (1 / 127),  // 1.13792
    unknown: 0.07 / (2000 / 32768),
};

const GYRO_RANGES_DPS = [250, 500, 1000, 2000];
const ACC_RANGES_G = [2, 4, 8, 16];
const MDPS_PER_LSB_PER_DPS_RANGE = 0.035;

const STATIC_TEST_DURATION_MS = 10000;
const STATIC_TEST_BIAS_LIMIT_DPS = 3;
const MAX_ANOMALOUS_DT_MS = 100;
const MAX_EVENTS = 2000;

const RATIO_PASS_MIN = 0.93;
const RATIO_PASS_MAX = 1.07;
const RATIO_WARN_MIN = 0.85;
const RATIO_WARN_MAX = 1.15;
const OLD_SCALE_TOLERANCE = 0.03;
const MIN_DETECTABLE_QUAT_DELTA_DEG = 10;

// ヘッダ 50 の公称サンプル周期 [ms]（200 Hz、1 パケット 4 サンプル）。
// SDK が converted_gyro に載せる timestamp はサンプル間差分を累積加算しており（js/ORPHE-CORE.js の
// header-50 ループ）、dt が 5/10/15 ms と膨らんで次パケット先頭で負になる。積分には使わず、
// 「パケット受信の壁時計 + packet_number × 公称周期」で各サンプルの時刻を組む。
const HEADER50_SAMPLE_PERIOD_MS = 5;

const eventEntries = [];
const rotationHistory = [];

let staticTest = null;
let rotationTest = null;
// パケット形式の判定: ヘッダ 50 経路の converted_gyro は timestamp / serial_number を持ち、
// ヘッダ 40 経路は x/y/z のみ（js/ORPHE-CORE.js の onRead 参照）。
let packetKind = 'unknown';
let rateWindow = { count: 0, startedAt: performance.now() };
let lastCallbackAt = null;
// 静置テストで得た 3 軸バイアス [dps]（量子化補正後）。回転テストの積分で差し引く。
let gyroBias = null;
// ヘッダ 50: 直近パケットの受信時刻と serial（サンプル時刻の再構成用）
let lastPacket = { serial: null, wallAt: null };
// FW timestamp の進み（診断用）: 静置テスト中の先頭/末尾
let fwTimestampSpan = null;

const dom = {
    deviceSummary: document.getElementById('device_summary'),
    readDeviceInfoButton: document.getElementById('read_device_info_button'),
    staticTestButton: document.getElementById('static_test_button'),
    staticTestStatus: document.getElementById('static_test_status'),
    staticTestMetrics: document.getElementById('static_test_metrics'),
    targetAngleSelect: document.getElementById('target_angle_select'),
    rotationStartButton: document.getElementById('rotation_start_button'),
    rotationStopButton: document.getElementById('rotation_stop_button'),
    rotationStatus: document.getElementById('rotation_status'),
    metricGyroIntegral: document.getElementById('metric_gyro_integral'),
    metricGyroIntegralOld: document.getElementById('metric_gyro_integral_old'),
    metricQuatDelta: document.getElementById('metric_quat_delta'),
    metricRatio: document.getElementById('metric_ratio'),
    metricRatioTarget: document.getElementById('metric_ratio_target'),
    metricVerdict: document.getElementById('metric_verdict'),
    metricElapsed: document.getElementById('metric_elapsed'),
    rotationVerdictBox: document.getElementById('rotation_verdict_box'),
    historyBody: document.getElementById('history_body'),
    liveGyroX: document.getElementById('live_gyro_x'),
    liveGyroY: document.getElementById('live_gyro_y'),
    liveGyroZ: document.getElementById('live_gyro_z'),
    livePacketKind: document.getElementById('live_packet_kind'),
    liveRate: document.getElementById('live_rate'),
    liveFactor: document.getElementById('live_factor'),
    eventLog: document.getElementById('event_log'),
    copyLogButton: document.getElementById('copy_log_button'),
    downloadJsonButton: document.getElementById('download_json_button'),
    clearLogButton: document.getElementById('clear_log_button'),
};

function core() {
    return bles[0];
}

function isConnected() {
    try {
        return Boolean(core()?.isConnected?.());
    } catch {
        return false;
    }
}

function currentFactor() {
    return OLD_TO_NEW_FACTOR[packetKind] || OLD_TO_NEW_FACTOR.unknown;
}

function packetKindLabel(kind) {
    if (kind === 'header50') return 'ヘッダ 50（16bit）';
    if (kind === 'header40') return 'ヘッダ 40（8bit / CORE 2.0）';
    return '未判定';
}

function currentGyroRangeDps() {
    const info = core()?.device_information;
    return gyroRangeDps(info?.range?.gyro);
}

// ヘッダ 40 の 1 LSB [dps]（int8 = int16 上位バイト → 256 LSB16 分）。±2000 dps で 17.92 dps。
function header40LsbDps() {
    return currentGyroRangeDps() * 256 * 0.000035;
}

// 受信値を積分・統計用の値に整える。
// ヘッダ 40 は FW が int16 を算術右シフト（floor）で int8 化しているため（静置で −0.1 dps が −1 LSB になる）、
// 量子化の中央値 (q + 0.5) × LSB に戻して切り捨てバイアス（平均 −0.5 LSB）を除く。ヘッダ 50 はそのまま。
function dequantize(value) {
    if (packetKind !== 'header40') return value;
    const lsb = header40LsbDps();
    return (Math.floor(value / lsb + 1e-6) + 0.5) * lsb;
}

function biasCorrected(axis, value) {
    const v = dequantize(value);
    return gyroBias ? v - gyroBias[axis] : v;
}

function logEvent(level, message) {
    const occurredAt = new Date();
    const entry = {
        timestamp: occurredAt.toISOString(),
        clock: occurredAt.toLocaleTimeString('ja-JP', {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
        }),
        level,
        message: String(message),
    };
    eventEntries.push(entry);
    if (eventEntries.length > MAX_EVENTS) eventEntries.shift();

    const row = document.createElement('div');
    row.className = `event-row ${level}`;
    for (const [className, value, tag] of [
        ['', entry.clock, 'time'],
        ['level', level.toUpperCase(), 'span'],
        ['', entry.message, 'span'],
    ]) {
        const cell = document.createElement(tag);
        cell.className = className;
        cell.textContent = value;
        row.appendChild(cell);
    }
    dom.eventLog.appendChild(row);
    while (dom.eventLog.children.length > 300) dom.eventLog.firstElementChild.remove();
    dom.eventLog.scrollTop = dom.eventLog.scrollHeight;
}

// device_information.range は index(0..3) と実値(250..2000 / 2..16)のどちらでも受ける
function gyroRangeDps(value) {
    if (GYRO_RANGES_DPS.includes(value)) return value;
    if (Number.isInteger(value) && value >= 0 && value < GYRO_RANGES_DPS.length) return GYRO_RANGES_DPS[value];
    return 2000;
}

function accRangeG(value) {
    if (ACC_RANGES_G.includes(value)) return value;
    if (Number.isInteger(value) && value >= 0 && value < ACC_RANGES_G.length) return ACC_RANGES_G[value];
    return 16;
}

function updateDeviceSummary() {
    if (!isConnected()) {
        dom.deviceSummary.textContent = '未接続';
        return;
    }
    const info = core().device_information;
    if (!info || !info.range) {
        dom.deviceSummary.textContent = '接続済み（レンジ設定は未取得。「レンジ設定を再取得」を押してください）';
        return;
    }
    const gyro = gyroRangeDps(info.range.gyro);
    const acc = accRangeG(info.range.acc);
    dom.deviceSummary.textContent = [
        `device=${core().device?.name || 'unknown'}`,
        `gyroRange=${JSON.stringify(info.range.gyro)} -> ±${gyro} dps`,
        `accRange=${JSON.stringify(info.range.acc)} -> ±${acc} G`,
        `gyro 感度(新換算)=${(gyro * MDPS_PER_LSB_PER_DPS_RANGE).toFixed(3)} mdps/LSB`,
        `battery=${info.battery}`,
        `packet=${packetKindLabel(packetKind)}`,
    ].join('\n');
}

async function fetchDeviceInfo() {
    if (!isConnected()) return;
    try {
        await core().getDeviceInformation();
        updateDeviceSummary();
        logEvent('success', `Device information fetched: ${JSON.stringify(core().device_information?.range)}`);
    } catch (error) {
        logEvent('error', `getDeviceInformation failed: ${error?.message || error}`);
    }
}

function setControlsEnabled(connected) {
    dom.readDeviceInfoButton.disabled = !connected;
    dom.staticTestButton.disabled = !connected || Boolean(staticTest);
    dom.rotationStartButton.disabled = !connected || Boolean(rotationTest);
    dom.rotationStopButton.disabled = !rotationTest;
}

// === 静置テスト ===

function createAxisAccumulator() { return { n: 0, sum: 0, sumSq: 0 }; }
function pushAxisSample(acc, value) { acc.n += 1; acc.sum += value; acc.sumSq += value * value; }
function axisMean(acc) { return acc.n > 0 ? acc.sum / acc.n : 0; }
function axisStd(acc) {
    if (acc.n === 0) return 0;
    const mean = axisMean(acc);
    return Math.sqrt(Math.max(0, acc.sumSq / acc.n - mean * mean));
}

function metricElement(label, value) {
    const element = document.createElement('div');
    element.className = 'metric';
    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    const valueElement = document.createElement('strong');
    valueElement.textContent = value;
    element.append(labelElement, valueElement);
    return element;
}

function startStaticTest() {
    if (staticTest || !isConnected()) return;
    staticTest = {
        x: createAxisAccumulator(), y: createAxisAccumulator(), z: createAxisAccumulator(),
        raw: { x: createAxisAccumulator(), y: createAxisAccumulator(), z: createAxisAccumulator() },
        startedWall: performance.now(), firstFwTs: null, lastFwTs: null,
    };
    setControlsEnabled(true);
    dom.staticTestStatus.textContent = '計測中（10 秒）...';
    dom.staticTestStatus.className = 'badge-neutral';
    logEvent('info', `静置テスト開始（10 秒） packet=${packetKind} range=±${currentGyroRangeDps()} dps`
        + (packetKind === 'header40' ? ` (8bit: 1 LSB = ${header40LsbDps().toFixed(2)} dps。分解能が粗いので ±250 dps レンジ推奨)` : ''));
    setTimeout(finishStaticTest, STATIC_TEST_DURATION_MS);
}

function finishStaticTest() {
    if (!staticTest) return;
    const wallSpanS = (performance.now() - staticTest.startedWall) / 1000;
    const result = {
        x: { mean: axisMean(staticTest.x), std: axisStd(staticTest.x) },
        y: { mean: axisMean(staticTest.y), std: axisStd(staticTest.y) },
        z: { mean: axisMean(staticTest.z), std: axisStd(staticTest.z) },
        rawZ: { mean: axisMean(staticTest.raw.z), std: axisStd(staticTest.raw.z) },
        samples: staticTest.x.n,
        rateHz: staticTest.x.n / wallSpanS,
        fwSpanS: staticTest.firstFwTs !== null && staticTest.lastFwTs !== null ? (staticTest.lastFwTs - staticTest.firstFwTs) / 1000 : null,
        wallSpanS,
    };
    // 回転テストで差し引くバイアス（量子化補正後の平均）
    gyroBias = { x: result.x.mean, y: result.y.mean, z: result.z.mean };
    fwTimestampSpan = result.fwSpanS;
    staticTest = null;
    dom.staticTestMetrics.replaceChildren(
        metricElement('X mean / std [dps]', `${result.x.mean.toFixed(3)} / ${result.x.std.toFixed(3)}`),
        metricElement('Y mean / std [dps]', `${result.y.mean.toFixed(3)} / ${result.y.std.toFixed(3)}`),
        metricElement('Z mean / std [dps]', `${result.z.mean.toFixed(3)} / ${result.z.std.toFixed(3)}`),
        metricElement('サンプル数 / 実測レート', `${result.samples} / ${result.rateHz.toFixed(1)} Hz`),
        metricElement('FW timestamp の進み / 壁時計', result.fwSpanS !== null ? `${result.fwSpanS.toFixed(2)} s / ${result.wallSpanS.toFixed(2)} s` : `— / ${result.wallSpanS.toFixed(2)} s`),
        metricElement('Z 生値 mean（補正前）', `${result.rawZ.mean.toFixed(3)} dps`)
    );
    // 判定は量子化補正後のバイアスで行う（8bit では静置 −1 LSB = −17.92 dps が −8.96 → 補正後ほぼ 0 になる）
    const pass = [result.x, result.y, result.z].every((axis) => Math.abs(axis.mean) < STATIC_TEST_BIAS_LIMIT_DPS
        || (packetKind === 'header40' && Math.abs(axis.mean) < header40LsbDps()));
    dom.staticTestStatus.textContent = pass ? 'PASS（バイアスを回転テストで差し引きます）' : 'FAIL（バイアスが大きい軸あり）';
    dom.staticTestStatus.className = `badge-neutral verdict ${pass ? 'pass' : 'fail'}`;
    logEvent(pass ? 'success' : 'error',
        `静置テスト完了: packet=${packetKind} samples=${result.samples} rate=${result.rateHz.toFixed(1)}Hz `
        + `x(mean=${result.x.mean.toFixed(3)},std=${result.x.std.toFixed(3)}) `
        + `y(mean=${result.y.mean.toFixed(3)},std=${result.y.std.toFixed(3)}) `
        + `z(mean=${result.z.mean.toFixed(3)},std=${result.z.std.toFixed(3)}) rawZ=${result.rawZ.mean.toFixed(3)} `
        + (result.fwSpanS !== null ? `fwTimestampSpan=${result.fwSpanS.toFixed(2)}s wall=${result.wallSpanS.toFixed(2)}s ` : '')
        + `verdict=${pass ? 'PASS' : 'FAIL'}`);
    if (result.fwSpanS !== null && Math.abs(result.fwSpanS / result.wallSpanS - 1) > 0.1) {
        logEvent('warn', `FW timestamp が壁時計と ${((result.fwSpanS / result.wallSpanS - 1) * 100).toFixed(0)}% ずれています（SDK のヘッダ 50 タイムスタンプ累積加算の影響。積分には使っていません）`);
    }
    setControlsEnabled(isConnected());
}

// === 回転テスト ===

function unwrapAngleRad(previousUnwrapped, previousRaw, newRaw) {
    let delta = newRaw - previousRaw;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    return previousUnwrapped + delta;
}

function verdictFromRatio(ratio) {
    if (!Number.isFinite(ratio)) return 'fail';
    const m = Math.abs(ratio);
    if (m >= RATIO_PASS_MIN && m <= RATIO_PASS_MAX) return 'pass';
    if ((m >= RATIO_WARN_MIN && m < RATIO_PASS_MIN) || (m > RATIO_PASS_MAX && m <= RATIO_WARN_MAX)) return 'warn';
    return 'fail';
}

function startRotationTest() {
    if (rotationTest || !isConnected()) return;
    rotationTest = {
        targetAngle: Number(dom.targetAngleSelect.value),
        startedAt: performance.now(),
        lastSampleTime: null,
        gyroIntegralDeg: 0,
        sampleCount: 0,
        lastEulerYawRad: null,
        unwrappedYawRad: null,
        baselineYawRad: null,
        packetKind,
        biasApplied: Boolean(gyroBias),
    };
    setControlsEnabled(true);
    dom.rotationStatus.textContent = `計測中（目標 ${rotationTest.targetAngle}°）`;
    dom.rotationVerdictBox.style.display = 'none';
    logEvent('info', `回転テスト開始: targetAngle=${rotationTest.targetAngle} packet=${packetKind} bias=${gyroBias ? gyroBias.z.toFixed(3) + 'dps(z)' : '未取得（静置テストを先に実行すると精度が上がります）'}`);
    renderRotationLiveMetrics();
}

function rotationMetrics() {
    const gyroIntegralDeg = rotationTest.gyroIntegralDeg;
    const gyroIntegralOldDeg = gyroIntegralDeg / currentFactor();
    const quatDeltaDeg = rotationTest.baselineYawRad !== null && rotationTest.unwrappedYawRad !== null
        ? (rotationTest.unwrappedYawRad - rotationTest.baselineYawRad) * (180 / Math.PI)
        : null;
    // 基準 1: FW quaternion の yaw 変化（独立した基準。yaw が追従しない FW では使えない）
    const quatUsable = quatDeltaDeg !== null && Math.abs(quatDeltaDeg) >= MIN_DETECTABLE_QUAT_DELTA_DEG;
    const ratioQuat = quatDeltaDeg !== null && Math.abs(quatDeltaDeg) > 1e-6 ? gyroIntegralDeg / quatDeltaDeg : null;
    // 基準 2: 目標角（机の辺に合わせて回した角度）。符号は無視
    const ratioTarget = rotationTest.targetAngle > 0 ? Math.abs(gyroIntegralDeg) / rotationTest.targetAngle : null;
    const reference = quatUsable ? 'quat' : 'target';
    const ratio = reference === 'quat' ? ratioQuat : ratioTarget;
    return { gyroIntegralDeg, gyroIntegralOldDeg, quatDeltaDeg, ratioQuat, ratioTarget, reference, ratio };
}

function paintVerdict(element, verdict) {
    element.textContent = verdict ? verdict.toUpperCase() : '—';
    element.style.color = verdict === 'pass' ? 'var(--green)' : verdict === 'warn' ? 'var(--yellow)' : verdict === 'fail' ? 'var(--red)' : '';
}

function renderRotationLiveMetrics() {
    if (!rotationTest) return;
    const m = rotationMetrics();
    dom.metricGyroIntegral.textContent = `${m.gyroIntegralDeg.toFixed(2)} °`;
    dom.metricGyroIntegralOld.textContent = `${m.gyroIntegralOldDeg.toFixed(2)} °`;
    dom.metricQuatDelta.textContent = m.quatDeltaDeg !== null ? `${m.quatDeltaDeg.toFixed(2)} °` : '— °';
    dom.metricRatio.textContent = m.ratioQuat !== null ? m.ratioQuat.toFixed(3) : '—';
    dom.metricRatioTarget.textContent = m.ratioTarget !== null ? m.ratioTarget.toFixed(3) : '—';
    dom.metricElapsed.textContent = `${((performance.now() - rotationTest.startedAt) / 1000).toFixed(1)} s`;
    paintVerdict(dom.metricVerdict, m.ratio !== null ? verdictFromRatio(m.ratio) : null);
}

function finishRotationTest() {
    if (!rotationTest) return;
    const m = rotationMetrics();
    const verdict = verdictFromRatio(m.ratio);
    const oldScaleRatio = 1 / currentFactor();
    const quatNotTracking = m.quatDeltaDeg !== null && Math.abs(m.quatDeltaDeg) < MIN_DETECTABLE_QUAT_DELTA_DEG;
    const looksLikeOldScale = m.ratio !== null && Math.abs(Math.abs(m.ratio) - oldScaleRatio) <= OLD_SCALE_TOLERANCE;

    const result = {
        completedAt: new Date().toISOString(),
        packetKind: rotationTest.packetKind,
        targetAngle: rotationTest.targetAngle,
        durationS: (performance.now() - rotationTest.startedAt) / 1000,
        samples: rotationTest.sampleCount,
        biasApplied: rotationTest.biasApplied,
        ...m,
        verdict,
        quatNotTracking,
        looksLikeOldScale,
    };
    rotationHistory.unshift(result);
    rotationTest = null;
    renderRotationHistory();

    const messages = [`回転テスト完了: packet=${result.packetKind} targetAngle=${result.targetAngle} duration=${result.durationS.toFixed(1)}s samples=${result.samples} bias=${result.biasApplied} `
        + `gyro積分(新)=${m.gyroIntegralDeg.toFixed(2)}° gyro積分(旧参考)=${m.gyroIntegralOldDeg.toFixed(2)}° quat変化=${m.quatDeltaDeg !== null ? m.quatDeltaDeg.toFixed(2) : 'n/a'}° `
        + `ratio/quat=${m.ratioQuat !== null ? m.ratioQuat.toFixed(3) : 'n/a'} ratio/target=${m.ratioTarget !== null ? m.ratioTarget.toFixed(3) : 'n/a'} reference=${m.reference} verdict=${verdict.toUpperCase()}`];
    if (quatNotTracking) messages.push('FW quaternion の yaw が ±10° 未満しか動いていないため、目標角を基準に判定しました。');
    if (looksLikeOldScale) messages.push(`ratio が旧換算の比率(約 ${oldScaleRatio.toFixed(3)})に近く、旧換算のままの可能性があります。`);
    logEvent(verdict === 'pass' ? 'success' : verdict === 'warn' ? 'warn' : 'error', messages.join(' '));

    dom.rotationStatus.textContent = '待機中';
    const boxLines = [];
    if (quatNotTracking) boxLines.push('FW quaternion の yaw が追従していないため、判定は「目標角」基準です（机の辺に合わせた回転角の正確さが前提）。');
    if (looksLikeOldScale) boxLines.push('旧換算のままの可能性があります（ratio が旧/新比率に近い）。');
    if (!result.biasApplied) boxLines.push('静置テスト未実施のためバイアス補正なし。先に静置テストを実行すると精度が上がります。');
    dom.rotationVerdictBox.textContent = boxLines.join(' ');
    dom.rotationVerdictBox.style.display = boxLines.length ? 'block' : 'none';
    setControlsEnabled(isConnected());
}

function renderRotationHistory() {
    if (rotationHistory.length === 0) {
        dom.historyBody.innerHTML = '<tr><td colspan="9" class="empty-cell">まだ結果はありません</td></tr>';
        return;
    }
    dom.historyBody.replaceChildren(...rotationHistory.map((r) => {
        const row = document.createElement('tr');
        for (const value of [
            new Date(r.completedAt).toLocaleTimeString('ja-JP', { hour12: false }),
            packetKindLabel(r.packetKind),
            `${r.targetAngle}°`,
            `${r.gyroIntegralDeg.toFixed(2)}°`,
            `${r.gyroIntegralOldDeg.toFixed(2)}°`,
            r.quatDeltaDeg !== null ? `${r.quatDeltaDeg.toFixed(2)}°` : '—',
            r.ratioQuat !== null ? r.ratioQuat.toFixed(3) : '—',
            r.ratioTarget !== null ? r.ratioTarget.toFixed(3) : '—',
            `${r.verdict.toUpperCase()} (${r.reference})`,
        ]) {
            const cell = document.createElement('td');
            cell.textContent = String(value);
            row.appendChild(cell);
        }
        return row;
    }));
}

// === Toolkit / device callbacks ===

function noteCallback(gyro) {
    const now = performance.now();
    const kind = typeof gyro.timestamp === 'number' ? 'header50' : 'header40';
    if (kind !== packetKind) {
        packetKind = kind;
        dom.livePacketKind.textContent = packetKindLabel(kind);
        dom.liveFactor.textContent = `×${currentFactor().toFixed(5)}`;
        logEvent('info', `パケット形式を判定: ${packetKindLabel(kind)}（新旧比 ×${currentFactor().toFixed(5)}）`);
        updateDeviceSummary();
    }
    rateWindow.count += 1;
    if (now - rateWindow.startedAt >= 1000) {
        dom.liveRate.textContent = `${(rateWindow.count * 1000 / (now - rateWindow.startedAt)).toFixed(0)} Hz`;
        rateWindow = { count: 0, startedAt: now };
    }
    lastCallbackAt = now;
    // 積分用のサンプル時刻 [ms]:
    //  ヘッダ 50: 4 サンプルが同じ notify で一括到着するので、パケット先頭の受信時刻 + packet_number × 5 ms。
    //             FW timestamp は SDK 側で差分が累積加算されており dt が膨らむため使わない（診断表示のみ）。
    //  ヘッダ 40: 1 notify = 1 サンプルなので受信時刻をそのまま使う。
    if (kind === 'header50') {
        if (gyro.serial_number !== lastPacket.serial) lastPacket = { serial: gyro.serial_number, wallAt: now };
        const index = Number.isInteger(gyro.packet_number) ? gyro.packet_number : 0;
        return lastPacket.wallAt + index * HEADER50_SAMPLE_PERIOD_MS;
    }
    return now;
}

function installDevice() {
    buildCoreToolkit(document.getElementById('toolkit0'), 'CORE', 0, 'SENSOR_VALUES', { autoReconnect: true });
    const ble = core();
    ble.setup();

    ble.onConnect = function (uuid) {
        logEvent('success', `GATT connected: ${uuid}`);
        packetKind = 'unknown';
        dom.livePacketKind.textContent = '判定中…';
        setControlsEnabled(true);
        setTimeout(fetchDeviceInfo, 500);
    };
    ble.onDisconnect = function () {
        logEvent('warn', 'Disconnected');
        setControlsEnabled(false);
        updateDeviceSummary();
    };
    ble.onReconnectSuccess = function (info) {
        logEvent('success', `Reconnect succeeded: attempt=${info?.attempt} elapsed=${info?.elapsedMs} ms`);
        setControlsEnabled(true);
        fetchDeviceInfo();
    };
    ble.onReconnectFailed = function (info) {
        logEvent('error', `Reconnect failed: ${JSON.stringify(info || {})}`);
    };

    ble.gotConvertedGyro = function (gyro) {
        const time = noteCallback(gyro);
        dom.liveGyroX.textContent = `${gyro.x.toFixed(3)} dps`;
        dom.liveGyroY.textContent = `${gyro.y.toFixed(3)} dps`;
        dom.liveGyroZ.textContent = `${gyro.z.toFixed(3)} dps`;

        if (staticTest) {
            // 統計は量子化補正後（8bit）／そのまま（16bit）。生値の z も診断用に残す
            pushAxisSample(staticTest.x, dequantize(gyro.x));
            pushAxisSample(staticTest.y, dequantize(gyro.y));
            pushAxisSample(staticTest.z, dequantize(gyro.z));
            pushAxisSample(staticTest.raw.x, gyro.x);
            pushAxisSample(staticTest.raw.y, gyro.y);
            pushAxisSample(staticTest.raw.z, gyro.z);
            if (typeof gyro.timestamp === 'number') {
                if (staticTest.firstFwTs === null) staticTest.firstFwTs = gyro.timestamp;
                staticTest.lastFwTs = gyro.timestamp;
            }
        }
        if (rotationTest) {
            if (rotationTest.lastSampleTime !== null) {
                const dtMs = time - rotationTest.lastSampleTime;
                if (dtMs > 0 && dtMs <= MAX_ANOMALOUS_DT_MS) {
                    rotationTest.gyroIntegralDeg += biasCorrected('z', gyro.z) * (dtMs / 1000);
                }
            }
            rotationTest.lastSampleTime = time;
            rotationTest.sampleCount += 1;
            renderRotationLiveMetrics();
        }
    };

    // yaw の基準は SDK の gotEuler ではなく gotQuat を自前で正規化して求める。
    // CORE 3.0 のヘッダ 50 は quaternion が Q14（1.0 = 16384）で、SDK が 32768 で割ると成分が半分になり
    // toEuler() の yaw が約 0.2 倍になる（実機で確認）。ノルムで正規化すれば世代・スケールに依存しない。
    ble.gotQuat = function (q) {
        if (!rotationTest || !q) return;
        const norm = Math.hypot(q.w, q.x, q.y, q.z);
        if (!Number.isFinite(norm) || norm < 1e-6) return;
        const w = q.w / norm, x = q.x / norm, y = q.y / norm, z = q.z / norm;
        const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
        if (rotationTest.quatNormSeen === undefined) {
            rotationTest.quatNormSeen = norm;
            logEvent('info', `quaternion ノルム（SDK 正規化後）= ${norm.toFixed(3)}（1.0 = Q15 / 0.5 = Q14 を SDK が 32768 で割った状態）`);
        }
        if (rotationTest.lastEulerYawRad === null) {
            rotationTest.lastEulerYawRad = yaw;
            rotationTest.unwrappedYawRad = yaw;
            rotationTest.baselineYawRad = yaw;
            return;
        }
        rotationTest.unwrappedYawRad = unwrapAngleRad(rotationTest.unwrappedYawRad, rotationTest.lastEulerYawRad, yaw);
        rotationTest.lastEulerYawRad = yaw;
    };

    // 接続状態の変化を拾う（Toolkit のスイッチ操作も含む）
    setInterval(() => {
        const connected = isConnected();
        if (connected && lastCallbackAt !== null && performance.now() - lastCallbackAt > 3000) {
            dom.liveRate.textContent = '0 Hz';
        }
        setControlsEnabled(connected);
    }, 1000);
}

// === ログ操作 ===

function formatEventLogText() {
    return [
        'ORPHE CORE v1.4.0 Gyro Scale Validation Event Log',
        `exportedAt=${new Date().toISOString()}`,
        `page=${window.location.href}`,
        `secureContext=${window.isSecureContext}`,
        `webBluetooth=${Boolean(navigator.bluetooth)}`,
        `userAgent=${navigator.userAgent}`,
        `connected=${isConnected()}`,
        `device=${core()?.device?.name || 'n/a'}`,
        `packetKind=${packetKind}`,
        `deviceRange=${JSON.stringify(core()?.device_information?.range || null)}`,
        '',
        `gyroBias=${gyroBias ? JSON.stringify(gyroBias) : 'n/a'}`,
        `fwTimestampSpanDuringStatic=${fwTimestampSpan !== null ? fwTimestampSpan.toFixed(2) + 's' : 'n/a'}`,
        '',
        'completedAt\tpacketKind\ttargetAngle\tdurationS\tsamples\tbias\tgyroIntegralDeg\tgyroIntegralOldDeg\tquatDeltaDeg\tratioQuat\tratioTarget\treference\tverdict',
        ...rotationHistory.map((r) => [
            r.completedAt, r.packetKind, r.targetAngle, r.durationS.toFixed(1), r.samples, r.biasApplied,
            r.gyroIntegralDeg.toFixed(3), r.gyroIntegralOldDeg.toFixed(3),
            r.quatDeltaDeg !== null ? r.quatDeltaDeg.toFixed(3) : 'n/a',
            r.ratioQuat !== null ? r.ratioQuat.toFixed(4) : 'n/a',
            r.ratioTarget !== null ? r.ratioTarget.toFixed(4) : 'n/a',
            r.reference, r.verdict,
        ].join('\t')),
        '',
        'timestamp\tlevel\tmessage',
        ...eventEntries.map((e) => `${e.timestamp}\t${e.level}\t${e.message}`),
    ].join('\n');
}

async function copyEventLog() {
    const text = formatEventLogText();
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
        logEvent('success', `Event Log copied: ${eventEntries.length} entries`);
        dom.copyLogButton.textContent = 'コピーしました';
    } catch (error) {
        logEvent('error', `Event Log copy failed: ${error?.message || error}`);
        dom.copyLogButton.textContent = 'コピー失敗';
    }
    setTimeout(() => { dom.copyLogButton.innerHTML = '<i class="bi bi-clipboard"></i> ログをコピー'; }, 1500);
}

function downloadBlob(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 0);
}

function exportJson() {
    const payload = {
        schema: 'orphe-core-gyro-scale-validation-v1',
        exportedAt: new Date().toISOString(),
        page: window.location.href,
        environment: {
            secureContext: window.isSecureContext,
            webBluetooth: Boolean(navigator.bluetooth),
            userAgent: navigator.userAgent,
        },
        device: core()?.device?.name || null,
        packetKind,
        deviceRange: core()?.device_information?.range || null,
        rotationHistory,
        events: eventEntries,
    };
    downloadBlob(JSON.stringify(payload, null, 2), `orphe-core-v1.4.0-gyro-scale-${Date.now()}.json`, 'application/json');
    logEvent('success', `Result history JSON downloaded: ${rotationHistory.length} entries`);
}

function initialize() {
    const secure = window.isSecureContext;
    const bluetooth = Boolean(navigator.bluetooth);

    installDevice();
    setControlsEnabled(false);

    dom.readDeviceInfoButton.addEventListener('click', fetchDeviceInfo);
    dom.staticTestButton.addEventListener('click', startStaticTest);
    dom.rotationStartButton.addEventListener('click', startRotationTest);
    dom.rotationStopButton.addEventListener('click', finishRotationTest);
    dom.copyLogButton.addEventListener('click', copyEventLog);
    dom.downloadJsonButton.addEventListener('click', exportJson);
    dom.clearLogButton.addEventListener('click', () => {
        eventEntries.length = 0;
        dom.eventLog.replaceChildren();
        logEvent('info', 'Event Log cleared');
    });

    logEvent('success', `v1.4.0 gyro scale validation initialized (orphe_js_version_date=${String(window.orphe_js_version_date || '').trim()})`);
    logEvent(secure && bluetooth ? 'success' : 'error',
        `Environment: secureContext=${secure} webBluetooth=${bluetooth} userAgent=${navigator.userAgent}`);
    if (!secure || !bluetooth) {
        logEvent('error', 'Web Bluetooth が使えません。Chrome / Edge で http://localhost または https から開いてください。');
    }
    logEvent('info', '操作手順: ①接続 → ②静置テスト(10 秒) → ③目標角度を選び回転テスト開始 → ④机上で水平に回転させ停止 → ⑤ログをコピーして PR #124 に貼る');
}

initialize();
