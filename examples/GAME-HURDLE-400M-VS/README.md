# 400m Hurdles VS

Two-player 400m hurdle race using ORPHE CORE motion input.

## What It Does

- Extends the Virtual Sports concept to a longer 400m hurdle race.
- Uses two ORPHE CORE modules, one for each player.
- Adds pacing, stamina, and jump timing compared with the 100m sprint candidate.

## Required Devices

- 2 ORPHE CORE modules for sensor play.
- Keyboard fallback can be used for layout checks, but public promotion requires a two-device ORPHE CORE check.

## Controls

- Player 1 keyboard fallback: up arrow to jump, right arrow to accelerate.
- Player 2 keyboard fallback: `W` to jump, `D` to accelerate.
- Sensor play: connect both ORPHE CORE modules from the CoreToolkit UI, then start the race.

## Data

- Notify type: `STEP_ANALYSIS_AND_SENSOR_VALUES`
- Main input: motion values converted into running and jumping controls.

## Run

Open the page from a local server or GitHub Pages in Chrome.

```text
http://localhost:8767/examples/GAME-HURDLE-400M-VS/
```

## Publication Status

`public-candidate` for the Virtual Sports category.

Do not list this in public navigation until human real-device validation passes.

## Human Validation Checklist

- Page opens in Chrome.
- Keyboard fallback starts, advances both players, jumps, and can finish a race.
- Two ORPHE CORE modules connect from the CoreToolkit UI.
- Both players receive independent sensor input.
- Running and jump motions are usable during the race.
- Finish / retry flow works.
- Restart keeps or cleanly resets the BLE connection.

## Related Examples

- [`examples/GAME-HURDLE/`](../GAME-HURDLE/README.md) — current public flagship Virtual Sports example.
- [`examples/GAME-SPRINT-100M-VS/`](../GAME-SPRINT-100M-VS/) — 100m sprint VS candidate.
- [`examples/GAME-HURDLE-VS/`](../GAME-HURDLE-VS/) — 110m hurdle VS variant.
