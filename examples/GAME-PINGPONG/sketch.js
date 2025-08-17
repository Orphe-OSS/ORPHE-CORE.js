// 変数定義
let ball;
let leftPaddle, rightPaddle;
let leftScore = 0, rightScore = 0;
let maxScore = 3;
let gameStarted = false;

// 設定用変数
let ballSpeedConfig = 4;
let ballSizeConfig = 20;
let leftPaddleSizeConfig = 60;
let rightPaddleSizeConfig = 60;
let leftSensitivityConfig = 1;
let rightSensitivityConfig = 1;

let counter3 = 4; // カウントダウン開始値
let lastUpdateTime = 0; // 最後にカウンターが更新された時刻を記録する変数
let counterVisible = true; // カウンターが表示されているかどうかのフラグ

let bottoncolor = '#19191A'; // ボタンの色

let farstgame = true;
let button;
let myFont;

let bgmA,bgmB;

let p1,p2;
let orpheimg;
let invertedImage;
let paddleHitSound; // パドル衝突音用の変数
let wallHitSound; // 壁衝突音用の変数
let whistleSound; // 勝利時の音用の変数
var bgmcont1 = 0;
var bgmcont2= 0;
var imgcount = 0;
function preload() {
    myFont = loadFont('BebasNeue-Regular.ttf'); // ダウンロードしたフォントのパスに変更してください
    bgmA = loadSound('BGMA.mp3');
    bgmB = loadSound('BGMB.mp3');
    p1 = loadSound('p1.mp3');
    p2 = loadSound('p2.mp3');
    paddleHitSound = loadSound('sound-hockey1.mp3'); // パドル衝突音を読み込み
    wallHitSound = loadSound('sound-hockey2.mp3'); // 壁衝突音を読み込み
    whistleSound = loadSound('sound-whistle.mp3'); // 勝利時の音を読み込み
    orpheimg = loadImage("orpheimg.png");
}

function setup() {
    let cnv = createCanvas(windowWidth*0.8, windowHeight / 2);
    cnv.parent('p5Canvas'); // IDを指定してキャンバスを挿入
    textFont(myFont);
  ball = new Ball();
  leftPaddle = new Paddle(true); // 左側のパドル
  rightPaddle = new Paddle(false); // 右側のパドル

  leftColor = color(255, 140, 0);  // 左側の初期カラー（赤）
  rightColor = color(0, 122, 255);  // 右側の初期カラー（青）


  button = createButton('ReGame');
  Button_regame();
  button.style('display', 'none');
  bgmA.stop();
  bgmB.stop();
  bgmA.setVolume(0.1);
  bgmB.setVolume(0.1);

  frameRate(60);
   // 色の初期設定
   initColors();

   // アニメーションの速度（ランダムに設定）
   leftCycleLength = random(2000, 3000); // 左側の色変化周期
   rightCycleLength = random(2000, 3000); // 右側の色変化周期
 
}

function draw() {
  //background(255,255,255,100);
  BG();

  switch (gamestage){
    case 0://デバイスの接続待ち
    background(255,255,255,100);   
    //image(orpheimg, 40, 200,100,130); 

    //invertedImage = createGraphics(orpheimg.width, orpheimg.height);
    //invertedImage.image(orpheimg, 40, 200);

    // 画像を反転させる
    //invertedImage.filter(INVERT);
    loadGame();
        break;
    case 1://ゲーム開始
    
    background(255,255,255,0);
    BGMplay(1);
    bgmcont2 = 0;


    button.style('display', 'none');
        count3s();
        drawMiddleLine();
        displayScore();
        if(farstgame == false){
            checkStartGame_regame();
        }else{
            checkStartGame();
        }
        break;
    case 2:
        background(255,255,255,100);   

      
       
        bgmcont1 = 0;
        bgmA.stop();
        BGMplay(2);
        showWinMessage();//ゲーム終了
        farstgame = false;
        counter3 = 3;
        gameStarted = false;
        ccc = 0;
        button.style('display', 'inline-block');

        break;
    }

  if (gameStarted) {
    ball.update();
    ball.display();
    ball.checkPaddle(leftPaddle);
    ball.checkPaddle(rightPaddle);

    if (ball.scored()) {
      if (ball.x < 0) {
        //console.log('leftScore');
        ccc = 0;
        rightScore++;
        p1.play();
        gameStarted = false; // 得点後、一時停止
      //  setTimeout(startGame, 1000);
      startGame();
        
      } else if (ball.x > width) {
        ccc = 0;
        //console.log('rightScore');
        leftScore++;
        p1.play();
        gameStarted = false; // 得点後、一時停止
       // setTimeout(startGame, 1000);
        startGame();
      }
      //gameStarted = false;
      ball.reset();
      if (leftScore >= maxScore || rightScore >= maxScore) {
        whistleSound.play(); // 勝利時にホイッスル音を再生
        gamestage = 2;
      } else {
        //setTimeout(startGame, 1000);
       // p2.play();
        startGame();
      }
    }
  }

  leftPaddle.display();
  rightPaddle.display();
  leftPaddle.update(devices[0].eulers.pitch); // ORPHE COREデバイスのクォータニオンデータに基づいて更新
  rightPaddle.update(devices[1].eulers.pitch);
}

