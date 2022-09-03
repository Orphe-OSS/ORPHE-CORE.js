/**
 * Mediapipe: https://google.github.io/mediapipe/solutions/pose.html
 */
const MODE_ONLY_CAMERA = 0;
const MODE_HUD_ARROW = 1;
const MODE_HUD_COIN = 2;
var mode = 0;//MODE_ONLY_CAMERA;
var particle_effect;
function getUserAttitude(landmark_vector) {
  let angles = [
    [12, 24, 26],
    [11, 23, 25]
  ]
}

function mousePressed() {
  if (mode == 2) coin_effect.create(mouseX, mouseY);
  else if (mode == 1) particle_effect.create(mouseX, mouseY, 20);

}
function keyPressed() {

  if (key == '1') {
    mode = MODE_ONLY_CAMERA;
    toggleCoinMode({ checked: false });
    document.querySelector('#switch_coin').checked = false;
    document.querySelector('#landmark-grid-container').hidden = true;
  }
  else if (key == '2') {
    mode = MODE_HUD_ARROW;
    toggleCoinMode({ checked: false });
    document.querySelector('#switch_coin').checked = false;
    document.querySelector('#landmark-grid-container').hidden = false;
  }
  else if (key == '3') {
    mode = MODE_HUD_COIN;
    document.querySelector('#landmark-grid-container').hidden = false;
    document.querySelector('#switch_coin').checked = true;
    toggleCoinMode({ checked: true });
  }

}

var poseRecognizer = {
  createInputVector: function (landmark_vector) {
    let calc_array = [
      [16, 14, 12],
      [14, 12, 11],
      [12, 11, 13],
      [11, 13, 15]
    ];
    let input_array = [];
    for (let c of calc_array) {
      let v1 = createVector(landmark_vector[c[0]].x - landmark_vector[c[1]].x, landmark_vector[c[0]].y - landmark_vector[c[1]].y);
      let v2 = createVector(landmark_vector[c[2]].x - landmark_vector[c[1]].x, landmark_vector[c[2]].y - landmark_vector[c[1]].y);
      input_array.push(abs(v1.angleBetween(v2)));
    }
    return input_array;
  },
  classify: function (input_vector) {
    let distance = 0;
    for (let i = 0; i < input_vector.length; i++) {
      distance += pow(input_vector[i] - this.data[i], 2);
    }
    distance = sqrt(distance);
    if (distance < 0.5) {
      if (this.is_detecting == false) {
        this.timestamp.start_detecting = millis();
      }
      this.is_detecting = true;
      return true;
    }

    if (this.is_detecting == true) {
      this.timestamp.end_detecting = millis();
    }
    this.is_detecting = false;
    return false;
  },
  getContinuesRecognizingTime: function () {
    if (this.is_detecting) {
      return millis() - this.timestamp.start_detecting;
    }
    return 0;
  },
  resetContinuesRecognizingTime: function () {
    this.timestamp.start_detecting = millis();
  },
  data: [3.14, 3.14, 3.14, 3.14],
  threshold: 0.7,
  is_detecting: false,
  timestamp: {
    start_detecting: 0,
    end_detecting: 0,
  }
}

const videoElement = document.querySelector('.input_video');
const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0];
const grid = new LandmarkGrid(landmarkContainer, {
  axesColor: 0xffffff,
  axesWidth: 2,
  centered: false,
  connectionColor: 0x00ffff,
  connectionWidth: 3,
  definedColors: [],
  fitToGrid: true,
  labelPrefix: '',
  labelSuffix: '',
  landmarkSize: 3,
  landmarkColor: 0xaaaaaa,
  margin: 0,
  minVisibility: .65,
  nonvisibleLandmarkColor: 0xff7777,
  numCellsPerAxis: 5,
  range: 1,
  rotationSpeed: .00,
  showHidden: true,
});
var g_results;
var pos_coin = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];
function onResults(results) {
  g_results = results;
  if (!results.poseLandmarks) {
    grid.updateLandmarks([]);
    return;
  }
  if (results.poseLandmarks.length == 33) {
    pos_coin[0] = {
      x: width * results.poseLandmarks[29].x,
      y: height * results.poseLandmarks[29].y,
    }
    pos_coin[1] = {
      x: width * results.poseLandmarks[30].x,
      y: height * results.poseLandmarks[30].y,
    }

    poseRecognizer.classify(poseRecognizer.createInputVector(results.poseLandmarks));
  }

  grid.updateLandmarks(results.poseWorldLandmarks);

}

