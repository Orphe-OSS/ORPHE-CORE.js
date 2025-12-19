# ORPHE CORE Gesture Detection Logic

Last Updated: 2025-11-30 (v3 - Euler-based)
Data Source: `docs/ai/sensor_samples/orphe_sensor_raw_1764471685147.json`

## Overview

This document provides gesture detection thresholds and logic derived from recorded sensor data using the SENSOR-CALIBRATION tool.

**v3では、Gyroベースの判定からEuler角（Pitch）ベースの判定に変更しました。**
これにより、インパクト時の足の傾きで直感的かつ正確にジェスチャーを判別できます。

## IMPORTANT: Example App Setup Notes (for AI)

When creating new example apps for ORPHE CORE:

1. **Script paths must be correct:**
   ```html
   <script src="../../js/ORPHE-CORE.js"></script>
   <script src="../../js/CoreToolkit.js"></script>
   ```
   NOT `../../Orphe-js-sdk/dist/Orphe.js` or `../../CoreToolkit.js`

2. **CoreToolkit initialization:**
   ```javascript
   bles[0].setup();
   buildCoreToolkit(
     document.getElementById('toolkit_placeholder'),
     'ORPHE CORE',
     0,
     'STEP_ANALYSIS_AND_SENSOR_VALUES',
     { range: { acc: 16, gyro: 2000 } }
   );
   ```

3. **Required HTML element:**
   ```html
   <div id="toolkit_placeholder"></div>
   ```
   This div will contain the connection button UI.

4. **Required callbacks for Euler-based detection:**
   ```javascript
   ble.gotEuler = function(euler) {
     // euler.pitch is in radians
     detector.updateEuler(euler);
   };
   ```

5. **Reference working examples:**
   - `examples/SENSOR-CALIBRATION/index.html`
   - `examples/CORETOOLKIT-STARTER/index.html`
   - `examples/GESTURE-DEMO/index.html`

## Device Configuration

| Setting | Value |
|---------|-------|
| Core Version | CORE 3.0 |
| Mount Position | Right Instep (右足背部) |
| Notification Type | STEP_ANALYSIS_AND_SENSOR_VALUES |
| Accelerometer Range | ±16G |
| Gyroscope Range | ±2000°/s |

## Gesture Data Summary (v3)

### Euler Pitch at Impact - Key Discriminator

| Gesture | Recordings | Pitch at Impact (degrees) | Description |
|---------|------------|---------------------------|-------------|
| **toe_tap** | 10 | +1.6° 〜 +23.7° (avg +12°) | つま先が下向き（正のPitch） |
| **heel_tap** | 10 | -18.4° 〜 -1.9° (avg -13°) | 踵が下向き（負のPitch） |
| **stomp** | 10 | -0.9° 〜 +4.1° (avg +0.5°) | ほぼ水平（Pitch ≈ 0） |
| **idle** | 4 | N/A | 加速度が低い（< 1.5G） |

### Why Euler (Pitch) Works Better Than Gyro

v2ではGyroMagとX/Mag比率で判定していましたが、3つのジェスチャーで値が重なっていました。

**Euler Pitchの利点:**
- **直感的**: 足の傾きそのものを測定
- **重複なし**: toe_tap、heel_tap、stompで明確に分離
- **安定**: インパクトの瞬間の姿勢を使用

```
toe_tap:  足を上げた状態からつま先を下ろす → Pitch > 0
heel_tap: 足を上げた状態から踵を下ろす → Pitch < 0
stomp:    足をフラットに踏み下ろす → Pitch ≈ 0
```

## Detection Thresholds (v3)

```javascript
const THRESHOLDS = {
  // Minimum acceleration to trigger gesture detection
  ACC_TRIGGER: 2.0,  // G

  // idle detection
  IDLE_ACC_MAX: 1.5,   // G
  IDLE_GYRO_MAX: 5.0,  // °/s

  // Euler-based detection (Pitch angle at impact)
  // toe_tap: つま先が下向き → 正のPitch
  TOE_TAP_PITCH_MIN: 5.0,  // degrees - above this = toe_tap

  // heel_tap: 踵が下向き → 負のPitch
  HEEL_TAP_PITCH_MAX: -1.5,  // degrees - below this = heel_tap

  // stomp: ほぼ水平 → Pitchが0付近
  // Between HEEL_TAP_PITCH_MAX and TOE_TAP_PITCH_MIN = stomp
};
```

## Recommended Detection Logic (v3)

### GestureDetector Class with Euler

