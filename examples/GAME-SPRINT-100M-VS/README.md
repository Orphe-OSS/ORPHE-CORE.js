# 100m Sprint VS

Two-player 100m sprint race using ORPHE CORE motion input.

## What this example shows

- Use two ORPHE CORE modules as player inputs for a sprint race.
- Focus on running cadence and speed without hurdle timing.
- Provide a simpler virtual track game than the hurdle variants.

## Required devices

- 2 ORPHE CORE modules for sensor play
- Keyboard fallback may be useful for screen/layout checks, but promotion needs a two-device check.

## How to run

Open the page from a local server or GitHub Pages:

```text
examples/GAME-SPRINT-100M-VS/
```

Use a Web Bluetooth compatible browser such as Chrome. Connect both ORPHE CORE modules from the CoreToolkit UI before starting a sensor-based play test.

## Data

- Expected notify type: `SENSOR_VALUES`
- Main input: motion values converted into running controls

## Validation status

Static page/link checks only. Before public promotion, confirm two-device connection, running speed response, finish/retry flow, and disconnect/reconnect behavior on Chrome.

## Related examples

- [`examples/GAME-HURDLE/`](../GAME-HURDLE/README.md) — current public flagship hurdle game
- [`examples/GAME-HURDLE-VS/`](../GAME-HURDLE-VS/) — 110m hurdle VS variant
- [`examples/GAME-HURDLE-400M-VS/`](../GAME-HURDLE-400M-VS/) — 400m hurdle VS variant
