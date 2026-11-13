# Index-linked examples audit

This audit covers the examples that are directly reachable from `index.html`.
It is intentionally static: BLE behavior, thresholds, and game logic were not
changed or verified with real ORPHE CORE devices.

## Scope

- Application Examples cards in `index.html`
- Starter Templates cards in `index.html`
- Creative Examples cards in `index.html`
- Technical Examples cards in `index.html`
- p5.js links are listed as outbound learning material, but their code was not
  inspected in this pass.

## Summary

| Group | Local entries | Main quality risk |
| --- | ---: | --- |
| Application Examples | 12 | Connection UI is mixed: some use raw API, some use CoreToolkit, and some README files are still thin. |
| Starter Templates | 9 | Good raw API teaching material; README coverage is intentionally minimal but should be documented at directory level. |
| Creative Examples | 7 | Most are already CoreToolkit-based, but a few game READMEs still need human-facing play instructions. |
| Technical Examples | 1 local + 3 p5.js links | Useful advanced material, but gesture-related examples should be framed separately from sensor basics. |

## Index-linked local examples

| Entry | Purpose | Devices | Notify / data | Connection pattern | README | Static assessment |
| --- | --- | ---: | --- | --- | --- | --- |
| `examples/INFORMATION/` | Read device information | 1 | `STEP_ANALYSIS` used to connect/read info | raw API (`new Orphe`, `begin`) | yes | Keep as raw API; it teaches the simplest direct connection. |
| `examples/LIGHT/` | LED control | 1-2 | none / device command | raw API, two device slots | yes | Keep as raw API; README should clarify one device is enough for first test. |
| `examples/VIEW/` | Inspect sensor and gait tables | 2 | `STEP_ANALYSIS` or `SENSOR_VALUES` selectable | raw API with checkbox UI | yes | CoreToolkit candidate; current README still has old known-issue wording. |
| `examples/VISUALIZE/` | Plot sensor values with Chart.js | 2 | `SENSOR_VALUES` | raw API with checkbox UI | yes | Best CoreToolkit PoC candidate; README is too thin and still says RAW. |
| `examples/FOOT ANGLE/` | Landing angle visualization | 1 intended; static comments mention 2 | `STEP_ANALYSIS_AND_SENSOR_VALUES` | CoreToolkit | yes | Already improved; path has a space, so links must keep URL encoding or angle brackets. |
| `examples/PRONATION/` | Pronation visualization | 1 | `STEP_ANALYSIS_AND_SENSOR_VALUES` | CoreToolkit | yes | Already CoreToolkit-based; keep listed. |
| `examples/AIRWALKER/` | Activity / step dashboard | 1 | `SENSOR_VALUES` | CoreToolkit | yes | Already CoreToolkit-based; keep listed. |
| `examples/POSE/` | MediaPipe Pose integration | 1-2 | `STEP_ANALYSIS` | custom raw API | yes | Needs design before CoreToolkit; MediaPipe UI and BLE flow are coupled. |
| `examples/OH1/` | Polar OH1 + ORPHE integration | 1 ORPHE + OH1 | mixed external BLE + ORPHE | custom + CoreToolkit helper | yes | Do not refactor casually; external BLE integration makes this special. |
| `examples/CORETOOLKIT-STARTER/` | CoreToolkit entry point | 2 | `STEP_ANALYSIS_AND_SENSOR_VALUES` | CoreToolkit | yes | Good reference for CoreToolkit UI. |
| `examples/SENSOR-CALIBRATION/` | Record gesture/sensor training data | 1 | configurable, default `STEP_ANALYSIS_AND_SENSOR_VALUES` | CoreToolkit | yes | Already CoreToolkit-based; needs real-device validation before promoting as stable recording tool. |
| `examples/GESTURE-DEMO/` | Real-time toe/heel/stomp detection | 1 | `STEP_ANALYSIS_AND_SENSOR_VALUES` | CoreToolkit | yes | Already CoreToolkit-based; overlaps Technical and Application sections. |
| `examples/GAME-UDON/` | Foot-powered kneading game | 2 | `SENSOR_VALUES` | CoreToolkit | yes | Listed and playable; needs human playtest. |
| `examples/MOVEYOURFEET/` | Exercise / foot movement game | 2 | `SENSOR_VALUES` | CoreToolkit | yes | Listed and playable; connection UI already visible. |
| `examples/GAME-PINGPONG/` | Two-player ping pong game | 2 | `STEP_ANALYSIS_AND_SENSOR_VALUES` in `index.html` | CoreToolkit | yes | Listed; stale helper files still mention `ANALYSIS`, so avoid touching logic without a focused cleanup. |
| `examples/drum_test/` | Gesture drum sampler | 2 | `SENSOR_VALUES` | CoreToolkit | yes | Listed; directory name is still test-like, but rename should be deferred. |
| `examples/GAME-HURDLE/` | 110m hurdle game | 2 | `STEP_ANALYSIS_AND_SENSOR_VALUES` | CoreToolkit | yes | Listed; real-device validation required for ranking/gesture flow. |
| `examples/GAME-BOXING/` | Punch rhythm/action game | 2 | `SENSOR_VALUES` | custom raw API | yes | Needs design before CoreToolkit; README is detailed but still has project-template deployment wording. |
| `examples/GAME-DDR/` | Foot rhythm game | 2 | `STEP_ANALYSIS` | CoreToolkit | yes | Listed; already has internal docs, avoid broad edits. |

