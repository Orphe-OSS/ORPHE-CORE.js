// マリオゲーム変数定義
let mario;
let platforms = [];
let enemies = [];
let coins = [];
let camera = { x: 0, y: 0 };
let score = 0;
let lives = 3;
let gameStarted = false;
let gameOver = false;
let isWon = false;

// 設定用変数
let playerSpeedConfig = 3;
let jumpPowerConfig = 15;
let walkSensitivityConfig = 1.5;
let jumpSensitivityConfig = 1.2;
let gravityConfig = 0.8;
let enemySpeedConfig = 1;

// UI・演出用変数
let counter3 = 4;
let lastUpdateTime = 0;
let counterVisible = true;
let farstgame = true;
let button;
let myFont;

// 音声関連
let bgmA, bgmB;
let jumpSound, coinSound, damageSound, gameOverSound, victorySound;
let bgmcont1 = 0;
let bgmcont2 = 0;

// センサー入力管理
let walkDetected = false;
let jumpDetected = false;
let lastStepTime = 0;
let lastJumpTime = 0;

function preload() {
    myFont = loadFont('BebasNeue-Regular.ttf');
    
    // BGM
    bgmA = loadSound('sound/BGMA.mp3');
    bgmB = loadSound('sound/BGMB.mp3');
    
    // 8bit効果音
    jumpSound = loadSound('sound/8bitジャンプ.mp3');
    coinSound = loadSound('sound/8bit取得1.mp3');
    damageSound = loadSound('sound/8bitダメージ1.mp3');
    gameOverSound = loadSound('sound/8bit失敗1.mp3');
    victorySound = loadSound('sound/8bit獲得2.mp3');
}

function setup() {
    let cnv = createCanvas(windowWidth * 0.8, windowHeight / 2);
    cnv.parent('p5Canvas');
    textFont(myFont);
    
    // ゲーム初期化
    initGame();
    
    // BGM設定
    bgmA.setVolume(0.1);
    bgmB.setVolume(0.1);
    jumpSound.setVolume(0.3);
    coinSound.setVolume(0.4);
    damageSound.setVolume(0.3);
    gameOverSound.setVolume(0.4);
    victorySound.setVolume(0.4);
    
    // UI設定
    button = createButton('ReGame');
    setupReGameButton();
    button.style('display', 'none');
    
    frameRate(60);
}

function draw() {
    background(135, 206, 235); // 空色の背景
    
    switch (gamestage) {
        case 0: // デバイス接続待ち
            drawLoadingScreen();
            break;
        case 1: // ゲーム中
            playBGM(1);
            bgmcont2 = 0;
            button.style('display', 'none');
            
            count3s();
            
            if (farstgame == false) {
                checkStartGame_regame();
            } else {
                checkStartGame();
            }
            
            if (gameStarted && !gameOver) {
                updateGame();
                drawGame();
            }
            break;
        case 2: // ゲーム終了
            playBGM(2);
            bgmcont1 = 0;
            showGameOverMessage();
            farstgame = false;
            counter3 = 3;
            gameStarted = false;
            button.style('display', 'inline-block');
            break;
    }
}

