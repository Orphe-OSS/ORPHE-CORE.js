// 変数の初期化
let lines = [];
let bubbles = [];
let colors = ['#000032', '#0052a2', '#009fcd', '#71d7eb', '#bbecf6', '#ffe8c9', '#ffa700'];
let totalmov = 0.0;
const numLines = 5;
//let gamepar;
let lizms = 1;
let count = 0;

// 音声関連の変数
let osc1, osc2, osc3, osc4, osc5, noise, envelope1, envelope2, envelope3, envelope4, envelope5, envelopeNoise, fft;
let melodyArray = [72, 74, 76, 77, 79, 81, 83, 84];
let melodyNote = 0;
let isPlaying = false;
let rhythmSlider;
let soundEffect; // 効果音を格納する変数
let soundPlayed = false; // 音が既に再生されたかを追跡するフラグ

let soundFiles = [];
let currentSound = 0;
let playInterval;
let timeoutId; 

function preload() {
  // 効果音ファイルをプリロードする
  soundEffect = loadSound('pipi.wav');
  soundEffect.setVolume(0.1);

    // 効果音ファイルをプリロードする
    for (let i = 0; i < 8; i++) {
      soundFiles.push(loadSound(`music/${i}.wav`));
      soundFiles[i].setVolume(0.2);
    }
}



class DriftingLine {
  constructor() {
    this.resetLine();
  }

  resetLine() {
    this.x = random(width);
    this.color = random(colors);
    this.thickness = random(10, 100);
    this.lineLength = map(totalmov, 0.01, 5, 1000, 5000);
    this.y = height + this.lineLength;
    this.frequency = random(0.001, 0.01);
    this.phase = random(TWO_PI);
    this.baseSpeed = random(4, 10);
    this.baseAmplitude = random(10, 50);
  }

  update() {

    
    //totalmov = totalMovement * 0.001;
    if (totalMovement === 0){
        totalmov = 0;
    }else{
        totalmov = totalMovement * 0.03;
    }
    
    this.phase += totalmov;
    this.speed = map(totalmov, 0.01, 1, this.baseSpeed, this.baseSpeed * 2);
    this.y -= this.speed;
    this.amplitude = 1//map(totalmov, 0.1, 1, this.baseAmplitude, this.baseAmplitude * 0.5);

    
    if (this.y + this.lineLength < 0 || this.y > height + this.lineLength) {
      this.resetLine(); // 線が画面の範囲外に移動したときにリセット
    }
    
  }

  display() {
    stroke(red(this.color), green(this.color), blue(this.color), 200);
    strokeWeight(this.thickness);
    noFill();
    beginShape();
    for (let y = this.y; y > this.y - this.lineLength; y -= 5) {
      let sway = this.amplitude * sin(this.frequency * (this.y - y) + this.phase);
      let x = this.x + sway;
      if (y < height && y > 0) {
        vertex(x, y);
      }
    }
    endShape();
  }
}
class Bubble {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.color = random(colors);
    this.xOff = 0;
  }

  move() {
    this.y -= 3;
    this.xOff += random(-0.1, 0.1);
    this.x += sin(this.xOff) * 2;
  }

  display() {
    noStroke();
    fill(this.color);
    ellipse(this.x, this.y, this.r * 2);
  }
}

