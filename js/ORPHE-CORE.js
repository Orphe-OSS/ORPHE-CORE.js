/**
ORPHE.js is javascript library for ORPHE CORE Module, which is inspired by BlueJelly.js
@module Orphe
@author Tetsuaki BABA
@see https://orphe.io/
*/

/**
 * @class
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

Orphe.prototype.setUUID = function (name, serviceUUID, characteristicUUID) {
  console.log('Execute : setUUID');
  console.log(this.hashUUID);
  this.hashUUID[name] = { 'serviceUUID': serviceUUID, 'characteristicUUID': characteristicUUID };
}

/**
 * BLE Advertise
 */
Object.defineProperty(Orphe, 'ORPHE_INFORMATION', { value: "01a9d6b5-ff6e-444a-b266-0be75e85c064", writable: true });
Object.defineProperty(Orphe, 'ORPHE_DEVICE_INFORMATION', { value: "24354f22-1c46-430e-a4ab-a1eeabbcdfc0", writable: true });

Object.defineProperty(Orphe, 'ORPHE_OTHER_SERVICE', { value: "db1b7aca-cda5-4453-a49b-33a53d3f0833", writable: false });
Object.defineProperty(Orphe, 'ORPHE_SENSOR_VALUES', { value: "f3f9c7ce-46ee-4205-89ac-abe64e626c0f", writable: false });
Object.defineProperty(Orphe, 'ORPHE_REALTIME_ANALYSIS', { value: "adb7eb5a-ac8a-4f95-907b-45db4a71b45a", writable: false });
Object.defineProperty(Orphe, 'ORPHE_STEP_ANALYSIS', { value: "4eb776dc-cf99-4af7-b2d3-ad0f791a79dd", writable: false });

/**
 * setup UUID by predefined name, DEVICE_INFORMATION, SENSOR_VALUES, STEP_ANALYSIS
 * @param {string[]} names DEVICE_INFORMATION, SENSOR_VALUES, STEP_ANALYSIS
 */
Orphe.prototype.setup = function (names) {

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
 * begin BLE connection
 * 
 * @async
 * @return {Promise<string>} 
 */
Orphe.prototype.begin = async function (name = 'DEVICE_INFORMATION') {
  return new Promise(resolve => {
    if (name == 'DEVICE_INFORMATION') {
      this.read(name).then(() => {
        resolve("done begin() with DEVICE_INFORAMTION read()");
      });
    }
    else {
      this.startNotify(name).then(() => {
        resolve(`done begin() with ${name} startNotify()`);
      })
    }


  });
}



/**
 * stop and disconnect GATT connection
 */
Orphe.prototype.stop = function () {
  this.reset();
}

/**
 * set LED mode
 * @param {int} on_off 0: turning off the LED, 1: turning on the LED
 * @param {int} pattern 0-4
 */

Orphe.prototype.setLED = function (on_off, pattern) {
  const data = new Uint8Array([0x02, on_off, pattern]);
  this.write('DEVICE_INFORMATION', data);
}

/**
 * sets the LED Brightness
 * @param {uint8} value 0-255, 0:turning off the LED
 */
Orphe.prototype.setLEDBrightness = function (value) {
  this.array_device_information.setUint8(2, value);
  this.write('DEVICE_INFORMATION', this.array_device_information);
}

Orphe.prototype.scan = function (uuid) {
  return (this.bluetoothDevice ? Promise.resolve() : this.requestDevice(uuid))
    .catch(error => {
      console.log('Error : ' + error);
      this.onError(error);
    });
}


/**
 * Execute requestDevice()
 * @param {string} uuid 
 * 
 */

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
}


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



/**
 * Read BLE data
 * @param {string} uuid DEVICE_INFORMATION
 * 
 */
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


/**
 * write data to the BLE device
 * @param {string} uuid DEVICE_INFORMATION, SENSOR_VALUES, STEP_ANALYSIS
 * @param {dataView} array_value write bytes
 * 
 */
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


