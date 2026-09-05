// ヘッダ 50（CORE 1.x / 3.0 の 200Hz SENSOR_VALUES, 92 byte）のサンプル時刻の回帰テスト
//
// 実機（CORE 3.0, 2026-09-05, 1827 packet）の生パケット解析より:
//  - ブロックの時系列順は 3 → 2 → 1 → 0（ブロック 3 が最古、0 が最新）
//  - offset 28 / 49 / 70 の delta は 5 / 10 / 14 ms で一定、連続パケットの基準タイムスタンプは 19〜20 ms 進む
//    → delta_k は基準タイムスタンプ t_base からの経過（age）で、t_k = t_base − delta_k（k = 0,1,2）
//  - ブロック 3 に delta は無い（offset 91 は delta ではない）→ t_3 = t_base − delta_2 − (delta_1 − delta_0) = t_base − 19 ms
// 旧実装は t_base に delta を累積加算（0 / +14 / +24 / +29）していたため、パケット内 dt が 14/10/5 ms、
// 次パケット先頭が約 9 ms 戻る非単調な時刻列になっていた。
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
const { Orphe } = context;
assert.equal(typeof Orphe, 'function', 'Orphe class must be exposed');

// ヘッダ 50 パケット。frame i は offset 8 + 21*i: quat(8,10,12,14) gyro(16,18,20) acc(22,24,26) delta(28)
// base = { h, m, s, ms }、deltas = [delta0, delta1, delta2]（ブロック 0,1,2 の age [ms]）
function makeHeader50Packet(serial, base, deltas) {
  const dv = new DataView(new ArrayBuffer(92));
  dv.setUint8(0, 50);
  dv.setUint16(1, serial);
  dv.setUint8(3, base.h); dv.setUint8(4, base.m); dv.setUint8(5, base.s); dv.setUint16(6, base.ms);
  for (let i = 0; i < 4; i++) {
    const o = 8 + 21 * i;
    dv.setInt16(o, 16384); // quat w = 1.0 (Q14)
    dv.setInt16(o + 8, 100 * (i + 1)); // gyro x: ブロック識別用
    dv.setInt16(o + 14, 16384); // acc x
    if (i < 3) dv.setUint8(o + 20, deltas[i]);
  }
  return dv;
}

// SDK と同じ方法（今日の日付に h/m/s/ms を設定）で基準時刻を epoch ms にする
function baseEpochMs(base) {
  const d = new Date();
  d.setHours(base.h); d.setMinutes(base.m); d.setSeconds(base.s); d.setMilliseconds(base.ms);
  return d.getTime();
}

function runPackets(packets) {
  const core = new Orphe(0);
  core.device_information = { range: { acc: 3, gyro: 3 } };
  const gyro = [], quat = [], acc = [], cgyro = [], cacc = [];
  core.gotGyro = v => gyro.push(v);
  core.gotQuat = v => quat.push(v);
  core.gotAcc = v => acc.push(v);
  core.gotConvertedGyro = v => cgyro.push(v);
  core.gotConvertedAcc = v => cacc.push(v);
  for (const p of packets) core.onRead(p, 'SENSOR_VALUES');
  return { gyro, quat, acc, cgyro, cacc };
}

const diffs = arr => arr.slice(1).map((v, k) => v - arr[k]);

