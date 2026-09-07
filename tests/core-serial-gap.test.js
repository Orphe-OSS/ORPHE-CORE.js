// SENSOR_VALUES（ヘッダ 50）のシリアル番号欠損検出（lostData）の回帰テスト。
//
// 旧実装は `this.serial_number - serial_number_prev != 1` で判定し、`if (this.serial_number)` で
// 「前回値あり」を判定していたため、
//   - uint16 の wraparound（65535 → 0）で毎回 lostData(0, 65535) が誤発火し、
//   - serial 0 は falsy なので直後の 0 → 1 でも状態が初期化扱いになり、
//   - 65535 → 0 → 1 → 2 のように wrap をまたぐ区間の本物の欠損が見えなくなる
// という問題があった。modular 距離 (cur - prev + 65536) % 65536 と明示的な「前回値あり」フラグで判定する。
// 通常経路（got* dispatch）と gotData 上書き経路（ORPHE TERMINAL）の両方、およびヘッダ 40 は
// serial を持たないので lostData が呼ばれないことを確認する。

const assert = require('node:assert/strict');
const { loadOrphe } = require('./helpers/orphe-core-vm');

const { Orphe, orpheCoreSerialDistance } = loadOrphe();

// ── モジュール関数 ────────────────────────────────────────────────────────────
assert.equal(typeof orpheCoreSerialDistance, 'function', 'orpheCoreSerialDistance is exposed at module scope');
assert.equal(orpheCoreSerialDistance(1, 0), 1);
assert.equal(orpheCoreSerialDistance(0, 65535), 1, '65535 -> 0 is a distance of 1 (wraparound)');
assert.equal(orpheCoreSerialDistance(7, 5), 2);
assert.equal(orpheCoreSerialDistance(2, 65534), 4, 'gap across the wrap boundary');
assert.equal(orpheCoreSerialDistance(5, 5), 0, 'duplicate serial');

// ── フィクスチャ ──────────────────────────────────────────────────────────────
function header50(serial) {
  const dv = new DataView(new ArrayBuffer(92));
  dv.setUint8(0, 50);
  dv.setUint16(1, serial);
  dv.setUint8(3, 12); dv.setUint8(4, 34); dv.setUint8(5, 56); dv.setUint16(6, 789);
  for (let i = 0; i < 4; i++) {
    const o = 8 + 21 * i;
    dv.setInt16(o, 16384); // quat w = 1.0 (Q14)
    dv.setInt16(o + 14, 16384); // acc x
    if (i < 3) dv.setUint8(o + 20, 5 * (i + 1));
  }
  return dv;
}

function header40() {
  const bytes = [
    0x28, 0xf8, 0x27, 0xff, 0xb9, 0xff, 0xc1, 0x3f,
    0x83, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff,
    0x08, 0x00, 0x00, 0x00,
  ];
  return new DataView(Uint8Array.from(bytes).buffer);
}

function makeCore({ overrideGotData = false } = {}) {
  const core = new Orphe(0);
  core.device_information = { range: { acc: 3, gyro: 3 } };
  const lost = [];
  core.lostData = function (cur, prev) { lost.push([cur, prev]); };
  if (overrideGotData) core.gotData = function () { };
  return { core, lost };
}

function feed(core, serials) {
  for (const s of serials) core.onRead(header50(s), 'SENSOR_VALUES');
}

for (const overrideGotData of [false, true]) {
  const label = overrideGotData ? 'gotData path' : 'dispatch path';

  // 最初のパケットは lostData を呼ばない（serial 0 で始まっても）
  {
    const { core, lost } = makeCore({ overrideGotData });
    feed(core, [0]);
    assert.deepEqual(lost, [], `${label}: first packet (serial 0) never reports`);
    assert.equal(core.serial_number, 0);
    feed(core, [1]);
    assert.deepEqual(lost, [], `${label}: 0 -> 1 is contiguous`);
  }
  {
    const { core, lost } = makeCore({ overrideGotData });
    feed(core, [12345]);
    assert.deepEqual(lost, [], `${label}: first packet (serial 12345) never reports`);
  }

  // uint16 wraparound: 65535 -> 0 は連続
  {
    const { core, lost } = makeCore({ overrideGotData });
    feed(core, [65534, 65535, 0, 1, 2]);
    assert.deepEqual(lost, [], `${label}: 65534 -> 65535 -> 0 -> 1 -> 2 has no gap`);
    assert.equal(core.serial_number, 2);
  }

  // 本物の欠損は 1 回だけ報告する
  {
    const { core, lost } = makeCore({ overrideGotData });
    feed(core, [5, 7]);
    assert.deepEqual(lost, [[7, 5]], `${label}: 5 -> 7 reports lostData(7, 5) once`);
    feed(core, [8, 9]);
    assert.deepEqual(lost, [[7, 5]], `${label}: contiguous packets after a gap do not report`);
  }

  // wrap 境界をまたぐ欠損も検出する（旧実装では見えなかった）
  {
    const { core, lost } = makeCore({ overrideGotData });
    feed(core, [65535, 2]);
    assert.deepEqual(lost, [[2, 65535]], `${label}: 65535 -> 2 is a gap across the wrap boundary`);
  }

  // 重複 serial（距離 0）も「1 でない」ので報告する（従来どおり）
  {
    const { core, lost } = makeCore({ overrideGotData });
    feed(core, [10, 10]);
    assert.deepEqual(lost, [[10, 10]], `${label}: duplicate serial is reported like before`);
  }

  // clear() 後は「前回値なし」に戻る（再接続後の最初のパケットで誤報しない）
  {
    const { core, lost } = makeCore({ overrideGotData });
    feed(core, [100, 101]);
    core.onClear = function () { };
    core.clear();
    feed(core, [5000]);
    assert.deepEqual(lost, [], `${label}: first packet after clear() does not report`);
    feed(core, [5001]);
    assert.deepEqual(lost, [], `${label}: contiguous after clear()`);
  }
}

// ── ヘッダ 40（CORE 2.0）は serial を持たないので lostData は呼ばれない ───────────────
{
  const { core, lost } = makeCore();
  core.onRead(header40(), 'SENSOR_VALUES');
  core.onRead(header40(), 'SENSOR_VALUES');
  assert.deepEqual(lost, [], 'header 40 packets never report lostData');
  assert.equal(core.serial_number, undefined, 'header 40 leaves serial_number untouched');
  // その後ヘッダ 50 が来ても最初のパケットは報告しない
  feed(core, [65535, 0]);
  assert.deepEqual(lost, [], 'header 50 after header 40: first packet initializes, 65535 -> 0 is contiguous');
}

console.log('core-serial-gap.test.js passed');