function setup() {


  isPlaying = false;
  melodyNote = 0;
 // フォントの設定
 textFont("ヒラギノ角ゴシック"); // 使用するフォントを指定
 textStyle(BOLD); // テキストスタイルを太字に設定
 textSize(32); // フォントサイズの設定
 textAlign(CENTER, CENTER); // テキストを中央揃えに設定



  if (totalMovement === 0){
      totalmov = 0;
  }
setInterval(() => {
  //console.log(totalmov);
}, 300);

let cnv = createCanvas(windowWidth, windowHeight / 2);
cnv.parent('p5Canvas'); // IDを指定してキャンバスを挿入

// createCanvas(windowWidth, windowHeight / 2);
noFill();
strokeCap(ROUND);
frameRate(60);
for (let i = 0; i < numLines; i++) {
  lines.push(new DriftingLine());
}

//totalmov = 0.05;

setInterval(() => {
 // totalmov = ltm; // 0.5秒ごとにtotalmovをランダムに更新
}, 500);

 // ボタンの作成
 button = createButton('');
 button.position(windowWidth / 2-50, height / 2 - button.height / 2 + 300);
 button.mousePressed(onButtonClicked);
 styleButton(button);
 button.hide();  // 初期状態ではボタンを隠す

}
function styleButton(btn) {
  btn.style('background-color', '#FF6347');
  btn.style('color', 'white');
  btn.style('padding', '10px 20px');
  btn.style('border', 'none');
  btn.style('border-radius', '10px');
  btn.style('font-size', '20px');
}
function adjustLineCount(desiredLines) {

  /*
  if (totalmov === 0) {
    desiredLines = 0.001;
   
  }
  */
  
  if(storeg === 0){
      while (lines.length < desiredLines) {
    
          lines.push(new DriftingLine());
        }
    }else{
            
 
    lines.pop();
  }
}
function onButtonClicked() {
  
  //
  //console.log(`ボタンがクリックされました: ${gamepar}`);
  if(gamepar ===5){
    startGame();
   
   

  }else if(gamepar === 2){

    startGame();

   
    //console.log("startGame2");
  }


}
function draw() {
  //playMusic();
  if (totalMovement === 0.00){
    totalmov = 0;
}

  background(255);

  if (isPlaying) {
    //playMusic();
    //drawSpectrum();
  }
  
  //line
  if(totalmov != 0.000){
    let desiredLines = floor(map(totalmov, 0.01, 10, 5, 200));
    //console.log(desiredLines);
  adjustLineCount(desiredLines);
}else{
    let desiredLines = 0.001
    //console.log(desiredLines);
  adjustLineCount(desiredLines);
}
  
  for (let i = lines.length - 1; i >= 0; i--) {
    lines[i].update();
    lines[i].display();
  }
  if (random(1) < 0.1) {
    let r = random(1, 10);
    let b = new Bubble(random(width), height + r, r);
    bubbles.push(b);
  }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    bubbles[i].move();
    bubbles[i].display();
    if (bubbles[i].y < -50) {
      bubbles.splice(i, 1);
    }
  }


  
      if(totalmov != 0.000){
          let desiredLines = floor(map(totalmov, 0.01, 10, 5, 200));
          adjustLineCount(desiredLines);
      } else {
          let desiredLines = 0.001;
          adjustLineCount(desiredLines);
      }
      
      for (let i = lines.length - 1; i >= 0; i--) {
          lines[i].update();
          lines[i].display();
      }
  
      if (random(1) < 0.1) {
          let r = random(1, 10);
          let b = new Bubble(random(width), height + r, r);
          bubbles.push(b);
      }
  
      for (let i = bubbles.length - 1; i >= 0; i--) {
          bubbles[i].move();
          bubbles[i].display();
          if (bubbles[i].y < -50) {
              bubbles.splice(i, 1);
          }
      }

      
    //ボタン
   
      switch (gamepar) {
        case 0:
          
          button.hide();

          soundPlayed = false;

          break;
        case 5:
          
        
        soundPlayed = false;


          button.html('START');
          button.show();
          break;
        case 1:
          count = 0
          
          if (!soundPlayed) { // 音がまだ再生されていない場合
            soundEffect.play();
            playMusic();
            soundPlayed = true; // 音を再生したのでフラグを更新
          
          } 

          button.hide();
          break;
          //break;
        case 2:
         
          if(count === 0){
          //  console.log("^^");
          stopPlaying()
            soundEffect.play();
            soundPlayed = false;
            count+=1;
          }
        
        
          button.html('RETRY');
          button.show();
          break;
      }





      //text


  
      // メッセージ表示の処理
      textAlign(CENTER, CENTER); // テキストを中央揃えに設定
      textSize(32); // フォントサイズの設定
      // gameparの値に応じて異なるメッセージを表示
  fill(0); // フォントカラーの設定
  if (typeof gamepar !== 'undefined') { // gameparが定義されているかチェック
    if (gamepar === 0) {




      textSize(32); // フォントサイズ
      fill(0, 0, 0); // フォントカラー（青）
      text('デバイスの接続を待っています', width / 2, height / 2);///-20);

      textSize(20); // フォントサイズ
      fill(0, 0, 0,200); // フォントカラー（青）
      text('Waiting for device connection', width / 2, height / 2 +40);
      
     // text('もうしばらくお待ちください',  width / 2, height / 2 );//+ 20);
     
    } else if (gamepar === 1) {
      textSize(32); // フォントサイズ
      fill(0, 0, 0); // フォントカラー（青）
      text('計測中', width / 2, height / 2-40);

      textSize(20); // フォントサイズ
      fill(0, 0, 0,200); // フォントカラー（青）
      text('Measuring', width / 2, height / 2-15);

      textSize(32); // フォントサイズ
      fill(0, 0, 0); // フォントカラー（青）
      text("バタバタ値:"+totalMovement.toFixed(2), width / 2, height / 2+30);
      textSize(20); // フォントサイズ
      fill(0, 0, 0,200); // フォントカラー（青）
      text("Fluctuation value:"+totalMovement.toFixed(2), width / 2, height / 2 +55);
      
      textSize(50); // フォントサイズ
      fill(122,208,238,100); // フォントカラー（青）
      text(timer_num, width - 180,  50);
 


    } else if (gamepar === 2) {
      textSize(32); // フォントサイズ
      fill(0, 0, 0); // フォントカラー（青）
      text('結果：'+totalMovement.toFixed(2), width / 2, height / 2);
      textSize(20); // フォントサイズ
      fill(0, 0, 0,200); // フォントカラー（青）
      text('Results：'+totalMovement.toFixed(2), width / 2, height / 2 +40);

//  

      textSize(200); // フォントサイズ
      fill(252,29,71,100); // フォントカラー（青）
      text(score_ABCD, width - 100,  100);

    }else if (gamepar === 5) {
      textSize(32); // フォントサイズ
      fill(0, 0, 0); // フォントカラー（青）
      text('接続されました', width / 2, height / 2);///-20);
      textSize(20); // フォントサイズ
      fill(0, 0, 0,200); // フォントカラー（青）
      text('Connected', width / 2, height / 2 +40);
  }

}

