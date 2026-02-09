/**
 * ORPHE CORE 連携および UI/デバッグ表示ロジック
 */

// --- ORPHE Global Variables ---
let ble;
let sensorData = {
    roll: 0, 
    rollFiltered: 0,
    rollOffset: 0,
    pitch: 0,
    pitchFiltered: 0,
    pitchOffset: 0,
    gyroCombined: 0,
    connected: false
};

/**
 * ORPHE CORE の初期化とコールバック設定
 */
function initORPHE() {
    ble = new Orphe(0);
    ble.setup();
    
    ble.gotEuler = function(euler) {
        sensorData.roll = euler.roll;
        sensorData.pitch = euler.pitch;
    };

    ble.gotConvertedGyro = function(gyro) {
        let mag = Math.sqrt(gyro.x*gyro.x + gyro.y*gyro.y + gyro.z*gyro.z);
        sensorData.gyroCombined = mag;
        checkJump(mag);                
    };

    ble.lostData = function(num, num_prev) {
        logDebug(`Lost Data! ${num} - ${num_prev}`);
        const statusEl = document.getElementById('val-status');
        if (statusEl) {
            statusEl.innerText = "LOST PAC";
            statusEl.style.color = "red";
            setTimeout(() => {
                statusEl.innerText = "OK";
                statusEl.style.color = "white";
            }, 500);
        }
    };
}

/**
 * キャリブレーション開始
 */
function startCalibration() {
    gameState = 'CALIBRATING';
    document.getElementById('btn-calibrate').innerText = "Calibrating...";
    calibrationSum = 0;
    calibrationSumPitch = 0;
    calibrationCount = 0;
    calibrationTimer = millis();
    logDebug("Calibration Started");
}

/**
 * キャリブレーション終了
 */
function finishCalibration() {
    if (calibrationCount > 0) {
        sensorData.rollOffset = calibrationSum / calibrationCount;
        sensorData.pitchOffset = calibrationSumPitch / calibrationCount;
    }
    logDebug(`Calibration Done. RollOff: ${sensorData.rollOffset.toFixed(2)}, PitchOff: ${sensorData.pitchOffset.toFixed(2)}`);
    gameState = 'READY';
    document.getElementById('btn-calibrate').innerText = "Recalibrate";
    document.getElementById('btn-start').disabled = false;
    document.getElementById('connection-status').innerText = "Status: Ready";
}

/**
 * UI表示（文字情報）の更新 - DEPRECATED: Using Canvas HUD now
 */
function updateUI() {
    // Canvas描画に移行したため、DOM更新処理を除去
}


/**
 * HUD（ヘッドアップディスプレイ）の描画
 */
function drawHUD(p) {
    p.push();
    
    // --- 共通フォント設定 ---
    p.textFont('Courier New');
    p.textStyle(p.BOLD);

    // 1. スコア & タイム表示 (Pixely Style)
    // 枠線付きの文字で視認性を確保
    p.fill(255);
    p.stroke(0);
    p.strokeWeight(4); 
    p.textSize(20);

    // Score (左上)
    p.textAlign(p.LEFT, p.TOP);
    p.text(`SCORE: ${score}`, 20, 20);

    // Time (右上)
    p.textAlign(p.RIGHT, p.TOP);
    p.text(`TIME: ${(gameTime/60).toFixed(1)}`, p.width - 20, 20);

    // 2. 無敵演出
    if (player.invincibleTimer > 0) {
        p.stroke(0);
        p.strokeWeight(2);
        p.textSize(12);
        
        let isCritical = player.invincibleTimer < 180; // Last 3 seconds
        let flashSpeed = isCritical ? 10 : 30;
        
        if (p.frameCount % flashSpeed < flashSpeed / 2) {
            p.fill(isCritical ? p.color(255, 0, 0) : p.color(255, 255, 0));
            p.stroke(0);
            p.textAlign(p.CENTER, p.TOP);
            let txt = `INVINCIBLE!!`;
            if (isCritical) {
                let secondsLeft = Math.ceil(player.invincibleTimer / 60);
                txt = `DANGER: ${secondsLeft}`;
            }
            p.text(txt, p.width / 2, 50); // スコアの下に配置
        }
        p.noStroke();
        p.fill(isCritical ? p.color(255, 0, 0) : p.color(255, 215, 0));
        p.rect(p.width / 2 - 30, 65, (player.invincibleTimer / GAME_CONFIG.INVINCIBLE_DURATION) * 60, 3);
    }
    
    p.pop();
}

/**
 * ゲームオーバー画面の描画
 */
function drawGameOver(p) {
    if (typeof drawPanelUI === 'function') {
        drawPanelUI(p, "GAME OVER", true);
    } else {
        // Fallback if ui.js not loaded
        p.fill(0, 0, 0, 180);
        p.rect(0, 0, p.width, p.height);
        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.text("GAME OVER", p.width/2, p.height/2);
    }
}

