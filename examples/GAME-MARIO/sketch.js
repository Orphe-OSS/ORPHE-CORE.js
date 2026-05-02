/**
 * ORPHE CORE 2Dアクションゲーム
 * - ORPHE CORE: pitch角度で左右移動、振動でジャンプ
 * - キーボード: 矢印キーで左右移動、上キーでジャンプ
 */

let W = 900, H = 540;
let FLOOR_Y;
let state = "title"; // "title" | "play" | "over" | "clear"
let score = 0, hiScore = 0;

// カメラとワールド
let camera = { x: 0, y: 0 };
let worldWidth = 3200; // ステージの幅（ボス戦エリア含む）

// プレイヤー
let player;

// 敵（クリボー風）
let enemies = [];

// ボス敵
let boss = null;
let fireballs = [];

// 障害物
let platforms = [];
let coins = [];

// 背景要素
let clouds = [];
let hills = [];

// ORPHE CORE関連
let forwardPitchThreshold = 0.0;     // 前進用PITCH閾値
let forwardAccelThreshold = 0.2;     // 前進用加速度閾値
let jumpPitchThreshold = 0.0;        // ジャンプ用PITCH閾値
let jumpAccelThreshold = 0.5;        // ジャンプ用加速度閾値
let backwardPitchThreshold = -0.8;   // 後退用PITCH閾値
let backwardPitchDuration = 0;       // 後退PITCH持続時間
let lastAccelMagnitude = 0;
let jumpCooldown = 0;

// 入力管理
let inputLeft = false;
let inputRight = false;
let inputJump = false;

// サウンド
let jumpSound, damageSound, victorySound, coinSound, enemyDefeatSound;
let bgmA, bgmB;

// 音量設定
let bgmVolume = 0.2;
let sfxVolume = 0.2;

// その他
let myFont;
let button;
let startButton;
let farstgame = true;
let counter3 = 3; // カウントダウンを3に変更
let lastUpdateTime = 0;
let counterVisible = true;
let gameStartTime = 0;  // ゲーム開始時刻
let clearTime = 0;       // クリアタイム

// 音量更新関数
function updateBGMVolume(volume) {
  bgmVolume = volume;
  if (bgmA) bgmA.setVolume(bgmVolume * 0.2); // BGMの基本音量を調整
  if (bgmB) bgmB.setVolume(bgmVolume * 0.2);
}

function updateSFXVolume(volume) {
  sfxVolume = volume;
  if (jumpSound) jumpSound.setVolume(sfxVolume * 0.4);
  if (damageSound) damageSound.setVolume(sfxVolume * 0.4);
  if (victorySound) victorySound.setVolume(sfxVolume * 0.5);
  if (coinSound) coinSound.setVolume(sfxVolume * 0.5);
  if (enemyDefeatSound) enemyDefeatSound.setVolume(sfxVolume * 0.4);
}

// 物理定数
const GRAVITY = 1800;
const PLAYER_ACCEL = 1500;
const PLAYER_MAX_SPEED = 300;
const PLAYER_FRICTION = 1200;
const PLAYER_AIR_FRICTION = 400;
const JUMP_POWER = -580;
const ENEMY_SPEED = 50;

function preload() {
  // フォントは英語のみ使用
  myFont = loadFont('BebasNeue-Regular.ttf');
  
  // BGM
  bgmA = loadSound('sound/BGMA.mp3');
  bgmB = loadSound('sound/BGMB.mp3');
  
  // 効果音
  jumpSound = loadSound('sound/8bitジャンプ.mp3');
  damageSound = loadSound('sound/8bitダメージ1.mp3');
  victorySound = loadSound('sound/8bit獲得2.mp3');
  coinSound = loadSound('sound/8bit取得1.mp3');
  enemyDefeatSound = loadSound('sound/8bit爆発1.mp3');
}

function setup() {
  let cnv = createCanvas(W, H);
  cnv.parent('p5Canvas');
  FLOOR_Y = H * 0.8;
  textFont(myFont);
  
  // サウンド設定
  // 初期音量設定
  updateBGMVolume(bgmVolume);
  updateSFXVolume(sfxVolume);
  
  // ハイスコア読み込み
  hiScore = Number(localStorage.getItem("orphe_2d_action_hi") || 0);
  
  // リゲームボタン
  button = createButton('REGAME');
  button.mousePressed(reGame);
  button.style('position', 'absolute');
  button.style('transform', 'translate(-50%, -50%)');
  button.style('background-color', '#4CAF50');
  button.style('color', 'white');
  button.style('padding', '15px 32px');
  button.style('font-size', '16px');
  button.style('border', 'none');
  button.style('border-radius', '5px');
  button.style('cursor', 'pointer');
  button.style('display', 'none');
  
  // スタートボタン
  startButton = createButton('START GAME');
  startButton.mousePressed(startGameWithoutDevice);
  startButton.style('position', 'absolute');
  startButton.style('transform', 'translate(-50%, -50%)');
  startButton.style('background-color', '#2196F3');
  startButton.style('color', 'white');
  startButton.style('padding', '20px 40px');
  startButton.style('font-size', '20px');
  startButton.style('border', 'none');
  startButton.style('border-radius', '10px');
  startButton.style('cursor', 'pointer');
  startButton.style('display', 'none');
  
  resetGame(true);
}

