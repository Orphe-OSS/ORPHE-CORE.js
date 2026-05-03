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
kept out of public beginner navigation.

Because this tool exposes raw `Send` controls for `DEVICE_INFORMATION` and
`DATE_TIME`, it should be used only by maintainers or developers who understand
the target characteristic behavior.

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

Owner real-device validation passed with one ORPHE CORE.

Checked:

- Page opens.
- ORPHE CORE connects in Chrome.
- Device Information UI is visible.
- Date Time UI is visible.
- SENSOR_VALUES stream updates.

## Notes

- This tool uses lower-level raw byte displays. It should remain in a
  hidden developer-tool category.
- Do not treat it as a recommended first example for new users.
- Do not link this tool prominently from the landing page unless the raw write
  controls are removed or gated.
