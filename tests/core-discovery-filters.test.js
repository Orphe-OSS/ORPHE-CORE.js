const assert = require('node:assert/strict');
const { loadOrphe } = require('./helpers/orphe-core-vm');

(async () => {
  let options;
  const device = { id: 'core-3', name: 'CR-3', addEventListener() {} };
  const { Orphe } = loadOrphe({ navigator: { bluetooth: {
    requestDevice: async value => { options = value; return device; },
  } } });
  const core = new Orphe(0);
  core.onScan = function() {};
  await core.requestDevice('SENSOR_VALUES');

  // Model the chooser's OR across filters / AND within each filter. A CR-3
  // without advertised service UUIDs must be discoverable before GATT connects.
  function matches(name, services) {
    return options.filters.some(filter =>
      (!filter.namePrefix || name.startsWith(filter.namePrefix)) &&
      (!filter.services || filter.services.every(uuid => services.includes(uuid)))
    );
  }
  assert.ok(matches('CR-3', []), 'CORE 3 advertising only its name is discoverable');
  assert.ok(matches('CR-2', []), 'the existing CR name family remains supported');
  assert.ok(matches('custom-core', [core.ORPHE_INFORMATION]), 'existing service filter remains');
  assert.ok(matches('custom-core', [core.ORPHE_OTHER_SERVICE]), 'sensor service alone is sufficient');
  assert.ok(!matches('unrelated-device', []), 'do not list every nearby Bluetooth device');
  assert.equal(options.acceptAllDevices, false);
  assert.deepEqual(Array.from(options.optionalServices), [core.ORPHE_INFORMATION, core.ORPHE_OTHER_SERVICE]);
  assert.equal(core.bluetoothDevice, device);

  // Broadening discovery must not bypass the existing two-slot duplicate guard.
  await assert.rejects(
    core.requestDevice('SENSOR_VALUES', { disallowBluetoothDeviceIds: [device.id] }),
    { name: 'DuplicateBluetoothDeviceError' }
  );
  console.log('core-discovery-filters.test.js passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