function positionCanvasButton(domButton, offsetY) {
  const canvas = document.querySelector('#p5Canvas canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  domButton.style('left', `${window.scrollX + rect.left + rect.width / 2}px`);
  domButton.style('top', `${window.scrollY + rect.top + rect.height / 2 + offsetY}px`);
}

function resetGame(full = false) {
  // 背景準備
  clouds = [];
  for (let i = 0; i < 12; i++) {
    clouds.push({
      x: random(worldWidth), 
      y: random(40, 200), 
      w: random(80, 160), 
      h: random(28, 50)
    });
  }
  
  hills = [];
  for (let i = 0; i < 10; i++) {
    hills.push({
      x: random(worldWidth), 
      y: FLOOR_Y + 8, 
      w: random(160, 320), 
      h: random(40, 90)
    });
  }

  // プレイヤー初期化
  player = {
    x: 200,
    y: FLOOR_Y - 44,
    w: 28,
    h: 44,
    vx: 0,
    vy: 0,
    onGround: false,
    isAlive: true,
    invincible: 0,
    facing: 1, // 1:右向き, -1:左向き
    powerState: 'big' // 'big' or 'small'
  };

  // プラットフォーム生成
  platforms = [];
  // 地面
  platforms.push({
    x: 0,
    y: FLOOR_Y,
    w: worldWidth,
    h: H - FLOOR_Y,
    type: 'ground'
  });
  
  // 空中プラットフォーム
  platforms.push({ x: 400, y: FLOOR_Y - 100, w: 100, h: 20 });
  platforms.push({ x: 600, y: FLOOR_Y - 150, w: 120, h: 20 });
  platforms.push({ x: 800, y: FLOOR_Y - 80, w: 100, h: 20 });
  platforms.push({ x: 1000, y: FLOOR_Y - 180, w: 150, h: 20 });
  platforms.push({ x: 1300, y: FLOOR_Y - 120, w: 100, h: 20 });
  platforms.push({ x: 1500, y: FLOOR_Y - 200, w: 200, h: 20 });
  platforms.push({ x: 1800, y: FLOOR_Y - 100, w: 100, h: 20 });
  platforms.push({ x: 2000, y: FLOOR_Y - 160, w: 150, h: 20 });
  platforms.push({ x: 2300, y: FLOOR_Y - 140, w: 100, h: 20 });
  platforms.push({ x: 2500, y: FLOOR_Y - 200, w: 120, h: 20 });

  // 敵（クリボー風）生成
  enemies = [];
  enemies.push(createEnemy(500, FLOOR_Y - 30));
  enemies.push(createEnemy(700, FLOOR_Y - 30));
  enemies.push(createEnemy(850, FLOOR_Y - 110));
  enemies.push(createEnemy(1100, FLOOR_Y - 30));
  enemies.push(createEnemy(1350, FLOOR_Y - 150));
  enemies.push(createEnemy(1600, FLOOR_Y - 230));
  enemies.push(createEnemy(1900, FLOOR_Y - 30));
  enemies.push(createEnemy(2100, FLOOR_Y - 30));
  enemies.push(createEnemy(2400, FLOOR_Y - 30));

  // コイン生成
  coins = [];
  coins.push({ x: 450, y: FLOOR_Y - 140, w: 20, h: 20, collected: false });
  coins.push({ x: 650, y: FLOOR_Y - 190, w: 20, h: 20, collected: false });
  coins.push({ x: 850, y: FLOOR_Y - 120, w: 20, h: 20, collected: false });
  coins.push({ x: 1050, y: FLOOR_Y - 220, w: 20, h: 20, collected: false });
  coins.push({ x: 1350, y: FLOOR_Y - 160, w: 20, h: 20, collected: false });
  coins.push({ x: 1550, y: FLOOR_Y - 240, w: 20, h: 20, collected: false });
  coins.push({ x: 1850, y: FLOOR_Y - 140, w: 20, h: 20, collected: false });
  coins.push({ x: 2050, y: FLOOR_Y - 200, w: 20, h: 20, collected: false });
  coins.push({ x: 2350, y: FLOOR_Y - 180, w: 20, h: 20, collected: false });
  coins.push({ x: 2550, y: FLOOR_Y - 240, w: 20, h: 20, collected: false });
  
  // ボス敵を配置（ゴール直前）
  boss = createBoss(2600, FLOOR_Y - 80);
  fireballs = [];
  
  // ゴールフラグ（ボスの後ろに配置）
  coins.push({ x: 2850, y: FLOOR_Y - 60, w: 30, h: 60, collected: false, isGoal: true });

  // ゲーム状態リセット
  score = full ? 0 : score;
  camera.x = 0;
  jumpCooldown = 0;
  inputLeft = false;
  inputRight = false;
  inputJump = false;
}

function createEnemy(x, y) {
  return {
    x: x,
    y: y,
    w: 30,
    h: 30,
    vx: ENEMY_SPEED,
    vy: 0,
    onGround: false,
    isAlive: true,
    direction: 1
  };
}

function createBoss(x, y) {
  return {
    x: x,
    y: y,
    w: 60,
    h: 80,
    vx: 0,
    vy: 0,
    hp: 5,  // ボスのHP
    maxHp: 5,
    onGround: false,
    isAlive: true,
    direction: -1,
    attackCooldown: 0,
    jumpCooldown: 0,
    state: 'idle',  // 'idle', 'jumping', 'attacking'
    activated: false
  };
}

function createFireball(x, y, direction) {
  return {
    x: x,
    y: y,
    w: 15,
    h: 15,
    vx: direction * 3,
    vy: 0,
    lifetime: 180,  // 3秒で消滅
    isAlive: true
  };
}

function draw() {
  const dt = min(0.032, deltaTime / 1000);
  
  // 背景
  drawBackground();

  switch (gamestage) {
    case 0: // デバイス接続待ち
      drawLoadingScreen();
      positionCanvasButton(startButton, 120);
      startButton.style('display', 'inline-block');
      break;
      
    case 1: // ゲーム開始
      startButton.style('display', 'none');
      if (state === "title") {
        drawGame();
        uiTitle();
        count3s();
        
        if (farstgame == false) {
          checkStartGame_regame();
        } else {
          checkStartGame();
        }
      } else if (state === "play") {
        updateGame(dt);
        drawGame();
        drawHUD();
      } else if (state === "clear") {
        drawGame();
        drawHUD();
        uiClear();
      }
      break;
      
    case 2: // ゲームオーバー
      state = "over";
      drawGame();
      drawHUD();
      uiGameOver();
      positionCanvasButton(button, 92);
      button.style('display', 'inline-block');
      break;
  }
}

function updateGame(dt) {
  // BGM再生
  if (!bgmA.isPlaying() && state === "play") {
    bgmA.loop();
  }
  
  // 無敵時間の更新
  if (player.invincible > 0) {
    player.invincible -= dt;
  }

  // クールダウン更新
  jumpCooldown = max(0, jumpCooldown - dt);

  // 入力処理
  handleInput(dt);

  // プレイヤー物理更新
  updatePlayer(dt);

  // カメラ更新
  updateCamera();

  // 敵の更新
  updateEnemies(dt);
  
  // ボスの更新
  updateBoss(dt);
  
  // ファイアボールの更新
  updateFireballs(dt);

  // コイン収集
  collectCoins();

  // ゴール判定
  checkGoal();

  // 落下死判定
  if (player.y > H + 100) {
    gameOver();
  }
}

function handleInput(dt) {
  // 入力リセット
  inputLeft = false;
  inputRight = false;
  inputJump = false;
  
  // キーボード入力
  if (keyIsDown(LEFT_ARROW)) {
    inputLeft = true;
  }
  if (keyIsDown(RIGHT_ARROW)) {
    inputRight = true;
  }
  if (keyIsDown(UP_ARROW)) {
    inputJump = true;
  }
  
  // ORPHE CORE入力
  handleOrpheInput(dt);
}

function handleOrpheInput(dt) {
  let pitchSum = 0;
  let accelMagnitude = 0;
  let validDevices = 0;
  
  for (let i = 0; i < bles.length; i++) {
    if (devices && devices[i] && devices[i].active && devices[i].eulers) {
      pitchSum += devices[i].eulers.pitch;
      validDevices++;
      
      if (devices[i].acc) {
        let mag = Math.sqrt(
          devices[i].acc.x * devices[i].acc.x +
          devices[i].acc.y * devices[i].acc.y +
          devices[i].acc.z * devices[i].acc.z
        );
        accelMagnitude = max(accelMagnitude, mag);
      }
    }
  }
  
  if (validDevices > 0) {
    let avgPitch = pitchSum / validDevices;
    
    // 前進判定：PITCH >= forwardPitchThreshold かつ 加速度 > forwardAccelThreshold
    if (avgPitch >= forwardPitchThreshold && accelMagnitude > forwardAccelThreshold) {
      inputRight = true;
      backwardPitchDuration = 0; // 後退カウンターリセット
    }
    
    // ジャンプ判定：PITCH <= jumpPitchThreshold かつ 加速度 > jumpAccelThreshold
    if (avgPitch <= jumpPitchThreshold && 
        accelMagnitude > jumpAccelThreshold && 
        lastAccelMagnitude <= jumpAccelThreshold && 
        jumpCooldown <= 0) {
      inputJump = true;
      jumpCooldown = 0.3;
      backwardPitchDuration = 0; // 後退カウンターリセット
    }
    
    // 後退判定：PITCH <= backwardPitchThreshold を一定時間維持
    if (avgPitch <= backwardPitchThreshold) {
      backwardPitchDuration += dt;
      if (backwardPitchDuration > 0.3) { // 0.3秒以上維持で後退
        inputLeft = true;
      }
    } else {
      backwardPitchDuration = 0;
    }
    
    lastAccelMagnitude = accelMagnitude;
  }
}

function updatePlayer(dt) {
  // 左右移動の加速度処理
  let targetVx = 0;
  
  if (inputLeft) {
    targetVx = -PLAYER_MAX_SPEED;
    player.facing = -1;
  } else if (inputRight) {
    targetVx = PLAYER_MAX_SPEED;
    player.facing = 1;
  }
  
  // 加速または減速
  if (targetVx !== 0) {
    // 加速
    let accel = PLAYER_ACCEL * dt;
    if (player.vx < targetVx) {
      player.vx = min(player.vx + accel, targetVx);
    } else if (player.vx > targetVx) {
      player.vx = max(player.vx - accel, targetVx);
    }
  } else {
    // 摩擦による減速
    let friction = player.onGround ? PLAYER_FRICTION : PLAYER_AIR_FRICTION;
    if (abs(player.vx) > 0) {
      let decel = friction * dt;
      if (player.vx > 0) {
        player.vx = max(0, player.vx - decel);
      } else {
        player.vx = min(0, player.vx + decel);
      }
    }
  }
  
  // ジャンプ
  if (inputJump && player.onGround) {
    player.vy = JUMP_POWER;
    player.onGround = false;
    jumpSound.play();
  }
  
  // 重力
  player.vy += GRAVITY * dt;
  
  // 位置更新
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  
  // プラットフォームとの衝突判定
  player.onGround = false;
  for (let platform of platforms) {
    if (rectCollision(player, platform)) {
      // 上から着地
      if (player.vy > 0 && player.y < platform.y) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
      }
      // 下から頭をぶつける
      else if (player.vy < 0 && player.y > platform.y) {
        player.y = platform.y + platform.h;
        player.vy = 0;
      }
      // 横から衝突
      else {
        if (player.x < platform.x + platform.w / 2) {
          player.x = platform.x - player.w;
        } else {
          player.x = platform.x + platform.w;
        }
        player.vx = 0;
      }
    }
  }
  
  // ワールド境界
  player.x = constrain(player.x, 0, worldWidth - player.w);
}