function imgshow(){
  image(orpheimg, 40, 200,100,130); 
}

function BGMplay(number){
if(bgmcont1 === 0 && number === 1){

      
  bgmB.stop();
  bgmA.loop();
  p2.play();
  bgmcont1++;
}else if (bgmcont2 === 0 && number === 2){

  bgmA.stop();
    bgmB.loop();
    p2.play();
    bgmcont2++;

}
}

function Button_regame(){
    
    button.position(width/2-20, height/2 + 300);
    button.mousePressed(regame);
    button.style('background-color', bottoncolor);  // 背景色
    button.style('color', 'white');              // 文字色
    button.style('border', 'none');              // ボーダー無し
    button.style('padding', '10px 20px');        // パディング
    button.style('text-align', 'center');        // テキストを中央揃え
    button.style('text-decoration', 'none');     // テキストデコレーション無し
    button.style('display', 'inline-block');     // 表示をインラインブロックに
    button.style('font-size', '16px');           // フォントサイズ
    button.style('margin', '4px 2px');           // マージン
    button.style('transition-duration', '0.4s'); // トランジションの時間
    button.style('cursor', 'pointer');           // カーソルをポインターに
    
}

function loadGame(){
    textAlign(CENTER, CENTER);
    textSize(80);
    fill(255);
    text("Device loading…", width / 2, height / 2);
    textAlign(CENTER, CENTER);
    textSize(20);
    textFont('Meiryo');
    fill(255,255,255,200);
    text("ORPHE COREを接続してください…", width / 2, height / 2+60);
    textFont(myFont);
}

var ccc = 0;
function startGame() {
    if(ccc === 0){
    //console.log('startgame');
    ball.reset();
  gameStarted = true;
  ccc++ ;
    }
}

// 接続デバイスが3つになったらゲームスタート
function checkStartGame() {
  if (connectedDevices === 3 && !gameStarted) {
    setTimeout(startGame, 3000); 
  }
}

function checkStartGame_regame(){
    if(gameStarted === false){
        //console.log('gamestarttime');
        setTimeout(startGame, 3000); 
    }
}

// ゲームの勝利メッセージ表示
function showWinMessage() {
  noLoop();
  textAlign(CENTER, CENTER);
  textSize(80);
  fill(255);
  if (leftScore > rightScore) {
    text("A Player Wins!", width / 2, height / 2);
  } else {
    text("B Player Wins!", width / 2, height / 2);
  }
}

// 点数表示
function displayScore() {
  fill(255);
  textSize(32);
  //textを中央ぞろえにする
    textAlign(CENTER, CENTER);
  text(`${leftScore} - ${rightScore}`, width / 2, 50);
}

// 画面中央の点線描画
function drawMiddleLine() {
  stroke(255);
  strokeWeight(2);
 // line(width / 2, 0, width / 2, height);

  // 点線のパターンを設定
  drawingContext.setLineDash([10, 10]); // [線の長さ, 空白の長さ]
  
  line(width / 2, 0, width / 2, height);
  
  // 点線のパターンをリセット
  drawingContext.setLineDash([]);
}

