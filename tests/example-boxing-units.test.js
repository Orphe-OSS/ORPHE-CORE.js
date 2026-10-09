// examples/GAME-BOXING の「説明と実装の整合」テスト（npm run test:examples）。
//
// 2026-10-09 の公開サイトレビューで見つかった食い違いを再発させないための検査:
//   1. 画面の単位: gotConvertedAcc は G なのに、画面・閾値・基準値が m/s² と表示されていた
//   2. 既定値: README / index.html のスライダー / game.js の閾値・基準値が一致していること
//   3. レンジ: 閾値（G）が届くよう begin() で ±16 G を明示し、スライダー上限がレンジを超えないこと
//   4. 擬似データ: 自動開始（旧: 未接続のまま 10 秒）が無く、説明用モードは明示的な開始であること
//   5. 挙動: vm 上で BoxingGame を生成し、閾値判定と説明用モードのガードを確認する
//
// game.js は DOM / Chart.js / Web Audio を前提にしているので、最小限のスタブで vm コンテキストに読み込む
// （tests/core2-header40-parse.test.js と同じ方式）。BLE には触れない。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'examples', 'GAME-BOXING');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'js', 'game.js'), 'utf8');
const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');

const num = (re, src, what) => {
  const m = src.match(re);
  assert.ok(m, `${what}: pattern not found (${re})`);
  return parseFloat(m[1]);
};

// ---- 1. 単位表記 -----------------------------------------------------------
assert.ok(!html.includes('m/s²') && !html.includes('m/s^2') && !/m\/s2\b/.test(html),
  'index.html: an acceleration label still says m/s² (gotConvertedAcc delivers G)');
for (const id of ['leftAccel', 'leftResultant', 'rightAccel', 'rightResultant', 'baselineValue', 'lowerThresholdValue', 'upperThresholdValue']) {
  assert.match(html, new RegExp(`id="${id}"[^<]*</span>\\s*G\\b`), `index.html: #${id} is not labelled in G`);
}
assert.ok(!html.includes('最大速度測定'), 'index.html: the calibration button is still called 最大速度測定 (it measures peak acceleration, not speed)');
assert.ok(!readme.includes('m/s²'), 'README.md: still mentions m/s²');

// ---- 2. 既定値の一致 ---------------------------------------------------------
const upperJs = num(/this\.upperThreshold = ([\d.]+);/, js, 'game.js upperThreshold');
const lowerJs = num(/this\.lowerThreshold = ([\d.]+);/, js, 'game.js lowerThreshold');
const baseJs = num(/this\.maxAcceleration = ([\d.]+);/, js, 'game.js maxAcceleration');
const upperHtml = num(/id="upperThreshold"[^>]*\svalue="([\d.]+)"/, html, 'index.html upperThreshold value');
const upperMaxHtml = num(/id="upperThreshold"[^>]*\smax="([\d.]+)"/, html, 'index.html upperThreshold max');
const lowerHtml = num(/id="lowerThreshold"[^>]*\svalue="([\d.]+)"/, html, 'index.html lowerThreshold value');
assert.equal(upperHtml, upperJs, 'upper threshold: index.html slider default != game.js');
assert.equal(lowerHtml, lowerJs, 'lower threshold: index.html slider default != game.js');
assert.ok(readme.includes(`${upperJs.toFixed(1)} G`), `README.md: does not state the upper threshold default ${upperJs.toFixed(1)} G`);
assert.ok(readme.includes(`${lowerJs.toFixed(1)} G`), `README.md: does not state the lower threshold default ${lowerJs.toFixed(1)} G`);
assert.ok(readme.includes(`${baseJs} G`), `README.md: does not state the baseline default ${baseJs} G`);

// ---- 3. レンジ --------------------------------------------------------------
const rangeMatch = js.match(/begin\('SENSOR_VALUES',\s*\{\s*range:\s*\{\s*acc:\s*(\d+),\s*gyro:\s*(\d+)\s*\}\s*\}\)/);
assert.ok(rangeMatch, 'game.js: begin() must request an explicit acc/gyro range so the G thresholds are reachable');
const accRangeG = parseInt(rangeMatch[1], 10);
assert.equal(accRangeG, 16, 'game.js: acc range should be ±16 G (threshold 15 G is unreachable at ±8 G)');
assert.ok(upperJs <= accRangeG, `upper threshold ${upperJs} G exceeds the acc range ±${accRangeG} G`);
assert.ok(upperMaxHtml <= accRangeG, `index.html: upper threshold slider max ${upperMaxHtml} exceeds the acc range ±${accRangeG} G`);
assert.ok(readme.includes(`±${accRangeG} G`), `README.md: does not mention the ±${accRangeG} G range`);

