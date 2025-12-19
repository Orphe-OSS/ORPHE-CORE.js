# ORPHE CORE Sensor Data Processing Recipes

このドキュメントは、ORPHE COREセンサーデータを様々なインタラクションに変換するためのアルゴリズムとコードパターンを提供します。

## Table of Contents

1. [Motion Detection Recipes](#motion-detection-recipes)
   - [Kick Detection](#recipe-1-kick-detection)
   - [Jump Detection](#recipe-2-jump-detection)
   - [Step/Walk Detection](#recipe-3-stepwalk-detection)
   - [Direction Detection](#recipe-4-direction-detection)
2. [Orientation Recipes](#orientation-recipes)
   - [Tilt Control](#recipe-5-tilt-control)
   - [3D Rotation](#recipe-6-3d-rotation-quaternion)
   - [Heading/Compass](#recipe-7-headingcompass)
3. [Advanced Patterns](#advanced-patterns)
   - [Gesture Recognition](#recipe-8-gesture-recognition)
   - [Speed/Intensity Calculation](#recipe-9-speedintensity-calculation)
   - [Sensor Fusion](#recipe-10-sensor-fusion)
4. [Utility Functions](#utility-functions)
5. [Debugging Techniques](#debugging-techniques)

---

## Motion Detection Recipes

### Recipe 1: Kick Detection

**Use Case**: ペナルティキックゲーム、サッカーゲーム、格闘ゲームのキック攻撃

**Principle**: 3軸加速度の合成値（magnitude）が閾値を超えたらキック判定

```javascript
// === Configuration ===
const KICK_CONFIG = {
  threshold: 3.0,      // G - キック検出閾値
  bufferSize: 20,      // フレーム数 - 約0.32秒分のデータ
  cooldownMs: 500,     // 連続キック防止時間
  powerScale: 8.0      // パワー正規化用
};

// === State ===
let sensorBuffer = [];
let lastKickTime = 0;
let isKickEnabled = true;

// === Main Detection Logic ===
ble.gotConvertedAcc = function(acc) {
  const now = performance.now();
  const magnitude = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);

  // Add to buffer
  sensorBuffer.push({
    acc: { ...acc },
    magnitude,
    timestamp: now,
    euler: { ...currentEuler }  // Store concurrent euler data
  });

  // Maintain buffer size
  if (sensorBuffer.length > KICK_CONFIG.bufferSize) {
    sensorBuffer.shift();
  }

  // Check for kick
  if (isKickEnabled &&
      magnitude > KICK_CONFIG.threshold &&
      sensorBuffer.length >= KICK_CONFIG.bufferSize &&
      now - lastKickTime > KICK_CONFIG.cooldownMs) {

    const kickData = processKick(sensorBuffer);
    lastKickTime = now;
    onKickDetected(kickData);

    // Reset buffer after kick
    sensorBuffer = [];
  }
};

// Store euler data concurrently
let currentEuler = { pitch: 0, roll: 0, yaw: 0 };
ble.gotEuler = function(euler) {
  currentEuler = euler;
};

// === Kick Processing ===
function processKick(buffer) {
  // Calculate power from acceleration
  const magnitudes = buffer.map(d => d.magnitude);
  const maxAccel = Math.max(...magnitudes);
  const avgAccel = magnitudes.reduce((a, b) => a + b) / magnitudes.length;

  // Power: weighted combination of max and average
  // Range: 0.0 to 1.0
  const power = Math.min(1.0,
    (maxAccel * 0.7 + avgAccel * 0.3) / KICK_CONFIG.powerScale
  );

  // Calculate direction from euler angles
  const yawValues = buffer.map(d => d.euler.yaw);
  const pitchValues = buffer.map(d => d.euler.pitch);

  const avgYaw = yawValues.reduce((a, b) => a + b) / yawValues.length;
  const avgPitch = pitchValues.reduce((a, b) => a + b) / pitchValues.length;

  // Direction in screen coordinates
  // Adjust sensitivity as needed
  const horizontalSensitivity = 1.5;
  const verticalSensitivity = 1.5;

  const dx = avgYaw * horizontalSensitivity * 200;   // pixels
  const dy = avgPitch * verticalSensitivity * 150;   // pixels

  return {
    power,           // 0.0-1.0
    direction: { dx, dy },
    maxAccel,
    avgAccel,
    timestamp: performance.now()
  };
}

// === Usage ===
function onKickDetected(kickData) {
  console.log(`Kick! Power: ${(kickData.power * 100).toFixed(0)}%`);
  console.log(`Direction: dx=${kickData.direction.dx.toFixed(1)}, dy=${kickData.direction.dy.toFixed(1)}`);

  // Example: Shoot ball
  ball.shoot(kickData.power, kickData.direction.dx, kickData.direction.dy);
}
```

**Tuning Tips**:
- `threshold`: 低すぎると誤検知、高すぎると反応しない。2.0-5.0Gが実用的
- `bufferSize`: 大きいと精度向上だがレスポンス低下
- `powerScale`: 最大パワーを1.0にするための除数。実測して調整

---

### Recipe 2: Jump Detection

**Use Case**: プラットフォームゲーム、アクションゲーム、フィットネスアプリ

**Method A: 加速度ベース（瞬時検知）**

```javascript
const JUMP_CONFIG = {
  upwardThreshold: 2.5,    // G - 上昇加速度閾値
  landingThreshold: 1.8,   // G - 着地衝撃閾値
  cooldownMs: 400,         // 連続ジャンプ防止
  minAirTime: 100          // ms - 最小滞空時間
};

let lastAccZ = 0;
let lastJumpTime = 0;
let isInAir = false;
let jumpStartTime = 0;

ble.gotConvertedAcc = function(acc) {
  const now = performance.now();

  // Jump detection (takeoff)
  if (!isInAir &&
      acc.z > JUMP_CONFIG.upwardThreshold &&
      lastAccZ < acc.z * 0.6 &&  // Rapid increase
      now - lastJumpTime > JUMP_CONFIG.cooldownMs) {

    isInAir = true;
    jumpStartTime = now;
    lastJumpTime = now;
    onJumpStart();
  }

  // Landing detection
  if (isInAir &&
      acc.z < -JUMP_CONFIG.landingThreshold &&  // Downward impact
      now - jumpStartTime > JUMP_CONFIG.minAirTime) {

    const airTime = now - jumpStartTime;
    isInAir = false;
    onJumpLand(airTime);
  }

  lastAccZ = acc.z;
};

function onJumpStart() {
  player.jump();
}

function onJumpLand(airTimeMs) {
  console.log(`Landed! Air time: ${airTimeMs.toFixed(0)}ms`);
  player.land();
}
```

**Method B: STEP_ANALYSIS着地衝撃ベース（より安定）**

```javascript
const IMPACT_THRESHOLD = 1.5;  // Landing impact threshold
let lastImpactTime = 0;

ble.gotLandingImpact = function(impact) {
  const now = Date.now();

  if (impact.value > IMPACT_THRESHOLD &&
      now - lastImpactTime > 500) {

    lastImpactTime = now;

    // Impact strength can indicate jump height
    const jumpIntensity = Math.min(1.0, impact.value / 3.0);
    onJumpDetected(jumpIntensity);
  }
};
```

---

### Recipe 3: Step/Walk Detection

**Use Case**: ランニングゲーム、歩数計、リズムゲーム

```javascript
// === Using STEP_ANALYSIS (Recommended) ===
let lastStepCount = 0;
let stepTimes = [];
const STEP_HISTORY = 10;

ble.gotGait = function(gait) {
  if (gait.steps > lastStepCount) {
    const now = performance.now();

    // Calculate step rate
    stepTimes.push(now);
    if (stepTimes.length > STEP_HISTORY) {
      stepTimes.shift();
    }

    const stepRate = calculateStepRate(stepTimes);
    const stepType = gait.type;  // 0: none, 1: walk, 2: run

    onStep({
      totalSteps: gait.steps,
      newSteps: gait.steps - lastStepCount,
      stepRate,  // steps per second
      isRunning: stepType === 2,
      distance: gait.distance
    });

    lastStepCount = gait.steps;
  }
};

function calculateStepRate(times) {
  if (times.length < 2) return 0;

  const duration = (times[times.length - 1] - times[0]) / 1000;  // seconds
  return (times.length - 1) / duration;
}

function onStep(stepData) {
  // Move character based on step rate
  const speed = stepData.isRunning ? 2.0 : 1.0;
  player.moveForward(speed * stepData.stepRate);

  // Update UI
  updateStepCounter(stepData.totalSteps);
}
```

**Using Stride for Precise Distance**:

```javascript
ble.gotStride = function(stride) {
  // stride.x, y, z are in meters
  const strideLength = Math.sqrt(stride.x**2 + stride.y**2 + stride.z**2);

  player.advancePosition(strideLength);
  console.log(`Stride: ${(strideLength * 100).toFixed(1)} cm`);
};
```

---

### Recipe 4: Direction Detection

**Use Case**: DDRスタイルゲーム、方向入力、ナビゲーション

```javascript
// === Direction Map ===
const DIRECTION = {
  0: 'left',
  2: 'forward',
  4: 'backward',
  6: 'right'
};

// For 4-lane rhythm games
const LANE_MAP = {
  0: 0,  // Left → Lane 0
  2: 2,  // Forward → Lane 2 (Up)
  4: 1,  // Backward → Lane 1 (Down)
  6: 3   // Right → Lane 3
};

// === Duplicate Prevention (CRITICAL) ===
let lastDirection = -1;
let lastDirectionTime = 0;
const DIRECTION_DEBOUNCE = 200;  // ms

ble.gotGait = function(gait) {
  const now = Date.now();
  const direction = gait.direction;

  // Skip if same direction or too soon
  if (direction === lastDirection) return;
  if (now - lastDirectionTime < DIRECTION_DEBOUNCE) return;

  lastDirection = direction;
  lastDirectionTime = now;

  const directionName = DIRECTION[direction] || 'unknown';
  const lane = LANE_MAP[direction];

  onDirectionChange({
    raw: direction,
    name: directionName,
    lane,
    timestamp: now
  });
};

function onDirectionChange(data) {
  console.log(`Direction: ${data.name} (lane ${data.lane})`);

  // For rhythm game
  if (gameState === 'playing') {
    checkNoteHit(data.lane, data.timestamp);
  }
}
```

**Multi-Device Direction (2-Player)**:

```javascript
let lastDirections = [-1, -1];
let lastDirectionTimes = [0, 0];

for (let i = 0; i < 2; i++) {
  bles[i].gotGait = function(gait) {
    const playerId = this.id;  // 0 or 1
    const now = Date.now();

    if (gait.direction === lastDirections[playerId]) return;
    if (now - lastDirectionTimes[playerId] < 200) return;

    lastDirections[playerId] = gait.direction;
    lastDirectionTimes[playerId] = now;

    players[playerId].handleDirection(LANE_MAP[gait.direction]);
  };
}
```

---

## Orientation Recipes

### Recipe 5: Tilt Control

**Use Case**: バランスゲーム、傾きでキャラクター移動、レースゲーム

```javascript
const TILT_CONFIG = {
  sensitivity: 2.0,
  deadzone: 0.1,        // radians - ignore small tilts
  maxTilt: Math.PI / 4, // 45 degrees max
  smoothing: 0.3        // 0-1, higher = smoother
};

let smoothedTilt = { x: 0, y: 0 };

ble.gotEuler = function(euler) {
  // euler.roll = left/right tilt (X axis)
  // euler.pitch = forward/backward tilt (Y axis)
  // euler.yaw = rotation (Z axis)

  let tiltX = euler.roll;
  let tiltY = euler.pitch;

  // Apply deadzone
  if (Math.abs(tiltX) < TILT_CONFIG.deadzone) tiltX = 0;
  if (Math.abs(tiltY) < TILT_CONFIG.deadzone) tiltY = 0;

  // Clamp to max tilt
  tiltX = Math.max(-TILT_CONFIG.maxTilt, Math.min(TILT_CONFIG.maxTilt, tiltX));
  tiltY = Math.max(-TILT_CONFIG.maxTilt, Math.min(TILT_CONFIG.maxTilt, tiltY));

  // Normalize to -1 to 1
  const normalizedX = tiltX / TILT_CONFIG.maxTilt;
  const normalizedY = tiltY / TILT_CONFIG.maxTilt;

  // Smooth the values
  smoothedTilt.x += (normalizedX - smoothedTilt.x) * TILT_CONFIG.smoothing;
  smoothedTilt.y += (normalizedY - smoothedTilt.y) * TILT_CONFIG.smoothing;

  // Apply sensitivity
  const outputX = smoothedTilt.x * TILT_CONFIG.sensitivity;
  const outputY = smoothedTilt.y * TILT_CONFIG.sensitivity;

  onTiltUpdate(outputX, outputY);
};

function onTiltUpdate(x, y) {
  // Move character or object
  player.velocity.x = x * maxSpeed;
  player.velocity.y = y * maxSpeed;
}
```

---

### Recipe 6: 3D Rotation (Quaternion)

**Use Case**: 3Dオブジェクト回転、VR/ARアプリ、姿勢表示

```javascript
ble.gotQuat = function(quat) {
  // quat: { w, x, y, z }
  // Apply directly to Three.js object
  object3D.quaternion.set(quat.x, quat.y, quat.z, quat.w);

  // Or convert to rotation matrix for other engines
  const rotationMatrix = quaternionToMatrix(quat);

  // Or get axis-angle representation
  const axisAngle = quaternionToAxisAngle(quat);
};

// Helper: Quaternion to rotation matrix
function quaternionToMatrix(q) {
  const { w, x, y, z } = q;

  return [
    [1 - 2*y*y - 2*z*z,     2*x*y - 2*z*w,     2*x*z + 2*y*w],
    [    2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z,     2*y*z - 2*x*w],
    [    2*x*z - 2*y*w,     2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y]
  ];
}

// Helper: Quaternion to axis-angle
function quaternionToAxisAngle(q) {
  const angle = 2 * Math.acos(q.w);
  const s = Math.sqrt(1 - q.w * q.w);

  if (s < 0.001) {
    return { axis: { x: 1, y: 0, z: 0 }, angle: 0 };
  }

  return {
    axis: { x: q.x / s, y: q.y / s, z: q.z / s },
    angle
  };
}
```

---

### Recipe 7: Heading/Compass

**Use Case**: 方角表示、マップ回転、ナビゲーション

```javascript
let referenceYaw = null;
let currentHeading = 0;

// Calibrate reference direction
function calibrateHeading() {
  referenceYaw = null;
  console.log('Move to reference direction...');
}

ble.gotEuler = function(euler) {
  // First reading becomes reference
  if (referenceYaw === null) {
    referenceYaw = euler.yaw;
    console.log('Reference set');
  }

  // Calculate relative heading
  let heading = euler.yaw - referenceYaw;

  // Normalize to 0-360 degrees
  heading = ((heading * 180 / Math.PI) % 360 + 360) % 360;

  currentHeading = heading;
  onHeadingUpdate(heading);
};

function onHeadingUpdate(degrees) {
  // Update compass display
  compass.rotation = -degrees * Math.PI / 180;

  // Get cardinal direction
  const direction = getCardinalDirection(degrees);
  console.log(`Heading: ${degrees.toFixed(0)}° (${direction})`);
}

function getCardinalDirection(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}
```

---

## Advanced Patterns

### Recipe 8: Gesture Recognition

**Use Case**: 特定のモーションパターン認識、魔法発動、特殊技

```javascript
// Simple pattern matching with DTW (Dynamic Time Warping) concept
class GestureRecognizer {
  constructor() {
    this.buffer = [];
    this.bufferSize = 60;  // ~1 second at 60Hz
    this.templates = {};
  }

  // Record a gesture template
  recordTemplate(name) {
    return new Promise((resolve) => {
      this.buffer = [];
      this.recording = true;

      setTimeout(() => {
        this.recording = false;
        this.templates[name] = [...this.buffer];
        console.log(`Recorded "${name}" with ${this.buffer.length} samples`);
        resolve();
      }, 1000);
    });
  }

  // Add sensor data
  addSample(acc, gyro) {
    if (this.recording) {
      this.buffer.push({
        accMag: Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2),
        gyroMag: Math.sqrt(gyro.x**2 + gyro.y**2 + gyro.z**2)
      });
    } else {
      this.buffer.push({
        accMag: Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2),
        gyroMag: Math.sqrt(gyro.x**2 + gyro.y**2 + gyro.z**2)
      });

      if (this.buffer.length > this.bufferSize) {
        this.buffer.shift();
      }

      this.checkGestures();
    }
  }

  // Check for matching gestures
  checkGestures() {
    for (const [name, template] of Object.entries(this.templates)) {
      const similarity = this.calculateSimilarity(this.buffer, template);

      if (similarity > 0.8) {  // 80% match threshold
        this.onGestureDetected(name, similarity);
        this.buffer = [];  // Clear buffer after detection
        break;
      }
    }
  }

  // Simple similarity calculation (normalized correlation)
  calculateSimilarity(a, b) {
    if (a.length < b.length * 0.8) return 0;

    // Resample to same length
    const resampled = this.resample(a, b.length);

    // Calculate correlation
    let sumA = 0, sumB = 0, sumAB = 0;
    let sumA2 = 0, sumB2 = 0;

    for (let i = 0; i < b.length; i++) {
      const valA = resampled[i].accMag;
      const valB = b[i].accMag;

      sumA += valA;
      sumB += valB;
      sumAB += valA * valB;
      sumA2 += valA * valA;
      sumB2 += valB * valB;
    }

    const n = b.length;
    const numerator = n * sumAB - sumA * sumB;
    const denominator = Math.sqrt((n * sumA2 - sumA**2) * (n * sumB2 - sumB**2));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  resample(arr, targetLength) {
    const result = [];
    const step = arr.length / targetLength;

    for (let i = 0; i < targetLength; i++) {
      const index = Math.floor(i * step);
      result.push(arr[index]);
    }

    return result;
  }

  onGestureDetected(name, confidence) {
    console.log(`Gesture "${name}" detected! (${(confidence * 100).toFixed(0)}%)`);
  }
}

// Usage
const gestureRecognizer = new GestureRecognizer();

// Record templates
// await gestureRecognizer.recordTemplate('kick');
// await gestureRecognizer.recordTemplate('spin');

// Feed sensor data
let currentGyro = { x: 0, y: 0, z: 0 };
ble.gotGyro = function(gyro) { currentGyro = gyro; };

ble.gotConvertedAcc = function(acc) {
  gestureRecognizer.addSample(acc, currentGyro);
};
```

---

### Recipe 9: Speed/Intensity Calculation

**Use Case**: 運動強度表示、カロリー計算、ゲームスピード調整

```javascript
class IntensityTracker {
  constructor() {
    this.history = [];
    this.windowMs = 3000;  // 3 second window
    this.stepTimes = [];
  }

  addAcceleration(acc, timestamp) {
    const magnitude = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);

    this.history.push({ magnitude, timestamp });

    // Remove old data
    const cutoff = timestamp - this.windowMs;
    this.history = this.history.filter(d => d.timestamp > cutoff);

    return this.calculateIntensity();
  }

  addStep(timestamp) {
    this.stepTimes.push(timestamp);

    const cutoff = timestamp - this.windowMs;
    this.stepTimes = this.stepTimes.filter(t => t > cutoff);
  }

  calculateIntensity() {
    if (this.history.length < 10) return { level: 'rest', value: 0 };

    // Calculate statistics
    const magnitudes = this.history.map(d => d.magnitude);
    const avg = magnitudes.reduce((a, b) => a + b) / magnitudes.length;
    const max = Math.max(...magnitudes);
    const variance = magnitudes.reduce((sum, m) => sum + (m - avg)**2, 0) / magnitudes.length;
    const stdDev = Math.sqrt(variance);

    // Step rate (steps per minute)
    const stepRate = this.stepTimes.length * (60000 / this.windowMs);

    // Combined intensity score (0-100)
    const accScore = Math.min(100, (avg - 1) * 30 + stdDev * 20);
    const stepScore = Math.min(100, stepRate * 0.5);
    const intensity = (accScore * 0.6 + stepScore * 0.4);

    // Classify
    let level;
    if (intensity < 20) level = 'rest';
    else if (intensity < 40) level = 'light';
    else if (intensity < 60) level = 'moderate';
    else if (intensity < 80) level = 'vigorous';
    else level = 'very_vigorous';

    return {
      level,
      value: intensity,
      avgAccel: avg,
      maxAccel: max,
      stdDev,
      stepRate
    };
  }
}

// Usage
const tracker = new IntensityTracker();

ble.gotConvertedAcc = function(acc) {
  const intensity = tracker.addAcceleration(acc, performance.now());
  updateIntensityDisplay(intensity);
};

ble.gotGait = function(gait) {
  tracker.addStep(performance.now());
};
```

---

### Recipe 10: Sensor Fusion

**Use Case**: より安定した姿勢推定、ノイズ除去

```javascript
// Complementary filter for combining accelerometer and gyroscope
class SensorFusion {
  constructor() {
    this.pitch = 0;
    this.roll = 0;
    this.alpha = 0.98;  // Gyro weight (0.95-0.99)
    this.lastTimestamp = null;
  }

  update(acc, gyro, timestamp) {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return { pitch: 0, roll: 0 };
    }

    const dt = (timestamp - this.lastTimestamp) / 1000;  // seconds
    this.lastTimestamp = timestamp;

    // Accelerometer angles (noisy but absolute)
    const accPitch = Math.atan2(acc.x, Math.sqrt(acc.y**2 + acc.z**2));
    const accRoll = Math.atan2(acc.y, Math.sqrt(acc.x**2 + acc.z**2));

    // Integrate gyroscope (smooth but drifts)
    this.pitch += gyro.y * dt;
    this.roll += gyro.x * dt;

    // Complementary filter
    this.pitch = this.alpha * this.pitch + (1 - this.alpha) * accPitch;
    this.roll = this.alpha * this.roll + (1 - this.alpha) * accRoll;

    return {
      pitch: this.pitch,
      roll: this.roll
    };
  }
}

// Usage
const fusion = new SensorFusion();
let currentGyro = { x: 0, y: 0, z: 0 };

ble.gotGyro = function(gyro) {
  currentGyro = gyro;
};

ble.gotConvertedAcc = function(acc) {
  const orientation = fusion.update(acc, currentGyro, performance.now());

  // More stable than raw euler angles
  updateDisplay(orientation.pitch, orientation.roll);
};
```

---

## Utility Functions

### Moving Average Filter

```javascript
class MovingAverage {
  constructor(size = 5) {
    this.size = size;
    this.buffer = [];
  }

  add(value) {
    this.buffer.push(value);
    if (this.buffer.length > this.size) {
      this.buffer.shift();
    }
    return this.get();
  }

  get() {
    if (this.buffer.length === 0) return 0;
    return this.buffer.reduce((a, b) => a + b) / this.buffer.length;
  }

  clear() {
    this.buffer = [];
  }
}

// Usage
const accFilter = {
  x: new MovingAverage(5),
  y: new MovingAverage(5),
  z: new MovingAverage(5)
};

ble.gotConvertedAcc = function(acc) {
  const filtered = {
    x: accFilter.x.add(acc.x),
    y: accFilter.y.add(acc.y),
    z: accFilter.z.add(acc.z)
  };

  processAcc(filtered);
};
```

### Low-Pass Filter

```javascript
class LowPassFilter {
  constructor(alpha = 0.2) {
    this.alpha = alpha;  // 0-1, lower = smoother
    this.value = null;
  }

  filter(newValue) {
    if (this.value === null) {
      this.value = newValue;
    } else {
      this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    }
    return this.value;
  }

  reset() {
    this.value = null;
  }
}

// Usage
const filter = new LowPassFilter(0.1);

ble.gotEuler = function(euler) {
  const smoothedYaw = filter.filter(euler.yaw);
  updateHeading(smoothedYaw);
};
```

### Debounce for Events

```javascript
function createDebouncer(delayMs) {
  let lastTime = 0;

  return function(callback) {
    const now = Date.now();
    if (now - lastTime >= delayMs) {
      lastTime = now;
      callback();
      return true;
    }
    return false;
  };
}

// Usage
const debounceStep = createDebouncer(200);

ble.gotGait = function(gait) {
  debounceStep(() => {
    handleStep(gait.direction);
  });
};
```

---

## Debugging Techniques

### Real-time Sensor Monitor

```javascript
class SensorMonitor {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.createUI();
  }

  createUI() {
    this.container.innerHTML = `
      <div style="font-family: monospace; background: #1a1a2e; color: #0f0; padding: 10px; border-radius: 5px;">
        <div>Acc: <span id="mon-acc">--</span></div>
        <div>Gyro: <span id="mon-gyro">--</span></div>
        <div>Euler: <span id="mon-euler">--</span></div>
        <div>Gait: <span id="mon-gait">--</span></div>
        <div>FPS: <span id="mon-fps">--</span></div>
      </div>
    `;

    this.accEl = document.getElementById('mon-acc');
    this.gyroEl = document.getElementById('mon-gyro');
    this.eulerEl = document.getElementById('mon-euler');
    this.gaitEl = document.getElementById('mon-gait');
    this.fpsEl = document.getElementById('mon-fps');

    this.frameCount = 0;
    this.lastFpsTime = performance.now();

    setInterval(() => this.updateFps(), 1000);
  }

  updateAcc(acc) {
    this.frameCount++;
    this.accEl.textContent =
      `X:${acc.x.toFixed(2)} Y:${acc.y.toFixed(2)} Z:${acc.z.toFixed(2)} ` +
      `|${Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2).toFixed(2)}G|`;
  }

  updateGyro(gyro) {
    this.gyroEl.textContent =
      `X:${gyro.x.toFixed(2)} Y:${gyro.y.toFixed(2)} Z:${gyro.z.toFixed(2)}`;
  }

  updateEuler(euler) {
    const toDeg = (r) => (r * 180 / Math.PI).toFixed(1);
    this.eulerEl.textContent =
      `P:${toDeg(euler.pitch)}° R:${toDeg(euler.roll)}° Y:${toDeg(euler.yaw)}°`;
  }

  updateGait(gait) {
    const dirs = ['L', '?', 'F', '?', 'B', '?', 'R'];
    this.gaitEl.textContent =
      `Dir:${dirs[gait.direction]} Steps:${gait.steps} Dist:${gait.distance.toFixed(1)}m`;
  }

  updateFps() {
    const now = performance.now();
    const fps = this.frameCount / ((now - this.lastFpsTime) / 1000);
    this.fpsEl.textContent = fps.toFixed(1) + ' Hz';
    this.frameCount = 0;
    this.lastFpsTime = now;
  }
}

// Usage
const monitor = new SensorMonitor('debug-panel');

ble.gotConvertedAcc = function(acc) { monitor.updateAcc(acc); };
ble.gotGyro = function(gyro) { monitor.updateGyro(gyro); };
ble.gotEuler = function(euler) { monitor.updateEuler(euler); };
ble.gotGait = function(gait) { monitor.updateGait(gait); };
```

### Data Logger for Analysis

```javascript
class DataLogger {
  constructor() {
    this.log = [];
    this.isRecording = false;
    this.startTime = 0;
  }

  start() {
    this.log = [];
    this.isRecording = true;
    this.startTime = performance.now();
    console.log('Recording started...');
  }

  stop() {
    this.isRecording = false;
    console.log(`Recording stopped. ${this.log.length} samples.`);
    return this.log;
  }

  add(type, data) {
    if (!this.isRecording) return;

    this.log.push({
      time: performance.now() - this.startTime,
      type,
      ...data
    });
  }

  download(filename = 'sensor_log.json') {
    const blob = new Blob([JSON.stringify(this.log, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Usage
const logger = new DataLogger();

// Start/stop with button
document.getElementById('recordBtn').onclick = () => {
  if (logger.isRecording) {
    logger.stop();
    logger.download();
  } else {
    logger.start();
  }
};

ble.gotConvertedAcc = function(acc) {
  logger.add('acc', acc);
  // ... normal processing
};

ble.gotGait = function(gait) {
  logger.add('gait', gait);
  // ... normal processing
};
```

---

## Performance Tips

1. **Use gotConvertedAcc for game logic** - Already scaled to G values
2. **Buffer wisely** - 20 frames is usually enough for gesture detection
3. **Debounce events** - Prevent multiple triggers from single actions
4. **Use STEP_ANALYSIS for event-based apps** - Lower overhead than raw sensors
5. **Filter sparingly** - Over-filtering adds latency
6. **Profile your callbacks** - Keep processing under 10ms

---

## Quick Reference Card

```
=== Acceleration ===
gotAcc:          Normalized (-1 to 1)
gotConvertedAcc: Actual G values (use this for games)
Magnitude:       sqrt(x² + y² + z²)
Rest value:      ~1G (gravity)
Kick threshold:  2-5G typical

=== Direction (gait.direction) ===
0: Left
2: Forward
4: Backward
6: Right

=== Euler Angles (radians) ===
pitch: Forward/backward tilt
roll:  Left/right tilt
yaw:   Horizontal rotation

=== Step Analysis ===
gait.type: 0=none, 1=walk, 2=run
gait.steps: Total step count
gait.distance: Total distance (meters)

=== Common Thresholds ===
Kick:     2.0-5.0 G
Jump:     2.0-3.0 G
Walk:     type=1, steps increasing
Run:      type=2, higher step rate
Deadzone: 0.1-0.2 radians for tilt
```