function initGame() {
    // マリオの初期化
    mario = new Mario(100, height - 100);
    
    // プラットフォームの生成
    platforms = [];
    // 地面
    platforms.push(new Platform(0, height - 50, width * 3, 50));
    // 空中プラットフォーム
    platforms.push(new Platform(200, height - 150, 100, 20));
    platforms.push(new Platform(400, height - 200, 100, 20));
    platforms.push(new Platform(600, height - 120, 100, 20));
    platforms.push(new Platform(800, height - 180, 100, 20));
    platforms.push(new Platform(1000, height - 250, 100, 20));
    platforms.push(new Platform(1200, height - 150, 100, 20));
    platforms.push(new Platform(1500, height - 200, 150, 20));
    
    // 敵の生成
    enemies = [];
    enemies.push(new Enemy(300, height - 100));
    enemies.push(new Enemy(500, height - 100));
    enemies.push(new Enemy(700, height - 170));
    enemies.push(new Enemy(900, height - 100));
    enemies.push(new Enemy(1100, height - 100));
    enemies.push(new Enemy(1300, height - 200));
    
    // コインの生成
    coins = [];
    coins.push(new Coin(250, height - 180));
    coins.push(new Coin(450, height - 230));
    coins.push(new Coin(650, height - 150));
    coins.push(new Coin(850, height - 210));
    coins.push(new Coin(1050, height - 280));
    coins.push(new Coin(1250, height - 180));
    coins.push(new Coin(1550, height - 230));
    coins.push(new Coin(1600, height - 230));
    
    // ゲーム状態リセット
    score = 0;
    lives = 3;
    gameOver = false;
    isWon = false;
    camera.x = 0;
    camera.y = 0;
}

function updateGame() {
    // センサー入力の処理
    processSensorInput();
    
    // マリオの更新
    mario.update();
    
    // カメラの更新
    updateCamera();
    
    // 敵の更新
    for (let enemy of enemies) {
        enemy.update();
        
        // マリオと敵の衝突判定
        if (mario.collidesWith(enemy) && !mario.isInvincible) {
            damageSound.play();
            lives--;
            mario.takeDamage();
            
            if (lives <= 0) {
                gameOverSound.play();
                gameOver = true;
                gamestage = 2;
            }
        }
    }
    
    // コインの収集判定
    for (let i = coins.length - 1; i >= 0; i--) {
        if (mario.collidesWith(coins[i])) {
            coinSound.play();
            score += 100;
            coins.splice(i, 1);
        }
    }
    
    // ゴール判定（全コイン収集）
    if (coins.length === 0 && !isWon) {
        victorySound.play();
        isWon = true;
        gamestage = 2;
    }
    
    // 落下判定
    if (mario.y > height + 100) {
        damageSound.play();
        lives--;
        mario.respawn();
        
        if (lives <= 0) {
            gameOverSound.play();
            gameOver = true;
            gamestage = 2;
        }
    }
}

function drawGame() {
    push();
    translate(-camera.x, -camera.y);
    
    // プラットフォーム描画
    for (let platform of platforms) {
        platform.display();
    }
    
    // 敵描画
    for (let enemy of enemies) {
        enemy.display();
    }
    
    // コイン描画
    for (let coin of coins) {
        coin.display();
    }
    
    // マリオ描画
    mario.display();
    
    pop();
    
    // UI描画
    drawUI();
}

function drawUI() {
    // スコア表示
    fill(255);
    textSize(24);
    textAlign(LEFT, TOP);
    text('Score: ' + score, 10, 10);
    text('Lives: ' + lives, 10, 40);
    text('Coins: ' + coins.length, 10, 70);
}

function updateCamera() {
    // マリオを追従するカメラ
    camera.x = mario.x - width / 3;
    camera.x = constrain(camera.x, 0, width * 2);
}

function processSensorInput() {
    if (connectedDevices >= 1) {
        // 歩行検知
        let currentSteps = devices[0].gaits.steps;
        if (currentSteps > 0 && millis() - lastStepTime > 300) {
            walkDetected = true;
            lastStepTime = millis();
        }
        
        // ジャンプ検知（着地衝撃を利用）
        let impact = devices[0].pronations.landing_impact;
        if (impact > jumpSensitivityConfig && millis() - lastJumpTime > 500) {
            jumpDetected = true;
            lastJumpTime = millis();
        }
        
        // マリオに入力を適用
        if (walkDetected) {
            mario.moveRight();
            walkDetected = false;
        }
        
        if (jumpDetected && mario.onGround) {
            mario.jump();
            jumpSound.play();
            jumpDetected = false;
        }
    }
}

