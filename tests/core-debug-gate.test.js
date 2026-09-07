// debug フラグと _log() の回帰テスト。
//
// 既定の on*（onScan / onConnectGATT / onConnect / onWrite / onStartNotify / onStopNotify /
// onDisconnect / onClear / onReset）と進行ログ（Device Information set 等）は debug=true の
// ときだけ出力する。onError は上書きしない学生にも見えるように無条件で console.error に出す。

const assert = require('node:assert/strict');
const { loadOrphe } = require('./helpers/orphe-core-vm');

function makeConsole() {
  const out = { log: [], info: [], warn: [], error: [] };
  return {
    out,
    console: {
      log: (...a) => out.log.push(a),
      info: (...a) => out.info.push(a),
      warn: (...a) => out.warn.push(a),
      error: (...a) => out.error.push(a),
    },
  };
}

const DEFAULT_CALLBACKS = [
  ['onScan', ['CR-3']],
  ['onConnectGATT', ['SENSOR_VALUES']],
  ['onConnect', ['SENSOR_VALUES']],
  ['onWrite', ['DEVICE_INFORMATION']],
  ['onStartNotify', ['SENSOR_VALUES']],
  ['onStopNotify', ['SENSOR_VALUES']],
  ['onDisconnect', []],
  ['onClear', []],
  ['onReset', []],
];

// ── debug=false（既定）: 既定コールバックも _log も何も出さない ──────────────────────
{
  const { out, console: fakeConsole } = makeConsole();
  const { Orphe } = loadOrphe({ console: fakeConsole });
  const core = new Orphe(0);
  assert.equal(core.debug, false, 'debug defaults to false');
  assert.equal(typeof core._log, 'function', '_log exists');

  for (const [name, args] of DEFAULT_CALLBACKS) {
    assert.equal(typeof core[name], 'function', `${name} exists`);
    core[name](...args);
  }
  core._log('Device Information set:', { lr: 0 });
  assert.deepEqual(out.log, [], 'debug=false: default on* print nothing');
  assert.deepEqual(out.info, [], 'debug=false: _log prints nothing');
  assert.deepEqual(out.warn, []);
  assert.deepEqual(out.error, []);
}

// ── debug=true: 既定の onConnect 等が console.log に出る、_log は console.info に出る ──────
{
  const { out, console: fakeConsole } = makeConsole();
  const { Orphe } = loadOrphe({ console: fakeConsole });
  const core = new Orphe(0);
  core.debug = true;

  core.onConnect('SENSOR_VALUES');
  assert.equal(out.log.length, 1, 'debug=true: default onConnect prints once');
  assert.equal(out.log[0][0], 'onConnect');

  for (const [name, args] of DEFAULT_CALLBACKS) core[name](...args);
  assert.equal(out.log.length, 1 + DEFAULT_CALLBACKS.length, 'debug=true: every default on* prints');

  core._log('Device Information set:', { lr: 0 });
  assert.equal(out.info.length, 1, 'debug=true: _log prints via console.info');
  assert.ok(out.info[0].includes('Device Information set:'), '_log forwards its arguments');
  assert.equal(out.info[0][0], '[ORPHE-CORE]', '_log prefixes with [ORPHE-CORE]');
}

// ── onError は debug に関係なく console.error に出る ──────────────────────────────
{
  const { out, console: fakeConsole } = makeConsole();
  const { Orphe } = loadOrphe({ console: fakeConsole });
  const core = new Orphe(0);
  const err = new Error('boom');
  core.onError(err);
  assert.equal(out.error.length, 1, 'default onError prints unconditionally');
  assert.equal(out.error[0][0], 'onError: ');
  assert.equal(out.error[0][1], err);
  assert.deepEqual(out.log, [], 'onError does not use console.log');
}

// ── 個別上書きは従来どおり優先される（debug=false でもユーザの onConnect は呼ばれる） ─────
{
  const { out, console: fakeConsole } = makeConsole();
  const { Orphe } = loadOrphe({ console: fakeConsole });
  const core = new Orphe(0);
  let called = 0;
  core.onConnect = function () { called++; };
  core.onConnect('SENSOR_VALUES');
  assert.equal(called, 1);
  assert.deepEqual(out.log, []);
}

// ── ソース上に無条件の console.log / console.info が残っていない ─────────────────────
{
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'js/ORPHE-CORE.js'), 'utf8');
  const lines = src.split('\n');
  const unconditional = [];
  lines.forEach((line, i) => {
    if (!/console\.(log|info)\(/.test(line)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;          // コメント行
    if (/if \(this\.debug\)/.test(line)) return;            // 既定 on* のゲート
    if (/^\s*_log\(/.test(lines[i - 1] || '') || /_log\(\.\.\.args\)/.test(lines[i - 1] || '')) return; // _log 本体
    unconditional.push(`${i + 1}: ${line.trim()}`);
  });
  assert.deepEqual(unconditional, [], `unconditional console.log/info remain in js/ORPHE-CORE.js:\n${unconditional.join('\n')}`);
}

console.log('core-debug-gate.test.js passed');
