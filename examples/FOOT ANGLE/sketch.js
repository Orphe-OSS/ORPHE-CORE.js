//Starting point of canvas_placeholder
var mycanvas;
let landCircles = []; // array of cirlcle objects
let accCircles = []; // array of accelerometerPoint objects
let foot_print_left;
let foot_print_right;

//for sound
let osc, envelope;
let scaleArray = [60, 62, 64, 65, 67, 69, 71, 72];
var foot_angles = [0, 0];

//ORPHE CORE BLE
var bles = [new Orphe(0), new Orphe(1)];

let ACCs = [
  {
    x: 0,
    y: 0,
    z: 0,
  },
  {
    x: 0,
    y: 0,
    z: 0,
  },
];

function setup() {
    // const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    // const canvas_height = canvas_width * 9 / 16;
    const canvas_width = 720/2;
    const canvas_height = 960/2;
    mycanvas = createCanvas(canvas_width, canvas_height);
    document.querySelector('#canvas_placeholder').appendChild(mycanvas.elt);
    textFont('Roboto');
    textSize(14);

  textAlign(CENTER, CENTER);
  foot_print_left = loadImage("images/foot_print_left.png");
  foot_print_right = loadImage("images/foot_print_right.png");


  //sound
  osc = new p5.TriOsc();
  // Instantiate the envelope
  envelope = new p5.Env();
  // set attackTime, decayTime, sustainRatio, releaseTime
  envelope.setADSR(0.001, 0.1, 0.1, 0.1);
  // set attackLevel, releaseLevel
  envelope.setRange(1, 0);
}


//for Debug
function keyPressed() {
    if (keyCode === UP_ARROW) {
      osc.start();
      landCircles.push(new footAnglePoint(0, 50));
       //Generates a circle based on the angle of landing
    } else if (keyCode === RIGHT_ARROW) {
      landCircles.push(new footAnglePoint(0, 20));
    } else if (keyCode === DOWN_ARROW) {
      landCircles.push(new footAnglePoint(0, -20));
    } else if (keyCode === LEFT_ARROW) {
      landCircles.push(new footAnglePoint(0, -50));
    }
  }



function draw() {
  background(200);
  fill(255);
  //draw background image
  image(
    foot_print_left,
    width * 0.0,
    height * 0.0,
    height * 1.0 *360 / 960,
    height * 1.0
  );
  image(
    foot_print_right,
    width * 0.5,
    height * 0.0,
    height * 1.0 *360 / 960,
    height * 1.0
  );


  //draw foot angle circles
  for (let i = 0; i < landCircles.length; i++) {
    landCircles[i].update();
    landCircles[i].display();
    fill(255);
  }
  //delete the first one when the number of arrays increases beyond 10
  if (landCircles.length >= 10) {
    landCircles.shift();
  }

  //draw acc circles
  for (let i = 0; i < accCircles.length; i++) {
    accCircles[i].update();
    accCircles[i].display();
    fill(255);
    //delete the first one when the number of arrays increases beyond 30
    while (accCircles.length > 30) {
      accCircles.shift();
    }
  }

  text(`foot_angle:` + foot_angles[0].toFixed(3), width * 0.25, height * 0.98);
  text(`foot_angle:` + foot_angles[1].toFixed(3), width * 0.75, height * 0.98);
}


// footAnglePoint class
class footAnglePoint {
    constructor(_left_or_right, _footAngle) {
      this.left_or_right = _left_or_right;
      this.footAngle = _footAngle;
      this.diameter = width * 0.25;
      this.transparency = 255;
  
      this.x = _left_or_right == 0 ? width * 0.27 : width * 0.73;
      if (_footAngle > 30) _footAngle = 30; //set the upper limit
      if (_footAngle < -30) _footAngle = -30; //set the lower limit
      this.y = map(
        _footAngle,
        -30,
        30,
        (width * 0.5 * 960) / 360 - this.diameter * 0.5,
        this.diameter * 0.5
      );
  
      //Sound
      let freqValue = midiToFreq(scaleArray[int(map(_footAngle, -30, 30, 0, 7))]); //8 levels of scale depending on the angle of landing
      osc.freq(freqValue);
      envelope.play(osc, 0, 0.1);
    }
  
    update() {
      if (this.diameter > 0) this.diameter--;
      if (this.transparency > 0) this.transparency -= 10;
      else this.transparency = 0;
    }
  
    display() {
      fill(255, 96, 64, this.transparency);
      ellipse(this.x, this.y, this.diameter, this.diameter);
    }
  }
  
  // Class to store past acceleration X,Y values
  class accelerometerPoint {
    constructor(_left_or_right, _acc) {
      this.diameter = width * 0.02;
      this.transparency = 255;
      this.x = _left_or_right == 0 ? width * (0.25 + _acc.x) : width * (0.75 + _acc.x) ;
      this.y = height * (0.35 - _acc.y);
    }
  
    update() {
      if (this.transparency > 0) this.transparency -= 10;
      else this.transparency = 0;
    }
  
    display() {
      fill(70, 230, 230, this.transparency);
      ellipse(this.x, this.y, this.diameter, this.diameter);
    }
  }

function windowResized() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16;
    resizeCanvas(canvas_width, canvas_height);
}
//End point of canvas_placeholder




window.onload = function () {
  // bles: defined in coreToolkit.js
  for (let ble of bles) {
    ble.setup();
    ble.onConnect = function (uuid) {
      console.log('onConnect:', uuid);
      // document.querySelector(`#status${ble.id}`).innerText = 'ONLINE';
      // document.querySelector(`#status${ble.id}`).classList = 'bg-primary text-white'

      ////start sound////
      osc.start();
      envelope.play(osc, 0, 0.5);
    }

    ble.onDisconnect = function () {
      // document.querySelector(`#status${ble.id}`).innerText = 'OFFLINE';
      // document.querySelector(`#status${ble.id}`).classList = 'bg-secondary text-white'
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
      //Register an event listener when a FootAngle is received.
    ble.gotFootAngle = function (foot_angle) {
      document.querySelector(`#stride${this.id}_w`).innerHTML = foot_angle.value.toFixed(3);
      foot_angles[this.id] = foot_angle.value;
      landCircles.push(new footAnglePoint(this.id, foot_angle.value));//Generates a circle based on the angle of landing
    };

    ble.gotAcc = function (acc) {
      document.querySelector(`#sva${this.id}_x`).innerHTML = `${acc.x.toFixed(3)}`;
      document.querySelector(`#sva${this.id}_y`).innerHTML = `${acc.y.toFixed(3)}`;
      document.querySelector(`#sva${this.id}_z`).innerHTML = `${acc.z.toFixed(3)}`;
      //Register an event listener when a Acc is received.
      ACCs[this.id] = acc;
      accCircles.push(new accelerometerPoint(this.id, acc));
  }

  ble.gotPronation = function (pronation) {
    document.querySelector(`#pronation${this.id}_x`).innerHTML = pronation.x.toFixed(3);
    document.querySelector(`#pronation${this.id}_y`).innerHTML = pronation.y.toFixed(3);
    document.querySelector(`#pronation${this.id}_z`).innerHTML = pronation.z.toFixed(3);
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

