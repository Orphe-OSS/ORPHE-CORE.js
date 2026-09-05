// センサーレンジ index → 実値 の変換（gotConvertedAcc / gotConvertedGyro）の回帰テスト
//
// DEVICE_INFORMATION の range.acc / range.gyro は 0..3 の index（acc: ±2/4/8/16 G、gyro: ±250/500/1000/2000 dps）。
// 旧実装は `if (r == 0) r = 2; if (r == 1) r = 4; if (r == 2) r = 8; if (r == 3) r = 16;` と else の無い if 連鎖で
// 変換していたため、acc index 0 が 0 → 2 → 8 と連鎖して ±2G が ±8G として換算されていた（4 倍大きい）。
// gyro の連鎖（250/500/1000/2000）は偶然衝突しないが同じ脆い形。lookup table に置き換え、index 1..3 と gyro は不変、
// index 以外の値（実値 2000 など）は従来どおり素通しであることを固定する。
//
// js/ORPHE-CORE.js はトップレベルで document を参照するため require できない。
// tests/core2-header40-parse.test.js と同じく vm コンテキストで評価する。

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

const context = {
  console,
  window: {},
  navigator: {},
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
  `${fs.readFileSync(path.join(root, 'js/ORPHE-CORE.js'), 'utf8')}\nthis.Orphe = Orphe;`,
  context
);
const { Orphe, orpheCoreRangeIndexToValue } = context;
assert.equal(typeof Orphe, 'function', 'Orphe class must be exposed');
assert.equal(typeof orpheCoreRangeIndexToValue, 'function', 'orpheCoreRangeIndexToValue helper must exist');
// トップレベル const は global property にならないので同一コンテキストで評価して取り出す
// （vm realm の Array は prototype が異なり strict deepEqual に落ちるため Array.from でホスト配列にする）
const ACC_TABLE = Array.from(vm.runInContext('ORPHE_CORE_ACC_RANGE_G', context));
const GYRO_TABLE = Array.from(vm.runInContext('ORPHE_CORE_GYRO_RANGE_DPS', context));
assert.deepEqual(ACC_TABLE, [2, 4, 8, 16], 'ORPHE_CORE_ACC_RANGE_G');
assert.deepEqual(GYRO_TABLE, [250, 500, 1000, 2000], 'ORPHE_CORE_GYRO_RANGE_DPS');

