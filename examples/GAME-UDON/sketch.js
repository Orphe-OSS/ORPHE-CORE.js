//gamepar ===0 接続を待っています
//gamepar ===1  導入アニメーション
//gamepar ===2
//gamepar ===3  ゲーム中１ 
//gamepar ===4 
//gamepar ===5 接続されました
//gamepar ===10 結果・リトライ

//問題　gameparが10の時にRETRYをクリックしても一度”１”と返しその後すぐ”10”に戻る
//何度かクリックすればretryになる
let startTime;
let actionDone = false;

var hairiSetTime = 5000;
var count = 0;

let controlPoints = [];
const numPoints = 32; // コントロールポイントの数
let center;
let baseRadius = 50;
let radius;
let deformations = [];
let maxDeformation = 30; // 最大の変形量
let deformationSpeed = 0.03; // 変形の速度
var doughColor; // パン生地の色を格納する変数
var MaxStap = 30;

var asiimg,udonimg;

let st;
let timeLimit = 30; // 制限時間を30秒に設定

var sc = 0;

//待機中
let x = 0;          // オブジェクトの初期X座標
let y;              // オブジェクトのY座標
let velocity = 0;   // 速度
let gravity = 0.3;  // 重力（よりゆっくり）
let lift = -3;     // 上昇力（少し小さく）
let rradius = 40;    // 半径を大きく
let resting = false;
let restTime = 0;   // 休憩時間のカウント

let trail = [];     // 軌跡を保存する配列

//setteing ok
let noodles = []; // 麺を格納する配列
let noodleCount = 10; // 麺の数
let noodleWidth = 40; // 麺の太さ
let cornerRadius = 8; // 角の丸み


var pipisound;
var punisound;

let soundA;
let soundB;
function preload() {
  asiimg = loadImage('asi.png'); 
  udonimg = loadImage('udon.png');  // 画像を読み込む


  pipisound = loadSound('pipi.wav'); 
  punisound = loadSound('puni.wav'); 


  
    soundA = loadSound('soundA.mp3');
    soundB = loadSound('soundB.mp3');



}

let yBase=-80;  // 基準となるY座標
let angle = 0;  // 角度

let yyBase=-70;  // 基準となるY座標
let aangle = 0;  // 角度


let soundcount1,soundcount2;

