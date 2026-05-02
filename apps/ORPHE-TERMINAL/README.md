# ORPHE TERMINAL

ORPHE TERMINAL is a developer utility for inspecting raw ORPHE CORE
characteristic data in the browser.

## What It Does

- Connects one ORPHE CORE with CoreToolkit.js.
- Reads and writes Device Information.
- Reads and writes Date Time.
- Streams `SENSOR_VALUES`.
- Shows raw byte data in text areas.
- Can export buffered data as CSV.

## Intended Audience

This is a developer/debugging tool. It is not a beginner tutorial and should be
listed separately from playful examples or starter templates.

## Requirements

- Chrome with Web Bluetooth support.
- One ORPHE CORE module.
- Local server such as `python3 -m http.server 8767`.

## Run

Open:

```text
http://localhost:8767/apps/ORPHE-TERMINAL/
```

Then connect ORPHE CORE from the CoreToolkit switch.

## Validation

Needs real-device validation before promotion from `public-candidate` to
`public`.

Human checks:

- Page opens.
- ORPHE CORE connects in Chrome.
- Device Information read/write works.
- Date Time read/write works.
- SENSOR_VALUES stream updates.
- Download buttons create CSV files.

## Notes

- This tool uses lower-level raw byte displays. It should remain in a
  developer-tool category.
- Do not treat it as a recommended first example for new users.
