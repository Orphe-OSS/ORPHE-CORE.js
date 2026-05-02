# Sensor Viewer

`VIEW` is a browser-based table viewer for ORPHE CORE sensor and gait values.
It is useful when you want to inspect values directly rather than plot them.

## What this example shows

- Connect up to two ORPHE CORE modules.
- Switch each device between `STEP_ANALYSIS` and `SENSOR_VALUES`.
- Inspect quaternion, gyro, accelerometer, gait, stride, foot angle, pronation,
  and landing impact values.
- Reset motion sensor attitude after connection.

## Required devices

- 1 ORPHE CORE is enough to test one side of the viewer.
- 2 ORPHE CORE modules can be connected for left/right comparison.

## How to run

Open the demo from a local server or GitHub Pages:

```text
examples/VIEW/
```

Use a Web Bluetooth compatible browser such as Chrome. Select the notify type
for each device, then use the switch beside the selector to connect.

## Data

- Notify types: `STEP_ANALYSIS` or `SENSOR_VALUES`
- Main callbacks: quaternion, gyro, accelerometer, gait, stride, foot angle,
  pronation, landing impact

## Known validation items

- Confirm whether either side can be connected first, or whether device 01 must
  be connected before device 02.
- Confirm disconnect/reconnect behavior after several minutes of notification.
- Confirm the 3D shoe orientation matches left/right expectations.

## Validation status

Static page/link checks only. BLE connection and reconnect behavior still need
real-device validation.
