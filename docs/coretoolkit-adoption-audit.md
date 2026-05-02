# CoreToolkit adoption audit

This document separates examples that should keep the raw ORPHE-CORE.js API
from examples where CoreToolkit can improve connection UI, state visibility,
and debugging.

## Policy

Do not convert every example to CoreToolkit.

- Raw API examples are important for learning the library surface.
- CoreToolkit examples are better for app-like experiences, two-device flows,
  recording tools, and games where visible connection state matters.
- Any CoreToolkit conversion changes user experience and needs real-device
  validation.

## Classification

| Example | Classification | Reason |
| --- | --- | --- |
| `examples/INFORMATION/` | `keep-raw-api` | Minimal direct connection and device information read. |
| `examples/LIGHT/` | `keep-raw-api` | LED hello-world should show the raw API path. |
| `starter-templates/*.html` | `keep-raw-api` | These are the canonical minimal examples for each data stream. |
| `examples/CORETOOLKIT-STARTER/` | `already-coretoolkit` | Primary CoreToolkit teaching example. |
| `examples/AIRWALKER/` | `already-coretoolkit` | Dashboard-style app benefits from connection UI. |
| `examples/FOOT ANGLE/` | `already-coretoolkit` | Gait visualization with visible connection UI. |
| `examples/PRONATION/` | `already-coretoolkit` | Gait visualization with visible connection UI. |
| `examples/SENSOR-CALIBRATION/` | `already-coretoolkit` | Recording workflow needs connection/status UI. |
| `examples/GESTURE-DEMO/` | `already-coretoolkit` | Practical gesture demo already uses CoreToolkit. |
| `examples/DTW/` | `already-coretoolkit` | Advanced analysis demo uses CoreToolkit in `sketch.js`. |
| `examples/GAME-UDON/` | `already-coretoolkit` | Two-device physical game; CoreToolkit is appropriate. |
| `examples/MOVEYOURFEET/` | `already-coretoolkit` | Two-device physical game; CoreToolkit is appropriate. |
| `examples/GAME-PINGPONG/` | `already-coretoolkit` | Two-device game; stale helper files should be cleaned separately. |
| `examples/drum_test/` | `already-coretoolkit` | Two-device gesture instrument; connection UI is useful. |
| `examples/GAME-HURDLE/` | `already-coretoolkit` | Two-device game and ranking flow; keep CoreToolkit. |
| `examples/GAME-DDR/` | `already-coretoolkit` | Two-device rhythm game; CoreToolkit fits. |
| `examples/VISUALIZE/` | `candidate-coretoolkit` | Simple SENSOR_VALUES chart UI; best PoC candidate. |
| `examples/VIEW/` | `candidate-coretoolkit` | Sensor/gait table viewer, but reset controls make it slightly more complex than VISUALIZE. |
| `examples/POSE/` | `needs-design` | MediaPipe/camera UI and BLE flow need an integrated design before CoreToolkit. |
| `examples/GAME-BOXING/` | `needs-design` | Custom calibration/game flow and two-device semantics are tightly coupled. |
| `examples/OH1/` | `do-not-change` | External BLE heart-rate integration makes this special. |
| `examples/ICC2022Sep/` | `do-not-change` | Legacy/conference asset; audit before promotion. |
| `ws/tmu2022/` | `do-not-change` | Workshop archive with bundled old dependencies. |
| `ws/tmu2025/` | `needs-design` | Many standalone student apps; should be curated, not bulk-converted. |

## Recommended adoption order

1. PoC: `examples/VISUALIZE/`
2. If successful: `examples/VIEW/`
3. Then evaluate app-like non-indexed candidates such as `GAME-MARIO` and
   `GAME-SHOOTING`, one PR per example.
4. Do not convert starter templates.

## Static issues noticed

- `examples/GAME-PINGPONG/scripts.js` still contains `ANALYSIS`, while
  `index.html` uses `STEP_ANALYSIS_AND_SENSOR_VALUES`. Treat as stale helper
  cleanup, not CoreToolkit migration.
- `examples/GAME-MARIO/scripts.js` similarly contains legacy `ANALYSIS`; check
  whether it is loaded before editing.
- `examples/VISUALIZE/README.md` still says RAW even though the page uses
  `SENSOR_VALUES`.
- Workshop archives contain old `RAW`/`ANALYSIS` patterns and bundled SDK
  copies; keep them out of global migrations.

## Needs real-device validation

Every actual CoreToolkit conversion must verify:

- Device chooser opens for the expected ORPHE CORE module.
- Connection state is visible.
- The expected notify stream starts.
- Data callbacks still update the existing UI.
- Disconnect/reconnect does not leave stale UI state.
- For two-device examples, each side controls the intended panel/player.

