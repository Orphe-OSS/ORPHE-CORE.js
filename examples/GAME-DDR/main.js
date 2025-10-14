/**
 * MAIN.JS - Game Initialization and ORPHE CORE Integration
 * Main game loop and device connection management
 */

// Game state
let gameState = 'loading'; // loading, ready, playing, gameOver
let audioManager;
let chartManager;
let playerManager;
let gameRenderer;
let animationFrameId;

// ORPHE CORE devices (initialized in inline script in index.html)
// bles and connectedDevices are declared globally in HTML
let orpheData = {
    gaits: [
        { type: 0, direction: 0, steps: 0 },
        { type: 0, direction: 0, steps: 0 }
    ],
    lastDirection: [-1, -1], // Track last direction to prevent duplicate triggers
    resultFlag: false // Prevent input during result display
};

// Game timing
let gameStartTime = 0;
let lastFrameTime = 0;

// Settings
let settings = {
    noteSpeed: 400,
    judgeWindow: 100,
    volume: 0.7,
    selectedChart: 'sample'
};

/**
 * Initialize the game
 */
async function init() {
    console.log('🎮 Initializing ORPHE DDR Game...');
    console.log('📊 System Check:');
    console.log('  - ORPHE-CORE.js loaded:', typeof Orphe !== 'undefined');
    console.log('  - AudioManager loaded:', typeof AudioManager !== 'undefined');
    console.log('  - ChartManager loaded:', typeof ChartManager !== 'undefined');
    console.log('  - PlayerManager loaded:', typeof PlayerManager !== 'undefined');
    console.log('  - GameRenderer loaded:', typeof GameRenderer !== 'undefined');
    
    try {
        // Initialize game systems
        audioManager = new AudioManager();
        chartManager = new ChartManager();
        playerManager = new PlayerManager();
        gameRenderer = new GameRenderer('gameCanvas');
        
        // Make gameRenderer globally accessible for ORPHE input handler
        window.gameRenderer = gameRenderer;
        
        console.log('✅ Core systems initialized');
    } catch (error) {
        console.error('❌ Failed to initialize core systems:', error);
        showErrorMessage('ゲームシステムの初期化に失敗しました: ' + error.message);
        return;
    }
    
    // Make renderer globally accessible for judgment display
    window.gameRenderer = gameRenderer;
    
    // Setup UI event listeners
    try {
        setupUI();
        console.log('✅ UI event listeners setup');
    } catch (error) {
        console.error('❌ Failed to setup UI:', error);
        showErrorMessage('UI設定に失敗しました: ' + error.message);
        return;
    }
    
    // Setup ORPHE CORE
    try {
        setupOrpheCORE();
        console.log('✅ ORPHE CORE setup initiated');
    } catch (error) {
        console.error('⚠️ ORPHE CORE setup failed (keyboard-only mode):', error);
        // Continue without ORPHE - keyboard will still work
    }
    
    // Load default chart
    try {
        await chartManager.loadChart(settings.selectedChart);
        console.log('✅ Chart loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load chart:', error);
        showErrorMessage('譜面の読み込みに失敗しました: ' + error.message);
        return;
    }
    
    // Set initial state
    updateGameState('ready');
    
    // Draw initial canvas state
    try {
        gameRenderer.clear();
        gameRenderer.drawBackground();
        gameRenderer.drawLanes();
        gameRenderer.drawHitLine();
        gameRenderer.drawLaneIndicators();
        console.log('✅ Initial canvas rendered');
    } catch (error) {
        console.error('❌ Failed to render initial canvas:', error);
    }
    
    console.log('✅ Game initialized successfully');
    console.log('🎮 Ready to play! Click START GAME button.');
    console.log('💡 Tip: Type window.game.diagnostics() in console for system info');
}

/**
 * Setup ORPHE CORE devices
 */
