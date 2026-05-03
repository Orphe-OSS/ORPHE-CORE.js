# Public Candidate Validation Queue

This document tracks examples that are valuable enough to show in the catalog
but still need human review before they should be treated as stable public
examples.

This is an internal validation document. Do not show "needs real-device
validation" as a public badge in the examples gallery.

## Current Status

- `public`: 40 entries
- `public-candidate`: 2 entries

`GAME-MARIO`, `GAME-SHOOTING2`, `GAME-PK`, `GAME-SHOOTING`, and
`CORE_TIME_SYNC` were promoted to `public` after owner real-device checks.
`WORKSHOP_07` and `ws/tmu2025` were promoted as public workshop / educational
reference entries after owner placement decisions. `GAME-SPRINT-100M-VS` and
`GAME-HURDLE-400M-VS` are tracked as hidden Virtual Sports candidates.

## Morning Check List

Open these URLs from a local server and use Chrome for BLE tests.

| Order | Entry | URL | Device | Main check | Promotion blocker |
|---|---|---|---:|---|---|
| 1 | `game-sprint-100m-vs` | `http://localhost:8767/examples/GAME-SPRINT-100M-VS/` | 2 | Two-player sprint, independent sensor input, finish/retry | Needs two-device real-device validation |
| 2 | `game-hurdle-400m-vs` | `http://localhost:8767/examples/GAME-HURDLE-400M-VS/` | 2 | Two-player 400m hurdles, running/jump input, finish/retry | Needs two-device real-device validation |

## Promotion Rules

Promote a candidate to `public` only when all relevant items are true:

- Human owner confirms the example in Chrome with the required ORPHE CORE count.
- The example title and visible UI are acceptable for public use.
- Restart/reconnect flow does not obviously break the session.
- README or page copy explains what it does, required device count, startup, and known limitations.
- `examples/catalog.json` has `needs_real_device_validation: false`.
- `validation` includes a real-device validation note or an owner placement decision for workshop / educational archives.

Do not promote workshop galleries or developer tools just because they open.
They need a navigation decision first.

## Candidate Details

### `examples/GAME-SPRINT-100M-VS/`

Purpose: two-player 100m sprint candidate for the Virtual Sports category.

Current state:

- `status`: `public-candidate`
- `public_navigation`: `hidden`
- README and thumbnail are prepared.
- Needs two-device ORPHE CORE validation.

Promotion checks:

- Keyboard fallback can start and finish a race.
- Two ORPHE CORE modules connect from CoreToolkit.
- Both players receive independent sensor input.
- Running motion advances each player at a usable speed.
- Finish / retry flow works.
- Restart keeps or cleanly resets BLE connection.

### `examples/GAME-HURDLE-400M-VS/`

Purpose: two-player 400m hurdle candidate for the Virtual Sports category.

Current state:

- `status`: `public-candidate`
- `public_navigation`: `hidden`
- README and thumbnail are prepared.
- Needs two-device ORPHE CORE validation.

Promotion checks:

- Keyboard fallback can start, jump, advance, and finish a race.
- Two ORPHE CORE modules connect from CoreToolkit.
- Both players receive independent sensor input.
- Running and jump motions are usable during the race.
- Finish / retry flow works.
- Restart keeps or cleanly resets BLE connection.

## Published Workshop References

### `examples/WORKSHOP_07/`

Purpose: YouTube ORPHE CORE WS material for Fourier / DFT / FFT.

Current state:

- `status`: `public`
- This is workshop material, not a beginner app.
- Linked from the LP workshop section.

Can be checked without device:

- Page opens.
- The workshop purpose is understandable.
- Links and embedded references work.

Placement decision:

- Keep in the catalog under `workshop-archive`.
- Do not feature it on the LP's main Examples section.
- Use this as the workshop slot for Fourier / DFT material.

### `ws/tmu2025/`

Purpose: Tokyo Metropolitan University class / workshop outcome gallery.

Current state:

- `status`: `public`
- This is a gallery of class / workshop outcomes, not a single maintained example.
- Linked from the LP workshop section.

Can be checked without device:

- Gallery opens.
- Project links and thumbnails are intact.
- The page does not imply every project is a maintained official example.

Placement decision:

- Keep in the catalog under `workshop-archive`.
- Treat as a workshop/gallery entry, not as one maintained example app.
- Later split strong individual works into separate catalog entries if they are
  maintained.
