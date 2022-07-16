/**
ORPHE.js is javascript library for ORPHE CORE Module, which is inspired by BlueJelly.js
@author Tetsuaki BABA
@see https://orphe.io/
============================================================
*/

/**
 * Orphe Constructor
 * @param {number} _num specifies id of your ORPHE CORE Module
 */
var Orphe = function (_num) {
  this.bluetoothDevice = null;
  this.dataCharacteristic = null;
  this.hashUUID = {};
  this.hashUUID_lastConnected;
  this.id = _num;

  //callBack
  this.onScan = function (deviceName) { console.log("onScan"); };
  this.onConnectGATT = function (uuid) { console.log("onConnectGATT"); };
  // this.onRead = function (data, uuid) { console.log("onRead"); };
  this.onWrite = function (uuid) { console.log("onWrite"); };
  this.onStartNotify = function (uuid) { console.log("onStartNotify"); };
  this.onStopNotify = function (uuid) { console.log("onStopNotify"); };
  this.onDisconnect = function () { console.log("onDisconnect"); };
  this.onClear = function () { console.log("onClear"); };
  this.onReset = function () { console.log("onReset"); };
  this.onError = function (error) { console.log("onError"); };
}
/**
 * setup UUID with predefined name
 * @param {string} name 
 * @param {string} serviceUUID 
 * @param {string} characteristicUUID 
 */
Orphe.prototype.setUUID = function (name, serviceUUID, characteristicUUID) {
  console.log('Execute : setUUID');
  console.log(this.hashUUID);
  this.hashUUID[name] = { 'serviceUUID': serviceUUID, 'characteristicUUID': characteristicUUID };
}


Object.defineProperty(Orphe, 'ORPHE_INFORMATION', { value: "01a9d6b5-ff6e-444a-b266-0be75e85c064", writable: true });
Object.defineProperty(Orphe, 'ORPHE_DEVICE_INFORMATION', { value: "24354f22-1c46-430e-a4ab-a1eeabbcdfc0", writable: true });

Object.defineProperty(Orphe, 'ORPHE_OTHER_SERVICE', { value: "db1b7aca-cda5-4453-a49b-33a53d3f0833", writable: false });
Object.defineProperty(Orphe, 'ORPHE_SENSOR_VALUES', { value: "f3f9c7ce-46ee-4205-89ac-abe64e626c0f", writable: false });
Object.defineProperty(Orphe, 'ORPHE_REALTIME_ANALYSIS', { value: "adb7eb5a-ac8a-4f95-907b-45db4a71b45a", writable: false });
Object.defineProperty(Orphe, 'ORPHE_STEP_ANALYSIS', { value: "4eb776dc-cf99-4af7-b2d3-ad0f791a79dd", writable: false });

/**
 * setup UUID by predefined name, DEVICE_INFORMATION, SENSOR_VALUES, STEP_ANALYSIS
 * @param {string[]} names 
 */
Orphe.prototype.setup = function (names) {
  console.log(names);
  for (const name of names) {
    if (name == 'DEVICE_INFORMATION') {
      this.setUUID(name, Orphe.ORPHE_INFORMATION, Orphe.ORPHE_DEVICE_INFORMATION);
    }
    else if (name == 'SENSOR_VALUES') {
      this.setUUID(name, Orphe.ORPHE_OTHER_SERVICE, Orphe.ORPHE_SENSOR_VALUES);
    }
    else if (name == 'STEP_ANALYSIS') {
      this.setUUID(name, Orphe.ORPHE_OTHER_SERVICE, Orphe.ORPHE_STEP_ANALYSIS);
    }
  }
}

/**
 * 
 * @returns resolve()
 */
Orphe.prototype.begin = async function () {
  return new Promise(resolve => {
    this.read('DEVICE_INFORMATION').then(() => {
      resolve();
    });

  });
}
Orphe.prototype.stop = function () {
  this.reset();
}

