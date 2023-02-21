var last_modified = `
last modified: 2023/02/22 00:16:19
`;
last_modified.trim('\n');
var bufsize = 128;
var fft_bufsize = 1024;
var fft = new FFTJS(fft_bufsize);
var fft_input = new Array(fft_bufsize);
var sampling_rate = 50;
var freq_step = sampling_rate / fft_bufsize;
var out = fft.createComplexArray();

//var ble = new Orphe(0);

var is_active = false;
var chart;
var gauge;
var delta_distances = []
var acc_distances = []
var accs = [];
var activity_previous = 0;

async function saveWorkout(time_now) {
  let user = getParam('user');
  if (user == null) user = '';
  let key = `${user}_air_walker`;

  let steps = document.querySelector('#td_steps').innerText;
  let calories = document.querySelector('#td_calories').innerText;
  let distance = document.querySelector('#td_distance').innerText;
  let time = time_now;
  let date = document.querySelector('#td_date').innerText;
  document.querySelector('#td_date').setAttribute('value', time_now);
  var data = {
    [date]: {
      steps: steps,
      calories: calories,
      distance: distance,
      time: time_now
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

    // dateが同じものがあれば数値を加算
    // そうでなければ既存に追加
    saved_data[date] = data[date];

    //console.log('saved_data', saved_data);
    let json = JSON.stringify(saved_data);
    localStorage.setItem(key, json);
  }
}

function loadHistory() {
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
      //console.log(saved_data[key]);
      let tbody = document.querySelector('#tbody_history');
      let tr = document.createElement('tr');
      tbody.appendChild(tr);
      let td = document.createElement('td');
      td.innerText = key;
      tr.appendChild(td);
      let td_steps = document.createElement('td');
      td_steps.classList = 'td-workout';
      td_steps.innerText = saved_data[key].steps;
      tr.appendChild(td_steps);
      let td_calories = document.createElement('td');
      td_calories.classList = 'td-workout';
      td_calories.innerText = saved_data[key].calories;
      tr.appendChild(td_calories);
      let td_distance = document.createElement('td');
      td_distance.classList = 'td-workout';
      td_distance.innerText = saved_data[key].distance;
      tr.appendChild(td_distance);
      let td_time = document.createElement('td');
      td_time.classList = 'td-workout';

      let time_now = new Date(saved_data[key].time);
      let hours = parseInt((time_now / (1000 * 60 * 60)) % 24);
      let minutes = parseInt((time_now / (1000 * 60)) % 60);
      let seconds = parseInt((time_now / 1000) % 60)
      let t_str = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} `;
      td_time.innerText = t_str;

      tr.appendChild(td_time);

      // 今日と同じ日付があれば今日の分のテーブルを更新する
      if (document.querySelector('#td_date').innerText === key) {
        document.querySelector('#td_steps').innerText = steps = saved_data[key].steps;
        document.querySelector('#p_steps').innerText = saved_data[key].steps;

        document.querySelector('#td_calories').innerText = saved_data[key].calories;
        document.querySelector('#p_calories').innerText = saved_data[key].calories;

        document.querySelector('#td_distance').innerText = saved_data[key].distance;
        document.querySelector('#p_distance').innerText = saved_data[key].distance;

        timestamp.offset = parseInt(saved_data[key].time);
        let time_now = timestamp.getElapsedTime();;
        let hours = parseInt((time_now / (1000 * 60 * 60)) % 24);
        let minutes = parseInt((time_now / (1000 * 60)) % 60);
        let seconds = parseInt((time_now / 1000) % 60)
        document.querySelector('#td_time').innerText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} `;
      }
    }
  }
}

function resetParameters(dom_id, value) {
  document.querySelector(dom_id).value = value;
  saveParameters();
}
function saveParameters() {
  let user = getParam('user');
  if (user == null) user = '';
  let key = `${user}_air_walker_params`;
  let save_data = {
    threshold: document.querySelector('#threshold').value,
    interval: document.querySelector('#interval').value,
    cal_per_step: document.querySelector('#cal_per_step').value,
    km_per_step: document.querySelector('#km_per_step').value
  }
  let json = JSON.stringify(save_data);
  localStorage.setItem(key, json);
}
function loadParameters() {
  let user = getParam('user');
  if (user == null) user = '';
  let key = `${user}_air_walker_params`;

  if (localStorage.getItem(key)) {
    let loaded_data = JSON.parse(localStorage.getItem(key));
    document.querySelector('#threshold').value = loaded_data.threshold;
    document.querySelector('#interval').value = loaded_data.interval;
    document.querySelector('#cal_per_step').value = loaded_data.cal_per_step;
    document.querySelector('#km_per_step').value = loaded_data.km_per_step;
  }

}


