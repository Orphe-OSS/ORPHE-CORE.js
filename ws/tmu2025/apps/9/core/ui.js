// UI State Variables
let uiState = {
    buttons: [],
    debugPanelVisible: false,
    hasDebugParam: false // Cache this
};

class SimpleButton {
    constructor(id, label, x, y, w, h, onClick, options = {}) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.onClick = onClick;
        this.visible = true;
        this.enabled = true;
        
        // Style Options
        this.bgColor = options.bgColor || 255;
        this.textColor = options.textColor || 0;
        this.borderColor = options.borderColor || 0;
        this.isVertical = options.isVertical || false; // Vertical text rotation
    }

    draw(p) {
        if (!this.visible) return;

        p.push();
        p.strokeWeight(4);
        
        let isHover = (
            p.mouseX >= this.x && p.mouseX <= this.x + this.w &&
            p.mouseY >= this.y && p.mouseY <= this.y + this.h
        );
        let isPressed = isHover && p.mouseIsPressed;

        // Shadow
        if (!isPressed && this.enabled) {
            p.fill(0);
            p.noStroke();
            p.rect(this.x + 4, this.y + 4, this.w, this.h);
        }

        // Offset when pressed
        let drawX = this.x + (isPressed ? 2 : 0);
        let drawY = this.y + (isPressed ? 2 : 0);

        // Body
        if (this.enabled) {
            p.fill(isHover ? 240 : this.bgColor);
            p.stroke(this.borderColor);
        } else {
            p.fill(150);
            p.stroke(100);
        }
        
        p.rect(drawX, drawY, this.w, this.h);

        // Text
        p.noStroke();
        p.fill(this.enabled ? this.textColor : 100);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(this.isVertical ? 10 : 14);
        p.textStyle(p.BOLD);

        if (this.isVertical) {
            p.push();
            p.translate(drawX + this.w / 2, drawY + this.h / 2);
            p.rotate(-p.HALF_PI); // Rotate 90 deg CCW
            p.text(this.label, 0, 0);
            p.pop();
        } else {
            p.text(this.label, drawX + this.w / 2, drawY + this.h / 2);
        }

        p.pop();
    }

    checkClick(mx, my) {
        if (!this.visible || !this.enabled) return false;
        if (mx >= this.x && mx <= this.x + this.w &&
            my >= this.y && my <= this.y + this.h) {
            if (typeof playSFX === 'function') playSFX('click');
            this.onClick();
            return true;
        }
        return false;
    }
}

/**
 * スタートメニュー / ゲームオーバー画面の共通描画
 */
function drawPanelUI(p, title = "ORPHE WIRE WALKER", showStats = false) {
    p.push();
    
    // Use global width/height directly to avoid issues with 'window.width'
    let currentW = (typeof width !== 'undefined') ? width : p.width;
    let currentH = (typeof height !== 'undefined') ? height : p.height;

    // Semi-transparent background
    p.fill(0, 0, 0, 150);
    p.noStroke();
    p.rect(0, 0, currentW, currentH);

    // Panel Background
    let panelW = 240; 
    let panelH = showStats ? 200 : 180; 
    let panelX = currentW/2 - panelW/2;
    let panelY = currentH/2 - panelH/2;

    p.stroke(255);
    p.strokeWeight(4);
    p.fill(0);
    p.rect(panelX, panelY, panelW, panelH);

    // Title
    p.fill(255);
    p.noStroke();
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(16); 
    p.textStyle(p.BOLD);
    p.text(title, currentW/2, panelY + 15);

    let contentY = panelY + 40;

    if (showStats) {
        p.textSize(16);
        p.fill(255);
        p.text(`FINAL SCORE: ${score}`, currentW/2, contentY);
        p.text(`TIME: ${(gameTime/60).toFixed(1)}s`, currentW/2, contentY + 25);
        contentY += 60;
    } else {
        // Status (Only on Start Menu)
        p.textSize(12);
        p.fill(200);
        let statusText = "STATUS: DISCONNECTED";
        if (gameState === 'CONNECTED' || gameState === 'READY') statusText = "STATUS: CONNECTED";
        if (gameState === 'CALIBRATING') statusText = "STATUS: CALIBRATING...";
        p.text(statusText, currentW/2, contentY);
        contentY += 25;
    }

    // Draw Buttons managed in uiState
    uiState.buttons.forEach(btn => {
        if (btn.id.startsWith('menu_')) {
            btn.draw(p);
        }
    });

    // Instruction Text for Demo
    if (!showStats && (gameState === 'INIT' || gameState === 'CONNECTED')) {
        p.textSize(9); 
        p.fill(180);
        p.text("Press 'Start Game' for Demo Mode", currentW/2, panelY + panelH - 15);
    }
    
    p.pop();
}

