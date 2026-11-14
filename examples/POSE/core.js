/* ORPHE CORE 接続と値表示
 * センサーコールバック（最大 200Hz）では値を保存するだけにして、
 * DOM 更新は requestAnimationFrame でまとめて行う。
 * pose.js からは window.orpheState を参照して足首のパルス表示に使う。
 */

const GAIT_TYPE = { 0: 'stop', 1: 'walk', 2: 'run' };
const GAIT_DIRECTION = { 0: 'left', 2: 'forward', 4: 'backward', 6: 'right' };
const CHART_LEN = 240;
const CHART_COLORS = { x: '#e5484d', y: '#30a46c', z: '#3e63dd' };

function createCoreState(id) {
  return {
    id,
    side: id === 0 ? 'L' : 'R',
    connected: false,
    name: '',
    acc: null, gyro: null, euler: null, quat: null,
    stride: null, pronation: null, gait: null,
    steps: null, footAngle: null, impact: null,
    lastStepAt: 0,        // performance.now() of last step event
    sampleCount: 0,
    hz: 0,
    history: { x: [], y: [], z: [] },
  };
}

window.orpheState = [createCoreState(0), createCoreState(1)];
// REC 用のフック。(id, sample) => void で 1 サンプルごと、(id, type, data) => void で歩行解析イベントごとに呼ばれる
window.orpheSampleListeners = [];
window.orpheEventListeners = [];

function emitEvent(id, type, data) {
  for (const fn of window.orpheEventListeners) fn(id, type, data);
}

function pushHistory(state, acc) {
  for (const k of ['x', 'y', 'z']) {
    const h = state.history[k];
    h.push(acc[k]);
    if (h.length > CHART_LEN) h.shift();
  }
}

function fmt(v, digits = 2) {
  return (typeof v === 'number' && isFinite(v)) ? v.toFixed(digits) : '';
}

// ---------- パネル生成 ----------
const panels = [];

function buildPanels() {
  const tpl = document.querySelector('#core_panel_template');
  const parent = document.querySelector('#core_panels');
  for (const state of window.orpheState) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('[data-field="title"]').textContent = `CORE 0${state.id + 1}`;
    const side = node.querySelector('[data-field="side"]');
    side.value = state.side;
    side.addEventListener('change', () => { state.side = side.value; updateSwapTip(); });
    parent.appendChild(node);

    const cells = {};
    node.querySelectorAll('[data-v]').forEach((el) => { cells[el.dataset.v] = el; });
    panels.push({
      state,
      root: node,
      dot: node.querySelector('[data-field="dot"]'),
      name: node.querySelector('[data-field="name"]'),
      hz: node.querySelector('[data-field="hz"]'),
      chart: node.querySelector('[data-field="chart"]'),
      sideSel: side,
      cells,
    });
  }
}

// ---------- 左右（装着足）の入れ替え ----------
// ヘッダーの 2 つの接続スイッチの間に置くアイコンボタン。ホバーで今の割り当てを表示する
let swapButton = null;

function sideText() {
  return window.orpheState.map((s) => `CORE 0${s.id + 1}: ${s.side === 'L' ? '左足' : '右足'}`).join(' / ');
}

function updateSwapTip() {
  if (!swapButton) return;
  const tip = `左右を入れ替え（${sideText()}）`;
  swapButton.dataset.tip = tip;
  swapButton.setAttribute('aria-label', tip);
}

function swapSides() {
  for (const s of window.orpheState) s.side = s.side === 'L' ? 'R' : 'L';
  for (const p of panels) p.sideSel.value = p.state.side;
  updateSwapTip();
}

function buildSwapButton(parent) {
  swapButton = document.createElement('button');
  swapButton.type = 'button';
  swapButton.className = 'op-swap';
  swapButton.innerHTML = '<i class="bi bi-arrow-left-right"></i>';
  swapButton.addEventListener('click', swapSides);
  parent.appendChild(swapButton);
  updateSwapTip();
}

// ---------- 描画ループ ----------
let lastTextUpdate = 0;
let lastHzUpdate = performance.now();

function setCell(panel, key, text) {
  const el = panel.cells[key];
  if (el && el.textContent !== text) el.textContent = text;
}

function updateText(panel) {
  const s = panel.state;
  setCell(panel, 'acc.x', fmt(s.acc?.x)); setCell(panel, 'acc.y', fmt(s.acc?.y)); setCell(panel, 'acc.z', fmt(s.acc?.z));
  setCell(panel, 'gyro.x', fmt(s.gyro?.x, 1)); setCell(panel, 'gyro.y', fmt(s.gyro?.y, 1)); setCell(panel, 'gyro.z', fmt(s.gyro?.z, 1));
  const deg = 180 / Math.PI;
  setCell(panel, 'euler.pitch', fmt(s.euler && s.euler.pitch * deg, 1));
  setCell(panel, 'euler.roll', fmt(s.euler && s.euler.roll * deg, 1));
  setCell(panel, 'euler.yaw', fmt(s.euler && s.euler.yaw * deg, 1));
  setCell(panel, 'quat', s.quat ? [s.quat.w, s.quat.x, s.quat.y, s.quat.z].map((v) => fmt(v, 3)).join(' / ') : '');
  setCell(panel, 'stride.x', fmt(s.stride?.x)); setCell(panel, 'stride.y', fmt(s.stride?.y)); setCell(panel, 'stride.z', fmt(s.stride?.z));
  setCell(panel, 'pronation.x', fmt(s.pronation?.x, 1)); setCell(panel, 'pronation.y', fmt(s.pronation?.y, 1)); setCell(panel, 'pronation.z', fmt(s.pronation?.z, 1));
  setCell(panel, 'steps', s.steps == null ? '' : String(s.steps));
  setCell(panel, 'gait.type', s.gait ? (GAIT_TYPE[s.gait.type] ?? String(s.gait.type)) : '');
  setCell(panel, 'gait.direction', s.gait ? (GAIT_DIRECTION[s.gait.direction] ?? String(s.gait.direction)) : '');
  setCell(panel, 'gait.distance', s.gait ? `${fmt(s.gait.distance)} m` : '');
  setCell(panel, 'footAngle', s.footAngle == null ? '' : `${fmt(s.footAngle, 1)}°`);
  setCell(panel, 'impact', fmt(s.impact));

  panel.name.textContent = s.connected ? (s.name || '接続中') : '未接続';
  panel.hz.textContent = `${Math.round(s.hz)} Hz`;
}

