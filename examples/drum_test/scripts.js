let sounds = [];
let fft;
let currentWaveform = 0;
const waveformStyles = [
    "Circles", "Radial", "Spiral", "Explosion",
    "Rectangle Pulse", "Wave Peaks", "Laser Lines", "Orbit Circles",
    "Starburst", "Hexagon Grid", "Symmetrical Waves",
    "Triangle Mesh", "Waveform Bars"
];

var gamepar=0;
let threshold = 0.08;
var bles = [new Orphe(0), new Orphe(1)];

let window_size = 20;
// 各デバイスの加速度とオイラー角のデータを格納する配列を初期化
let acc_vals = bles.map(() => ({ x: [], y: [], z: [] }));
let euler_vals = bles.map(() => ({ pitch: [], roll: [], yaw: [] }));

let acc_rms = bles.map(() => ({ x: 0, y: 0, z: 0 }));
let euler_rms = bles.map(() => ({ pitch: 0, roll: 0, yaw: 0 }));

let lastGestureTime = 0;
let debounceInterval = 500; // デバウンスのためのインターバル（ミリ秒）

var connectedDevices =0;
function preload() {
    for (let i = 0; i < 17; i++) { // aからqまでの17音
        sounds[i] = loadSound(`sound/${String.fromCharCode(97 + i)}.mp3`); // 'a'.charCodeAt(0) = 97
    }
}

function setup() {
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('p5Canvas'); 
 //   canvas.style('z-index', '-1'); 
    fft = new p5.FFT();
    noLoop(); // Initially stop the loop

    frameRate(60);
    // 色の初期設定
    initColors();

    // アニメーションの速度（ランダムに設定）
    leftCycleLength = random(100, 200); // 左側の色変化周期
    rightCycleLength = random(100, 200); // 右側の色変化周期


    bles[0].setup();
    buildCoreToolkit(document.querySelector('#toolkit_placeholder1'), '01', 0, 'SENSOR_VALUES');
    bles[1].setup();
    buildCoreToolkit(document.querySelector('#toolkit_placeholder2'), '02', 1, 'SENSOR_VALUES');
    
   // ORPHE CORE Init

   bles.forEach(ble => {
    //ble.setup();
    ble.onConnect = function () {
        connectedDevices++;
        if (connectedDevices === 4) {
            gamepar = 5;
        }
    }
});
  
   rms();
   // noLoop();
}

function rms(){
    bles.forEach((ble, index) => {

        ble.gotAcc = function (_acc) {
            
            acc_vals[index].x.push(_acc.x);
            acc_vals[index].y.push(_acc.y);
            acc_vals[index].z.push(_acc.z);
            //console.log(acc_rms[index].x, acc_rms[index].y, acc_rms[index].z);
           // console.log("^^");
      
            // calculate RMS for accelerometer
            acc_rms[index].x = calculate_rms(acc_vals[index].x);
            acc_rms[index].y = calculate_rms(acc_vals[index].y);
            acc_rms[index].z = calculate_rms(acc_vals[index].z);
          };
      
          ble.gotEuler = function (_euler) {
            euler_vals[index].pitch.push(_euler.pitch);
            euler_vals[index].roll.push(_euler.roll);
            euler_vals[index].yaw.push(_euler.yaw);
      
            // calculate RMS for euler angles
            euler_rms[index].pitch = calculate_rms(euler_vals[index].pitch);
            euler_rms[index].roll = calculate_rms(euler_vals[index].roll);
            euler_rms[index].yaw = calculate_rms(euler_vals[index].yaw);
          };
      
          ble.onStartNotify = function () {
            loop();
          };
        });
}

let gesture = ""; // 現在のジェスチャー内容を保持
function soundplay() {
    let currentTime = millis();
    if (currentTime - lastGestureTime > debounceInterval) {
        for (let i = 0; i < bles.length; i++) {
            let val = 0.01;
            let valminus = -0.01; 
            if (acc_rms[i].x > threshold) {
                let latestPitch = euler_vals[i].pitch[euler_vals[i].pitch.length - 1];
                if (latestPitch < valminus) {
                    gesture = "X軸大 & ピッチ小";
                    sounds[2].play();
                    currentWaveform = floor(random(waveformStyles.length));
                } else if (latestPitch > val) {
                    gesture = "X軸大 & ピッチ大";
                    sounds[5].play();
                    currentWaveform = floor(random(waveformStyles.length));
                }
                lastGestureTime = currentTime;
            } else if(acc_rms[i].y > threshold){
                let latestRoll = euler_vals[i].roll[euler_vals[i].roll.length - 1];
                if (latestRoll  < valminus) {
                    gesture = "Y軸大 & ロール小";
                    sounds[10].play();
                    currentWaveform = floor(random(waveformStyles.length));
                } else if (latestRoll  > val) {
                    gesture = "Y軸大 & ロール大";
                    sounds[12].play();
                    currentWaveform = floor(random(waveformStyles.length));
                }
                lastGestureTime = currentTime;
            }else if(acc_rms[i].z > threshold){
                let latestYaw = euler_vals[i].yaw[euler_vals[i].yaw.length - 1];
                if (latestYaw  < valminus) {
                    gesture = "Z軸大 & ヨー小";
                    sounds[8].play();
                    currentWaveform = floor(random(waveformStyles.length));
                } else if (latestYaw  > val) {
                    gesture = "Z軸大 & ヨー大";
                    sounds[9].play();
                    currentWaveform = floor(random(waveformStyles.length));
                }
                lastGestureTime = currentTime;
            }else{
                gesture = "";
            }
        }
    }
}
// Function to calculate RMS
function calculate_rms(val_array) {
    push_and_shift_array(val_array);
    let sum_of_squares = val_array.reduce((sum, val) => sum + val * val, 0);
    return sqrt(sum_of_squares / val_array.length);
  }
  
  // Function to push new value into array and shift old value out
  function push_and_shift_array(val_array) {
    if (val_array.length > window_size) {
      val_array.shift();
    }
  }
  

