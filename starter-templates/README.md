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