const pose = new Pose({
  locateFile: (file) => {
    //console.log(file);
    return `./models/${file}`;
  }
});
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  smoothSegmentation: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onResults);


let capture;
let landmarks = [
  //[7, 3, 2, 1, 0, 4, 5, 6, 8],
  //[10, 9],
  [12, 14, 16, 18, 20, 16, 22],
  [11, 13, 15, 17, 19, 15, 21],
  [12, 11, 23, 24, 12],
  [24, 26, 28, 30, 32],
  [23, 25, 27, 29, 31]
]

var basefont;
var coin_effect;
var coin_sound;
function preload() {
  basefont = loadFont('../../fonts/Roboto/Roboto-Medium.ttf');
  coin_effect = new CoinEffect(10);
  particle_effect = new ParticleEffect(100);
  coin_sound = loadSound('coin.mp3');
  coin_sound.setVolume(0.1);
}

function setup() {
  let w = document.querySelector('#video_placeholder').clientWidth;
  let h = document.querySelector('#video_placeholder').clientHeight;
  let canvas = createCanvas(w, w * 9 / 16);
  document.querySelector('#canvas_placeholder').appendChild(canvas.elt);


  console.log(document.querySelector('#video_placeholder'));
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await pose.send({ image: videoElement });
    },
    width: 1280,
    height: 720
  });
  camera.start();


  // capture = createCapture(
  //   {
  //     video: {
  //       //devideId:
  //       //'d5e42f51fb9195bb836947df7b527c21701cf4378a3cad62a1a33a4948abbc5f',
  //       //'16d38bc45b2b90e6219d122ff2f006c4f9ce2d2147253efdba40b8ef914fd2d'
  //       facingMode: 'user',
  //       width: 1280,
  //       height: 720,
  //     }
  //   });
  //capture.size(1280, 720);
  //capture.hide();
  //
  //console.log(document.querySelector('#video_placeholder'));;
  textFont(basefont);
  document.querySelector('#landmark-grid-container').hidden = true;
  frameRate(60);
}

var stride = [
  {
    x: 0,
    y: 0,
    z: 0,
    unit: 'cm'
  },
  {
    x: 0,
    y: 0,
    z: 0,
    unit: 'cm'
  },
];

var pronation = [
  {
    angle: 0,
    unit: 'deg',
    x: 0,
    y: 0,
    z: 0,
  },
  {
    angle: 0,
    unit: 'deg',
    x: 0,
    y: 0,
    z: 0,

  }
];

var contact = [
  {
    force: { value: 0, unit: 'kgf' },
    duration: { value: 0, unit: 'sec' }
  },
  {
    force: { value: 0, unit: 'kgf' },
    duration: { value: 0, unit: 'sec' }
  }
];

var footstrike = [
  {
    angle: 0,
    unit: 'deg'
  },
  {
    angle: 0,
    unit: 'deg'
  },
]

var activity = [
  {
    calorie: { value: 0, unit: 'cal' },
    distance: { value: 0, unit: 'km' },
    steps: { value: 0, unit: 'steps' }
  },
  {
    calorie: { value: 0, unit: 'cal' },
    distance: { value: 0, unit: 'km' },
    steps: { value: 0, unit: 'steps' }
  }
]

var coin = {
  steps: [0, 0],
  getSteps: function () {
    return this.steps[0] + this.steps[1];
  },
  money: 0,
  getMoney: function () {
    return 0.085 * this.getSteps();
  }
}

