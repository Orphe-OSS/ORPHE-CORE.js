// gattserverdisconnected の遅延バインドハンドラの回帰テスト。
//
// 旧実装は `device.addEventListener('gattserverdisconnected', this.onDisconnect)` と
// メソッド参照をそのまま登録していたため、
//   - begin() 後に ble.onDisconnect を上書きしても古い関数が呼ばれ続け、
//   - ハンドラ内の this が Orphe インスタンスではなく BluetoothDevice になっていた。
// コンストラクタで 1 度だけ作る `_onDisconnectHandler` を全登録箇所で使い、同じデバイスへの
// 二重登録は removeEventListener → addEventListener で 1 回に抑える。

const assert = require('node:assert/strict');
const { loadOrphe } = require('./helpers/orphe-core-vm');

const { Orphe } = loadOrphe();

// EventTarget 風のモック BluetoothDevice（ブラウザ同様、同じ参照は 1 回しか登録されない）
class MockBluetoothDevice {
  constructor(name = 'CR-3 mock') {
    this.name = name;
    this.id = 'mock-device-id';
    this.gatt = { connected: false, disconnect() { this.connected = false; } };
    this._listeners = new Map();
  }
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    const list = this._listeners.get(type);
    if (!list.includes(fn)) list.push(fn);
  }
  removeEventListener(type, fn) {
    const list = this._listeners.get(type) || [];
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  dispatchEvent(event) {
    for (const fn of [...(this._listeners.get(event.type) || [])]) fn.call(this, event);
    return true;
  }
  listenerCount(type) {
    return (this._listeners.get(type) || []).length;
  }
}

// ── コンストラクタで 1 度だけ作られ、this.onDisconnect を遅延解決する ────────────────────
{
  const core = new Orphe(0);
  assert.equal(typeof core._onDisconnectHandler, 'function', '_onDisconnectHandler is created in the constructor');
  assert.equal(typeof core._attachDisconnectHandler, 'function', '_attachDisconnectHandler helper exists');
  const first = core._onDisconnectHandler;
  const device = new MockBluetoothDevice();
  core._attachDisconnectHandler(device);
  assert.equal(core._onDisconnectHandler, first, 'the handler reference is stable');
  assert.equal(device.listenerCount('gattserverdisconnected'), 1);
}

// ── 接続後に onDisconnect を上書きしても、上書き後の関数が this=インスタンスで 1 回呼ばれる ──
{
  const core = new Orphe(0);
  const device = new MockBluetoothDevice();
  const originalDefault = core.onDisconnect;
  core._attachDisconnectHandler(device); // 接続時の登録（旧: addEventListener(..., this.onDisconnect)）

  const calls = [];
  core.onDisconnect = function (event) { calls.push({ self: this, event }); };
  assert.notEqual(core.onDisconnect, originalDefault, 'sanity: override happened after registration');

  const event = { type: 'gattserverdisconnected' };
  device.dispatchEvent(event);
  assert.equal(calls.length, 1, 'the override is called exactly once');
  assert.equal(calls[0].self, core, 'this inside onDisconnect is the Orphe instance (was the BluetoothDevice)');
  assert.equal(calls[0].event, event, 'the event is forwarded');
}

// ── 同じデバイスに複数回登録しても 1 回しか呼ばれない ───────────────────────────────
{
  const core = new Orphe(0);
  const device = new MockBluetoothDevice();
  core._attachDisconnectHandler(device);
  core._attachDisconnectHandler(device);
  core._attachDisconnectHandler(device);
  assert.equal(device.listenerCount('gattserverdisconnected'), 1, 'no duplicate registration');

  let count = 0;
  core.onDisconnect = function () { count++; };
  device.dispatchEvent({ type: 'gattserverdisconnected' });
  assert.equal(count, 1, 'registering twice still calls onDisconnect once');
}

// ── 既定の onDisconnect（debug=false）は何も出力せず、例外も投げない ─────────────────
{
  const logs = [];
  const fakeConsole = { log: (...a) => logs.push(a), info: (...a) => logs.push(a), warn: (...a) => logs.push(a), error: (...a) => logs.push(a) };
  const { Orphe: OrpheQuiet } = loadOrphe({ console: fakeConsole });
  const core = new OrpheQuiet(1);
  const device = new MockBluetoothDevice();
  core._attachDisconnectHandler(device);
  assert.doesNotThrow(() => device.dispatchEvent({ type: 'gattserverdisconnected' }));
  assert.deepEqual(logs, [], 'default onDisconnect is silent unless debug is enabled');
}

// ── 別デバイスへ切り替えても各デバイスに 1 つずつ ─────────────────────────────────
{
  const core = new Orphe(0);
  const a = new MockBluetoothDevice('A');
  const b = new MockBluetoothDevice('B');
  core._attachDisconnectHandler(a);
  core._attachDisconnectHandler(b);
  assert.equal(a.listenerCount('gattserverdisconnected'), 1);
  assert.equal(b.listenerCount('gattserverdisconnected'), 1);
  let count = 0;
  core.onDisconnect = function () { count++; };
  b.dispatchEvent({ type: 'gattserverdisconnected' });
  assert.equal(count, 1);
}

// ── 自動再接続用の別ハンドラ（_autoReconnectDisconnectHandler）には触っていない ─────────
{
  const core = new Orphe(0);
  assert.equal(typeof core._autoReconnectDisconnectHandler, 'function');
  assert.notEqual(core._autoReconnectDisconnectHandler, core._onDisconnectHandler, 'auto-reconnect handler stays separate');
}

// ── ソース上に `this.onDisconnect` を直接 addEventListener する箇所が残っていない ────────
{
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'js/ORPHE-CORE.js'), 'utf8');
  const direct = src.match(/addEventListener\('gattserverdisconnected',\s*this\.onDisconnect\)/g) || [];
  assert.equal(direct.length, 0, 'no site registers this.onDisconnect directly anymore');
  const viaHelper = src.match(/this\._attachDisconnectHandler\(this\.bluetoothDevice\)/g) || [];
  assert.equal(viaHelper.length, 6, 'all 6 former sites use _attachDisconnectHandler');
}

console.log('core-disconnect-handler.test.js passed');