function setupOrpheCORE() {
    try {
        console.log('🔌 Checking ORPHE CORE connection...');
        
        // Check if bles array exists (should be initialized in HTML)
        if (typeof bles === 'undefined' || !bles || bles.length === 0) {
            console.warn('⚠️ ORPHE devices not initialized. Make sure inline script in HTML ran correctly.');
            return;
        }
        
        console.log('✅ ORPHE devices found:', bles.length, 'devices');
        console.log('📱 Device 0:', bles[0]);
        console.log('📱 Device 1:', bles[1]);
        
        // Setup connection handlers
        for (let i = 0; i < bles.length; i++) {
            bles[i].onConnect = function() {
                connectedDevices++;
                console.log(`✅ ORPHE Device ${i} connected! Total: ${connectedDevices}/2`);
            };
            
            bles[i].gotGait = function(gait) {
                orpheData.gaits[i] = gait;
                
                // Handle direction change for step input
                if (gait.direction !== undefined) {
                    handleOrpheInput(gait.direction);
                }
            };
        }
        
        console.log('✅ ORPHE CORE setup complete');
    } catch (error) {
        console.error('❌ Error in setupOrpheCORE:', error);
        showErrorMessage('ORPHE COREの初期化中にエラーが発生しました', error.message);
    }
}

/**
 * Handle ORPHE CORE step input
 * @param {number} direction - ORPHE direction (0, 2, 4, 6)
 */
function handleOrpheInput(direction) {
    // Map ORPHE direction to lane
    // 0 = left, 2 = forward (up), 4 = backward (down), 6 = right
    const directionMap = {
        0: 0,  // Left → Lane 0
        2: 2,  // Forward → Lane 2 (Up)
        4: 1,  // Backward → Lane 1 (Down)
        6: 3   // Right → Lane 3
    };
    
    const lane = directionMap[direction];
    
    if (lane !== undefined) {
        console.log(`👟 ORPHE step detected: direction=${direction} → lane=${lane}`);
        
        // Trigger visual feedback (lane indicator flash)
        if (window.gameRenderer && typeof window.gameRenderer.triggerLanePress === 'function') {
            console.log(`✨ Triggering lane press visual feedback for lane ${lane}`);
            window.gameRenderer.triggerLanePress(lane);
        } else {
            console.warn('⚠️ gameRenderer.triggerLanePress not available');
        }
        
        handleGameInput(lane);
    }
}

/**
 * Handle game input from any source
 * @param {number} lane - Lane number (0-3)
 */
function handleGameInput(lane) {
    if (gameState !== 'playing') return;
    
    const currentTime = audioManager.getCurrentTime();
    const hitResult = chartManager.checkHit(currentTime, lane, settings.judgeWindow / 1000);
    
    if (hitResult) {
        console.log(`✨ Hit! Lane ${lane}, Accuracy: ${hitResult.accuracy}`);
    } else {
        console.log(`❌ Miss! Lane ${lane}`);
    }
    
    const result = playerManager.processHit(hitResult);
    
    // Brief pause after judgment to prevent multiple inputs
    if (result.judgment !== 'miss') {
        orpheData.resultFlag = true;
        setTimeout(() => {
            orpheData.resultFlag = false;
        }, 200);
    }
}

/**
 * Setup UI event listeners
 */
