var ble = new Orphe(0);

let threshold = 0.1;
let gesture = "";

let window_size = 20;
let acc_x_vals = [];
let acc_y_vals = [];
let acc_z_vals = [];
let euler_pitch_vals = [];
let euler_roll_vals = [];
let euler_yaw_vals = [];
let acc_rms_x = 0;
let acc_rms_y = 0;
let acc_rms_z = 0;
let euler_rms_pitch = 0;
let euler_rms_roll = 0;
let euler_rms_yaw = 0;

var acc = {
  x: 0,
  y: 0,
  z: 0,
};

var euler = {
  pitch: 0,
  roll: 0,
  yaw: 0,
};

let mySound = [];
function preload() {
  soundFormats("mp3", "ogg");
  for (let i = 0; i <= 10; i++) {
    mySound[i] = loadSound(`sounds/斬撃${i}.mp3`);
  }
}

let lastGestureTime = 0;
let debounceInterval = 300; // デバウンスのためのインターバル（ミリ秒）

function setup() {
  // ORPHE CORE Init
  ble.setup();
  
  ble.gotAcc = function (_acc) {
    acc = _acc;

    // calculate RMS for accelerometer
    acc_rms_x = calculate_rms(acc.x, acc_x_vals);
    push_and_shift_array(acc_rms_x, acc_x_vals);
    acc_rms_y = calculate_rms(acc.y, acc_y_vals);
    push_and_shift_array(acc_rms_y, acc_y_vals);
    acc_rms_z = calculate_rms(acc.z, acc_z_vals);
    push_and_shift_array(acc_rms_z, acc_z_vals);
  };

  ble.gotEuler = function (_euler) {
    euler = _euler;

    // calculate RMS for euler angles
    euler_rms_pitch = calculate_rms(euler.pitch, euler_pitch_vals);
    push_and_shift_array(euler_rms_pitch, euler_pitch_vals);
    euler_rms_roll = calculate_rms(euler.roll, euler_roll_vals);
    push_and_shift_array(euler_rms_roll, euler_roll_vals);
    euler_rms_yaw = calculate_rms(euler.yaw, euler_yaw_vals);
    push_and_shift_array(euler_rms_yaw, euler_yaw_vals);
  };

  noLoop();
  ble.onStartNotify = function () {
    loop();
  };
  createCanvas(400, 400);
}

function draw() {
  background(200);

  draw_array_graph(acc_x_vals, 0, height / 8, 255, 0, 0);
  draw_array_graph(acc_y_vals, 0, height / 8, 0, 0, 255);
  draw_array_graph(acc_z_vals, 0, height / 8, 0, 255, 0);

  draw_array_graph(euler_pitch_vals, 0, height / 2, 255, 128, 0);
  draw_array_graph(euler_roll_vals, 0, height / 2, 128, 0, 255);
  draw_array_graph(euler_yaw_vals, 0, height / 2, 0, 128, 255);

  stroke(0);
  line(0, height / 2 + 50, width, height / 2 + 50);

  // check for gesture with debounce
  let currentTime = millis();
  if (currentTime - lastGestureTime > debounceInterval) {
    if (acc_rms_z > threshold) {
      if (euler.pitch < -0.07) {
        gesture = "Z axis and Pitch < -0.1";
        //if (!mySound[0].isPlaying()) mySound[0].play();
        mySound[0].play();
      } else if (euler.pitch > 0.07) {
        gesture = "Z axis and Pitch > 0.1";
        //if (!mySound[1].isPlaying()) mySound[1].play();
        mySound[1].play();
      }
      lastGestureTime = currentTime; // Update the last gesture time
    } else {
      gesture = "";
    }
  }

  //draw text
  stroke(0, 0, 0);
  textSize(20);
  text("Gesture: " + gesture, 20, 30);

  textSize(12);
  stroke(255, 0, 0);
  text("acc x : " + acc.x, 20, height / 2 - 140);
  stroke(0, 0, 255);
  text("acc y : " + acc.y, 20, height / 2 - 120);
  stroke(0, 255, 0);
  text("acc z : " + acc.z, 20, height / 2 - 100);
  stroke(255, 128, 0);
  text("pitch : " + euler.pitch, 20, height - 80);
  stroke(128, 0, 255);
  text("roll : " + euler.roll, 20, height - 60);
  stroke(0, 128, 255);
  text("yaw : " + euler.yaw, 20, height - 40);
  stroke(0);
  text("Threshold : 0.1", 20, height / 2 + 50);
}

// Function to draw graph of array values
function draw_array_graph(val_array, start_x, start_y, _r, _g, _b) {
  let x = 0;
  noFill();
  stroke(_r, _g, _b);
  beginShape();
  for (let i of val_array) {
    vertex(start_x + x * 20, start_y + 500 * i);
    x++;
  }
  endShape();
}

// Function to calculate RMS
function calculate_rms(current_val, val_array) {
  push_and_shift_array(current_val, val_array);
  let sum_of_squares = 0;
  for (let i = 0; i < val_array.length; i++) {
    sum_of_squares += val_array[i] * val_array[i];
  }
  let rms = sqrt(sum_of_squares / val_array.length);
  return rms;
}

// Function to push new value into array and shift old value out
function push_and_shift_array(current_val, val_array) {
  val_array.push(current_val);
  if (val_array.length > window_size) {
    val_array.shift();
  }
}
