# 110m Hurdle VS

Two-player 110m hurdle race using ORPHE CORE motion input.

## What this example shows

- Use two ORPHE CORE modules as player inputs.
- Compare left/right or player 1/player 2 gait-style movement in a race format.
- Build a competitive game around running and jumping motions.

## Required devices

- 2 ORPHE CORE modules for sensor play
- Keyboard fallback may be useful for screen/layout checks, but promotion needs a two-device check.

## How to run

Open the page from a local server or GitHub Pages:

```text
examples/GAME-HURDLE-VS/
```

Use a Web Bluetooth compatible browser such as Chrome. Connect both ORPHE CORE modules from the CoreToolkit UI before starting a sensor-based play test.

## Data

- Expected notify type: `SENSOR_VALUES`
- Main input: motion values converted into running / jumping controls

## Validation status

Static page/link checks only. Before public promotion, confirm two-device connection, start/restart flow, running, jumping, finish, and disconnect/reconnect behavior on Chrome.

## Related examples

- [`examples/GAME-HURDLE/`](../GAME-HURDLE/README.md) — current public flagship 110m hurdle game
- [`examples/GAME-HURDLE-400M-VS/`](../GAME-HURDLE-400M-VS/) — 400m hurdle variant
- [`examples/GAME-SPRINT-100M-VS/`](../GAME-SPRINT-100M-VS/) — sprint variant without hurdles
