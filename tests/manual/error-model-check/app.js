/* global Orphe, orpheCoreIsUserCancel */

'use strict';

// Phase 1c（begin() のエラーモデル）実機チェック。
// 旧実装の begin() は
//   - SENSOR_VALUES / 両方 の分岐で startNotify() に .catch が無く、notify 失敗で **永久に settle しなかった**
//   - 未知の notification_type はどの分岐にも入らず、同じく永久に settle しなかった
//   - STEP_ANALYSIS 分岐は実エラーを捨てて文字列 'User cancel.' で reject
//   - 末尾の .catch が本物の失敗を握りつぶして undefined を resolve
// 新実装（v1.5.0）は必ず settle し、
//   成功 → 結果文字列 / ダイアログのキャンセル → undefined を resolve（onError も呼ばない）/
//   本物の失敗 → error.code 付きの Error で reject
// このページは各操作を **settle 監視付き**で実行し、resolve/reject・経過時間・code・connectionState の
// 遷移を記録する。「戻ってこない」ことが一目で分かるようにするのが目的。

const SETTLE_WATCHDOG_MS = 20000;   // これを超えて settle しなければ NOT SETTLED として警告
const CONNECT_TIMEOUT_MS = 3000;    // 「タイムアウト付き接続」で渡す connectTimeoutMs
const MAX_EVENTS = 2000;

const eventEntries = [];
const results = [];
let onErrorCount = 0;
let lastConnectionState = null;
let core = null;

const dom = {
  stateBadge: document.getElementById('state_badge'),
  stateTimeline: document.getElementById('state_timeline'),
  onErrorCount: document.getElementById('on_error_count'),
  deviceSummary: document.getElementById('device_summary'),
  resultsBody: document.getElementById('results_body'),
  eventLog: document.getElementById('event_log'),
  copyLogButton: document.getElementById('copy_log_button'),
  clearLogButton: document.getElementById('clear_log_button'),
  buttons: Array.from(document.querySelectorAll('[data-action]')),
};