function getCalorie(steps) {
  // 5677, 811
  //let cal_per_step = 811 / 5677;
  let cal_per_step = document.querySelector('#cal_per_step').value;
  return cal_per_step * steps;
}
function getDistance(steps) {
  // 5752, 20.5
  //let dist_per_step = 20.5 / 5752;
  let dist_per_step = document.querySelector('#km_per_step').value;
  return dist_per_step * steps;
}

function buildElement(name_tag, innerHTML, str_class, str_style, element_appended) {
  let element = document.createElement(name_tag);
  element.innerHTML = innerHTML;
  element.classList = str_class;
  if (str_style != '') {
    element.setAttribute('style', str_style);
  }
  element_appended.appendChild(element);
  return element;
}

var acc_count = 0;
var acc_prev = {
  x: 0,
  y: 0,
  z: 0,
};
var steps = 0;
var steps_count_timestamp = 0;
window.onload = function () {
  document.querySelector('#last_modified').innerHTML = last_modified;
  let target = document.getElementById('gauge'); // your canvas element
  gauge = new Gauge(target).setOptions(opts); // create sexy gauge!
  gauge.maxValue = 10.0; // set max gauge value
  //gauge.limitMax = 5;
  gauge.setMinValue(0);  // Prefer setter over gauge.minValue = 0
  gauge.animationSpeed = 1; // set animation speed (32 is default value)
  gauge.set(0); // set actual value

  // chart = {
  //   acc: new Chart(document.getElementById("chart_acc"), config.acc),
  //   delta_acc: new Chart(
  //     document.getElementById("chart_delta_acc"),
  //     config.delta_acc
  //   ),
  //   fft: new Chart(document.getElementById("chart_fft"), config.fft),
  // };


  let ble = bles[0];
  // ORPHE CORE Init
  ble.setup();
  ble.onConnect = function () {
    timestamp.start = Date.now();
  }
  ble.onDisconnect = function () {
    timestamp.end = Date.now();
    alert('ORHPE COREとの接続が切れました。接続し直してください。')
    location.reload();
  }
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
      // while (chart.acc.data.labels.length > 100) {
      //   chart.acc.data.labels.shift();
      // }
      // chart.acc.data.labels.push(acc_count);

      // while (chart.acc.data.datasets[0].data.length > 100) {
      //   for (let dataset of chart.acc.data.datasets) {
      //     dataset.data.shift();
      //   }
      // }
      // chart.acc.data.datasets[0].data.push(_acc.x);
      // chart.acc.data.datasets[1].data.push(_acc.y);
      // chart.acc.data.datasets[2].data.push(_acc.z);
      // distance = distance_fft = Math.sqrt(
      //   Math.pow(_acc.x, 2) + Math.pow(_acc.y, 2) + Math.pow(_acc.z, 2)
      // );
      // chart.acc.data.datasets[3].data.push(distance);

      accs.push(_acc);
      while (accs.length > 100) {
        accs.shift();
      }
      distance = Math.sqrt(
        Math.pow(_acc.x, 2) + Math.pow(_acc.y, 2) + Math.pow(_acc.z, 2)
      );
      acc_distances.push(distance);
      while (acc_distances.length > 100) {
        acc_distances.shift();
      }

      let distance_max = Math.max.apply(null, acc_distances);
      let threshold = document.querySelector('#threshold').value / 100;
      let interval = document.querySelector('#interval').value;
      // for (let i = 0; i < bufsize; i++) {
      //   chart.acc.data.datasets[4].data[i] = distance_max;
      // }

      if (
        distance > distance_max * threshold &&
        timestamp.getElapsedTime() - steps_count_timestamp > interval
      ) {
        if (is_active) {
          steps++;
          steps_count_timestamp = timestamp.getElapsedTime();
          ble.gotStepsNumber(steps);

          let time_now = timestamp.getElapsedTime();;
          let hours = parseInt((time_now / (1000 * 60 * 60)) % 24);
          let minutes = parseInt((time_now / (1000 * 60)) % 60);
          let seconds = parseInt((time_now / 1000) % 60)
          //console.log("steps", hours, minutes, seconds);
          // Workout テーブルの更新
          document.querySelector('#td_time').innerText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} `;
          saveWorkout(time_now);
        }
      }
    }
    acc_count++;

    {
      // while (chart.delta_acc.data.labels.length > bufsize) {
      //   chart.delta_acc.data.labels.shift();
      // }
      // chart.delta_acc.data.labels.push(acc_count);
      // while (chart.delta_acc.data.datasets[0].data.length > bufsize) {
      //   chart.delta_acc.data.datasets[0].data.shift();
      //   chart.delta_acc.data.datasets[1].data.shift();
      //   chart.delta_acc.data.datasets[2].data.shift();
      //   chart.delta_acc.data.datasets[3].data.shift();
      // }
      // chart.delta_acc.data.datasets[0].data.push(_acc.x - acc_prev.x);
      // chart.delta_acc.data.datasets[1].data.push(_acc.y - acc_prev.y);
      // chart.delta_acc.data.datasets[2].data.push(_acc.z - acc_prev.z);
      // let delta_distance = Math.sqrt(
      //   Math.pow(_acc.x - acc_prev.x, 2) +
      //   Math.pow(_acc.y - acc_prev.y, 2) +
      //   Math.pow(_acc.z - acc_prev.z, 2)
      // );
      // chart.delta_acc.data.datasets[3].data.push(delta_distance);


      // chart.delta_acc.update();
      // let activity = bufsize * average(chart.delta_acc.data.datasets[3].data);
      // get area of delta distance graph for activity monitoring

      delta_distances.push(
        Math.sqrt(
          Math.pow(_acc.x - acc_prev.x, 2) +
          Math.pow(_acc.y - acc_prev.y, 2) +
          Math.pow(_acc.z - acc_prev.z, 2))
      );

      while (delta_distances.length > bufsize) delta_distances.shift();

      let activity = bufsize * average(delta_distances);
      gauge.set(activity);
      document.querySelector('#p_activity').innerText = activity.toFixed(2);
      if (activity > 1.0) {
        is_active = true;
      }
      else {
        is_active = false;
      }

      acc_prev = _acc;

    }
    // for fft and analysis
    {
      // fft_input.push(distance_fft);
      // while (fft_input.length > fft_bufsize) {
      //   fft_input.shift();
      // }
      // let distance_max = Math.max.apply(null, fft_input);
      // let threshold = document.querySelector('#threshold').value / 100;
      // let interval = document.querySelector('#interval').value;
      // if (
      //   distance > distance_max * threshold &&
      //   timestamp.getElapsedTime() - steps_count_timestamp > interval
      // ) {
      //   if (is_active) {
      //     steps++;
      //     steps_count_timestamp = timestamp.getElapsedTime();
      //     ble.gotStepsNumber(steps);

      //     let time_now = timestamp.getElapsedTime();;
      //     let hours = parseInt((time_now / (1000 * 60 * 60)) % 24);
      //     let minutes = parseInt((time_now / (1000 * 60)) % 60);
      //     let seconds = parseInt((time_now / 1000) % 60)
      //     //console.log("steps", hours, minutes, seconds);
      //     // Workout テーブルの更新
      //     document.querySelector('#td_time').innerText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} `;
      //     saveWorkout(time_now);
      //   }
      // }

      // const data = fft.toComplexArray(fft_input);
      // fft.transform(out, data);
      // let array_labels = [];
      // let array_power = [];
      // for (let i = 0; i < out.length / 2; i++) {
      //   array_labels.push((i * freq_step).toFixed(2));
      //   array_power.push(out[i]);

      // }
      // chart.fft.data.labels = array_labels;
      // chart.fft.data.datasets[0].data = array_power;
    }

    // chart.acc.update();
    // chart.fft.update();
  };

  loadHistory();
  loadParameters();
  buildCoreToolkit(document.querySelector('#CoreToolkit_placeholder'), '01', 0, 'RAW');
}