// ---- 4. 擬似データは自動開始しない ---------------------------------------------
assert.ok(!/^setTimeout\(/m.test(js), 'game.js: a top-level setTimeout remains (auto-start of dummy data)');
assert.ok(!/^setInterval\(/m.test(js), 'game.js: a top-level setInterval remains');
assert.ok(!js.includes('generateDummyData'), 'game.js: legacy generateDummyData() remains');
assert.ok(js.includes('startDemoMode()') && js.includes('stopDemoMode()'), 'game.js: explicit demo mode methods missing');
assert.ok(html.includes('id="demoBtn"') && html.includes('id="demoBanner"'), 'index.html: demo mode button / banner missing');

// ---- 5. 挙動（vm） -----------------------------------------------------------
function makeElement(id = '') {
  const listeners = {};
  const el = {
    id,
    value: '',
    textContent: '',
    disabled: false,
    hidden: false,
    src: '',
    className: '',
    style: { setProperty() {} },
    classList: { toggle() {}, add() {}, remove() {} },
    children: [],
    parentNode: null,
    listeners,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {},
    appendChild(child) { child.parentNode = this; this.children.push(child); },
    removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
    getContext() { return {}; },
  };
  return el;
}
const elements = new Map();
const defaults = { gameTime: '20', comboInterval: '600', difficulty: 'beginner', upperThreshold: String(upperJs), lowerThreshold: String(lowerJs) };
const document = {
  head: makeElement('head'),
  body: makeElement('body'),
  getElementById(id) {
    if (!elements.has(id)) {
      const el = makeElement(id);
      if (defaults[id] !== undefined) el.value = defaults[id];
      elements.set(id, el);
    }
    return elements.get(id);
  },
  createElement(tag) { return makeElement(`<${tag}>`); },
  addEventListener() {},
  removeEventListener() {},
};
class AudioContextStub {
  constructor() { this.state = 'running'; this.destination = {}; }
  createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
  createBufferSource() { return { connect() {}, start() {}, stop() {} }; }
  decodeAudioData() { return Promise.resolve({}); }
  resume() {}
}
class ChartStub {
  constructor(_ctx, config) { this.data = config.data; }
  update() {}
}
const alerts = [];
const intervals = [];
const sandbox = {
  document,
  window: { AudioContext: AudioContextStub },
  fetch: () => Promise.reject(new Error('no network in test')),
  Chart: ChartStub,
  alert: (msg) => alerts.push(String(msg)),
  console: { log() {}, error() {}, warn: console.warn.bind(console), info() {} },
  setTimeout: () => 0,
  clearTimeout() {},
  setInterval: (fn) => { intervals.push(fn); return intervals.length; },
  clearInterval: (id) => { intervals[id - 1] = null; },
  performance,
  Math, Date, JSON, Promise, Array, Object, Number, String, Boolean, Error, parseInt, parseFloat, isNaN, isFinite,
};
const context = vm.createContext(sandbox);
vm.runInContext(js, context, { filename: 'examples/GAME-BOXING/js/game.js' });
const BoxingGame = vm.runInContext('BoxingGame', context);
assert.equal(typeof BoxingGame, 'function', 'BoxingGame class not found');

const game = new BoxingGame();
assert.equal(game.upperThreshold, upperJs);
assert.equal(game.lowerThreshold, lowerJs);
assert.equal(game.maxAcceleration, baseJs);
assert.equal(game.demoMode, false, 'demo mode must be off at start');
assert.equal(intervals.filter(Boolean).length, 0, 'no interval timer may run before the user starts the demo mode');

// 5a. 閾値判定: 上限閾値（G）を超えた合成加速度だけがパンチになる。500 ms 以内の再検出は無視
game.gameState = 'playing';
game.sensorBuffer.left.resultant = [1.0, 1.1, 0.9, upperJs + 1];
game.detectPunch('left', upperJs - 1, 1000);
assert.equal(game.punchStats.totalPunches, 0, 'a resultant below the upper threshold must not count as a punch');
game.detectPunch('left', upperJs + 1, 2000);
assert.equal(game.punchStats.totalPunches, 1, 'a resultant above the upper threshold must count as a punch');
assert.equal(game.punchStats.maxPower, upperJs + 1, 'peak acceleration is the max of the recent buffer (G)');
game.detectPunch('left', upperJs + 1, 2100);
assert.equal(game.punchStats.totalPunches, 1, 'punches within punchWindow (500 ms) must be ignored');
game.detectPunch('left', upperJs + 1, 2600);
assert.equal(game.punchStats.totalPunches, 2, 'a punch after punchWindow counts again');
game.gameState = 'idle';

// 5b. 静止時の擬似データ（≈1 G）は閾値に届かない。説明用モードは明示的に始まり、基準測定・ゲーム開始はできない
game.sensorBuffer.left.resultant = [];
game.sensorBuffer.right.resultant = [];
game.startDemoMode();
assert.equal(game.demoMode, true);
assert.equal(intervals.filter(Boolean).length, 1, 'demo mode registers exactly one interval');
assert.equal(document.getElementById('demoBanner').hidden, false, 'demo banner must be visible in demo mode');
const before = game.punchStats.totalPunches;
for (let i = 0; i < 50; i++) game.generateDemoData();
assert.equal(game.sensorBuffer.left.resultant.length > 0, true, 'demo data must reach the sensor buffer');
assert.ok(Math.max(...game.sensorBuffer.left.resultant) < upperJs, 'demo data must stay below the punch threshold');
assert.equal(game.punchStats.totalPunches, before, 'demo data must not produce punches');

alerts.length = 0;
game.startCalibration();
assert.equal(game.gameState, 'idle', 'calibration must not start in demo mode');
assert.ok(alerts.some((m) => m.includes('説明用モード')), 'calibration in demo mode must explain why it is blocked');
alerts.length = 0;
game.startGame();
assert.equal(game.gameState, 'idle', 'the game must not start in demo mode');
assert.ok(alerts.some((m) => m.includes('説明用モード')), 'starting the game in demo mode must explain why it is blocked');

// 5c. 実機が接続されたら説明用モードは終了する
game.leftCore = {};
game.generateDemoData();
assert.equal(game.demoMode, false, 'demo mode must stop once a real device is connected');
assert.equal(intervals.filter(Boolean).length, 0, 'demo interval must be cleared');
assert.equal(document.getElementById('demoBanner').hidden, true, 'demo banner must hide after the demo stops');
game.stopDemoMode(); // idempotent
assert.equal(game.demoMode, false);

console.log(`example-boxing-units.test.js passed (units G, thresholds ${lowerJs}/${upperJs} G, baseline ${baseJs} G, acc range ±${accRangeG} G, explicit demo mode)`);