// ── 2 パケット: 基準 T と T+20 ms、delta 5 / 10 / 14（実機と同じ） ─────────────────────
{
  const baseA = { h: 12, m: 34, s: 56, ms: 789 };
  const baseB = { h: 12, m: 34, s: 56, ms: 809 }; // +20 ms
  const r = runPackets([
    makeHeader50Packet(1000, baseA, [5, 10, 14]),
    makeHeader50Packet(1001, baseB, [5, 10, 14]),
  ]);
  assert.equal(r.gyro.length, 8, 'two header50 packets dispatch 8 gotGyro');

  const ts = r.gyro.map(g => g.timestamp);
  const dt = diffs(ts);

  // 単調増加・負の dt なし
  assert.ok(dt.every(d => d > 0), `timestamps must be strictly increasing, dt = [${dt}]`);

  // パケット内（3 本 × 2）は 4〜5 ms、パケット間（1 本）は 5〜6 ms
  const intra = [dt[0], dt[1], dt[2], dt[4], dt[5], dt[6]];
  const cross = dt[3];
  assert.ok(intra.every(d => d >= 4 && d <= 5), `intra-packet dt must be 4..5 ms, got [${intra}]`);
  assert.ok(cross >= 5 && cross <= 6, `cross-packet dt must be 5..6 ms, got ${cross}`);

  // 絶対値: t_k = t_base − age_k、age = [5, 10, 14, 19]（ブロック 0..3）。dispatch はブロック 3 → 0
  const TA = baseEpochMs(baseA), TB = baseEpochMs(baseB);
  assert.deepEqual(ts, [TA - 19, TA - 14, TA - 10, TA - 5, TB - 19, TB - 14, TB - 10, TB - 5],
    'timestamps are t_base - [19, 14, 10, 5] per packet');

  // dispatch 順とブロック対応: packet_number 0 = 最古 = ブロック 3（gyro x = 400）… packet_number 3 = ブロック 0（gyro x = 100）
  assert.deepEqual(r.gyro.slice(0, 4).map(g => g.packet_number), [0, 1, 2, 3], 'packet_number 0..3 in dispatch order');
  assert.deepEqual(r.gyro.slice(0, 4).map(g => Math.round(g.x * 32768)), [400, 300, 200, 100],
    'block 3 (oldest) dispatched first, block 0 (newest) last');

  // 同じサンプルの quat / acc / converted_* は同じ timestamp を持つ
  for (let k = 0; k < 8; k++) {
    assert.equal(r.quat[k].timestamp, ts[k], `quat[${k}] timestamp matches gyro`);
    assert.equal(r.acc[k].timestamp, ts[k], `acc[${k}] timestamp matches gyro`);
    assert.equal(r.cgyro[k].timestamp, ts[k], `converted_gyro[${k}] timestamp matches gyro`);
    assert.equal(r.cacc[k].timestamp, ts[k], `converted_acc[${k}] timestamp matches gyro`);
    assert.equal(r.quat[k].packet_number, r.gyro[k].packet_number, 'packet_number consistent across objects');
    assert.equal(r.quat[k].serial_number, r.gyro[k].serial_number, 'serial_number consistent across objects');
  }

  // 旧実装（t_base に累積加算: 0 / +14 / +24 / +29）だと 2 パケット目の先頭が (TB) − (TA + 29) = −9 ms 戻る。
  // 参考値として固定しておく（退行すると上の "strictly increasing" が落ちる）。
  const oldCross = TB - (TA + 14 + 10 + 5);
  assert.equal(oldCross, -9, 'sanity: the old cumulative formula would have produced a -9 ms step');
}

// ── 秒境界をまたぐ基準時刻（.983 → 次パケット .003）でも epoch ms 演算で連続する ─────────
{
  const baseA = { h: 23, m: 59, s: 58, ms: 983 };
  const baseB = { h: 23, m: 59, s: 59, ms: 3 }; // +20 ms、秒をまたぐ
  const r = runPackets([
    makeHeader50Packet(2000, baseA, [5, 10, 14]),
    makeHeader50Packet(2001, baseB, [5, 10, 14]),
  ]);
  const dt = diffs(r.gyro.map(g => g.timestamp));
  assert.ok(dt.every(d => d > 0), `second-boundary: strictly increasing, dt = [${dt}]`);
  assert.deepEqual(dt, [5, 4, 5, 6, 5, 4, 5], 'second-boundary: dt sequence 5,4,5 | 6 | 5,4,5');
}

// ── 名目値（delta 5 / 10 / 15、基準 +20 ms）では完全等間隔 5 ms になる ───────────────────
{
  const baseA = { h: 1, m: 2, s: 3, ms: 100 };
  const baseB = { h: 1, m: 2, s: 3, ms: 120 };
  const r = runPackets([
    makeHeader50Packet(3000, baseA, [5, 10, 15]),
    makeHeader50Packet(3001, baseB, [5, 10, 15]),
  ]);
  const dt = diffs(r.gyro.map(g => g.timestamp));
  assert.deepEqual(dt, [5, 5, 5, 5, 5, 5, 5], 'nominal deltas give a uniform 5 ms grid (block 3 age = 15 + 10 - 5 = 20)');
}

console.log('core-header50-sample-timestamps.test.js passed');
