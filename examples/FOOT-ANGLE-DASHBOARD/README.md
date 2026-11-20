# Foot Angle Dashboard (PoC, draft)

Status: `public-candidate` (planned). **Not yet listed in
`examples/catalog.json`**. See "Proposed catalog metadata" below.

A small page that surfaces foot angle at landing, landing impact, and
pronation magnitude from one ORPHE CORE, and bins each landing into
*fore / mid / heel* using configurable thresholds. Reads the SDK callbacks
directly — no analytics or recorder helper required, so it ships
independently of any in-flight helper PR. Pairs with
[Lesson 09](../../docs/lessons/09-foot-angle-at-landing.md).

## What you can do without a device

- Open the page in Chrome and confirm the layout, the empty bin table,
  the threshold inputs, and the BLE guard message in browsers without Web
  Bluetooth.

## What you can do with a device

- Connect one ORPHE CORE through the CoreToolkit switch.
- Walk a 5 m lane and watch the bin counts populate.
- Adjust the **Fore &lt;** and **Mid &lt;** threshold inputs and watch the
  recent-landings table re-bin in place.
- Press **Reset counts** to clear the bin table without disconnecting.

## Run locally

From the repo root:

```bash
python3 -m http.server 8767
```

Then open `http://localhost:8767/examples/FOOT-ANGLE-DASHBOARD/` in Chrome on
macOS or Windows.

## Notification type

`STEP_ANALYSIS_AND_SENSOR_VALUES`. The dashboard uses `gotFootAngle`,
`gotLandingImpact`, and `gotPronation` only. Acceleration / gyro callbacks
are not wired.

## Files

| File | Notes |
|---|---|
| `index.html` | Page layout, CoreToolkit placeholder, metric cards, threshold inputs, bin and recent-landing tables. |
| `sketch.js`  | Wires `bles[0].gotFootAngle` / `gotLandingImpact` / `gotPronation`. Joins the three callbacks into one landing row using a 100 ms window. |
| `style.css`  | Light tweaks on top of Bootstrap. |
| `README.md`  | This file. |

## Dependencies

- `js/ORPHE-CORE.js`, `js/CoreToolkit.js`, `js/BleSharedBridge.js`,
  `js/quaternion.js` — existing core libraries.
- **No new helper module is required.** This example deliberately reads the
  SDK callbacks directly so it is independent of the in-flight
  `CoreAnalytics.js` and `CoreRecorder.js` PRs.

## Proposed catalog metadata

```jsonc
{
  "id": "foot-angle-dashboard",
  "title": "Foot Angle Dashboard",
  "path": "examples/FOOT-ANGLE-DASHBOARD/",
  "type": "web-app",
  "status": "public-candidate",
  "audience": ["education", "sports-science"],
  "value": "Live foot angle, landing impact, and pronation from one ORPHE CORE, with configurable fore/mid/heel binning.",
  "topics": ["foot-angle", "landing-impact", "pronation", "binning"],
  "data": ["footAngle", "landingImpact", "pronation"],
  "devices": 1,
  "validation": ["browser-preview", "needs-real-device-validation"],
  "category": "analysis",
  "difficulty": "intermediate",
  "featured": false,
  "thumbnail": "examples/_thumbnails/foot-angle-dashboard.png",
  "sort_order": 230,
  "links": {
    "demo":   "examples/FOOT-ANGLE-DASHBOARD/index.html",
    "source": "examples/FOOT-ANGLE-DASHBOARD/"
  },
  "requires_device": true,
  "device_count": 1,
  "needs_real_device_validation": true,
  "public_navigation": "listed"
}
```

Thumbnail (`examples/_thumbnails/foot-angle-dashboard.png`) is **not yet
generated** — capture from a real walking session before promoting to
`listed`.

## Real-device validation

Not yet performed. Required before promoting from `public-candidate` to
`public`:

- One ORPHE CORE connects, foot-angle / landing-impact / pronation values
  populate during walking.
- Bin counts increment and the recent-landing table fills out.
- Adjusting the threshold inputs re-bins the table in place.
- Reset clears the bin counts and the recent-landing table.

## Out of scope

- Comparing to camera footage. Lesson 09 covers that as a discussion
  prompt; the example does not include video.
- Editing `examples/catalog.json`. Codex owns the catalog.
- Persistence between page reloads.
- A force-platform-style impact metric. The dashboard reports the
  device-defined `gotLandingImpact.value` only.

## Open questions

- Default bin thresholds (5° / 15°) are placeholders. Should they ship
  per-mount or per-shoe?
- Should the bin table retain history beyond the 12-row recent-landing
  buffer? Currently recomputing bins after a threshold change uses only
  the recent buffer.
- Should this PoC also surface a per-bin landing-impact mean? Possible
  follow-up.
