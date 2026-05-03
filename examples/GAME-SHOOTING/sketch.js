// ORPHE CORE Shooting Game
let euler = { pitch: 0, roll: 0, yaw: 0 };
let player;
let missiles = [];
let enemies = [];
let isGameOver = false;

function setup() {
  const canvas = createCanvas(400, 600);
  canvas.parent('p5Canvas');
  canvas.elt.setAttribute('tabindex', '0');
  canvas.elt.addEventListener('keydown', handleRestartKey);
  document.addEventListener('keydown', handleRestartKey, true);
  player = new Player();
  ble.gotEuler = function (_euler) {
    euler = _euler;
    player.move(euler.roll * 5);
  };
  ble.gotAcc = function (_acc) {
    let sum = sqrt(_acc.x * _acc.x + _acc.y * _acc.y + _acc.z * _acc.z);
    if (sum > 0.1) {
      missiles.push(new Missile(player.x, player.y));
    }
  };
}

function draw() {
  background(0);
  if (isGameOver) {
    showGameOver();
    return;
  }
  if (keyIsDown(LEFT_ARROW)) {
    player.move(-1);
  } else if (keyIsDown(RIGHT_ARROW)) {
    player.move(1);
  }
  player.display();
  if (keyIsDown(77)) { // "m" key
    missiles.push(new Missile(player.x, player.y));
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    missiles[i].update();
    missiles[i].display();
    if (missiles[i].offscreen()) {
      missiles.splice(i, 1);
    } else {
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (missiles[i].hits(enemies[j])) {
          missiles.splice(i, 1);
          enemies.splice(j, 1);
          break;
        }
      }
    }
  }
  if (frameCount % 60 === 0) {
    enemies.push(new Enemy(random(width), -50));
  }
  for (let enemy of enemies) {
    enemy.update();
    enemy.display();
    if (enemy.hits(player)) {
      gameOver();
      break;
    }
  }
}

function keyPressed() {
  if (key === ' ' && isGameOver) {
    restartGame();
    return false;
  }
}

function handleRestartKey(event) {
  if (!isGameOver || event.code !== 'Space') return;
  event.preventDefault();
  event.stopPropagation();
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  restartGame();
}

function gameOver() {
  isGameOver = true;
}

function restartGame() {
  isGameOver = false;
  player = new Player();
  missiles = [];
  enemies = [];
}

function showGameOver() {
  background(0);
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(32);
  text("Game Over", width / 2, height / 2 - 20);
  textSize(16);
  fill(200);
  text("Press Space to restart", width / 2, height / 2 + 25);
}

class Player {
  constructor() {
    this.x = width / 2;
    this.y = height - 50;
    this.speed = 5;
  }
  move(direction) {
    this.x += this.speed * direction;
    this.x = constrain(this.x, 0, width);
  }
  display() {
    fill(255);
    rectMode(CENTER);
    rect(this.x, this.y, 50, 50);
  }
}

class Missile {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = 5;
  }
  update() {
    this.y -= this.speed;
  }
  display() {
    fill(255);
    rectMode(CENTER);
    rect(this.x, this.y, 10, 20);
  }
  offscreen() {
    return this.y < 0;
  }
  hits(enemy) {
    let distance = dist(this.x, this.y, enemy.x, enemy.y);
    return distance < 25;
  }
}

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = 2;
  }
  update() {
    this.y += this.speed;
  }
  display() {
    fill(255, 0, 0);
    ellipse(this.x, this.y, 40, 40);
  }
  hits(player) {
    let distance = dist(this.x, this.y, player.x, player.y);
    return distance < 25;
  }
}
