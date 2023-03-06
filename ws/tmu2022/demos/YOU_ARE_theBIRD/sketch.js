var ble = new Orphe(0);
var acc = {
  x: 0,
  y: 0,
  z: 0
};

let canvasWidth = 1000;
let canvasHeight = 600;

let startTime;
var oneSec = 1000; //1秒
let elapsedTime = 0;
let count = 0; //秒数をカウント
var now;

let title;
let bird1;
let bird2;
let ase;
let birds = new Array(bird1, bird2);
let counter = 0;
let input = [];
let speed = 2;
var gameStart = false;
var gamePlaying = false;
var gameOver = false;
let accSum = 0;
var currentbirdPos = canvasHeight / 2 + 10;
let cloud1x = 700;
let cloud2x = 100;
let cloud3x = 200;
let timeStamp = 0;
var enemies = [];
let tree1Enemy;
let tree2Enemy;
let ufoEnemy;
let tekiEnemy;
var birdX = canvasWidth / 2 - 60;
var birdY = canvasHeight / 2 + 10;
var titlePos = 0;

function preload() {
  title = loadImage("title.png");
  bird1 = loadImage("bird1.png");
  bird2 = loadImage("bird2.png");
  ase = loadImage("ase.png");
  cloud1 = loadImage("cloud1.png");
  cloud2 = loadImage("cloud2.png");
  cloud3 = loadImage("cloud3.png");
  tree1 = loadImage("tree1.png");
  tree2 = loadImage("tree2.png");
  ufo = loadImage("UFO.png");
  teki = loadImage("teki.png");
  piyo = loadSound("piyo.mp3");
}

function setup() {
  // ORPHE CORE Init
  ble.setup();
  ble.gotAcc = function (_acc) {
    acc = _acc;
  };
  ble.onConnect = function (uuid) { //コネクト後処理
    console.log("connect");
    gameStart = true;
  }
  createCanvas(canvasWidth, canvasHeight);
  background(163, 216, 246);
  image(title, 240, 0);
  setInterval(function () {

    input.push(mouseY - 250);
    if (input.length > canvasWidth / speed) {
      input.shift();
    }
  }, 20);
  setInterval(function () {
    if (counter === 0) {
      counter = 1;
    } else {
      counter = 0;
    }
  }, 60);

  //敵を生成
  newEnemy();
  textFont("Gill Sans");
}

//敵オブジェクト作成用クラス
class Enemy {
  constructor(name, x, y, imgSize) {
    this.image = name; //画像
    this.x = x;
    this.y = y;
    this.imgSize = imgSize; //画像の拡大率
    this.top = this.y;
    this.bottom = this.y + this.image.height;
    this.left = this.x;
    this.right = this.x + this.image.width;
    this.speed = random(-5, -2); //移動スピード
    this.isInstance = false; //生成されたかどうか
  }

  display() {
    image(this.image, this.x, this.y, this.imgSize, this.imgSize);
  }

  update() {
    if (this.isInstance) {
      this.x += this.speed;
      this.top = this.y + 20;
      this.bottom = this.y + this.imgSize - 30;
      this.left = this.x + 10;
      this.right = this.x + this.imgSize - 10;
    }
  }

  instanceCheck() {
    if (!this.isInstance) {
      this.isInstance = true;
    }
  }

  collisionDetect() { //衝突判定
    var birdLeft = 100 + 20;
    var birdRight = 200 - 20;
    var birdTop = birdPos + 20;
    var birdBottom = birdPos + 120;

    // console.log(birdLeft, birdTop, birdRight, birdBottom);

    if (birdLeft < this.right && birdTop < this.bottom && birdRight > this.left && birdBottom > this.top) {
      gameOver = true;
    }
  }
}

//敵インスタンス作成
function newEnemy() {
  tree1Enemy = new Enemy(tree1, 1200, random(300, 500), 300);
  tree2Enemy = new Enemy(tree2, 1500, random(300, 500), 300);
  ufoEnemy = new Enemy(ufo, 2000, random(50, 300), 100);
  tekiEnemy = new Enemy(teki, 1700, random(20, 300), 100);
  enemies.push(tree1Enemy, tree2Enemy, ufoEnemy, tekiEnemy);
  // console.log(enemies);
}

function imgTimer() {
  if (count == 1) { count = -1 };
  background(163, 216, 246);
  count++;
  console.log(count);
  image(birds[count], canvasWidth / 2 - 60, canvasHeight / 2 + 10, 100, 100);
  setTimeout("imgTimer()", 100);
}