function updateEnemies(dt) {
  for (let enemy of enemies) {
    if (!enemy.isAlive) continue;
    
    // 横移動
    enemy.x += enemy.vx * enemy.direction * dt;
    
    // 重力
    enemy.vy += GRAVITY * dt;
    enemy.y += enemy.vy * dt;
    
    // プラットフォームとの衝突
    enemy.onGround = false;
    for (let platform of platforms) {
      if (rectCollision(enemy, platform)) {
        if (enemy.vy > 0 && enemy.y < platform.y) {
          enemy.y = platform.y - enemy.h;
          enemy.vy = 0;
          enemy.onGround = true;
        }
      }
    }
    
    // 端で反転
    if (enemy.onGround) {
      // 崖を検知して反転
      let checkAhead = {
        x: enemy.x + (enemy.direction > 0 ? enemy.w : -10),
        y: enemy.y + enemy.h + 10,
        w: 10,
        h: 10
      };
      
      let hasGround = false;
      for (let platform of platforms) {
        if (rectCollision(checkAhead, platform)) {
          hasGround = true;
          break;
        }
      }
      
      if (!hasGround) {
        enemy.direction *= -1;
      }
    }
    
    // 壁にぶつかったら反転
    for (let platform of platforms) {
      let checkWall = {
        x: enemy.x + (enemy.direction > 0 ? enemy.w : -5),
        y: enemy.y,
        w: 5,
        h: enemy.h
      };
      if (rectCollision(checkWall, platform) && platform.type !== 'ground') {
        enemy.direction *= -1;
        break;
      }
    }
    
    // プレイヤーとの衝突
    if (player.invincible <= 0 && rectCollision(player, enemy)) {
      // 上から踏んだ場合
      if (player.vy > 0 && player.y < enemy.y - enemy.h/2) {
        enemy.isAlive = false;
        player.vy = JUMP_POWER * 0.7; // 軽くバウンド
        score += 100;
        if (enemyDefeatSound) enemyDefeatSound.play();
      } else {
        // ダメージ処理
        handlePlayerDamage();
      }
    }
  }
}

