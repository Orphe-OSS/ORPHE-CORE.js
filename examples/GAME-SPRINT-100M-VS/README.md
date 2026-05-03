# 100m Sprint VS

Two-player 100m sprint race using ORPHE CORE motion input.

## What It Does

- Turns rapid foot motion into a 100m sprint race.
- Uses two ORPHE CORE modules, one for each player.
- Provides a simpler Virtual Sports candidate than the hurdle variants because there are no jumps.

## Required Devices

- 2 ORPHE CORE modules for sensor play.
- Keyboard fallback can be used for layout checks, but public promotion requires a two-device ORPHE CORE check.

## Controls

- Player 1 keyboard fallback: alternate left / right arrow keys rapidly.
- Player 2 keyboard fallback: alternate `W` / `E` rapidly.
- Sensor play: connect both ORPHE CORE modules from the CoreToolkit UI, then start the race.

## Data

- Notify type: `STEP_ANALYSIS_AND_SENSOR_VALUES`
- Main input: motion values converted into running controls.

## Run

Open the page from a local server or GitHub Pages in Chrome.

```text
http://localhost:8767/examples/GAME-SPRINT-100M-VS/
```

## Publication Status

`public-candidate` for the Virtual Sports category.

Do not list this in public navigation until human real-device validation passes.

## Human Validation Checklist

- Page opens in Chrome.
- Keyboard fallback starts, advances both players, and can finish a race.
- Two ORPHE CORE modules connect from the CoreToolkit UI.
- Both players receive independent sensor input.
- Running motion advances each player at a usable speed.
- Finish / retry flow works.
- Restart keeps or cleanly resets the BLE connection.

## Related Examples

- [`examples/GAME-HURDLE/`](../GAME-HURDLE/README.md) — current public flagship Virtual Sports example.
- [`examples/GAME-HURDLE-400M-VS/`](../GAME-HURDLE-400M-VS/) — 400m hurdle VS candidate.
- [`examples/GAME-HURDLE-VS/`](../GAME-HURDLE-VS/) — 110m hurdle VS variant.
