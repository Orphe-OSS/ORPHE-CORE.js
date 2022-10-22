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

    buildCoreToolkit(document.querySelector('#toolkit_placeholder'),  
    `0${ble.id + 1}`,  
    ble.id, 'ANALYSIS_AND_RAW');

    ble.onConnectGATT = function (uuid) {
      console.log('> connected GATT!');
      document.getElementById(`uuid_name${this.id + 1}`).innerHTML = uuid;
      document.querySelector(`#startNotifications${this.id}`).classList = 'btn btn-danger';
      document.querySelector(`#button_name${this.id}`).innerHTML = "disconnect";
      document.querySelector(`#char${this.id}`).disabled = true;
  }

  ble.onScan = function (deviceName) {
      document.getElementById(`device_name${this.id}`).innerHTML = deviceName;
  }

  ble.gotQuat = function (quat) {
      document.querySelector(`#sq${this.id}_w`).innerHTML = `${quat.w.toFixed(3)}`;
      document.querySelector(`#sq${this.id}_x`).innerHTML = `${quat.x.toFixed(3)}`;
      document.querySelector(`#sq${this.id}_y`).innerHTML = `${quat.y.toFixed(3)}`;
      document.querySelector(`#sq${this.id}_z`).innerHTML = `${quat.z.toFixed(3)}`;
  }


  ble.gotEuler = function (euler) {
    document.querySelector(`#el${this.id}_x`).innerHTML = `${euler.pitch.toFixed(3)}`;
    document.querySelector(`#el${this.id}_y`).innerHTML = `${euler.roll.toFixed(3)}`;
    document.querySelector(`#el${this.id}_z`).innerHTML = `${euler.yaw.toFixed(3)}`;
  }

  ble.gotDelta = function (delta) {
      document.querySelector(`#sd${this.id}_x`).innerHTML = `${delta.x.toFixed(3)}`;
      document.querySelector(`#sd${this.id}_y`).innerHTML = `${delta.y.toFixed(3)}`;
      document.querySelector(`#sd${this.id}_z`).innerHTML = `${delta.z.toFixed(3)}`;
  }

  ble.gotGyro = function (gyro) {
      document.querySelector(`#svg${this.id}_x`).innerHTML = `${gyro.x.toFixed(3)}`;
      document.querySelector(`#svg${this.id}_y`).innerHTML = `${gyro.y.toFixed(3)}`;
      document.querySelector(`#svg${this.id}_z`).innerHTML = `${gyro.z.toFixed(3)}`;
  }

  ble.gotAcc = function (acc) {
      document.querySelector(`#sva${this.id}_x`).innerHTML = `${acc.x.toFixed(3)}`;
      document.querySelector(`#sva${this.id}_y`).innerHTML = `${acc.y.toFixed(3)}`;
      document.querySelector(`#sva${this.id}_z`).innerHTML = `${acc.z.toFixed(3)}`;
  }

  ble.gotGait = function (gait) {
      document.querySelector(`#gait${this.id}_w`).innerHTML = gait.type;
      document.querySelector(`#gait${this.id}_x`).innerHTML = gait.direction;
      document.querySelector(`#gait${this.id}_y`).innerHTML = gait.calorie.toFixed(3);
      document.querySelector(`#gait${this.id}_z`).innerHTML = gait.distance.toFixed(3);
  }
  ble.gotStride = function (stride) {

      document.querySelector(`#stride${this.id}_x`).innerHTML = stride.x.toFixed(3);
      document.querySelector(`#stride${this.id}_y`).innerHTML = stride.y.toFixed(3);
      document.querySelector(`#stride${this.id}_z`).innerHTML = stride.z.toFixed(3);
  }
  ble.gotFootAngle = function (foot_angle) {
      document.querySelector(`#stride${this.id}_w`).innerHTML = foot_angle.value.toFixed(3);
  }
  ble.gotPronation = function (pronation) {
      document.querySelector(`#pronation${this.id}_x`).innerHTML = pronation.x.toFixed(3);
      document.querySelector(`#pronation${this.id}_y`).innerHTML = pronation.y.toFixed(3);
      document.querySelector(`#pronation${this.id}_z`).innerHTML = pronation.z.toFixed(3);
  }
  ble.gotLandingImpact = function (landing_impact) {
      document.querySelector(`#pronation${this.id}_w`).innerHTML = landing_impact.value.toFixed(3);
  }

  ble.onStartNotify = function (uuid) {
      console.log('> Start Notify!');
      document.getElementById(`uuid_name${this.id}`).innerHTML = uuid;
  }

  ble.onStopNotify = function (uuid) {
      console.log('> Stop Notify!');
      //document.getElementById('uuid_name').innerHTML = uuid;
  }
}
}

//本当はキャンバスを表示したいのに出ない...
var mycanvas;
function setup() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16;
    //mycanvas = createCanvas(canvas_width, canvas_height, WEBGL);
    mycanvas = createCanvas(canvas_width, canvas_height);
    document.querySelector('#canvas_placeholder').appendChild(mycanvas.elt);
}

function draw() {
    background(200);
    let s = 'This is a creative canvas using p5.js. \nYou can create the various interactions using sensor data!'; ;
    fill(0);
    textSize(16);
    textFont('Roboto');
    text(s,32,32);
}

function windowResized() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16;
    resizeCanvas(canvas_width, canvas_height);
    console.log("hello")
}
