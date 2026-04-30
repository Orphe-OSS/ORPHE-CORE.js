# ORPHE CORE.js - AI Development Guide

ORPHE COREは足装着型IoTセンサーモジュールです。このガイドは生成AIがORPHE COREを使ったアプリケーションを正確に生成するための包括的なリファレンスです。

## Project Overview

```
ORPHE-CORE.js/
├── js/                         # Core libraries (REQUIRED)
│   ├── ORPHE-CORE.js          # Main SDK (v1.3.4, 1606 lines)
│   ├── CoreToolkit.js         # Connection UI toolkit
│   ├── quaternion.js          # Quaternion math (auto-loaded)
│   └── float16.min.js         # Float16 support (auto-loaded)
├── examples/                   # Sample applications (30+)
│   ├── GAME-DDR/              # Rhythm game - uses gait.direction
│   ├── GAME-PK/               # Action game - uses acc/gyro
│   ├── GAME-HURDLE*/          # Running games - uses gait/steps
│   ├── VISUALIZE/             # Sensor visualization
│   ├── CORETOOLKIT-STARTER/   # Recommended starting template
│   └── ...
├── starter-templates/          # Minimal code examples
├── api_doc/                    # Auto-generated JSDoc
└── docs/ai/                    # AI-specific guides
    └── SENSOR_RECIPES.md      # Data processing patterns
```

## Quick Start - 最速で動くコードを書く

### Pattern A: 最小構成（テスト用）

```html
<!DOCTYPE html>
<html>
<head>
  <script src="js/ORPHE-CORE.js"></script>
</head>
<body>
  <button onclick="ble.begin('SENSOR_VALUES')">Connect</button>
  <div id="output"></div>

  <script>
    var ble = new Orphe(0);
    ble.setup();

    ble.gotAcc = function(acc) {
      document.getElementById('output').textContent =
        `X: ${acc.x.toFixed(2)}, Y: ${acc.y.toFixed(2)}, Z: ${acc.z.toFixed(2)}`;
    };
  </script>
</body>
</html>
```

### Pattern B: CoreToolkit使用（推奨）

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css">
  <script src="../../js/ORPHE-CORE.js"></script>
  <script src="../../js/CoreToolkit.js"></script>
</head>
<body>
  <div id="toolkit_placeholder"></div>
  <canvas id="gameCanvas"></canvas>

  <script>
    // CoreToolkit generates bles[0] and bles[1] globally
    buildCoreToolkit(
      document.getElementById('toolkit_placeholder'),
      'ORPHE Device',
      0,  // device ID (0 or 1)
      'STEP_ANALYSIS_AND_SENSOR_VALUES'  // notification type
    );

    // Setup callbacks after CoreToolkit initializes
    window.onload = function() {
      bles[0].setup();

      bles[0].gotGait = function(gait) {
        console.log('Direction:', gait.direction);
      };

      bles[0].gotAcc = function(acc) {
        console.log('Acceleration:', acc);
      };
    };
  </script>
</body>
</html>
```

## Notification Types - 接続タイプの選択

**これが最も重要な設計判断です。アプリの特性に応じて適切なタイプを選択してください。**

| Type | Use Case | Data Available | Frequency |
|------|----------|----------------|-----------|
| `STEP_ANALYSIS` | リズムゲーム、歩数計、方向検知 | gait, stride, pronation | ~30Hz |
| `SENSOR_VALUES` | アクションゲーム、姿勢制御、可視化 | acc, gyro, quat, euler | 50-200Hz |
| `STEP_ANALYSIS_AND_SENSOR_VALUES` | 複合アプリ | All data | Both |

### Selection Guide

```
What does your app need?

├── Step counting / Direction detection only
│   └── Use: STEP_ANALYSIS
│       Examples: GAME-DDR, pedometer apps
│
├── Raw sensor data (acceleration, rotation)
│   └── Use: SENSOR_VALUES
│       Examples: GAME-PK kick detection, tilt controls
│
└── Both step analysis AND raw sensor
    └── Use: STEP_ANALYSIS_AND_SENSOR_VALUES
        Examples: Complex games, research apps
```

## API Reference - 主要なAPI

### Orphe Class

```javascript
// Constructor
var ble = new Orphe(id);  // id: 0 or 1 (supports 2 devices max)

