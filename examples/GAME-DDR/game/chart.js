/**
 * CHART.JS - Chart Data Manager
 * Handles loading and managing note chart data (譜面データ)
 */

class ChartManager {
    constructor() {
        this.chart = null;
        this.notes = [];
        this.bpm = 120;
        this.offset = 0;
    }

    /**
     * Load chart from JSON file
     * @param {string} chartName - Chart file name
     * @returns {Promise}
     */
    async loadChart(chartName) {
        try {
            const response = await fetch(`assets/charts/${chartName}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load chart: ${response.status}`);
            }
            
            this.chart = await response.json();
            this.parseChart();
            console.log(`Chart loaded: ${chartName}`, this.chart);
            return this.chart;
        } catch (error) {
            console.error('Error loading chart:', error);
            // Load default chart as fallback
            this.loadDefaultChart();
        }
    }

    /**
     * Parse loaded chart data
     */
    parseChart() {
        if (!this.chart) return;

        this.bpm = this.chart.bpm || 120;
        this.offset = this.chart.offset || 0;
        this.notes = this.chart.notes || [];

        // Sort notes by time
        this.notes.sort((a, b) => a.time - b.time);
    }

    /**
     * Load default fallback chart
     */
    loadDefaultChart() {
        console.log('Loading default chart');
        this.chart = {
            name: "Default Chart",
            bpm: 120,
            offset: 0,
            notes: [
                { time: 1.0, lane: 0 },  // Left
                { time: 1.5, lane: 2 },  // Up
                { time: 2.0, lane: 3 },  // Right
                { time: 2.5, lane: 1 },  // Down
                { time: 3.0, lane: 0 },
                { time: 3.5, lane: 3 },
                { time: 4.0, lane: 1 },
                { time: 4.5, lane: 2 },
                { time: 5.0, lane: 0 },
                { time: 5.5, lane: 3 },
                { time: 6.0, lane: 2 },
                { time: 6.5, lane: 1 },
                { time: 7.0, lane: 0 },
                { time: 7.5, lane: 3 },
                { time: 8.0, lane: 1 },
                { time: 8.5, lane: 2 },
            ]
        };
        this.parseChart();
    }

    /**
     * Get notes that should be visible at current time
     * @param {number} currentTime - Current audio time in seconds
     * @param {number} visibleDuration - How many seconds ahead to show notes
     * @param {number} lateWindow - How many seconds past the hit time to keep showing
     *                              notes that can still be hit (so a late step looks late)
     * @returns {Array} Array of note objects with calculated positions
     */
    getVisibleNotes(currentTime, visibleDuration = 3, lateWindow = 0) {
        const visibleNotes = [];
        
        for (let note of this.notes) {
            const noteTime = note.time + this.offset;
            const timeDiff = noteTime - currentTime;
            
            // Show notes that are ahead but within visible range, plus notes just past
            // the hit time that can still be hit
            if (timeDiff >= -lateWindow && timeDiff <= visibleDuration) {
                visibleNotes.push({
                    ...note,
                    timeDiff: timeDiff,
                    active: !note.hit && !note.missed
                });
            }
        }
        
        return visibleNotes;
    }

    /**
     * Get note at specific time and lane for hit detection
     * @param {number} currentTime - Current audio time
     * @param {number} lane - Lane number (0-3)
     * @param {number} window - Hit window in seconds
     * @returns {Object|null} {note, timeDiff (abs, s), signedDiff (s, + = late), accuracy} or null.
     *   accuracy is the key of the best level in JUDGMENTS (player.js) whose window contains the step
     *   ('perfect' | 'great' | 'good').
     */
    checkHit(currentTime, lane, window = 0.15) {
        for (let note of this.notes) {
            if (note.hit || note.missed) continue; // Skip already judged notes

            const noteTime = note.time + this.offset;
            const timeDiff = Math.abs(noteTime - currentTime);
            
            if (note.lane === lane && timeDiff <= window) {
                note.hit = true;
                
                // Accuracy level: the windows are fractions of the judge window
                const levels = (typeof JUDGMENTS !== 'undefined') ? JUDGMENTS : [];
                const level = levels.find(l => timeDiff <= window * l.windowFraction);
                const accuracy = level ? level.key : 'good';
                
                return {
                    note: note,
                    timeDiff: timeDiff,
                    signedDiff: currentTime - noteTime,
                    accuracy: accuracy
                };
            }
        }
        
        return null;
    }

    /**
     * Mark notes whose hit window has fully passed without being hit as missed.
     * @param {number} currentTime - Current audio time
     * @param {number} window - Hit window in seconds
     * @returns {Array} Notes newly marked as missed
     */
    collectMissedNotes(currentTime, window = 0.15) {
        const missed = [];
        for (let note of this.notes) {
            if (note.hit || note.missed) continue;

            // Notes are sorted by time, so everything after this is still upcoming
            if (note.time + this.offset + window >= currentTime) break;

            note.missed = true;
            missed.push(note);
        }
        return missed;
    }

    /**
     * Reset all notes (for replay)
     */
    reset() {
        for (let note of this.notes) {
            note.hit = false;
            note.missed = false;
        }
    }

    /**
     * Get chart info
     * @returns {Object}
     */
    getInfo() {
        return {
            name: this.chart?.name || 'Unknown',
            bpm: this.bpm,
            noteCount: this.notes.length,
            duration: this.notes.length > 0 ? this.notes[this.notes.length - 1].time : 0
        };
    }

    /**
     * Time at which the game ends: shortly after the last note, or when the music ends
     * @param {number} [audioDuration] - Music length in seconds (ignored if not finite)
     * @returns {number} Seconds
     */
    getEndTime(audioDuration) {
        if (this.notes.length === 0) return 0;
        const chartEnd = this.notes[this.notes.length - 1].time + this.offset + 2; // same grace as isComplete()
        if (Number.isFinite(audioDuration) && audioDuration > 0) {
            return Math.min(chartEnd, audioDuration);
        }
        return chartEnd;
    }

    /**
     * Check if all notes have been processed
     * @param {number} currentTime
     * @returns {boolean}
     */
    isComplete(currentTime) {
        if (this.notes.length === 0) return false;
        const lastNoteTime = this.notes[this.notes.length - 1].time + this.offset;
        return currentTime > lastNoteTime + 2; // 2 seconds grace period
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ChartManager = ChartManager;
}
