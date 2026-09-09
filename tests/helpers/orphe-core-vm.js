// js/ORPHE-CORE.js はトップレベルで document を参照するため require できない。
// tests/core2-header40-parse.test.js / tests/core-header50-sample-timestamps.test.js と同じく
// vm コンテキストで評価して Orphe クラスを取り出す共通ハーネス。
//
//   const { loadOrphe } = require('./helpers/orphe-core-vm');
//   const { Orphe, context } = loadOrphe({ console: fakeConsole });
//
// options.console を渡すと SDK 内の console.* 呼び出しをそこに向けられる（ログ抑制のテスト用）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');

function loadOrphe(options = {}) {
  const context = {
    console: options.console || console,
    window: {},
    navigator: options.navigator || {},
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    document: {
      readyState: 'complete',
      scripts: [],
      head: { appendChild() {} },
      createElement() { return {}; },
      addEventListener() {},
    },
    setTimeout,
    clearTimeout,
    performance: { now() { return Date.now(); } },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/quaternion.js'), 'utf8'), context);
  vm.runInContext(
    // this.Error は vm realm の Error。テスト側で注入するエラーを同じ realm で作れるようにする
    // （Node realm の Error は vm 内の `instanceof Error` に一致しないため）。
    `${fs.readFileSync(path.join(root, 'js/ORPHE-CORE.js'), 'utf8')}\nthis.Orphe = Orphe;\nthis.Error = Error;\nthis.orpheCoreSerialDistance = orpheCoreSerialDistance;`,
    context
  );
  if (typeof context.Orphe !== 'function') {
    throw new Error('Orphe class was not exposed in the VM context.');
  }
  return { Orphe: context.Orphe, orpheCoreSerialDistance: context.orpheCoreSerialDistance, context };
}


// ── モック BluetoothDevice / GATT ──────────────────────────────────────────────
// begin() / connectGATT() / startNotify() の回帰テスト用に、実機 GATT の最小限の振る舞い
//   connect() → getPrimaryService() → getCharacteristic() → readValue / writeValue / startNotifications
// を再現する。失敗の注入（notify 失敗・connect が resolve しない・chooser キャンセル）ができる。
const CORE_UUID = {
  INFORMATION: '01a9d6b5-ff6e-444a-b266-0be75e85c064',
  OTHER_SERVICE: 'db1b7aca-cda5-4453-a49b-33a53d3f0833',
  DEVICE_INFORMATION: '24354f22-1c46-430e-a4ab-a1eeabbcdfc0',
  DATE_TIME: 'f53eeeb1-b2e8-492a-9673-10e0f1c29026',
  SENSOR_VALUES: 'f3f9c7ce-46ee-4205-89ac-abe64e626c0f',
  STEP_ANALYSIS: '4eb776dc-cf99-4af7-b2d3-ad0f791a79dd',
};

// getDeviceInformation() が読む 20 byte の DEVICE_INFORMATION ペイロード
function deviceInformationPayload() {
  const view = new DataView(new ArrayBuffer(20));
  view.setUint8(0, 2); // battery
  view.setUint8(1, 0); // lr
  view.setUint8(8, 3); // acc range index
  view.setUint8(9, 3); // gyro range index
  return view;
}

// getDateTime() が読む 7 byte の DATE_TIME ペイロード
function dateTimePayload() {
  const view = new DataView(new ArrayBuffer(7));
  const now = new Date();
  view.setUint8(0, now.getFullYear() - 2000);
  view.setUint8(1, now.getMonth());
  view.setUint8(2, now.getDate());
  view.setUint8(3, now.getHours());
  view.setUint8(4, now.getMinutes());
  view.setUint8(5, now.getSeconds());
  view.setUint8(6, 0);
  return view;
}

class MockGattCharacteristic {
  constructor(device, uuid) {
    this.device = device;
    this.uuid = uuid;
    this.notifying = false;
    this.writes = [];
    this._listeners = [];
  }
  addEventListener(type, fn) { this._listeners.push([type, fn]); }
  removeEventListener(type, fn) {
    const i = this._listeners.findIndex(([t, f]) => t === type && f === fn);
    if (i >= 0) this._listeners.splice(i, 1);
  }
  async startNotifications() {
    this.device.startNotifyCalls.push(this.uuid);
    const failure = this.device.failStartNotifications;
    const error = typeof failure === 'function' ? failure(this.uuid) : failure;
    if (error) throw error;
    this.notifying = true;
    return this;
  }
  async stopNotifications() { this.notifying = false; return this; }
  async readValue() {
    if (this.uuid === CORE_UUID.DEVICE_INFORMATION) return deviceInformationPayload();
    if (this.uuid === CORE_UUID.DATE_TIME) return dateTimePayload();
    return new DataView(new ArrayBuffer(20));
  }
  async writeValue(value) { this.writes.push(value); return undefined; }
}

class MockGattService {
  constructor(device, uuid) { this.device = device; this.uuid = uuid; }
  async getCharacteristic(uuid) { return this.device.characteristic(uuid); }
}

class MockBluetoothDevice {
  /**
   * @param {object} [options]
   * @param {Error|function} [options.failStartNotifications] startNotifications() で投げるエラー
   *   （関数を渡すと characteristic UUID を受け取り、エラーを返したときだけ失敗させられる）
   * @param {boolean} [options.connectNeverResolves] gatt.connect() が永久に pending になる
   */
  constructor(options = {}) {
    this.name = options.name || 'CR-3 mock';
    this.id = options.id || 'mock-device-id';
    this.failStartNotifications = options.failStartNotifications || null;
    this.connectNeverResolves = !!options.connectNeverResolves;
    this.startNotifyCalls = [];
    this.connectCalls = 0;
    this.disconnectCalls = 0;
    this._characteristics = new Map();
    this._listeners = new Map();

    const device = this;
    this.gatt = {
      connected: false,
      async connect() {
        device.connectCalls++;
        if (device.connectNeverResolves) return new Promise(() => {});
        this.connected = true;
        return { getPrimaryService: async (uuid) => new MockGattService(device, uuid) };
      },
      disconnect() {
        device.disconnectCalls++;
        this.connected = false;
        device.dispatchEvent({ type: 'gattserverdisconnected' });
      },
    };
  }
  characteristic(uuid) {
    if (!this._characteristics.has(uuid)) this._characteristics.set(uuid, new MockGattCharacteristic(this, uuid));
    return this._characteristics.get(uuid);
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
}

/**
 * navigator.bluetooth のモック。
 * @param {object} [options]
 * @param {MockBluetoothDevice} [options.device] requestDevice() が返すデバイス
 * @param {Error} [options.requestDeviceError] requestDevice() を reject させるエラー
 */
function makeMockNavigator(options = {}) {
  const calls = [];
  const bluetooth = {
    requestDevice: async (requestOptions) => {
      calls.push(requestOptions);
      if (options.requestDeviceError) throw options.requestDeviceError;
      return options.device;
    },
  };
  return { bluetooth, requestDeviceCalls: calls };
}

/** テスト内の await が回帰でハングしないよう、必ず ms 以内に settle させるガード。 */
function settleWithin(promise, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`TEST_TIMEOUT: ${label} did not settle within ${ms}ms`)), ms);
    }),
  ]);
}

module.exports = {
  loadOrphe,
  CORE_UUID,
  MockBluetoothDevice,
  MockGattCharacteristic,
  makeMockNavigator,
  settleWithin,
};