// Initialization (MUST call before begin)
ble.setup(names, options);
// names: ['DEVICE_INFORMATION', 'DATE_TIME', 'SENSOR_VALUES', 'STEP_ANALYSIS']
// options: { interpolation: { enabled: false, max_consecutive_missing: 1 } }

// Start connection and data streaming
await ble.begin(notification_type, options);
// notification_type: 'STEP_ANALYSIS' | 'SENSOR_VALUES' | 'STEP_ANALYSIS_AND_SENSOR_VALUES'
// options: { range: { acc: 16, gyro: 2000 } }
//   acc: 2, 4, 8, 16 (G)
//   gyro: 250, 500, 1000, 2000 (deg/s)

// Stop connection
ble.stop();
ble.reset();

// Device control
ble.setLED(on_off, pattern);  // on_off: 0|1, pattern: 0-4
ble.setMountPosition(position);  // 0: left-instep, 1: right-instep, 2: left-plantar, 3: right-plantar
ble.resetMotionSensorAttitude();
ble.resetAnalysisLogs();

// Device info
await ble.getDeviceInformation();
// Returns: { battery, lr, rec_mode, rec_auto_run, led_brightness, range: { acc, gyro } }
```

### Data Callbacks - Override these to receive data

```javascript
// === SENSOR_VALUES callbacks (high frequency: 50-200Hz) ===

ble.gotAcc = function(acc) {
  // acc: { x, y, z } - normalized (-1 to 1), multiply by range for G
  // For actual G values, use gotConvertedAcc instead
};

ble.gotConvertedAcc = function(acc) {
  // acc: { x, y, z } - actual values in G (e.g., -16 to 16 when range=16)
};

ble.gotGyro = function(gyro) {
  // gyro: { x, y, z } - normalized (-1 to 1)
};

ble.gotConvertedGyro = function(gyro) {
  // gyro: { x, y, z } - actual values in deg/s
};

ble.gotQuat = function(quat) {
  // quat: { w, x, y, z } - quaternion for 3D orientation
};

ble.gotEuler = function(euler) {
  // euler: { pitch, roll, yaw } - Euler angles in radians
  // pitch: forward/backward tilt
  // roll: left/right tilt
  // yaw: horizontal rotation
};

// === STEP_ANALYSIS callbacks (lower frequency: ~30Hz, event-driven) ===

ble.gotGait = function(gait) {
  // gait: {
  //   type: 0-2,        // 0: none, 1: walk, 2: run
  //   direction: 0-6,   // 0: left, 2: forward, 4: backward, 6: right
  //   calorie: float,
  //   distance: float,  // meters
  //   steps: int,
  //   standing_phase_duration: float,  // seconds
  //   swing_phase_duration: float      // seconds
  // }
};

ble.gotStride = function(stride) {
  // stride: { x, y, z, steps_number } - stride vector in meters
};

ble.gotPronation = function(pronation) {
  // pronation: { x, y, z } - foot rotation angles
};

ble.gotLandingImpact = function(impact) {
  // impact: { value } - landing impact force
};

ble.gotFootAngle = function(foot_angle) {
  // foot_angle: { value } - foot angle at landing in degrees
};

ble.gotStepsNumber = function(steps) {
  // steps: { value } - total step count
};

// === Connection event callbacks ===

ble.onConnect = function(uuid) { };
ble.onDisconnect = function() { };
ble.onError = function(error) { };
ble.gotBLEFrequency = function(frequency) { };  // Actual BLE data rate in Hz
```

### CoreToolkit.js

```javascript
// Build connection UI with toggle switch, battery, LED controls
buildCoreToolkit(
  parent_element,   // DOM element to append UI
  title,            // Display title (e.g., 'Player 1')
  core_id,          // 0 or 1
  notification,     // 'STEP_ANALYSIS' | 'SENSOR_VALUES' | 'STEP_ANALYSIS_AND_SENSOR_VALUES'
  options           // { range: { acc: 16, gyro: 2000 } }
);

// Global variables created by CoreToolkit:
// var bles = [new Orphe(0), new Orphe(1)];
// var cores = bles;  // Alias (recommended)
```

## Data Structures

### gait.direction Mapping

```javascript
// ORPHE direction values → Game directions
const DIRECTION_MAP = {
  0: 'left',     // 左
  2: 'forward',  // 前
  4: 'backward', // 後
  6: 'right'     // 右
};

