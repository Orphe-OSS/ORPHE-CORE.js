var bufsize = 128;
var fft = new FFTJS(bufsize);
var input = new Array(bufsize);
var sampling_rate = 50;
var freq_step = sampling_rate / bufsize;
var out = fft.createComplexArray();

var ble = new Orphe(0);

var is_active = false;
var chart;
var chart_today;
var target;
var gauge;
var opts = {
  angle: 0.22, // The span of the gauge arc
  lineWidth: 0.2, // The line thickness
  radiusScale: 1.0, // Relative radius
  pointer: {
    length: 0.59, // // Relative to gauge radius
    strokeWidth: 0.035, // The thickness
    color: '#000000' // Fill color
  },
  limitMax: true,     // If false, max value increases automatically if value > maxValue
  limitMin: true,     // If true, the min value of the gauge will be fixed
  colorStart: '#6FADCF',   // Colors
  colorStop: '#8FC0DA',    // just experiment with them
  strokeColor: '#E0E0E0',  // to see which ones work best for you
  generateGradient: true,
  highDpiSupport: true,     // High resolution support
  // renderTicks is Optional
  renderTicks: {
    divisions: 4,
    divWidth: 1.1,
    divLength: 0.73,
    divColor: '#333333',
    subDivisions: 3,
    subLength: 0.5,
    subWidth: 0.6,
    subColor: '#666666'
  },
  staticZones: [
    { strokeStyle: "#FF1818", min: 0, max: 1.0 },
    { strokeStyle: "#74C150", min: 1.0, max: 5.0 }, // Red from 100 to 130
  ],
};


async function saveWorkout() {
  let user = getParam('user');
  if (user == null) user = '';
  let key = `${user}_air_walker`;

  let steps = document.querySelector('#td_steps').innerText;
  let calories = document.querySelector('#td_calories').innerText;
  let distance = document.querySelector('#td_distance').innerText;
  let time = document.querySelector('#td_time').innerText;
  let date = document.querySelector('#td_date').innerText;
  var data = {
    [date]: {
      steps: steps,
      calories: calories,
      distance: distance,
      time: time
    }
  }


  // クッキーにない
  if (!localStorage.getItem(key)) {
    let json = JSON.stringify(data);
    localStorage.setItem(key, json);
  }
  // クッキーにある場合
  else {
    let saved_data = JSON.parse(localStorage.getItem(key));

    // timeが同じものがあれば数値を加算
    // そうでなければ既存に追加
    saved_data[date] = data[date];

    console.log('saved_data', saved_data);
    let json = JSON.stringify(saved_data);
    localStorage.setItem(key, json);

  }
  console.log(localStorage.getItem(key));
  initHistory();
}

function initHistory() {
  let user = getParam('user');
  if (user == null) user = '';
  let key = `${user}_air_walker`;


  // まだユーザリストが保存されていなければ
  if (!localStorage.getItem('users')) {
    let users = [user];
    localStorage.setItem('users', users);
  }
  else {

  }

  // クッキーにない
  if (!localStorage.getItem(key)) {
  }
  // クッキーにある場合
  else {
    let saved_data = JSON.parse(localStorage.getItem(key));
    document.querySelector('#tbody_history').innerHTML = '';
    //console.log(saved_data);
    for (key in saved_data) {
      console.log(saved_data[key]);
      let tbody = document.querySelector('#tbody_history');
      let tr = document.createElement('tr');
      tbody.appendChild(tr);
      let td = document.createElement('td');
      td.innerText = key;
      tr.appendChild(td);
      let td_steps = document.createElement('td');
      td_steps.innerText = saved_data[key].steps;
      tr.appendChild(td_steps);
      let td_calories = document.createElement('td');
      td_calories.innerText = saved_data[key].calories;
      tr.appendChild(td_calories);
      let td_distance = document.createElement('td');
      td_distance.innerText = saved_data[key].distance;
      tr.appendChild(td_distance);
      let td_time = document.createElement('td');
      td_time.innerText = saved_data[key].time;
      tr.appendChild(td_time);

      // 今日と同じ日付があれば今日の分のテーブルを更新する
      if (document.querySelector('#td_date').innerText === key) {
        document.querySelector('#td_steps').innerText = steps = saved_data[key].steps;
        document.querySelector('#p_steps').innerText = saved_data[key].steps;

        document.querySelector('#td_calories').innerText = saved_data[key].calories;
        document.querySelector('#p_calories').innerText = saved_data[key].calories;

        document.querySelector('#td_distance').innerText = saved_data[key].distance;
        document.querySelector('#p_distance').innerText = saved_data[key].distance;

        document.querySelector('#td_time').innerText = saved_data[key].time;
      }
    }
  }
}

/**
 * Get the URL parameter value
 * https://www-creators.com/archives/4463
 * @param  name {string} パラメータのキー文字列
 * @return  url {url} 対象のURL文字列（任意）
 */
function getParam(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}




