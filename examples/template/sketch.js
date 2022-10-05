window.onload = function () {
  // bles: defined in coreToolkit.js
  for (let ble of bles) {
    ble.setup();
    ble.onConnect = function (uuid) {
      console.log('onConnect:', uuid);
      document.querySelector(`#status${ble.id}`).innerText = 'ONLINE';
      document.querySelector(`#status${ble.id}`).classList = 'bg-primary text-white'
    }
    ble.onDisconnect = function () {
      document.querySelector(`#status${ble.id}`).innerText = 'OFFLINE';
      document.querySelector(`#status${ble.id}`).classList = 'bg-secondary text-white'
    }
    ble.gotAcc = function (acc) {
      document.querySelector(`#acc${ble.id}`).innerText = `${acc.x.toFixed(2)}`;
    }
    ble.gotQuat = function (quat) {
      document.querySelector(`#quat${ble.id}`).innerText = `${quat.w.toFixed(2)}`;
    }
    ble.gotStride = function (stride) {
      document.querySelector(`#stride${ble.id}`).innerText = `${stride.x.toFixed(2)}`;
    }

    buildCoreToolkit(document.querySelector('#toolkit_placeholder'),
      `0${ble.id + 1}`,
      ble.id);
  }
}
