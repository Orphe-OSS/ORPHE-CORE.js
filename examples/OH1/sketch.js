var oh1 = new BlueJelly();

window.onload = function () {
  oh1.setUUID("UUID1", 0x180d, 0x2a37);
  document.getElementById('startOH1').addEventListener('click', function () {
    oh1.startNotify('UUID1');
  });
  oh1.onConnectGATT = function (uuid) {
    document.querySelector(`#status_oh1`).innerText = 'ONLINE';
    document.querySelector(`#status_oh1`).classList = 'bg-primary text-white'
  }
  oh1.onDisconnect = function (uuid) {
    document.querySelector(`#status_oh1`).innerText = 'OFFLINE';
    document.querySelector(`#status_oh1`).classList = 'bg-secondary text-white'
  }
  oh1.onRead = function (data, uuid) {
    //フォーマットに従って値を取得
    value = data.getInt16(0);//8bitの場合のフォーマット
    // DOMを更新　valueにはbpmが入っている
    document.querySelector('#bpm').innerHTML = value;
  }


  // bles: defined in coreToolkit.js
  for (let ble of bles) {
    // 最初からanalysisとsensor values両方のnotificationを登録する場合は以下のsetupに置き換える
    // ble.setup("ANALYSIS_AND_RAW");
    ble.setup();

    // 接続したときのコールバック
    ble.onConnect = function (uuid) {
      console.log('onConnect:', uuid);
      document.querySelector(`#status${ble.id}`).innerText = 'ONLINE';
      document.querySelector(`#status${ble.id}`).classList = 'bg-primary text-white'
    }
    // 切断されたときのコールバック
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

    buildCoreToolkit(document.querySelector(`#toolkit_placeholder0${ble.id}`),
      `CORE 0${ble.id + 1}`,
      ble.id);
  }
}
