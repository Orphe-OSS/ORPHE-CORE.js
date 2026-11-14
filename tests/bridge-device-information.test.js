// BleSharedBridge の Secondary タブで device_information が空のままになる問題の回帰テスト。
//
// 旧実装では Secondary タブは BLE を持たないため getDeviceInformation() が呼ばれず、
// device_information は初期値 '' のままだった。gait.direction の 3/4（inside/outside）を
// 左右に変換するレシピは device_information.lr を使うので、Secondary では常に
// `undefined & 1 === 0`（= 左足）として扱われていた。
// Primary がハートビートに device_information のスナップショットを載せ、
// Secondary が購読開始時と変更時に受け取ることを確認する。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadOrphe } = require('./helpers/orphe-core-vm');

const root = path.resolve(__dirname, '..');

// 同一オリジンの全タブが共有する localStorage と window イベント
function createSharedBrowser(context) {
  const store = new Map();
  context.localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
  const listeners = new Map();
  context.addEventListener = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  };
  context.removeEventListener = (type, fn) => {
    const list = listeners.get(type) || [];
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  };
  context.BroadcastChannel = class {
    postMessage() {}
    close() {}
  };
  context.setInterval = setInterval;
  context.clearInterval = clearInterval;
  // 他タブの localStorage 変更で発火する storage イベントを手動で配る
  const dispatchStorage = (key) => {
    for (const fn of [...(listeners.get('storage') || [])]) {
      fn({ key, newValue: context.localStorage.getItem(key) });
    }
  };
  return { dispatchStorage };
}

const { Orphe, context } = loadOrphe();
const { dispatchStorage } = createSharedBrowser(context);
vm.runInContext(
  `${fs.readFileSync(path.join(root, 'js/BleSharedBridge.js'), 'utf8')}\nthis.BleSharedBridge = BleSharedBridge;`,
  context
);
const { BleSharedBridge } = context;
const storageKey = 'orphe_bridge_primary_0';

// ── snapshot は JSON にできる値だけを残す（getDeviceInformation() の DataView は除く）──────
{
  const snapshot = BleSharedBridge.snapshotDeviceInformation({
    battery: 2, lr: 1, rec_mode: 0, rec_auto_run: 0, led_brightness: 255,
    range: { acc: 3, gyro: 3 },
    data: { byteLength: 20 },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
    battery: 2, lr: 1, rec_mode: 0, rec_auto_run: 0, led_brightness: 255,
    range: { acc: 3, gyro: 3 },
  });
  assert.equal(BleSharedBridge.snapshotDeviceInformation(''), null, "initial '' is not shared");
  assert.equal(BleSharedBridge.snapshotDeviceInformation({}), null);
}

// ── Primary のデバイス情報が Secondary の Orphe#device_information に届き、変更も追従する ──
{
  const primaryInfo = { battery: 2, lr: 1, rec_mode: 0, rec_auto_run: 0, led_brightness: 255, range: { acc: 3, gyro: 3 } };
  const primary = new BleSharedBridge(0);
  primary.claimPrimary({ getDeviceInformation: () => primaryInfo });

  const stored = JSON.parse(context.localStorage.getItem(storageKey));
  assert.equal(stored.deviceInformation.lr, 1, 'heartbeat carries device information');

  const core = new Orphe(0);
  core.onConnect = () => {};
  assert.equal(core.device_information, '', 'precondition: secondary starts without device information');

  const bridge = new BleSharedBridge(0);
  assert.equal(bridge.getRemoteDeviceInformation().lr, 1);

  let updates = 0;
  core._beginAsSecondary(bridge, 'STEP_ANALYSIS');
  assert.equal(core.device_information.lr, 1, 'secondary receives lr on subscribe');
  assert.deepEqual(JSON.parse(JSON.stringify(core.device_information.range)), { acc: 3, gyro: 3 });

  // 変化のないハートビートでは再通知しない
  const originalSetter = bridge._callbacks.onDeviceInformation;
  bridge._callbacks.onDeviceInformation = (info) => { updates++; originalSetter(info); };
  primary._updateHeartbeat();
  dispatchStorage(storageKey);
  assert.equal(updates, 0, 'unchanged heartbeat does not re-emit');

  // Primary で setMountPosition() 相当の変更 → 次のハートビートで Secondary に届く
  primaryInfo.lr = 0;
  primary._updateHeartbeat();
  dispatchStorage(storageKey);
  assert.equal(updates, 1);
  assert.equal(core.device_information.lr, 0, 'secondary follows lr changes on the primary');

  bridge.release();
  primary.release();
  assert.equal(context.localStorage.getItem(storageKey), null);
}

// ── deviceInformation を載せない旧 Primary とも共存できる（device_information は '' のまま）──
{
  context.localStorage.setItem(storageKey, JSON.stringify({ timestamp: Date.now(), tabId: 'tab_old_primary' }));
  const core = new Orphe(0);
  core.onConnect = () => {};
  const bridge = new BleSharedBridge(0);
  assert.equal(bridge.isRemotePrimaryAvailable(), true);
  assert.equal(bridge.getRemoteDeviceInformation(), null);
  core._beginAsSecondary(bridge, 'STEP_ANALYSIS');
  assert.equal(core.device_information, '');
  bridge.release();
  context.localStorage.removeItem(storageKey);
}

// ── タイムアウトした Primary のデバイス情報は使わない ─────────────────────────────
{
  context.localStorage.setItem(storageKey, JSON.stringify({
    timestamp: Date.now() - BleSharedBridge.HEARTBEAT_TIMEOUT_MS - 1,
    tabId: 'tab_stale_primary',
    deviceInformation: { lr: 1 },
  }));
  const bridge = new BleSharedBridge(0);
  assert.equal(bridge.isRemotePrimaryAvailable(), false);
  assert.equal(bridge.getRemoteDeviceInformation(), null);
  context.localStorage.removeItem(storageKey);
}

console.log('bridge-device-information.test.js: all assertions passed');
