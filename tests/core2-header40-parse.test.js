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
    createElement() {
      return {};
    },
    addEventListener() {},
  },
  setTimeout,
  clearTimeout,
  performance: {
    now() { return Date.now(); },
  },
};
context.window = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync(path.join(root, 'js/quaternion.js'), 'utf8'), context);
vm.runInContext(
  `${fs.readFileSync(path.join(root, 'js/ORPHE-CORE.js'), 'utf8')}\nthis.Orphe = Orphe;`,
  context
);

const Orphe = context.Orphe;
if (typeof Orphe !== 'function') {
  throw new Error('Orphe class was not exposed in the VM context.');
}

const core = new Orphe(0);
core.device_information = {
  range: { acc: 0, gyro: 0 },
};

let quat = null;
let euler = null;
core.gotQuat = value => {
  quat = value;
};
core.gotEuler = value => {
  euler = value;
};

const bytes = [
  0x28, 0xf8, 0x27, 0xff, 0xb9, 0xff, 0xc1, 0x3f,
  0x83, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff,
  0x08, 0x00, 0x00, 0x00,
];
const view = new DataView(Uint8Array.from(bytes).buffer);
core.onRead(view, 'SENSOR_VALUES');

if (!quat) throw new Error('gotQuat was not called.');
if (!euler) throw new Error('gotEuler was not called.');

const norm = Math.sqrt(quat.w ** 2 + quat.x ** 2 + quat.y ** 2 + quat.z ** 2);
if (Math.abs(norm - 1) > 0.01) {
  throw new Error(`Expected CORE 2.0 header 40 quaternion norm near 1.0, got ${norm}`);
}

for (const key of ['pitch', 'roll', 'yaw']) {
  if (!Number.isFinite(euler[key])) {
    throw new Error(`Expected finite euler.${key}, got ${euler[key]}`);
  }
}

console.log('CORE 2.0 header 40 SENSOR_VALUES parse ok:', { norm, quat, euler });