function draw() {
  clear();
  imageMode(CORNER);
  tint(255, 255);
  //image(capture, 0, 0, width, height);

  let command_time = poseRecognizer.getContinuesRecognizingTime()
  if (command_time > 0) {
    noStroke();
    fill(69, 230, 230, 100);
    arc(width / 2, height / 2, width / 4, width / 4, -HALF_PI, 2 * PI * (command_time / 1500) - HALF_PI);
    if (command_time / 1500 > 1) {
      mode++;


      poseRecognizer.resetContinuesRecognizingTime();
      if (mode > MODE_HUD_COIN) {
        mode = MODE_ONLY_CAMERA;
      }

      if (mode == MODE_ONLY_CAMERA) {
        toggleCoinMode({ checked: false });
        document.querySelector('#switch_coin').checked = false;
        document.querySelector('#landmark-grid-container').hidden = true;
      }
      else if (mode == MODE_HUD_ARROW) {
        document.querySelector('#landmark-grid-container').hidden = false;
      }
      else if (mode == MODE_HUD_COIN) {
        document.querySelector('#landmark-grid-container').hidden = false;
        document.querySelector('#switch_coin').checked = true;
        toggleCoinMode({ checked: true });
      }
    }
  }
  if (mode == MODE_ONLY_CAMERA) {
    return;
  }


  if (g_results) {
    if (g_results.poseLandmarks) {
      let p = g_results.poseLandmarks;
      noFill();
      stroke('#45e6e6');
      strokeWeight(5);
      for (ls of landmarks) {
        beginShape();
        for (l of ls) {
          vertex(width * p[l].x, height * p[l].y);
        }
        endShape();
      }

      for (ls of landmarks) {
        fill('#ff6040');
        noStroke();
        beginShape();
        for (l of ls) {
          circle(width * p[l].x, height * p[l].y, 10);
        }
        endShape();
      }
    }
  }


  // ------------------------------
  textAlign(CENTER, BASELINE);
  textSize(24);
  noStroke();
  fill(255);
  let grid = { x: width / 10, y: height / 19 };
  let fontsize = {
    title: 24,
    name: 14,
    param: 24,
    unit: 14
  }

  // Stride
  for (let i = 0; i < 2; i++) {
    textAlign(CENTER, BASELINE)
    textSize(fontsize.title);
    text('Stride', (width - 2 * grid.x) * i + grid.x, grid.y);
    textSize(fontsize.name);
    textAlign(LEFT, BASELINE)
    text('X', (width - 2 * grid.x) * i + grid.x - width / 17, grid.y * 2);
    textSize(fontsize.param);
    textAlign(RIGHT, BASELINE);
    text(`${stride[i].x.toFixed(0)}`, (width - 2 * grid.x) * i + grid.x * 1.4, grid.y * 2);
    textSize(fontsize.unit);
    textAlign(LEFT, BASELINE);
    text(`${stride[i].unit}`, (width - 2 * grid.x) * i + grid.x * 1.41, grid.y * 2);

    textAlign(CENTER, BASELINE)
    textSize(fontsize.name);
    textAlign(LEFT, BASELINE)
    text('Y', (width - 2 * grid.x) * i + grid.x - width / 17, grid.y * 3);
    textSize(fontsize.param);
    textAlign(RIGHT, BASELINE);
    text(`${stride[i].y.toFixed(0)}`, (width - 2 * grid.x) * i + grid.x * 1.4, grid.y * 3);
    textSize(fontsize.unit);
    textAlign(LEFT, BASELINE);
    text(`${stride[i].unit}`, (width - 2 * grid.x) * i + grid.x * 1.41, grid.y * 3);

    textAlign(CENTER, BASELINE)
    textSize(fontsize.name);
    textAlign(LEFT, BASELINE)
    text('Z', (width - 2 * grid.x) * i + grid.x - width / 17, grid.y * 4);
    textSize(fontsize.param);
    textAlign(RIGHT, BASELINE);
    text(`${stride[i].z.toFixed(0)}`, (width - 2 * grid.x) * i + grid.x * 1.4, grid.y * 4);
    textSize(fontsize.unit);
    textAlign(LEFT, BASELINE);
    text(`${stride[i].unit}`, (width - 2 * grid.x) * i + grid.x * 1.41, grid.y * 4);
  }

  // Pronation
  let y_start = 6;
  for (let i = 0; i < 2; i++) {

    textAlign(CENTER, BASELINE)
    textSize(fontsize.title);
    text('Pronation', (width - 2 * grid.x) * i + grid.x, grid.y * (y_start));
    textSize(fontsize.name);
    textAlign(LEFT, BASELINE)
    text('X', (width - 2 * grid.x) * i + grid.x - width / 17, grid.y * (y_start + 1));
    textSize(fontsize.param);
    textAlign(RIGHT, BASELINE);
    text(`${pronation[i].x.toFixed(0)}`, (width - 2 * grid.x) * i + grid.x * 1.4, grid.y * (y_start + 1));
    textSize(fontsize.unit);
    textAlign(LEFT, BASELINE);
    text(`${pronation[i].unit}`, (width - 2 * grid.x) * i + grid.x * 1.41, grid.y * (y_start + 1));

    textAlign(LEFT, BASELINE);
    text(`${pronation[i].unit}`, (width - 2 * grid.x) * i + grid.x * 1.41, grid.y * (y_start + 2));
    text('Y', (width - 2 * grid.x) * i + grid.x - width / 17, grid.y * (y_start + 2));
    textSize(fontsize.param);
    textAlign(RIGHT, BASELINE);
    text(`${pronation[i].y.toFixed(0)}`, (width - 2 * grid.x) * i + grid.x * 1.4, grid.y * (y_start + 2));
    textSize(fontsize.unit);
    textAlign(LEFT, BASELINE);
    text(`${pronation[i].unit}`, (width - 2 * grid.x) * i + grid.x * 1.41, grid.y * (y_start + 2));

    textAlign(LEFT, BASELINE);
    text(`${pronation[i].unit}`, (width - 2 * grid.x) * i + grid.x * 1.41, grid.y * (y_start + 3));
    text('Z', (width - 2 * grid.x) * i + grid.x - width / 17, grid.y * (y_start + 3));
    textSize(fontsize.param);
    textAlign(RIGHT, BASELINE);
    text(`${pronation[i].z.toFixed(0)}`, (width - 2 * grid.x) * i + grid.x * 1.4, grid.y * (y_start + 3));
    textSize(fontsize.unit);
    textAlign(LEFT, BASELINE);
    text(`${pronation[i].unit}`, (width - 2 * grid.x) * i + grid.x * 1.41, grid.y * 8);
  }
  // ------------------------------
  particle_effect.draw();

  if (mode == MODE_HUD_ARROW) return;

  // draw coin effect
  if (is_coin_mode) {
    y_start = 16;
    for (let i = 1; i < 2; i++) {

      textAlign(CENTER, BASELINE)
      textSize(fontsize.title);
      text('Wallet', (width - 2 * grid.x) * i + grid.x, grid.y * (y_start));
      textSize(fontsize.param);
      textAlign(RIGHT, BASELINE);
      text(`${coin.getSteps().toFixed(0)}`, (width - 2 * grid.x) * i + grid.x - width / 17, grid.y * (y_start + 1));
      textSize(fontsize.name);
      textAlign(LEFT, BASELINE)
      text('steps', (width - 2 * grid.x) * i + grid.x - width / 17, grid.y * (y_start + 1));
      textSize(fontsize.param);
      textAlign(RIGHT, BASELINE);
      text(`${coin.getMoney().toFixed(2)}`, (width - 2 * grid.x) * i + grid.x * 1.6, grid.y * (y_start + 1));
      textSize(fontsize.unit);
      textAlign(LEFT, BASELINE);
      text(`yen`, (width - 2 * grid.x) * i + grid.x * 1.61, grid.y * (y_start + 1));
    }
  }
  // ------------------------------
  coin_effect.draw();

}

