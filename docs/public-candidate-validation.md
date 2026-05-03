# Public Candidate Validation Queue

This document tracks examples that are valuable enough to show in the catalog
but still need human review before they should be treated as stable public
examples.

This is an internal validation document. Do not show "needs real-device
validation" as a public badge in the examples gallery.

## Current Status

- `public`: 38 entries
- `public-candidate`: 3 entries

`GAME-MARIO`, `GAME-SHOOTING2`, `GAME-PK`, `GAME-SHOOTING`, and `CORE_TIME_SYNC` were promoted to `public` after owner
real-device checks. The entries below remain candidates.

## Morning Check List

Open these URLs from a local server and use Chrome for BLE tests.

| Order | Entry | URL | Device | Main check | Promotion blocker |
|---|---|---|---:|---|---|
| 1 | `workshop-07` | `http://localhost:8767/examples/WORKSHOP_07/` | 1 | Page opens and workshop value is clear | Keep in workshop category; do not feature on LP yet |
| 2 | `ws-tmu2025` | `http://localhost:8767/ws/tmu2025/` | varies | Gallery opens and links work | Keep as workshop gallery; split strong works later |
| 3 | `app-orphe-terminal` | `http://localhost:8767/apps/ORPHE-TERMINAL/` | 1 | Developer tool opens and can connect | Keep under developer tools, not beginner examples |

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





### 1. `examples/WORKSHOP_07/`

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

### 2. `ws/tmu2025/`

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

### 3. `apps/ORPHE-TERMINAL/`

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
