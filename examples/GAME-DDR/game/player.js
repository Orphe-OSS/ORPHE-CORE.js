/**
 * PLAYER.JS - Player Input and Scoring Manager
 * Handles keyboard and ORPHE CORE input, scoring, and combo tracking
 */

class PlayerManager {
    constructor() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.perfect = 0;
        this.good = 0;
        this.ok = 0;
        this.miss = 0;
        
        this.keyboardEnabled = true;
        this.orpheEnabled = false;
        
        // Judge timing window (in seconds)
        this.judgeWindow = {
            perfect: 0.05,
            good: 0.1,
            ok: 0.15
        };
        
        // Input callbacks
        this.onInput = null;
        
        // Key mapping
        this.keyMap = {
            'ArrowLeft': 0,   // Lane 0 (Left)
            'ArrowUp': 2,     // Lane 2 (Up)
            'ArrowDown': 1,   // Lane 1 (Down)
            'ArrowRight': 3   // Lane 3 (Right)
        };
        
        // ORPHE direction mapping
        this.orpheDirectionMap = {
            0: 0,  // Left step → Lane 0
            2: 2,  // Forward step → Lane 2 (Up)
            4: 1,  // Backward step → Lane 1 (Down)
            6: 3   // Right step → Lane 3
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
        // Trigger visual feedback on lane indicator
        if (window.gameRenderer) {
            window.gameRenderer.triggerLanePress(lane);
        }
        
        if (this.onInput) {
            this.onInput(lane);
        }
    }

    /**
     * Handle ORPHE CORE gait direction
     * @param {number} direction - ORPHE direction (0, 2, 4, 6)
     */
    handleOrpheDirection(direction) {
        if (!this.orpheEnabled) return;
        
        const lane = this.orpheDirectionMap[direction];
        if (lane !== undefined) {
            console.log(`ORPHE input: direction=${direction} → lane=${lane}`);
            this.handleInput(lane);
        }
    }

    /**
     * Process hit result
     * @param {Object} hitResult - Result from ChartManager.checkHit()
     */
    processHit(hitResult) {
        if (!hitResult) {
            // Miss
            this.miss++;
            this.combo = 0;
            this.showJudgment('MISS', '#FF4444');
            return {
                score: 0,
                judgment: 'miss'
            };
        }

        const { accuracy, timeDiff } = hitResult;
        let basePoints = 0;
        let judgment = 'miss';
        let color = '#FF4444';

        switch (accuracy) {
            case 'perfect':
                basePoints = 100;
                judgment = 'PERFECT';
                color = '#FFD700';
                this.perfect++;
                this.combo++;
                break;
            case 'good':
                basePoints = 50;
                judgment = 'GOOD';
                color = '#00FF00';
                this.good++;
                this.combo++;
                break;
            case 'ok':
                basePoints = 25;
                judgment = 'OK';
                color = '#88FF88';
                this.ok++;
                this.combo++;
                break;
            default:
                this.miss++;
                this.combo = 0;
                judgment = 'MISS';
                color = '#FF4444';
        }

        // DDR-style combo multiplier
        let comboMultiplier = 1.0;
        if (this.combo >= 50) {
            comboMultiplier = 2.0;
        } else if (this.combo >= 30) {
            comboMultiplier = 1.5;
        } else if (this.combo >= 10) {
            comboMultiplier = 1.2;
        }

        const points = Math.floor(basePoints * comboMultiplier);
        this.score += points;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        this.showJudgment(judgment, color);
        this.updateScoreDisplay();

        return {
            score: points,
            judgment: judgment,
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
        document.getElementById('score').textContent = this.score;
        document.getElementById('combo').textContent = this.combo;
        document.getElementById('perfect').textContent = this.perfect;
        document.getElementById('good').textContent = this.good;
        document.getElementById('miss').textContent = this.miss;
    }

    /**
     * Reset all scores
     */
    reset() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.perfect = 0;
        this.good = 0;
        this.ok = 0;
        this.miss = 0;
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
            good: this.good,
            ok: this.ok,
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
        const total = this.perfect + this.good + this.ok + this.miss;
        if (total === 0) return 0;
        
        const weightedHits = (this.perfect * 1.0) + (this.good * 0.5) + (this.ok * 0.25);
        return (weightedHits / total * 100).toFixed(2);
    }

    /**
     * Calculate rank based on accuracy and score
     * @returns {string} Rank (SS, S, A, B, C, D, E)
     */
    calculateRank() {
        const total = this.perfect + this.good + this.ok + this.miss;
        if (total === 0) return 'E';
        
        const accuracy = parseFloat(this.calculateAccuracy());
        const perfectRate = (this.perfect / total) * 100;
        
        // DDR-style ranking
        if (perfectRate === 100) {
            return 'SS'; // Perfect Full Combo
        } else if (accuracy >= 95 && this.miss === 0) {
            return 'S';  // Full Combo
        } else if (accuracy >= 90) {
            return 'A';
        } else if (accuracy >= 80) {
            return 'B';
        } else if (accuracy >= 70) {
            return 'C';
        } else if (accuracy >= 60) {
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
        const seconds = ms / 1000;
        this.judgeWindow.perfect = seconds * 0.5;
        this.judgeWindow.good = seconds;
        this.judgeWindow.ok = seconds * 1.5;
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
}
