// ORPHE CORE 連携部分は変更なし
var ble = new Orphe(0);
var euler = {
  pitch: 0,
  roll: 0,
  yaw: 0
};
ble.setup();
// 左右の動きはORPHE COREの傾きに連動
ble.gotEuler = function (_euler) {
  if (game_state === state.CONNECTING) {
    game_state = state.READY;
  }
  euler = _euler;
};

// --- ゲームの状態管理 ---
const state = {
  CONNECTING: 'connecting',
  READY: 'ready',
  PLAYING: 'playing',
  GAME_CLEAR: 'gameClear',
  GAME_OVER: 'gameOver'
};
let game_state = state.CONNECTING;

// --- グローバル変数 ---
let notes = [];
let effects = [];
let score = 0;
let combo = 0;
let maxCombo = 0;
let judgementText = "";
let judgementTimer = 0;
let startTime; // ゲーム開始時間

// --- プレイヤー（星）の設定 ---
let playerX;
const PLAYER_Y = 500;
const STAR_SIZE = 40;

// --- リズムゲーム設定 ---
const BPM = 120; // 曲のテンポ (Beats Per Minute)
const BEAT_INTERVAL = (60 / BPM) * 60; // 1拍あたりのフレーム数 (60fpsを想定)
const NOTE_SPEED = 5; // ノーツが流れる速さ
const JUDGE_LINE_Y = 500; // ステップを判定するラインのY座標
const LANE_COUNT = 4; // レーンの数
const LANE_WIDTH = 400 / LANE_COUNT; // レーンの幅
const JUDGE_MARGIN = 20; // 判定の許容範囲
const GAME_DURATION = 30; // ゲームの制限時間（秒）

function setup() {
  createCanvas(400, 600);
  rectMode(CENTER);
  ellipseMode(CENTER);
  textAlign(CENTER, CENTER);
  textSize(20);
  playerX = width / 2;
}

function startGame() {
  score = 0;
  combo = 0;
  maxCombo = 0;
  judgementText = "";
  notes = [];
  effects = [];
  frameCount = 0;
  startTime = millis();
  game_state = state.PLAYING;
}

function draw() {
  background(20, 20, 40);

  switch (game_state) {
    case state.CONNECTING:
      showConnectingScreen();
      break;
    case state.READY:
      showReadyScreen();
      break;
    case state.PLAYING:
      playGame();
      break;
    case state.GAME_CLEAR:
      showClear();
      break;
    case state.GAME_OVER:
      showGameOver();
      break;
  }
}

function playGame() {
  // --- 制限時間のチェック ---
  let elapsedTime = (millis() - startTime) / 1000;
  if (elapsedTime >= GAME_DURATION) {
    game_state = state.GAME_CLEAR;
    return;
  }

  // --- プレイヤー（星）の移動と描画 ---
  playerX = map(euler.roll, -0.5, 0.5, 0, width);
  playerX = constrain(playerX, STAR_SIZE / 2, width - STAR_SIZE / 2);
  drawStar(playerX, JUDGE_LINE_Y, STAR_SIZE, color(255, 255, 0));

  // --- 判定ラインの描画 ---
  stroke(255, 255, 255, 100);
  strokeWeight(4);
  line(0, JUDGE_LINE_Y, width, JUDGE_LINE_Y);

  // --- レーンの描画 ---
  drawLanes();

  // --- ノーツの生成 ---
  if (frameCount > 0 && frameCount % floor(BEAT_INTERVAL) === 0) {
    let lane = floor(random(LANE_COUNT));
    let x = (LANE_WIDTH / 2) + (LANE_WIDTH * lane);
    notes.push(new Note(x, -20, NOTE_SPEED));
  }

  // --- ノーツの処理 ---
  for (let i = notes.length - 1; i >= 0; i--) {
    notes[i].update();
    notes[i].display();

    // MISS判定のロジックを修正
    if (notes[i].y > JUDGE_LINE_Y + JUDGE_MARGIN) {
      notes.splice(i, 1);
      setJudgementText("MISS");
      combo = 0;
      continue;
    }

    // 星とノーツが重なったときの判定
    let distance = dist(playerX, JUDGE_LINE_Y, notes[i].x, notes[i].y);
    let hitRadius = STAR_SIZE / 2 + notes[i].size / 2;

    if (distance < hitRadius) {
      judgeStep(i);
      break;
    }
  }

  // --- エフェクトの処理 ---
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].update();
    effects[i].display();
    if (effects[i].isFinished()) {
      effects.splice(i, 1);
    }
  }

  // --- UI表示 ---
  showScoreAndCombo();
  showTimer(elapsedTime);
  showJudgementText();
}