function setup() {


    let cnv = createCanvas(600, 350);
    cnv.parent('p5Canvas'); // IDを指定してキャンバスを挿入

    textFont("ヒラギノ角ゴシック"); // 使用するフォントを指定
    textStyle(BOLD); // テキストスタイルを太字に設定
    textSize(32); // フォントサイズの設定
    textAlign(CENTER, CENTER); // テキストを中央揃えに設定

    button = createButton('');
    button.position(windowWidth / 2+10, height / 2 - button.height / 2 + 300);
    button.mousePressed(onButtonClicked);
    styleButton(button);
    button.hide();  // 初期状態ではボタンを隠す
    startTime = millis();

    center = createVector(width / 2, height / 2);
    doughColor = color(235,235,235); // パン生地の色を初期設定
    y = height - 40;  // オブジェクトの初期Y座標（地面から少し浮いた位置）

    let spacing = width / noodleCount;
    for (let i = 0; i < noodleCount; i++) {
      let x = spacing / 2 + spacing * i;
      let growthSpeed = random(0.5, 5.0); // 伸びる速度をランダムに設定
      noodles.push(new Noodle(x, -50, 0, growthSpeed)); // 発生位置を少し上に設定
    }

    
  pipisound.setVolume(0.3); // 音量を設定
  punisound.setVolume(0.1); // 音量を設定
  soundA.setVolume(0.1); // 音量を設定
  soundB.setVolume(0.1); // 音量を設定
}
  
  var barW,barH;
  function draw() {


    



    background(225,92,58);
  //  console.log(gamepar);
     elapsedTime = millis() - startTime;
   // console.log(totalstep);
     //ゲームの進捗について  
    switch (gamepar) {
    case 0:
        textSize(32); // フォントサイズ
        fill(28, 28, 28); // フォントカラー（青）
        text('デバイスの接続を待っています', width / 2, height / 2);///-20);

        textSize(20); // フォントサイズ
        fill(28, 28, 28,200); // フォントカラー（青）
        text('Waiting for device connection', width / 2, height / 2 +40);
      
        Taiki();
        button.hide();
// button.position(windowWidth / 2+10, height / 2 - button.height / 2 + 300);

//************************************************/



        
        //image(udonimg, 30,30,100,100);


        break;
    case 5:
        Settingok();

        textSize(32); // フォントサイズ
        fill(28, 28, 28); // フォントカラー（青）
        text('接続されました', width / 2, height / 2);///-20);
        textSize(20); // フォントサイズ
        fill(28, 28, 28); // フォントカラー（青）
        text('Connected', width / 2, height / 2 +40);

        button.position(270, height / 2 - button.height / 2 + 350);
        button.html('START');
        button.show();

        



        break;
    case 2:
        //********************ここでtotalstep初期化***/
        totalstep = 0;
        soundcount1 = 0;
        soundcount2 = 0;
        //******************************************/
        hairi()
        sc = 0;



        push();
 // 四角形の色を設定
 noStroke();
 fill(235, 235, 235);

 // 回転の中心をキャンバスの右端に移動
 translate(width,60);
 // 四角形を斜めに回転
 rotate(PI / 2.06); // PI / 4 は45度
 // 四角形を描画（中心がtranslateで指定した点に来るように配置）
 rect(-50, -50, 300, 700); // 四角形のサイズを100x100に設定
 pop(); // 保存した設定を復元


  // 四角形の色を設定


//*****************************************  */
        // 現在のフレーム番号に基づいて高さを計算
let compression = 10 * sin(frameCount * 0.05); // 圧縮量
let currentHeight = 90 - compression; // 現在の高さ

//枠線を追加
stroke(0);
strokeWeight(7);
fill(235, 235, 235);
// 四角形のy座標を変更して、上側が圧縮されるように描画
rect(width - 200, height - 140 + compression, 200, currentHeight, 50);

        
                push();
                let y = yBase + sin(angle) * 5;  // sin関数を使ってY座標を計算
                image(asiimg, 400, y,150,300);
                angle += 0.05;  // 角度を徐々に増加させる
                pop();
        
                push();
                let yy = yyBase + sin(-aangle) * 5;  // sin関数を使ってY座標を計算
                image(asiimg, 450, yy,150,300);
                aangle += 0.05;  // 角度を徐々に増加させる
                pop();
        

 
  //枠線を追加
  noStroke();
  textAlign(LEFT);
  textSize(30); // フォントサイズ
  fill(28, 28, 28); // フォントカラー（青）
  text('うどん作りは職人技!!\n\n\n\n\n', 50, height / 2+10);///-20);
 
  textSize(18); // フォントサイズ
  fill(28, 28, 28,200); 
  text('Making udon is a true craft!\n\n\n\n\n\n', 55, height / 2+12);///-20);
 
  textSize(25); // フォントサイズ
  fill(28, 28, 28); // フォントカラー（青）
  text('\n\nなるべく早くふみふみして\n生地をもちもちにしよう！', 50, height / 2);///-20);
  textSize(18); // フォントサイズ
  fill(28, 28, 28,200); 
  text('\n\n\n\n\n\nTry to knead as quickly as possible\n to make the dough chewy!', 55, height / 2+17);///-20);



 
  textAlign(CENTER);

  textSize(15); // フォントサイズ
fill(28, 28, 28); // フォントカラー（青）
text('LOADING...', 70, 30);///-20);

        button.hide();

        break;
    case 1:
        gamepar = 2;
        button.hide();

    break;

    case 3:
        
    

if (soundcount1 === 0){
  pipisound.play();
soundcount1++;
}
        gameStart();
        motimoti();
        button.hide();

        
        fill(doughColor);
        UDON();

        /*
        textSize(32); // フォントサイズ
        fill(0, 0, 0); // フォントカラー（青）
        text(totalstep, width / 2, height / 2);///-20);
*/
       // button.hide();


    
         // 進捗バーの背景を描画
         fill(46,111,183,80); // 背景色（薄いグレー）
         noStroke(); // 枠線なし
         rect(barW, barH, 300, 20, 10); // 角丸の背景バー

        // 実際の進捗バーを描画
        barW = 120;
        barH = 21;
        let progressWidth = map(totalstep, 0, MaxStap, 0, 300); // 進捗バーの幅を計算
        fill(46,111,183); // 進捗バーの色を設定（青色）
        rect(barW, barH, progressWidth, 20, 10); // 角丸の進捗バー

        textSize(15); // フォントサイズ
        fill(28, 28, 28); // フォントカラー（青）
        text('もちもち度', 70, 30);///-20);

        
        let elapsedTime = millis() - startTime; // 経過時間を計算
        let seconds = (elapsedTime / 1000).toFixed(2); // ミリ秒を秒に変換し、小数点以下2桁で表示
        
    
             // 経過時間を右上に表示
             //textAlign(RIGHT, TOP);
             textSize(50);
             fill(250,212,188);

             text(Math.round(seconds) + "s", width - 60, 40);
    
        
        sc = seconds;

        if(totalstep === 0){
            textSize(30); // フォントサイズ
            fill(0, 0, 0); // フォントカラー（青）
            text("ふみふみしてください", width/2, height / 2);///-20);
            textSize(20); // フォントサイズ
            fill(0, 0, 0,200); // フォントカラー（青）
            text("Please knead it", width/2, height / 2+30);///-20);
        
        }
       
       
    
        break;

    case 9:

    if (soundcount2 === 0){
      pipisound.play();
    soundcount2++;
    }    
        fill(doughColor);
        UDON();


        kansei();
       
        textSize(32); // フォントサイズ
        fill(0, 0, 0); // フォントカラー（青）
        text("COMPLETE!", width / 2, height / 2);///-20);
      //  button.hide();
        break;
        
    case 10:
       // noLoop(); 
       
        //********************ここでtotalstep初期化***/
        totalstep = 0;
        udonCount = 0;
        //******************************************/




        image(udonimg,300,80,300,300);

        textSize(30); // フォントサイズ
        fill(0, 0, 0); // フォントカラー（青）
        text("ふみふみ技", 110, 60);///-20);
        
        textSize(16); // フォントサイズ
        fill(0, 0, 0); // フォントカラー（青）
        text("Kneading technique", 280, 64);///-20);
        
        textAlign(LEFT);
        textSize(80); // フォントサイズ
        fill(249,212,187); // フォントカラー（青）
        if(sc <10){
            text("GENIUS", 30, 130);///-20);
        }else if(sc <30){
            text("EXPERT", 30, 130);///-20);
        }else if(sc <60){
            text("AMATEUR", 30, 130);///-20);
        }else{
            text("REVENGE",  30, 130);///-20);
        }
        
        textSize(30);
        fill(0);
        text("TIME", 30, 220);
        textSize(80);
        fill(0);
        text(sc+ "s", 30, 280);
        textAlign(CENTER);

//************************************************************* */
button.position(430, height / 2 - button.height / 2 + 300);        
button.html('RETRY');
        button.show();
        
        break;
    }
    //let someValue = 10; // この数値は何かの計算結果や条件によって変化すると仮定

    if(gamepar != 0){
      if (gamepar === 3) {
        if (!soundA.isPlaying()) {
          soundB.stop(); // soundBが再生中なら停止
          soundA.play(); // soundAを再生
        }
      } else if(gamepar === 9){
        if (!soundB.isPlaying()) {
        soundA.stop();
        soundB.stop();
        }
      }else {
        if (!soundB.isPlaying()) {
          soundA.stop(); // soundAが再生中なら停止
          soundB.play(); // soundBを再生
        }
      }
  }

     
  }
  
  function punisoundplay(){
    punisound.play();
  }
  function Taiki(){
    if (!resting) {
        // X座標の更新
        x += 1;  // X座標の増加量を減らす（よりゆっくり）
        if (x > width) {
          x = 0;  // 画面右端を超えたら左端から再スタート
        }
    
        // 重力による速度の加算
        velocity += gravity;
        y += velocity;
      }
    
      // 地面との衝突判定
      if (y > height - 50) {
        y = height - 50;  // Y座標を地面に設定
        if (!resting) {
          velocity = lift;  // 反発力を加える
          resting = true;
          restTime = 15;  // 小休止の時間を設定
        }
      }
    
      if (resting) {
        restTime--;
        if (restTime <= 0) {
          resting = false;
        }
      }
    
      // 形状の変形
      let stretch = map(abs(velocity), 0, 12, 1, 1.4);
    
      fill(235, 235, 235);
      noStroke();
      ellipse(x, y, rradius * stretch, rradius / stretch);  // Y軸方向の速度に応じて形状が変わる
    }
    
    function mouseClicked() {
      if (resting) {
        velocity = lift;  // クリックでさらに上昇
        resting = false;
        restTime = 0;
      }
  }

  function Settingok(){

    noodles.forEach(noodle => {
        noodle.grow();
        noodle.display();
      });
    }
    
    // 麺を表すクラス
    class Noodle {
      constructor(x, y, height, growthSpeed) {
        this.x = x;
        this.y = y;
        this.height = height;
        this.growthSpeed = growthSpeed; // 成長速度
        this.growing = true;
      }
    
      grow() {
        // 麺が伸びる動作
        if (this.growing) {
          this.height += this.growthSpeed; // ランダムな速度で伸びる
          if (this.height >= 800) {
            this.growing = false; // 画面の高さを超えたら伸びるのをやめる
          }
        }
      }
    
      display() {
        // 麺を表示
        noStroke();
        fill(doughColor);
        rect(this.x - noodleWidth / 2, this.y, noodleWidth, this.height, cornerRadius);
      }
  
}