## Starter Templates

Starter Templates should remain raw API examples. Their job is to show the
minimal `new Orphe(0)`, `setup()`, and `begin(...)` path for one data stream.
Adding CoreToolkit to these would hide the direct API surface.

| Template | Notify type | Keep raw API? | Notes |
| --- | --- | --- | --- |
| `LIGHT.html` | `STEP_ANALYSIS` | yes | LED hello-world; explain why notify is used only for connection setup if documenting further. |
| `ACCELEROMETER.html` | `SENSOR_VALUES` | yes | Good 6-axis IMU entry point. |
| `GYRO.html` | `SENSOR_VALUES` | yes | Good 6-axis IMU entry point. |
| `QUATERNION.html` | `SENSOR_VALUES` | yes | Orientation basics. |
| `EULER.html` | `SENSOR_VALUES` | yes | Orientation basics. |
| `STEPS.html` | `STEP_ANALYSIS` | yes | First Gait Analysis value. |
| `STRIDE.html` | `STEP_ANALYSIS` | yes | Gait Analysis value. |
| `PRONATION.html` | `STEP_ANALYSIS` | yes | Gait Analysis value. |
| `ANALYSIS_AND_RAW.html` | `STEP_ANALYSIS_AND_SENSOR_VALUES` | yes | Filename is legacy wording; keep file path for compatibility, but user-facing label should be canonical. |

## Immediate safe fixes

These are documentation/label changes only and do not require real-device
validation:

- Rewrite `examples/VISUALIZE/README.md` from "RAW DATA Visualizer" to
  "Sensor Visualize (Chart.js)" and document two optional ORPHE CORE slots.
- Refresh `examples/VIEW/README.md` to remove stale local path wording and make
  the known limitations explicit as real-device validation items.
- Add a `starter-templates/README.md` explaining that these templates are raw
  API teaching material and should not be CoreToolkit-first.
- Make `examples/GAME-BOXING/README.md` deployment wording match this repo's
  GitHub Pages path instead of a placeholder project URL.

## Needs real-device validation

- All games in the Creative section.
- `VIEW` and `VISUALIZE` after any CoreToolkit PoC change.
- `SENSOR-CALIBRATION` recording/export flow.
- `OH1`, because it combines ORPHE CORE and external BLE heart-rate hardware.
- `POSE`, because camera/MediaPipe and BLE are coupled in the user flow.

## Assumptions

- `index.html` is now the source of truth for what first-time users see.
- `examples/catalog.json` remains the source of truth for broader catalog
  metadata.
- Static analysis can identify connection patterns, but cannot prove BLE
  behavior.