// パドルクラス
class Paddle {
  constructor(isLeft) {
    this.width = 10;
    this.height = isLeft ? leftPaddleSizeConfig : rightPaddleSizeConfig;
    this.x = isLeft ? 10 : width - 20;
    this.y = height / 2 - this.height / 2;
    this.speed = 10;
    this.isLeft = isLeft;
  }

  update(euler) {
    // 左右別々の設定を適用
    this.height = this.isLeft ? leftPaddleSizeConfig : rightPaddleSizeConfig;
    let sensitivity = this.isLeft ? leftSensitivityConfig : rightSensitivityConfig;
    this.y = map(euler * sensitivity, -1, 1, height - this.height, 0);
    this.y = constrain(this.y, 0, height - this.height);
  }

  display() {
    noStroke();
    fill(255);
    rect(this.x, this.y, this.width, this.height);
  }
}

// ボールクラス
class Ball {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = width / 2;
    this.y = height / 2;
    this.diameter = ballSizeConfig;
    this.xSpeed = random(ballSpeedConfig, ballSpeedConfig) * (random() > 0.5 ? 1 : -1);
    this.ySpeed = random(ballSpeedConfig, ballSpeedConfig) * (random() > 0.5 ? 1 : -1);
  }

  update() {
    this.x += this.xSpeed;
    this.y += this.ySpeed;
    // 上端または下端に当たった場合に反射
    if (this.y <= 0 || this.y >= height - this.diameter) {
      this.ySpeed *= -1; // Y軸の速度を反転させることで反射を実現
      wallHitSound.play(); // 壁に当たったときに音を再生
    }
  }

  display() {
    noStroke();
    fill(255);
    ellipse(this.x, this.y, this.diameter, this.diameter);
  }

  checkPaddle(paddle) {
    if (this.x < paddle.x + paddle.width && this.x > paddle.x &&
        this.y < paddle.y + paddle.height && this.y > paddle.y) {
      this.xSpeed *= -1;
      paddleHitSound.play(); // パドルとボールが衝突したときに音を再生
    }
  }

  scored() {
    return this.x < 0 || this.x > width;
  }
}

function count3s(){
    if (counterVisible) {
        // 現在のフレームの時刻が、最後に更新してから1秒以上経過しているかチェック
        if (millis() - lastUpdateTime >= 1000) {
          counter3--; // カウンターをデクリメント
          lastUpdateTime = millis(); // 最後に更新した時刻をリセット
        }
    
        if (counter3 >= 0) {
            fill(255); // テキストの色を設定
            textSize(100); // テキストのサイズを設定
            textAlign(CENTER, CENTER); // テキストの揃え位置を設定
          text(counter3, width / 2, height / 2); // カウンターの値を画面中央に表示
        } else {
          // カウンターが0になった1秒後に表示を消す
          if (millis() - lastUpdateTime >= 1000) {
            counterVisible = false; // カウンターを非表示にする
          }
        }
      }
}

function regame(){
    //console.log('ボタンがクリックされました');
    loop();
    gamestage = 1;
    leftScore = 0;
    rightScore = 0;
    counterVisible = true;
    counter3 = 3;
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
function BG(){
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

      noStroke();
      // 半透明の白色を設定
      fill(255, 255, 255, 30);
      textSize(550);
      textAlign(CENTER, CENTER);
      noStroke();
      // 左半分に文字「A」を描写
      text("A", width / 4, height / 2-60);
      
      // 右半分に文字「B」を描写
      text("B", width * 3 / 4, height / 2-60);
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

// 設定更新用の関数
function updateBallSpeed(speed) {
  ballSpeedConfig = speed;
}

function updateBallSize(size) {
  ballSizeConfig = size;
  if (ball) ball.diameter = size;
}

function updateLeftPaddleSize(size) {
  leftPaddleSizeConfig = size;
  if (leftPaddle) leftPaddle.height = size;
}

function updateRightPaddleSize(size) {
  rightPaddleSizeConfig = size;
  if (rightPaddle) rightPaddle.height = size;
}

function updateLeftSensitivity(sensitivity) {
  leftSensitivityConfig = sensitivity;
}

function updateRightSensitivity(sensitivity) {
  rightSensitivityConfig = sensitivity;
}