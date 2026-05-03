# Replay Player (PoC, draft)

Status: `public-candidate` (planned). **Not yet listed in
`examples/catalog.json`**. See "Proposed catalog metadata" below.

A small page that replays a recorded ORPHE CORE session through the same
callback shapes the SDK fires live, using `CoreRecorder.fromJSON` and
`CoreRecorder.replay` from the draft `js/CoreRecorder.js` helper. **Boots
without hardware** by auto-loading a shipped synthetic recording
(`sample-session.js`); also accepts a JSON file produced by the planned
`CSV-RECORDER` example. Pairs with
[Lesson 05](../../docs/lessons/05-replay-player.md).

## What you can do without a device

- Open the page in any browser. The shipped sample auto-loads and you can
  press **Play** to fire about 145 events over 6 s at 1× speed.
- Drag the speed slider and play again; at 4× the same recording finishes in
  ~1.5 s, at 0× every event fires immediately.
- Drop in a JSON file produced by the CSV Recorder (any `0.0.1-draft` JSON)
  and replay it.

## What you can do with a device (optional)

- Expand the "Optional: live mirror via CoreToolkit" details and connect one
  ORPHE CORE. The page does not bind any analytics to the live stream by
  default — that's a follow-up. The CoreToolkit panel is here so the page
  participates in the standard BLE-guard pattern even when the primary UX is
  replay.

## Run locally

From the repo root:

```bash
python3 -m http.server 8767
```

Then open `http://localhost:8767/examples/REPLAY-PLAYER/` in any browser. For
the optional live-mirror panel, use Chrome on macOS or Windows.

## Notification type

None for the primary UX (replay does not subscribe to BLE). The optional
CoreToolkit panel uses `STEP_ANALYSIS_AND_SENSOR_VALUES`.

## Files

| File | Notes |
|---|---|
| `index.html`        | Page layout, source / playback panels, optional CoreToolkit details. Loads `../../js/CoreRecorder.js`. |
| `sketch.js`         | Source loading (shipped sample + file picker), playback control, event log. |
| `sample-session.js` | Synthetic recording shipped with the example. ~145 samples, ~6 s. Schema: `0.0.1-draft`. |
| `style.css`         | Light tweaks on top of Bootstrap. |
| `README.md`         | This file. |

## Dependencies

- `js/ORPHE-CORE.js`, `js/CoreToolkit.js`, `js/BleSharedBridge.js`,
  `js/quaternion.js` — existing core libraries.
- `js/CoreRecorder.js` — new module introduced in PR
  `claude/core-recorder-api-draft`. **This example only works on top of that
  PR.**

## Proposed catalog metadata

```jsonc
{
  "id": "replay-player",
  "title": "Replay Player",
  "path": "examples/REPLAY-PLAYER/",
  "type": "web-app",
  "status": "public-candidate",
  "audience": ["education", "data-collection"],
  "value": "Replay a recorded ORPHE CORE session at variable speed without hardware. Ships a synthetic sample.",
  "topics": ["replay", "recording", "json", "no-device"],
  "data": ["acc", "gait", "stride", "pronation", "landingImpact", "footAngle", "stepsNumber"],
  "devices": 0,
  "validation": ["browser-preview", "synthetic-sample-included"],
  "category": "tools-and-recording",
  "difficulty": "beginner",
  "featured": false,
  "thumbnail": "examples/_thumbnails/replay-player.png",
  "sort_order": 220,
  "links": {
    "demo":   "examples/REPLAY-PLAYER/index.html",
    "source": "examples/REPLAY-PLAYER/"
  },
  "requires_device": false,
  "device_count": 0,
  "needs_real_device_validation": false,
  "public_navigation": "listed"
}
```

Thumbnail (`examples/_thumbnails/replay-player.png`) is **not yet
generated** — capture from the shipped sample at 1× before promoting to
`listed`.

## Real-device validation

Not required for the primary UX (the page works without hardware).

For the optional CoreToolkit live mirror, validation is the same as any
other CoreToolkit page:

- The BLE switch is disabled in non-Web-Bluetooth browsers and shows the
  guard message (page calls `guardCoreToolkitBluetooth({ coreIds: [0] })`).
- The switch enables and pairs in Chrome on macOS or Windows.

## Out of scope

- Editing `examples/catalog.json`. Codex owns the catalog.
- Wiring the live BLE stream into the replay timeline. Live and replay run
  independently in this PoC.
- Persisting the loaded recording across page reloads.

## Open questions

- Should "playback finished" be detected from the actual last sample handler
  call instead of a `setTimeout`? Current PoC schedules one timer.
- Should the file picker accept CSV via `CoreRecorder.fromCSV`? PoC accepts
  JSON only to keep the pipeline obvious.
