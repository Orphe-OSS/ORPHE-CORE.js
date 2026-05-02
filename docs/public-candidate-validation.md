# Public candidate validation queue

This document tracks examples that are valuable enough to show in the catalog
but still need human review before they should be treated as stable public
examples.

## Current status

- `public`: 35 entries
- `public-candidate`: 7 entries

`GAME-MARIO` and `GAME-SHOOTING2` were promoted to `public` after owner
real-device checks. The entries below remain candidates.

## Validation order

### 1. `examples/GAME-PK/`

Purpose: one-device penalty kick game.

What changed:

- Uses the same `bles[0]` instance as CoreToolkit.
- Does not call `begin()` again from `onConnect`; CoreToolkit owns the notify
  start.
- Uses local `ORPHE-CORE.js` and `CoreToolkit.js`.

Human checks:

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

What changed:

- Uses the same `bles[0]` instance as CoreToolkit.
- Uses `SENSOR_VALUES` because the game reads Euler and acceleration values.
- Metadata now records one ORPHE CORE device instead of two.

Human checks:

- Connect one ORPHE CORE.
- Tilt to move left/right.
- Strong motion fires a missile.
- Keyboard fallback still works.
- Restart after game over works.

Promotion condition:

- If the input and restart flow pass, decide whether this should coexist with
  `GAME-SHOOTING2` or stay as a simpler 2D variant.

### 3. `examples/GAME-FIREBALL-MARIO/`

Purpose: one-device action game with stepping, kicking, and jumping gestures.

What changed:

- Public-facing title changed from `Fireball Mario` to `Fireball Action`.
- README now explains startup, data, and validation points.

Human checks:

- Connect one ORPHE CORE.
- Confirm step, kick, and jump gestures work.
- Confirm restart/game-over flow.
- Confirm there are no remaining public-facing `Mario` labels in the UI.

Promotion condition:

- If the game works and naming is acceptable, promote to `public`.

### 4. `examples/DTW/`

Purpose: technical example for time-series matching with Dynamic Time Warping.

What changed:

- README now explains what the example teaches and how to run it.

Human checks:

- Open the page and confirm mouse input still demonstrates DTW behavior.
- Connect one ORPHE CORE.
- Confirm sensor input updates the time-series path used for matching.
- Confirm triangle/circle/square matching is understandable.

Promotion condition:

- If the technical behavior is clear, promote to `public`; otherwise keep as
  `public-candidate` and add a short on-page instruction.

### 5. `examples/WORKSHOP_07/`

Purpose: workshop material for Fourier / DFT.

Decision needed:

- Keep listed under the Examples catalog as workshop material, or move to a
  workshop/docs-only navigation path.

Suggested default:

- Keep in the catalog, but do not feature it on the LP.

### 6. `ws/tmu2025/`

Purpose: workshop gallery.

Decision needed:

- Treat as a gallery of projects, not as a single example app.

Suggested default:

- Keep in the catalog under `workshop-archive`; later split strong individual
  works into separate catalog entries if they are maintained.

### 7. `apps/ORPHE-TERMINAL/`

Purpose: developer utility.

Decision needed:

- Keep as a developer tool, separate from beginner examples.

Suggested default:

- Keep in the catalog under `developer-tool`; improve README before promoting
  it from `public-candidate` to `public`.
