# Advanced Hurdle VS

Advanced two-player hurdle race prototype using ORPHE CORE motion input.

## What this example shows

- Explore a more elaborate version of the two-player hurdle race concept.
- Use two ORPHE CORE modules as player inputs.
- Compare whether this version adds enough value over `GAME-HURDLE-VS` to keep both pages public.

## Required devices

- 2 ORPHE CORE modules for sensor play
- Keyboard fallback may be useful for screen/layout checks, but promotion needs a two-device check.

## How to run

Open the page from a local server or GitHub Pages:

```text
examples/GAME-HURDLE-VS-advance/
```

Use a Web Bluetooth compatible browser such as Chrome. Connect both ORPHE CORE modules from the CoreToolkit UI before starting a sensor-based play test.

## Data

- Expected notify type: `SENSOR_VALUES`
- Main input: motion values converted into running / jumping controls

## Publication notes

This page should stay unlisted unless it has a clear difference from `GAME-HURDLE-VS`. If the gameplay is effectively the same, keep one maintained VS hurdle page and archive or merge this variant.

## Validation status

Static page/link checks only. Before public promotion, confirm two-device connection, gameplay difference from `GAME-HURDLE-VS`, finish/retry flow, and disconnect/reconnect behavior on Chrome.

## Related examples

- [`examples/GAME-HURDLE-VS/`](../GAME-HURDLE-VS/) — baseline 110m hurdle VS variant
- [`examples/GAME-HURDLE/`](../GAME-HURDLE/README.md) — current public flagship 110m hurdle game
