let foot_print_left;
let foot_print_right;
let logo;

//for sound
//let osc, envelope;
let oscs = [];
let envelope;
let scaleArray = [67, 72, 55, 36, 67, 72, 55, 36];
let osc_volume = [0, 0, 0, 0, 0, 0, 0, 0];

//FSRの値を格納する変数
var fsr = [
  {
    left: 0,
    toe: 0,
    right: 0,
    heel: 0,
  },
  {
    left: 0,
    toe: 0,
    right: 0,
    heel: 0,
  },
];

window.onload = function () {
  // bles: defined in coreToolkit.js
  for (let ble of bles) {
    ble.setup();
    ble.onConnect = function (uuid) {
      console.log("onConnect:", uuid);
      document.querySelector(`#status${ble.id}`).innerText = "ONLINE";
      document.querySelector(`#status${ble.id}`).classList =
        "bg-primary text-white";
    };
    ble.onDisconnect = function () {
      document.querySelector(`#status${ble.id}`).innerText = "OFFLINE";
      document.querySelector(`#status${ble.id}`).classList =
        "bg-secondary text-white";
    };

    ble.gotQuat = function (quat) {
      document.querySelector(`#quatw${ble.id}`).innerText = `${
        1000.0 * quat.w.toFixed(3)
      }`;
      document.querySelector(`#quatx${ble.id}`).innerText = `${
        1000.0 * quat.x.toFixed(3)
      }`;
      document.querySelector(`#quaty${ble.id}`).innerText = `${
        1000.0 * quat.y.toFixed(3)
      }`;
      document.querySelector(`#quatz${ble.id}`).innerText = `${
        1000.0 * quat.z.toFixed(3)
      }`;
      //totalを<li>FSR TOTAL: <span id="fsr_total1"></span></li>に代入
      document.querySelector(`#fsr_total${ble.id}`).innerText = `${
        1000.0 * quat.w.toFixed(3) +
        1000.0 * quat.x.toFixed(3) +
        1000.0 * quat.y.toFixed(3) +
        1000.0 * quat.z.toFixed(3)
      }`;


      //fsrの値を格納
      fsr[ble.id].left = 1000.0 * quat.w.toFixed(3);
      fsr[ble.id].toe = 1000.0 * quat.x.toFixed(3);
      fsr[ble.id].right = 1000.0 * quat.y.toFixed(3);
      fsr[ble.id].heel = 1000.0 * quat.z.toFixed(3);
    };

    buildCoreToolkit(
      document.querySelector("#toolkit_placeholder"),
      `0${ble.id + 1}`,
      ble.id
    );
  }
  if (window.name != "ORPHE-CORE") {
    let new_win = window.open(document.URL, "ORPHE-CORE", "width=500px");
    document.querySelector("body").hidden = true;
    //noLoop();
  }
};

function setup() {
  //let canvas = createCanvas(document.querySelector('#canvas_placeholder').clientWidth, 400);
  let canvas = createCanvas(800, 640);
  canvas.parent("#canvas_placeholder");

  textAlign(CENTER, CENTER);
  foot_print_left = loadImage("foot_print_left.png");
  foot_print_right = loadImage("foot_print_right.png");
  logo = loadImage("orphe_logo_horizontal_black.png");

  // sound　8つのオシレーターを作成
  for (let i = 0; i < 8; i++) {
    oscs[i] = new p5.Oscillator("sine");
    oscs[i].start();
    oscs[i].freq(midiToFreq(scaleArray[i])); // 音階をHz(周波数)に変換
    oscs[i].amp(0.0, 0.01); //最初に音量を０に
  }
}

