# Starter Templates

The files in this directory are intentionally small raw API examples.
They show the direct ORPHE-CORE.js flow without CoreToolkit:

```js
const ble = new Orphe(0);
ble.setup();
await ble.begin("SENSOR_VALUES");
```

Use these templates when you want to learn one data stream or one notification
mode at a time.

## Templates

| File | Notify type | Purpose |
| --- | --- | --- |
| `LIGHT.html` | `STEP_ANALYSIS` | Connect and control the LED. |
| `P5_QUICK_START.html` | `STEP_ANALYSIS` | Single-file p5.js starter for the p5.js Web Editor. |
| `P5_CORETOOLKIT_STEP_ANALYSIS.html` | `STEP_ANALYSIS` | Single-file CoreToolkit + p5.js example that displays gait analysis values. |
| `P5_CORETOOLKIT_MOTION_PINGPONG.html` | `STEP_ANALYSIS_AND_SENSOR_VALUES` | Single-file motion game starter with CoreToolkit and Chart.js raw data graphs. |
| `P5_CORE_SENSOR_DEBUG.html` | `STEP_ANALYSIS_AND_SENSOR_VALUES` | Single-file diagnostic page for raw bytes, quaternion norm, Euler angle, acc, and gyro. |
| `ACCELEROMETER.html` | `SENSOR_VALUES` | Read accelerometer values. |
| `GYRO.html` | `SENSOR_VALUES` | Read gyro values. |
| `QUATERNION.html` | `SENSOR_VALUES` | Read orientation as quaternion. |
| `EULER.html` | `SENSOR_VALUES` | Read orientation as pitch, roll, yaw. |
| `STEPS.html` | `STEP_ANALYSIS` | Read step count. |
| `STRIDE.html` | `STEP_ANALYSIS` | Read stride values. |
| `PRONATION.html` | `STEP_ANALYSIS` | Read pronation values. |
| `ANALYSIS_AND_RAW.html` | `STEP_ANALYSIS_AND_SENSOR_VALUES` | Receive gait analysis and sensor values together. |

## CoreToolkit policy

Do not convert these files to CoreToolkit by default. Their role is to teach the
minimal API. Use `examples/CORETOOLKIT-STARTER/` when you want a connection UI
and sensor monitor.
