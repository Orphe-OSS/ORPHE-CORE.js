/**
 * RENDER.JS - Canvas Rendering Engine
 * Handles all visual rendering including arrows, lanes, effects
 */

class GameRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Canvas dimensions
        this.width = 600;
        this.height = 800;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Lane configuration
        this.lanes = 4;
        this.laneWidth = this.width / this.lanes;
        this.hitLineY = this.height - 150; // Hit judgment line position
        
        // Note rendering
        this.noteSpeed = 400; // pixels per second
        this.noteHeight = 40;
        
        // Arrow symbols and colors
        this.arrowSymbols = ['←', '↓', '↑', '→'];
        this.arrowColors = ['#FF4444', '#44FF44', '#4444FF', '#FFAA00'];
        
        // Judgment display
        this.judgmentText = null;
        this.judgmentColor = '#FFFFFF';
        this.judgmentAlpha = 0;
        this.judgmentTimer = 0;
        this.currentCombo = 0; // Track combo for display
        
        // Lane press states
        this.lanePressStates = [false, false, false, false];
        this.lanePressTimers = [0, 0, 0, 0];
        
        // Effects
        this.hitEffects = [];
        
        // Background animation
        this.bgOffset = 0;
        
        console.log('GameRenderer initialized');
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
        this.drawNotes(notes, currentTime);
        this.drawHitLine();
        this.drawHitEffects();
        this.drawJudgment();
        this.drawLaneIndicators();
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Draw animated background
     */
    drawBackground() {
        // Gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Animated scan lines
        this.bgOffset = (this.bgOffset + 2) % 20;
        this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.1)';
        this.ctx.lineWidth = 1;
        for (let y = this.bgOffset; y < this.height; y += 20) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }

    /**
     * Draw lane dividers
     */
    drawLanes() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        
        for (let i = 1; i < this.lanes; i++) {
            const x = i * this.laneWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
    }

    /**
     * Draw falling notes
     * @param {Array} notes - Visible notes
     * @param {number} currentTime - Current time
     */
    drawNotes(notes, currentTime) {
        for (let note of notes) {
            if (!note.active) continue;
            
            const y = this.calculateNoteY(note.timeDiff);
            const x = note.lane * this.laneWidth;
            
            this.drawNote(x, y, note.lane);
        }
    }

    /**
     * Calculate Y position of note based on time difference
     * @param {number} timeDiff - Time until note hits
     * @returns {number}
     */
    calculateNoteY(timeDiff) {
        return this.hitLineY - (timeDiff * this.noteSpeed);
    }

    /**
     * Draw individual note
     * @param {number} x - X position (lane)
     * @param {number} y - Y position
     * @param {number} lane - Lane number
     */
    drawNote(x, y, lane) {
        const centerX = x + this.laneWidth / 2;
        const centerY = y;
        
        // Note background
        this.ctx.fillStyle = this.arrowColors[lane];
        this.ctx.globalAlpha = 0.8;
        
        // Draw rounded rectangle
        const width = this.laneWidth * 0.8;
        const height = this.noteHeight;
        const radius = 10;
        
        this.ctx.beginPath();
        this.ctx.roundRect(
            centerX - width / 2,
            centerY - height / 2,
            width,
            height,
            radius
        );
        this.ctx.fill();
        
        // Draw arrow symbol
        this.ctx.globalAlpha = 1.0;
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 40px Arial Black, Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText(this.arrowSymbols[lane], centerX, centerY);
        this.ctx.fillText(this.arrowSymbols[lane], centerX, centerY);
        
        // Draw glow effect for notes near hit line
        const distanceToHitLine = Math.abs(y - this.hitLineY);
        if (distanceToHitLine < 100) {
            const glowAlpha = 1 - (distanceToHitLine / 100);
            this.ctx.shadowColor = this.arrowColors[lane];
            this.ctx.shadowBlur = 20 * glowAlpha;
            this.ctx.strokeStyle = this.arrowColors[lane];
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
    }

    /**
     * Draw hit judgment line
     */
    drawHitLine() {
        // Main hit line
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = '#FFFFFF';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.hitLineY);
        this.ctx.lineTo(this.width, this.hitLineY);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        // Perfect timing indicators
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.hitLineY - 20);
        this.ctx.lineTo(this.width, this.hitLineY - 20);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.hitLineY + 20);
        this.ctx.lineTo(this.width, this.hitLineY + 20);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw lane indicators at bottom
     */
    drawLaneIndicators() {
        const indicatorY = this.height - 50;
        const symbols = ['←', '↓', '↑', '→'];
        const keys = ['←', '↓', '↑', '→'];
        
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        for (let i = 0; i < this.lanes; i++) {
            const x = i * this.laneWidth + this.laneWidth / 2;
            
            // Check if lane is pressed
            const isPressed = this.lanePressStates[i];
            
            // Background with press feedback
            if (isPressed) {
                // Glowing effect when pressed
                this.ctx.fillStyle = this.arrowColors[i];
                this.ctx.globalAlpha = 0.8;
                this.ctx.shadowColor = this.arrowColors[i];
                this.ctx.shadowBlur = 30;
            } else {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.globalAlpha = 1.0;
                this.ctx.shadowBlur = 0;
            }
            
            this.ctx.fillRect(
                i * this.laneWidth + 10,
                indicatorY - 20,
                this.laneWidth - 20,
                40
            );
            
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1.0;
            
            // Arrow symbol
            if (isPressed) {
                // Larger and brighter when pressed
                this.ctx.font = 'bold 32px Arial';
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.strokeStyle = this.arrowColors[i];
                this.ctx.lineWidth = 2;
                this.ctx.strokeText(symbols[i], x, indicatorY - 5);
                this.ctx.fillText(symbols[i], x, indicatorY - 5);
            } else {
                this.ctx.font = 'bold 24px Arial';
                this.ctx.fillStyle = this.arrowColors[i];
                this.ctx.fillText(symbols[i], x, indicatorY - 5);
            }
            
            // Key hint
            this.ctx.font = '12px Arial';
            this.ctx.fillStyle = isPressed ? '#FFFFFF' : '#AAAAAA';
            this.ctx.fillText(`Key: ${keys[i]}`, x, indicatorY + 15);
        }
        
        // Update press timers
        for (let i = 0; i < this.lanes; i++) {
            if (this.lanePressTimers[i] > 0) {
                this.lanePressTimers[i]--;
                if (this.lanePressTimers[i] === 0) {
                    this.lanePressStates[i] = false;
                }
            }
        }
    }
    
    /**
     * Trigger lane press visual feedback
     * @param {number} lane - Lane number (0-3)
     */
    triggerLanePress(lane) {
        if (lane >= 0 && lane < 4) {
            this.lanePressStates[lane] = true;
            this.lanePressTimers[lane] = 10; // frames to show press effect
        }
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
        this.judgmentAlpha = 1.0;
        this.judgmentTimer = 60; // frames
        this.currentCombo = combo;
        
        // Create hit effect
        this.createHitEffect(this.width / 2, this.hitLineY, color);
    }

    /**
     * Draw judgment text
     */
    drawJudgment() {
        if (this.judgmentTimer > 0) {
            this.judgmentTimer--;
            this.judgmentAlpha = this.judgmentTimer / 60;
            
            this.ctx.save();
            this.ctx.globalAlpha = this.judgmentAlpha;
            
            // Main judgment text
            this.ctx.font = 'bold 48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Text shadow
            this.ctx.shadowColor = this.judgmentColor;
            this.ctx.shadowBlur = 20;
            
            this.ctx.fillStyle = this.judgmentColor;
            this.ctx.fillText(this.judgmentText, this.width / 2, this.height / 2 - 20);
            
            // Combo text (if combo > 1)
            if (this.currentCombo > 1) {
                this.ctx.font = 'bold 32px Arial';
                this.ctx.fillStyle = '#FFD700';
                this.ctx.shadowColor = '#FFD700';
                this.ctx.shadowBlur = 15;
                this.ctx.fillText(`COMBO: ${this.currentCombo}`, this.width / 2, this.height / 2 + 30);
            }
            
            this.ctx.restore();
        }
    }

    /**
     * Create hit effect
     * @param {number} x
     * @param {number} y
     * @param {string} color
     */
    createHitEffect(x, y, color) {
        this.hitEffects.push({
            x: x,
            y: y,
            color: color,
            radius: 0,
            maxRadius: 100,
            alpha: 1.0,
            life: 30
        });
    }

    /**
     * Draw and update hit effects
     */
    drawHitEffects() {
        this.hitEffects = this.hitEffects.filter(effect => {
            effect.life--;
            effect.radius += 3;
            effect.alpha = effect.life / 30;
            
            if (effect.life <= 0) return false;
            
            this.ctx.save();
            this.ctx.globalAlpha = effect.alpha;
            this.ctx.strokeStyle = effect.color;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
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
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Title
        this.ctx.font = 'bold 60px BebasNeue, Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME CLEAR!', this.width / 2, 80);
        
        // Rank display (BIG!)
        const rankColors = {
            'SS': '#FFD700',
            'S': '#FFD700',
            'A': '#00FF00',
            'B': '#00BFFF',
            'C': '#FFA500',
            'D': '#FF6347',
            'E': '#808080'
        };
        
        this.ctx.font = 'bold 120px BebasNeue, Arial';
        this.ctx.fillStyle = rankColors[results.rank] || '#FFFFFF';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText(results.rank, this.width / 2, 200);
        this.ctx.fillText(results.rank, this.width / 2, 200);
        
        // Rank label
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#CCCCCC';
        this.ctx.fillText('RANK', this.width / 2, 230);
        
        // Score
        this.ctx.font = 'bold 48px BebasNeue, Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText(results.score.toLocaleString(), this.width / 2, 290);
        
        this.ctx.font = '20px Arial';
        this.ctx.fillStyle = '#CCCCCC';
        this.ctx.fillText('SCORE', this.width / 2, 315);
        
        // Stats box
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(50, 340, this.width - 100, 280);
        
        // Results details - single column layout
        this.ctx.font = '22px Arial';
        this.ctx.textAlign = 'left';
        let y = 375;
        const lineHeight = 40;
        const labelX = 80;
        const valueX = this.width - 100;
        
        const stats = [
            { label: 'MAX COMBO', value: results.maxCombo, color: '#FFD700' },
            { label: 'PERFECT', value: results.perfect, color: '#FFD700' },
            { label: 'GOOD', value: results.good, color: '#00FF00' },
            { label: 'OK', value: results.ok, color: '#88FF88' },
            { label: 'MISS', value: results.miss, color: '#FF4444' },
            { label: 'ACCURACY', value: `${results.accuracy}%`, color: '#00BFFF' }
        ];
        
        stats.forEach((stat, i) => {
            this.ctx.fillStyle = '#CCCCCC';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(stat.label, labelX, y + (i * lineHeight));
            this.ctx.fillStyle = stat.color;
            this.ctx.textAlign = 'right';
            this.ctx.fillText(stat.value.toString(), valueX, y + (i * lineHeight));
        });
        
        // Restart hint
        this.ctx.font = '18px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Click RESTART to play again', this.width / 2, 650);
    }    /**
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