function setupUI() {
    console.log('🎨 Setting up UI...');
    
    // Start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            console.log('▶️ START button clicked');
            startGame();
        });
        console.log('  ✅ Start button listener attached');
    } else {
        console.error('  ❌ Start button not found!');
    }
    
    // Restart button
    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            console.log('🔄 RESTART button clicked');
            restartGame();
        });
        console.log('  ✅ Restart button listener attached');
    } else {
        console.error('  ❌ Restart button not found!');
    }
    
    // Quit button
    const quitBtn = document.getElementById('quitBtn');
    if (quitBtn) {
        quitBtn.addEventListener('click', () => {
            console.log('⏹️ QUIT button clicked');
            endGame();
        });
        console.log('  ✅ Quit button listener attached');
    } else {
        console.error('  ❌ Quit button not found!');
    }
    
    // Chart selection
    const chartSelect = document.getElementById('chartSelect');
    if (chartSelect) {
        chartSelect.addEventListener('change', (e) => {
            settings.selectedChart = e.target.value;
            console.log('📊 Chart changed to:', e.target.value);
            chartManager.loadChart(settings.selectedChart);
        });
        console.log('  ✅ Chart selector listener attached');
    } else {
        console.error('  ❌ Chart selector not found!');
    }
    
    // Note speed slider
    const noteSpeedSlider = document.getElementById('noteSpeed');
    if (noteSpeedSlider) {
        noteSpeedSlider.addEventListener('input', (e) => {
            settings.noteSpeed = parseInt(e.target.value);
            gameRenderer.setNoteSpeed(settings.noteSpeed);
            document.getElementById('noteSpeedValue').textContent = settings.noteSpeed;
        });
        console.log('  ✅ Note speed slider listener attached');
    }
    
    // Judge window slider
    const judgeWindowSlider = document.getElementById('judgeWindow');
    if (judgeWindowSlider) {
        judgeWindowSlider.addEventListener('input', (e) => {
            settings.judgeWindow = parseInt(e.target.value);
            playerManager.setJudgeWindow(settings.judgeWindow);
            document.getElementById('judgeWindowValue').textContent = settings.judgeWindow + 'ms';
        });
        console.log('  ✅ Judge window slider listener attached');
    }
    
    // Volume slider
    const volumeSlider = document.getElementById('volume');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            settings.volume = parseInt(e.target.value) / 100;
            audioManager.setVolume(settings.volume);
            document.getElementById('volumeValue').textContent = e.target.value + '%';
        });
        console.log('  ✅ Volume slider listener attached');
    }
    
    // Connect player input handler
    playerManager.onInput = (lane) => {
        handleGameInput(lane);
    };
    console.log('  ✅ Player input handler connected');
    console.log('✅ UI setup complete');
}

/**
 * Start the game
 */
async function startGame() {
    console.log('🎬 Starting game...');
    console.log('  Current state:', gameState);
    
    if (gameState !== 'ready' && gameState !== 'gameOver') {
        console.warn('⚠️ Cannot start game from state:', gameState);
        return;
    }
    
    // Reset game state
    try {
        playerManager.reset();
        chartManager.reset();
        console.log('✅ Game state reset');
    } catch (error) {
        console.error('❌ Failed to reset game state:', error);
        showErrorMessage('ゲームのリセットに失敗しました: ' + error.message);
        return;
    }
    
    // Load audio file
    let audioLoaded = false;
    try {
        // Use existing music file in music folder
        const musicPath = `music/Step by step, I find the motion  BPM120.mp3`;
        console.log('🎵 Loading music:', musicPath);
        await audioManager.load(musicPath);
        audioLoaded = true;
        console.log('✅ Music loaded successfully');
    } catch (error) {
        console.warn('⚠️ Could not load audio:', error);
        console.log('ℹ️ Continuing without music (chart timing only)');
        // Continue without audio - visual gameplay still works
    }
    
    // Update UI
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('quitBtn').style.display = 'inline-block';
    document.getElementById('restartBtn').style.display = 'none';
    
    // Countdown before start
    try {
        await countdown(3);
    } catch (error) {
        console.error('❌ Countdown failed:', error);
        showErrorMessage('カウントダウンに失敗しました');
        return;
    }
    
    // Start audio and game
    if (audioLoaded) {
        try {
            audioManager.play();
            console.log('✅ Music playback started');
        } catch (error) {
            console.error('❌ Failed to start music:', error);
        }
    }
    
    gameStartTime = performance.now();
    updateGameState('playing');
    console.log('✅ Game started!');
    
    // Start game loop
    gameLoop();
}

/**
 * Countdown before game starts
 * @param {number} seconds
 */
function countdown(seconds) {
    return new Promise((resolve) => {
        let count = seconds;
        const interval = setInterval(() => {
            if (count > 0) {
                gameRenderer.showJudgment(count.toString(), '#FFFFFF');
                count--;
            } else {
                gameRenderer.showJudgment('START!', '#00FF00');
                clearInterval(interval);
                setTimeout(resolve, 500);
            }
        }, 1000);
    });
}

/**
 * Main game loop
 */
