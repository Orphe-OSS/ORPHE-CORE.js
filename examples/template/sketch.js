window.onload = function () {
  for (let ble of bles) {
    ble.setup();
    ble.onConnect = function () {
      document.querySelector(`#status${ble.id}`).innerText = 'ONLINE';
      document.querySelector(`#status${ble.id}`).classList = 'bg-primary text-white'
    }
    ble.onDisconnect = function () {

      //      alert('Connection Closed. Try reconnect again.');
      document.querySelector(`#status${ble.id}`).innerText = 'OFFLINE';
      document.querySelector(`#status${ble.id}`).classList = 'bg-secondary text-white'
    }

    buildCoreToolkit(document.querySelector('#toolkit_placeholder'), `0${ble.id + 1}`, ble.id);
  }


}