function showConnectingScreen() {
  background(20, 20, 40);
  fill(255);
  textSize(width * 0.06); // 画面幅に応じてサイズ調整
  textAlign(CENTER, CENTER);
  text("ORPHE COREと接続中...", width / 2, height / 2 - height * 0.05);
  textSize(width * 0.04); // 画面幅に応じてサイズ調整
  text("接続が完了したら自動的に画面が切り替わります", width / 2, height / 2 + height * 0.05);
}

function showReadyScreen() {
  background(20, 20, 40);
  fill(255);
  textSize(width * 0.06); // 画面幅に応じてサイズ調整
  textAlign(CENTER, CENTER);
  text("ORPHE CORE接続完了！", width / 2, height * 0.2);

  // ゲームルール説明
  textSize(width * 0.045); // 画面幅に応じてサイズ調整
  textAlign(LEFT, TOP);
  text("【遊び方】", width * 0.1, height * 0.3);
  textSize(width * 0.04); // 画面幅に応じてサイズ調整
  text("・ORPHE COREを傾けて星を動かそう", width * 0.1, height * 0.4);
  text("・ノーツと星が重なった時に足踏みをすると...\n\nノーツが消えてコンボが繋がる！", width * 0.1, height * 0.5);
  text("・コンボをたくさん繋げて高得点を狙おう！", width * 0.1, height * 0.65);

  // スタートボタン
  fill(0, 200, 50);
  let buttonWidth = width * 0.4;
  let buttonHeight = height * 0.08;
  rect(width / 2, height * 0.85, buttonWidth, buttonHeight, 10);
  fill(255);
  textSize(width * 0.07);
  textAlign(CENTER, CENTER);
  text("START", width / 2, height * 0.85);
}

function mousePressed() {
  if (game_state === state.READY) {
    let buttonX = width / 2;
    let buttonY = height * 0.85;
    let buttonWidth = width * 0.4;
    let buttonHeight = height * 0.08;

    if (mouseX > buttonX - buttonWidth / 2 &&
      mouseX < buttonX + buttonWidth / 2 &&
      mouseY > buttonY - buttonHeight / 2 &&
      mouseY < buttonY + buttonHeight / 2) {
      startGame();
    }
  }
}

function drawLanes() {
  stroke(255, 255, 255, 50);
  strokeWeight(2);
  for (let i = 1; i < LANE_COUNT; i++) {
    line(LANE_WIDTH * i, 0, LANE_WIDTH * i, height);
  }
}

