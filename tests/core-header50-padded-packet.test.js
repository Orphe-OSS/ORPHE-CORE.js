const assert = require('node:assert/strict');
const { loadOrphe } = require('./helpers/orphe-core-vm');
const { Orphe } = loadOrphe({ console: { ...console, warn() {} } });

// Synthetic header-50 data, independent of any customer recording. CORE 3 FW
// retains the 92-byte layout/checksum and zero-pads its 104-byte notification.
function packet(length = 92, serial = 100) {
  const data = new DataView(new ArrayBuffer(length));
  data.setUint8(0, 50);
  if (length < 92) return data;
  data.setUint16(1, serial);
  data.setUint8(3, 12); data.setUint8(4, 34); data.setUint8(5, 56); data.setUint16(6, 500);
  for (let i = 0; i < 4; i++) {
    const offset = 8 + 21 * i;
    data.setInt16(offset, 11585); data.setInt16(offset + 6, 11585);
    data.setInt16(offset + 8, 1000 + i);
    data.setInt16(offset + 14, 2000 + i);
    if (i < 3) data.setUint8(offset + 20, 5 * (i + 1));
  }
  let checksum = 0;
  for (let i = 0; i < 91; i++) checksum = (checksum + data.getUint8(i)) & 255;
  data.setUint8(91, checksum);
  return data;
}

function receiver(raw = false) {
  const core = new Orphe(0);
  core.device_information = { range: { acc: 3, gyro: 3 } };
  const events = [];
  const gaps = [];
  if (raw) core.gotData = data => events.push(data);
  else for (const name of ['gotAcc', 'gotGyro', 'gotQuat', 'gotConvertedAcc', 'gotConvertedGyro', 'gotEuler']) {
    core[name] = value => events.push([name, value]);
  }
  core.lostData = (current, previous) => gaps.push([current, previous]);
  return { core, events, gaps };
}

const legacy = receiver(), padded = receiver();
legacy.core.onRead(packet(), 'SENSOR_VALUES');
padded.core.onRead(packet(104), 'SENSOR_VALUES');
assert.equal(padded.events.length, 24, 'four frames dispatch all six sensor callbacks');
assert.deepEqual(padded.events, legacy.events, '104-byte padding must not alter values, timing, or ordering');
assert.deepEqual(padded.events.filter(e => e[0] === 'gotAcc').map(e => e[1].packet_number), [0, 1, 2, 3]);

// Respect a DataView's byteOffset and byteLength, rather than its whole buffer.
const backing = new Uint8Array(120).fill(255);
backing.set(new Uint8Array(packet(104).buffer), 7);
const offsetReceiver = receiver();
offsetReceiver.core.onRead(new DataView(backing.buffer, 7, 104), 'SENSOR_VALUES');
assert.deepEqual(offsetReceiver.events, legacy.events);

for (const raw of [false, true]) {
  const { core, events, gaps } = receiver(raw);
  core.onRead(packet(104, 65535), 'SENSOR_VALUES');
  core.onRead(packet(92, 0), 'SENSOR_VALUES');
  assert.equal(gaps.length, 0, 'mixed formats preserve uint16 wraparound');
  const before = events.length;
  const malformed = [packet(1), packet(91), packet(93), packet(103), packet(105), packet(200)];
  const nonPadding = packet(104);
  nonPadding.setUint8(103, 1);
  malformed.push(nonPadding);
  for (const data of malformed) assert.doesNotThrow(() => core.onRead(data, 'SENSOR_VALUES'));
  assert.equal(events.length, before + (raw ? malformed.length : 0), 'raw callback keeps original packets; parsed callbacks reject unknown layouts');
  core.onRead(packet(104, 2), 'SENSOR_VALUES');
  assert.deepEqual(gaps, [[2, 0]], 'invalid packets must not advance the serial tracker');
}

console.log('core-header50-padded-packet.test.js passed');