// For DDR-style games:
const LANE_MAP = {
  0: 0,  // Left step → Lane 0 (←)
  2: 2,  // Forward  → Lane 2 (↑)
  4: 1,  // Backward → Lane 1 (↓)
  6: 3   // Right    → Lane 3 (→)
};
```

### Sensor Ranges

```javascript
// Accelerometer range settings
const ACC_RANGE = {
  0: 2,   // ±2G (high precision, low range)
  1: 4,   // ±4G
  2: 8,   // ±8G
  3: 16   // ±16G (low precision, high range - recommended for games)
};

// Gyroscope range settings
const GYRO_RANGE = {
  0: 250,   // ±250 deg/s
  1: 500,   // ±500 deg/s
  2: 1000,  // ±1000 deg/s
  3: 2000   // ±2000 deg/s (recommended for fast movements)
};
```

### Device Information

```javascript
// ble.device_information structure
{
  battery: 0-2,        // 0: low, 1: medium, 2: full
  lr: 0-3,             // 0: left-instep, 1: right-instep, 2: left-plantar, 3: right-plantar
  rec_mode: 0-2,       // 0: not recording, 1: recording, 2: paused
  rec_auto_run: 0-1,   // Auto-run recording on/off
  led_brightness: 0-255,
  range: {
    acc: 0-3,          // See ACC_RANGE above
    gyro: 0-3          // See GYRO_RANGE above
  }
}
```

## Common Patterns

### Pattern 1: Duplicate Input Prevention (CRITICAL)

ゲームでは必ず重複入力を防止してください：

```javascript
let lastDirection = -1;
let lastInputTime = 0;
const DEBOUNCE_MS = 200;

ble.gotGait = function(gait) {
  const now = Date.now();

  // Skip if same direction
  if (gait.direction === lastDirection) return;

  // Skip if too soon after last input
  if (now - lastInputTime < DEBOUNCE_MS) return;

  lastDirection = gait.direction;
  lastInputTime = now;

  handleInput(gait.direction);
};
```

### Pattern 2: Kick/Impact Detection

```javascript
const KICK_THRESHOLD = 3.0;  // G
let sensorBuffer = [];
const BUFFER_SIZE = 20;

ble.gotConvertedAcc = function(acc) {
  const magnitude = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);

  sensorBuffer.push({ acc, magnitude, timestamp: performance.now() });
  if (sensorBuffer.length > BUFFER_SIZE) sensorBuffer.shift();

  if (magnitude > KICK_THRESHOLD) {
    const power = calculatePower(sensorBuffer);
    const direction = calculateDirection(sensorBuffer);
    onKickDetected(power, direction);
  }
};

function calculatePower(buffer) {
  const magnitudes = buffer.map(d => d.magnitude);
  const maxAccel = Math.max(...magnitudes);
  const avgAccel = magnitudes.reduce((a, b) => a + b) / magnitudes.length;
  return Math.min(1.0, (maxAccel * 0.7 + avgAccel * 0.3) / 8.0);
}
```

### Pattern 3: Tilt Control

```javascript
ble.gotEuler = function(euler) {
  // euler values are in radians
  const tiltX = euler.roll * sensitivity;   // Left/right tilt
  const tiltY = euler.pitch * sensitivity;  // Forward/backward tilt

  updatePlayerPosition(tiltX, tiltY);
};
```

### Pattern 4: Jump Detection

```javascript
let lastAccZ = 0;
const JUMP_THRESHOLD = 2.0;  // G

ble.gotConvertedAcc = function(acc) {
  // Detect rapid upward acceleration
  if (acc.z > JUMP_THRESHOLD && lastAccZ < acc.z * 0.5) {
    onJumpDetected();
  }
  lastAccZ = acc.z;
};

// Alternative: Use landing impact from STEP_ANALYSIS
ble.gotLandingImpact = function(impact) {
  if (impact.value > 1.5) {
    onJumpLanded();
  }
};
```

### Pattern 5: Dual Device (2-Player)

```javascript
// Setup for both devices
for (let i = 0; i < 2; i++) {
  buildCoreToolkit(
    document.getElementById(`toolkit${i}`),
    `Player ${i + 1}`,
    i,
    'STEP_ANALYSIS'
  );
}

