# Public Candidate Validation Queue

This document tracks examples that are valuable enough to show in the catalog
but still need human review before they should be treated as stable public
examples.

This is an internal validation document. Do not show "needs real-device
validation" as a public badge in the examples gallery.

## Current Status

- `public`: 37 entries
- `public-candidate`: 6 entries

`GAME-MARIO`, `GAME-SHOOTING2`, `GAME-PK`, and `GAME-SHOOTING` were promoted to `public` after owner
real-device checks. The entries below remain candidates.

## Morning Check List

Open these URLs from a local server and use Chrome for BLE tests.

| Order | Entry | URL | Device | Main check | Promotion blocker |
|---|---|---|---:|---|---|
| 1 | `game-fireball-mario` | `http://localhost:8767/examples/GAME-FIREBALL-MARIO/` | 1 | Step, kick, jump, restart, naming | Confirm no public-facing Mario text remains |
| 2 | `dtw` | `http://localhost:8767/examples/DTW/` | 1 | Mouse demo plus sensor input path | Needs clarity check for technical users |
| 3 | `core-time-sync` | `http://localhost:8767/examples/CORE_TIME_SYNC/` | 1 | DateTime read and `syncCoreTime()` result | Needs owner confirmation before public listing |
| 4 | `workshop-07` | `http://localhost:8767/examples/WORKSHOP_07/` | 1 | Page opens and workshop value is clear | Keep in workshop category; do not feature on LP yet |
| 5 | `ws-tmu2025` | `http://localhost:8767/ws/tmu2025/` | varies | Gallery opens and links work | Keep as workshop gallery; split strong works later |
| 6 | `app-orphe-terminal` | `http://localhost:8767/apps/ORPHE-TERMINAL/` | 1 | Developer tool opens and can connect | Keep under developer tools, not beginner examples |

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



### 1. `examples/GAME-FIREBALL-MARIO/`

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

### 2. `examples/DTW/`

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

### 3. `examples/CORE_TIME_SYNC/`

Purpose: utility for checking ORPHE CORE device time and round-trip timing.

Current state:

- `status`: `public-candidate`
- Requires one ORPHE CORE.
- Uses `SENSOR_VALUES` only as a connection sanity check.
- Uses `getDateTime()` and `syncCoreTime()`.
- Kept out of public navigation until DateTime behavior is owner-verified.

Can be checked without device:

- Page opens.
- README explains what it checks and which APIs it uses.
- Catalog has a thumbnail and a demo/source link.

Human BLE checks:

- Connect one ORPHE CORE.
- Click `通知を有効化` and confirm converted acceleration appears.
- Click `時刻を取得する` and confirm raw DateTime bytes appear.
- Click `時刻補正実行` and confirm round-trip timing and adjusted time are shown.
- Confirm repeated clicks do not leave the page in a confusing state.

Promotion condition:

- If DateTime read/sync behavior is clear, keep it as `public-candidate` or
  promote to `public` under `recording-analysis`.
- It should not be featured on the LP unless users are actively looking for
  timestamp or recording integrity utilities.

### 4. `examples/WORKSHOP_07/`

Purpose: workshop material for Fourier / DFT.

Current state:

- `status`: `public-candidate`
- This is workshop material, not a beginner app.
- Missing a dedicated README.

Can be checked without device:

- Page opens.
- The workshop purpose is understandable.
- Links and embedded references work.

Placement decision:

- Keep in the catalog under `workshop-archive`.
- Do not feature it on the LP's main Examples section.
- Use this as the workshop slot for Fourier / DFT material.

### 7. `ws/tmu2025/`

Purpose: workshop gallery.

Current state:

- `status`: `public-candidate`
- This is a gallery of workshop works, not a single maintained example.
- Missing a dedicated README.

Can be checked without device:

- Gallery opens.
- Project links and thumbnails are intact.
- The page does not imply every project is a maintained official example.

Placement decision:

- Keep in the catalog under `workshop-archive`.
- Treat as a workshop/gallery entry, not as one maintained example app.
- Later split strong individual works into separate catalog entries if they are
  maintained.

### 8. `apps/ORPHE-TERMINAL/`

Purpose: developer utility.

Current state:

- `status`: `public-candidate`
- Developer tool rather than beginner example.
- Has a fuller README and should be positioned as a developer utility.

Can be checked without device:

- Page opens.
- Tool sections and controls are visible.
- The purpose is clear enough for a developer.

Human BLE checks:

- Connect one ORPHE CORE.
- Confirm Device Information read/write area works.
- Confirm SENSOR_VALUES stream area updates.
- Confirm download buttons still create data files.

Placement decision:

- Keep in the catalog under `developer-tool`.
- Do not place it with beginner Examples.
- Link it from a future "Tools" or "Developer utilities" section.