function updateBoss(dt) {
  if (!boss || !boss.isAlive) return;
  
  // ボスがプレイヤーに近づいたらアクティベート
  if (!boss.activated && Math.abs(player.x - boss.x) < 400) {
    boss.activated = true;
  }
  
  if (!boss.activated) return;
  
  // ボスの重力
  boss.vy += GRAVITY * dt;
  boss.y += boss.vy * dt;
  
  // 地面との衝突
  boss.onGround = false;
  if (boss.y + boss.h > FLOOR_Y) {
    boss.y = FLOOR_Y - boss.h;
    boss.vy = 0;
    boss.onGround = true;
  }
  
  // ボスのAI
  boss.attackCooldown = Math.max(0, boss.attackCooldown - dt);
  boss.jumpCooldown = Math.max(0, boss.jumpCooldown - dt);
  
  // プレイヤーの方向を向く
  if (player.x < boss.x) {
    boss.direction = -1;
  } else {
    boss.direction = 1;
  }
  
  let distToPlayer = Math.abs(player.x - boss.x);
  
  // 攻撃パターン
  if (boss.onGround) {
    if (boss.attackCooldown <= 0 && distToPlayer < 500) {
      // ファイアボール攻撃
      boss.state = 'attacking';
      let fireballX = boss.x + (boss.direction > 0 ? boss.w : 0);
      let fireballY = boss.y + boss.h * 0.3;
      fireballs.push(createFireball(fireballX, fireballY, boss.direction));
      boss.attackCooldown = 2.0;  // 2秒のクールダウン
      
      // 3発連続で撃つことがある
      if (Math.random() < 0.3) {
        setTimeout(() => {
          if (boss && boss.isAlive) {
            fireballs.push(createFireball(fireballX, fireballY - 20, boss.direction));
          }
        }, 200);
        setTimeout(() => {
          if (boss && boss.isAlive) {
            fireballs.push(createFireball(fireballX, fireballY + 20, boss.direction));
          }
        }, 400);
      }
    }
    
    // ジャンプ攻撃
    if (boss.jumpCooldown <= 0 && distToPlayer < 300 && distToPlayer > 100) {
      boss.state = 'jumping';
      boss.vy = -JUMP_POWER * 0.8;
      boss.jumpCooldown = 3.0;  // 3秒のクールダウン
    }
    
    // 移動（ゆっくり）
    if (distToPlayer > 150 && boss.state !== 'attacking') {
      boss.x += boss.direction * 30 * dt;
      boss.state = 'idle';
    }
  }
  
  // プレイヤーとの衝突
  if (player.invincible <= 0 && rectCollision(player, boss)) {
    // 上から踏んだ場合
    if (player.vy > 0 && player.y < boss.y - boss.h/2) {
      boss.hp--;
      player.vy = JUMP_POWER * 0.7; // 軽くバウンド
      score += 200;
      
      if (boss.hp <= 0) {
        boss.isAlive = false;
        score += 1000;
        if (enemyDefeatSound) enemyDefeatSound.play();
      } else {
        damageSound.play();
      }
    } else {
      // ダメージ処理
      handlePlayerDamage();
    }
  }
}