function drawChart(panel) {
  const canvas = panel.chart;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const hist = panel.state.history;
  let maxAbs = 2;
  for (const k of ['x', 'y', 'z']) for (const v of hist[k]) maxAbs = Math.max(maxAbs, Math.abs(v));
  maxAbs = Math.ceil(maxAbs);

  // グリッド
  ctx.strokeStyle = '#e3e6ea';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.fillStyle = '#9aa1ab';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText(`+${maxAbs}G`, 4, 11);
  ctx.fillText(`-${maxAbs}G`, 4, h - 3);

  for (const k of ['x', 'y', 'z']) {
    const data = hist[k];
    if (data.length < 2) continue;
    ctx.strokeStyle = CHART_COLORS[k];
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = w - (data.length - 1 - i) * (w / (CHART_LEN - 1));
      const y = h / 2 - (data[i] / maxAbs) * (h / 2 - 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function loop(now) {
  if (now - lastHzUpdate >= 1000) {
    for (const s of window.orpheState) {
      s.hz = s.sampleCount * 1000 / (now - lastHzUpdate);
      s.sampleCount = 0;
    }
    lastHzUpdate = now;
  }
  const doText = now - lastTextUpdate > 66; // 約15fps
  for (const panel of panels) {
    const s = panel.state;
    panel.dot.classList.toggle('on', s.connected);
    panel.dot.classList.toggle('flash', now - s.lastStepAt < 250);
    drawChart(panel);
    if (doText) updateText(panel);
  }
  if (doText) lastTextUpdate = now;
  requestAnimationFrame(loop);
}

// ---------- ORPHE CORE ----------
window.addEventListener('load', function () {
  const placeholder = document.querySelector('#toolkit_placeholder');
  buildCoreToolkit(placeholder, 'CORE 01', 0, 'STEP_ANALYSIS_AND_SENSOR_VALUES', { range: { acc: 16, gyro: 2000 } });
  buildSwapButton(placeholder);
  buildCoreToolkit(placeholder, 'CORE 02', 1, 'STEP_ANALYSIS_AND_SENSOR_VALUES', { range: { acc: 16, gyro: 2000 } });
  guardCoreToolkitBluetooth({ coreIds: [0, 1], messageElement: '#ble-support-message' });

  buildPanels();

  for (const ble of bles) {
    const state = window.orpheState[ble.id];
    ble.setup();

    ble.onScan = function (deviceName) { state.name = deviceName; };
    ble.onConnect = function () { state.connected = true; };
    ble.onDisconnect = function () { state.connected = false; state.hz = 0; };

    ble.gotConvertedAcc = function (acc) {
      state.acc = { x: acc.x, y: acc.y, z: acc.z };
      state.sampleCount++;
      state.connected = true;
      pushHistory(state, acc);
    };
    ble.gotConvertedGyro = function (gyro) { state.gyro = { x: gyro.x, y: gyro.y, z: gyro.z }; };
    ble.gotEuler = function (euler) {
      state.euler = { pitch: euler.pitch, roll: euler.roll, yaw: euler.yaw };
      // ORPHE-CORE.js は 1 サンプルごとに acc → quat → gyro → converted → euler の順で呼ぶので、
      // ここで 1 サンプル分の生データがそろう
      if (!window.orpheSampleListeners.length) return;
      const ca = this.converted_acc || {};
      const sample = {
        timestamp: ca.timestamp, serial_number: ca.serial_number, packet_number: ca.packet_number,
        acc: this.acc || {}, gyro: this.gyro || {},
        accG: this.converted_acc || state.acc || {}, gyroDps: this.converted_gyro || state.gyro || {},
        quat: this.quat || state.quat || {}, euler,
      };
      for (const fn of window.orpheSampleListeners) fn(this.id, sample);
    };
    ble.gotQuat = function (quat) { state.quat = { w: quat.w, x: quat.x, y: quat.y, z: quat.z }; };

    ble.gotGait = function (gait) {
      state.gait = Object.assign({}, gait);
      emitEvent(this.id, 'gait', state.gait);
    };
    ble.gotStride = function (stride) {
      state.stride = { x: stride.x, y: stride.y, z: stride.z };
      emitEvent(this.id, 'stride', { ...state.stride, steps_number: stride.steps_number });
    };
    ble.gotPronation = function (p) {
      state.pronation = { x: p.x, y: p.y, z: p.z };
      emitEvent(this.id, 'pronation', state.pronation);
    };
    ble.gotFootAngle = function (a) {
      state.footAngle = a.value;
      emitEvent(this.id, 'foot_angle', { value: a.value });
    };
    ble.gotLandingImpact = function (i) {
      state.impact = i.value;
      emitEvent(this.id, 'landing_impact', { value: i.value });
    };
    ble.gotStepsNumber = function (s) {
      state.steps = s.value;
      state.lastStepAt = performance.now();
      emitEvent(this.id, 'steps', { value: s.value });
    };
  }

  requestAnimationFrame(loop);
});
