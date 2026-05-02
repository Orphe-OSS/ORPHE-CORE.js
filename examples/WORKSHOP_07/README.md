# Workshop #7 / #8: DFT and FFT

This workshop example shows how to use ORPHE CORE sensor data as a signal for
Fourier transform / DFT exercises.

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

Needs real-device validation before promotion from `public-candidate` to
`public`.

Human checks:

- Page opens.
- ORPHE CORE connects in Chrome.
- Acceleration data changes the plotted waveform.
- The DFT / frequency display is understandable for workshop use.

## Notes

- This page consolidates the old Workshop #7 and Workshop #8 samples.
- It should probably stay under a workshop/archive category rather than the
  beginner Examples path.
