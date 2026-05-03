# Workshop #7 / #8: DFT and FFT

This workshop example shows how to use ORPHE CORE sensor data as a signal for
Fourier transform / DFT exercises.

It is linked from the ORPHE CORE WS YouTube lesson materials. The page content
is kept as workshop material rather than rewritten as a beginner example.

## What It Does

- Connects one ORPHE CORE with CoreToolkit.js.
- Reads `SENSOR_VALUES`.
- Uses acceleration data as a time-series signal.
- Visualizes the original signal and a simple DFT-style frequency view.

## Why It Exists

This is workshop material, not a polished beginner app. It is useful when the
goal is to teach signal processing concepts with real foot motion data.

## Requirements

- Chrome with Web Bluetooth support.
- One ORPHE CORE module.
- Local server such as `python3 -m http.server 8767`.

## Run

Open:

```text
http://localhost:8767/examples/WORKSHOP_07/
```

Then connect ORPHE CORE from the CoreToolkit switch.

## Validation

Published as workshop / YouTube lesson material.

Human checks:

- Page opens.
- Links are intact.
- The DFT / frequency display is understandable for workshop use.
- Optional: ORPHE CORE connects in Chrome and acceleration data changes the
  plotted waveform.

## Notes

- This page consolidates the old Workshop #7 and Workshop #8 samples.
- It stays under the workshop/archive category rather than the beginner
  Examples path.
