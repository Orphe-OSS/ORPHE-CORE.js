let my_model;
let is_connected = false;

//--------------------------------------------------
//Global変数
//--------------------------------------------------
const ble = new Orphe();
const ble2 = new Orphe();

//--------------------------------------------------
//ロード時の処理
//--------------------------------------------------
window.onload = function () {
    //UUIDの設定
    //ble.setUUID("STEP_ANALYSIS", Orphe.ORPHE_OTHER_SERVICE, Orphe.ORPHE_STEP_ANALYSIS);
    ble.setUUID('DEVICE_INFORMATION', Orphe.ORPHE_INFORMATION, Orphe.ORPHE_DEVICE_INFORMATION);
    ble2.setUUID('DEVICE_INFORMATION', Orphe.ORPHE_INFORMATION, Orphe.ORPHE_DEVICE_INFORMATION);
}


//--------------------------------------------------
//Scan後の処理
//--------------------------------------------------
ble.onScan = function (deviceName) {
    document.getElementById('device_name0').innerHTML = deviceName;

}
ble2.onScan = function (deviceName) {
    document.getElementById('device_name1').innerHTML = deviceName;
}

//--------------------------------------------------
//ConnectGATT後の処理
//--------------------------------------------------
ble.onConnectGATT = function (uuid) {
    console.log('> connected GATT!');

}



//--------------------------------------------------
//Read後の処理：得られたデータの表示など行う
//--------------------------------------------------
let buffer = new ArrayBuffer(20);
var array_device_information = new DataView(buffer);
let buffer2 = new ArrayBuffer(20);
var array_device_information2 = new DataView(buffer2);

ble.onRead = function (data, uuid) {
    /*
    read pay load
    0: バッテリー残量
    1: 左右
    2: 記録モード
    3: 自動ラン記録
    4: LEDの明るさ
    5: モーターの強さ
    6: ログの単位時間(上位)
    7: ログの単位時間(下位)
    8: 加速度レンジ
    9: ジャイロレンジ
    --------------
    write pay load
    0: ヘッダー1
    1: 左右
    2: LEDの明るさ
    3: モーターの強さ
    4: 自動ラン記録On,Off
    5: ログの単位時間(上位)
    6: ログの単位時間(下位)
    7: 加速度レンジ
    8: ジャイロレンジ
    9-19: 0
    */
    array_device_information.setUint8(0, 1);
    array_device_information.setUint8(1, data.getUint8(1));
    array_device_information.setUint8(2, data.getUint8(4));
    array_device_information.setUint8(3, data.getUint8(5));
    array_device_information.setUint8(4, data.getUint8(3));
    array_device_information.setUint8(5, data.getUint8(6));
    array_device_information.setUint8(6, data.getUint8(7));
    array_device_information.setUint8(7, data.getUint8(8));
    array_device_information.setUint8(8, data.getUint8(9));
    for (let i = 9; i <= 19; i++) {
        array_device_information.setUint8(i, 0);
    }
    document.querySelector('#slider0').value = array_device_information.getUint8(2);

    const senddata = new Uint8Array([0x02, 1, 0]);
    ble.write('DEVICE_INFORMATION', senddata);
}


ble2.onRead = function (data, uuid) {
    array_device_information2.setUint8(0, 1);
    array_device_information2.setUint8(1, data.getUint8(1));
    array_device_information2.setUint8(2, data.getUint8(4));
    array_device_information2.setUint8(3, data.getUint8(5));
    array_device_information2.setUint8(4, data.getUint8(3));
    array_device_information2.setUint8(5, data.getUint8(6));
    array_device_information2.setUint8(6, data.getUint8(7));
    array_device_information2.setUint8(7, data.getUint8(8));
    array_device_information2.setUint8(8, data.getUint8(9));
    for (let i = 9; i <= 19; i++) {
        array_device_information2.setUint8(i, 0);
    }
    document.querySelector('#slider1').value = array_device_information2.getUint8(2);

    const senddata = new Uint8Array([0x02, 1, 0]);
    ble2.write('DEVICE_INFORMATION', senddata);
}
//Start Notify後の処理
//--------------------------------------------------
ble.onStartNotify = function (uuid) {
    console.log('> Start Notify!');
}

//--------------------------------------------------
//Stop Notify後の処理
//--------------------------------------------------
ble.onStopNotify = function (uuid) {
    console.log('> Stop Notify!');
}

function sendLEDMessage(dom) {
    const json = JSON.parse(dom.value);
    const value = json.value;
    const id = json.id;

    let data;

    if (value >= 0) {
        data = new Uint8Array([0x02, 1, value]);
    }
    else {
        data = new Uint8Array([0x02, 0, value]);
    }

    if (id == 0) {
        ble.write('DEVICE_INFORMATION', data);

    }
    else if (id == 1) ble2.write('DEVICE_INFORMATION', data);
}

function setLEDBrightness(dom) {
    //ble.read('DEVICE_INFORMATION');
    const json = JSON.parse(dom.value);
    const value = json.value;
    const id = json.id;
}

function toggleConnect(dom) {
    console.log("toggleConnect(): ", dom.value);
    // ble
    if (dom.value == 0) {
        if (dom.checked) {
            // 初めてつなぐ時はデバイス情報読み込みでつなげる
            ble.read('DEVICE_INFORMATION');
            //document.querySelector('#slider0').disabled = false;
            document.querySelector(`#btnradio1`).checked = true;
            for (let i = 0; i < 6; i++) {
                document.querySelector(`#btnradio${i}`).disabled = false;
            }
        }
        else {
            // 解除
            ble.disconnect();
            document.querySelector('#slider0').disabled = true;
            for (let i = 0; i < 6; i++) {
                document.querySelector(`#btnradio${i}`).disabled = true;
            }
        }
    }
    // ble2
    else if (dom.value == 1) {

        if (dom.checked) {
            // 初めてつなぐ時はデバイス情報読み込みでつなげる
            ble2.read('DEVICE_INFORMATION');
            // document.querySelector('#slider0').disabled = false;
            document.querySelector(`#btnradio7`).checked = true;
            for (let i = 6; i <= 11; i++) {
                document.querySelector(`#btnradio${i}`).disabled = false;
            }
        }
        else {
            // 解除
            ble2.disconnect();
            document.querySelector('#slider1').disabled = true;
            for (let i = 6; i <= 11; i++) {
                document.querySelector(`#btnradio${i}`).disabled = true;
            }
        }
    }
}

document.querySelector('#slider0').addEventListener('change', function () {
    array_device_information.setUint8(2, parseInt(this.value));
    ble.write('DEVICE_INFORMATION', array_device_information);
    console.log(array_device_information);
});

document.querySelector('#slider1').addEventListener('change', function () {
    array_device_information2.setUint8(2, parseInt(this.value));
    ble2.write('DEVICE_INFORMATION', array_device_information2);
    console.log(array_device_information2);
});