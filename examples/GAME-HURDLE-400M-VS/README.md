# 400m Hurdle VS

Two-player 400m hurdle race using ORPHE CORE motion input.

## What this example shows

- Extend the virtual track concept to a longer hurdle race.
- Use two ORPHE CORE modules as player inputs.
- Compare pacing and endurance-style play against the 110m hurdle variants.

## Required devices

- 2 ORPHE CORE modules for sensor play
- Keyboard fallback may be useful for screen/layout checks, but promotion needs a two-device check.

## How to run

Open the page from a local server or GitHub Pages:

```text
examples/GAME-HURDLE-400M-VS/
```

Use a Web Bluetooth compatible browser such as Chrome. Connect both ORPHE CORE modules from the CoreToolkit UI before starting a sensor-based play test.

## Data

- Expected notify type: `SENSOR_VALUES`
- Main input: motion values converted into running / jumping controls

## Validation status

Static page/link checks only. Before public promotion, confirm two-device connection, race distance feel, running, jumping, finish/retry flow, and disconnect/reconnect behavior on Chrome.

## Related examples

- [`examples/GAME-HURDLE/`](../GAME-HURDLE/README.md) — current public flagship 110m hurdle game
- [`examples/GAME-HURDLE-VS/`](../GAME-HURDLE-VS/) — 110m hurdle VS variant
- [`examples/GAME-SPRINT-100M-VS/`](../GAME-SPRINT-100M-VS/) — sprint variant without hurdles