```javascript
class GestureDetector {
  constructor() {
    this.cooldown = 0;
    this.cooldownFrames = 100;  // ~500ms cooldown

    // Peak detection state
    this.peakDetected = false;
    this.peakAcc = 0;
    this.peakPitch = 0;  // Euler pitch at peak moment (degrees)
    this.framesSincePeak = 0;
    this.peakHoldFrames = 10;  // ~50ms after peak

    // Current Euler state
    this.currentPitch = 0;  // degrees
  }

  // Update Euler pitch (call from gotEuler callback)
  updateEuler(euler) {
    // Convert radians to degrees
    this.currentPitch = euler.pitch * 180 / Math.PI;
  }

  update(acc, gyro) {
    const accMag = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);

    // Cooldown management
    if (this.cooldown > 0) {
      this.cooldown--;
      this.peakDetected = false;
      this.peakAcc = 0;
      return null;
    }

    // Peak detection
    if (accMag > THRESHOLDS.ACC_TRIGGER) {
      if (accMag > this.peakAcc) {
        // New peak - capture pitch at this moment
        this.peakAcc = accMag;
        this.peakPitch = this.currentPitch;
        this.peakDetected = true;
        this.framesSincePeak = 0;
      } else if (this.peakDetected) {
        this.framesSincePeak++;
      }
    } else if (this.peakDetected) {
      this.framesSincePeak++;
    }

    // Trigger detection after peak
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
    if (accMag < THRESHOLDS.ACC_TRIGGER) {
      return null;
    }

    // Euler-based detection using Pitch at impact
    if (pitch > THRESHOLDS.TOE_TAP_PITCH_MIN) {
      return 'toe_tap';  // つま先が下向き
    }

    if (pitch < THRESHOLDS.HEEL_TAP_PITCH_MAX) {
      return 'heel_tap';  // 踵が下向き
    }

    return 'stomp';  // ほぼ水平
  }
}
```

### Usage Example with ORPHE CORE

```javascript
const detector = new GestureDetector();

// Euler callback - REQUIRED for pitch-based detection
bles[0].gotEuler = function(euler) {
  detector.updateEuler(euler);
};

bles[0].gotAcc = function(acc) {
  currentAcc = acc;
};

bles[0].gotGyro = function(gyro) {
  if (!currentAcc) return;

  const gesture = detector.update(currentAcc, gyro);
  if (gesture) {
    console.log('Detected:', gesture);
    handleGesture(gesture);
  }
};
```

## Peak Detection + Cooldown

**重要: ピーク検出方式について**

足のジェスチャーは1回の動作で1回だけ検出されるべきです。

**解決策: ピーク検出 + クールダウン**

1. **ピーク検出**: 加速度が上昇→下降するパターンを検出し、ピーク時のPitch角度で判定
2. **クールダウン**: 検出後500ms（100フレーム@200Hz）は次の検出を抑制

**パラメータ調整ガイド:**

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `cooldownFrames` | 100 | 検出後の無視期間（@200Hz = 500ms）|
| `peakHoldFrames` | 10 | ピーク検出後、判定までの待機フレーム |
| `ACC_TRIGGER` | 2.0G | ジェスチャー検出の加速度閾値 |

## Detection Accuracy (v3)

| Gesture | Confidence | Notes |
|---------|------------|-------|
| idle | ★★★★★ | Very distinct (low acceleration) |
| toe_tap | ★★★★★ | Clear positive pitch |
| heel_tap | ★★★★★ | Clear negative pitch |
| stomp | ★★★★☆ | Near-zero pitch, some overlap with toe_tap edge cases |

## Raw Data Statistics

### toe_tap (10 recordings)
- Acc Magnitude: max=2.2-11.4G
- Pitch at Impact: +1.6° 〜 +23.7° (avg +12°)

### heel_tap (10 recordings)
- Acc Magnitude: max=1.6-7.8G
- Pitch at Impact: -18.4° 〜 -1.9° (avg -13°)

### stomp (10 recordings)
- Acc Magnitude: max=1.4-11.9G
- Pitch at Impact: -0.9° 〜 +4.1° (avg +0.5°)

### idle (4 recordings)
- Acc Magnitude: max=1.02G
- Gyro: max=0.9-1.0°/s

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-30 | v1 | Initial analysis with GyroX-based detection |
| 2025-11-30 | v2 | Changed to GyroMag + X/Mag ratio detection |
| 2025-11-30 | v3 | **Changed to Euler Pitch-based detection** - much more accurate |

## Key Learnings

1. **Gyroだけでは不十分**: GyroXやGyroMagだけでは3つのジェスチャーの値が重なる
2. **Euler Pitchが最適**: インパクト時の足の傾き（Pitch）で明確に区別できる
3. **gotEulerコールバック必須**: Pitch-based検出には`gotEuler`コールバックが必要
4. **ピーク検出が重要**: 単純な閾値方式だと1回の動作で複数回検出される
