/* global buildCoreToolkit, bles, OrpheInsole */

'use strict';

// Phase 1b（ORPHE-CORE.js の IIFE 化）実機チェック。
// このページは ORPHE-CORE.js（このリポジトリの js/）と ORPHE-INSOLE.js（jsDelivr 固定タグの dist）を
// 同じページに読み込み、
//   1. グローバルの状態（Orphe は CORE / OrpheInsole は INSOLE / 補助クラス / 2 回読み込みで例外なし）
//   2. CORE を CoreToolkit で接続してデータが流れること、onDisconnect を接続後に上書きしても効くこと
//   3. INSOLE を素の OrpheInsole で接続してデータが流れること（同一ページで両 SDK が同時に動く）
// を確認する。index.html は CORE → INSOLE、insole-first.html は INSOLE → CORE の順に読み込む。

const LOAD_ORDER = document.documentElement.dataset.loadOrder || 'unknown';
const MAX_EVENTS = 1500;
const eventEntries = [];
const dom = {
  globalsTable: document.getElementById('globals_table'),
  reloadCoreButton: document.getElementById('reload_core_button'),
  reloadCoreStatus: document.getElementById('reload_core_status'),
  coreLive: document.getElementById('core_live'),
  coreDisconnectStatus: document.getElementById('core_disconnect_status'),
  insoleConnectButton: document.getElementById('insole_connect_button'),
  insoleDisconnectButton: document.getElementById('insole_disconnect_button'),
  insoleLive: document.getElementById('insole_live'),
  eventLog: document.getElementById('event_log'),
  copyLogButton: document.getElementById('copy_log_button'),
  clearLogButton: document.getElementById('clear_log_button'),
  orderBadge: document.getElementById('order_badge'),
};

