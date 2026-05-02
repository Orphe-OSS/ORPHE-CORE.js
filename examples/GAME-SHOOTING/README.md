# ORPHE CORE Shooting Game

`GAME-SHOOTING` is a simple p5.js shooting game controlled by ORPHE CORE
motion. Tilt moves the player, and a strong motion fires missiles.

## What this example shows

- Use ORPHE CORE as a game controller.
- Move the player with roll / tilt.
- Fire missiles from acceleration changes.
- Keep keyboard fallback controls for development.

## Required devices

- 1 ORPHE CORE

## How to run

Open the demo from a local server or GitHub Pages:

```text
examples/GAME-SHOOTING/
```

Use a Web Bluetooth compatible browser such as Chrome. Connect ORPHE CORE from
the CoreToolkit UI, then play the game canvas.

## Controls

- ORPHE CORE roll: move left/right
- Strong motion: fire missile
- Keyboard fallback: left/right arrow keys and `m`
- Space: restart after game over

## Data

- Notify type in the page: `STEP_ANALYSIS_AND_SENSOR_VALUES`
- Main callbacks: Euler, acceleration

## Known implementation notes

- `index.html` initializes CoreToolkit, while `sketch.js` also creates an
  ORPHE instance. This should be reviewed before promoting the example to the
  landing page.
- `scripts.js` appears to be legacy helper code and still contains old
  `ANALYSIS` wording. Confirm whether it is loaded before deleting or editing.
- Relationship with `GAME-SHOOTING2` is still unclear.

## Validation status

Static page/link checks only. BLE connection, CoreToolkit ownership, and game
controls need real-device validation before promotion.