function hairi(){
   // 導入アニメーションを開始する際に時間をリセット
   if (gamepar === 2 && !actionDone) {
    startTime = millis();  // 時間をリセット
    actionDone = true;     // アクション開始フラグを立てる
}

let elapsedTime = millis() - startTime;

if (elapsedTime > hairiSetTime) {
    gamepar = 3;
    actionDone = false;  // 次のアクションのためにフラグをリセット
}

}

function motimoti(){
    //ゲームの進行
    //完成するまでの時間を競い合う？




    if(totalstep >= MaxStap){
        gamepar = 9;
    }


    

}

function kansei(){

    // 完成アニメーションを開始する際に時間をリセット
    if (gamepar === 9 && !actionDone) {
        startTime = millis();  // 時間をリセット
        actionDone = true;     // アクション開始フラグを立てる
    }

    let elapsedTime = millis() - startTime;

    if (elapsedTime > 3000) {  // 3000ミリ秒 = 3秒
        gamepar = 10;
        actionDone = false;  // 次のアクションのためにフラグをリセット
    }
    
}





  function styleButton(btn) {
    btn.style('background-color', '#1C1D1D');
    btn.style('color', 'white');
    btn.style('padding', '10px 20px');
    btn.style('border', 'none');
    btn.style('border-radius', '10px');
    btn.style('font-size', '20px');
  }
  function onButtonClicked() {
    if (gamepar === 5) {
      gamepar = 1;  // 導入アニメーションへ
    } else if (gamepar === 10) {
      gamepar = 1;  // ゲーム開始準備へ
      startTime = millis();  // タイマーをリセット
      totalstep = 0;  // totalstepをリセット
    }
  }