function logEvent(level, message) {
  const at = new Date();
  const entry = { timestamp: at.toISOString(), level, message: String(message) };
  eventEntries.push(entry);
  if (eventEntries.length > MAX_EVENTS) eventEntries.shift();
  const row = document.createElement('div');
  row.className = `event-row ${level}`;
  const time = document.createElement('time');
  time.textContent = at.toLocaleTimeString('ja-JP', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  const lv = document.createElement('span'); lv.className = 'level'; lv.textContent = level.toUpperCase();
  const msg = document.createElement('span'); msg.textContent = entry.message;
  row.append(time, lv, msg);
  dom.eventLog.appendChild(row);
  while (dom.eventLog.children.length > 300) dom.eventLog.firstElementChild.remove();
  dom.eventLog.scrollTop = dom.eventLog.scrollHeight;
}

window.addEventListener('error', (e) => logEvent('error', `window.onerror: ${e.message} (${e.filename}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => logEvent('error', `unhandledrejection: ${e.reason && e.reason.message ? e.reason.message : e.reason}`));

// ── 1. グローバル状態 ────────────────────────────────────────────────────
function probeGlobals() {
  const has = (name) => typeof window[name];
  const rows = [
    ['読み込み順', LOAD_ORDER, LOAD_ORDER === 'core-first' || LOAD_ORDER === 'insole-first'],
    ['typeof Orphe', has('Orphe'), has('Orphe') === 'function'],
    ['Orphe は CORE（setLED あり・gotPress なし）', String(typeof Orphe === 'function' && typeof Orphe.prototype.setLED === 'function' && typeof Orphe.prototype.gotPress !== 'function'),
      typeof Orphe === 'function' && typeof Orphe.prototype.setLED === 'function' && typeof Orphe.prototype.gotPress !== 'function'],
    ['typeof OrpheInsole', has('OrpheInsole'), has('OrpheInsole') === 'function'],
    ['OrpheInsole は INSOLE（gotPress あり）', String(typeof OrpheInsole === 'function' && typeof OrpheInsole.prototype.gotPress === 'function'),
      typeof OrpheInsole === 'function' && typeof OrpheInsole.prototype.gotPress === 'function'],
    ['Orphe !== OrpheInsole', String(typeof Orphe === 'function' && typeof OrpheInsole === 'function' && Orphe !== OrpheInsole),
      typeof Orphe === 'function' && typeof OrpheInsole === 'function' && Orphe !== OrpheInsole],
    ['typeof FixedSizeArray / OrpheTimestamp', `${has('FixedSizeArray')} / ${has('OrpheTimestamp')}`, has('FixedSizeArray') === 'function' && has('OrpheTimestamp') === 'function'],
    ['typeof orphe_js_version_date（CoreToolkit が参照）', has('orphe_js_version_date'), has('orphe_js_version_date') === 'string'],
    ['typeof Quaternion', has('Quaternion'), has('Quaternion') === 'function'],
    ['Orphe.SDK マーカー / orphe_js_version_date', `${typeof Orphe === 'function' ? Orphe.SDK : '-'} / ${String(window.orphe_js_version_date || '').trim()}`, typeof Orphe === 'function' && Orphe.SDK === 'ORPHE-CORE.js'],
    ['CoreToolkit の bles[0] instanceof Orphe', String(typeof bles !== 'undefined' && bles[0] instanceof Orphe), typeof bles !== 'undefined' && bles[0] instanceof Orphe],
  ];
  dom.globalsTable.replaceChildren(...rows.map(([label, value, ok]) => {
    const tr = document.createElement('tr');
    const a = document.createElement('td'); a.textContent = label;
    const b = document.createElement('td'); b.textContent = value; b.className = 'mono';
    const c = document.createElement('td'); c.textContent = ok ? 'OK' : 'NG'; c.className = ok ? 'ok' : 'ng';
    tr.append(a, b, c);
    return tr;
  }));
  const ngs = rows.filter((r) => !r[2]).map((r) => r[0]);
  logEvent(ngs.length ? 'error' : 'success', `globals: ${rows.length - ngs.length}/${rows.length} OK${ngs.length ? ' NG=' + ngs.join(', ') : ''}`);
}

// CORE SDK をもう一度 <script> で読み込む（IIFE 化前はトップレベル class の重複宣言で SyntaxError になる）
function reloadCoreScript() {
  const before = { orphe: window.Orphe, fsa: window.FixedSizeArray };
  const script = document.createElement('script');
  script.src = document.querySelector('script[data-core-sdk]').getAttribute('src') + '?again=' + Date.now();
  let errored = false;
  const onError = (e) => { if (/ORPHE-CORE\.js/.test(e.filename || '')) { errored = true; } };
  window.addEventListener('error', onError);
  script.onload = () => {
    setTimeout(() => {
      window.removeEventListener('error', onError);
      const same = window.Orphe === before.orphe;
      const msg = `CORE を 2 回目に読み込み: ${errored ? '例外あり（SyntaxError: 重複宣言）' : '例外なし'} / Orphe の参照は${same ? '不変' : '差し替わった'}`;
      dom.reloadCoreStatus.textContent = msg;
      dom.reloadCoreStatus.className = `badge ${errored ? 'ng' : 'ok'}`;
      logEvent(errored ? 'error' : 'success', msg);
      probeGlobals();
    }, 300);
  };
  script.onerror = () => { window.removeEventListener('error', onError); dom.reloadCoreStatus.textContent = 'スクリプトの読み込みに失敗'; dom.reloadCoreStatus.className = 'badge ng'; };
  document.head.appendChild(script);
}

// ── 2. CORE（CoreToolkit） ────────────────────────────────────────────────
const coreState = { count: 0, lastRateAt: performance.now(), rate: 0, lastGyro: null, lastAcc: null, lastEuler: null, overrideArmed: false };

function installCore() {
  buildCoreToolkit(document.getElementById('core_toolkit'), 'CORE', 0, 'SENSOR_VALUES', { autoReconnect: true });
  const ble = bles[0];
  ble.setup();
  ble.debug = false;
  ble.onConnect = function (uuid) { logEvent('success', `CORE GATT connected: ${uuid}`); };
  ble.gotConvertedGyro = function (g) { coreState.lastGyro = g; coreState.count += 1; };
  ble.gotConvertedAcc = function (a) { coreState.lastAcc = a; };
  ble.gotEuler = function (e) { coreState.lastEuler = e; };
  // onDisconnect は「接続後に」上書きする（遅延束縛の確認）。接続前の既定はログのみ。
  ble.onDisconnect = function () { logEvent('warn', 'CORE onDisconnect (接続前に設定した既定ハンドラ)'); };
  setInterval(() => {
    const now = performance.now();
    const dt = (now - coreState.lastRateAt) / 1000;
    coreState.rate = coreState.count / Math.max(dt, 1e-3);
    coreState.count = 0; coreState.lastRateAt = now;
    const connected = (() => { try { return ble.isConnected(); } catch { return false; } })();
    if (connected && !coreState.overrideArmed) {
      // 接続後に上書き: これが切断時に呼ばれ、this が Orphe インスタンスなら遅延束縛が機能している
      ble.onDisconnect = function () {
        const ok = this === ble;
        const msg = `CORE onDisconnect（接続後に上書きしたハンドラ）が呼ばれた。this === bles[0]: ${ok}`;
        dom.coreDisconnectStatus.textContent = msg;
        dom.coreDisconnectStatus.className = `badge ${ok ? 'ok' : 'ng'}`;
        logEvent(ok ? 'success' : 'error', msg);
      };
      coreState.overrideArmed = true;
      dom.coreDisconnectStatus.textContent = '接続後に onDisconnect を上書き済み。CORE の電源を切る／離して切断すると判定します';
      dom.coreDisconnectStatus.className = 'badge';
      logEvent('info', 'CORE: onDisconnect を接続後に上書きしました（切断で検証）');
    }
    const g = coreState.lastGyro, a = coreState.lastAcc, e = coreState.lastEuler;
    dom.coreLive.textContent = connected
      ? `rate=${coreState.rate.toFixed(0)} Hz  gyro=[${g ? [g.x, g.y, g.z].map((v) => v.toFixed(1)).join(', ') : '—'}] dps  acc=[${a ? [a.x, a.y, a.z].map((v) => v.toFixed(2)).join(', ') : '—'}] G  yaw=${e ? (e.yaw * 180 / Math.PI).toFixed(1) : '—'}°`
      : '未接続';
  }, 1000);
}

// ── 3. INSOLE（素の OrpheInsole。CoreToolkit と DOM/グローバルが衝突するので Toolkit は使わない） ──
const insoleState = { insole: null, count: 0, lastRateAt: performance.now(), rate: 0, lastPress: null, lastGyro: null };

function installInsole() {
  if (typeof OrpheInsole !== 'function') {
    dom.insoleLive.textContent = 'OrpheInsole が未定義（INSOLE dist の読み込みに失敗）';
    dom.insoleConnectButton.disabled = true;
    return;
  }
  const insole = new OrpheInsole(1); // CORE と別スロット
  insoleState.insole = insole;
  insole.setup();
  insole.onConnect = function (uuid) { logEvent('success', `INSOLE GATT connected: ${uuid}`); dom.insoleDisconnectButton.disabled = false; };
  insole.onDisconnect = function () { logEvent('warn', 'INSOLE disconnected'); dom.insoleDisconnectButton.disabled = true; };
  insole.onError = function (error) { logEvent('error', `INSOLE onError: ${error && error.code ? error.code + ' ' : ''}${error && error.message ? error.message : error}`); };
  insole.gotPress = function (p) { insoleState.lastPress = p.values; insoleState.count += 1; };
  insole.gotConvertedGyro = function (g) { insoleState.lastGyro = g; };
  dom.insoleConnectButton.addEventListener('click', async () => {
    dom.insoleConnectButton.disabled = true;
    try {
      logEvent('info', `INSOLE: begin('SENSOR_VALUES', {streamingMode: 4}) — instanceof OrpheInsole=${insole instanceof OrpheInsole}, instanceof Orphe=${typeof Orphe === 'function' && insole instanceof Orphe}`);
      await insole.begin('SENSOR_VALUES', { streamingMode: 4, autoReconnect: false });
    } catch (error) {
      logEvent('error', `INSOLE begin failed: ${error && error.code ? error.code + ' ' : ''}${error && error.message ? error.message : error}`);
    } finally {
      dom.insoleConnectButton.disabled = false;
    }
  });
  dom.insoleDisconnectButton.addEventListener('click', () => { try { insole.stop(); } catch (e) { logEvent('error', `INSOLE stop: ${e.message}`); } });
  setInterval(() => {
    const now = performance.now();
    insoleState.rate = insoleState.count / Math.max((now - insoleState.lastRateAt) / 1000, 1e-3);
    insoleState.count = 0; insoleState.lastRateAt = now;
    const connected = (() => { try { return insole.isConnected(); } catch { return false; } })();
    dom.insoleLive.textContent = connected
      ? `rate=${insoleState.rate.toFixed(0)} Hz  press=[${insoleState.lastPress ? insoleState.lastPress.join(', ') : '—'}]  gyro=[${insoleState.lastGyro ? [insoleState.lastGyro.x, insoleState.lastGyro.y, insoleState.lastGyro.z].map((v) => v.toFixed(1)).join(', ') : '—'}] dps`
      : '未接続';
  }, 1000);
}

// ── ログ ───────────────────────────────────────────────────────────────────
function formatLog() {
  return [
    'ORPHE-CORE.js Phase 1b coexistence check',
    `exportedAt=${new Date().toISOString()}`,
    `page=${location.href}`,
    `loadOrder=${LOAD_ORDER}`,
    `userAgent=${navigator.userAgent}`,
    `globals: Orphe=${typeof Orphe} OrpheInsole=${typeof OrpheInsole} distinct=${typeof Orphe === 'function' && typeof OrpheInsole === 'function' && Orphe !== OrpheInsole} FixedSizeArray=${typeof FixedSizeArray} OrpheTimestamp=${typeof OrpheTimestamp} Quaternion=${typeof Quaternion}`,
    '',
    'timestamp\tlevel\tmessage',
    ...eventEntries.map((e) => `${e.timestamp}\t${e.level}\t${e.message}`),
  ].join('\n');
}

async function copyLog() {
  try { await navigator.clipboard.writeText(formatLog()); logEvent('success', 'ログをコピーしました'); }
  catch (e) { logEvent('error', `コピー失敗: ${e.message}`); }
}

function initialize() {
  dom.orderBadge.textContent = LOAD_ORDER === 'core-first' ? '読み込み順: CORE → INSOLE' : LOAD_ORDER === 'insole-first' ? '読み込み順: INSOLE → CORE' : '読み込み順: 不明';
  logEvent('info', `Environment: secureContext=${window.isSecureContext} webBluetooth=${Boolean(navigator.bluetooth)} order=${LOAD_ORDER}`);
  probeGlobals();
  installCore();
  installInsole();
  dom.reloadCoreButton.addEventListener('click', reloadCoreScript);
  dom.copyLogButton.addEventListener('click', copyLog);
  dom.clearLogButton.addEventListener('click', () => { eventEntries.length = 0; dom.eventLog.replaceChildren(); });
  logEvent('info', '手順: ① グローバル表が全 OK か ② 「CORE を 2 回読み込む」で例外なし ③ CORE 接続→データ→電源 OFF で onDisconnect 判定 ④ INSOLE 接続→データ ⑤ insole-first.html でも①〜④ ⑥ ログをコピーして PR に貼る');
}

initialize();
