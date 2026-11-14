/**
 * PLAYER.JS - Player Input and Scoring Manager
 * Handles keyboard and ORPHE CORE input, scoring, and combo tracking
 */

// Judgment levels (best first). The window fraction is relative to the judge window setting.
const JUDGMENTS = [
    { name: 'PERFECT', key: 'perfect', windowFraction: 0.4, points: 100, weight: 1.0 },
    { name: 'GREAT',   key: 'great',   windowFraction: 0.7, points: 60,  weight: 0.6 },
    { name: 'GOOD',    key: 'good',    windowFraction: 1.0, points: 30,  weight: 0.3 }
];

const JUDGMENT_COLORS = {
    PERFECT: '#e5c046',
    GREAT: '#46a758',
    GOOD: '#3e8ed0',
    MISS: '#e5484d'
};

class PlayerManager {
    constructor() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.resetCounts();

        this.keyboardEnabled = true;
        this.orpheEnabled = false;
        
        // Input callbacks
        this.onInput = null;
        
        // Key mapping
        this.keyMap = {
            'ArrowLeft': 0,   // Lane 0 (Left)
            'ArrowUp': 2,     // Lane 2 (Up)
            'ArrowDown': 1,   // Lane 1 (Down)
            'ArrowRight': 3   // Lane 3 (Right)
        };
        
        this.setupKeyboardInput();
    }

    /**
     * Setup keyboard event listeners
     */
    setupKeyboardInput() {
        window.addEventListener('keydown', (e) => {
            if (!this.keyboardEnabled) return;
            
            const lane = this.keyMap[e.key];
            if (lane !== undefined) {
                e.preventDefault();
                this.handleInput(lane);
            }
        });
    }

    /**
     * Handle input from any source
     * @param {number} lane - Lane number (0-3)
     */
    handleInput(lane) {
        // Visual feedback is drawn after the input is judged (see handleGameInput in main.js)
        if (this.onInput) {
            this.onInput(lane);
        }
    }

    /**
     * Process hit result
     * @param {Object|null} hitResult - Result from ChartManager.checkHit(), or null for a miss
     * @returns {{score: number, judgment: string, combo: number}}
     */
    processHit(hitResult) {
        const level = hitResult && JUDGMENTS.find(j => j.key === hitResult.accuracy);

        if (!level) {
            this.miss++;
            this.combo = 0;
            this.showJudgment('MISS', JUDGMENT_COLORS.MISS);
            this.updateScoreDisplay();
            return { score: 0, judgment: 'MISS', combo: 0 };
        }

        this[level.key]++;
        this.combo++;

        // Combo multiplier
        let comboMultiplier = 1.0;
        if (this.combo >= 50) {
            comboMultiplier = 2.0;
        } else if (this.combo >= 30) {
            comboMultiplier = 1.5;
        } else if (this.combo >= 10) {
            comboMultiplier = 1.2;
        }

        const points = Math.floor(level.points * comboMultiplier);
        this.score += points;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        this.showJudgment(level.name, JUDGMENT_COLORS[level.name]);
        this.updateScoreDisplay();

        return {
            score: points,
            judgment: level.name,
            combo: this.combo
        };
    }

    /**
     * Show judgment text on screen
     * @param {string} text - Judgment text
     * @param {string} color - Text color
     */
    showJudgment(text, color) {
        // This will be called by the render system
        if (window.gameRenderer) {
            window.gameRenderer.showJudgment(text, color, this.combo);
        }
    }

    /**
     * Update score display in HTML
     */
    updateScoreDisplay() {
        const values = {
            score: this.score,
            combo: this.combo,
            perfect: this.perfect,
            great: this.great,
            good: this.good,
            miss: this.miss
        };
        for (const id in values) {
            const el = document.getElementById(id);
            if (el) el.textContent = values[id];
        }
    }

    /**
     * Reset judgment counters
     */
    resetCounts() {
        for (const level of JUDGMENTS) this[level.key] = 0;
        this.miss = 0;
    }

    /**
     * Reset all scores
     */
    reset() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.resetCounts();
        this.updateScoreDisplay();
    }

    /**
     * Get final results
     * @returns {Object}
     */
    getResults() {
        return {
            score: this.score,
            maxCombo: this.maxCombo,
            perfect: this.perfect,
            great: this.great,
            good: this.good,
            miss: this.miss,
            accuracy: this.calculateAccuracy(),
            rank: this.calculateRank()
        };
    }

    /**
     * Calculate accuracy percentage
     * @returns {number}
     */
    calculateAccuracy() {
        const total = this.totalJudged();
        if (total === 0) return 0;

        const weightedHits = JUDGMENTS.reduce((sum, level) => sum + this[level.key] * level.weight, 0);
        return (weightedHits / total * 100).toFixed(2);
    }

    /**
     * Number of judged notes (hits + misses)
     * @returns {number}
     */
    totalJudged() {
        return JUDGMENTS.reduce((sum, level) => sum + this[level.key], 0) + this.miss;
    }

    /**
     * Calculate rank based on accuracy and score
     * @returns {string} Rank (SS, S, A, B, C, D, E)
     */
    calculateRank() {
        const total = this.totalJudged();
        if (total === 0) return 'E';

        const accuracy = parseFloat(this.calculateAccuracy());
        const perfectRate = (this.perfect / total) * 100;

        // Accuracy weights a GREAT at 60% and a GOOD at 30% of a PERFECT, so a run of
        // mostly GREATs lands around C rather than E.
        if (perfectRate === 100) {
            return 'SS'; // Perfect Full Combo
        } else if (accuracy >= 95 && this.miss === 0) {
            return 'S';  // Full Combo
        } else if (accuracy >= 80) {
            return 'A';
        } else if (accuracy >= 70) {
            return 'B';
        } else if (accuracy >= 60) {
            return 'C';
        } else if (accuracy >= 40) {
            return 'D';
        } else {
            return 'E';
        }
    }

    /**
     * Set judge window timing
     * @param {number} ms - Milliseconds
     */
    setJudgeWindow(ms) {
        // The window is applied in ChartManager.checkHit(); kept for compatibility
        this.judgeWindowMs = ms;
    }

    /**
     * Enable/disable input sources
     */
    enableKeyboard(enabled) {
        this.keyboardEnabled = enabled;
    }

    enableOrphe(enabled) {
        this.orpheEnabled = enabled;
        console.log(`ORPHE input ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PlayerManager = PlayerManager;
    window.JUDGMENTS = JUDGMENTS;
    window.JUDGMENT_COLORS = JUDGMENT_COLORS;
}