function gameLoop() {
    if (gameState !== 'playing') {
        console.log('⏸️ Game loop stopped, state:', gameState);
        return;
    }
    
    try {
        const currentTime = audioManager.getCurrentTime();
        
        // Get visible notes
        const visibleNotes = chartManager.getVisibleNotes(currentTime, 3);
        
        // Render game
        gameRenderer.render(visibleNotes, currentTime);
        
        // Check if song ended
        if (chartManager.isComplete(currentTime) || audioManager.hasEnded()) {
            endGame();
            return;
        }
    } catch (error) {
        console.error('❌ Game loop error:', error);
        console.error('Stack trace:', error.stack);
        updateGameState('ready');
        showErrorMessage('ゲームループでエラーが発生しました: ' + error.message);
        return;
    }
    
    // Continue loop
    animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * End the game
 */
function endGame() {
    console.log('🏁 Game ended');
    
    updateGameState('gameOver');
    audioManager.stop();
    
    // Get final results
    const results = playerManager.getResults();
    
    // Show results
    gameRenderer.renderGameOver(results);
    
    // Show restart button
    document.getElementById('quitBtn').style.display = 'none';
    document.getElementById('restartBtn').style.display = 'inline-block';
    
    // Log results with rank
    console.log('📊 Final Results:');
    console.log(`  🏆 Rank: ${results.rank}`);
    console.log(`  💯 Score: ${results.score.toLocaleString()}`);
    console.log(`  🔥 Max Combo: ${results.maxCombo}`);
    console.log(`  ✨ Perfect: ${results.perfect} | Good: ${results.good} | OK: ${results.ok} | Miss: ${results.miss}`);
    console.log(`  📊 Accuracy: ${results.accuracy}%`);
}

/**
 * Restart the game
 */
function restartGame() {
    console.log('🔄 Restarting game...');
    
    // Cancel any ongoing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    // Reset ORPHE tracking
    orpheData.lastDirection = [-1, -1];
    orpheData.resultFlag = false;
    
    // Show start button
    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('quitBtn').style.display = 'none';
    document.getElementById('restartBtn').style.display = 'none';
    
    // Reset to ready state
    updateGameState('ready');
    
    // Clear canvas
    gameRenderer.clear();
    gameRenderer.drawBackground();
    gameRenderer.drawLanes();
    gameRenderer.drawHitLine();
    gameRenderer.drawLaneIndicators();
}

/**
 * Update game state
 * @param {string} newState
 */
function updateGameState(newState) {
    console.log(`Game state: ${gameState} → ${newState}`);
    gameState = newState;
}

/**
 * Show notification message
 * @param {string} message
 */
function showNotification(message) {
    console.log(`📢 ${message}`);
    // Could add visual notification here
}

/**
 * Show error message to user
 * @param {string} message
 */
function showErrorMessage(message) {
    console.error(`❌ ${message}`);
    
    // Create error overlay
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 30px;
        border-radius: 10px;
        z-index: 10000;
        max-width: 80%;
        text-align: center;
        font-size: 18px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    errorDiv.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
        <div style="font-weight: bold; margin-bottom: 10px;">エラー</div>
        <div>${message}</div>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 20px;
            padding: 10px 20px;
            background: white;
            color: #ff4444;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        ">閉じる</button>
    `;
    document.body.appendChild(errorDiv);
}

/**
 * Log system diagnostics
 */
function logDiagnostics() {
    console.log('🔍 System Diagnostics:');
    console.log('  Game State:', gameState);
    console.log('  Audio Manager:', audioManager ? '✅' : '❌');
    console.log('  Chart Manager:', chartManager ? '✅' : '❌');
    console.log('  Player Manager:', playerManager ? '✅' : '❌');
    console.log('  Game Renderer:', gameRenderer ? '✅' : '❌');
    console.log('  ORPHE Devices:', bles.length);
    console.log('  Connected Devices:', connectedDevices);
    console.log('  Canvas Element:', document.getElementById('gameCanvas') ? '✅' : '❌');
    console.log('  Start Button:', document.getElementById('startBtn') ? '✅' : '❌');
}

/**
 * Initialize game when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Expose game instance for debugging
window.game = {
    get audioManager() { return audioManager; },
    get chartManager() { return chartManager; },
    get playerManager() { return playerManager; },
    get gameRenderer() { return gameRenderer; },
    state: () => gameState,
    get orpheData() { return orpheData; },
    diagnostics: logDiagnostics,
    restart: restartGame,
    start: startGame
};
