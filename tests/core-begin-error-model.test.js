// begin() のエラーモデル（Phase 1c）の回帰テスト。
//
// 旧実装の begin() は notify を hand-rolled な `new Promise` の中で `.catch` なしに呼んでいたため、
//   - startNotify() が reject すると Promise が settle せず `await ble.begin()` が永久にハング
//   - 未知の notification_type は if/else のどれにも一致せず、同じく永久ハング
//   - STEP_ANALYSIS 分岐だけは `.catch(err => reject('User cancel.'))` で真のエラーを捨てて文字列 reject
//   - 末尾の `.catch(error => { this._reportError(error); return; })` が本物の失敗を握りつぶして
//     undefined を resolve
// 新しい契約:
//   成功              → 従来どおり truthy な文字列を resolve
//   chooser キャンセル → undefined を resolve（onError は呼ばない）
//   本物の失敗         → error.code を持つ Error で reject
//
// すべての await は settleWithin() で囲む。回帰でハングしてもテスト自体はハングせず TEST_TIMEOUT で落ちる。
//
// 注意: SDK は vm realm で評価されるので、注入するエラーは context.Error（vm 側の Error）で作る。
// Node realm の Error だと SDK 内の `instanceof Error` に一致せず、実ブラウザと挙動が変わってしまう。

const assert = require('node:assert/strict');
const {
  loadOrphe,
  MockBluetoothDevice,
  makeMockNavigator,
  settleWithin,
} = require('./helpers/orphe-core-vm');

const SETTLE_MS = 2000;
const quietConsole = { log() {}, info() {}, warn() {}, error() {} };

// begin() の 500ms 待機ぶん余裕を持たせた上限。ハングしていれば必ずここで落ちる。
function beginWithin(promise, label) {
  return settleWithin(promise, SETTLE_MS, label);
}

// モック実機 1 台に接続できる Orphe インスタンスを用意する。
// navOptions / device のフィールドは呼び出し時に読まれるので、返した後から失敗を注入できる。
function makeCore(deviceOptions = {}) {
  const device = new MockBluetoothDevice(deviceOptions);
  const navOptions = { device };
  const nav = makeMockNavigator(navOptions);
  const { Orphe, context } = loadOrphe({ console: quietConsole, navigator: nav });
  const core = new Orphe(0);
  core.setup();
  const errors = [];
  core.onError = (error) => { errors.push(error); };
  const newError = (message, name) => {
    const error = new context.Error(message);
    if (name) error.name = name;
    return error;
  };
  const isError = (value) => value instanceof context.Error;
  return { core, device, errors, context, navOptions, newError, isError };
}

async function assertRejects(promise, label) {
  let value;
  try {
    value = await beginWithin(promise, label);
  } catch (error) {
    if (error && typeof error.message === 'string' && error.message.startsWith('TEST_TIMEOUT')) throw error;
    return error;
  }
  assert.fail(`${label}: expected a rejection but resolved with ${JSON.stringify(value)}`);
}