function updateFireballs(dt) {
  for (let i = fireballs.length - 1; i >= 0; i--) {
    let fireball = fireballs[i];
    
    if (!fireball.isAlive) {
      fireballs.splice(i, 1);
      continue;
    }
    
    // 移動
    fireball.x += fireball.vx;
    fireball.y += fireball.vy;
    
    // 重力（わずかに）
    fireball.vy += GRAVITY * dt * 0.3;
    
    // ライフタイム
    fireball.lifetime--;
    if (fireball.lifetime <= 0) {
      fireball.isAlive = false;
    }
    
    // プレイヤーとの衝突
    if (player.invincible <= 0 && rectCollision(player, fireball)) {
      handlePlayerDamage();
      fireball.isAlive = false;
    }
    
    // 地面との衝突
    if (fireball.y + fireball.h > FLOOR_Y) {
      fireball.y = FLOOR_Y - fireball.h;
      fireball.vy = -fireball.vy * 0.6;  // バウンド
    }
  }
}

function collectCoins() {
  for (let coin of coins) {
    if (!coin.collected && rectCollision(player, coin)) {
      coin.collected = true;
      if (coin.isGoal) {
        // ボスが倒されていない場合はゴールできない
        if (boss && boss.isAlive) {
          coin.collected = false;  // ゴールフラグを元に戻す
          return;
        }
        // ゴール到達
        clearTime = (millis() - gameStartTime) / 1000;  // 秒単位で記録
        state = "clear";
        bgmA.stop();
        victorySound.play();
        score += 500;
        if (score > hiScore) {
          hiScore = score;
          localStorage.setItem("orphe_2d_action_hi", hiScore);
        }
      } else {
        coinSound.play();
        score += 50;
      }
    }
  }
}

function checkGoal() {
  // ゴールフラグはコインの最後の要素として実装
}