/**
 * スタートメニュー画面の描画 (Legacy wrapper)
 */
function drawStartMenu(p) {
    drawPanelUI(p, "ORPHE WIRE WALKER", false);
}


function drawCommonUI(p) {
    p.push();
    uiState.buttons.forEach(btn => {
        if (!btn.id.startsWith('menu_')) { // Draw non-menu buttons (always visible ones)
            btn.draw(p);
        }
        // Force draw back button during Tutorial
        if (btn.id === 'menu_back' && gameState === 'TUTORIAL') {
            btn.draw(p);
        }
    });
    p.pop();
}

function initUIButtons() {
    uiState.buttons = [];

    // Cache debug param
    const urlParams = new URLSearchParams(window.location.search);
    uiState.hasDebugParam = urlParams.has('debug');

    // Use global width/height as fallback
    let currentW = (typeof width !== 'undefined') ? width : GAME_CONFIG.LOGICAL_WIDTH;
    let currentH = (typeof height !== 'undefined') ? height : GAME_CONFIG.LOGICAL_HEIGHT;

    let cx = currentW / 2;
    let cy = currentH / 2;
    let btnW = 180; 
    let btnH = 26;  
    let spacing = 32;
    let startY = cy - 20; 

    // 1. Connect Button
    uiState.buttons.push(new SimpleButton('menu_connect', 'Connect ORPHE', cx - btnW/2, startY, btnW, btnH, () => {
        setupOrphe();
    }));

    // 2. Calibrate Button
    let btnCalib = new SimpleButton('menu_calibrate', 'Calibrate', cx - btnW/2, startY + spacing, btnW, btnH, () => {
        startCalibration();
    }, { bgColor: 0, textColor: 255, borderColor: 255 });
    btnCalib.enabled = false;
    uiState.buttons.push(btnCalib);

    // 3a. Tutorial Button (Half width)
    uiState.buttons.push(new SimpleButton('menu_tutorial', 'Tutorial', cx - btnW/2, startY + spacing * 2, btnW/2 - 2, btnH, () => {
        console.log("Tutorial button logic triggered");
        // Use window explicitly to ensure global access
        if (typeof window.startTutorial === 'function') {
            window.startTutorial();
        } else if (typeof startTutorial === 'function') {
            startTutorial();
        } else {
            console.error("startTutorial function not found!");
        }
    }));

    // 3b. Start Button (Half width, right side)
    let btnStart = new SimpleButton('menu_start', 'Start', cx + 2, startY + spacing * 2, btnW/2 - 2, btnH, () => {
        if (gameState === 'GAMEOVER') {
            // If in Game Over, clicking the button returns to the Start Menu
            gameState = 'INIT';
        } else {
            startGame();
        }
    });
    btnStart.enabled = true; 
    uiState.buttons.push(btnStart);


    // 4. Background Toggle (Right Edge, Vertical)
    uiState.buttons.push(new SimpleButton('btn_bg', '☀️', currentW - 20, 10, 20, 50, () => {
        toggleBackground();
    }, { isVertical: true }));

    // 5. Debug Toggle (Right Edge, Vertical)
    uiState.buttons.push(new SimpleButton('btn_debug', 'DBG', currentW - 20, 70, 20, 50, () => {
        toggleDebugPanel();
    }, { isVertical: true }));

    // 6. Mute Toggle (Right Edge, Vertical)
    uiState.buttons.push(new SimpleButton('btn_mute', '🔊', currentW - 20, 130, 20, 50, () => {
        if (typeof toggleMute === 'function') toggleMute();
    }, { isVertical: true }));

    // 7. Back to Menu Button (Tutorial only)
    uiState.buttons.push(new SimpleButton('menu_back', 'メインメニューに戻る', cx - 80, currentH - 40, 160, 24, () => {
        gameState = 'INIT';
    }, { bgColor: [100, 100, 100], textColor: 255 }));
}


