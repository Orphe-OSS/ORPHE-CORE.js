/**
 * ORPHE CORE Sensor Calibration Recorder
 * Records sensor data for gesture analysis and AI training
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  const CONFIG = {
    countdownSeconds: 1,  // Quick 1-second countdown
    recordingDurationMs: 1000,  // Default 1 second of recording
    sampleRateHz: 200,  // Expected sample rate
    graphHistorySize: 200
  };

  // Get recording duration from UI (can be changed by user)
  function getRecordingDuration() {
    const select = document.getElementById('select-recording-duration');
    if (select) {
      return parseInt(select.value);
    }
    return CONFIG.recordingDurationMs;
  }

  // ============================================================================
  // STATE
  // ============================================================================
  let isConnected = false;
  let isRecording = false;
  let currentGesture = null;
  let recordingStartTime = 0;

  // Device info (auto-detected)
  let deviceInfo = {
    coreVersion: 'unknown',
    notificationType: 'STEP_ANALYSIS_AND_SENSOR_VALUES',
    accRange: 16,
    gyroRange: 2000,
    mountPosition: 'unknown',
    battery: 'unknown'
  };

  // User-selected device config (used for recording)
  let userDeviceConfig = {
    coreVersion: 'CORE 3.0',
    mountPosition: 'Left Instep',
    notificationType: 'STEP_ANALYSIS_AND_SENSOR_VALUES',
    accRange: 16,
    gyroRange: 2000
  };

  // Current sensor values
  let currentData = {
    acc: { x: 0, y: 0, z: 0 },
    accMag: 0,
    gyro: { x: 0, y: 0, z: 0 },
    gyroMag: 0,
    euler: { pitch: 0, roll: 0, yaw: 0 },
    quat: { w: 1, x: 0, y: 0, z: 0 },
    gait: { direction: -1, steps: 0, type: 0, distance: 0 },
    landingImpact: 0,
    stride: { x: 0, y: 0, z: 0 },
    pronation: { x: 0, y: 0, z: 0 }
  };

  // Recording buffer
  let recordingBuffer = [];

  // All recordings
  let recordings = [];

  // Graph data
  let accGraphData = [];
  let gyroGraphData = [];

  // Data rate tracking
  let dataCount = 0;
  let lastRateUpdate = Date.now();

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  window.addEventListener('DOMContentLoaded', () => {
    console.log('[Recorder] Initializing...');

    initGraphs();

    // Wait for CoreToolkit to initialize bles, then set up callbacks
    const waitForBle = setInterval(() => {
      if (typeof bles !== 'undefined' && bles[0]) {
        clearInterval(waitForBle);
        setupOrpheCallbacks(bles[0]);
        console.log('[Recorder] ORPHE callbacks registered');
      }
    }, 100);

    // Update UI periodically
    setInterval(updateUI, 100);
    setInterval(updateDataRate, 1000);
    setInterval(drawGraphs, 50);

    // Load saved recordings from localStorage
    loadRecordings();

    // Initialize user config from UI
    initUserDeviceConfig();
  });

  // ============================================================================
  // USER DEVICE CONFIG
  // ============================================================================
  function initUserDeviceConfig() {
    const versionSelect = document.getElementById('select-core-version');
    const mountSelect = document.getElementById('select-mount-position');
    const notifySelect = document.getElementById('select-notify-type');
    const accSelect = document.getElementById('select-acc-range');
    const gyroSelect = document.getElementById('select-gyro-range');

    if (versionSelect) userDeviceConfig.coreVersion = versionSelect.value;
    if (mountSelect) userDeviceConfig.mountPosition = mountSelect.value;
    if (notifySelect) userDeviceConfig.notificationType = notifySelect.value;
    if (accSelect) userDeviceConfig.accRange = parseInt(accSelect.value);
    if (gyroSelect) userDeviceConfig.gyroRange = parseInt(gyroSelect.value);

    console.log('[Recorder] User device config initialized:', userDeviceConfig);
  }

  window.updateUserDeviceConfig = function() {
    const versionSelect = document.getElementById('select-core-version');
    const mountSelect = document.getElementById('select-mount-position');

    if (versionSelect) userDeviceConfig.coreVersion = versionSelect.value;
    if (mountSelect) userDeviceConfig.mountPosition = mountSelect.value;

    console.log('[Recorder] User device config updated:', userDeviceConfig);
  };

  // Apply notification type to device
  window.applyNotificationType = function() {
    const notifySelect = document.getElementById('select-notify-type');
    if (!notifySelect) return;

    const notifyType = notifySelect.value;
    userDeviceConfig.notificationType = notifyType;

    if (typeof bles !== 'undefined' && bles[0] && isConnected) {
      try {
        bles[0].setNotificationType(notifyType);
        console.log(`[Recorder] Notification type set to: ${notifyType}`);
      } catch (e) {
        console.error('[Recorder] Failed to set notification type:', e);
      }
    } else {
      console.log(`[Recorder] Notification type will be applied on connect: ${notifyType}`);
    }
  };

  // Apply sensor range to device
  window.applySensorRange = function() {
    const accSelect = document.getElementById('select-acc-range');
    const gyroSelect = document.getElementById('select-gyro-range');

    if (accSelect) userDeviceConfig.accRange = parseInt(accSelect.value);
    if (gyroSelect) userDeviceConfig.gyroRange = parseInt(gyroSelect.value);

    if (typeof bles !== 'undefined' && bles[0] && isConnected) {
      try {
        // Convert to index values (2=0, 4=1, 8=2, 16=3)
        const accRangeIndex = { 2: 0, 4: 1, 8: 2, 16: 3 }[userDeviceConfig.accRange] || 3;
        const gyroRangeIndex = { 250: 0, 500: 1, 1000: 2, 2000: 3 }[userDeviceConfig.gyroRange] || 3;

        bles[0].setAccRange(accRangeIndex);
        bles[0].setGyroRange(gyroRangeIndex);
        console.log(`[Recorder] Sensor range set - Acc: ±${userDeviceConfig.accRange}G, Gyro: ±${userDeviceConfig.gyroRange}°/s`);
      } catch (e) {
        console.error('[Recorder] Failed to set sensor range:', e);
      }
    } else {
      console.log(`[Recorder] Sensor range will be applied on connect - Acc: ±${userDeviceConfig.accRange}G, Gyro: ±${userDeviceConfig.gyroRange}°/s`);
    }
  };

  // ============================================================================
  // GRAPH INITIALIZATION
  // ============================================================================
  let accCanvas, accCtx, gyroCanvas, gyroCtx;

  function initGraphs() {
    accCanvas = document.getElementById('accGraph');
    gyroCanvas = document.getElementById('gyroGraph');

    if (accCanvas) {
      accCanvas.width = accCanvas.offsetWidth * 2;
      accCanvas.height = accCanvas.offsetHeight * 2;
      accCtx = accCanvas.getContext('2d');
    }

    if (gyroCanvas) {
      gyroCanvas.width = gyroCanvas.offsetWidth * 2;
      gyroCanvas.height = gyroCanvas.offsetHeight * 2;
      gyroCtx = gyroCanvas.getContext('2d');
    }
  }

  function drawGraphs() {
    drawGraph(accCtx, accCanvas, accGraphData, 0, 20, '#4caf50', 'Acc');
    drawGraph(gyroCtx, gyroCanvas, gyroGraphData, 0, 500, '#2196f3', 'Gyro');
  }

  function drawGraph(ctx, canvas, data, min, max, color, label) {
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw data
    if (data.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((val, i) => {
      const x = (i / CONFIG.graphHistorySize) * w;
      const y = h - ((val - min) / (max - min)) * h;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Recording indicator
    if (isRecording) {
      ctx.fillStyle = 'rgba(244, 67, 54, 0.3)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f44336';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('● REC', 10, 30);
    }
  }

  // ============================================================================
  // ORPHE CALLBACKS
  // ============================================================================
  function setupOrpheCallbacks(ble) {
    // Don't call ble.setup() here - CoreToolkit already does this
    // Instead, extend/wrap existing callbacks

    // Store original callbacks if they exist
    const originalOnConnect = ble.onConnect;
    const originalOnDisconnect = ble.onDisconnect;

    // Prevent multiple fetchDeviceInfo calls
    let deviceInfoFetched = false;

    ble.onConnect = function() {
      console.log('[Recorder] Connected');
      isConnected = true;
      updateConnectionStatus(true);
      // Don't call fetchDeviceInfo here - it conflicts with CoreToolkit's begin()
      // Device info will be set from user selections instead
      // Call original if exists
      if (originalOnConnect) originalOnConnect.call(this);
    };

    ble.onDisconnect = function() {
      console.log('[Recorder] Disconnected');
      isConnected = false;
      updateConnectionStatus(false);
      // Call original if exists
      if (originalOnDisconnect) originalOnDisconnect.call(this);
    };

    // Track if we've received data
    let firstDataReceived = false;

    // Converted acceleration (actual G values)
    ble.gotConvertedAcc = function(acc) {
      if (!firstDataReceived) {
        console.log('[Recorder] First gotConvertedAcc received:', acc);
        firstDataReceived = true;
      }
      currentData.acc = acc;
      currentData.accMag = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
      dataCount++;

      // Update graph
      accGraphData.push(currentData.accMag);
      if (accGraphData.length > CONFIG.graphHistorySize) {
        accGraphData.shift();
      }

      // Record if active
      if (isRecording) {
        addToRecordingBuffer('acc', acc);
      }
    };

    // Also hook into gotAcc as fallback (raw acceleration)
    let firstRawAccReceived = false;
    ble.gotAcc = function(acc) {
      if (!firstRawAccReceived) {
        console.log('[Recorder] First gotAcc (raw) received:', acc);
        firstRawAccReceived = true;
      }
      // Always use gotAcc as primary source now
      currentData.acc = acc;
      currentData.accMag = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
      dataCount++;

      accGraphData.push(currentData.accMag);
      if (accGraphData.length > CONFIG.graphHistorySize) {
        accGraphData.shift();
      }

      if (isRecording) {
        addToRecordingBuffer('acc', acc);
      }
    };

    // Converted gyro
    let firstGyroReceived = false;
    ble.gotConvertedGyro = function(gyro) {
      if (!firstGyroReceived) {
        console.log('[Recorder] First gotConvertedGyro received:', gyro);
        firstGyroReceived = true;
      }
      currentData.gyro = gyro;
      currentData.gyroMag = Math.sqrt(gyro.x**2 + gyro.y**2 + gyro.z**2);

      // Update graph
      gyroGraphData.push(currentData.gyroMag);
      if (gyroGraphData.length > CONFIG.graphHistorySize) {
        gyroGraphData.shift();
      }

      if (isRecording) {
        addToRecordingBuffer('gyro', gyro);
      }
    };

    // Raw gyro fallback
    let firstRawGyroReceived = false;
    ble.gotGyro = function(gyro) {
      if (!firstRawGyroReceived) {
        console.log('[Recorder] First gotGyro (raw) received:', gyro);
        firstRawGyroReceived = true;
      }
      currentData.gyro = gyro;
      currentData.gyroMag = Math.sqrt(gyro.x**2 + gyro.y**2 + gyro.z**2);

      gyroGraphData.push(currentData.gyroMag);
      if (gyroGraphData.length > CONFIG.graphHistorySize) {
        gyroGraphData.shift();
      }

      if (isRecording) {
        addToRecordingBuffer('gyro', gyro);
      }
    };

    // Euler angles
    ble.gotEuler = function(euler) {
      currentData.euler = euler;
      if (isRecording) {
        addToRecordingBuffer('euler', euler);
      }
    };

    // Quaternion
    ble.gotQuat = function(quat) {
      currentData.quat = quat;
      if (isRecording) {
        addToRecordingBuffer('quat', quat);
      }
    };

    // Gait analysis
    ble.gotGait = function(gait) {
      currentData.gait = gait;
      if (isRecording) {
        addToRecordingBuffer('gait', gait);
      }
    };

    // Landing impact
    ble.gotLandingImpact = function(impact) {
      currentData.landingImpact = impact.value || impact;
      if (isRecording) {
        addToRecordingBuffer('landingImpact', { value: currentData.landingImpact });
      }
    };

    // Stride
    ble.gotStride = function(stride) {
      currentData.stride = stride;
      if (isRecording) {
        addToRecordingBuffer('stride', stride);
      }
    };

    // Pronation
    ble.gotPronation = function(pronation) {
      currentData.pronation = pronation;
      if (isRecording) {
        addToRecordingBuffer('pronation', pronation);
      }
    };

    // BLE frequency
    ble.gotBLEFrequency = function(freq) {
      const el = document.getElementById('data-rate');
      if (el) el.textContent = `${Math.round(freq)} Hz`;
    };
  }

  // ============================================================================
  // DEVICE INFO
  // ============================================================================
  async function fetchDeviceInfo(ble) {
    try {
      const info = await ble.getDeviceInformation();
      console.log('[Recorder] Device info:', info);

      deviceInfo.battery = ['Low', 'Medium', 'Full'][info.battery] || 'Unknown';
      deviceInfo.mountPosition = ['Left Instep', 'Right Instep', 'Left Plantar', 'Right Plantar'][info.lr] || 'Unknown';
      deviceInfo.accRange = [2, 4, 8, 16][info.range?.acc] || 16;
      deviceInfo.gyroRange = [250, 500, 1000, 2000][info.range?.gyro] || 2000;

      // Try to detect CORE version from device name or characteristics
      if (ble.device && ble.device.name) {
        if (ble.device.name.includes('3')) {
          deviceInfo.coreVersion = 'CORE 3.0';
        } else if (ble.device.name.includes('2')) {
          deviceInfo.coreVersion = 'CORE 2.0';
        } else {
          deviceInfo.coreVersion = ble.device.name;
        }
      }

      updateDeviceInfoUI();
    } catch (e) {
      console.error('[Recorder] Failed to get device info:', e);
    }
  }

  function updateDeviceInfoUI() {
    const setEl = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setEl('core-version', deviceInfo.coreVersion);
    setEl('notify-type', deviceInfo.notificationType);
    setEl('acc-range', `±${deviceInfo.accRange}G`);
    setEl('gyro-range', `±${deviceInfo.gyroRange}°/s`);
    setEl('mount-pos', deviceInfo.mountPosition);
    setEl('battery', deviceInfo.battery);
  }

  // ============================================================================
  // RECORDING
  // ============================================================================
  window.startRecording = function(gesture) {
    if (!isConnected) {
      alert('ORPHE COREを接続してください');
      return;
    }

    if (isRecording) {
      console.warn('[Recorder] Already recording');
      return;
    }

    currentGesture = gesture;
    showRecordingOverlay(gesture);
  };

  function showRecordingOverlay(gesture) {
    const overlay = document.getElementById('recording-overlay');
    const countdownEl = document.getElementById('countdown-display');
    const gestureEl = document.getElementById('recording-gesture');
    const statusEl = document.getElementById('recording-status');

    overlay.style.display = 'flex';
    gestureEl.textContent = `Recording: ${gesture}`;

    // Quick countdown
    let count = CONFIG.countdownSeconds;
    if (count > 0) {
      countdownEl.textContent = count;
      statusEl.textContent = 'Get ready...';

      const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
          countdownEl.textContent = count;
        } else {
          clearInterval(countdownInterval);
          startRecordingPhase(gesture);
        }
      }, 1000);
    } else {
      // No countdown, start immediately
      startRecordingPhase(gesture);
    }
  }

  function startRecordingPhase(gesture) {
    const countdownEl = document.getElementById('countdown-display');
    const statusEl = document.getElementById('recording-status');
    const duration = getRecordingDuration();

    countdownEl.innerHTML = '<span style="color: #f44336;">● REC</span>';
    statusEl.textContent = 'Recording...';

    beginRecording(gesture);

    // Update progress bar during recording
    const progressEl = document.getElementById('recording-progress');
    if (progressEl) {
      progressEl.style.display = 'block';
      progressEl.querySelector('.progress-fill').style.width = '0%';
    }

    const startTime = performance.now();
    const progressInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);

      if (progressEl) {
        progressEl.querySelector('.progress-fill').style.width = `${progress}%`;
      }

      // Update remaining time
      const remaining = Math.max(0, duration - elapsed);
      statusEl.textContent = `Recording... ${(remaining / 1000).toFixed(1)}s`;

      if (progress >= 100) {
        clearInterval(progressInterval);
      }
    }, 50);
  }

  function beginRecording(gesture) {
    console.log(`[Recorder] Starting recording: ${gesture}`);
    console.log(`[Recorder] isConnected: ${isConnected}, dataCount: ${dataCount}`);
    console.log(`[Recorder] Current acc: `, currentData.acc, `mag: ${currentData.accMag}`);

    isRecording = true;
    recordingBuffer = [];
    recordingStartTime = performance.now();

    // Update button state
    const btn = document.querySelector(`[data-gesture="${gesture}"]`);
    if (btn) btn.classList.add('recording');

    document.getElementById('recording-indicator').classList.add('active');

    // Auto-stop after duration
    const duration = getRecordingDuration();
    setTimeout(() => {
      stopRecording();
    }, duration);
  }

  function addToRecordingBuffer(type, data) {
    recordingBuffer.push({
      timestamp: performance.now() - recordingStartTime,
      type,
      data: JSON.parse(JSON.stringify(data))  // Deep copy
    });
  }

  function stopRecording() {
    if (!isRecording) return;

    console.log(`[Recorder] Stopping recording: ${currentGesture}, ${recordingBuffer.length} samples`);

    isRecording = false;

    // Update button state
    document.querySelectorAll('.gesture-btn').forEach(btn => btn.classList.remove('recording'));
    document.getElementById('recording-indicator').classList.remove('active');

    // Save recording with both user config and auto-detected info
    const duration = getRecordingDuration();
    const recording = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      gesture: currentGesture,
      timestamp: new Date().toISOString(),
      duration: duration,
      sampleCount: recordingBuffer.length,
      deviceInfo: {
        // User-selected values (primary)
        coreVersion: userDeviceConfig.coreVersion,
        mountPosition: userDeviceConfig.mountPosition,
        notificationType: userDeviceConfig.notificationType,
        accRange: userDeviceConfig.accRange,
        gyroRange: userDeviceConfig.gyroRange,
        // Auto-detected values
        detectedCore: deviceInfo.coreVersion,
        detectedMount: deviceInfo.mountPosition,
        detectedAccRange: deviceInfo.accRange,
        detectedGyroRange: deviceInfo.gyroRange,
        battery: deviceInfo.battery
      },
      data: recordingBuffer
    };

    recordings.push(recording);
    saveRecordings();
    updateRecordingsUI();

    console.log(`[Recorder] Saved recording: ${recording.id}`);

    // Show summary instead of hiding overlay immediately
    showRecordingSummary(recording);
  }

  function showRecordingSummary(recording) {
    const overlay = document.getElementById('recording-overlay');
    const countdownEl = document.getElementById('countdown-display');
    const gestureEl = document.getElementById('recording-gesture');
    const statusEl = document.getElementById('recording-status');
    const progressEl = document.getElementById('recording-progress');

    // Calculate statistics
    const accData = recording.data.filter(d => d.type === 'acc');
    const convertedAcc = accData.filter(d => Math.abs(d.data.z) > 0.5);
    const gyroData = recording.data.filter(d => d.type === 'gyro');
    const convertedGyro = gyroData.filter(d => d.data.x !== undefined && Math.abs(d.data.x) < 100);

    let maxAcc = 0, avgAcc = 0, minAcc = 999;
    let maxGyro = 0, avgGyro = 0;

    if (convertedAcc.length > 0) {
      const mags = convertedAcc.map(d => Math.sqrt(d.data.x**2 + d.data.y**2 + d.data.z**2));
      maxAcc = Math.max(...mags);
      minAcc = Math.min(...mags);
      avgAcc = mags.reduce((a, b) => a + b) / mags.length;
    }

    if (convertedGyro.length > 0) {
      const mags = convertedGyro.map(d => Math.sqrt(d.data.x**2 + d.data.y**2 + d.data.z**2));
      maxGyro = Math.max(...mags);
      avgGyro = mags.reduce((a, b) => a + b) / mags.length;
    }

    // Hide progress bar
    if (progressEl) progressEl.style.display = 'none';

    // Show summary
    countdownEl.innerHTML = '<i class="bi bi-check-circle" style="color: #4caf50;"></i>';
    gestureEl.textContent = `Recorded: ${recording.gesture}`;

    statusEl.innerHTML = `
      <div style="text-align: left; max-width: 300px; margin: 20px auto; font-size: 1rem; line-height: 1.8;">
        <div><strong>Samples:</strong> ${recording.sampleCount}</div>
        <div><strong>Max Acc:</strong> ${maxAcc.toFixed(2)}G</div>
        <div><strong>Avg Acc:</strong> ${avgAcc.toFixed(2)}G</div>
        <div><strong>Min Acc:</strong> ${minAcc.toFixed(2)}G</div>
        <div><strong>Max Gyro:</strong> ${maxGyro.toFixed(1)}°/s</div>
        <div style="margin-top: 15px; color: ${maxAcc > 2 ? '#4caf50' : '#ff9800'};">
          ${maxAcc > 2 ? '✓ Motion detected' : '⚠ Low motion - retry?'}
        </div>
      </div>
    `;

    // Auto-hide after 2 seconds
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 2000);
  }

  // ============================================================================
  // UI UPDATES
  // ============================================================================
  function updateUI() {
    // Sensor values
    const setEl = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    const acc = currentData.acc;
    const gyro = currentData.gyro;
    const euler = currentData.euler;
    const quat = currentData.quat;
    const gait = currentData.gait;

    setEl('acc-values', `X: ${acc.x.toFixed(2)}, Y: ${acc.y.toFixed(2)}, Z: ${acc.z.toFixed(2)}`);
    setEl('acc-mag', `${currentData.accMag.toFixed(2)} G`);
    setEl('gyro-values', `X: ${gyro.x.toFixed(1)}, Y: ${gyro.y.toFixed(1)}, Z: ${gyro.z.toFixed(1)}`);

    const toDeg = (r) => (r * 180 / Math.PI).toFixed(1);
    setEl('euler-values', `P: ${toDeg(euler.pitch)}°, R: ${toDeg(euler.roll)}°, Y: ${toDeg(euler.yaw)}°`);
    setEl('quat-values', `W: ${quat.w.toFixed(2)}, X: ${quat.x.toFixed(2)}, Y: ${quat.y.toFixed(2)}, Z: ${quat.z.toFixed(2)}`);

    const dirNames = { 0: 'Left', 2: 'Forward', 4: 'Backward', 6: 'Right' };
    const typeNames = { 0: 'None', 1: 'Walk', 2: 'Run' };
    setEl('gait-values', `Dir: ${dirNames[gait.direction] || '--'}, Steps: ${gait.steps}, Type: ${typeNames[gait.type] || '--'}`);
    setEl('impact-value', currentData.landingImpact.toFixed(2));
  }

  function updateDataRate() {
    // This is now handled by gotBLEFrequency
  }

  function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-indicator');
    const status = document.getElementById('connection-status');

    if (indicator) {
      indicator.classList.toggle('connected', connected);
    }
    if (status) {
      status.textContent = connected ? 'Connected' : 'Disconnected';
    }
  }

  function updateRecordingsUI() {
    const list = document.getElementById('recordings-list');
    const total = document.getElementById('total-recordings');

    if (total) total.textContent = recordings.length;

    if (!list) return;

    if (recordings.length === 0) {
      list.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No recordings yet.</div>';
      return;
    }

    // Group by gesture
    const grouped = {};
    recordings.forEach(r => {
      if (!grouped[r.gesture]) grouped[r.gesture] = [];
      grouped[r.gesture].push(r);
    });

    // Update counts
    Object.keys(grouped).forEach(gesture => {
      const countEl = document.getElementById(`count-${gesture}`);
      if (countEl) {
        countEl.textContent = `${grouped[gesture].length} recordings`;
      }
    });

    // Render list (most recent first)
    list.innerHTML = recordings.slice().reverse().map(r => `
      <div class="recording-item">
        <div class="info">
          <div class="gesture">${r.gesture}</div>
          <div class="meta">${new Date(r.timestamp).toLocaleString()} | ${r.sampleCount} samples</div>
          <div class="meta" style="color: #00bcd4;">${r.deviceInfo.coreVersion} / ${r.deviceInfo.mountPosition}</div>
          <div class="meta" style="color: #888; font-size: 0.7rem;">${r.deviceInfo.notificationType} | ±${r.deviceInfo.accRange}G | ±${r.deviceInfo.gyroRange}°/s</div>
        </div>
        <div class="actions">
          <button class="btn-view" onclick="viewRecording('${r.id}')">View</button>
          <button class="btn-delete" onclick="deleteRecording('${r.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  // ============================================================================
  // RECORDING MANAGEMENT
  // ============================================================================
  window.viewRecording = function(id) {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;

    // Calculate statistics
    const accData = recording.data.filter(d => d.type === 'acc');
    const gaitData = recording.data.filter(d => d.type === 'gait');

    const accMags = accData.map(d => Math.sqrt(d.data.x**2 + d.data.y**2 + d.data.z**2));
    const maxAcc = accMags.length > 0 ? Math.max(...accMags) : 0;
    const avgAcc = accMags.length > 0 ? accMags.reduce((a, b) => a + b) / accMags.length : 0;
    const minAcc = accMags.length > 0 ? Math.min(...accMags) : 0;

    const stepsAtStart = gaitData.length > 0 ? gaitData[0].data.steps : 0;
    const stepsAtEnd = gaitData.length > 0 ? gaitData[gaitData.length - 1].data.steps : 0;
    const stepsDelta = stepsAtEnd - stepsAtStart;

    const directions = gaitData.map(d => d.data.direction).filter(d => d !== undefined);
    const uniqueDirections = [...new Set(directions)];

    const info = `
Recording: ${recording.gesture}
ID: ${recording.id}
Time: ${recording.timestamp}
Duration: ${recording.duration}ms
Samples: ${recording.sampleCount}

User Settings:
- Core Version: ${recording.deviceInfo.coreVersion}
- Mount Position: ${recording.deviceInfo.mountPosition}
- Notification Type: ${recording.deviceInfo.notificationType}
- Acc Range: ±${recording.deviceInfo.accRange}G
- Gyro Range: ±${recording.deviceInfo.gyroRange}°/s

Auto-detected:
- Detected Core: ${recording.deviceInfo.detectedCore || 'N/A'}
- Detected Mount: ${recording.deviceInfo.detectedMount || 'N/A'}
- Detected Acc Range: ±${recording.deviceInfo.detectedAccRange || 'N/A'}G
- Detected Gyro Range: ±${recording.deviceInfo.detectedGyroRange || 'N/A'}°/s

Statistics:
- Acc samples: ${accData.length}
- Max Acc: ${maxAcc.toFixed(2)}G
- Avg Acc: ${avgAcc.toFixed(2)}G
- Min Acc: ${minAcc.toFixed(2)}G
- Steps delta: ${stepsDelta}
- Directions observed: ${uniqueDirections.map(d => ({0:'L',2:'F',4:'B',6:'R'})[d] || d).join(', ') || 'None'}
    `;

    alert(info);
    console.log('[Recorder] Recording details:', recording);
  };

  window.deleteRecording = function(id) {
    if (!confirm('Delete this recording?')) return;

    recordings = recordings.filter(r => r.id !== id);
    saveRecordings();
    updateRecordingsUI();
  };

  window.clearAllRecordings = function() {
    if (!confirm('Delete ALL recordings? This cannot be undone.')) return;

    recordings = [];
    saveRecordings();
    updateRecordingsUI();
  };

  // ============================================================================
  // STORAGE
  // ============================================================================
  function saveRecordings() {
    try {
      localStorage.setItem('orphe_calibration_recordings', JSON.stringify(recordings));
    } catch (e) {
      console.error('[Recorder] Failed to save to localStorage:', e);
    }
  }

  function loadRecordings() {
    try {
      const saved = localStorage.getItem('orphe_calibration_recordings');
      if (saved) {
        recordings = JSON.parse(saved);
        updateRecordingsUI();
        console.log(`[Recorder] Loaded ${recordings.length} recordings from storage`);
      }
    } catch (e) {
      console.error('[Recorder] Failed to load from localStorage:', e);
    }
  }

  // ============================================================================
  // EXPORT
  // ============================================================================
  window.exportAllJSON = function() {
    if (recordings.length === 0) {
      alert('No recordings to export');
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalRecordings: recordings.length,
      recordings: recordings
    };

    downloadJSON(exportData, `orphe_sensor_samples_${Date.now()}.json`);
  };

  window.exportForAI = function() {
    if (recordings.length === 0) {
      alert('No recordings to export');
      return;
    }

    // Group by gesture
    const grouped = {};
    recordings.forEach(r => {
      if (!grouped[r.gesture]) grouped[r.gesture] = [];
      grouped[r.gesture].push(r);
    });

    // Collect unique device configurations from recordings
    const configs = new Map();
    recordings.forEach(r => {
      const key = `${r.deviceInfo.coreVersion}|${r.deviceInfo.mountPosition}|${r.deviceInfo.notificationType}|${r.deviceInfo.accRange}|${r.deviceInfo.gyroRange}`;
      if (!configs.has(key)) {
        configs.set(key, r.deviceInfo);
      }
    });

    // Generate markdown
    let markdown = `# ORPHE CORE Sensor Sample Data

Generated: ${new Date().toISOString()}
Total Recordings: ${recordings.length}

## Device Configurations Used

`;

    configs.forEach((config, key) => {
      markdown += `### ${config.coreVersion} - ${config.mountPosition}

| Property | Value |
|----------|-------|
| Core Version | ${config.coreVersion} |
| Mount Position | ${config.mountPosition} |
| Notification Type | ${config.notificationType} |
| Accelerometer Range | ±${config.accRange}G |
| Gyroscope Range | ±${config.gyroRange}°/s |

**Auto-detected values:**
- Core: ${config.detectedCore || 'N/A'}
- Mount: ${config.detectedMount || 'N/A'}
- Acc Range: ±${config.detectedAccRange || 'N/A'}G
- Gyro Range: ±${config.detectedGyroRange || 'N/A'}°/s

`;
    });

    markdown += `---

`;

    // Analyze each gesture
    Object.keys(grouped).forEach(gesture => {
      const gestureRecordings = grouped[gesture];

      // Group by device config within gesture
      const byConfig = {};
      gestureRecordings.forEach(r => {
        const key = `${r.deviceInfo.coreVersion}|${r.deviceInfo.mountPosition}|${r.deviceInfo.notificationType}|${r.deviceInfo.accRange}|${r.deviceInfo.gyroRange}`;
        if (!byConfig[key]) byConfig[key] = [];
        byConfig[key].push(r);
      });

      markdown += `## Gesture: ${gesture}\n\n`;
      markdown += `Total Recordings: ${gestureRecordings.length}\n\n`;

      // Show breakdown by config
      if (Object.keys(byConfig).length > 1) {
        markdown += `### Device Configuration Breakdown\n\n`;
        Object.entries(byConfig).forEach(([key, recs]) => {
          const [ver, mount, notify, acc, gyro] = key.split('|');
          markdown += `- ${ver} / ${mount} / ${notify} / ±${acc}G / ±${gyro}°/s: ${recs.length} recordings\n`;
        });
        markdown += `\n`;
      }

      // Aggregate statistics
      const allAccMags = [];
      const allStepsDeltas = [];
      const allDirections = [];
      const allLandingImpacts = [];

      gestureRecordings.forEach(r => {
        const accData = r.data.filter(d => d.type === 'acc');
        const gaitData = r.data.filter(d => d.type === 'gait');
        const impactData = r.data.filter(d => d.type === 'landingImpact');

        accData.forEach(d => {
          allAccMags.push(Math.sqrt(d.data.x**2 + d.data.y**2 + d.data.z**2));
        });

        if (gaitData.length > 0) {
          const stepsDelta = gaitData[gaitData.length - 1].data.steps - gaitData[0].data.steps;
          allStepsDeltas.push(stepsDelta);
          gaitData.forEach(d => {
            if (d.data.direction !== undefined) {
              allDirections.push(d.data.direction);
            }
          });
        }

        impactData.forEach(d => {
          if (d.data.value > 0.1) {
            allLandingImpacts.push(d.data.value);
          }
        });
      });

      // Calculate statistics
      if (allAccMags.length > 0) {
        const maxAcc = Math.max(...allAccMags);
        const minAcc = Math.min(...allAccMags);
        const avgAcc = allAccMags.reduce((a, b) => a + b) / allAccMags.length;
        const stdAcc = Math.sqrt(allAccMags.reduce((sum, v) => sum + (v - avgAcc)**2, 0) / allAccMags.length);

        markdown += `### Acceleration Statistics\n\n`;
        markdown += `| Metric | Value |\n`;
        markdown += `|--------|-------|\n`;
        markdown += `| Max | ${maxAcc.toFixed(2)}G |\n`;
        markdown += `| Min | ${minAcc.toFixed(2)}G |\n`;
        markdown += `| Average | ${avgAcc.toFixed(2)}G |\n`;
        markdown += `| Std Dev | ${stdAcc.toFixed(2)}G |\n\n`;
      }

      if (allStepsDeltas.length > 0) {
        const avgSteps = allStepsDeltas.reduce((a, b) => a + b) / allStepsDeltas.length;
        markdown += `### Step Analysis\n\n`;
        markdown += `- Average steps delta: ${avgSteps.toFixed(1)}\n`;
        markdown += `- Steps changed in ${allStepsDeltas.filter(s => s > 0).length}/${allStepsDeltas.length} recordings\n\n`;
      }

      if (allDirections.length > 0) {
        const dirCounts = {};
        allDirections.forEach(d => {
          dirCounts[d] = (dirCounts[d] || 0) + 1;
        });
        const dirNames = { 0: 'Left', 2: 'Forward', 4: 'Backward', 6: 'Right' };

        markdown += `### Direction Distribution\n\n`;
        Object.keys(dirCounts).forEach(d => {
          const pct = ((dirCounts[d] / allDirections.length) * 100).toFixed(1);
          markdown += `- ${dirNames[d] || d}: ${pct}%\n`;
        });
        markdown += `\n`;
      }

      if (allLandingImpacts.length > 0) {
        const maxImpact = Math.max(...allLandingImpacts);
        const avgImpact = allLandingImpacts.reduce((a, b) => a + b) / allLandingImpacts.length;
        markdown += `### Landing Impact\n\n`;
        markdown += `- Max impact: ${maxImpact.toFixed(2)}\n`;
        markdown += `- Average impact: ${avgImpact.toFixed(2)}\n`;
        markdown += `- Impact events: ${allLandingImpacts.length}\n\n`;
      }

      markdown += `---\n\n`;
    });

    // Add detection recommendations
    markdown += `## Recommended Detection Logic\n\n`;
    markdown += `Based on the recorded data, here are suggested detection patterns:\n\n`;
    markdown += `\`\`\`javascript\n`;
    markdown += `// TODO: Generate detection logic based on analyzed data\n`;
    markdown += `// This section should be updated after analyzing the exported JSON\n`;
    markdown += `\`\`\`\n`;

    downloadText(markdown, `orphe_sensor_analysis_${Date.now()}.md`);

    // Also export the raw JSON for reference
    downloadJSON({ recordings }, `orphe_sensor_raw_${Date.now()}.json`);
  };

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================================
  // DEBUG
  // ============================================================================
  window.calibrationDebug = {
    getRecordings: () => recordings,
    getCurrentData: () => currentData,
    getDeviceInfo: () => deviceInfo,
    isRecording: () => isRecording
  };

  console.log('[Recorder] Ready. Use calibrationDebug for debugging.');

})();