function logEvent(level, message) {
  const at = new Date();
  eventEntries.push({ timestamp: at.toISOString(), level, message: String(message) });
  if (eventEntries.length > MAX_EVENTS) eventEntries.shift();
  const row = document.createElement('div');
  row.className = `event-row ${level}`;
  const time = document.createElement('time');
  time.textContent = at.toLocaleTimeString('ja-JP', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  const lv = document.createElement('span'); lv.className = 'level'; lv.textContent = level.toUpperCase();
  const msg = document.createElement('span'); msg.textContent = String(message);
  row.append(time, lv, msg);
  dom.eventLog.appendChild(row);
  while (dom.eventLog.children.length > 300) dom.eventLog.firstElementChild.remove();
  dom.eventLog.scrollTop = dom.eventLog.scrollHeight;
}

window.addEventListener('error', (e) => logEvent('error', `window.onerror: ${e.message} (${e.filename}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  logEvent('error', `unhandledrejection: ${r && r.code ? r.code + ' ' : ''}${r && r.message ? r.message : r}`);
});

// ── connectionState の監視 ────────────────────────────────────────────────
function pollConnectionState() {
  if (!core) return;
  let state;
  try { state = core.connectionState; } catch (error) { state = `(getter throw: ${error.message})`; }
  if (state !== lastConnectionState) {
    const from = lastConnectionState === null ? '(初期)' : lastConnectionState;
    lastConnectionState = state;
    dom.stateBadge.textContent = `connectionState: ${state}`;
    dom.stateBadge.className = `badge ${state === 'connected' ? 'ok' : state === 'disconnected' ? '' : 'warn'}`;
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = state;
    dom.stateTimeline.appendChild(chip);
    logEvent('info', `connectionState: ${from} → ${state}`);
  }
}

// ── settle 監視つき実行 ───────────────────────────────────────────────────
// 期待値（expect）と突き合わせて PASS/FAIL を出す。
//   expect: { kind: 'resolve-undefined' | 'resolve-truthy' | 'reject', code?: 'CONNECT_TIMEOUT' }
async function runCase(label, expect, fn) {
  dom.buttons.forEach((b) => { b.disabled = true; });
  const startedAt = performance.now();
  const errorsBefore = onErrorCount;
  logEvent('info', `▶ ${label} 開始（期待: ${describeExpect(expect)}）`);

  let settled = false;
  const watchdog = setTimeout(() => {
    if (!settled) {
      logEvent('error', `${label}: ${SETTLE_WATCHDOG_MS} ms 経っても settle しません（旧実装のハング再発の疑い）`);
      addResult({ label, outcome: 'NOT SETTLED', elapsedMs: SETTLE_WATCHDOG_MS, detail: '—', verdict: 'fail', errors: onErrorCount - errorsBefore });
    }
  }, SETTLE_WATCHDOG_MS);

  let outcome, detail, verdict;
  try {
    const value = await fn();
    settled = true;
    if (value === undefined) { outcome = 'resolve undefined'; detail = '（キャンセル扱い）'; }
    else { outcome = 'resolve'; detail = String(value); }
  } catch (error) {
    settled = true;
    outcome = 'reject';
    detail = `${error && error.code ? error.code : '(code なし)'} — ${error && error.message ? error.message : String(error)}`;
    if (error && error.cause) detail += ` / cause: ${error.cause.name || ''} ${error.cause.message || error.cause}`;
  }
  clearTimeout(watchdog);
  const elapsedMs = Math.round(performance.now() - startedAt);
  const errors = onErrorCount - errorsBefore;
  verdict = judge(expect, outcome, detail, errors);
  addResult({ label, outcome, elapsedMs, detail, verdict, errors });
  logEvent(verdict === 'pass' ? 'success' : verdict === 'warn' ? 'warn' : 'error',
    `■ ${label}: ${outcome} / ${elapsedMs} ms / ${detail} / onError ${errors} 回 → ${verdict.toUpperCase()}`);
  pollConnectionState();
  dom.buttons.forEach((b) => { b.disabled = false; });
}

function describeExpect(expect) {
  if (expect.kind === 'resolve-undefined') return 'undefined を resolve・onError 0 回';
  if (expect.kind === 'resolve-truthy') return '結果文字列を resolve';
  if (expect.kind === 'reject') return `${expect.code} で reject`;
  return '—';
}

function judge(expect, outcome, detail, errors) {
  if (expect.kind === 'resolve-undefined') {
    if (outcome !== 'resolve undefined') return 'fail';
    return errors === 0 ? 'pass' : 'warn'; // キャンセルで onError が呼ばれたら設計どおりでない
  }
  if (expect.kind === 'resolve-truthy') return outcome === 'resolve' ? 'pass' : 'fail';
  if (expect.kind === 'reject') {
    if (outcome !== 'reject') return 'fail';
    return expect.code && !detail.startsWith(expect.code) ? 'warn' : 'pass';
  }
  return 'warn';
}

function addResult(r) {
  results.push({ ...r, at: new Date().toISOString() });
  const tr = document.createElement('tr');
  for (const [value, cls] of [
    [new Date().toLocaleTimeString('ja-JP', { hour12: false }), ''],
    [r.label, ''],
    [r.outcome, 'mono'],
    [`${r.elapsedMs} ms`, 'mono'],
    [r.detail, 'mono'],
    [String(r.errors), 'mono'],
    [r.verdict.toUpperCase(), r.verdict === 'pass' ? 'ok' : r.verdict === 'warn' ? 'warn' : 'ng'],
  ]) {
    const td = document.createElement('td');
    td.textContent = value;
    if (cls) td.className = cls;
    tr.appendChild(td);
  }
  dom.resultsBody.querySelector('.empty-row')?.remove();
  dom.resultsBody.prepend(tr);
}

function updateDeviceSummary() {
  if (!core) return;
  const info = core.device_information;
  dom.deviceSummary.textContent = [
    `device=${(core.bluetoothDevice && core.bluetoothDevice.name) || '(未選択)'}`,
    `isConnected()=${(() => { try { return core.isConnected(); } catch { return 'throw'; } })()}`,
    `connectionState=${core.connectionState}`,
    `notification_type=${core.notification_type || '-'}`,
    info && info.range ? `range=acc:${JSON.stringify(info.range.acc)} gyro:${JSON.stringify(info.range.gyro)} battery=${info.battery}` : 'device_information=(未取得)',
  ].join('\n');
}

// ── デバイス ────────────────────────────────────────────────────────────
function installDevice() {
  core = new Orphe(0);
  core.setup();
  core.debug = true; // _log を見えるようにする（1a の debug ゲートの確認も兼ねる）
  core.onError = function (error) {
    onErrorCount += 1;
    dom.onErrorCount.textContent = `onError 呼び出し: ${onErrorCount} 回`;
    logEvent('warn', `onError: ${error && error.code ? error.code + ' ' : ''}${error && error.message ? error.message : error}`);
  };
  core.onConnect = function (uuid) { logEvent('success', `onConnect: ${uuid}`); updateDeviceSummary(); };
  core.onDisconnect = function () { logEvent('warn', 'onDisconnect'); updateDeviceSummary(); };
  core.gotConvertedGyro = function () { /* データ受信の確認は共存チェックページで行う */ };
  setInterval(() => { pollConnectionState(); updateDeviceSummary(); }, 500);
}

// ── 各テスト ────────────────────────────────────────────────────────────
const actions = {
  // A: 選択ダイアログを開いて「キャンセル」。undefined を resolve し onError を呼ばないこと
  cancel: () => runCase(
    'A. 接続 → ダイアログをキャンセル',
    { kind: 'resolve-undefined' },
    () => core.begin('SENSOR_VALUES', { forceDeviceSelection: true, useSharedBridge: false })
  ),
  // B: 正常接続。結果文字列を resolve し connectionState が connected になること
  connect: () => runCase(
    'B. 接続 → デバイスを選択',
    { kind: 'resolve-truthy' },
    () => core.begin('SENSOR_VALUES', { forceDeviceSelection: true, useSharedBridge: false })
  ),
  // C: 電源を切った状態で connectTimeoutMs 付き接続。CONNECT_TIMEOUT で reject し、ハングしないこと
  timeout: () => runCase(
    `C. タイムアウト付き接続（connectTimeoutMs: ${CONNECT_TIMEOUT_MS}）`,
    { kind: 'reject', code: 'CONNECT_TIMEOUT' },
    () => core.begin('SENSOR_VALUES', { connectTimeoutMs: CONNECT_TIMEOUT_MS, useSharedBridge: false })
  ),
  // D: 未知の通知種別。実機不要。旧実装ではここで永久にハングした
  unsupported: () => runCase(
    'D. 未知の通知種別で接続（実機不要）',
    { kind: 'reject', code: 'UNSUPPORTED_NOTIFICATION' },
    () => core.begin('NOT_A_REAL_TYPE', { useSharedBridge: false })
  ),
  // E: 切断 → もう一度切断（2 回目は ALREADY_DISCONNECTED）
  disconnect: async () => {
    await runCase('E1. 切断', { kind: 'resolve-truthy' }, async () => {
      await core.disconnect();
      return 'disconnected';
    });
    await runCase('E2. 切断済みでもう一度切断', { kind: 'reject', code: 'ALREADY_DISCONNECTED' },
      () => core.disconnect());
  },
};

// ── ログ ───────────────────────────────────────────────────────────────
function formatLog() {
  return [
    'ORPHE-CORE.js Phase 1c begin() error model check',
    `exportedAt=${new Date().toISOString()}`,
    `page=${location.href}`,
    `userAgent=${navigator.userAgent}`,
    `secureContext=${window.isSecureContext} webBluetooth=${Boolean(navigator.bluetooth)}`,
    `orphe_js_version_date=${String(window.orphe_js_version_date || '').trim()}`,
    `device=${(core && core.bluetoothDevice && core.bluetoothDevice.name) || 'n/a'}`,
    `connectionState=${core ? core.connectionState : 'n/a'}  onErrorCount=${onErrorCount}`,
    '',
    'at\tlabel\toutcome\telapsedMs\tdetail\tonErrorDelta\tverdict',
    ...results.map((r) => [r.at, r.label, r.outcome, r.elapsedMs, r.detail, r.errors, r.verdict].join('\t')),
    '',
    'timestamp\tlevel\tmessage',
    ...eventEntries.map((e) => `${e.timestamp}\t${e.level}\t${e.message}`),
  ].join('\n');
}

async function copyLog() {
  try { await navigator.clipboard.writeText(formatLog()); logEvent('success', 'ログをコピーしました'); }
  catch (error) { logEvent('error', `コピー失敗: ${error.message}`); }
}

function initialize() {
  installDevice();
  dom.buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = actions[button.dataset.action];
      if (action) Promise.resolve(action()).catch((error) => logEvent('error', `テスト実行エラー: ${error.message}`));
    });
  });
  dom.copyLogButton.addEventListener('click', copyLog);
  dom.clearLogButton.addEventListener('click', () => { eventEntries.length = 0; dom.eventLog.replaceChildren(); });
  logEvent('info', `Environment: secureContext=${window.isSecureContext} webBluetooth=${Boolean(navigator.bluetooth)}`);
  logEvent('info', `orpheCoreIsUserCancel が公開されているか: ${typeof orpheCoreIsUserCancel === 'function'}`);
  logEvent('info', '手順: D（実機不要）→ A（キャンセル）→ B（接続）→ E（切断×2）→ 電源 OFF で C。最後に「ログをコピー」');
  pollConnectionState();
  updateDeviceSummary();
}

initialize();
