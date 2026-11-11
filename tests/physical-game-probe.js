// Opt-in browser probe for an already connected example. Load from DevTools:
// import('/tests/physical-game-probe.js')
// orpheGameProbe.snapshot() reports counts; stop() restores the callbacks.
// Reload the example before starting another run.
// No connection, device settings, firmware, storage or network writes.
const probeCores = globalThis.bles;
if (!Array.isArray(probeCores) || !probeCores.length) {
  throw new Error('Open an example with initialized bles before loading this probe.');
}
const probeStart = Date.now();
const probeRestores = [];
const probeStates = probeCores.map(core => {
  const state = { slot: core.id, packets: {}, acc: 0, gyro: 0, quat: 0, euler: 0, bad: 0, disconnects: 0, errors: 0 };
  const wrap = (name, inspect) => {
    const original = core[name];
    const wrapped = function(...args) {
      inspect(...args);
      return original.apply(this, args);
    };
    core[name] = wrapped;
    probeRestores.push(() => { if (core[name] === wrapped) core[name] = original; });
  };
  wrap('onRead', (data, uuid) => {
    if (uuid !== 'SENSOR_VALUES') return;
    const key = `${data.byteLength ? data.getUint8(0) : 'empty'}/${data.byteLength}`;
    state.packets[key] = (state.packets[key] || 0) + 1;
  });
  for (const [callback, key, axes] of [
    ['gotConvertedAcc', 'acc', ['x', 'y', 'z']],
    ['gotConvertedGyro', 'gyro', ['x', 'y', 'z']],
    ['gotQuat', 'quat', ['w', 'x', 'y', 'z']],
    ['gotEuler', 'euler', ['pitch', 'roll', 'yaw']],
  ]) {
    wrap(callback, value => {
      state[key]++;
      if (!axes.every(axis => Number.isFinite(value[axis]))) state.bad++;
    });
  }
  wrap('onDisconnect', () => { state.disconnects++; });
  wrap('onError', () => { state.errors++; });
  return state;
});
let probeStoppedAt = null;
globalThis.orpheGameProbe = {
  snapshot() {
    return {
      seconds: +(((probeStoppedAt || Date.now()) - probeStart) / 1000).toFixed(1),
      devices: probeStates.map((state, index) => ({
        ...state,
        name: probeCores[index].bluetoothDevice?.name || '',
        connected: probeCores[index].isConnected(),
        secondary: !!probeCores[index]._isBridgeSecondary,
      })),
    };
  },
  stop() {
    if (!probeStoppedAt) {
      probeStoppedAt = Date.now();
      probeRestores.forEach(restore => restore());
    }
    return this.snapshot();
  },
};