if(Math.round(totalMovement) < 180){
if((mapValue(Math.round(totalMovement))) < 2){
  lizms = 1;
}else if((mapValue(Math.round(totalMovement))) < 6){
lizms = ((mapValue(Math.round(totalMovement))));
}else{
  lizms = 5;
}
}else{
  lizms = 5;
}

//console.log(lizms);


}


function mapValue(n) {
  // 最小値と最大値の設定
  const minInput = 1;
  const maxInput = 200;
  const minOutput = 1;
  const maxOutput = 6;

  
  // nを0~1の範囲に正規化
  const normalized = (n - minInput) / (maxInput - minInput);

  // 正規化された値を1~6の範囲に変換
  const mappedValue = normalized * (maxOutput - minOutput) + minOutput;

  // 結果を整数に丸めて返す
  return Math.round(mappedValue);
  
}
currentSound = 0; 
// 音楽の再生
function playMusic() {  
  clearInterval(playInterval);  // 既存のインターバルをクリア
  
    playSound();  // 再生開始

}
function playSound() {
  if (currentSound < soundFiles.length) {

    
    /*
    soundFiles[currentSound].addEventListener('canplay', function() {
      this.play();
    });
    */
    soundFiles[currentSound].play();

    
    //soundFiles[currentSound].play();
    currentSound++;

    // lizmsの現在の値に基づいて次のサウンドの再生間隔を設定
    let playRate = map(lizms, 1, 6, 500, 10);
    timeoutId = setTimeout(playSound, playRate);
    // setTimeoutを使って次のサウンドの再生をスケジュール
    //setTimeout(playSound, playRate);
  }else{
    currentSound =0;
    playSound();
  }
}

function stopPlaying() {
  clearTimeout(timeoutId);  // タイマーを停止
  currentSound = 0;  // 現在のサウンド位置をリセット（任意）
}
//****************************************** */
