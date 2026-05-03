# Step Count Dashboard (PoC, draft)

Status: `public-candidate` (planned). **Not yet listed in
`examples/catalog.json`**. See "Proposed catalog metadata" below.

A small page that renders live steps, rolling cadence, stride statistics, a
baseline-vs-current comparison panel, and a CMJ readout, all driven by the
draft `js/CoreAnalytics.js` helper. One device. Pairs with
[Lesson 01](../../docs/lessons/01-step-count-dashboard.md),
[Lesson 02](../../docs/lessons/02-stride-and-cadence.md),
[Lesson 03](../../docs/lessons/03-lr-symmetry.md), and
[Lesson 06](../../docs/lessons/06-vertical-jump-cmj.md).

## What you can do without a device

- Open the page in Chrome and confirm the layout, the empty-state baseline
  table ("No baseline captured yet."), the disabled buttons, and the BLE
  guard message in any browser without Web Bluetooth.

## What you can do with a device

- Connect one ORPHE CORE through the CoreToolkit switch.
- Press **Start**, walk for 30 s, press **End**.
- Press **Capture as baseline**, change the session label, **Start** again,
  walk a different pace, **End**.
- Compare the rows in the baseline-comparison table.
- Perform a vertical jump and watch the CMJ panel update.

## Run locally

From the repo root:

```bash
python3 -m http.server 8767
```

Then open `http://localhost:8767/examples/STEP-COUNT-DASHBOARD/` in Chrome on
macOS or Windows. Safari and Firefox cannot use the Web Bluetooth API and will
show the guard message.

## Notification type

`STEP_ANALYSIS_AND_SENSOR_VALUES`. Steps, stride, pronation, landing impact,
and step-number events drive the dashboard; converted accelerometer values
drive the CMJ panel.

## Files

| File | Notes |
|---|---|
| `index.html` | Page layout, CoreToolkit placeholder, metric cards, controls. Loads `../../js/CoreAnalytics.js`. |
| `sketch.js`  | Wires `bles[0]` callbacks to `CoreAnalytics.feed*`. Owns Start / End / Reset / Baseline buttons. |
| `style.css`  | Light tweaks on top of Bootstrap. |
| `README.md`  | This file. |

## Dependencies

- `js/ORPHE-CORE.js`, `js/CoreToolkit.js`, `js/BleSharedBridge.js`,
  `js/quaternion.js` — existing core libraries.
- `js/CoreAnalytics.js` — new module introduced in PR
  `claude/core-analytics-api-draft`. **This example only works on top of that
  PR.**

## Proposed catalog metadata

This example is not yet added to `examples/catalog.json`. Codex owns the
catalog file. When promoting, the proposed entry is:

```jsonc
{
  "id": "step-count-dashboard",
  "title": "Step Count Dashboard",
  "path": "examples/STEP-COUNT-DASHBOARD/",
  "type": "web-app",
  "status": "public-candidate",
  "audience": ["education", "sports-science"],
  "value": "Live steps, cadence, stride stats, CMJ, and baseline comparison driven by the draft CoreAnalytics.js helper.",
  "topics": ["analytics", "steps", "cadence", "baseline", "cmj"],
  "data": ["acc", "gait", "stride", "pronation", "landingImpact", "stepsNumber"],
  "devices": 1,
  "validation": ["browser-preview", "needs-real-device-validation"],
  "category": "analysis",
  "difficulty": "beginner",
  "featured": false,
  "thumbnail": "examples/_thumbnails/step-count-dashboard.png",
  "sort_order": 210,
  "links": {
    "demo":   "examples/STEP-COUNT-DASHBOARD/index.html",
    "source": "examples/STEP-COUNT-DASHBOARD/"
  },
  "requires_device": true,
  "device_count": 1,
  "needs_real_device_validation": true,
  "public_navigation": "listed"
}
```

Thumbnail (`examples/_thumbnails/step-count-dashboard.png`) is **not yet
generated** — capture from a real session before promoting to `listed`.

## Real-device validation

Not yet performed. Required before promoting from `public-candidate` to
`public`:

- One ORPHE CORE connects, steps tick up during a walk.
- Cadence reads sensible values (60–140 steps/min for normal walking).
- Stride mean reads sensible values (0.4–1.2 m for normal walking).
- Baseline capture and comparison rows update correctly after a second
  session.
- CMJ readout produces a flight-time and a height after a single jump
  (height ≈ 10–50 cm depending on the jumper).

## Out of scope

- Multi-device setup. The page wires `bles[0]` only. The L/R Symmetry lesson
  (Lesson 03) suggests a follow-up dual-device variant.
- Persistence between page reloads.
- Editing `examples/catalog.json`. Codex owns the catalog.

## Open questions

- Should the CMJ panel surface every jump (history table) or only the most
  recent (current behavior)?
- Cadence window: 10 s (current) or configurable?
