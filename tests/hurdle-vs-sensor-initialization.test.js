const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadOrphe } = require('./helpers/orphe-core-vm');

(async () => {
  for (const page of ['GAME-HURDLE-VS', 'GAME-HURDLE-2D-VS', 'GAME-HURDLE-VS-advance']) {
    const html = fs.readFileSync(path.join(__dirname, '../examples', page, 'index.html'), 'utf8');
    const bootStart = html.indexOf('var bles = [new Orphe(0), new Orphe(1)]');
    const start = html.indexOf('window.devices =', bootStart);
    const end = html.indexOf(page === 'GAME-HURDLE-2D-VS' ? '// Start game loop' : '// Sensor display update function', start);
    assert.ok(bootStart >= 0 && start > bootStart && end > start, `${page}: find actual sensor initialization`);
    let pickerCalls = 0;
    let rememberedCalls = 0;
    const { Orphe } = loadOrphe({ navigator: { bluetooth: {
      requestDevice: async () => ({ id: `${page}-${++pickerCalls}`, name: 'CR-3', addEventListener() {} }),
    } } });
    let now = 1000;
    const starts = [];
    const inputs = [[], []];
    const jumps = [0, 0];
    const players = [0, 1].map(id => ({
      setAccelPressed(value) { inputs[id].push(value); },
      jump() { jumps[id]++; },
    }));
    const toolkits = [];
    const window = {
      player1: players[0], player2: players[1],
      player1Thresholds: { accel: 0.3, pitch: 0.1 },
      player2Thresholds: { accel: 0.3, pitch: 0.1 },
    };
    const context = {
      Orphe, window, player1: players[0], player2: players[1],
      performance: { now: () => now }, console: { log() {} },
      document: { querySelector() { return {}; } }, guardCoreToolkitBluetooth() {},
      buildCoreToolkit(parent, title, id, notification, options) { toolkits.push({ id, notification, options }); },
    };
    vm.createContext(context);
    vm.runInContext(html.slice(bootStart, start), context);
    for (const core of context.bles) core.begin = type => { starts.push({ id: core.id, type }); return Promise.resolve(); };
    vm.runInContext(html.slice(start, end), context);

    // Either player's callbacks must already exist before any GATT event.
    for (let id = 0; id < 2; id++) {
      const acc = { x: 0, y: 0, z: 1 };
      context.bles[id].gotConvertedAcc(acc);
      assert.equal(window.devices[id].acc, acc, `${page}: slot ${id} receives input before its peer connects`);
      assert.equal(inputs[id].at(-1), true);
      context.bles[id].gotConvertedAcc({ x: 0, y: 0, z: 0 });
      assert.equal(inputs[id].at(-1), false);
      context.bles[id].gotEuler({ pitch: 0 });
      context.bles[id].gotEuler({ pitch: -0.2 });
      context.bles[id].gotEuler({ pitch: -0.2 });
      assert.equal(jumps[id], 1, `${page}: jump cooldown still prevents duplicate inputs`);
      now += 250;
      context.bles[id].gotEuler({ pitch: -0.2 });
      assert.equal(jumps[id], 2);
    }
    const original = context.bles.map(core => core.gotConvertedAcc);
    for (const core of context.bles) {
      for (const uuid of ['DEVICE_INFORMATION', 'DATE_TIME', 'STEP_ANALYSIS', 'SENSOR_VALUES']) core.onConnect(uuid);
      core.onDisconnect();
      core.onConnect('DEVICE_INFORMATION');
      assert.equal(core.gotConvertedAcc, original[core.id], `${page}: callbacks are initialized once`);
    }
    assert.equal(starts.length, 0, `${page}: per-characteristic events must never begin another connection`);

    assert.equal(toolkits.length, 2);
    for (const toolkit of toolkits) {
      const core = context.bles[toolkit.id];
      core._getLastBluetoothDeviceInfo = () => ({ bluetoothId: 'old-core-2', bluetoothName: 'CR-2' });
      core._requestRememberedBluetoothDevice = async () => {
        rememberedCalls++;
        return { id: 'old-core-2', name: 'CR-2', addEventListener() {} };
      };
      await core.scan('DEVICE_INFORMATION', toolkit.options);
      assert.equal(core.bluetoothDevice.name, 'CR-3', `${page}: each player selects its CORE`);
      const firstChoice = core.bluetoothDevice.id;
      await core.scan('DEVICE_INFORMATION', toolkit.options);
      assert.notEqual(core.bluetoothDevice.id, firstChoice, `${page}: a cached device can be replaced`);
    }
    assert.equal(pickerCalls, 4);
    assert.equal(rememberedCalls, 0);
  }
  console.log('hurdle-vs-sensor-initialization.test.js passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