function windowResized() {
  let w = document.querySelector('#video_placeholder').clientWidth;
  let h = w * 9 / 16;
  resizeCanvas(w, h);
}


var bles = [new Orphe(0), new Orphe(1)];

async function toggleCoreModule(dom) {
  let checked = dom.checked;
  let number = dom.value;
  let ble = bles[number];

  if (checked == true) {
    let ret = await ble.begin();
    //console.log(number);
    setTimeout(async function () {
      var obj = await ble.getDeviceInformation();
      //console.log(obj);
      let str_battery_status;
      if (obj.battery == 0) str_battery_status = 'empty';
      else if (obj.battery == 1) str_battery_status = 'normal';
      else if (obj.battery == 2) str_battery_status = 'full';
      document.querySelector(`#icon_battery${number}`).setAttribute('title', `${str_battery_status}`);

      if (obj.battery == '0') {
        document.querySelector(`#icon_battery${number}`).innerHTML = '<i class="bi bi-battery"></i>';
        document.querySelector(`#icon_battery${number}`).classList = 'text-warning';
      }
      else if (obj.battery == '1') {
        document.querySelector(`#icon_battery${number}`).innerHTML = '<i class="bi bi-battery-half"></i>';
        document.querySelector(`#icon_battery${number}`).classList = 'text-primary';
      }
      else if (obj.battery == '2') {
        document.querySelector(`#icon_battery${number}`).innerHTML = '<i class="bi bi-battery-full"></i>';
        document.querySelector(`#icon_battery${number}`).classList = 'text-primary';
      }
    }, 500);
    document.querySelector(`#icon_bluetooth${number}`).classList = 'text-primary';
    document.querySelector(`#icon_reset${number}`).classList = 'text-primary';
    document.querySelector(`#icon_brightness${number}`).classList = 'text-primary';
  }
  else {
    ble.reset();
    document.querySelector(`#icon_bluetooth${number}`).classList = 'text-muted';
    document.querySelector(`#icon_battery${number}`).innerHTML = '<i class="bi bi-battery"></i>';
    document.querySelector(`#icon_battery${number}`).classList = 'text-muted';
    document.querySelector(`#icon_reset${number}`).classList = 'text-muted';
    document.querySelector(`#icon_brightness${number}`).classList = 'text-muted';
  }
}

