// gyro 物理単位換算（gotConvertedGyro / converted_gyro）の回帰テスト
//
// 仕様: gyro の raw は LSM6DSOX の int16。物理値 [deg/s] はレンジ別の代表感度
//   ±250 dps → 8.75 mdps/LSB / ±500 → 17.5 / ±1000 → 35 / ±2000 → 70
// を掛けて得る（ORPHE-INSOLE.js v1.3.2 と同じ換算）。
// 正規化コールバック（gotGyro = raw/32768）と加速度の換算（raw/32768*range）は変更しない。
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
const { Orphe, orpheCoreGyroRawToDps } = context;
assert.equal(typeof Orphe, 'function', 'Orphe class must be exposed');
assert.equal(typeof orpheCoreGyroRawToDps, 'function', 'orpheCoreGyroRawToDps helper must exist');

// [range index, full scale dps, dps per LSB]
const GYRO_SENSITIVITY = [
  [0, 250, 0.00875],
  [1, 500, 0.0175],
  [2, 1000, 0.035],
  [3, 2000, 0.07],
];

function near(actual, expected, label, tol = 1e-9) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected}, got ${actual}`
  );
}

// ── ヘルパー単体 ─────────────────────────────────────────────────────────
{
  near(orpheCoreGyroRawToDps(32767, 2000), 2293.69, 'helper 2000dps raw=32767');
  near(orpheCoreGyroRawToDps(16384, 250), 143.36, 'helper 250dps raw=16384');
  near(orpheCoreGyroRawToDps(0, 2000), 0, 'helper raw=0');
  assert.ok(orpheCoreGyroRawToDps(-1000, 1000) < 0, 'helper negative raw stays negative');
  for (const [, range, dpsPerLsb] of GYRO_SENSITIVITY) {
    near(orpheCoreGyroRawToDps(1, range), dpsPerLsb, `helper sensitivity ${range}dps`);
  }
}

// ── SENSOR_VALUES ヘッダ50（CORE 1.x, 92 byte, int16 × 4 frame） ──────────
// frame i は offset 8 + 21*i: quat(8,10,12,14) gyro(16,18,20) acc(22,24,26) dt(28)
function makeHeader50Packet(frames, serial = 1234) {
  const dv = new DataView(new ArrayBuffer(92));
  dv.setUint8(0, 50);
  dv.setUint16(1, serial);
  dv.setUint8(3, 12); dv.setUint8(4, 34); dv.setUint8(5, 56); dv.setUint16(6, 789);
  frames.forEach((f, i) => {
    const o = 8 + 21 * i;
    dv.setInt16(o, 32767); // quat w ≈ 1.0 (Q15)
    f.gyro.forEach((v, k) => dv.setInt16(o + 8 + k * 2, v));
    f.acc.forEach((v, k) => dv.setInt16(o + 14 + k * 2, v));
    if (i < 3) dv.setUint8(o + 20, 5);
  });
  return dv;
}

function runHeader50(rangeGyro, rangeAcc, frames) {
  const core = new Orphe(0);
  core.device_information = { range: { acc: rangeAcc, gyro: rangeGyro } };
  const gyro = [], convertedGyro = [], acc = [], convertedAcc = [];
  core.gotGyro = v => gyro.push(v);
  core.gotConvertedGyro = v => convertedGyro.push(v);
  core.gotAcc = v => acc.push(v);
  core.gotConvertedAcc = v => convertedAcc.push(v);
  core.onRead(makeHeader50Packet(frames), 'SENSOR_VALUES');
  assert.equal(convertedGyro.length, 4, 'header50 dispatches 4 frames');
  return { gyro, convertedGyro, acc, convertedAcc };
}

// 4 frame の x にそれぞれ 32767 / 16384 / 0 / -32768、y=1、z=-1 を載せる。
const RAWS = [32767, 16384, 0, -32768];
const FRAMES = RAWS.map(raw => ({ gyro: [raw, 1, -1], acc: [16384, 0, 0] }));

for (const [rangeIndex, range, dpsPerLsb] of GYRO_SENSITIVITY) {
  const r = runHeader50(rangeIndex, 3, FRAMES);
  for (const cg of r.convertedGyro) {
    const raw = RAWS[3 - cg.packet_number]; // frame i=3 が packet_number 0
    near(cg.x, raw * dpsPerLsb, `header50 ${range}dps converted x raw=${raw}`, 1e-6);
    near(cg.y, 1 * dpsPerLsb, `header50 ${range}dps converted y raw=1`);
    near(cg.z, -1 * dpsPerLsb, `header50 ${range}dps converted z raw=-1`);
  }
  for (const g of r.gyro) {
    const raw = RAWS[3 - g.packet_number];
    near(g.x, raw / 32768, `header50 ${range}dps normalized gotGyro unchanged raw=${raw}`);
  }
}

// 代表値の固定: ±2000 dps, raw 32767 → 2293.69 / ±250 dps, raw 16384 → 143.36
// frame index i（FRAMES[i]）は packet_number 3 - i で届く。
const convertedForRaw = (result, raw) =>
  result.convertedGyro.find(v => v.packet_number === 3 - RAWS.indexOf(raw));
{
  const r2000 = runHeader50(3, 3, FRAMES);
  const full = convertedForRaw(r2000, 32767);
  near(full.x, 2293.69, 'header50 2000dps raw=32767 → 2293.69 deg/s', 1e-6);
  near(convertedForRaw(r2000, 0).x, 0, 'raw=0 → 0');
  near(convertedForRaw(r2000, -32768).x, -2293.76, 'raw=-32768 → -2293.76 deg/s (negative stays negative)', 1e-6);

  const r250 = runHeader50(0, 3, FRAMES);
  near(convertedForRaw(r250, 16384).x, 143.36, 'header50 250dps raw=16384 → 143.36 deg/s', 1e-6);

  // range を実値(2000)で与えても同じ（if 連鎖は 0..3 以外を素通しする）
  const rActual = runHeader50(2000, 16, FRAMES);
  near(convertedForRaw(rActual, 32767).x, 2293.69, 'range given as 2000 dps', 1e-6);

  // 旧実装（理想 Q15: raw/32768*2000）との比は 1.14688。退行したら気づけるようにする。
  const idealQ15 = (32767 / 32768) * 2000;
  near(full.x / idealQ15, 1.14688, 'ratio to previous ideal-Q15 conversion');
}

// ── acc は変更しない（raw/32768*range） ─────────────────────────────────
// 注: range index 0（±2G）は既存の if 連鎖（else if でない）が 0→2→8 と連鎖するため
// ±8G として換算される既知の別問題（本テストの対象外・別PRで扱う）。ここでは index 3 / 1 で固定する。
{
  const r16 = runHeader50(3, 3, FRAMES);
  for (const a of r16.convertedAcc) near(a.x, 8, 'acc raw=16384 @±16G → 8 G (unchanged)');
  const r4 = runHeader50(3, 1, FRAMES);
  for (const a of r4.convertedAcc) near(a.x, 2, 'acc raw=16384 @±4G → 2 G (unchanged)');
  for (const a of r16.acc) near(a.x, 0.5, 'normalized gotAcc unchanged (raw/32768)');
}

// ── SENSOR_VALUES ヘッダ40（CORE 2.0, 20 byte, int8 圧縮） ────────────────
// quat Q14 (1,3,5,7) gyro int8 (9,10,11) acc int8 (14,15,16)
// gyro の int8 は int16 の上位バイトなので ×256 で int16 相当に戻して感度を掛ける。
{
  const bytes = new Uint8Array(20);
  bytes[0] = 40;
  bytes[1] = 0x40; bytes[2] = 0x00; // quat w = 16384 / 16384 = 1.0
  bytes[9] = 127; bytes[10] = 0xff; bytes[11] = 0; // gyro int8: 127, -1, 0
  bytes[14] = 0; bytes[15] = 0; bytes[16] = 8;     // acc int8: 0, 0, 8 (≈1G @±16G)
  const core = new Orphe(0);
  core.device_information = { range: { acc: 3, gyro: 3 } };
  let gyro = null, converted = null;
  core.gotGyro = v => { gyro = v; };
  core.gotConvertedGyro = v => { converted = v; };
  core.onRead(new DataView(bytes.buffer), 'SENSOR_VALUES');
  assert.ok(gyro && converted, 'header40 dispatches gyro callbacks');
  near(gyro.x, 127 / 127, 'header40 normalized gotGyro unchanged (int8/127)');
  near(gyro.y, -1 / 127, 'header40 normalized y');
  near(converted.x, 127 * 256 * 0.07, 'header40 2000dps int8=127 → 2275.84 deg/s', 1e-9);
  near(converted.y, -1 * 256 * 0.07, 'header40 2000dps int8=-1 → -17.92 deg/s');
  near(converted.z, 0, 'header40 int8=0 → 0');
}

console.log('core-gyro-scale.test.js passed');
