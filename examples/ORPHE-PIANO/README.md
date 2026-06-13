# Orphe Piano for ORPHE-CORE.js

This example is a browser port of [`Orphe-OSS/Orphe-Piano`](https://github.com/Orphe-OSS/Orphe-Piano).

For the current interaction, sensor, scene, and sound-routing details, see [`SPEC.md`](./SPEC.md).

## Source Project Analysis

The original app is an iOS project built with Swift 3.1, `Orphe-SDK-Swift-1.1.0`, C4, and libpd. Its runtime flow is:

- `ConnectViewController.swift` scans and connects up to two Orphe devices, sets SDK scene mode, and enables high gesture sensitivity.
- `Player.swift` receives sensor and gesture notifications, then sends `sensorValues` and `gesture` lists to Pure Data via `g_message`.
- `Resources/pd-patches/*.pd` maps Euler angles, gyro motion, steps, and kicks to note numbers, sampled piano playback, accompaniment bangs, and LED/light triggers.
- `ViewController.swift` renders two animated circles and changes ORPHE lights when the Pure Data patch emits trigger messages.

## Porting Scope

This Web version keeps the musical interaction model but replaces iOS/libpd dependencies with ORPHE-CORE.js and Web Audio:

- CoreToolkit connects two ORPHE CORE modules using `STEP_ANALYSIS_AND_SENSOR_VALUES`.
- `gotEuler`, `gotGyro`, `gotConvertedAcc`, `gotStepsNumber`, `gotGait`, and `gotLandingImpact` replace the Swift notification bridge.
- The reachable `Resources/pd-patches/allpiano/piano*.wav` sample set is copied into `examples/ORPHE-PIANO/allpiano/`.
- The browser UI treats walking and strong motion as a decaying progress value: every STEP, motion STEP, KICK, or test event from either CORE advances the meter, and stopping gradually rolls the meter and scene backward.
- Scene thresholds are spaced every eight progress events: 0, 8, 16, 24, 32, 40, 48, 56, 64, and 72.
- Scene 1-9 use eight-step arpeggios. Euler roll/pitch plus gyro z selects rise/fall/wave/wide arpeggio profiles instead of selecting a single random note.
- Scene 10 combines the Scene 9-style piano arpeggio with a `piano7.wav` granular burst.
- TOE/FLAT/HEEL is inferred from the current Euler pitch or foot angle at step/gait event time.
- Scene 8 accompaniment plays `piano1.wav`, `piano2.wav`, and `piano3.wav` on the original 16-step counter positions.
- Jump hits can happen in every scene and are mapped to `piano11.wav` and `piano12.wav`.
- KICK-like motion routes high notes through a three-tap delay based on the Pure Data `DelayEffect`.
- Canvas rings and ORPHE LED patterns replace the C4 visual and Pure Data light callbacks.

## Fidelity Notes

- ORPHE-CORE.js does not expose the original Swift `STEP_TOE`, `STEP_FLAT`, `STEP_HEEL`, and `KICK` gesture callback. This port reconstructs STEP behavior from step/gait updates and motion thresholds. KICK is tuned for airborne vigorous movement by accumulating `gotConvertedAcc` energy when no recent gait/step analysis event is present.
- TOE/FLAT/HEEL labels are threshold-based approximations. Tune the pitch/foot-angle thresholds in `classifyStepPosition()` if the mounted device orientation differs.
- Pure Data sends a `Scene11` flag at StepSUM 47, but the source patch has no `r Scene11` receiver. The browser port cuts this no-sound scene and keeps Scene 10 as the last musical scene.
- Exact threshold tuning still requires two real ORPHE CORE devices in Chrome.

Open `examples/ORPHE-PIANO/index.html` from a local HTTPS or localhost server in Chrome to use Web Bluetooth.
