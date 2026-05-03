# Virtual Track Games Audit

ORPHE-CORE.js has enough running / hurdle material to support a distinct
"Virtual Track" category. The repository should treat these as a meaningful
sports-game family rather than one-off duplicates.

This audit is static. It checks files, titles, dependencies, and the apparent
game concept. It does not claim real-device validation.

## Family Summary

| Path | Proposed public name | Concept | Devices | Current publication decision |
|---|---|---|---:|---|
| `examples/GAME-HURDLE/` | 110m Hurdles | Single-player 3D 110m hurdle race. | 2 | Already public; should be the flagship virtual track example. |
| `examples/GAME-HURDLE-VS/` | 110m Hurdles VS | Two-player 3D 110m hurdle race. | 2 | Prepare as public-candidate after README, thumbnail, and real-device check. |
| `examples/GAME-HURDLE-2D-VS/` | 2D 110m Hurdles VS | Two-player 2D 110m hurdle race. | 2 | Prepare only after naming/copy cleanup; current "Hyper Olympic" wording should be removed before public listing. |
| `examples/GAME-HURDLE-400M-VS/` | 400m Hurdles VS | Two-player 3D 400m hurdle race. | 2 | Prepare as public-candidate; distinct course length makes it meaningful. |
| `examples/GAME-HURDLE-VS-advance/` | 110m Hurdles VS Advanced | Two-player 3D 110m hurdle race with richer effects/audio. | 2 | Keep as advanced variant; publish only if it is meaningfully better than `GAME-HURDLE-VS`. |
| `examples/GAME-SPRINT-100M-VS/` | 100m Sprint VS | Two-player 100m sprint without hurdles. | 2 | Prepare as public-candidate; distinct from hurdles and useful for sports category breadth. |

## Static Findings

All six pages:

- Have an `index.html`.
- Load `CoreToolkit.js`.
- Include `BleSharedBridge.js`.
- Call `guardCoreToolkitBluetooth({ coreIds: [0, 1], ... })`.
- Use two ORPHE CORE devices for sensor play.

Current differences:

- `GAME-HURDLE/` already uses local `../../js/ORPHE-CORE.js`.
- The five VS / sprint variants still load `ORPHE-CORE.js` from the public CDN.
- The five VS / sprint variants have no README.
- Each variant has an empty `claud` file that should not be treated as public documentation.

## Recommended Preparation PRs

### PR 1: Localize SDK script references

Change the five unlisted variants from the public CDN to local
`../../js/ORPHE-CORE.js`, matching `GAME-HURDLE/` and the already-cleaned
public games.

Targets:

- `GAME-HURDLE-VS`
- `GAME-HURDLE-2D-VS`
- `GAME-HURDLE-400M-VS`
- `GAME-HURDLE-VS-advance`
- `GAME-SPRINT-100M-VS`

### PR 2: Add README files for each variant

Each README should state:

- What is different from `GAME-HURDLE/`.
- Required ORPHE CORE count.
- Keyboard fallback controls.
- Real-device validation checklist.
- Whether it is intended for public gallery or family sub-navigation.

### PR 3: Catalog family design

Do not add all variants to the LP immediately. Instead:

- Keep `GAME-HURDLE/` as the flagship public card.
- Add a "Virtual Track" category or family page later.
- Promote `GAME-SPRINT-100M-VS` and `GAME-HURDLE-400M-VS` first because they
  clearly add new race formats.
- Promote either `GAME-HURDLE-VS` or `GAME-HURDLE-VS-advance`, not both, unless
  real-device playtesting shows a clear reason to keep both.
- Keep `GAME-HURDLE-2D-VS` as a candidate only after naming cleanup.

## Human Validation Checklist

For each candidate:

1. Open in Chrome from a local server.
2. Confirm the keyboard fallback starts and can finish a race.
3. Connect two ORPHE CORE modules.
4. Confirm both players receive independent sensor input.
5. Confirm restart keeps or cleanly resets BLE connection.
6. Confirm the game is visually understandable without reading code.
7. Capture a thumbnail only after the public name and UI are acceptable.

## Publication Position

Virtual track should be a visible strength of ORPHE-CORE.js, but it should be
presented as a family:

- Main LP: one or two best examples, not every variant.
- Examples gallery: searchable `playable-app` entries.
- Future category page: all track variants with differences clearly explained.
