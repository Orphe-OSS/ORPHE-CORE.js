const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual inline sensor handlers, without loading the 3D game or
// Bluetooth hardware. onConnect is a per-GATT-characteristic callback, so two
// calls for one physical CORE must never start another connection/chooser.
const html = fs.readFileSync(path.join(__dirname, '../examples/GAME-HURDLE/index.html'), 'utf8');
const start = html.indexOf('// Global variables for sensor data');
const end = html.indexOf('// Sensor value display update', start);
assert.ok(start >= 0 && end > start, 'find the game sensor initialization block');
let now = 1000;
const beginCalls = [];
const acceleration = [];
let jumps = 0;
const bles = [0, 1].map(id => ({
  id,
  begin(type) { beginCalls.push({ id, type }); return Promise.resolve(); },
  onConnect() {},
}));
const window = {
  accThresholdAccel: 0.3,
  pitchThresholdJump: 0.1,
  setAccelPressed(pressed) { acceleration.push(pressed); },
  gameJump() { jumps++; },
};
vm.runInNewContext(html.slice(start, end), {
  window, bles, performance: { now: () => now }, console,
  // Allows the old connection-counter implementation to run and demonstrate
  // the unwanted nested begin calls, rather than failing on a missing global.
  connectedDevices: 0,
});

for (const characteristic of ['DEVICE_INFORMATION', 'DATE_TIME', 'STEP_ANALYSIS', 'SENSOR_VALUES']) {
  bles[0].onConnect(characteristic);
}
assert.equal(beginCalls.length, 0, 'GATT callbacks must not start begin() or another device chooser');

// Input from either slot must work independently, even before the other CORE
// connects. The toolkit owns connection/notification startup.
const firstAcc = { x: 0, y: 0, z: 1 };
bles[0].gotConvertedAcc(firstAcc);
assert.equal(window.devices[0].acc, firstAcc);
assert.equal(acceleration.at(-1), true);
bles[0].gotConvertedAcc({ x: 0, y: 0, z: 0 });
assert.equal(acceleration.at(-1), false);
now += 200;
const secondAcc = { x: 0.5, y: 0, z: 0 };
bles[1].gotConvertedAcc(secondAcc);
assert.equal(window.devices[1].acc, secondAcc);
assert.equal(acceleration.at(-1), true);

bles[0].gotEuler({ pitch: 0 });
bles[0].gotEuler({ pitch: -0.2 });
assert.equal(jumps, 1, 'toe-up input still reaches the game');
now += 100;
bles[1].gotEuler({ pitch: 0 });
bles[1].gotEuler({ pitch: -0.2 });
assert.equal(jumps, 1, 'retain the shared two-foot jump cooldown');
now += 800;
const secondEuler = { pitch: -0.25 };
bles[1].gotEuler(secondEuler);
assert.equal(window.devices[1].eulers, secondEuler);
assert.equal(jumps, 2);

const originalCallback = bles[0].gotConvertedAcc;
bles[1].onConnect('DEVICE_INFORMATION');
bles[0].onConnect('SENSOR_VALUES');
assert.equal(beginCalls.length, 0, 'repeated/reconnect GATT events never start another begin');
assert.equal(bles[0].gotConvertedAcc, originalCallback, 'callbacks are initialized once');
console.log('hurdle-sensor-initialization.test.js passed');
