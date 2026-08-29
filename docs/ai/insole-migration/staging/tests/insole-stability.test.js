// v1.1.0 で追加した接続安定化まわりのユニットテスト。
// BLE 実機を使わずに検証できる純粋ロジックのみを対象とする。
const assert = require('node:assert/strict');

// ブラウザ専用グローバルの最小モック（require 時の参照エラー回避）
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const {
  Orphe,
  OrpheInsole,
  parseInsoleSensorValues,
} = require('../src/ORPHE-INSOLE.js');

async function main() {
  // ── クラス名・エイリアス ─────────────────────────────────────
  assert.equal(OrpheInsole, Orphe, 'Orphe must alias OrpheInsole');
  assert.equal(OrpheInsole.name, 'OrpheInsole', 'primary class name should be OrpheInsole');
  assert.equal(typeof OrpheInsole.parseSensorValues, 'function');

  const insole = new OrpheInsole(0);

  // ── デバイス記憶のストレージキーが CORE と衝突しない ───────────
  assert.equal(insole._lastBluetoothDeviceStorageKey, 'orphe_insole_last_bluetooth_device_0');
  assert.equal(new OrpheInsole(1)._lastBluetoothDeviceStorageKey, 'orphe_insole_last_bluetooth_device_1');

  // ── _findBluetoothDevice のマッチングロジック ─────────────────
  const devices = [
    { id: 'aaa', name: 'INS-L' },
    { id: 'bbb', name: 'INS-R' },
    { id: 'ccc', name: 'INS-R' },
  ];
  // id 一致が最優先
  assert.equal(insole._findBluetoothDevice(devices, { bluetoothId: 'bbb' }), devices[1]);
  // id 不一致でも名前が一意なら名前で一致
  assert.equal(insole._findBluetoothDevice(devices, { bluetoothId: 'zzz', bluetoothName: 'INS-L' }), devices[0]);
  // 名前が重複する場合は誤接続防止のため null
  assert.equal(insole._findBluetoothDevice(devices, { bluetoothName: 'INS-R' }), null);
  assert.equal(insole._findBluetoothDevice(devices, null), null);
  assert.equal(insole._findBluetoothDevice('not-an-array', { bluetoothId: 'aaa' }), null);

  // ── 自動再接続の設定値正規化 ──────────────────────────────────
  insole._autoReconnectOptions = {};
  assert.equal(insole._autoReconnectIntervalMs(), 3000, 'default interval');
  assert.equal(insole._autoReconnectMaxAttempts(), 120, 'default attempts');
  insole._autoReconnectOptions = { reconnectIntervalMs: 500, reconnectMaxAttempts: 5 };
  assert.equal(insole._autoReconnectIntervalMs(), 500);
  assert.equal(insole._autoReconnectMaxAttempts(), 5);
  insole._autoReconnectOptions = { reconnectIntervalMs: -1, reconnectMaxAttempts: 0 };
  assert.equal(insole._autoReconnectIntervalMs(), 3000, 'negative interval falls back');
  assert.equal(insole._autoReconnectMaxAttempts(), 120, 'zero attempts falls back');

  insole._enableAutoReconnect('SENSOR_VALUES', { streamingMode: 3 });
  assert.equal(insole._autoReconnectEnabled, true);
  assert.equal(insole._autoReconnectOptions.autoReconnect, true);
  assert.equal(insole._autoReconnectOptions.streamingMode, 3);
  insole._disableAutoReconnect();
  assert.equal(insole._autoReconnectEnabled, false);

  // ── _reportError は自動再接続中に onError を抑制する ───────────
  let errorCount = 0;
  insole.onError = () => { errorCount++; };
  insole._reportError(new Error('a'));
  assert.equal(errorCount, 1);
  insole._suppressAutoReconnectErrors = true;
  insole._reportError(new Error('b'));
  assert.equal(errorCount, 1, 'suppressed during reconnect');
  assert.equal(insole._lastAutoReconnectError.message, 'b');
  insole._suppressAutoReconnectErrors = false;

  // ── setDataStreamingMode のバリデーション（write をモック） ────
  {
    const written = [];
    const target = new OrpheInsole(0);
    target.write = async (uuid, data) => { written.push({ uuid, data: Array.from(data) }); };
    await target.setDataStreamingMode(3);
    assert.deepEqual(written[0], { uuid: 'DEVICE_INFORMATION', data: [0x0D, 3] });
    assert.equal(target.streaming_mode, 3);
    await assert.rejects(() => target.setDataStreamingMode(2), /Invalid ORPHE INSOLE data streaming mode/);
    await assert.rejects(() => target.setDataStreamingMode('x'), /Invalid ORPHE INSOLE data streaming mode/);
  }

  // ── 公開APIサーフェスの回帰チェック（v1.0.0 からの非意図的削除を防ぐ） ──
  {
    const publicMethods = [
      // v1.0.0 から存在する公開メソッド
      'setup', 'setUUID', 'begin', 'stop', 'reset', 'clear', 'disconnect', 'isConnected',
      'scan', 'requestDevice', 'connectGATT', 'read', 'write', 'startNotify', 'stopNotify',
      'setDataStreamingMode', 'setDeviceInformation', 'getDeviceInformation',
      'getDateTime', 'setDateTime', 'syncCoreTime', 'resetAnalysisLogs',
      'autoStartWatchingAdvertisements', 'startWatchingAdvertisements',
      'stopWatchingAdvertisements', 'connectToNotifications', 'onAdvertisementReceived',
      'isGotDataOverridden',
      // v1.0.0 から存在するコールバックプロトタイプ
      'gotData', 'gotStatus', 'gotPress', 'gotQuat', 'gotGyro', 'gotAcc',
      'gotConvertedGyro', 'gotConvertedAcc', 'gotDelta', 'gotEuler',
      'gotGait', 'gotType', 'gotDirection', 'gotCalorie', 'gotDistance',
      'gotStandingPhaseDuration', 'gotSwingPhaseDuration', 'gotStride', 'gotFootAngle',
      'gotPronation', 'gotLandingImpact', 'gotStepsNumber', 'gotBLEFrequency', 'lostData',
      'onScan', 'onConnectGATT', 'onConnect', 'onWrite', 'onStartNotify', 'onStopNotify',
      'onDisconnect', 'onAdvertisement', 'onClear', 'onReset', 'onError', 'onRead',
      // v1.1.0 で追加した公開メソッド/コールバック
      'selectBluetoothDevice', 'forgetLastBluetoothDevice',
      'onReconnectAttempt', 'onReconnectSuccess', 'onReconnectFailed',
    ];
    for (const name of publicMethods) {
      assert.equal(typeof OrpheInsole.prototype[name], 'function',
        `public API missing: ${name}`);
    }
    assert.equal(typeof OrpheInsole.parseSensorValues, 'function');
  }

  // ── 既存パーサが壊れていないこと（スモーク） ───────────────────
  {
    const data = new DataView(new ArrayBuffer(104));
    data.setUint8(0, 56);
    data.setUint16(1, 7);
    const parsed = parseInsoleSensorValues(data);
    assert.equal(parsed.header, 56);
    assert.equal(parsed.samples.length, 2);
  }

  console.log('insole-stability.test.js passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