var udonCount = 0;
  function UDON(){

    if(udonCount === 0){
        // 円周上にコントロールポイントを配置
        for (let i = 0; i < numPoints; i++) {
            let angle = TWO_PI / numPoints * i;
            let x = center.x + baseRadius * cos(angle);
            let y = center.y + baseRadius * sin(angle);
            controlPoints.push(createVector(x, y));
            deformations.push(0); // 最初は変形なし
            startTime = millis(); // スタート時刻をミリ秒で記録
        }
        udonCount++;
    }

  // コントロールポイントを使って変形した円を描画
  noStroke();
    // totalStepに応じて基本半径を調整
    if(gamepar === 3){
    radius = baseRadius + (totalstep / MaxStap) * 200; // totalStepが20の時に半径が50ピクセル増加
    }
    // コントロールポイントを使って変形した円を描画
    beginShape();
    for (let i = 0; i < controlPoints.length; i++) {
      let angle = TWO_PI / numPoints * i;
      let deform = deformations[i];
      let x = center.x + (radius + deform) * cos(angle);
      let y = center.y + (radius + deform) * sin(angle);
      vertex(x, y);
    }
    endShape(CLOSE);
  
    // 変形を時間とともに減少させる
    for (let i = 0; i < deformations.length; i++) {
      if (deformations[i] > 0) {
        deformations[i] -= deformationSpeed * deformations[i]; // 変形を自然に減少
      }
    }

    if(gamepar ===3) {
        
            }
  
  }

function UDON_UGOKU(){


    let deformIndex = floor(random(numPoints)); // ランダムに選択されたコントロールポイント
    deformations[deformIndex] = maxDeformation; // 最大変形を適用
    for (let i = 1; i <= 4; i++) { // 隣接するポイントも少し変形させる
      let indexPlus = (deformIndex + i) % numPoints;
      let indexMinus = (deformIndex - i + numPoints) % numPoints;
      deformations[indexPlus] = maxDeformation * (5 - i) / 5;
      deformations[indexMinus] = maxDeformation * (5 - i) / 5;
    }
}