window.onload = function() {
  for (let i = 0; i < 2; i++) {
    bles[i].setup();

    bles[i].gotGait = function(gait) {
      // this.id gives the device ID (0 or 1)
      players[this.id].handleInput(gait.direction);
    };
  }
};
```

## File Structure for New Examples

新しいexampleを作成する際は以下の構造に従ってください：

```
examples/YOUR-APP-NAME/
├── index.html          # Main HTML with CoreToolkit
├── main.js             # Game initialization and ORPHE callbacks
├── game.js             # Game logic (separate from sensor handling)
├── style.css           # Styles
├── assets/             # Images, sounds, etc.
└── README.md           # Documentation (optional)
```

### Required HTML Structure

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your App Name</title>

  <!-- Bootstrap (for CoreToolkit UI) -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css">

  <!-- ORPHE Libraries (REQUIRED ORDER) -->
  <script src="../../js/ORPHE-CORE.js"></script>
  <script src="../../js/CoreToolkit.js"></script>

  <!-- Bootstrap JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/js/bootstrap.min.js"></script>
</head>
<body>
  <!-- Connection UI -->
  <div id="toolkit_placeholder"></div>

  <!-- Your game content -->
  <canvas id="gameCanvas"></canvas>

  <script>
    // Initialize CoreToolkit
    buildCoreToolkit(
      document.getElementById('toolkit_placeholder'),
      'ORPHE CORE',
      0,
      'STEP_ANALYSIS_AND_SENSOR_VALUES'  // Choose appropriate type
    );
  </script>

  <!-- Your app scripts -->
  <script src="main.js"></script>
  <script src="game.js"></script>
</body>
</html>
```

## Common Mistakes to Avoid

### 1. Forgetting to call setup()

```javascript
// WRONG
var ble = new Orphe(0);
ble.begin('SENSOR_VALUES');  // Will fail!

// CORRECT
var ble = new Orphe(0);
ble.setup();  // MUST call first
ble.begin('SENSOR_VALUES');
```

### 2. Using arrow functions for callbacks

```javascript
// WRONG - 'this' will be undefined
ble.gotGait = (gait) => {
  console.log(this.id);  // undefined!
};

// CORRECT - use regular function to access this.id
ble.gotGait = function(gait) {
  console.log(this.id);  // 0 or 1
};
```

### 3. Not handling duplicate inputs

```javascript
// WRONG - will trigger multiple times for single step
ble.gotGait = function(gait) {
  handleInput(gait.direction);
};

// CORRECT - track last direction
let lastDir = -1;
ble.gotGait = function(gait) {
  if (gait.direction === lastDir) return;
  lastDir = gait.direction;
  handleInput(gait.direction);
};
```

### 4. Wrong sensor range for use case

```javascript
// WRONG for high-impact games
ble.begin('SENSOR_VALUES', { range: { acc: 2, gyro: 250 } });
// Will clip/saturate on fast movements!

// CORRECT for action games
ble.begin('SENSOR_VALUES', { range: { acc: 16, gyro: 2000 } });
```

### 5. Using raw acc values instead of converted

```javascript
// WRONG - values are normalized (-1 to 1)
ble.gotAcc = function(acc) {
  if (acc.x > 5) { /* This will never trigger! */ }
};

// CORRECT - use gotConvertedAcc for actual G values
ble.gotConvertedAcc = function(acc) {
  if (acc.x > 5) { /* Now works correctly */ }
};
```

## Browser Compatibility

- **Required**: Web Bluetooth API
- **Supported**: Chrome (desktop/Android), Edge, Opera
- **NOT Supported**: Firefox, Safari (iOS/macOS)

## Reference Examples

| App Type | Reference | Key Patterns |
|----------|-----------|--------------|
| Rhythm game | GAME-DDR | Direction detection, timing judgment |
| Action game | GAME-PK | Kick detection, gyro direction |
| Running game | GAME-HURDLE | Step counting, speed calculation |
| 2-Player | GAME-HURDLE-VS | Dual device handling |
| Visualization | VISUALIZE | Real-time graphing |

## Additional Resources

- [ORPHE-CORE.js API Documentation](https://orphe-oss.github.io/ORPHE-CORE.js/api_doc/)
- [ORPHE Official Site](https://orphe.io/)
- [Sensor Processing Recipes](docs/ai/SENSOR_RECIPES.md)
- [TypeScript SDK (sister project)](../ORPHE-CORE-ts/)

## Version History

- **v1.3.4** (2026/01/31): Current version
- **v1.3**: DateTime characteristic support, time sync
- **v1.2**: ES6 class-based refactoring
- **v1.1**: Bug fixes, gotData() extension
- **v1.0** (2021/05/01): Initial release