function updateButtonState() {
    let btnConnect = uiState.buttons.find(b => b.id === 'menu_connect');
    let btnCalib = uiState.buttons.find(b => b.id === 'menu_calibrate');
    let btnStart = uiState.buttons.find(b => b.id === 'menu_start');
    let btnTutorial = uiState.buttons.find(b => b.id === 'menu_tutorial');
    let btnBack = uiState.buttons.find(b => b.id === 'menu_back');

    // Default visibility
    btnConnect.visible = true;
    btnCalib.visible = true;
    btnStart.visible = true;
    if (btnTutorial) btnTutorial.visible = true;
    if (btnBack) btnBack.visible = (gameState === 'TUTORIAL');

    // Default positions (restore from init)
    let currentW = (typeof width !== 'undefined') ? width : GAME_CONFIG.LOGICAL_WIDTH;
    let currentH = (typeof height !== 'undefined') ? height : GAME_CONFIG.LOGICAL_HEIGHT;
    let cx = currentW / 2;
    let cy = currentH / 2;
    let startY = cy - 20; 
    let spacing = 32;
    let btnW = 180;

    btnConnect.y = startY;
    btnCalib.y = startY + spacing;
    btnStart.y = startY + spacing * 2;
    btnStart.x = cx + 2;
    btnStart.w = btnW / 2 - 2;
    if (btnTutorial) {
        btnTutorial.y = startY + spacing * 2;
        btnTutorial.x = cx - btnW / 2;
        btnTutorial.w = btnW / 2 - 2;
    }

    if (gameState === 'TUTORIAL') {
        btnConnect.visible = false;
        btnCalib.visible = false;
        btnStart.visible = false;
        if (btnTutorial) btnTutorial.visible = false;
    } else if (gameState === 'INIT') {
        btnConnect.label = "Connect ORPHE";
        btnConnect.enabled = true;
        btnCalib.enabled = false;
        btnStart.label = "Start";
    } else if (gameState === 'CONNECTED') {
        btnConnect.label = "Connected";
        btnConnect.enabled = false;
        btnCalib.enabled = true;
    } else if (gameState === 'READY') {
        btnCalib.enabled = true;
        btnCalib.label = "Recalibrate";
    } else if (gameState === 'GAMEOVER') {
        // Hide other buttons
        btnConnect.visible = false;
        btnCalib.visible = false;
        if (btnTutorial) btnTutorial.visible = false;
        
        // Center the start button and change label
        btnStart.label = "RESTART";
        btnStart.x = cx - btnW / 2; // Return to full width centering (or consistent width)
        btnStart.w = btnW;
        btnStart.y = cy + 20; // Lower a bit to clear stats
        btnStart.enabled = true;
    }

    // Toggle icon update
    let btnBg = uiState.buttons.find(b => b.id === 'btn_bg');
    let btnDebug = uiState.buttons.find(b => b.id === 'btn_debug');
    let btnMute = uiState.buttons.find(b => b.id === 'btn_mute');
    
    if (gameState === 'PLAYING' || gameState === 'GAMEOVER') {
        // Hide config buttons during active gameplay or gameover
        if (btnBg) btnBg.visible = false;
        if (btnDebug) btnDebug.visible = false;
        if (btnMute) btnMute.visible = false;
    } else {
        // Show BG toggle always in menu, but DBG only if ?debug exists
        if (btnBg) btnBg.visible = true;
        if (btnDebug) btnDebug.visible = uiState.hasDebugParam;
        if (btnMute) btnMute.visible = true;
    }

    if (btnBg) {
        btnBg.label = currentBgMode === 'day' ? '☀️' : '🌙';
    }
    if (btnMute) {
        btnMute.label = isMuted ? '🔇' : '🔊';
    }
}

