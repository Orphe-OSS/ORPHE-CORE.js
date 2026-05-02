# CoreToolkit PoC plan

## Selected PoC

`examples/VISUALIZE/`

## Why this example

`VISUALIZE` is the safest CoreToolkit PoC among the current index-linked
candidates.

- It uses a single notify type: `SENSOR_VALUES`.
- The UI is mainly charts, so connection UI can be added without redesigning
  game rules.
- It already has separate panels for device 01 and device 02.
- A user can validate one device first, then optionally connect a second.
- The implementation pattern should transfer to `VIEW` if the PoC works.

`VIEW` is also a good candidate, but it has selectable notify types and reset
attitude buttons. That makes it a better second migration after the chart-only
pattern is proven.

## Current state

- `examples/VISUALIZE/index.html` loads `ORPHE-CORE.js` and creates custom
  checkbox connection controls.
- `examples/VISUALIZE/sketch.js` creates `bles = [new Orphe(0), new Orphe(1)]`.
- Both columns call `bles[id].begin(kind)` through `toggleConnect(...)`.
- Notify type is fixed to `SENSOR_VALUES` in the UI.
- The charts are updated through sensor callbacks.

## Proposed UI design

- Add `CoreToolkit.js` to `index.html`.
- Add two placeholders above the chart columns:
  - `#toolkit_placeholder1`
  - `#toolkit_placeholder2`
- Build CoreToolkit with:

```js
buildCoreToolkit(document.querySelector('#toolkit_placeholder1'), '01', 0, 'SENSOR_VALUES');
buildCoreToolkit(document.querySelector('#toolkit_placeholder2'), '02', 1, 'SENSOR_VALUES');
```

- Remove or hide the existing checkbox/select connection widgets only after the
  CoreToolkit path is proven.
- Keep the chart canvas IDs and sensor callbacks unchanged.

## Implementation steps

1. Create a branch such as `codex/coretoolkit-poc-visualize`.
2. Add `../../js/CoreToolkit.js` after `ORPHE-CORE.js` in
   `examples/VISUALIZE/index.html`.
3. Add CoreToolkit placeholder containers to the top of each device column.
4. In `sketch.js`, replace manual connection UI wiring with
   `buildCoreToolkit(...)` calls.
5. Preserve all chart update callbacks.
6. Do not change threshold, data scaling, chart labels, or chart window logic.
7. Update `examples/VISUALIZE/README.md` with:
   - one or two ORPHE CORE modules supported
   - default notify type `SENSOR_VALUES`
   - CoreToolkit connection instructions
   - real-device validation status

## Risks

- CoreToolkit creates/owns global `bles`; current code creates its own `bles`.
  The PoC must avoid duplicate ORPHE instances.
- Chart callbacks must attach to the same ORPHE instances that CoreToolkit
  connects.
- If the old checkbox UI remains active, it may conflict with CoreToolkit.
- Two-device layout should still work when only device 01 is connected.

## Real-device validation checklist

- Open `examples/VISUALIZE/`.
- Connect only device 01 with CoreToolkit.
- Confirm Acc/Gyro/Quat/Euler charts update for the left column.
- Disconnect and reconnect device 01.
- Connect device 02.
- Confirm right-column charts update independently.
- Confirm no duplicate Bluetooth prompts appear for the same action.
- Confirm browser console has no repeated ReferenceError or GATT errors.

## Rollback

The PoC should be one PR touching only:

- `examples/VISUALIZE/index.html`
- `examples/VISUALIZE/sketch.js`
- `examples/VISUALIZE/README.md`

If validation fails, revert that PR without affecting other examples.

## Follow-up if successful

The next candidate should be `examples/VIEW/`, using the same CoreToolkit
ownership pattern but preserving:

- selectable `STEP_ANALYSIS` / `SENSOR_VALUES`
- reset attitude controls
- two-device table layout