function updateCamera() {
  // プレイヤーを画面中央付近に保つ
  let targetX = player.x - W / 2;
  camera.x = constrain(targetX, 0, worldWidth - W);
}

function rectCollision(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function drawBackground() {
  // 空
  background(135, 206, 235);
  
  // 雲（パララックス効果）
  push();
  translate(-camera.x * 0.3, 0);
  noStroke();
  fill(255, 255, 255, 230);
  for (let c of clouds) {
    ellipse(c.x, c.y, c.w, c.h);
    ellipse(c.x - c.w * 0.35, c.y + 6, c.w * 0.6, c.h * 0.7);
    ellipse(c.x + c.w * 0.35, c.y + 4, c.w * 0.6, c.h * 0.75);
  }
  pop();
  
  // 丘（パララックス効果）
  push();
  translate(-camera.x * 0.5, 0);
  fill(50, 160, 60);
  noStroke();
  for (let h of hills) {
    ellipse(h.x, h.y, h.w, h.h);
  }
  pop();
}

function drawGame() {
  push();
  translate(-camera.x, 0);
  
  // プラットフォーム
  for (let platform of platforms) {
    if (platform.type === 'ground') {
      // 地面
      noStroke();
      fill(96, 193, 85);
      rect(platform.x, platform.y, platform.w, platform.h);
      fill(80, 150, 70);
      rect(platform.x, platform.y, platform.w, 12);
    } else {
      // 空中プラットフォーム
      fill(139, 69, 19);
      rect(platform.x, platform.y, platform.w, platform.h);
      fill(160, 82, 45);
      rect(platform.x, platform.y, platform.w, 5);
    }
  }
  
  // コイン
  for (let coin of coins) {
    if (!coin.collected) {
      if (coin.isGoal) {
        // ゴールフラグ
        fill(255, 215, 0);
        rect(coin.x + coin.w/2 - 2, coin.y, 4, coin.h);
        fill(255, 0, 0);
        triangle(coin.x + coin.w/2, coin.y, 
                coin.x + coin.w/2 + 20, coin.y + 10,
                coin.x + coin.w/2, coin.y + 20);
      } else {
        // コイン
        fill(255, 215, 0);
        ellipse(coin.x + coin.w/2, coin.y + coin.h/2, coin.w, coin.h);
        fill(255, 180, 0);
        ellipse(coin.x + coin.w/2, coin.y + coin.h/2, coin.w * 0.6, coin.h * 0.6);
      }
    }
  }
  
  // 敵（クリボー風）
  for (let enemy of enemies) {
    if (enemy.isAlive) {
      push();
      translate(enemy.x + enemy.w/2, enemy.y + enemy.h/2);
      
      // 体
      fill(139, 69, 19);
      ellipse(0, 0, enemy.w, enemy.h);
      
      // 顔
      fill(160, 82, 45);
      ellipse(0, -2, enemy.w * 0.8, enemy.h * 0.7);
      
      // 目
      fill(0);
      ellipse(-5, -5, 4, 6);
      ellipse(5, -5, 4, 6);
      
      // 足
      fill(0);
      ellipse(-8, enemy.h/2 - 2, 8, 5);
      ellipse(8, enemy.h/2 - 2, 8, 5);
      
      pop();
    }
  }
  
  // ボス敵（クッパ風）
  if (boss && boss.isAlive) {
    push();
    translate(boss.x + boss.w/2, boss.y + boss.h/2);
    
    // 向きを反映
    if (boss.direction < 0) {
      scale(-1, 1);
    }
    
    // 体（緑色のトゲトゲの甲羅）
    fill(40, 120, 40);
    ellipse(0, 5, boss.w * 0.9, boss.h * 0.7);
    
    // トゲ
    fill(20, 80, 20);
    for (let i = -3; i <= 3; i++) {
      triangle(i * 8, -15, i * 8 - 3, -25, i * 8 + 3, -25);
    }
    
    // 頭
    fill(120, 180, 60);
    ellipse(0, -boss.h * 0.25, boss.w * 0.6, boss.h * 0.4);
    
    // 角
    fill(255, 255, 200);
    triangle(-10, -boss.h * 0.35, -8, -boss.h * 0.5, -6, -boss.h * 0.35);
    triangle(10, -boss.h * 0.35, 8, -boss.h * 0.5, 6, -boss.h * 0.35);
    
    // 目（赤く光る）
    fill(255, 0, 0);
    ellipse(-8, -boss.h * 0.25, 8, 10);
    ellipse(8, -boss.h * 0.25, 8, 10);
    fill(255, 255, 255);
    ellipse(-8, -boss.h * 0.27, 3, 3);
    ellipse(8, -boss.h * 0.27, 3, 3);
    
    // 口
    fill(0);
    arc(0, -boss.h * 0.15, boss.w * 0.4, 15, 0, PI);
    
    // 腕
    fill(120, 180, 60);
    ellipse(-boss.w * 0.4, 0, 20, 25);
    ellipse(boss.w * 0.4, 0, 20, 25);
    
    // 足
    fill(100, 150, 50);
    ellipse(-boss.w * 0.25, boss.h * 0.4, 18, 22);
    ellipse(boss.w * 0.25, boss.h * 0.4, 18, 22);
    
    // HPバー（ボスの上に表示）
    fill(0, 0, 0, 100);
    rect(-30, -boss.h * 0.7 - 5, 60, 8);
    fill(255, 0, 0);
    rect(-30, -boss.h * 0.7 - 5, 60 * (boss.hp / boss.maxHp), 8);
    
    pop();
  }
  
  // ファイアボール
  for (let fireball of fireballs) {
    if (fireball.isAlive) {
      push();
      translate(fireball.x + fireball.w/2, fireball.y + fireball.h/2);
      
      // 回転アニメーション
      rotate(frameCount * 0.3);
      
      // 炎の中心
      fill(255, 100, 0);
      ellipse(0, 0, fireball.w, fireball.h);
      
      // 炎の外側
      fill(255, 200, 0, 150);
      ellipse(0, 0, fireball.w * 1.3, fireball.h * 1.3);
      
      // 炎のエフェクト
      fill(255, 255, 200);
      ellipse(0, 0, fireball.w * 0.5, fireball.h * 0.5);
      
      pop();
    }
  }
  
  // プレイヤー
  if (player.invincible <= 0 || frameCount % 10 < 5) { // 無敵時は点滅
    drawPlayer(player);
  }
  
  pop();
}

function drawPlayer(p) {
  push();
  translate(p.x, p.y);
  
  if (p.facing < 0) {
    scale(-1, 1);
    translate(-p.w, 0);
  }
  
  // 小さい状態の場合、サイズ調整
  if (p.powerState === 'small') {
    scale(0.7, 0.7);
    translate(p.w * 0.15, p.h * 0.3);
  }
  
  // 影
  noStroke();
  fill(0, 0, 0, 50);
  ellipse(p.w * 0.5, p.h + 4, p.w * 1.2, 8);
  
  // 体（青いオーバーオール）
  fill(35, 90, 210);
  rect(2, 14, p.w - 4, p.h - 16, 6);
  fill(250, 200, 0);
  circle(8, 28, 6);
  circle(p.w - 8, 28, 6);
  
  // 腕
  fill(220, 70, 50);
  rect(-2, 20, 12, 8, 4);
  rect(p.w - 10 + 2, 20, 12, 8, 4);
  
  // 頭
  fill(255, 210, 170);
  rect(4, -6, p.w - 8, 22, 6);
  fill(200, 0, 0);
  rect(0, -10, p.w, 12, 6);
  rect(2, -10, p.w - 4, 6, 6);
  
  // 目と口ひげ
  fill(40);
  rect(9, 2, 3, 3, 1);
  rect(16, 2, 3, 3, 1);
  fill(90, 60, 40);
  rect(9, 8, 10, 3, 1);
  
  // 靴
  fill(90, 45, 15);
  rect(0, p.h - 6, 12, 6, 2);
  rect(p.w - 12, p.h - 6, 12, 6, 2);
  
  pop();
}

function drawHUD() {
  fill(0, 0, 0, 120);
  noStroke();
  rect(12, 12, 200, 80, 10);
  fill(255);
  textFont(myFont);
  textSize(18);
  text(`SCORE: ${nf(floor(score), 5)}`, 22, 40);
  text(`HI: ${nf(floor(hiScore), 5)}`, 22, 62);
  
  // パワー状態表示
  textSize(16);
  if (player.powerState === 'big') {
    fill(255, 215, 0);
    text('POWER: BIG', 22, 84);
  } else {
    fill(255, 100, 100);
    text('POWER: SMALL', 22, 84);
  }
  
  // 操作説明（英語のみ）
  fill(0, 0, 0, 120);
  rect(W - 220, 12, 208, 80, 10);
  fill(255);
  textSize(14);
  text('Arrow Keys: Move', W - 210, 35);
  text('UP: Jump', W - 210, 55);
  text('Stomp enemies!', W - 210, 75);
  text('Power: Big > Small > Game Over', W - 210, 90);
}

function drawLoadingScreen() {
  background(135, 206, 235);
  fill(255);
  textFont(myFont);
  textAlign(CENTER, CENTER);
  textSize(36);
  text('ORPHE CORE', W/2, H/2 - 100);
  text('2D ACTION', W/2, H/2 - 60);
  textSize(20);
  text('Connect your device', W/2, H/2);
  text('ORPHE CORE: Tilt & Shake', W/2, H/2 + 30);
  
  let statusText = `Connected: ${connectedDevices}/1`;
  text(statusText, W/2, H/2 + 60);
  
  textSize(18);
  fill(200, 200, 200);
  text('--- OR ---', W/2, H/2 + 100);
  
  textSize(16);
  fill(255);
  text('Play with Keyboard', W/2, H/2 + 140);
  text('Use Arrow Keys', W/2, H/2 + 160);
  
  textAlign(LEFT, BASELINE);
}

function uiTitle() {
  fill(0, 0, 0, 140);
  rect(W/2 - 260, H/2 - 100, 520, 200, 16);
  fill(255);
  textFont(myFont);
  textAlign(CENTER, CENTER);
  textSize(28);
  text('2D ACTION', W/2, H/2 - 40);
  textSize(18);
  text('Use Arrow Keys or ORPHE CORE', W/2, H/2 + 4);
  text('Starting in...', W/2, H/2 + 36);
  textAlign(LEFT, BASELINE);
}

function uiGameOver() {
  fill(0, 0, 0, 160);
  rect(W/2 - 260, H/2 - 100, 520, 200, 16);
  fill(255);
  textFont(myFont);
  textAlign(CENTER, CENTER);
  textSize(28);
  text('GAME OVER', W/2, H/2 - 40);
  textSize(20);
  text(`FINAL SCORE: ${floor(score)}`, W/2, H/2);
  textSize(16);
  text('Click REGAME to restart', W/2, H/2 + 40);
  textAlign(LEFT, BASELINE);
}

function uiClear() {
  fill(0, 0, 0, 160);
  rect(W/2 - 280, H/2 - 120, 560, 240, 16);
  
  // GOAL!メッセージ
  fill(255, 215, 0);
  textFont(myFont);
  textAlign(CENTER, CENTER);
  textSize(48);
  text('GOAL!', W/2, H/2 - 70);
  
  fill(255);
  textSize(24);
  text('STAGE CLEAR!', W/2, H/2 - 30);
  
  // クリアタイムとスコア表示
  textSize(20);
  let minutes = Math.floor(clearTime / 60);
  let seconds = (clearTime % 60).toFixed(1);
  text(`Clear Time: ${minutes}:${seconds.padStart(4, '0')}`, W/2, H/2 + 10);
  text(`Final Score: ${floor(score)}`, W/2, H/2 + 40);
  
  if (score >= hiScore) {
    fill(255, 215, 0);
    text('NEW HIGH SCORE!', W/2, H/2 + 70);
  }
  textAlign(LEFT, BASELINE);
}

function gameOver() {
  if (floor(score) > hiScore) {
    hiScore = floor(score);
    localStorage.setItem("orphe_2d_action_hi", hiScore);
  }
  bgmA.stop();
  damageSound.play();
  gamestage = 2;
}

// カウントダウン関連
function count3s() {
  if (millis() - lastUpdateTime >= 1000) {
    counter3--;
    lastUpdateTime = millis();
    counterVisible = true;
  }
  
  if (counterVisible && counter3 > 0) {
    fill(255, 255, 0);
    textAlign(CENTER, CENTER);
    textSize(100);
    text(counter3, W/2, H/2);
    textAlign(LEFT, BASELINE);
  }
}

function checkStartGame() {
  if (counter3 <= 0 && !farstgame) {
    state = "play";
    gameStartTime = millis();  // ゲーム開始時刻を記録
    resetGame(true);
  } else if (counter3 <= 0) {
    state = "play";
    gameStartTime = millis();  // ゲーム開始時刻を記録
    farstgame = false;
  }
}

function checkStartGame_regame() {
  if (counter3 <= 0) {
    state = "play";
    gameStartTime = millis();  // ゲーム開始時刻を記録
    resetGame(true);
  }
}

function reGame() {
  gamestage = 1;
  state = "title";
  counter3 = 3; // カウントダウンを3に
  lastUpdateTime = millis();
  button.style('display', 'none');
  bgmB.stop();
}

// キーボード入力（ジャンプの即時反応用）
function keyPressed() {
  if (state === "play" && keyCode === UP_ARROW) {
    if (player.onGround) {
      player.vy = JUMP_POWER;
      player.onGround = false;
      jumpSound.play();
    }
    return false;
  }
}

// デバイスなしでゲーム開始
function startGameWithoutDevice() {
  gamestage = 1;
  state = "title";
  counter3 = 3; // カウントダウンを3に
  lastUpdateTime = millis();
  startButton.style('display', 'none');
}

// プレイヤーダメージ処理
function handlePlayerDamage() {
  damageSound.play();
  player.invincible = 2.0; // 2秒間無敵
  player.vx = -player.facing * 200; // ノックバック
  player.vy = -300;
  
  if (player.powerState === 'big') {
    // 大きい状態から小さい状態へ
    player.powerState = 'small';
    player.h = 30; // 高さを小さく
    score = max(0, score - 50);
  } else {
    // 小さい状態からゲームオーバー
    gameOver();
  }
}
