# 2D Hurdle VS

Two-player 2D hurdle race using ORPHE CORE motion input.

## What this example shows

- Present a simpler 2D version of the virtual track race concept.
- Use two ORPHE CORE modules as competitive player inputs.
- Compare whether a lightweight 2D game is easier to use in workshops than the 3D variants.

## Required devices

- 2 ORPHE CORE modules for sensor play
- Keyboard fallback may be useful for screen/layout checks, but promotion needs a two-device check.

## How to run

Open the page from a local server or GitHub Pages:

```text
examples/GAME-HURDLE-2D-VS/
```

Use a Web Bluetooth compatible browser such as Chrome. Connect both ORPHE CORE modules from the CoreToolkit UI before starting a sensor-based play test.

## Data

- Expected notify type: `SENSOR_VALUES`
- Main input: motion values converted into running / jumping controls

## Publication notes

The public title and in-page copy should avoid third-party sports game names before this page is promoted. Use a generic name such as "2D Hurdle VS" or "2D Track Hurdles".

## Validation status

Static page/link checks only. Before public promotion, confirm two-device connection, running, jumping, finish/retry flow, and disconnect/reconnect behavior on Chrome.

## Related examples

- [`examples/GAME-HURDLE/`](../GAME-HURDLE/README.md) — current public flagship 110m hurdle game
- [`examples/GAME-HURDLE-VS/`](../GAME-HURDLE-VS/) — 3D 110m hurdle VS variant