function near(actual, expected, label, tol = 1e-9) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected}, got ${actual}`
  );
}

// ── ヘルパー単体 ─────────────────────────────────────────────────────────
{
  assert.deepEqual([0, 1, 2, 3].map(i => orpheCoreRangeIndexToValue(i, ACC_TABLE)), [2, 4, 8, 16], 'acc index 0..3');
  assert.deepEqual([0, 1, 2, 3].map(i => orpheCoreRangeIndexToValue(i, GYRO_TABLE)), [250, 500, 1000, 2000], 'gyro index 0..3');
  // index 以外は素通し（実値を直接渡す旧来の使い方・想定外の値）
  assert.equal(orpheCoreRangeIndexToValue(16, ACC_TABLE), 16, 'acc value 16 passes through');
  assert.equal(orpheCoreRangeIndexToValue(2000, GYRO_TABLE), 2000, 'gyro value 2000 passes through');
  assert.equal(orpheCoreRangeIndexToValue(4, ACC_TABLE), 4, 'acc 4 (out of index range) passes through');
  assert.equal(orpheCoreRangeIndexToValue(7, GYRO_TABLE), 7, 'unexpected index 7 passes through');
  assert.equal(orpheCoreRangeIndexToValue(-1, ACC_TABLE), -1, 'negative passes through');
  assert.equal(orpheCoreRangeIndexToValue(1.5, ACC_TABLE), 1.5, 'non-integer passes through');
}

// ── SENSOR_VALUES ヘッダ50（CORE 1.x, 92 byte, int16 × 4 frame） ──────────
// frame i は offset 8 + 21*i: quat(8,10,12,14) gyro(16,18,20) acc(22,24,26) dt(28)
function makeHeader50Packet(gyroRaw, accRaw, serial = 1234) {
  const dv = new DataView(new ArrayBuffer(92));
  dv.setUint8(0, 50);
  dv.setUint16(1, serial);
  dv.setUint8(3, 12); dv.setUint8(4, 34); dv.setUint8(5, 56); dv.setUint16(6, 789);
  for (let i = 0; i < 4; i++) {
    const o = 8 + 21 * i;
    dv.setInt16(o, 16384); // quat w ≈ 1.0 (Q14)
    gyroRaw.forEach((v, k) => dv.setInt16(o + 8 + k * 2, v));
    accRaw.forEach((v, k) => dv.setInt16(o + 14 + k * 2, v));
    if (i < 3) dv.setUint8(o + 20, 5);
  }
  return dv;
}

function runHeader50(accIndex, gyroIndex, gyroRaw, accRaw) {
  const core = new Orphe(0);
  core.device_information = { range: { acc: accIndex, gyro: gyroIndex } };
  const acc = [], cacc = [], gyro = [], cgyro = [];
  core.gotAcc = v => acc.push(v);
  core.gotConvertedAcc = v => cacc.push(v);
  core.gotGyro = v => gyro.push(v);
  core.gotConvertedGyro = v => cgyro.push(v);
  core.onRead(makeHeader50Packet(gyroRaw, accRaw), 'SENSOR_VALUES');
  assert.equal(cacc.length, 4, 'header50 dispatches 4 frames');
  return { acc, cacc, gyro, cgyro };
}

// raw acc z = 16384 = 0.5 フルスケール、raw gyro x = 16384
const GYRO_RAW = [16384, 0, 0];
const ACC_RAW = [0, 0, 16384];

{
  // 本題: acc index 0（±2G）→ 0.5 × 2 = 1.0 G（旧実装は 0.5 × 8 = 4.0 G）
  const r0 = runHeader50(0, 0, GYRO_RAW, ACC_RAW);
  for (const a of r0.cacc) near(a.z, 1.0, 'header50 acc index 0 (±2G) raw 16384 → 1.0 G (was 4.0 G)');
  for (const a of r0.acc) near(a.z, 0.5, 'normalized gotAcc unchanged (raw/32768)');
  // gyro index 0（±250 dps）→ 16384 × 250 × 0.000035 = 143.36 deg/s
  for (const g of r0.cgyro) near(g.x, 143.36, 'header50 gyro index 0 (±250 dps) raw 16384 → 143.36 deg/s', 1e-6);
  for (const g of r0.gyro) near(g.x, 0.5, 'normalized gotGyro unchanged (raw/32768)');

  // index 1..3 は従来どおり
  const expectAcc = [1.0, 2.0, 4.0, 8.0];
  const expectGyro = [143.36, 286.72, 573.44, 1146.88];
  for (let idx = 0; idx < 4; idx++) {
    const r = runHeader50(idx, idx, GYRO_RAW, ACC_RAW);
    for (const a of r.cacc) near(a.z, expectAcc[idx], `header50 acc index ${idx} raw 16384 → ${expectAcc[idx]} G`);
    for (const g of r.cgyro) near(g.x, expectGyro[idx], `header50 gyro index ${idx} raw 16384 → ${expectGyro[idx]} deg/s`, 1e-6);
  }
  // index 3 → 8.0 G は不変（旧実装と同じ）
  for (const a of runHeader50(3, 3, GYRO_RAW, ACC_RAW).cacc) near(a.z, 8.0, 'header50 acc index 3 (±16G) → 8.0 G unchanged');

  // 実値を直接渡した場合は素通し（旧実装互換）: acc 16 → ×16、gyro 2000 → ±2000 dps 感度
  const rv = runHeader50(16, 2000, GYRO_RAW, ACC_RAW);
  for (const a of rv.cacc) near(a.z, 8.0, 'acc range given as 16 → 8.0 G (pass-through)');
  for (const g of rv.cgyro) near(g.x, 1146.88, 'gyro range given as 2000 → 1146.88 deg/s (pass-through)', 1e-6);

  // 旧実装の acc index 0 → 8G との比は 4。退行したら気づけるようにする。
  near(4.0 / r0.cacc[0].z, 4, 'ratio old(±8G-as-±2G)/new is exactly 4');
}

// ── SENSOR_VALUES ヘッダ40（CORE 2.0, 20 byte, int8） ────────────────────────
// quat Q14 (1..8) gyro int8 (9,10,11) acc int8 (14,15,16)
function runHeader40(accIndex, gyroIndex, gyroInt8, accInt8) {
  const bytes = new Uint8Array(20);
  bytes[0] = 40;
  bytes[1] = 0x40; bytes[2] = 0x00; // quat w = 1.0 (Q14)
  gyroInt8.forEach((v, k) => { bytes[9 + k] = v & 0xff; });
  accInt8.forEach((v, k) => { bytes[14 + k] = v & 0xff; });
  const core = new Orphe(0);
  core.device_information = { range: { acc: accIndex, gyro: gyroIndex } };
  let acc = null, cacc = null, cgyro = null;
  core.gotAcc = v => { acc = v; };
  core.gotConvertedAcc = v => { cacc = v; };
  core.gotConvertedGyro = v => { cgyro = v; };
  core.onRead(new DataView(bytes.buffer), 'SENSOR_VALUES');
  assert.ok(acc && cacc && cgyro, 'header40 dispatches acc/converted callbacks');
  return { acc, cacc, cgyro };
}

{
  // acc int8 z = 64 → 64/127 = 0.50394 正規化。index 0（±2G）→ ×2 = 1.00787 G（旧実装は ×8 = 4.0315 G）
  const r0 = runHeader40(0, 0, [64, 0, 0], [0, 0, 64]);
  near(r0.acc.z, 64 / 127, 'header40 normalized gotAcc unchanged (int8/127)');
  near(r0.cacc.z, (64 / 127) * 2, 'header40 acc index 0 (±2G) int8 64 → 1.008 G (was 4.03 G)');
  // gyro index 0: int8 64 → ×256 = 16384 → 143.36 deg/s（ヘッダ50 と同じ物理レート）
  near(r0.cgyro.x, 143.36, 'header40 gyro index 0 (±250 dps) int8 64 → 143.36 deg/s', 1e-6);

  const expectAccScale = [2, 4, 8, 16];
  const expectGyro = [143.36, 286.72, 573.44, 1146.88];
  for (let idx = 0; idx < 4; idx++) {
    const r = runHeader40(idx, idx, [64, 0, 0], [0, 0, 64]);
    near(r.cacc.z, (64 / 127) * expectAccScale[idx], `header40 acc index ${idx} → ×${expectAccScale[idx]}`);
    near(r.cgyro.x, expectGyro[idx], `header40 gyro index ${idx} → ${expectGyro[idx]} deg/s`, 1e-6);
  }
  near(runHeader40(3, 3, [64, 0, 0], [0, 0, 64]).cacc.z, (64 / 127) * 16, 'header40 acc index 3 (±16G) unchanged');
}

console.log('core-acc-range-mapping.test.js passed');