function getCalorie(steps) {
  // 5677, 811
  let cal_per_step = 811 / 5677;
  return cal_per_step * steps;
}
function getDistance(steps) {
  // 5752, 20.5
  let dist_per_step = 20.5 / 5752;
  return dist_per_step * steps;
}

var s_time = new Date();
function millis() {
  var e_time = new Date();
  var diff = e_time.getTime() - s_time.getTime();
  //console.log("経過時間(ミリ秒):", diff);
  return diff;
}

const data_today = [
  {
    labels: ['steps/cycle'],
    datasets: [
      {
        label: "Number of Steps or Cycles",
        pointRadius: 1.0,
        data: [0],
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(255, 159, 64, 0.2)',
          'rgba(255, 205, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(201, 203, 207, 0.2)'
        ],
        borderColor: [
          'rgb(255, 99, 132)',
          'rgb(255, 159, 64)',
          'rgb(255, 205, 86)',
          'rgb(75, 192, 192)',
          'rgb(54, 162, 235)',
          'rgb(153, 102, 255)',
          'rgb(201, 203, 207)'
        ],
        borderWidth: 1
      }
    ]
  },
  {
    labels: ['calories'],
    datasets: [
      {
        label: "Calories",
        pointRadius: 1.0,
        data: [0],
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(255, 159, 64, 0.2)',
          'rgba(255, 205, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(201, 203, 207, 0.2)'
        ],
        borderColor: [
          'rgb(255, 99, 132)',
          'rgb(255, 159, 64)',
          'rgb(255, 205, 86)',
          'rgb(75, 192, 192)',
          'rgb(54, 162, 235)',
          'rgb(153, 102, 255)',
          'rgb(201, 203, 207)'
        ],
        borderWidth: 1
      }
    ]
  }
];

const data = [
  {
    labels: [],
    datasets: [
      {
        label: "Acc X",
        backgroundColor: "rgb(255, 96, 64)",
        borderColor: "rgb(255, 96, 64)",
        pointRadius: 1.0,
        data: [],
      },
      {
        label: "Acc Y",
        backgroundColor: "rgb(69,230, 230)",
        borderColor: "rgb(69,230,230)",
        pointRadius: 1.0,
        data: [],
      },
      {
        label: "Acc Z",
        backgroundColor: "rgb(96,255,64)",
        borderColor: "rgb(96,255,64)",
        pointRadius: 1.0,
        data: [],
      },
      {
        label: "composite Acc",
        backgroundColor: "rgb(28,28,28)",
        borderColor: "rgb(28,28,28)",
        pointRadius: 1.0,
        data: [],
      },
      {
        label: "max",
        backgroundColor: "rgb(200,200,200)",
        borderColor: "rgb(200,200,200)",
        pointRadius: 1.0,
        data: [],
      },
    ],
  },
  {
    labels: [],
    datasets: [
      {
        label: "delta Acc X",
        backgroundColor: "rgb(255, 96, 64)",
        borderColor: "rgb(255, 96, 64)",
        pointRadius: 1.0,
        data: [],
      },
      {
        label: "delta Acc Y",
        backgroundColor: "rgb(69,230, 230)",
        borderColor: "rgb(69,230,230)",
        pointRadius: 1.0,
        data: [],
      },
      {
        label: "delta Acc Z",
        backgroundColor: "rgb(96,255,64)",
        borderColor: "rgb(96,255,64)",
        pointRadius: 1.0,
        data: [],
      },
      {
        label: "composite delta Acc",
        backgroundColor: "rgb(28,28,28)",
        borderColor: "rgb(28,28,28)",
        pointRadius: 1.0,
        data: [],
      },
    ],
  },
  {
    labels: [],
    datasets: [
      {
        label: "FFT composite Acc",
        backgroundColor: "rgb(28, 28, 28)",
        borderColor: "rgb(28, 28, 28)",
        pointRadius: 1.0,
        data: [],
      },
    ],
  },
];

const config = {
  acc: {
    type: "line",
    data: data[0],
    options: {
      animation: false,
      scales: {
        y: {
          min: -0.5,
          max: 0.5,
        },
      },
    },
  },
  delta_acc: {
    type: "line",
    data: data[1],
    options: {
      animation: false,
      scales: {
        y: {
          min: -0.2,
          max: 0.2,
        },
      },
    },
  },
  fft: {
    type: "line",
    data: data[2],
    options: {
      animation: false,
      scales: {
        y: {
          min: 0.0,
          max: 10.0,
        },
      },
    },
  },
  today: {
    steps: {
      type: "bar",
      data: data_today[0],
      options: {
        //animation: false,
        scales: {
          y: {
            beginAtZero: true
          },
        },
      },
    },
    calories: {
      type: "bar",
      data: data_today[1],
      options: {
        //animation: false,
        scales: {
          y: {
            beginAtZero: true
          },
        },
      },
    },
  },
};

var average = function (array) {
  var result = 0, index = 0;
  for (index in array) {
    result = result + array[index];
  }
  return result / array.length;
};

