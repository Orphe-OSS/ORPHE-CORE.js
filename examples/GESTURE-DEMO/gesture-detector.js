/**
 * ORPHE CORE Gesture Detection Demo
 * Based on analysis from docs/ai/gesture_detection_logic.md
 */

(function() {
  'use strict';

  // ============================================================================
  // DETECTION THRESHOLDS (from recorded data analysis 2025-11-30 v3)
  // Data source: orphe_sensor_raw_1764471685147.json
  // Method: Euler angle (Pitch) at impact moment
  // ============================================================================
  const THRESHOLDS = {
    // Minimum acceleration to trigger gesture detection
    ACC_TRIGGER: 2.0,  // G

    // idle detection
    IDLE_ACC_MAX: 1.5,   // G
    IDLE_GYRO_MAX: 5.0,  // °/s

    // Euler-based detection (Pitch angle at impact)
    // toe_tap: つま先が下向き → 正のPitch (範囲: +1.6° 〜 +23.7°)
    TOE_TAP_PITCH_MIN: 5.0,  // degrees - above this = toe_tap

    // heel_tap: 踵が下向き → 負のPitch (範囲: -18.4° 〜 -1.9°)
    HEEL_TAP_PITCH_MAX: -1.5,  // degrees - below this = heel_tap

    // stomp: ほぼ水平 → Pitchが0付近 (範囲: -0.9° 〜 +4.1°)
    // Between HEEL_TAP_PITCH_MAX and TOE_TAP_PITCH_MIN = stomp
  };

  // ============================================================================
  // GESTURE DEFINITIONS
  // ============================================================================
  const GESTURES = {
    idle: {
      name: 'IDLE',
      nameJp: '静止',
      icon: 'bi-pause-circle',
      color: '#666'
    },
    toe_tap: {
      name: 'TOE TAP',
      nameJp: 'つま先トン',
      icon: 'bi-arrow-up-circle-fill',
      color: '#ff6b6b',
      sound: 'toe'
    },
    heel_tap: {
      name: 'HEEL TAP',
      nameJp: '踵トン',
      icon: 'bi-arrow-down-circle-fill',
      color: '#4ecdc4',
      sound: 'heel'
    },
    stomp: {
      name: 'STOMP',
      nameJp: '足踏み',
      icon: 'bi-bullseye',
      color: '#ffe66d',
      sound: 'stomp'
    }
  };

  // ============================================================================
  // STATE
  // ============================================================================
  let isConnected = false;
  let soundEnabled = true;
  let detectionCount = 0;
  let gestureHistory = [];
  let dataCount = 0;
  let lastDataCountTime = Date.now();
  let dataRate = 0;

  // Current sensor values
  let currentAcc = { x: 0, y: 0, z: 0 };
  let currentGyro = { x: 0, y: 0, z: 0 };

  // ============================================================================
  // GESTURE DETECTOR CLASS
  // Uses peak detection with Euler angle for gesture classification
  // ============================================================================
  class GestureDetector {
    constructor() {
      this.cooldown = 0;
      this.cooldownFrames = 100;  // ~500ms cooldown - prevents double detection

      // Peak detection state
      this.peakDetected = false;
      this.peakAcc = 0;
      this.peakPitch = 0;  // Euler pitch at peak moment (degrees)
      this.framesSincePeak = 0;
      this.peakHoldFrames = 10;  // Hold peak values for ~50ms after peak

      // Current Euler state
      this.currentPitch = 0;  // degrees
    }

    // Update Euler pitch (call this from gotEuler callback)
    updateEuler(euler) {
      // Convert radians to degrees
      this.currentPitch = euler.pitch * 180 / Math.PI;
    }

    update(acc, gyro) {
      const accMag = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);

      // Cooldown management - skip all processing during cooldown
      if (this.cooldown > 0) {
        this.cooldown--;
        this.peakDetected = false;
        this.peakAcc = 0;
        return null;
      }

      // Peak detection: look for rising then falling acceleration
      if (accMag > THRESHOLDS.ACC_TRIGGER) {
        if (accMag > this.peakAcc) {
          // New peak found - record acceleration and current pitch
          this.peakAcc = accMag;
          this.peakPitch = this.currentPitch;  // Capture pitch at peak moment
          this.peakDetected = true;
          this.framesSincePeak = 0;
        } else if (this.peakDetected) {
          this.framesSincePeak++;
        }
      } else if (this.peakDetected) {
        this.framesSincePeak++;
      }

      // Trigger gesture detection after peak has passed
      if (this.peakDetected && this.framesSincePeak >= this.peakHoldFrames) {
        const gesture = this.detectGesture(this.peakAcc, this.peakPitch);

        // Reset state
        this.peakDetected = false;
        this.peakAcc = 0;
        this.peakPitch = 0;
        this.framesSincePeak = 0;

        if (gesture && gesture !== 'idle') {
          this.cooldown = this.cooldownFrames;
          return gesture;
        }
      }

      return null;
    }

    detectGesture(accMag, pitch) {
      // Must have sufficient acceleration for any gesture
      if (accMag < THRESHOLDS.ACC_TRIGGER) {
        return null;
      }

      // Euler-based detection using Pitch angle at impact
      // toe_tap: つま先が下向き → 正のPitch (> 5°)
      if (pitch > THRESHOLDS.TOE_TAP_PITCH_MIN) {
        return 'toe_tap';
      }

      // heel_tap: 踵が下向き → 負のPitch (< -1.5°)
      if (pitch < THRESHOLDS.HEEL_TAP_PITCH_MAX) {
        return 'heel_tap';
      }

      // stomp: ほぼ水平 → Pitchが0付近 (-1.5° 〜 5°)
      return 'stomp';
    }

    // Get current pitch for debug display
    getCurrentPitch() {
      return this.currentPitch;
    }

    getPeakPitch() {
      return this.peakPitch;
    }
  }

  const detector = new GestureDetector();

  // ============================================================================
  // AUDIO
  // ============================================================================
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  function playSound(type) {
    if (!soundEnabled) return;

    // Resume audio context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different sounds for each gesture
    switch (type) {
      case 'toe':
        // High pitched beep
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
        break;

      case 'heel':
        // Low pitched beep
        oscillator.frequency.value = 330;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
        break;

      case 'stomp':
        // Drum-like sound
        oscillator.frequency.value = 150;
        oscillator.type = 'triangle';
        gainNode.gain.setValueAtTime(0.7, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.25);
        break;
    }
  }

  // ============================================================================
  // UI UPDATES
  // ============================================================================
  function updateConnectionStatus(connected) {
    const el = document.getElementById('connection-status');
    if (connected) {
      el.textContent = 'Connected';
      el.style.color = '#4caf50';
    } else {
      el.textContent = 'Disconnected';
      el.style.color = '#f44336';
    }
  }

  function updateSensorDisplay(acc, gyro) {
    const accMag = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
    const currentPitch = detector.getCurrentPitch();

    document.getElementById('acc-mag').textContent = accMag.toFixed(2) + ' G';
    document.getElementById('pitch-angle').textContent = currentPitch.toFixed(1) + '°';

    // Determine detection zone based on pitch
    const zoneEl = document.getElementById('detection-zone');
    if (currentPitch > THRESHOLDS.TOE_TAP_PITCH_MIN) {
      zoneEl.textContent = 'TOE';
      zoneEl.style.color = '#ff6b6b';
    } else if (currentPitch < THRESHOLDS.HEEL_TAP_PITCH_MAX) {
      zoneEl.textContent = 'HEEL';
      zoneEl.style.color = '#4ecdc4';
    } else {
      zoneEl.textContent = 'FLAT';
      zoneEl.style.color = '#ffe66d';
    }

    // Color code Pitch based on zone
    const pitchEl = document.getElementById('pitch-angle');
    if (currentPitch > THRESHOLDS.TOE_TAP_PITCH_MIN) {
      pitchEl.style.color = '#ff6b6b';
    } else if (currentPitch < THRESHOLDS.HEEL_TAP_PITCH_MAX) {
      pitchEl.style.color = '#4ecdc4';
    } else {
      pitchEl.style.color = '#ffe66d';
    }

    // Color code Acc magnitude
    const accEl = document.getElementById('acc-mag');
    if (accMag > THRESHOLDS.ACC_TRIGGER) {
      accEl.style.color = '#ff6b6b';
    } else if (accMag > THRESHOLDS.IDLE_ACC_MAX) {
      accEl.style.color = '#ffe66d';
    } else {
      accEl.style.color = '#fff';
    }

    // Debug info
    document.getElementById('debug-info').textContent =
      `AccMag: ${accMag.toFixed(2)}G | Pitch: ${currentPitch.toFixed(1)}° | ` +
      `Zone: ${zoneEl.textContent} | Cooldown: ${detector.cooldown}`;
  }

  function showGesture(gestureKey) {
    const gesture = GESTURES[gestureKey];
    if (!gesture) return;

    const iconEl = document.getElementById('gesture-icon');
    const nameEl = document.getElementById('gesture-name');
    const jpEl = document.getElementById('gesture-jp');

    // Update display
    iconEl.innerHTML = `<i class="bi ${gesture.icon}"></i>`;
    iconEl.style.color = gesture.color;
    nameEl.textContent = gesture.name;
    nameEl.className = 'gesture-name ' + gestureKey;
    jpEl.textContent = gesture.nameJp;

    // Animation
    iconEl.classList.add('active');
    setTimeout(() => iconEl.classList.remove('active'), 200);

    // Play sound
    if (gesture.sound) {
      playSound(gesture.sound);
    }

    // Update counter
    if (gestureKey !== 'idle') {
      detectionCount++;
      document.getElementById('detection-count').textContent = detectionCount;

      // Add to history
      addToHistory(gestureKey);
    }
  }

  function addToHistory(gestureKey) {
    gestureHistory.unshift(gestureKey);
    if (gestureHistory.length > 10) {
      gestureHistory.pop();
    }

    const listEl = document.getElementById('history-list');
    listEl.innerHTML = gestureHistory.map(g =>
      `<span class="history-item ${g}">${GESTURES[g].nameJp}</span>`
    ).join('');
  }

  function updateDataRate() {
    const now = Date.now();
    const elapsed = (now - lastDataCountTime) / 1000;
    if (elapsed >= 1) {
      dataRate = Math.round(dataCount / elapsed);
      document.getElementById('data-rate').textContent = dataRate + ' Hz';
      dataCount = 0;
      lastDataCountTime = now;
    }
  }

  // ============================================================================
  // SOUND TOGGLE
  // ============================================================================
  window.toggleSound = function() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('sound-toggle');
    if (soundEnabled) {
      btn.innerHTML = '<i class="bi bi-volume-up"></i><span>Sound ON</span>';
      btn.classList.remove('muted');
    } else {
      btn.innerHTML = '<i class="bi bi-volume-mute"></i><span>Sound OFF</span>';
      btn.classList.add('muted');
    }
  };

  // ============================================================================
  // ORPHE CALLBACKS
  // ============================================================================
  function setupOrpheCallbacks(ble) {
    const originalOnConnect = ble.onConnect;
    const originalOnDisconnect = ble.onDisconnect;

    ble.onConnect = function() {
      console.log('[GestureDemo] Connected');
      isConnected = true;
      updateConnectionStatus(true);
      showGesture('idle');
      document.getElementById('gesture-jp').textContent = 'ジェスチャーをしてください';
      if (originalOnConnect) originalOnConnect.call(this);
    };

    ble.onDisconnect = function() {
      console.log('[GestureDemo] Disconnected');
      isConnected = false;
      updateConnectionStatus(false);
      document.getElementById('gesture-name').textContent = 'WAITING';
      document.getElementById('gesture-jp').textContent = 'COREを接続してください';
      if (originalOnDisconnect) originalOnDisconnect.call(this);
    };

    // Acceleration callback
    ble.gotAcc = function(acc) {
      currentAcc = acc;
      dataCount++;
      processGesture();
    };

    // Gyroscope callback
    ble.gotGyro = function(gyro) {
      currentGyro = gyro;
      processGesture();
    };

    // Euler callback - needed for pitch-based detection
    ble.gotEuler = function(euler) {
      detector.updateEuler(euler);
    };

    // Also support converted values
    ble.gotConvertedAcc = function(acc) {
      currentAcc = acc;
      dataCount++;
      processGesture();
    };

    ble.gotConvertedGyro = function(gyro) {
      currentGyro = gyro;
      processGesture();
    };
  }

  function processGesture() {
    if (!isConnected) return;
    if (!currentAcc || !currentGyro) return;

    // Update sensor display
    updateSensorDisplay(currentAcc, currentGyro);
    updateDataRate();

    // Detect gesture
    const gesture = detector.update(currentAcc, currentGyro);
    if (gesture) {
      console.log('[GestureDemo] Detected:', gesture);
      showGesture(gesture);
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  function init() {
    console.log('[GestureDemo] Initializing...');

    // Setup callbacks for all BLE instances
    if (typeof bles !== 'undefined' && bles[0]) {
      setupOrpheCallbacks(bles[0]);
      console.log('[GestureDemo] Callbacks registered');
    }

    // Initial UI state
    showGesture('idle');
    document.getElementById('gesture-jp').textContent = 'COREを接続してください';

    console.log('[GestureDemo] Ready');
    console.log('[GestureDemo] Thresholds:', THRESHOLDS);
  }

  // Wait for DOM and ORPHE SDK
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  // Export for debugging
  window.gestureDemo = {
    detector,
    THRESHOLDS,
    GESTURES,
    getState: () => ({ isConnected, soundEnabled, detectionCount, gestureHistory })
  };

})();
