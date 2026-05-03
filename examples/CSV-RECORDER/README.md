# CSV Recorder (PoC, draft)

Status: `public-candidate` (planned). **Not yet listed in
`examples/catalog.json`**. See "Proposed catalog metadata" below.

A small page that records ORPHE CORE callback payloads to a flat CSV (and to
JSON for replay) using the draft `js/CoreRecorder.js` helper. One device, one
session at a time. Pairs with [Lesson 04](../../docs/lessons/04-csv-recorder.md).

## What you can do without a device

- Open the page in Chrome, see the layout, the Start/Stop/Reset/Download
  buttons, the sample-kind counter table, and the schema-version label.
- Confirm the BLE switch is disabled with a clear message in any browser
  without Web Bluetooth (the page calls
  `guardCoreToolkitBluetooth({ coreIds: [0] })`).

## What you can do with a device

- Connect one ORPHE CORE through the CoreToolkit switch.
- Press **Start**, walk for 10 s, press **Stop**.
- Inspect the per-kind counters.
- Download the CSV and inspect it in any spreadsheet, or download the JSON and
  replay it later in the planned `REPLAY-PLAYER` example.

## Run locally

From the repo root:

```bash
python3 -m http.server 8767
```

Then open `http://localhost:8767/examples/CSV-RECORDER/` in Chrome on macOS or
Windows. Safari and Firefox cannot use the Web Bluetooth API and will show the
guard message.

## Notification type

`STEP_ANALYSIS_AND_SENSOR_VALUES`. Both step-analysis events (gait, stride,
pronation, landing impact, foot angle, steps number) and sensor-rate values
(acc, gyro, euler, quat) are recorded.

## Files

| File | Notes |
|---|---|
| `index.html` | Page layout, CoreToolkit placeholder, controls, counter table. Loads `../../js/CoreRecorder.js`. |
| `sketch.js`  | Wires `bles[0]` callbacks to `CoreRecorder.feed*`. Owns Start / Stop / Reset / Download buttons. |
| `style.css`  | Light tweaks on top of Bootstrap. |
| `README.md`  | This file. |

## Dependencies

- `js/ORPHE-CORE.js`, `js/CoreToolkit.js`, `js/BleSharedBridge.js`,
  `js/quaternion.js` — existing core libraries.
- `js/CoreRecorder.js` — new module introduced in
  PR `claude/core-recorder-api-draft`. **This example only works on top of
  that PR.**

## Proposed catalog metadata

This example is not yet added to `examples/catalog.json`. Codex owns the
catalog file. When promoting, the proposed entry is:

```jsonc
{
  "id": "csv-recorder",
  "title": "CSV Recorder",
  "path": "examples/CSV-RECORDER/",
  "type": "web-app",
  "status": "public-candidate",
  "audience": ["data-collection", "education"],
  "value": "Record ORPHE CORE callback payloads to a flat CSV and JSON using the draft CoreRecorder.js helper.",
  "topics": ["recording", "csv", "json", "replay"],
  "data": ["acc", "gyro", "euler", "quat", "gait", "stride", "pronation", "landingImpact", "footAngle", "stepsNumber"],
  "devices": 1,
  "validation": ["browser-preview", "needs-real-device-validation"],
  "category": "tools-and-recording",
  "difficulty": "intermediate",
  "featured": false,
  "thumbnail": "examples/_thumbnails/csv-recorder.png",
  "sort_order": 200,
  "links": {
    "demo":   "examples/CSV-RECORDER/index.html",
    "source": "examples/CSV-RECORDER/"
  },
  "requires_device": true,
  "device_count": 1,
  "needs_real_device_validation": true,
  "public_navigation": "listed"
}
```

Thumbnail (`examples/_thumbnails/csv-recorder.png`) is **not yet
generated** — capture from a recorded session before promoting to `listed`.

## Real-device validation

Not yet performed. Required before promoting from `public-candidate` to
`public`:

- One ORPHE CORE connects, sample kinds appear in the counter table.
- Start / Stop / Reset / Download CSV / Download JSON all work for a 30-second
  walk.
- Downloaded CSV opens in Google Sheets and Excel without re-encoding.
- Downloaded JSON loads cleanly in the planned `REPLAY-PLAYER` example.

## Out of scope

- Persistence (no localStorage, no IndexedDB).
- Multi-device recording. The page wires `bles[0]` only.
- Editing `examples/catalog.json` or `examples/SENSOR-CALIBRATION/recorder.js`.

## Open questions

- Should we expose a "max samples" guard so very long sessions don't grow
  unbounded? `CoreRecorder` defaults are unbounded; the page currently does
  not cap them.
- Should the CSV column order be locked to `CoreRecorder.CSV_COLUMNS`, or
  configurable per page? PoC follows the helper's order.
