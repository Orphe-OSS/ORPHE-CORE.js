// ヘッダ 50（CORE 1.x / 3.0 の 200Hz SENSOR_VALUES, 92 byte）のクォータニオン正規化の回帰テスト
//
// 実機（CORE 3.0, 2026-09-05, 1827 packet）の生パケットでは |q| の中央値が 16383 で、quat は Q14（1.0 = 16384）。
// 旧実装は固定で /32768（Q15）していたため各成分が半分になり、toEuler() の yaw が真値の約 0.2 倍になっていた
// （90° 旋回が 15〜21° と出る）。CORE 1.x が Q14 か Q15 かは不明なので、修正は実ノルムで正規化する
// スケール非依存のもの。本テストは Q14 / Q15 どちらの入力でも単位クォータニオン・正しい yaw になることを固定する。
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

function near(actual, expected, label, tol = 1e-9) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected}, got ${actual}`
  );
}

// ヘッダ 50 パケット。frame i は offset 8 + 21*i: quat(8,10,12,14) gyro(16,18,20) acc(22,24,26) delta(28)
// 4 frame すべてに同じ raw quat [w,x,y,z]（int16）を載せる。
function makeHeader50Packet(rawQuat, serial = 100) {
  const dv = new DataView(new ArrayBuffer(92));
  dv.setUint8(0, 50);
  dv.setUint16(1, serial);
  dv.setUint8(3, 12); dv.setUint8(4, 34); dv.setUint8(5, 56); dv.setUint16(6, 789);
  for (let i = 0; i < 4; i++) {
    const o = 8 + 21 * i;
    rawQuat.forEach((v, k) => dv.setInt16(o + k * 2, v));
    if (i < 3) dv.setUint8(o + 20, 5);
  }
  return dv;
}

function makeCore() {
  const core = new Orphe(0);
  core.device_information = { range: { acc: 3, gyro: 3 } };
  const quats = [], eulers = [];
  core.gotQuat = v => quats.push(v);
  core.gotEuler = v => eulers.push(v);
  return { core, quats, eulers };
}

function feed(core, rawQuat, serial) {
  core.onRead(makeHeader50Packet(rawQuat, serial), 'SENSOR_VALUES');
}

const norm = q => Math.sqrt(q.w ** 2 + q.x ** 2 + q.y ** 2 + q.z ** 2);
const HALF_SQRT2 = Math.SQRT1_2; // cos45° = sin45°

// ── Q14 単位クォータニオン（yaw 90°: w = cos45°·16384, z = sin45°·16384） ──────────────
{
  const w = Math.round(HALF_SQRT2 * 16384); // 11585
  const { core, quats, eulers } = makeCore();
  feed(core, [w, 0, 0, w]);
  assert.equal(quats.length, 4, 'header50 dispatches 4 gotQuat');
  assert.equal(eulers.length, 4, 'header50 dispatches 4 gotEuler');
  quats.forEach((q, k) => {
    near(norm(q), 1, `Q14 yaw90 frame ${k}: |q| must be 1`, 1e-6);
    near(q.w, HALF_SQRT2, `Q14 yaw90 frame ${k}: w`, 1e-4);
    near(q.z, HALF_SQRT2, `Q14 yaw90 frame ${k}: z`, 1e-4);
    assert.equal(q.serial_number, 100, 'serial_number kept');
    assert.ok([0, 1, 2, 3].includes(q.packet_number), 'packet_number kept (0..3)');
    assert.ok(Number.isFinite(q.timestamp), 'timestamp kept');
  });
  assert.deepEqual(quats.map(q => q.packet_number), [0, 1, 2, 3], 'dispatch order is packet_number 0..3 (oldest first)');
  eulers.forEach((e, k) => {
    near(e.yaw, Math.PI / 2, `Q14 yaw90 frame ${k}: yaw ≈ π/2`, 0.01);
    near(e.pitch, 0, `Q14 yaw90 frame ${k}: pitch ≈ 0`, 0.01);
    near(e.roll, 0, `Q14 yaw90 frame ${k}: roll ≈ 0`, 0.01);
  });
  // 旧実装（/32768 固定）だと w = z = 0.35355 → yaw = atan2(0.25, 0.75) ≈ 0.3218 rad (18.4°) になる。退行ガード。
  const oldYaw = Math.atan2(2 * (w / 32768) * (w / 32768), 1 - 2 * (w / 32768) ** 2);
  near(oldYaw, 0.3217, 'sanity: old fixed-/32768 formula would have given ~18.4° (0.3217 rad)', 1e-3);
  assert.ok(eulers.every(e => e.yaw > 1.5), 'yaw must not regress to the 0.2× value');
}

// ── Q15 単位クォータニオン（同じ姿勢を ×32767 で送った場合）→ 同じ結果（スケール非依存） ──────
{
  const w = Math.round(HALF_SQRT2 * 32767); // 23170
  const { core, quats, eulers } = makeCore();
  feed(core, [w, 0, 0, w]);
  assert.equal(quats.length, 4);
  quats.forEach((q, k) => {
    near(norm(q), 1, `Q15 yaw90 frame ${k}: |q| must be 1`, 1e-6);
    near(q.w, HALF_SQRT2, `Q15 yaw90 frame ${k}: w`, 1e-4);
    near(q.z, HALF_SQRT2, `Q15 yaw90 frame ${k}: z`, 1e-4);
  });
  eulers.forEach((e, k) => near(e.yaw, Math.PI / 2, `Q15 yaw90 frame ${k}: yaw ≈ π/2`, 0.01));
}

// ── Q14 の単位元（w = 16384）→ 恒等姿勢、および非対称な姿勢でも |q| = 1 ────────────────
{
  const { core, quats, eulers } = makeCore();
  feed(core, [16384, 0, 0, 0]);
  quats.forEach(q => { near(norm(q), 1, 'Q14 identity |q|', 1e-9); near(q.w, 1, 'Q14 identity w'); });
  eulers.forEach(e => { near(e.yaw, 0, 'identity yaw'); near(e.pitch, 0, 'identity pitch'); near(e.roll, 0, 'identity roll'); });

  // 任意の（正規化されていない）int16 でも出力は単位クォータニオンで、向きは保存される
  const { core: c2, quats: q2 } = makeCore();
  feed(c2, [3000, -1200, 700, 2500]);
  const raw = [3000, -1200, 700, 2500];
  const rawNorm = Math.hypot(...raw);
  q2.forEach(q => {
    near(norm(q), 1, 'arbitrary raw → |q| = 1', 1e-9);
    near(q.w, raw[0] / rawNorm, 'arbitrary raw → direction preserved (w)', 1e-12);
    near(q.x, raw[1] / rawNorm, 'arbitrary raw → direction preserved (x)', 1e-12);
    near(q.y, raw[2] / rawNorm, 'arbitrary raw → direction preserved (y)', 1e-12);
    near(q.z, raw[3] / rawNorm, 'arbitrary raw → direction preserved (z)', 1e-12);
  });
}

// ── ゼロクォータニオン → NaN を出さない ─────────────────────────────────────────────
{
  // 初回パケットがゼロ: 直前の姿勢が無いので単位四元数にフォールバック
  const { core, quats, eulers } = makeCore();
  feed(core, [0, 0, 0, 0]);
  assert.equal(quats.length, 4, 'zero quat still dispatches 4 gotQuat');
  quats.forEach(q => {
    for (const k of ['w', 'x', 'y', 'z']) assert.ok(Number.isFinite(q[k]), `zero quat → ${k} must be finite`);
    near(norm(q), 1, 'zero quat (first packet) → identity, |q| = 1', 1e-9);
  });
  eulers.forEach(e => {
    for (const k of ['roll', 'pitch', 'yaw']) assert.ok(Number.isFinite(e[k]), `zero quat → euler.${k} must be finite`);
  });

  // 有効な姿勢の後にゼロが来た場合は直前の姿勢を維持する
  const w = Math.round(HALF_SQRT2 * 16384);
  feed(core, [w, 0, 0, w], 101);
  feed(core, [0, 0, 0, 0], 102);
  const last = quats.slice(-4);
  last.forEach(q => {
    near(norm(q), 1, 'zero quat after valid → |q| = 1', 1e-9);
    near(q.w, HALF_SQRT2, 'zero quat after valid → previous w kept', 1e-4);
    near(q.z, HALF_SQRT2, 'zero quat after valid → previous z kept', 1e-4);
    assert.equal(q.serial_number, 102, 'zero quat after valid → serial_number is the new packet');
  });
  eulers.slice(-4).forEach(e => near(e.yaw, Math.PI / 2, 'zero quat after valid → previous yaw kept', 0.01));
}

// ── ヘッダ 40（CORE 2.0）は従来どおり Q14 固定スケール + normalize（回帰していないこと） ──────
{
  const bytes = new Uint8Array(20);
  bytes[0] = 40;
  const w = Math.round(HALF_SQRT2 * 16384);
  bytes[1] = (w >> 8) & 0xff; bytes[2] = w & 0xff; // quat w (Q14)
  bytes[7] = (w >> 8) & 0xff; bytes[8] = w & 0xff; // quat z (Q14)
  const core = new Orphe(0);
  core.device_information = { range: { acc: 3, gyro: 3 } };
  let quat = null, euler = null;
  core.gotQuat = v => { quat = v; };
  core.gotEuler = v => { euler = v; };
  core.onRead(new DataView(bytes.buffer), 'SENSOR_VALUES');
  assert.ok(quat && euler, 'header40 dispatches quat/euler');
  near(norm(quat), 1, 'header40 Q14 |q| ≈ 1 (unchanged path)', 1e-4);
  near(euler.yaw, Math.PI / 2, 'header40 Q14 yaw90 → π/2 (unchanged path)', 0.01);
}

console.log('core-quat-normalize-header50.test.js passed');
