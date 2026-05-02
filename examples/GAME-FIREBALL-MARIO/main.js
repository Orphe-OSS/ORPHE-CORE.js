/**
 * ORPHE CORE Integration for Fireball Action Game
 *
 * Sensor Mapping:
 * - Walking (steps) → Character moves forward
 * - Kick (high acceleration) → Shoot fireball
 * - Jump (upward acceleration + landing impact) → Character jumps
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  const SENSOR_CONFIG = {
    // Kick detection
    kick: {
      threshold: 3.0,      // G - acceleration magnitude to trigger kick
      cooldownMs: 400,     // Prevent rapid-fire
      bufferSize: 15       // Frames to analyze for direction
    },

    // Jump detection
    jump: {
      threshold: 2.5,      // G - upward acceleration threshold
      cooldownMs: 500,     // Prevent double-jump detection
      landingThreshold: 1.8 // Landing impact threshold
    },

    // Walk detection
    walk: {
      stepCooldownMs: 200, // Minimum time between step triggers
      speedMultiplier: 4   // Walk speed based on step rate
    }
  };

  // ============================================================================
  // STATE
  // ============================================================================
  let isConnected = false;
  let sensorBuffer = [];

  // Cooldown tracking
  let lastKickTime = 0;
  let lastJumpTime = 0;
  let lastStepTime = 0;
  let lastStepCount = 0;

  // Current sensor values
  let currentAcc = { x: 0, y: 0, z: 0 };
  let currentAccMag = 0;
  let lastAccZ = 0;

  // Jump state
  let isInAir = false;
  let jumpStartTime = 0;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  window.addEventListener('DOMContentLoaded', () => {
    console.log('[ORPHE] Initializing sensor integration...');

    // Wait for bles to be available (created by CoreToolkit)
    setTimeout(() => {
      if (typeof bles !== 'undefined' && bles[0]) {
        setupOrpheCallbacks(bles[0]);
        console.log('[ORPHE] Callbacks registered');
      } else {
        console.warn('[ORPHE] bles not available, retrying...');
        setTimeout(() => {
          if (typeof bles !== 'undefined' && bles[0]) {
            setupOrpheCallbacks(bles[0]);
          }
        }, 1000);
      }
    }, 500);
  });

  // ============================================================================
  // ORPHE CALLBACKS
  // ============================================================================
  function setupOrpheCallbacks(ble) {
    ble.setup();

    // Connection events
    ble.onConnect = function() {
      console.log('[ORPHE] Connected!');
      isConnected = true;
      updateConnectionStatus(true);
    };

    ble.onDisconnect = function() {
      console.log('[ORPHE] Disconnected');
      isConnected = false;
      updateConnectionStatus(false);
    };

    // === SENSOR_VALUES: High-frequency acceleration data ===
    ble.gotConvertedAcc = function(acc) {
      currentAcc = acc;
      currentAccMag = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);

      // Update buffer for kick analysis
      sensorBuffer.push({
        acc: { ...acc },
        magnitude: currentAccMag,
        timestamp: performance.now()
      });

      if (sensorBuffer.length > SENSOR_CONFIG.kick.bufferSize) {
        sensorBuffer.shift();
      }

      // Update debug display
      updateSensorDisplay();

      // Check for kick (high acceleration burst)
      checkKick();

      // Check for jump (rapid upward acceleration)
      checkJump(acc);

      lastAccZ = acc.z;
    };

    // === STEP_ANALYSIS: Step counting for walking ===
    ble.gotGait = function(gait) {
      const now = Date.now();

      // Detect new steps
      if (gait.steps > lastStepCount) {
        const newSteps = gait.steps - lastStepCount;
        lastStepCount = gait.steps;

        // Trigger walk if enough time has passed
        if (now - lastStepTime > SENSOR_CONFIG.walk.stepCooldownMs) {
          lastStepTime = now;
          triggerWalk(newSteps);
        }
      }

      // Update step display
      const stepEl = document.getElementById('step-count');
      if (stepEl) stepEl.textContent = gait.steps;
    };

    // === Landing impact for jump confirmation ===
    ble.gotLandingImpact = function(impact) {
      if (isInAir && impact.value > SENSOR_CONFIG.jump.landingThreshold) {
        isInAir = false;
        console.log('[ORPHE] Landing detected, impact:', impact.value.toFixed(2));
      }
    };

    console.log('[ORPHE] All callbacks registered');
  }

  // ============================================================================
  // ACTION DETECTION
  // ============================================================================

  /**
   * Check for kick action (high acceleration burst)
   */
  function checkKick() {
    const now = performance.now();

    // Cooldown check
    if (now - lastKickTime < SENSOR_CONFIG.kick.cooldownMs) return;

    // Threshold check
    if (currentAccMag > SENSOR_CONFIG.kick.threshold &&
        sensorBuffer.length >= SENSOR_CONFIG.kick.bufferSize) {

      lastKickTime = now;

      console.log(`[ORPHE] KICK detected! Magnitude: ${currentAccMag.toFixed(2)}G`);
      updateLastAction('KICK', currentAccMag);

      // Trigger fireball in game
      if (window.game) {
        window.game.triggerFireball();
      }

      // Clear buffer after kick
      sensorBuffer = [];
    }
  }

  /**
   * Check for jump action (rapid upward acceleration)
   */
  function checkJump(acc) {
    const now = performance.now();

    // Cooldown check
    if (now - lastJumpTime < SENSOR_CONFIG.jump.cooldownMs) return;

    // Detect upward acceleration (Z-axis for foot sensor)
    // Looking for rapid increase in Z acceleration
    const accChange = acc.z - lastAccZ;

    if (!isInAir &&
        acc.z > SENSOR_CONFIG.jump.threshold &&
        accChange > 1.0) {  // Rapid upward movement

      lastJumpTime = now;
      isInAir = true;
      jumpStartTime = now;

      console.log(`[ORPHE] JUMP detected! Z-acc: ${acc.z.toFixed(2)}G`);
      updateLastAction('JUMP', acc.z);

      // Trigger jump in game
      if (window.game) {
        window.game.triggerJump();
      }
    }
  }

  /**
   * Trigger walk action from steps
   */
  function triggerWalk(stepCount) {
    console.log(`[ORPHE] WALK detected! Steps: ${stepCount}`);
    updateLastAction('WALK', stepCount);

    // Trigger walk in game
    if (window.game) {
      const speed = stepCount * SENSOR_CONFIG.walk.speedMultiplier;
      window.game.triggerWalk(speed);
    }
  }

  // ============================================================================
  // UI UPDATES
  // ============================================================================

  function updateConnectionStatus(connected) {
    const el = document.getElementById('connection-status');
    if (el) {
      el.textContent = connected ? 'Connected' : 'Disconnected';
      el.style.color = connected ? '#4caf50' : '#ff9800';
    }
  }

  function updateSensorDisplay() {
    const accMagEl = document.getElementById('acc-mag');
    if (accMagEl) {
      accMagEl.textContent = currentAccMag.toFixed(2);

      // Highlight when above kick threshold
      if (currentAccMag > SENSOR_CONFIG.kick.threshold) {
        accMagEl.style.color = '#ff5722';
      } else {
        accMagEl.style.color = '#0f0';
      }
    }
  }

  function updateLastAction(action, value) {
    const el = document.getElementById('last-action');
    if (el) {
      el.textContent = `${action} (${typeof value === 'number' ? value.toFixed(2) : value})`;

      // Color based on action
      switch (action) {
        case 'KICK':
          el.style.color = '#ff5722';
          break;
        case 'JUMP':
          el.style.color = '#4caf50';
          break;
        case 'WALK':
          el.style.color = '#ffeb3b';
          break;
        default:
          el.style.color = '#0f0';
      }
    }
  }

  // ============================================================================
  // THRESHOLD ADJUSTMENT UI
  // ============================================================================

  // Allow runtime threshold adjustment
  window.setSensorThresholds = function(options) {
    if (options.kick !== undefined) {
      SENSOR_CONFIG.kick.threshold = options.kick;
      const el = document.getElementById('kick-threshold');
      if (el) el.textContent = options.kick.toFixed(1);
      console.log(`[ORPHE] Kick threshold set to ${options.kick}G`);
    }

    if (options.jump !== undefined) {
      SENSOR_CONFIG.jump.threshold = options.jump;
      const el = document.getElementById('jump-threshold');
      if (el) el.textContent = options.jump.toFixed(1);
      console.log(`[ORPHE] Jump threshold set to ${options.jump}G`);
    }
  };

  // ============================================================================
  // DEBUG/TESTING
  // ============================================================================

  // Expose for debugging
  window.orpheDebug = {
    getState: () => ({
      isConnected,
      currentAccMag,
      bufferSize: sensorBuffer.length,
      isInAir,
      lastStepCount
    }),
    getConfig: () => SENSOR_CONFIG,
    simulateKick: () => {
      if (window.game) window.game.triggerFireball();
    },
    simulateJump: () => {
      if (window.game) window.game.triggerJump();
    },
    simulateWalk: () => {
      if (window.game) window.game.triggerWalk(4);
    }
  };

  console.log('[ORPHE] Main.js loaded. Use orpheDebug for testing.');
  console.log('[ORPHE] Keyboard fallback: → Walk, Space Jump, X Fireball');

})();