// マリオクラス
class Mario {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 30;
        this.h = 40;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.facingRight = true;
    }
    
    update() {
        // 重力適用
        this.vy += gravityConfig;
        
        // 位置更新
        this.x += this.vx;
        this.y += this.vy;
        
        // 摩擦
        this.vx *= 0.8;
        
        // プラットフォームとの衝突判定
        this.onGround = false;
        for (let platform of platforms) {
            if (this.collidesWith(platform)) {
                if (this.vy > 0) { // 落下中
                    this.y = platform.y - this.h;
                    this.vy = 0;
                    this.onGround = true;
                }
            }
        }
        
        // 無敵時間の処理
        if (this.isInvincible) {
            this.invincibilityTimer--;
            if (this.invincibilityTimer <= 0) {
                this.isInvincible = false;
            }
        }
    }
    
    moveRight() {
        this.vx += playerSpeedConfig * walkSensitivityConfig;
        this.vx = constrain(this.vx, -8, 8);
        this.facingRight = true;
    }
    
    jump() {
        if (this.onGround) {
            this.vy = -jumpPowerConfig;
        }
    }
    
    takeDamage() {
        this.isInvincible = true;
        this.invincibilityTimer = 120; // 2秒間無敵
        this.vx = this.facingRight ? -5 : 5; // ノックバック
        this.vy = -8;
    }
    
    respawn() {
        this.x = 100;
        this.y = height - 100;
        this.vx = 0;
        this.vy = 0;
    }
    
    collidesWith(other) {
        return this.x < other.x + other.w &&
               this.x + this.w > other.x &&
               this.y < other.y + other.h &&
               this.y + this.h > other.y;
    }
    
    display() {
        push();
        
        // 無敵時は点滅
        if (this.isInvincible && frameCount % 10 < 5) {
            tint(255, 100);
        }
        
        // マリオの描画（簡単な四角形）
        fill(255, 0, 0); // 赤色
        stroke(0);
        strokeWeight(2);
        rect(this.x, this.y, this.w, this.h);
        
        // 帽子
        fill(255, 0, 0);
        rect(this.x + 5, this.y - 10, this.w - 10, 10);
        
        // 顔
        fill(255, 220, 177);
        rect(this.x + 8, this.y + 5, this.w - 16, 15);
        
        // オーバーオール
        fill(0, 0, 255);
        rect(this.x + 3, this.y + 20, this.w - 6, this.h - 20);
        
        pop();
    }
}

// プラットフォームクラス
class Platform {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
    
    display() {
        fill(139, 69, 19); // 茶色
        stroke(0);
        strokeWeight(1);
        rect(this.x, this.y, this.w, this.h);
    }
}

// 敵クラス
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 25;
        this.h = 25;
        this.vx = enemySpeedConfig * (random() > 0.5 ? 1 : -1);
        this.direction = this.vx > 0 ? 1 : -1;
    }
    
    update() {
        this.x += this.vx;
        
        // 画面端での反転
        if (this.x <= 0 || this.x >= width * 3 - this.w) {
            this.vx *= -1;
            this.direction *= -1;
        }
        
        // プラットフォームの端での反転
        let onPlatform = false;
        for (let platform of platforms) {
            if (this.y + this.h >= platform.y && 
                this.y + this.h <= platform.y + platform.h + 10 &&
                this.x + this.w > platform.x && 
                this.x < platform.x + platform.w) {
                onPlatform = true;
                break;
            }
        }
        
        if (!onPlatform) {
            this.vx *= -1;
            this.direction *= -1;
        }
    }
    
    display() {
        // 敵の描画（茶色のクリボー風）
        fill(139, 69, 19);
        stroke(0);
        strokeWeight(1);
        ellipse(this.x + this.w/2, this.y + this.h/2, this.w, this.h);
        
        // 目
        fill(0);
        ellipse(this.x + this.w/3, this.y + this.h/3, 3, 3);
        ellipse(this.x + 2*this.w/3, this.y + this.h/3, 3, 3);
    }
}

