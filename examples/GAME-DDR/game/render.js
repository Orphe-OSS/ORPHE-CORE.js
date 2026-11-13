/**
 * RENDER.JS - Canvas Rendering Engine
 * Draws the play field: step zone (receptors), notes, judgments, progress bar
 */

// Flat palette
const PALETTE = {
    background: '#111214',
    laneAlt: '#141518',
    separator: '#23252a',
    receptor: '#6b7079',
    noteOutline: '#0b0c0e',
    text: '#ececec',
    muted: '#8b9098',
    barTrack: '#23252a',
    bar: '#ececec'
};

// Note color per lane: ← ↓ ↑ →
const LANE_COLORS = ['#e5484d', '#46a758', '#3e8ed0', '#e5a03c'];

class GameRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Canvas dimensions
        this.width = 600;
        this.height = 800;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Lane configuration (lane order: ← ↓ ↑ →)
        this.lanes = 4;
        this.laneWidth = this.width / this.lanes;
        this.arrowSize = Math.round(this.laneWidth * 0.62);
        this.receptorMargin = 110; // distance of the step zone from the bottom edge

        // Note rendering
        this.noteSpeed = 400; // pixels per second

        // Progress bar (remaining fraction 0-1, or null to hide)
        this.progress = null;

        // Judgment display (time-based so it fades the same at any frame rate)
        this.judgmentText = null;
        this.judgmentColor = PALETTE.text;
        this.judgmentUntil = 0;
        this.currentCombo = 0;

        // Large centered message (countdown)
        this.messageText = null;
        this.messageUntil = 0;

        // Step zone feedback per lane: { until, color, strong }
        this.laneFlash = [null, null, null, null];

        // Expanding rings on hits
        this.hitEffects = [];

        console.log('GameRenderer initialized');
    }

    /** Y of the step zone (the judgment position) */
    get hitLineY() {
        return this.height - this.receptorMargin;
    }

    /**
     * Main render loop
     * @param {Array} notes - Visible notes from ChartManager
     * @param {number} currentTime - Current audio time
     */
    render(notes, currentTime) {
        this.clear();
        this.drawBackground();
        this.drawLanes();
        this.drawReceptors();
        this.drawNotes(notes, currentTime);
        this.drawHitEffects();
        this.drawJudgment();
        this.drawMessage();
        this.drawProgressBar();
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Draw flat background with alternating lane shading
     */
    drawBackground() {
        this.ctx.fillStyle = PALETTE.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = PALETTE.laneAlt;
        for (let i = 1; i < this.lanes; i += 2) {
            this.ctx.fillRect(i * this.laneWidth, 0, this.laneWidth, this.height);
        }
    }

    /**
     * Draw lane dividers
     */
    drawLanes() {
        this.ctx.strokeStyle = PALETTE.separator;
        this.ctx.lineWidth = 1;
        for (let i = 1; i < this.lanes; i++) {
            const x = Math.round(i * this.laneWidth) + 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
    }

    /**
     * Trace an arrow path centered at (cx, cy), pointing in the lane's direction
     * @param {number} cx
     * @param {number} cy
     * @param {number} size - Arrow width/height in pixels
     * @param {number} lane - 0: ←, 1: ↓, 2: ↑, 3: →
     */
    traceArrow(cx, cy, size, lane) {
        // Rotation per lane: ← ↓ ↑ →
        const angles = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
        const points = [
            [0, -0.5], [0.5, 0], [0.2, 0], [0.2, 0.5],
            [-0.2, 0.5], [-0.2, 0], [-0.5, 0]
        ];
        const a = angles[lane];
        const cos = Math.cos(a);
        const sin = Math.sin(a);

        this.ctx.beginPath();
        points.forEach(([px, py], i) => {
            const x = cx + (px * cos - py * sin) * size;
            const y = cy + (px * sin + py * cos) * size;
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        });
        this.ctx.closePath();
    }

    laneCenterX(lane) {
        return lane * this.laneWidth + this.laneWidth / 2;
    }

    /**
     * Draw the step zone. Notes are the same shape and size, so a note exactly
     * covers its receptor at the moment it should be stepped.
     */
    drawReceptors() {
        const now = performance.now();
        const y = this.hitLineY;

        for (let lane = 0; lane < this.lanes; lane++) {
            const cx = this.laneCenterX(lane);
            const flash = this.laneFlash[lane];

            if (flash && now < flash.until) {
                const remaining = (flash.until - now) / flash.duration;
                this.traceArrow(cx, y, this.arrowSize, lane);
                this.ctx.globalAlpha = flash.strong ? 0.85 * remaining : 0.18 * remaining;
                this.ctx.fillStyle = flash.color;
                this.ctx.fill();
                this.ctx.globalAlpha = 1.0;
            }

            this.traceArrow(cx, y, this.arrowSize, lane);
            this.ctx.strokeStyle = PALETTE.receptor;
            this.ctx.lineWidth = 3;
            this.ctx.lineJoin = 'round';
            this.ctx.stroke();
        }
    }

    /**
     * Draw notes
     * @param {Array} notes - Visible notes
     * @param {number} currentTime - Current time
     */
    drawNotes(notes, currentTime) {
        for (let note of notes) {
            if (!note.active) continue;

            const y = this.calculateNoteY(note.timeDiff);
            if (y < -this.arrowSize || y > this.height + this.arrowSize) continue;

            this.drawNote(this.laneCenterX(note.lane), y, note.lane, LANE_COLORS[note.lane]);
        }
    }

    /**
     * Calculate Y position of a note based on the time until it should be stepped
     * @param {number} timeDiff - Seconds until the note reaches the step zone
     * @returns {number}
     */
    calculateNoteY(timeDiff) {
        const distance = timeDiff * this.noteSpeed;
        return this.hitLineY - distance;
    }

    /**
     * Draw a single note
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} lane - Lane number
     * @param {string} color - Fill color
     */
    drawNote(cx, cy, lane, color) {
        this.traceArrow(cx, cy, this.arrowSize, lane);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = PALETTE.noteOutline;
        this.ctx.lineWidth = 2;
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    }

    /**
     * Light up a lane's receptor
     * @param {number} lane - Lane number (0-3)
     * @param {Object} [options]
     * @param {string} [options.color] - Fill color (default: text color)
     * @param {boolean} [options.strong] - true for a judged hit, false for a faint "no note here" input
     */
    flashLane(lane, options = {}) {
        if (lane < 0 || lane >= this.lanes) return;
        const strong = !!options.strong;
        const duration = strong ? 180 : 140;
        this.laneFlash[lane] = {
            until: performance.now() + duration,
            duration,
            color: options.color || PALETTE.text,
            strong
        };
        if (strong) {
            this.createHitEffect(this.laneCenterX(lane), this.hitLineY, options.color || PALETTE.text);
        }
    }

    /**
     * Backward compatible alias: light up a lane faintly
     * @param {number} lane - Lane number (0-3)
     */
    triggerLanePress(lane) {
        this.flashLane(lane, { strong: false });
    }

    /**
     * Clear all lane feedback
     */
    resetLanePress() {
        this.laneFlash = [null, null, null, null];
        this.hitEffects = [];
    }

    /**
     * Show judgment text
     * @param {string} text - Judgment text
     * @param {string} color - Text color
     * @param {number} combo - Current combo count
     */
    showJudgment(text, color, combo = 0) {
        this.judgmentText = text;
        this.judgmentColor = color;
        this.judgmentUntil = performance.now() + 800;
        this.currentCombo = combo;
    }

    /**
     * Show a large centered message (e.g. countdown)
     * @param {string|null} text
     * @param {number} [duration=900] - ms
     */
    showMessage(text, duration = 900) {
        this.messageText = text;
        this.messageUntil = performance.now() + duration;
    }

    /** Clear judgment and message text */
    clearText() {
        this.judgmentUntil = 0;
        this.messageUntil = 0;
    }

    /**
     * Fade factor for text shown until `until` (fades over the last 300ms)
     */
    textAlpha(until) {
        const remaining = until - performance.now();
        if (remaining <= 0) return 0;
        return Math.min(1, remaining / 300);
    }

    /**
     * Draw judgment and combo between the step zone and the far edge
     */
    drawJudgment() {
        const alpha = this.textAlpha(this.judgmentUntil);
        if (alpha <= 0 || !this.judgmentText) return;

        const y = this.height / 2;
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.ctx.font = '56px BebasNeue, Arial';
        this.ctx.fillStyle = this.judgmentColor;
        this.ctx.fillText(this.judgmentText, this.width / 2, y);

        if (this.currentCombo > 1) {
            this.ctx.font = '30px BebasNeue, Arial';
            this.ctx.fillStyle = PALETTE.text;
            this.ctx.fillText(`${this.currentCombo} COMBO`, this.width / 2, y + 44);
        }

        this.ctx.restore();
    }

    /**
     * Draw the large centered message
     */
    drawMessage() {
        const alpha = this.textAlpha(this.messageUntil);
        if (alpha <= 0 || !this.messageText) return;

        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '96px BebasNeue, Arial';
        this.ctx.fillStyle = PALETTE.text;
        this.ctx.fillText(this.messageText, this.width / 2, this.height / 2);
        this.ctx.restore();
    }

    /**
     * Set the remaining-time bar
     * @param {number|null} fraction - Remaining fraction (0-1), or null to hide
     */
    setProgress(fraction) {
        this.progress = fraction === null ? null : Math.max(0, Math.min(1, fraction));
    }

    /**
     * Draw the remaining-time bar along the top edge
     */
    drawProgressBar() {
        if (this.progress === null) return;
        const h = 6;
        this.ctx.fillStyle = PALETTE.barTrack;
        this.ctx.fillRect(0, 0, this.width, h);
        this.ctx.fillStyle = PALETTE.bar;
        this.ctx.fillRect(0, 0, this.width * this.progress, h);
    }

    /**
     * Create hit effect
     * @param {number} x
     * @param {number} y
     * @param {string} color
     */
    createHitEffect(x, y, color) {
        this.hitEffects.push({ x, y, color, start: performance.now(), duration: 250 });
    }

    /**
     * Draw and update hit effects
     */
    drawHitEffects() {
        const now = performance.now();
        this.hitEffects = this.hitEffects.filter(effect => {
            const t = (now - effect.start) / effect.duration;
            if (t >= 1) return false;

            this.ctx.save();
            this.ctx.globalAlpha = 0.6 * (1 - t);
            this.ctx.strokeStyle = effect.color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, this.arrowSize * (0.5 + 0.4 * t), 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
            return true;
        });
    }

    /**
     * Render game over screen with results
     * @param {Object} results - Final game results
     */
    renderGameOver(results) {
        this.ctx.fillStyle = PALETTE.background;
        this.ctx.globalAlpha = 0.94;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.globalAlpha = 1.0;

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'alphabetic';

        this.ctx.font = '36px BebasNeue, Arial';
        this.ctx.fillStyle = PALETTE.muted;
        this.ctx.fillText('RESULT', this.width / 2, 80);

        this.ctx.font = '120px BebasNeue, Arial';
        this.ctx.fillStyle = PALETTE.text;
        this.ctx.fillText(results.rank, this.width / 2, 200);

        this.ctx.font = '44px BebasNeue, Arial';
        this.ctx.fillText(results.score.toLocaleString(), this.width / 2, 260);
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = PALETTE.muted;
        this.ctx.fillText('SCORE', this.width / 2, 284);

        const colors = (typeof JUDGMENT_COLORS !== 'undefined') ? JUDGMENT_COLORS : {};
        const stats = [
            { label: 'PERFECT', value: results.perfect, color: colors.PERFECT },
            { label: 'GREAT', value: results.great, color: colors.GREAT },
            { label: 'GOOD', value: results.good, color: colors.GOOD },
            { label: 'MISS', value: results.miss, color: colors.MISS },
            { label: 'MAX COMBO', value: results.maxCombo },
            { label: 'ACCURACY', value: `${results.accuracy}%` }
        ];

        const labelX = 120;
        const valueX = this.width - 120;
        let y = 340;
        this.ctx.font = '22px Arial';
        stats.forEach(stat => {
            this.ctx.textAlign = 'left';
            this.ctx.fillStyle = stat.color || PALETTE.muted;
            this.ctx.fillText(stat.label, labelX, y);
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = PALETTE.text;
            this.ctx.fillText(String(stat.value), valueX, y);
            y += 40;
        });

        this.ctx.textAlign = 'center';
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = PALETTE.muted;
        this.ctx.fillText('RESTART でもう一度プレイ', this.width / 2, y + 30);
    }

    /**
     * Set note speed
     * @param {number} speed - Pixels per second
     */
    setNoteSpeed(speed) {
        this.noteSpeed = speed;
    }

}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.GameRenderer = GameRenderer;
}