(async () => {
  // ── orpheCoreIsUserCancel の単体ケース ────────────────────────────────────
  {
    const { context, newError } = makeCore();
    const isUserCancel = context.orpheCoreIsUserCancel;
    assert.equal(typeof isUserCancel, 'function', 'orpheCoreIsUserCancel is exported on the global');

    assert.equal(isUserCancel(newError('User cancelled the requestDevice() chooser.', 'NotFoundError')), true,
      'NotFoundError (chooser dismissed) is a cancellation');
    assert.equal(isUserCancel(newError('nothing matched', 'NotFoundError')), true,
      'NotFoundError is a cancellation regardless of the message');
    assert.equal(isUserCancel(newError('User canceled the request')), true, 'US spelling matches');
    assert.equal(isUserCancel(newError('the chooser was dismissed')), true, '"chooser" matches');
    assert.equal(isUserCancel('User cancelled'), true, 'raw strings are accepted');

    assert.equal(isUserCancel(newError('GATT operation failed for unknown reason.', 'NetworkError')), false,
      'a genuine GATT failure is not a cancellation');
    assert.equal(isUserCancel(null), false, 'null is not a cancellation');
    assert.equal(isUserCancel(undefined), false, 'undefined is not a cancellation');
  }

  // ── orpheCoreError ファクトリ ────────────────────────────────────────────
  {
    const { context, newError, isError } = makeCore();
    const cause = newError('boom');
    const error = context.orpheCoreError('NOTIFY_FAILED', 'notify failed', cause);
    assert.ok(isError(error));
    assert.equal(error.code, 'NOTIFY_FAILED');
    assert.equal(error.name, 'OrpheCoreError');
    assert.equal(error.cause, cause);
    assert.equal(context.orpheCoreError('NO_DEVICE', 'x').cause, undefined, 'cause is omitted when not given');
  }

  // ── 成功パスは従来どおりの文字列を resolve する ────────────────────────────
  {
    const { core, errors } = makeCore();
    const ret = await beginWithin(core.begin('SENSOR_VALUES'), "begin('SENSOR_VALUES')");
    assert.equal(ret, 'done begin(); SENSOR VALUES', 'the resolved string is unchanged');
    assert.deepEqual(errors, [], 'no onError on the success path');
  }
  {
    const { core } = makeCore();
    assert.equal(await beginWithin(core.begin('STEP_ANALYSIS'), "begin('STEP_ANALYSIS')"),
      'done begin(); STEP ANALYSIS');
  }
  {
    const { core, device } = makeCore();
    assert.equal(await beginWithin(core.begin('STEP_ANALYSIS_AND_SENSOR_VALUES'), "begin('BOTH')"),
      'done begin(); STEP_ANALYSIS and SENSOR VALUES');
    assert.equal(device.startNotifyCalls.length, 2, 'both characteristics are subscribed');
  }

  // ── 未知の notification_type は settle して UNSUPPORTED_NOTIFICATION で reject ──
  {
    const { core, errors, isError } = makeCore();
    const error = await assertRejects(core.begin('NOT_A_REAL_TYPE'), "begin('NOT_A_REAL_TYPE')");
    assert.ok(isError(error), 'rejects with an Error, not a bare string');
    assert.equal(error.code, 'UNSUPPORTED_NOTIFICATION');
    assert.match(error.message, /NOT_A_REAL_TYPE/);
    assert.match(error.message, /STEP_ANALYSIS_AND_SENSOR_VALUES/, 'the message lists the valid values');
    assert.equal(errors.length, 1, 'onError is called once');
    assert.equal(errors[0].code, 'UNSUPPORTED_NOTIFICATION');
  }

  // ── startNotify の失敗は 3 種すべてで NOTIFY_FAILED（旧実装のハング回帰） ──────
  const STEP_ANALYSIS_UUID = '4eb776dc-cf99-4af7-b2d3-ad0f791a79dd';
  const SENSOR_VALUES_UUID = 'f3f9c7ce-46ee-4205-89ac-abe64e626c0f';
  for (const [type, failing] of [
    ['STEP_ANALYSIS', STEP_ANALYSIS_UUID],
    ['SENSOR_VALUES', SENSOR_VALUES_UUID],
    ['STEP_ANALYSIS_AND_SENSOR_VALUES', STEP_ANALYSIS_UUID],
    // 2 番目の notify の失敗（旧実装では内側の .then に catch が無く必ずハングしていた）
    ['STEP_ANALYSIS_AND_SENSOR_VALUES', SENSOR_VALUES_UUID],
  ]) {
    const label = `${type} / failing ${failing === STEP_ANALYSIS_UUID ? 'STEP_ANALYSIS' : 'SENSOR_VALUES'}`;
    const { core, device, errors, newError, isError } = makeCore();
    const cause = newError(`startNotifications failed for ${failing}`, 'NetworkError');
    device.failStartNotifications = (uuid) => (uuid === failing ? cause : null);

    const error = await assertRejects(core.begin(type), `begin('${type}') with a failing notify`);
    assert.ok(isError(error), `${label}: rejects with an Error`);
    assert.equal(error.code, 'NOTIFY_FAILED', `${label}: code is NOTIFY_FAILED`);
    assert.equal(error.cause, cause, `${label}: the original error is preserved as cause`);
    assert.match(error.message, /startNotify/, `${label}: the message names the failed step`);
    assert.equal(errors.length, 1, `${label}: onError is called exactly once`);
  }

  // ── chooser キャンセルは undefined を resolve し、onError を呼ばない ────────────
  {
    const { core, errors, navOptions, newError } = makeCore();
    navOptions.requestDeviceError = newError('User cancelled the requestDevice() chooser.', 'NotFoundError');
    const ret = await beginWithin(core.begin('SENSOR_VALUES'), 'begin() with a cancelled chooser');
    assert.equal(ret, undefined, 'cancellation resolves undefined (falsy), so `if (!ret)` keeps working');
    assert.deepEqual(errors, [], 'onError is NOT called for a cancellation');
    assert.equal(core.connectionState, 'disconnected', 'the connecting flag is cleared after a cancellation');
  }

  // ── 本物の scan 失敗は code 付きで reject し、onError はちょうど 1 回 ─────────────
  {
    const { core, errors, navOptions, newError, isError } = makeCore();
    const gattError = newError('GATT operation failed for unknown reason.', 'NetworkError');
    navOptions.requestDeviceError = gattError;
    const error = await assertRejects(core.begin('SENSOR_VALUES'), 'begin() with a failing scan');
    assert.ok(isError(error));
    assert.equal(typeof error.code, 'string', 'the rejection carries a machine-readable code');
    assert.equal(error.code, 'BEGIN_FAILED');
    assert.equal(error.cause, gattError, 'the underlying GATT error is preserved as cause');
    assert.equal(errors.length, 1, 'onError is called exactly once (not once per wrapping layer)');
  }

  // ── 重複デバイスは DUPLICATE_DEVICE ────────────────────────────────────────
  {
    const { core } = makeCore();
    const error = await assertRejects(
      core.begin('SENSOR_VALUES', { disallowBluetoothDeviceIds: ['mock-device-id'] }),
      'begin() with a duplicate device'
    );
    assert.equal(error.code, 'DUPLICATE_DEVICE');
    assert.equal(error.name, 'DuplicateBluetoothDeviceError', 'the legacy name is preserved');
  }

  // ── connectionState の遷移 ────────────────────────────────────────────────
  {
    const { core } = makeCore();
    assert.equal(core.connectionState, 'disconnected', 'before begin()');

    const pending = core.begin('SENSOR_VALUES');
    assert.equal(core.connectionState, 'connecting', 'synchronously after begin() is called');

    assert.equal(await beginWithin(pending, 'begin() for the connectionState transition'),
      'done begin(); SENSOR VALUES');
    assert.equal(core.connectionState, 'connected', 'after begin() resolves');

    core.disconnect();
    assert.equal(core.connectionState, 'disconnected', 'after disconnect()');
  }

  // ── connectionState: 自動再接続中 / BleSharedBridge secondary ────────────────
  {
    const { core } = makeCore();
    core._autoReconnectInProgress = true;
    assert.equal(core.connectionState, 'reconnecting');
    core._autoReconnectInProgress = false;
    core._isBridgeSecondary = true;
    assert.equal(core.connectionState, 'connected', 'BleSharedBridge secondary counts as connected');
  }

  // ── connectTimeoutMs: connect が resolve しないと CONNECT_TIMEOUT ─────────────
  {
    const { core, errors } = makeCore({ connectNeverResolves: true });
    const startedAt = Date.now();
    const error = await assertRejects(
      core.begin('SENSOR_VALUES', { connectTimeoutMs: 120 }),
      'begin() with a hanging gatt.connect()'
    );
    const elapsed = Date.now() - startedAt;
    assert.equal(error.code, 'CONNECT_TIMEOUT');
    assert.match(error.message, /120ms/);
    assert.ok(elapsed < SETTLE_MS, `it rejects promptly (took ${elapsed}ms)`);
    assert.equal(errors.length, 1, 'onError is called once');
  }

  // ── connectTimeoutMs: 成功時にタイマーが残らない（Node を生かし続けない） ──────────
  {
    const { core } = makeCore();
    assert.equal(
      await beginWithin(core.begin('SENSOR_VALUES', { connectTimeoutMs: 30000 }), 'begin() with a large connectTimeoutMs'),
      'done begin(); SENSOR VALUES'
    );
    if (typeof process.getActiveResourcesInfo === 'function') {
      const timers = process.getActiveResourcesInfo().filter((r) => r === 'Timeout');
      assert.equal(timers.length, 0, 'the 30s connect timer was cleared (no leaked handle)');
    }
  }

  // ── disconnect() の code 付きエラー ─────────────────────────────────────────
  {
    const { core, errors } = makeCore();
    core.disconnect();
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, 'NO_DEVICE', 'disconnect() without a device reports NO_DEVICE');

    await beginWithin(core.begin('SENSOR_VALUES'), 'begin() before the already-disconnected check');
    core.disconnect();       // 1 回目: 実際に切断
    core.disconnect();       // 2 回目: すでに切断済み
    const last = errors[errors.length - 1];
    assert.equal(last.code, 'ALREADY_DISCONNECTED');
    assert.equal(last.message, 'Bluetooth Device is already disconnected', 'the legacy message is unchanged');
  }

  // ── ソース回帰: 文字列 reject / 同期 _beginAsSecondary が残っていない ─────────────
  {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'js/ORPHE-CORE.js'), 'utf8');
    assert.equal(src.includes("reject('User cancel.')"), false, "the bare-string reject('User cancel.') is gone");
    assert.match(src, /async _beginAsSecondary\(/, '_beginAsSecondary is async so it always settles');
  }

  console.log('core-begin-error-model.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