// コインクラス
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 20;
        this.h = 20;
        this.rotation = 0;
    }
    
    display() {
        push();
        translate(this.x + this.w/2, this.y + this.h/2);
        rotate(this.rotation);
        this.rotation += 0.1;
        
        fill(255, 215, 0); // 金色
        stroke(255, 165, 0);
        strokeWeight(2);
        ellipse(0, 0, this.w, this.h);
        
        // コインの模様
        fill(255, 165, 0);
        textAlign(CENTER, CENTER);
        textSize(12);
        text('¥', 0, 0);
        
        pop();
    }
}

// その他のゲーム関数群（既存のものを流用・改変）
function drawLoadingScreen() {
    background(255, 255, 255, 100);
    textAlign(CENTER, CENTER);
    textSize(80);
    fill(255);
    text("Device loading…", width / 2, height / 2);
    textAlign(CENTER, CENTER);
    textSize(20);
    textFont('Meiryo');
    fill(255, 255, 255, 200);
    text("ORPHE COREを接続してください…", width / 2, height / 2 + 60);
    textFont(myFont);
}

function count3s() {
    if (counterVisible) {
        if (millis() - lastUpdateTime >= 1000) {
            counter3--;
            lastUpdateTime = millis();
        }
        
        if (counter3 >= 0) {
            fill(255);
            textSize(100);
            textAlign(CENTER, CENTER);
            text(counter3, width / 2, height / 2);
        } else {
            if (millis() - lastUpdateTime >= 1000) {
                counterVisible = false;
            }
        }
    }
}

function checkStartGame() {
    if (connectedDevices >= 1 && !gameStarted) {
        setTimeout(startGame, 3000);
    }
}

function checkStartGame_regame() {
    if (gameStarted === false) {
        setTimeout(startGame, 3000);
    }
}

var ccc = 0;
function startGame() {
    if (ccc === 0) {
        gameStarted = true;
        ccc++;
    }
}

function showGameOverMessage() {
    noLoop();
    textAlign(CENTER, CENTER);
    textSize(80);
    fill(255);
    if (isWon) {
        text("Congratulations!", width / 2, height / 2 - 50);
        textSize(40);
        text("All coins collected!", width / 2, height / 2 + 20);
    } else {
        text("Game Over!", width / 2, height / 2);
    }
}

function playBGM(number) {
    if (bgmcont1 === 0 && number === 1) {
        bgmB.stop();
        bgmA.loop();
        bgmcont1++;
    } else if (bgmcont2 === 0 && number === 2) {
        bgmA.stop();
        bgmB.loop();
        bgmcont2++;
    }
}

function setupReGameButton() {
    button.position(width / 2 - 40, height / 2 + 300);
    button.mousePressed(regame);
    button.style('background-color', '#19191A');
    button.style('color', 'white');
    button.style('border', 'none');
    button.style('padding', '10px 20px');
    button.style('text-align', 'center');
    button.style('text-decoration', 'none');
    button.style('display', 'inline-block');
    button.style('font-size', '16px');
    button.style('margin', '4px 2px');
    button.style('transition-duration', '0.4s');
    button.style('cursor', 'pointer');
}

function regame() {
    loop();
    gamestage = 1;
    counterVisible = true;
    counter3 = 3;
    ccc = 0;
    initGame();
}

// 設定更新関数
function updatePlayerSpeed(speed) {
    playerSpeedConfig = speed;
}

function updateJumpPower(power) {
    jumpPowerConfig = power;
}

function updateWalkSensitivity(sensitivity) {
    walkSensitivityConfig = sensitivity;
}

function updateJumpSensitivity(sensitivity) {
    jumpSensitivityConfig = sensitivity;
}

function updateGravity(gravity) {
    gravityConfig = gravity;
}

function updateEnemySpeed(speed) {
    enemySpeedConfig = speed;
    for (let enemy of enemies) {
        enemy.vx = speed * (enemy.vx > 0 ? 1 : -1);
    }
}