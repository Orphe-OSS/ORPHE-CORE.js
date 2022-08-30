/**
 * Mediapipe: https://google.github.io/mediapipe/solutions/pose.html
 */
const videoElement = document.getElementsByClassName('input_video')[0];
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
function onResults(results) {
  g_results = results;
  if (!results.poseLandmarks) {
    grid.updateLandmarks([]);
    return;
  }
  grid.updateLandmarks(results.poseWorldLandmarks);
}

const pose = new Pose({
  locateFile: (file) => {
    console.log(file);
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

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({ image: videoElement });
  },
  width: 1280,
  height: 720
});


let capture;
let landmarks = [
  [7, 3, 2, 1, 0, 4, 5, 6, 8],
  [10, 9],
  [12, 14, 16, 18, 20, 16, 22],
  [11, 13, 15, 17, 19, 15, 21],
  [12, 11, 23, 24, 12],
  [24, 26, 28, 30, 32],
  [23, 25, 27, 29, 31]
]

var basefont;
function preload() {
  basefont = loadFont('/fonts/Roboto/Roboto-Medium.ttf');

}
function setup() {
  let w = document.querySelector('#canvas_placeholder').clientWidth;
  let h = document.querySelector('#canvas_placeholder').clientHeight;
  let canvas = createCanvas(w, w * 9 / 16);
  document.querySelector('#canvas_placeholder').appendChild(canvas.elt);
  camera.start();

  capture = createCapture(
    {
      video: {
        //devideId:
        //'d5e42f51fb9195bb836947df7b527c21701cf4378a3cad62a1a33a4948abbc5f',
        //'16d38bc45b2b90e6219d122ff2f006c4f9ce2d2147253efdba40b8ef914fd2d'
        facingMode: 'user',
        width: 1280,
        height: 720,
      }
    });
  //capture.size(1280, 720);
  capture.hide();

  textFont(basefont);

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
    unit: 'deg'
  },
  {
    angle: 0,
    unit: 'deg'
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

function draw() {
  background(200);
  image(capture, 0, 0, width, height);

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
  fill(255);
  let grid = { x: width / 10, y: height / 20 };
  for (let i = 0; i < 2; i++) {
    textAlign(CENTER, BASELINE);
    textSize(24);
    text('Stride', (width - 2 * grid.x) * i + grid.x, grid.y);
    textSize(18);
    text('Height', (width - 2 * grid.x) * i + grid.x - width / 30, grid.y * 2);
    textSize(24);
    textAlign(RIGHT, BASELINE);
    text(`${stride[i].z.toFixed(0)}`, (width - 2 * grid.x) * i + grid.x * 1.4, grid.y * 2);
    textSize(18);
    text(`${stride[i].unit}`, (width - 2 * grid.x) * i + grid.x * 1.65, grid.y * 2);
  }
  // ------------------------------
}


function windowResized() {
  let w = document.querySelector('#main_container').clientWidth;
  let h = w * 9 / 16;
  resizeCanvas(w, h);
}


var bles = [new Orphe(0), new Orphe(1)];

async function toggleCoreModule(dom) {
  let checked = dom.checked;
  let number = dom.value;
  let ble = bles[number];

  if (checked == true) {
    let ret = await ble.begin('ANALYSIS');
    console.log(number);
    setTimeout(async function () {
      var obj = await ble.getDeviceInformation();
      console.log(obj);
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
    document.querySelector(`#icon_brightness${number}`).classList = 'text-primary';
  }
  else {
    ble.reset();
    document.querySelector(`#icon_bluetooth${number}`).classList = 'text-muted';
    document.querySelector(`#icon_battery${number}`).innerHTML = '<i class="bi bi-battery"></i>';
    document.querySelector(`#icon_battery${number}`).classList = 'text-muted';
    document.querySelector(`#icon_brightness${number}`).classList = 'text-muted';
  }
}

function toggleBrightness(dom) {
  let number = dom.getAttribute('number');
  let id = dom.getAttribute('value');
  console.log(id);
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

let acc_count = 0;
window.onload = function () {

  for (let ble of bles) {
    chart_stride[ble.id] = new Chart(document.querySelector(`#chart_stride${ble.id}`), config_stride[ble.id]);
    chart_quat[ble.id] = new Chart(document.querySelector(`#chart_quat${ble.id}`), config_quat[ble.id]);

    ble.setup();
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
      document.querySelector(`#icon_brightness${ble.id}`).classList = 'text-muted';
      document.querySelector(`#switch_ble${ble.id}`).checked = false;
      ble.reset();
      alert('接続が切れました');
      ble.begin();
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