async function setupOrphe() {
    // Wrapper to act as the original HTML button did
    if (typeof initORPHE === 'function') {
        initORPHE();
        try {
            // Use begin if available (as seen in original index.html)
            if (ble && typeof ble.begin === 'function') {
                await ble.begin('STEP_ANALYSIS_AND_SENSOR_VALUES');
            }
            sensorData.connected = true;
            demoMode = false;
            gameState = 'CONNECTED';
            updateButtonState();
            logDebug("Connected to ORPHE");
        } catch (e) {
            console.error("Connection failed:", e);
            logDebug("Connection Failed");
        }
    } else {
        console.error("initORPHE function not found!");
    }
}


function handleMouseClick(mx, my) {
    // 1. デバッグパネル表示中は、パネル領域（画面右側 320px 相当）へのクリックを完全にブロック
    if (uiState.debugPanelVisible) {
        let canvasEl = document.querySelector('canvas');
        if (canvasEl) {
            let rect = canvasEl.getBoundingClientRect();
            
            // Canvasの論理座標(mx)を、ブラウザのビューポート座標(clientX)に変換して判定する
            // Modalは画面右端(right:0)から320px幅で固定配置されている
            let modalLeftInViewport = window.innerWidth - 320;
            let scale = rect.width / GAME_CONFIG.LOGICAL_WIDTH;
            let clickXInViewport = rect.left + (mx * scale);

            if (clickXInViewport > modalLeftInViewport) {
                // クリック位置がモーダルパネルの領域内にある場合、Canvas上のボタン反応をブロック
                return true; 
            }
        }
    }

    // 2. ボタンのクリック判定
    let menuVisible = (gameState === 'INIT' || gameState === 'CONNECTED' || gameState === 'READY' || gameState === 'CALIBRATING' || gameState === 'GAMEOVER' || gameState === 'TUTORIAL');
    if (gameState === 'PLAYING') menuVisible = false; // Ensure menu buttons don't react during play
    
    let processed = false;
    // 逆順でループして前面のボタンから判定
    for (let i = uiState.buttons.length - 1; i >= 0; i--) {
        let btn = uiState.buttons[i];
        if (btn.id.startsWith('menu_')) {
            if (menuVisible && btn.checkClick(mx, my)) {
                processed = true;
                break;
            }
        } else {
            if (btn.checkClick(mx, my)) {
                processed = true;
                break;
            }
        }
    }

    // 3. チュートリアルの進行判定 (ボタン外クリック)
    if (!processed && gameState === 'TUTORIAL') {
        if (typeof tutorialSteps !== 'undefined' && typeof tutorialStep !== 'undefined') {
            let step = tutorialSteps[tutorialStep];
            if (step.condition === "NONE" || step.condition === "FINISH") {
                if (typeof nextTutorialStep === 'function') {
                    nextTutorialStep();
                    processed = true;
                }
            }
        }
    }

    return processed;
}

function toggleBackground() {
    currentBgMode = (currentBgMode === 'day') ? 'night' : 'day';
}

function toggleDebugPanel() {
    uiState.debugPanelVisible = !uiState.debugPanelVisible;
    const modal = document.getElementById('debug-modal');
    if (modal) {
        if (uiState.debugPanelVisible) {
            modal.style.right = '20px'; // Align with CSS .visible
            modal.classList.add('visible'); // Add visible class for logic/CSS
            debugMode = true; // Update global debugMode
            if (typeof initDebugCanvas === 'function') initDebugCanvas();
        } else {
            modal.style.right = '-360px'; // Hide
            modal.classList.remove('visible');
            debugMode = false; // Update global debugMode
        }
    }
}