Orphe.prototype.setLED = function (on_off, pattern) {
  const data = new Uint8Array([0x02, on_off, pattern]);
  this.write('DEVICE_INFORMATION', data);
}
Orphe.prototype.setLEDBrightness = function (value) {
  this.array_device_information.setUint8(2, value);
  this.write('DEVICE_INFORMATION', this.array_device_information);
}

//--------------------------------------------------
//scan
//--------------------------------------------------
Orphe.prototype.scan = function (uuid) {
  return (this.bluetoothDevice ? Promise.resolve() : this.requestDevice(uuid))
    .catch(error => {
      console.log('Error : ' + error);
      this.onError(error);
    });
}


//--------------------------------------------------
//requestDevice
//--------------------------------------------------
Orphe.prototype.requestDevice = function (uuid) {
  console.log('Execute : requestDevice');

  let options = {
    /*
    ORPHE core module name: CR-2, CR-3
    */
    filters: [
      //{ services: ['db1b7aca-cda5-4453-a49b-33a53d3f0833'] },
      //{ services: [0x1802, 0x1803] },
      //{ services: ['c48e6067-5295-48d3-8d5c-0395f61792b1'] },
      //{ name: 'CR-2' },
      { namePrefix: 'CR-' }
    ],
    //acceptAllDevices: true,
    optionalServices: [this.hashUUID[uuid].serviceUUID]
  }

  return navigator.bluetooth.requestDevice(options)
    .then(device => {
      this.bluetoothDevice = device;
      this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
      this.onScan(this.bluetoothDevice.name);
    });


  // ---- Orphe original code -----
  // return navigator.bluetooth.requestDevice({
  //   acceptAllDevices: true,
  //   optionalServices: [this.hashUUID[uuid].serviceUUID]
  // })
  //   .then(device => {
  //     this.bluetoothDevice = device;
  //     this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
  //     this.onScan(this.bluetoothDevice.name);
  //   });
}


//--------------------------------------------------
//connectGATT
//--------------------------------------------------
Orphe.prototype.connectGATT = function (uuid) {
  if (!this.bluetoothDevice) {
    var error = "No Bluetooth Device";
    console.log('Error : ' + error);
    this.onError(error);
    return;
  }
  if (this.bluetoothDevice.gatt.connected && this.dataCharacteristic) {
    if (this.hashUUID_lastConnected == uuid)
      return Promise.resolve();
  }
  this.hashUUID_lastConnected = uuid;

  console.log('Execute : connect');
  return this.bluetoothDevice.gatt.connect()
    .then(server => {
      console.log('Execute : getPrimaryService');
      return server.getPrimaryService(this.hashUUID[uuid].serviceUUID);
    })
    .then(service => {
      console.log('Execute : getCharacteristic');
      return service.getCharacteristic(this.hashUUID[uuid].characteristicUUID);
    })
    .then(characteristic => {
      this.dataCharacteristic = characteristic;
      this.dataCharacteristic.addEventListener('characteristicvaluechanged', this.dataChanged(this, uuid));
      this.onConnectGATT(uuid);
    })
    .catch(error => {
      console.log('Error : ' + error);
      this.onError(error);
    });
}


//--------------------------------------------------
//dataChanged
//--------------------------------------------------
Orphe.prototype.dataChanged = function (self, uuid) {
  return function (event) {
    self.onRead(event.target.value, uuid);
  }
}



//--------------------------------------------------
//read
//--------------------------------------------------
Orphe.prototype.read = function (uuid) {
  return (this.scan(uuid))
    .then(() => {
      return this.connectGATT(uuid);
    })
    .then(() => {
      console.log('Execute : readValue');
      return this.dataCharacteristic.readValue();
    })
    .catch(error => {
      console.log('Error : ' + error);
      this.onError(error);
    });
}


//--------------------------------------------------
//write
//--------------------------------------------------
Orphe.prototype.write = function (uuid, array_value) {
  return (this.scan(uuid))
    .then(() => {
      return this.connectGATT(uuid);
    })
    .then(() => {
      console.log('Execute : writeValue');
      data = Uint8Array.from(array_value);
      return this.dataCharacteristic.writeValue(data);
    })
    .then(() => {
      this.onWrite(uuid);
    })
    .catch(error => {
      console.log('Error : ' + error);
      this.onError(error);
    });
}