function resetCoreModule(dom) {
  let id = dom.getAttribute("value");
  bles[id].resetMotionSensorAttitude();
  bles[id].resetAnalysisLogs();
}

function toggleBrightness(dom) {
  let number = dom.getAttribute('number');
  let id = dom.getAttribute('value');
  //console.log(id);
  number++;
  if (number > 5) number = -1;
  document.querySelector(`#led_number${id}`).innerText = number + 1;

  if (number == -1) {
    bles[id].setLED(0, 0);
    document.querySelector(`#icon_brightness${id}`).classList = 'text-muted';
  } else {
    bles[id].setLED(1, number);
    document.querySelector(`#icon_brightness${id}`).classList = 'text-primary';
  }
  dom.setAttribute('number', number);
}
var is_coin_mode = false;
function toggleCoinMode(dom) {
  is_coin_mode = dom.checked;
}
let acc_count = 0;
window.onload = function () {

  for (let ble of bles) {
    chart_stride[ble.id] = new Chart(document.querySelector(`#chart_stride${ble.id}`), config_stride[ble.id]);
    chart_quat[ble.id] = new Chart(document.querySelector(`#chart_quat${ble.id}`), config_quat[ble.id]);

    ble.setup();
    ble.gotStepsNumber = function (steps_number) {
      if (is_coin_mode) {
        coin_effect.create(pos_coin[this.id].x, pos_coin[this.id].y);
        coin.steps[ble.id] = steps_number.value;
        coin_sound.play();
      }
      else if (mode == MODE_HUD_ARROW) {
        particle_effect.create(pos_coin[this.id].x, pos_coin[this.id].y, 20);
      }
    }
    ble.gotLandingImpact = function (impact) {
      console.log(impact);
    }
    // ble.gotFootAngle = function (_footangle) {
    //   pronation[this.id].angle = _footangle.value;
    // }
    ble.gotPronation = function (_pronation) {
      pronation[this.id].x = _pronation.x;
      pronation[this.id].y = _pronation.y;
      pronation[this.id].z = _pronation.z;
    }
    ble.gotStride = function (_stride) {
      stride[this.id].x = 100 * _stride.x;
      stride[this.id].y = 100 * _stride.y;
      stride[this.id].z = 100 * _stride.z;

      while (chart_stride[this.id].data.labels.length > 100) {
        chart_stride[this.id].data.labels.shift();
      }
      chart_stride[this.id].data.labels.push(_stride.steps_number);
      while (chart_stride[this.id].data.datasets[0].data.length > 100) {
        chart_stride[this.id].data.datasets[0].data.shift();
        chart_stride[this.id].data.datasets[1].data.shift();
        chart_stride[this.id].data.datasets[2].data.shift();
      }
      chart_stride[this.id].data.datasets[0].data.push(_stride.x);
      chart_stride[this.id].data.datasets[1].data.push(_stride.y);
      chart_stride[this.id].data.datasets[2].data.push(_stride.z);
      chart_stride[this.id].update();
    }
    ble.gotQuat = function (_quat) {
      while (chart_quat[this.id].data.labels.length > 100) {
        chart_quat[this.id].data.labels.shift();
      }
      chart_quat[this.id].data.labels.push(acc_count);

      while (chart_quat[this.id].data.datasets[0].data.length > 100) {
        chart_quat[this.id].data.datasets[0].data.shift();
        chart_quat[this.id].data.datasets[1].data.shift();
        chart_quat[this.id].data.datasets[2].data.shift();
        chart_quat[this.id].data.datasets[3].data.shift();
      }
      chart_quat[this.id].data.datasets[0].data.push(_quat.w);
      chart_quat[this.id].data.datasets[1].data.push(_quat.x);
      chart_quat[this.id].data.datasets[2].data.push(_quat.y);
      chart_quat[this.id].data.datasets[3].data.push(_quat.z);

      chart_quat[this.id].update();
      acc_count++;
    };

    ble.onDisconnect = function () {
      document.querySelector(`#icon_bluetooth${ble.id}`).classList = 'text-muted';
      document.querySelector(`#icon_battery${ble.id}`).innerHTML = '<i class="bi bi-battery"></i>';
      document.querySelector(`#icon_battery${ble.id}`).classList = 'text-muted';
      document.querySelector(`#icon_reset${ble.id}`).classList = 'text-muted';
      document.querySelector(`#icon_brightness${ble.id}`).classList = 'text-muted';
      document.querySelector(`#switch_ble${ble.id}`).checked = false;
      ble.reset();
      //alert('接続が切れました');
      //ble.begin();
    }
  }
}