/**
 * Stop Notification
 * @param {string} uuid 
 * 
 */
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


/**
 * Stop Notification
 * @param {string} uuid 
 * 
 */
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


/**
 * reset(disconnect & clear)
 */
Orphe.prototype.reset = function () {
  console.log('Excute : reset');
  this.disconnect(); //disconnect() is not Promise Object
  this.clear();
  this.onReset();
}

// device information????????????

Orphe.prototype.array_device_information = new DataView(new ArrayBuffer(20));

/**
 * Associative array of device information
 * @param {uint8} battery
 *  this.device_information = {
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
 */
Orphe.prototype.device_information;

/**
 * associative array for gait data
 */
Orphe.prototype.gait = {
  type: 0,
  direction: 0,
  calorie: 0,
  distance: 0
};
Orphe.prototype.stride = {
  foot_angle: 0,
  x: 0,
  y: 0,
  z: 0
};
Orphe.prototype.pronation = {
  landing_impact: 0,
  x: 0,
  y: 0,
  z: 0
};

/**
* associative array for quotanion
*/
Orphe.prototype.quat = {
  w: 0.0, x: 0.0, y: 0.0, z: 0.0
};
Orphe.prototype.delta = {
  x: 0.0, y: 0.0, z: 0.0
};
Orphe.prototype.euler = {
  pitch: 0.0,
  roll: 0.0,
  yaw: 0.0
}

Orphe.prototype.gyro = {
  x: 0.0, y: 0.0, z: 0.0
};

Orphe.prototype.acc = {
  x: 0.0, y: 0.0, z: 0.0
};

// Read??????????????????
/**
 * Incoming byte callback function 
 * @param {dataView} data incoming bytes
 * @param {string} uuid 
 */
