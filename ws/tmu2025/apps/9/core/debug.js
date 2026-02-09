/**
 * デバッグ表示およびログ管理ロジック
 */

// --- Debug Variables ---
let debugHistory = {
    roll: [],
    rollF: [],
    gyro: [],
    limit: 200
};
let debugMode = false;
let debugCtx = null;

/**
 * デバッグログの出力
 */
function logDebug(msg) {
    const logPanel = document.getElementById('debug-log');
    if (logPanel) {
        const entry = document.createElement('div');
        entry.textContent = `[${millis().toFixed(0)}] ${msg}`;
        logPanel.prepend(entry);
    }
    console.log(msg);
}

/**
 * デバッグ用キャンバスの初期化
 */
function initDebugCanvas() {
    let c = document.getElementById('debug-canvas');
    if (!c) return;
    debugCtx = c.getContext('2d');
    c.width = c.clientWidth;
    c.height = c.clientHeight;
}

/**
 * デバッググラフの描画
 */
function drawDebugGraph() {
    if (!debugCtx) return;
    let ctx = debugCtx;
    let w = ctx.canvas.width;
    let h = ctx.canvas.height;
    ctx.clearRect(0,0,w,h);

    ctx.strokeStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(0, h/2);
    ctx.lineTo(w, h/2);
    ctx.stroke();

    if (document.getElementById('chk-debug-raw').checked) {
        drawSeries(debugHistory.roll, '#555', 100);
    }
    if (document.getElementById('chk-debug-filt').checked) {
        drawSeries(debugHistory.rollF, '#fff', 100);
    }
    drawSeries(debugHistory.gyro, '#333', 50);
}

/**
 * データシリーズの描画ヘルパー
 */
function drawSeries(data, color, scale) {
    let ctx = debugCtx;
    let w = ctx.canvas.width;
    let h = ctx.canvas.height;
    let step = w / debugHistory.limit;
    
    ctx.strokeStyle = color;
    ctx.beginPath();
    for(let i=0; i<data.length; i++) {
        let x = i * step;
        let y = h/2 - (data[i] * scale);
        if (i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
    }
    ctx.stroke();
}