function draw() {
    //console.log(connectedDevices);
    background(255); // 背景を白に設定
    BG();
    background("#1B1B1B"); // 背景を黒に設定
    let waveform = fft.waveform();
    translate(width / 2, height / 2);
    drawWaveform(waveform);

    // gesture内容をUIに反映
    let gestureElem = document.getElementById('gesture_status');
    if (gestureElem) {
        gestureElem.textContent = gesture;
    }

    switch (gamepar) {
        case 0:
            break;
        case 5:
            //console.log("start");
            soundplay();
            break;
    }
    
}

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
////////////////////音再生の処理 
function keyPressed() {
    let keyIndex = key.charCodeAt(0) - 97; // 'a'のASCIIコードは97
    if (keyIndex >= 0 && keyIndex < sounds.length) {
        playSound(keyIndex);
    }
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

function playSound(index) {
    if (sounds[index].isPlaying()) {
        sounds[index].stop();
    }
    sounds[index].play();
    currentWaveform = floor(random(waveformStyles.length)); // ランダムに波形パターンを選ぶ
    loop(); // Start looping when the music plays
}

function drawWaveform(waveform) {
    noFill();
    strokeWeight(2);
    beginShape();
    switch (currentWaveform) {
        case 0: // Circles
            for (let i = 0; i < waveform.length; i++) {
                let angle = map(i, 0, waveform.length, 0, TWO_PI);
                let radius = map(waveform[i], -1, 1, 50, 200);
                let x = radius * cos(angle);
                let y = radius * sin(angle);
                stroke(getColorFromPosition(x, y));
                ellipse(x, y, 5, 5);
            }
            break;
        case 1: // Radial
            for (let i = 0; i < waveform.length; i++) {
                let angle = map(i, 0, waveform.length, 0, TWO_PI);
                let radius = map(waveform[i], -1, 1, 50, 200);
                stroke(getColorFromPosition(radius * cos(angle), radius * sin(angle)));
                line(0, 0, radius * cos(angle), radius * sin(angle));
            }
            break;
        case 2: // Spiral
            let angleOffset = 0;
            for (let i = 0; i < waveform.length; i++) {
                let angle = map(i, 0, waveform.length, 0, TWO_PI * 2);
                let r = map(waveform[i], -1, 1, 50, 300);
                let x = r * cos(angle + angleOffset);
                let y = r * sin(angle + angleOffset);
                angleOffset += 0.05; // Enhance the spiral effect
                stroke(getColorFromPosition(x, y));
                vertex(x, y);
            }
            break;
        case 3: // Explosion
            let maxRadius = 300; // 爆発の最大半径
            for (let i = 0; i < waveform.length; i++) {
                let angle = map(i, 0, waveform.length, 0, TWO_PI);
                let speed = map(Math.abs(waveform[i]), 0, 1, 0, maxRadius);
                let x = speed * cos(angle);
                let y = speed * sin(angle);
                stroke(getColorFromPosition(x, y));
                line(0, 0, x, y); // 中心から爆発的に線を引く
            }
            break;
        case 4: // Rectangle Pulse
            let rectSize = map(Math.abs(waveform[0]), 0, 1, 10, 200);
            stroke(getColorFromPosition(0, 0));
            rect(-rectSize / 2, -rectSize / 2, rectSize, rectSize);
            break;
        case 5: // Wave Peaks
            beginShape();
            for (let i = 0; i < waveform.length; i++) {
                let x = map(i, 0, waveform.length, -width / 2, width / 2);
                let y = map(waveform[i], -1, 1, -height / 2, height / 2);
                stroke(getColorFromPosition(x, y));
                curveVertex(x, y); // Create smooth peaks
            }
            endShape();
            break;
        case 6: // Laser Lines
            strokeWeight(4); // Thicker line for visual impact
            for (let i = 0; i < waveform.length; i += 10) {
                let x = map(i, 0, waveform.length, -width / 2, width / 2);
                let y = map(waveform[i], -1, 1, -height / 2, height / 2);
                stroke(getColorFromPosition(x, y));
                line(x, 0, x, y);
            }
            strokeWeight(2); // Reset stroke weight
            break;
        case 7: // Orbit Circles
            for (let i = 0; i < waveform.length; i += 5) {
                let radius = map(waveform[i], -1, 1, 10, 200);
                noFill();
                stroke(getColorFromPosition(radius, 0));
                ellipse(0, 0, radius * 2, radius * 2);
            }
            break;
        case 8: // Starburst
            for (let i = 0; i < waveform.length; i++) {
                let angle = map(i, 0, waveform.length, 0, TWO_PI);
                let length = map(waveform[i], -1, 1, 50, 200);
                let x = length * cos(angle);
                let y = length * sin(angle);
                stroke(getColorFromPosition(x, y));
                line(0, 0, x, y);
            }
            break;
        case 9: // Hexagon Grid
            for (let i = 0; i < waveform.length; i++) {
                let x = map(i, 0, waveform.length, -width / 2, width / 2);
                let y = map(waveform[i], -1, 1, -height / 2, height / 2);
                drawHexagon(x, y, 20);
            }
            break;
        
        case 10: // Symmetrical Waves
            for (let i = 0; i < waveform.length; i++) {
                let x = map(i, 0, waveform.length, -width / 2, width / 2);
                let y = map(waveform[i], -1, 1, -height / 2, height / 2);
                stroke(getColorFromPosition(x, y));
                line(x, y, -x, y);
            }
            break;
        case 11: // Triangle Mesh
            for (let i = 0; i < waveform.length; i++) {
                let x = map(i, 0, waveform.length, -width / 2, width / 2);
                let y = map(waveform[i], -1, 1, -height / 2, height / 2);
                let nextX = map((i + 1) % waveform.length, 0, waveform.length, -width / 2, width / 2);
                let nextY = map(waveform[(i + 1) % waveform.length], -1, 1, -height / 2, height / 2);
                stroke(getColorFromPosition(x, y));
                triangle(0, 0, x, y, nextX, nextY);
            }
            break;
        
        case 12: // Waveform Bars
            for (let i = 0; i < waveform.length; i++) {
                let x = map(i, 0, waveform.length, -width / 2, width / 2);
                let y = map(waveform[i], -1, 1, -height / 2, height / 2);
                stroke(getColorFromPosition(x, y));
                rect(x, 0, width / waveform.length, y);
            }
            break;
        
       
    }
    endShape();
}

function drawHexagon(x, y, radius) {
    beginShape();
    for (let i = 0; i < 6; i++) {
        let angle = TWO_PI / 6 * i;
        let xOffset = radius * cos(angle);
        let yOffset = radius * sin(angle);
        vertex(x + xOffset, y + yOffset);
    }
    endShape(CLOSE);
}

// 色の初期設定関数
function initColors() {
    // 左側の色定義
    leftColors = [
        { r: 255, g: 0, b: 0 },    // 赤
        { r: 255, g: 255, b: 0 },  // 黄色
        { r: 255, g: 165, b: 0 },  // オレンジ
        { r: 255, g: 0, b: 0 }     // 赤 (再び)
    ];
    // 右側の色定義
    rightColors = [
        { r: 0, g: 0, b: 255 },    // 青
        { r: 0, g: 255, b: 255 },  // 水色
        { r: 128, g: 0, b: 128 },  // 紫
        { r: 0, g: 0, b: 255 }     // 青 (再び)
    ];
}

function BG() {
    let leftT = (frameCount % leftCycleLength) / leftCycleLength; // 左側の時間割合
    let rightT = (frameCount % rightCycleLength) / rightCycleLength; // 右側の時間割合

    let leftColor = getColor(leftT, leftColors);
    let rightColor = getColor(rightT, rightColors);

    for (let i = 0; i < width; i++) {
        let lerpAmount = map(i, 0, width, 0, 1);
        let gradientColor = lerpColor(leftColor, rightColor, lerpAmount);
        stroke(gradientColor);
        line(i, 0, i, height);
    }
}

function getColor(t, colors) {
    let n = colors.length - 1;
    let segment = 1 / n;
    for (let i = 0; i < n; i++) {
        if (t < segment * (i + 1)) {
            return lerpColor(color(colors[i].r, colors[i].g, colors[i].b),
                             color(colors[i + 1].r, colors[i + 1].g, colors[i + 1].b),
                             map(t, segment * i, segment * (i + 1), 0, 1));
        }
    }
    return color(colors[0].r, colors[0].g, colors[0].b); // 最初の色に戻る
}

function getColorFromPosition(x, y) {
    let lerpAmount = map(x, -width / 2, width / 2, 0, 1);
    let leftT = (frameCount % leftCycleLength) / leftCycleLength; // 左側の時間割合
    let rightT = (frameCount % rightCycleLength) / rightCycleLength; // 右側の時間割合

    let leftColor = getColor(leftT, leftColors);
    let rightColor = getColor(rightT, rightColors);
    return lerpColor(leftColor, rightColor, lerpAmount);
}