//--------------------------------------------------
//startNotify
//--------------------------------------------------
Orphe.prototype.startNotify = function (uuid) {
  return (this.scan(uuid))
    .then(() => {
      return this.connectGATT(uuid);
    })
    .then(() => {
      console.log('Execute : startNotifications');
      this.dataCharacteristic.startNotifications()
    })
    .then(() => {
      this.onStartNotify(uuid);
    })
    .catch(error => {
      console.log('Error : ' + error);
      this.onError(error);
    });
}


//--------------------------------------------------
//stopNotify
//--------------------------------------------------
Orphe.prototype.stopNotify = function (uuid) {
  return (this.scan(uuid))
    .then(() => {
      return this.connectGATT(uuid);
    })
    .then(() => {
      console.log('Execute : stopNotifications');
      this.dataCharacteristic.stopNotifications()
    })
    .then(() => {
      this.onStopNotify(uuid);
    })
    .catch(error => {
      console.log('Error : ' + error);
      this.onError(error);
    });
}
Orphe.prototype.isConnected = function () {
  if (!this.bluetoothDevice) {
    return false;
  }
  return this.bluetoothDevice.gatt.connected;
}

//--------------------------------------------------
//disconnect
//--------------------------------------------------
Orphe.prototype.disconnect = function () {
  if (!this.bluetoothDevice) {
    var error = "No Bluetooth Device";
    console.log('Error : ' + error);
    this.onError(error);
    return;
  }

  if (this.bluetoothDevice.gatt.connected) {
    console.log('Execute : disconnect');
    this.bluetoothDevice.gatt.disconnect();
  } else {
    var error = "Bluetooth Device is already disconnected";
    console.log('Error : ' + error);
    this.onError(error);
    return;
  }
}


//--------------------------------------------------
//clear
//--------------------------------------------------
Orphe.prototype.clear = function () {
  console.log('Excute : Clear Device and Characteristic');
  this.bluetoothDevice = null;
  this.dataCharacteristic = null;
  this.onClear();
}


//--------------------------------------------------
//reset(disconnect & clear)
//--------------------------------------------------
Orphe.prototype.reset = function () {
  console.log('Excute : reset');
  this.disconnect(); //disconnect() is not Promise Object
  this.clear();
  this.onReset();
}

// device information用の配列
Orphe.prototype.array_device_information = new DataView(new ArrayBuffer(20));
Orphe.prototype.device_information;

// Readコールバック
Orphe.prototype.onRead = function (data, uuid) {

  // デバイス情報Readの場合
  if (uuid == 'DEVICE_INFORMATION') {
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
    this.array_device_information.setUint8(0, 1);
    this.array_device_information.setUint8(1, data.getUint8(1));
    this.array_device_information.setUint8(2, data.getUint8(4));
    this.array_device_information.setUint8(3, data.getUint8(5));
    this.array_device_information.setUint8(4, data.getUint8(3));
    this.array_device_information.setUint8(5, data.getUint8(6));
    this.array_device_information.setUint8(6, data.getUint8(7));
    this.array_device_information.setUint8(7, data.getUint8(8));
    this.array_device_information.setUint8(8, data.getUint8(9));
    for (let i = 9; i <= 19; i++) {
      this.array_device_information.setUint8(i, 0);
    }
    this.device_information = {
      battery: data.getUint8(0),
      lr: data.getUint8(1),
      rec_mode: data.getUint8(2),
      rec_auto_run: data.getUint8(3),
      led_brightness: data.getUint8(4),
      range: {
        acc: data.getUint8(8),
        gyro: data.getUint8(9)
      }
    }
    // デバイスインフォメーションを取得したら確認の為LEDの発光パターンを1にしておく
    const senddata = new Uint8Array([0x02, 1, 0]);
    this.write('DEVICE_INFORMATION', senddata);
  }

}