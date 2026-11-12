const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// examples/GAME-UDON/scripts.js（CORE 接続とゲームへの橋渡し）を、Bluetooth なしで実行して確かめる。
//   - CoreToolkit による接続（01 / 02、SENSOR_VALUES）は従来のまま
//   - onConnect は GATT characteristic ごとに呼ばれるので、そこから begin() し直したり台数を数えたりしない
//   - gotConvertedAcc（G 単位）がそのままゲームへ届く。G 換算できないときは正規化値から補う
const dir = path.join(__dirname, '../examples/GAME-UDON');
const source = fs.readFileSync(path.join(dir, 'scripts.js'), 'utf8');

const toolkits = [];
const guards = [];
const pushed = [];
const gyros = [];
const events = [];
let beginCalls = 0;

class FakeOrphe {
  constructor(id) { this.id = id; this.setupCalls = 0; this.acc = null; }
  setup() { this.setupCalls++; }
  begin() { beginCalls++; return Promise.resolve(true); }
}

const context = {
  Orphe: FakeOrphe,
  document: { querySelector(sel) { return { sel }; } },
  buildCoreToolkit(parent, title, id, notification, options) { toolkits.push({ parent: parent.sel, title, id, notification, options }); },
  guardCoreToolkitBluetooth(options) { guards.push(options); },
  UdonGame: {
    pushAcc(foot, acc) { pushed.push({ foot, acc }); },
    pushGyro(foot, gyro) { gyros.push({ foot, gyro }); },
    coreEvent(foot, type) { events.push(`${foot}:${type}`); },
  },
  isFinite,
};
vm.runInNewContext(`${source}\nthis.bles = bles;`, context);
const { bles } = context;

// 接続まわりは従来どおり
assert.equal(bles.length, 2);
assert.deepEqual(Array.from(bles, b => b.setupCalls), [1, 1], 'setup() is called once per CORE before the toolkit is built');
assert.deepEqual(toolkits, [
  { parent: '#toolkit_placeholder1', title: '01', id: 0, notification: 'SENSOR_VALUES', options: undefined },
  { parent: '#toolkit_placeholder2', title: '02', id: 1, notification: 'SENSOR_VALUES', options: undefined },
]);
assert.equal(guards.length, 1);
assert.deepEqual(Array.from(guards[0].coreIds), [0, 1]);
assert.equal(guards[0].messageElement, '#ble-support-message');

// onConnect が characteristic の数だけ呼ばれても、接続をやり直さない
for (const characteristic of ['DEVICE_INFORMATION', 'DATE_TIME', 'SENSOR_VALUES']) bles[0].onConnect(characteristic);
assert.equal(beginCalls, 0, 'GATT callbacks never start begin() again');
assert.deepEqual(events, ['0:connect', '0:connect', '0:connect']);
bles[1].onDisconnect();
assert.equal(events.at(-1), '1:disconnect');

// G 単位の加速度が、足の番号つきでそのまま届く（サンプル時刻も保つ）
const sample = { x: 0.1, y: -0.2, z: 0.98, timestamp: 1234 };
bles[0].gotConvertedAcc(sample);
bles[1].gotConvertedAcc({ x: 0, y: 0, z: 1 });
assert.equal(pushed.length, 2);
assert.equal(pushed[0].foot, 0);
assert.equal(pushed[0].acc, sample);
assert.equal(pushed[1].foot, 1);

// G 換算できなかった（NaN）ときは、正規化値を ±16G とみなして補う
bles[0].acc = { x: 0.5, y: 0, z: -0.25, timestamp: 77 };
bles[0].gotConvertedAcc({ x: NaN, y: NaN, z: NaN });
assert.deepEqual({ ...pushed.at(-1).acc }, { x: 8, y: 0, z: -4, timestamp: 77 });

// どちらも無ければ何も渡さない
bles[1].acc = null;
bles[1].gotConvertedAcc({ x: NaN, y: 0, z: 0 });
bles[1].gotConvertedAcc(undefined);
assert.equal(pushed.length, 3);

// ジャイロは、生データのきろく用にそのまま渡す（ふみの判定には使わない。加速度の受け渡しは変わらない）
const before = pushed.length;
const gyro = { x: 1.5, y: -20, z: 300, timestamp: 1234 };
bles[1].gotConvertedGyro(gyro);
assert.deepEqual(gyros, [{ foot: 1, gyro }]);
assert.equal(pushed.length, before);

// index.html: 橋渡しの前にゲーム本体と検出器が読み込まれること（すべて defer で、書かれた順に実行される）
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const scripts = Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g), m => m[1]);
const order = name => scripts.indexOf(name);
for (const name of ['step-detector.js', 'health-analysis.js', 'udon-menu.js', 'combo.js', 'udon-art.js', 'charts.js', 'audio.js', 'game.js', 'scripts.js']) {
  assert.ok(order(name) >= 0, `${name} is loaded`);
  assert.ok(fs.existsSync(path.join(dir, name)), `${name} exists`);
}
assert.ok(order('../../js/CoreToolkit.js') < order('scripts.js'));
assert.ok(order('game.js') < order('scripts.js'), 'UdonGame is defined before the bridge runs');
assert.ok(order('step-detector.js') < order('game.js'));
assert.ok(order('combo.js') < order('game.js'));
for (const id of ['toolkit_placeholder1', 'toolkit_placeholder2', 'ble-support-message', 'stage', 'stageCanvas']) {
  assert.ok(html.includes(`id="${id}"`), `#${id} exists`);
}

// 画面で使っている id が、game.js の参照と食い違っていないこと
const game = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
const ids = new Set(Array.from(game.matchAll(/\$\('([A-Za-z0-9_]+)'\)/g), m => m[1]));
const onIds = Array.from(game.matchAll(/\bon\('([A-Za-z0-9_]+)'/g), m => m[1]);
for (const id of [...ids, ...onIds]) {
  assert.ok(html.includes(`id="${id}"`), `game.js refers to #${id}, which must exist in index.html`);
}

console.log('udon-core-bridge.test.js passed');