var acc_count = 0;
var acc_prev = {
  x: 0,
  y: 0,
  z: 0,
};
var steps = 0;
var steps_count_timestamp = 0;
window.onload = function () {
  target = document.getElementById('gauge'); // your canvas element
  gauge = new Gauge(target).setOptions(opts); // create sexy gauge!
  gauge.maxValue = 5.0; // set max gauge value
  //gauge.limitMax = 5;
  gauge.setMinValue(0);  // Prefer setter over gauge.minValue = 0
  gauge.animationSpeed = 1; // set animation speed (32 is default value)
  gauge.set(0); // set actual value

  chart = {
    acc: new Chart(document.getElementById("chart_acc"), config.acc),
    delta_acc: new Chart(
      document.getElementById("chart_delta_acc"),
      config.delta_acc
    ),
    fft: new Chart(document.getElementById("chart_fft"), config.fft),
  };

  // ORPHE CORE Init
  ble.setup();
  ble.gotStepsNumber = function (number) {
    //    console.log(number);
    document.querySelector('#td_steps').innerText = document.querySelector('#p_steps').innerText = number;
    document.querySelector('#td_calories').innerText = document.querySelector('#p_calories').innerText = getCalorie(number).toFixed(1);
    document.querySelector('#td_distance').innerText = document.querySelector('#p_distance').innerText = getDistance(number).toFixed(3);
  };

  ble.gotAcc = function (_acc) {
    var distance_fft;
    var distance;
    {
      while (chart.acc.data.labels.length > 100) {
        chart.acc.data.labels.shift();
      }
      chart.acc.data.labels.push(acc_count);

      while (chart.acc.data.datasets[0].data.length > 100) {
        for (let dataset of chart.acc.data.datasets) {
          dataset.data.shift();
        }
      }
      chart.acc.data.datasets[0].data.push(_acc.x);
      chart.acc.data.datasets[1].data.push(_acc.y);
      chart.acc.data.datasets[2].data.push(_acc.z);
      distance = distance_fft = Math.sqrt(
        Math.pow(_acc.x, 2) + Math.pow(_acc.y, 2) + Math.pow(_acc.z, 2)
      );
      chart.acc.data.datasets[3].data.push(distance);
    }
    acc_count++;

    {
      while (chart.delta_acc.data.labels.length > 100) {
        chart.delta_acc.data.labels.shift();
      }
      chart.delta_acc.data.labels.push(acc_count);
      while (chart.delta_acc.data.datasets[0].data.length > 100) {
        chart.delta_acc.data.datasets[0].data.shift();
        chart.delta_acc.data.datasets[1].data.shift();
        chart.delta_acc.data.datasets[2].data.shift();
        chart.delta_acc.data.datasets[3].data.shift();
      }
      chart.delta_acc.data.datasets[0].data.push(_acc.x - acc_prev.x);
      chart.delta_acc.data.datasets[1].data.push(_acc.y - acc_prev.y);
      chart.delta_acc.data.datasets[2].data.push(_acc.z - acc_prev.z);
      let delta_distance = Math.sqrt(
        Math.pow(_acc.x - acc_prev.x, 2) +
        Math.pow(_acc.y - acc_prev.y, 2) +
        Math.pow(_acc.z - acc_prev.z, 2)
      );
      chart.delta_acc.data.datasets[3].data.push(delta_distance);

      acc_prev = _acc;
      chart.delta_acc.update();
      let activity = bufsize * average(chart.delta_acc.data.datasets[3].data);
      // get area of delta distance graph for activity monitoring
      gauge.set(activity);
      document.querySelector('#p_activity').innerText = activity.toFixed(2);
      if (activity > 1.0) {
        is_active = true;
      }
      else {
        is_active = false;
      }
    }
    // for fft and analysis
    {
      input.push(distance_fft);
      while (input.length > bufsize) {
        input.shift();
      }
      let distance_max = Math.max.apply(null, input);
      if (
        distance > distance_max * 0.85 &&
        millis() - steps_count_timestamp > 500
      ) {
        if (is_active) {
          steps++;
          steps_count_timestamp = millis();
          ble.gotStepsNumber(steps);
          let today = new Date(new Date() - timestamp.start);
          let year = today.getFullYear();
          let month = today.getMonth() + 1;
          let date = today.getDate();

          let hours = 9 - today.getHours();
          let minutes = today.getMinutes();
          let seconds = today.getSeconds();
          document.querySelector('#td_time').innerText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} `;
          saveWorkout();
        }
      }

      const data = fft.toComplexArray(input);
      fft.transform(out, data);
      let array_labels = [];
      let array_power = [];
      for (let i = 0; i < out.length / 2; i++) {
        array_labels.push(i * freq_step);
        array_power.push(out[i]);
        chart.acc.data.datasets[4].data[i] = distance_max;
      }
      chart.fft.data.labels = array_labels;
      chart.fft.data.datasets[0].data = array_power;
    }

    chart.acc.update();
    chart.fft.update();
  };

  initHistory();
}