function midiToFreq(midiNote) {
  //MIDIノートナンバーを周波数(Hz)に変換
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

function draw() {
  background(220);

  //draw background image
  image(
    foot_print_left,
    width * 0.13,
    height * 0.0,
    (height * 1.0 * 120) / 320,
    height * 1.0
    //(width * 0.5 * 320) / 120
  );
  image(
    foot_print_right,
    width * 0.55,
    height * 0.0,
    (height * 1.0 * 120) / 320,
    height * 1.0
  );

  //FSRの値に応じて円を描く
  fill(70, 230, 230);
  for (let i = 0; i < 2; i++) {
    ellipse(
      width * 0.42 * i + width * 0.15,
      height * 0.3,
      fsr[i].left,
      fsr[i].left
    );
    ellipse(
      width * 0.38 * i + width * 0.3,
      height * 0.07,
      fsr[i].toe,
      fsr[i].toe
    );
    ellipse(
      width * 0.42 * i + width * 0.35,
      height * 0.3,
      fsr[i].right,
      fsr[i].right
    );
    ellipse(
      width * 0.38 * i + width * 0.3,
      height * 0.93,
      fsr[i].heel,
      fsr[i].heel
    );
  }

  //左右の４つのfsrの合計を計算し、それぞれの合計値に応じて長さが変わる緑から赤にグラデーションの最大20個の矩形で構成されたボリュームバーを描く
  //左のボリュームバーは左側（x:0, y:height * 0.05~ 0.95）に、右のボリュームバーは右側（x:width * 0.95, y:height * 0.05~ 0.95）に描く
  let sum = [0, 0];
  sum[0] = fsr[0].left + fsr[0].toe + fsr[0].right + fsr[0].heel;
  sum[1] = fsr[1].left + fsr[1].toe + fsr[1].right + fsr[1].heel;

  //sumの値を左端下、右端下にテキストで表示
  //fill(50);
  // text(`sum: ${sum[0]}`, width * 0.05, height * 0.95);
  // text(`sum: ${sum[1]}`, width * 0.93, height * 0.95);

  //sumの値（0~250, 250以上は250とする）に応じてバーの数が0~20個に変化するようにマッピング　
  let bar_num = [0, 0];
  bar_num[0] = map(sum[0], 0, 250, 0, 20);
  bar_num[1] = map(sum[1], 0, 250, 0, 20);

  //bar_numの値を左端下、右端下にテキストで表示
  // text(`bar_num: ${bar_num[0]}`, width * 0.05, height * 0.9);
  // text(`bar_num: ${bar_num[1]}`, width * 0.93, height * 0.9);

  let bar_height = height * 0.9 / 20;
  let bar_width = width * 0.1;

  //左にbar_num[0]、右にbar_num[1]の数だけ矩形を描く
  //一番下が緑から20個目が赤にグラデーションするようにfillする
  for (let i = 0; i < bar_num[0]; i++) {
    fill(map(i, 0, 20, 0, 255), 255 - map(i, 0, 20, 0, 255), 0);
    rect(width * 0.0, height * 0.90 - bar_height * i, bar_width, bar_height);
  }
  for (let i = 0; i < bar_num[1]; i++) {
    fill(map(i, 0, 20, 0, 255), 255 - map(i, 0, 20, 0, 255), 0);
    rect(
      width * 1.0 - bar_width,
      height * 0.90 - bar_height * i,
      bar_width,
      bar_height
    );
  }





  //FSRの値に応じて音量を変化させる
  osc_volume[0] = constrain(fsr[0].left, 0.0, 100.0) / 100.0;
  osc_volume[1] = constrain(fsr[0].toe, 0.0, 100.0) / 100.0;
  osc_volume[2] = constrain(fsr[0].right, 0.0, 100.0) / 100.0;
  osc_volume[3] = constrain(fsr[0].heel, 0.0, 100.0) / 100.0;
  osc_volume[4] = constrain(fsr[1].left, 0.0, 100.0) / 100.0;
  osc_volume[5] = constrain(fsr[1].toe, 0.0, 100.0) / 100.0;
  osc_volume[6] = constrain(fsr[1].right, 0.0, 100.0) / 100.0;
  osc_volume[7] = constrain(fsr[1].heel, 0.0, 100.0) / 100.0;

  fill(50);
  for (let i = 0; i < 8; i++) {
    //text(`volume: ${osc_volume[i]}`, width * 0.9, height * 0.1 * i + 50 );//デバッグ用　音量を表示するテキスト
    oscs[i].amp(osc_volume[i], 0.1);
  }
}