// プレイヤーの星を描画する関数
function drawStar(x, y, radius, starColor) {
  let innerRadius = radius * 0.4;
  let outerRadius = radius;
  let points = 5;
  let angle = TWO_PI / points;
  let halfAngle = angle / 2.0;

  fill(starColor);
  stroke(0);
  strokeWeight(2);
  beginShape();
  for (let a = 0; a < TWO_PI; a += angle) {
    let sx = x + cos(a) * outerRadius;
    let sy = y + sin(a) * outerRadius;
    vertex(sx, sy);
    sx = x + cos(a + halfAngle) * innerRadius;
    sy = y + sin(a + halfAngle) * innerRadius;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}

// ORPHE COREの加速度センサーでステップを判定
ble.gotAcc = function (_acc) {
  // このイベントは、星とノーツが重なったときに自動的にトリガーされるため、ここでは何もしません
};

// デバッグ用にスペースキーでもステップ判定を可能に
function keyPressed() {
  if (game_state === state.PLAYING && key === ' ') {
    for (let i = notes.length - 1; i >= 0; i--) {
      let distance = dist(playerX, JUDGE_LINE_Y, notes[i].x, notes[i].y);
      let hitRadius = STAR_SIZE / 2 + notes[i].size / 2;
      if (distance < hitRadius) {
        judgeStep(i);
        break;
      }
    }
  }
  if ((key === 'r' || key === 'R') && (game_state === state.GAME_CLEAR || game_state === state.GAME_OVER)) {
    startGame();
  }
}

// ノーツの判定と消去を行うメインロジック
function judgeStep(noteIndex) {
  if (game_state !== state.PLAYING) return;

  score += 100;
  combo++;
  setJudgementText("GOOD");
  effects.push(new Effect(notes[noteIndex].x, JUDGE_LINE_Y, color(255, 215, 0)));
  notes.splice(noteIndex, 1);

  if (combo > maxCombo) {
    maxCombo = combo;
  }
}

function setJudgementText(text) {
  judgementText = text;
  judgementTimer = 30; // 30フレーム表示 (約0.5秒)
}

function showClear() {
  background(20, 20, 40, 200);
  fill(0, 255, 0);
  textSize(width * 0.1); // 画面幅に応じてサイズ調整
  text("Game Clear!", width / 2, height * 0.3);
  fill(255);
  textSize(width * 0.06); // 画面幅に応じてサイズ調整
  text(`Score: ${score}`, width / 2, height * 0.45);
  text(`Max Combo: ${maxCombo}`, width / 2, height * 0.55);
  textSize(width * 0.04); // 画面幅に応じてサイズ調整
  text("Press 'R' to restart", width / 2, height * 0.7);
}

function showGameOver() {
  background(0, 150);
  fill(255, 0, 0);
  textSize(width * 0.1); // 画面幅に応じてサイズ調整
  text("Game Over", width / 2, height * 0.3);
  fill(255);
  textSize(width * 0.06); // 画面幅に応じてサイズ調整
  text(`Score: ${score}`, width / 2, height * 0.45);
  text(`Max Combo: ${maxCombo}`, width / 2, height * 0.55);
  textSize(width * 0.04); // 画面幅に応じてサイズ調整
  text("Press 'R' to restart", width / 2, height * 0.7);
}

function showScoreAndCombo() {
  fill(255);
  textAlign(LEFT, TOP);
  textSize(width * 0.05);
  text(`Score: ${score}`, width * 0.02, height * 0.02);

  if (combo > 1) {
    textAlign(CENTER, TOP);
    textSize(width * 0.08);
    fill(255, 215, 0);
    text(`${combo}`, width / 2, height * 0.02);
    textSize(width * 0.04);
    text(`COMBO`, width / 2, height * 0.07);
  }
}

function showTimer(elapsedTime) {
  let remainingTime = max(0, GAME_DURATION - floor(elapsedTime));
  fill(255);
  textAlign(RIGHT, TOP);
  textSize(width * 0.05);
  text(`Time: ${remainingTime}`, width - width * 0.02, height * 0.02);
}

function showJudgementText() {
  if (judgementTimer > 0) {
    textAlign(CENTER, CENTER);
    textSize(width * 0.15);
    if (judgementText === "GOOD") {
      fill(50, 200, 255);
    } else if (judgementText === "MISS") {
      fill(255, 50, 50);
    }
    text(judgementText, width / 2, JUDGE_LINE_Y - height * 0.1);
    judgementTimer--;
  }
}

// --- クラス定義 ---
class Note {
  constructor(x, y, speed) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.size = 50;
  }

  update() {
    this.y += this.speed;
  }

  display() {
    fill(255, 255, 255);
    noStroke();
    ellipse(this.x, this.y, this.size, this.size);
  }
}

class Effect {
  constructor(x, y, particleColor) {
    this.x = x;
    this.y = y;
    this.particleColor = particleColor;
    this.particles = [];
    for (let i = 0; i < 15; i++) {
      this.particles.push(new Particle(this.x, this.y, this.particleColor));
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isFinished()) {
        this.particles.splice(i, 1);
      }
    }
  }

  display() {
    for (let p of this.particles) {
      p.display();
    }
  }

  isFinished() {
    return this.particles.length === 0;
  }
}

class Particle {
  constructor(x, y, pColor) {
    this.x = x;
    this.y = y;
    this.vel = p5.Vector.random2D().mult(random(1, 3));
    this.lifespan = 255;
    this.pColor = pColor;
  }

  update() {
    this.x += this.vel.x;
    this.y += this.vel.y;
    this.lifespan -= 15;
  }

  display() {
    noStroke();
    const c = this.pColor;
    fill(red(c), green(c), blue(c), this.lifespan);
    ellipse(this.x, this.y, 10, 10);
  }

  isFinished() {
    return this.lifespan < 0;
  }
}