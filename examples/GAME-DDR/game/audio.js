/**
 * AUDIO.JS - Web Audio API Manager
 * Handles music playback and timing synchronization
 */

class AudioManager {
    constructor() {
        this.audio = null;
        this.startTime = 0;
        this.isPlaying = false;
        this.volume = 0.7;
        this.onBeat = null; // Callback for beat events
    }

    /**
     * Load audio file
     * @param {string} src - Path to audio file
     * @returns {Promise}
     */
    load(src) {
        return new Promise((resolve, reject) => {
            this.audio = new Audio(src);
            this.audio.volume = this.volume;
            
            this.audio.oncanplaythrough = () => {
                console.log('Audio loaded successfully');
                resolve();
            };
            
            this.audio.onerror = (error) => {
                console.error('Failed to load audio:', error);
                reject(error);
            };

            this.audio.load();
        });
    }

    /**
     * Start audio playback
     */
    play() {
        if (!this.audio) {
            console.error('No audio loaded');
            return;
        }

        this.audio.currentTime = 0;
        this.audio.play();
        this.startTime = performance.now() / 1000;
        this.isPlaying = true;
        console.log('Audio playback started');
    }

    /**
     * Stop audio playback
     */
    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isPlaying = false;
        }
    }

    /**
     * Pause audio playback
     */
    pause() {
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
        }
    }

    /**
     * Resume audio playback
     */
    resume() {
        if (this.audio) {
            this.audio.play();
            this.isPlaying = true;
        }
    }

    /**
     * Get current playback time in seconds
     * @returns {number}
     */
    getCurrentTime() {
        return this.audio ? this.audio.currentTime : 0;
    }

    /**
     * Set volume (0.0 to 1.0)
     * @param {number} vol
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.audio) {
            this.audio.volume = this.volume;
        }
    }

    /**
     * Check if audio has ended
     * @returns {boolean}
     */
    hasEnded() {
        return this.audio ? this.audio.ended : false;
    }

    /**
     * Get audio duration
     * @returns {number}
     */
    getDuration() {
        return this.audio ? this.audio.duration : 0;
    }
}

/**
 * Step sound effects, independent from the music (own Web Audio graph and volume).
 * Sounds are synthesized, so no extra audio files are needed.
 */
class SoundEffects {
    constructor() {
        this.ctx = null;
        this.output = null;
        this.volume = 0.8;
    }

    /**
     * Create / resume the AudioContext. Call from a user gesture (e.g. the START click).
     */
    unlock() {
        try {
            if (!this.ctx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                this.ctx = new AudioContextClass();
                this.output = this.ctx.createGain();
                this.output.gain.value = this.volume;
                this.output.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        } catch (error) {
            console.warn('Sound effects unavailable:', error);
            this.ctx = null;
        }
    }

    /**
     * Set effect volume (0.0 to 1.0)
     * @param {number} vol
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.output) {
            this.output.gain.value = this.volume;
        }
    }

    /**
     * Play the sound for a judgment. MISS and inputs with no note are silent.
     * @param {string} judgment - 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'
     */
    play(judgment) {
        const preset = SoundEffects.PRESETS[judgment];
        if (!preset || !this.ctx || this.ctx.state !== 'running') return;

        const t = this.ctx.currentTime;
        const env = this.ctx.createGain();

        // Short click: 2ms attack, fast exponential decay
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(preset.level, t + 0.002);
        env.gain.exponentialRampToValueAtTime(0.0001, t + preset.decay);
        env.connect(this.output);

        // Fundamental plus a quieter octave so the click stays audible over the music
        [[1, 1], [2, 0.35]].forEach(([multiple, gain]) => {
            const osc = this.ctx.createOscillator();
            const partial = this.ctx.createGain();
            osc.type = preset.type;
            osc.frequency.setValueAtTime(preset.freq * multiple, t);
            osc.frequency.exponentialRampToValueAtTime(preset.freq * multiple * 0.7, t + preset.decay);
            partial.gain.value = gain;
            osc.connect(partial);
            partial.connect(env);
            osc.start(t);
            osc.stop(t + preset.decay + 0.02);
        });
    }
}

// PERFECT: small pleasant click / GREAT: quieter click / GOOD: almost silent / MISS: silent
SoundEffects.PRESETS = {
    PERFECT:   { type: 'triangle', freq: 1568, level: 0.8,  decay: 0.08 },
    GREAT:     { type: 'triangle', freq: 1175, level: 0.35, decay: 0.06 },
    GOOD:      { type: 'sine',     freq: 880,  level: 0.06, decay: 0.04 }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AudioManager = AudioManager;
    window.SoundEffects = SoundEffects;
}
