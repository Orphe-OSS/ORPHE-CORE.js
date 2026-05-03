# Core Time Sync

`CORE_TIME_SYNC` is a small debugging example for reading and adjusting ORPHE
CORE device time.

## What this example shows

- Connect one ORPHE CORE module.
- Start `SENSOR_VALUES` notification to confirm the device is connected.
- Read the device `DATE_TIME` characteristic.
- Run `syncCoreTime()` and display round-trip timing information.

## Required devices

- 1 ORPHE CORE

## How to run

Open the demo from a local server or GitHub Pages:

```text
examples/CORE_TIME_SYNC/
```

Use a Web Bluetooth compatible browser such as Chrome.

## Data / API

- Notify type: `SENSOR_VALUES`
- Main APIs: `getDateTime()`, `syncCoreTime()`

## Validation status

Owner real-device validation passed with one ORPHE CORE:

- `SENSOR_VALUES` notification showed converted acceleration values.
- `getDateTime()` returned DateTime bytes.
- `syncCoreTime()` returned round-trip timing and adjusted time values.

This should stay positioned as a developer / recording utility rather than a
beginner-facing gallery example.