Orphe.prototype.onRead = function (data, uuid) {
  //  console.log(uuid, data.byteLength, data.getUint8(0));

  // ??????????????????Read?????????
  if (uuid == 'DEVICE_INFORMATION') {
    /*
    read pay load
                0: ?????????????????????
                1: ??????
                2: ???????????????
                3: ??????????????????
                4: LED????????????
                5: ?????????????????????
                6: ?????????????????????(??????)
                7: ?????????????????????(??????)
                8: ??????????????????
                9: ?????????????????????
                --------------
                write pay load
                0: ????????????1
                1: ??????
                2: LED????????????
                3: ?????????????????????
                4: ??????????????????On,Off
                5: ?????????????????????(??????)
                6: ?????????????????????(??????)
                7: ??????????????????
                8: ?????????????????????
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
    // ?????????????????????????????????????????????????????????????????????LED????????????????????????1???????????????
    const senddata = new Uint8Array([0x02, 1, 0]);
    this.write('DEVICE_INFORMATION', senddata);
  }
  else if (uuid == 'STEP_ANALYSIS') {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);

    const {
      Float16Array, isFloat16Array, isTypedArray,
      getFloat16, setFloat16,
      hfround,
    } = float16;


    // Gait Overview
    if (data.getUint8(1) == 0) {
      const steps = data.getUint16(2);
      let type = data.getUint8(4);
      type = type & 0b00000011;
      let direction = data.getUint8(4);
      direction = direction & 0b00011100;
      direction = direction >>> 2;
      const calorie = getFloat16(data, 6);
      const dist = data.getFloat32(8);
      this.gait.type = type;
      this.gait.direction = direction;
      this.gait.calorie = calorie;
      this.gait.distance = dist;
      this.gotGait(this.gait);
    }
    // Stride
    else if (data.getUint8(1) == 1) {
      this.stride.foot_angle = data.getFloat32(4);
      this.stride.x = data.getFloat32(8);
      this.stride.y = data.getFloat32(12);
      this.stride.z = data.getFloat32(16);
      this.gotStride(this.stride);
    }
    // Pronation
    else if (data.getUint8(1) == 2) {
      this.pronation.landing_impact = data.getFloat32(4);
      this.pronation.x = data.getFloat32(8);
      this.pronation.y = data.getFloat32(12);
      this.pronation.z = data.getFloat32(16);
      this.gotPronation(this.pronation);
    }
    // Stride Attitude -- Not implemented
    else if (data.getUint8(1) == 3) {

    }
    // Quat and delta
    else if (data.getUint8(1) == 4) {
      this.quat = {
        w: getFloat16(data, 6),
        x: getFloat16(data, 8),
        y: getFloat16(data, 10),
        z: getFloat16(data, 12)
      }
      this.delta = {
        x: getFloat16(data, 14),
        y: getFloat16(data, 16),
        z: getFloat16(data, 18)
      }

      let q = new Quaternion(this.quat.w, this.quat.x, this.quat.y, this.quat.z);
      this.euler = q.toEuler();

      this.gotQuat(this.quat);
      this.gotDelta(this.delta);
      this.gotEuler(this.euler);
    }
    // Sensor test
    else if (data.getUint8(1) == 5) {

    }
    // delta elapsed time test
    else if (data.getUint8(1) == 6) {

    }
  }
  else if (uuid == 'SENSOR_VALUES') {
    if (data.getUint8(0) == 50) {
      this.quat = {
        w: data.getInt16(8) / 16384,
        x: data.getInt16(10) / 16384,
        y: data.getInt16(12) / 16384,
        z: data.getInt16(14) / 16384
      }
      this.gyro = {
        x: data.getInt16(16) / 16384,
        y: data.getInt16(18) / 16384,
        z: data.getInt16(20) / 16384
      }
      this.acc = {
        x: data.getInt16(22) / 16384,
        y: data.getInt16(24) / 16384,
        z: data.getInt16(26) / 16384
      }

    }
    else if (data.getUint8(0) == 40) {

      this.quat = {
        w: data.getInt16(1) / 16384,
        x: data.getInt16(3) / 16384,
        y: data.getInt16(5) / 16384,
        z: data.getInt16(7) / 16384
      }
      this.gyro = {
        x: data.getInt8(9) / 127,
        y: data.getInt8(10) / 127,
        z: data.getInt8(11) / 127
      }
      this.acc = {
        x: data.getInt8(14) / 127,
        y: data.getInt8(15) / 127,
        z: data.getInt8(16) / 127
      }
    }
    this.gotQuat(this.quat);
    this.gotGyro(this.gyro);
    this.gotAcc(this.acc);

    let q = new Quaternion(this.quat.w, this.quat.x, this.quat.y, this.quat.z);
    this.euler = q.toEuler();
    this.gotEuler(this.euler);
  }

}

/**
 * 
 * @param {Object} quat {w, x,y,z}
 */
Orphe.prototype.gotQuat = function (quat) {
  //console.log('prototype.gotQuat');
}

/**
 * 
 * @param {Object} gyro {x,y,z}
 */
Orphe.prototype.gotGyro = function (gyro) {
  //console.log('prototype.gotGyro');
}

/**
 * 
 * @param {Object} acc {x,y,z}
 */
Orphe.prototype.gotAcc = function (acc) {
  //console.log('prototype.gotAcc');
}

/**
 * 
 * @param {Object} delta {x,y,z}
 */
Orphe.prototype.gotDelta = function (delta) {
  //console.log('prototype.gotDelta');
}

/**
 * 
 * @param {Object} euler {pitch, roll, yaw}
 */
Orphe.prototype.gotEuler = function (euler) {
  //console.log('prototype.gotEuler');
}

/**
 * 
 * @param {Object} gait {type, direction, calorie, distance}
 */
Orphe.prototype.gotGait = function (gait) {
  //console.log('prototype.gotGait');
}

/**
 * 
 * @param {Object} stride {foot_angle, x,y,z}
 */
Orphe.prototype.gotStride = function (stride) {
  //console.log('prototype.gotStride');
}

/**
 * 
 * @param {Object} pronation {landing_impact, x,y,z}
 */
Orphe.prototype.gotPronation = function (pronation) {
  //console.log('prototype.gotPronation');
}
