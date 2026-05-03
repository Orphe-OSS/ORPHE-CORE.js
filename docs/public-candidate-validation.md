# Public Candidate Validation Queue

This document tracks examples that are valuable enough to show in the catalog
but still need human review before they should be treated as stable public
examples.

This is an internal validation document. Do not show "needs real-device
validation" as a public badge in the examples gallery.

## Current Status

- `public`: 35 entries
- `public-candidate`: 7 entries

`GAME-MARIO` and `GAME-SHOOTING2` were promoted to `public` after owner
real-device checks. The entries below remain candidates.

## Morning Check List

Open these URLs from a local server and use Chrome for BLE tests.

| Order | Entry | URL | Device | Main check | Promotion blocker |
|---|---|---|---:|---|---|
| 1 | `game-pk` | `http://localhost:8767/examples/GAME-PK/` | 1 | Kick detection and restart flow | BLE chooser / kick detection still needs owner confirmation |
| 2 | `game-shooting` | `http://localhost:8767/examples/GAME-SHOOTING/` | 1 | Tilt movement, fire input, restart | Decide whether it coexists with `GAME-SHOOTING2` |
| 3 | `game-fireball-mario` | `http://localhost:8767/examples/GAME-FIREBALL-MARIO/` | 1 | Step, kick, jump, restart, naming | Confirm no public-facing Mario text remains |
| 4 | `dtw` | `http://localhost:8767/examples/DTW/` | 1 | Mouse demo plus sensor input path | Needs clarity check for technical users |
| 5 | `workshop-07` | `http://localhost:8767/examples/WORKSHOP_07/` | 1 | Page opens and workshop value is clear | Decide catalog vs workshop-only placement |
| 6 | `ws-tmu2025` | `http://localhost:8767/ws/tmu2025/` | varies | Gallery opens and links work | Decide whether to split strong works later |
| 7 | `app-orphe-terminal` | `http://localhost:8767/apps/ORPHE-TERMINAL/` | 1 | Developer tool opens and can connect | Needs README and developer-tool positioning |

## Promotion Rules

Promote a candidate to `public` only when all relevant items are true:

- Human owner confirms the example in Chrome with the required ORPHE CORE count.
- The example title and visible UI are acceptable for public use.
- Restart/reconnect flow does not obviously break the session.
- README or page copy explains what it does, required device count, startup, and known limitations.
- `examples/catalog.json` has `needs_real_device_validation: false`.
- `validation` includes a real-device validation note.

Do not promote workshop galleries or developer tools just because they open.
They need a navigation decision first.

## Candidate Details

### 1. `examples/GAME-PK/`

Purpose: one-device penalty kick game.

Current state:

- `status`: `public-candidate`
- Requires one ORPHE CORE.
- Uses `STEP_ANALYSIS_AND_SENSOR_VALUES`.
- Uses the same `bles[0]` instance as CoreToolkit.
- CoreToolkit owns `begin()` and notify start.
- Uses local `ORPHE-CORE.js` and `CoreToolkit.js`.

Can be checked without device:

- Page loads.
- Start screen and instructions are visible.
- No public gallery badge exposes internal validation state.
- README explains purpose, device count, and startup.

Human BLE checks:

- Connect one ORPHE CORE from the CoreToolkit switch.
- Press START.
- After the countdown, swing the foot and confirm the kick is detected.
- Confirm score/result updates.
- Confirm RESTART works without losing BLE connection.

Promotion condition:

- If the above passes, set `status` to `public` and
  `needs_real_device_validation` to `false`.

### 2. `examples/GAME-SHOOTING/`

Purpose: simple p5.js shooting game.

Current state:

- `status`: `public-candidate`
- Requires one ORPHE CORE.
- Uses `SENSOR_VALUES`.
- Uses the same `bles[0]` instance as CoreToolkit.
- Metadata records one ORPHE CORE device.

Can be checked without device:

- Page loads.
- Keyboard fallback still starts and moves the game.
- README states that BLE input needs device validation.

Human BLE checks:

- Connect one ORPHE CORE.
- Tilt to move left/right.
- Confirm the fire action.
- Confirm keyboard fallback still works.
- Confirm restart after game over works.

Promotion condition:

- If the input and restart flow pass, decide whether this should coexist with
  `GAME-SHOOTING2` or stay as a simpler 2D variant.

### 3. `examples/GAME-FIREBALL-MARIO/`

Purpose: one-device action game with stepping, kicking, and jumping gestures.

Current state:

- `status`: `public-candidate`
- Public-facing title changed to `Fireball Action`.
- Directory name still contains `MARIO` for compatibility.
- README explains startup, data, and validation points.

Can be checked without device:

- Page title and visible heading use `Fireball Action`.
- No public-facing `Mario` label remains in the UI.
- Page opens from the examples gallery.

Human BLE checks:

- Connect one ORPHE CORE.
- Confirm step, kick, and jump gestures work.
- Confirm restart/game-over flow.
- Confirm shared BLE streaming still works when another page is primary.

Promotion condition:

- If the game works and naming is acceptable, promote to `public`.

### 4. `examples/DTW/`

Purpose: technical example for time-series matching with Dynamic Time Warping.

Current state:

- `status`: `public-candidate`
- Requires one ORPHE CORE for sensor input.
- Also has a mouse/shape demo path that can be inspected without hardware.
- README explains what the example teaches and how to run it.

Can be checked without device:

- Open the page and confirm mouse input still demonstrates DTW behavior.
- Confirm triangle/circle/square matching is understandable.
- Confirm the page has enough instruction for a technical reader.

Human BLE checks:

- Connect one ORPHE CORE.
- Confirm sensor input updates the time-series path used for matching.

Promotion condition:

- If the technical behavior is clear, promote to `public`; otherwise keep as
  `public-candidate` and add a short on-page instruction.

### 5. `examples/WORKSHOP_07/`

Purpose: workshop material for Fourier / DFT.

Current state:

- `status`: `public-candidate`
- This is workshop material, not a beginner app.
- Missing a dedicated README.

Can be checked without device:

- Page opens.
- The workshop purpose is understandable.
- Links and embedded references work.

Decision needed:

- Keep listed under the Examples catalog as workshop material, or move to a
  workshop/docs-only navigation path.

Suggested default:

- Keep in the catalog, but do not feature it on the LP.
- Add a README before promotion.

### 6. `ws/tmu2025/`

Purpose: workshop gallery.

Current state:

- `status`: `public-candidate`
- This is a gallery of workshop works, not a single maintained example.
- Missing a dedicated README.

Can be checked without device:

- Gallery opens.
- Project links and thumbnails are intact.
- The page does not imply every project is a maintained official example.

Decision needed:

- Treat as a gallery of projects, not as a single example app.

Suggested default:

- Keep in the catalog under `workshop-archive`.
- Later split strong individual works into separate catalog entries if they are
  maintained.

### 7. `apps/ORPHE-TERMINAL/`

Purpose: developer utility.

Current state:

- `status`: `public-candidate`
- Developer tool rather than beginner example.
- Needs a fuller README before promotion.

Can be checked without device:

- Page opens.
- Tool sections and controls are visible.
- The purpose is clear enough for a developer.

Human BLE checks:

- Connect one ORPHE CORE.
- Confirm Device Information read/write area works.
- Confirm SENSOR_VALUES stream area updates.
- Confirm download buttons still create data files.

Decision needed:

- Keep as a developer tool, separate from beginner examples.

Suggested default:

- Keep in the catalog under `developer-tool`.
- Improve README before promoting from `public-candidate` to `public`.
