// Manual Web Bluetooth check. No gotData override: exercise the real parser,
// wrapping onRead only to count original notification headers/lengths.
const core3Checks = [0, 1].map(id => {
  const core = new Orphe(id);
  core.setup();
  const section = document.createElement('section');
  section.innerHTML = `<h2>Device ${id + 1}</h2>
    <button data-action="connect">Device ${id + 1}: 修正版で接続</button>
    <button data-action="disconnect">Device ${id + 1}: 切断</button>
    <p data-summary></p><pre data-firmware></pre><pre data-state></pre>`;
  document.getElementById('devices').append(section);
  const state = {
    status: '未接続', name: null, startedAt: null, elapsedSeconds: 0,
    packets: {}, samples: 0, eulerSamples: 0, gaps: 0,
    lastAcc: null, lastEuler: null, lastPacketAt: null, error: null,
  };
  let firmware = 'FW情報: 未取得';
  let stoppedAt = null;
  const render = () => {
    state.elapsedSeconds = state.startedAt ? Math.round(((stoppedAt || Date.now()) - state.startedAt) / 1000) : 0;
    section.querySelector('[data-summary]').textContent =
      `${state.status} / ${state.elapsedSeconds}s / ${Object.values(state.packets).reduce((a, b) => a + b, 0)} packets / ` +
      `${state.samples} acc samples / ${state.eulerSamples} Euler samples / ${state.gaps} serial discontinuities`;
    section.querySelector('[data-firmware]').textContent = firmware;
    section.querySelector('[data-state]').textContent = JSON.stringify(state, null, 2);
  };
  const originalRead = core.onRead;
  core.onRead = function(data, uuid) {
    if (uuid === 'SENSOR_VALUES') {
      const key = `header=${data.byteLength ? data.getUint8(0) : 'empty'}, bytes=${data.byteLength}`;
      state.packets[key] = (state.packets[key] || 0) + 1;
      state.lastPacketAt = new Date().toISOString();
    }
    return originalRead.call(this, data, uuid);
  };
  core.gotConvertedAcc = function(acc) {
    state.samples++;
    state.lastAcc = acc;
  };
  core.gotEuler = function(euler) { state.eulerSamples++; state.lastEuler = euler; };
  core.lostData = function() { state.gaps++; };
  core.onError = function(error) { state.error = String(error); render(); };
  core.onDisconnect = function() { stoppedAt = Date.now(); state.status = '切断'; render(); };
  section.querySelector('[data-action="connect"]').onclick = async () => {
    state.status = '候補選択中'; state.error = null; render();
    try {
      // Call the chooser directly in the button gesture; do not use remembered
      // devices or a shared-tab bridge when comparing discovery filters.
      await core.requestDevice('DEVICE_INFORMATION', {
        disallowBluetoothDeviceIds: core3Checks.filter(c => c.core !== core)
          .map(c => c.core.bluetoothDevice?.id).filter(Boolean),
      });
      state.name = core.bluetoothDevice.name;
      firmware = 'FW情報: 未取得';
      state.status = '接続中'; render();
      const info = await core.getDeviceInformation();
      state.deviceInformation = { battery: info.battery, lr: info.lr, range: info.range };
      // Read-only CORE firmware-name characteristic. Retain raw bytes alongside
      // the documented 23-byte name/version/date fields; older devices may lack it.
      try {
        const service = await core.bluetoothDevice.gatt.getPrimaryService(core.ORPHE_OTHER_SERVICE);
        const characteristic = await service.getCharacteristic('690ecd23-c460-4ce3-8b5c-c0de65eb02d2');
        const data = await characteristic.readValue();
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        const metadata = { hex: Array.from(bytes, v => v.toString(16).padStart(2, '0')).join(' ') };
        if (data.byteLength === 23) {
          metadata.identity = String.fromCharCode(...bytes.slice(0, 15));
          metadata.version = `${data.getUint8(15)}.${data.getUint16(16)}`;
          metadata.date = `${data.getUint16(18)}-${data.getUint8(20)}-${data.getUint8(21)}`;
          metadata.patch = data.getUint8(22);
        }
        firmware = JSON.stringify(metadata, null, 2);
      } catch (error) { firmware = `FW情報を読めません: ${error}`; }
      state.packets = {}; state.samples = 0; state.eulerSamples = 0; state.gaps = 0;
      stoppedAt = null;
      state.startedAt = Date.now();
      await core.startNotify('SENSOR_VALUES');
      state.status = '受信中';
    } catch (error) { state.status = 'エラー'; state.error = String(error); }
    render();
  };
  section.querySelector('[data-action="disconnect"]').onclick = () => core.reset();
  setInterval(render, 1000);
  render();
  return { core, state };
});

document.getElementById('legacy').onclick = async () => {
  const result = document.getElementById('legacy-result');
  try {
    const core = core3Checks[0].core;
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [core.ORPHE_INFORMATION] }],
      optionalServices: [core.ORPHE_INFORMATION, core.ORPHE_OTHER_SERVICE],
    });
    result.textContent = `旧条件: ${device.name} を選択（接続はしていません）`;
  } catch (error) { result.textContent = `旧条件: ${error.name}（候補の有無は窓で目視確認）`; }
};

document.getElementById('unfiltered').onclick = async () => {
  const result = document.getElementById('legacy-result');
  try {
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
    result.textContent = `全デバイス: ${device.name} を選択（接続はしていません）`;
  } catch (error) { result.textContent = `全デバイス: ${error.name}（候補の有無は窓で目視確認）`; }
};