//some mysterious code to get device ids
navigator.mediaDevices.enumerateDevices()
  .then(function (devices) {
    devices.forEach(function (device) {
      console.log(device.kind + ": " + device.label +
        " id = " + device.deviceId);
    });
  })
  .catch(function (err) {
    console.log(err.name + ": " + err.message);
  });


var chart_quat = [];
var chart_stride = [];
const data_quat =
  [
    {
      labels: [],
      datasets: [
        {
          label: "w",
          backgroundColor: "rgb(255, 96, 64)",
          borderColor: "rgb(255, 96, 64)",
          pointRadius: 1.0,
          data: [],
        },
        {
          label: "x",
          backgroundColor: "rgb(69,230, 230)",
          borderColor: "rgb(69,230,230)",
          pointRadius: 1.0,
          data: [],
        },
        {
          label: "y",
          backgroundColor: "rgb(28,28,28)",
          borderColor: "rgb(28,28,28)",
          pointRadius: 1.0,
          data: [],
        },
        {
          label: "z",
          backgroundColor: "rgb(127,127,127)",
          borderColor: "rgb(127,127,127)",
          pointRadius: 1.0,
          data: [],
        },
      ],
    },
    {
      labels: [],
      datasets: [
        {
          label: "w",
          backgroundColor: "rgb(255, 96, 64)",
          borderColor: "rgb(255, 96, 64)",
          pointRadius: 1.0,
          data: [],
        },
        {
          label: "x",
          backgroundColor: "rgb(69,230, 230)",
          borderColor: "rgb(69,230,230)",
          pointRadius: 1.0,
          data: [],
        },
        {
          label: "y",
          backgroundColor: "rgb(28,28,28)",
          borderColor: "rgb(28,28,28)",
          pointRadius: 1.0,
          data: [],
        },
        {
          label: "z",
          backgroundColor: "rgb(127,127,127)",
          borderColor: "rgb(127,127,127)",
          pointRadius: 1.0,
          data: [],
        },
      ],
    }
  ];

const data_stride =
  [
    {
      labels: [],
      datasets:
        [
          {
            label: "x",
            backgroundColor: "rgb(255, 96, 64)",
            borderColor: "rgb(255, 96, 64)",
            pointRadius: 1.0,
            data: [],
          },
          {
            label: "y",
            backgroundColor: "rgb(69,230, 230)",
            borderColor: "rgb(69,230,230)",
            pointRadius: 1.0,
            data: [],
          },
          {
            label: "z",
            backgroundColor: "rgb(28,28,28)",
            borderColor: "rgb(28,28,28)",
            pointRadius: 1.0,
            data: [],
          },
        ],
    },
    {
      labels: [],
      datasets:
        [
          {
            label: "x",
            backgroundColor: "rgb(255, 96, 64)",
            borderColor: "rgb(255, 96, 64)",
            pointRadius: 1.0,
            data: [],
          },
          {
            label: "y",
            backgroundColor: "rgb(69,230, 230)",
            borderColor: "rgb(69,230,230)",
            pointRadius: 1.0,
            data: [],
          },
          {
            label: "z",
            backgroundColor: "rgb(28,28,28)",
            borderColor: "rgb(28,28,28)",
            pointRadius: 1.0,
            data: [],
          },
        ],
    }
  ];


const config_quat =
  [
    {
      type: "line",
      data: data_quat[0],
      options: {
        animation: false,
        scales: {
          y: {
            min: -2,
            max: 2,
          },
        },
      },
    },
    {
      type: "line",
      data: data_quat[1],
      options: {
        animation: false,
        scales: {
          y: {
            min: -2,
            max: 2,
          },
        },
      },
    }
  ];
const config_stride =
  [
    {
      type: "line",
      data: data_stride[0],
      options: {
        animation: true,
        scales: {
          y: {
          },
        },
      },
    },
    {
      type: "line",
      data: data_stride[1],
      options: {
        animation: true,
        scales: {
          y: {
          },
        },
      },
    }
  ];