// function gameStart() {
//   console.log("スタート");
//   //鳥とタイトル移動
//   gamePlaying = true;
// }

function UIcontroller() { //UI描画設定

  now = millis();
  elapsedTime = now - startTime;
  // if (elapsedTime >= oneSec) { //１秒たったら
  //   count++;
  //   startTime = millis();
  // }

  //accを表示
  textSize(20);
  fill(0, 0, 0);
  text(`ふんばり：${Math.round(acc.z * 100) / 100}`, 800, 70);

  if (gameOver === true) {
    //ゲームオーバーになった時間
    let gameOverTime = millis();
    textSize(20);
    fill(0, 0, 0);
    text(`${count} : ${Math.round(now - gameOverTime)}`, 800, 30);

    textAlign(CENTER, CENTER);
    textSize(100);
    fill(256, 0, 0);
    text("GAME OVER", canvasWidth / 2, canvasHeight / 2);
  }
  else {
    //経過時間を表示
    textSize(20);
    fill(0, 0, 0);
    text(`${count} : ${Math.round(elapsedTime)}`, 800, 30);
    if (elapsedTime >= oneSec) { //１秒たったら
      count++;
      startTime = millis();
    }
  }
}

function draw() {
  background(163, 216, 246);
  noFill();
  stroke(0);

  if (gamePlaying === false) { //ゲームスタート前の画面設定
    if (-200 < cloud1x) {
      cloud1x -= 1;
    } else {
      cloud1x = 1000;
    }
    if (-200 < cloud2x) {
      cloud2x -= 1.2;
    } else {
      cloud2x = 1000;
    }
    if (-200 < cloud3x) {
      cloud3x -= 0.5;
    } else {
      cloud3x = 1000;
    }

    image(cloud1, cloud1x, 20, 200, 200);
    image(cloud2, cloud2x, 100, 200, 200);
    image(cloud3, cloud3x, 300, 200, 200);

    image(title, 240, titlePos);
    if (counter === 0) {
      image(bird1, birdX, birdY, 100, 100);
    } else {
      image(bird2, birdX, birdY, 100, 100);
    }

    if (gameStart === true) { //コネクト後
      //とりとタイトルを移動
      titlePos -= 10;
      birdX -= ((canvasWidth / 2 - 60) - 100) / 100;
      birdY -= 10 / 100;
      if (birdX <= 100) { //移動し終わったらゲーム開始
        startTime = millis();
        gamePlaying = true;
      }
    }


  } else { //ゲームスタート後
    //雲の位置を調整
    if (-200 < cloud1x) {
      cloud1x -= 2;
    } else {
      cloud1x = 1000;
    }
    if (-200 < cloud2x) {
      cloud2x -= 1.2;
    } else {
      cloud2x = 1000;
    }
    if (-200 < cloud3x) {
      cloud3x -= 2.5;
    } else {
      cloud3x = 1000;
    }

    image(cloud1, cloud1x, 20, 200, 200);
    image(cloud2, cloud2x, 100, 200, 200);
    image(cloud3, cloud3x, 300, 200, 200);

    accSum += Math.abs(acc.z); //揚力の総量
    accSum -= 0.1; //常に少しずつ減っていく
    currentbirdPos += 5; //とりは常に降下し続ける
    birdPos = currentbirdPos - accSum * 30;

    if (acc.z > 0.3) {
      if (counter === 0) {
        image(ase, 100, birdPos, 100, 100);
        image(bird1, 100, birdPos, 100, 100);
      } else {
        image(bird2, 100, birdPos, 100, 100);
      }
      if (!piyo.isPlaying()) {
        piyo.play();
      }
    } else {
      image(bird1, 100, birdPos, 100, 100);
    }


    for (i = 0; i < enemies.length; i++) {
      // enemies[i].posChange();
      // console.log(enemies)
      if (enemies[i].x < -200) {
        enemies[i].x = random(1000, 1700);
        enemies[i].speed = random(-5, -2)
        // this.y = random(300, 1000);
        switch (i) {
          case 0:
          case 1: enemies[i].y = random(300, 500);
            break;
          case 2: enemies[i].y = random(20, 400);
            break;
          case 3: enemies[i].y = random(20, 400);
            break;
        }
        console.log(i)
      }
      enemies[i].instanceCheck();
      enemies[i].update();
      enemies[i].display();
      enemies[i].collisionDetect();
    }

    if (birdPos > 800) {
      gameOver = true;
    }

    UIcontroller();
  }
}
