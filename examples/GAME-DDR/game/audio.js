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

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AudioManager = AudioManager;
}
