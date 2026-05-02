# Sensor Visualize (Chart.js)

`VISUALIZE` plots ORPHE CORE `SENSOR_VALUES` in the browser with Chart.js.
It is useful when you want to quickly see accelerometer, gyro, quaternion, and
Euler values as time-series charts.

## What this example shows

- Connect ORPHE CORE modules from the browser.
- Receive `SENSOR_VALUES`.
- Plot accelerometer, gyro, quaternion, and Euler streams.
- Compare device 01 and device 02 side by side.

## Required devices

- 1 ORPHE CORE is enough to test the left-side charts.
- 2 ORPHE CORE modules can be connected to compare both sides.

## How to run

Open the demo from a local server or GitHub Pages:

```text
examples/VISUALIZE/
```

Use a Web Bluetooth compatible browser such as Chrome. Select the connect
switch for device 01 first, then device 02 if needed.

## Data

- Notify type: `SENSOR_VALUES`
- Main callbacks: accelerometer, gyro, quaternion, Euler

## Validation status

Static page/link checks only. BLE connection and chart updates still need
real-device validation after any connection UI changes.
