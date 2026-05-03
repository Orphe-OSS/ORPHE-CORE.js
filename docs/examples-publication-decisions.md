# Examples Publication Decisions

This document records publication decisions that are not purely mechanical.
It is for humans, Codex, and Claude when deciding what should appear as a
maintained public example, what should be a workshop/tool entry, and what
should stay archived.

Static quality is currently passing. The remaining work is validation and
positioning.

## Current Queue

| Group | Entries | Decision |
|---|---|---|
| Playable public examples | `GAME-PK`, `GAME-SHOOTING` | Promoted to public after owner real-device checks. |
| Utility public example | `CORE_TIME_SYNC` | Keep hidden from the beginner gallery; use as a developer / recording utility. |
| Workshop entries | `WORKSHOP_07`, `ws/tmu2025` | Keep under `workshop-archive`; do not feature in the beginner Examples section. |
| Developer tool | `apps/ORPHE-TERMINAL` | Keep under `developer-tool`; link from future Tools / Developer Utilities navigation. |

## Candidate Decisions

### `examples/GAME-PK/`

Decision: promoted to `public`.

Why:

- Clear gameplay value: kick motion maps to a penalty kick.
- Already uses CoreToolkit and one ORPHE CORE.
- Owner validation passed for one-device connection, kick detection, scoring, and restart behavior.

Maintenance condition:

- Restart does not break connection or scoring.
- README remains accurate after validation.

### `examples/GAME-SHOOTING/`

Decision: promoted to `public`.

Why:

- Good simple 2D shooting example using tilt/acceleration.
- It can coexist with `GAME-SHOOTING2` if positioned as the simpler 2D version.
- Owner validation passed for tilt movement, firing, keyboard controls, Game Over restart, and restart without BLE disconnect.

Maintenance condition:

- Decide title/copy as "2D Shooting" if `GAME-SHOOTING2` remains public as the 3D variant.


### `examples/CORE_TIME_SYNC/`

Decision: promoted to hidden `public`.

Why:

- Useful for recording integrity and timestamp debugging.
- Not a beginner example and should not be featured in the main gallery yet.
- Owner validation passed for `SENSOR_VALUES`, `getDateTime()`, and `syncCoreTime()`.

Placement condition:

- Keep it under developer / recording utilities.
- Do not feature it in the beginner Examples gallery.

### `examples/WORKSHOP_07/`

Decision: keep as workshop material.

Why:

- It has educational value, but it is a workshop asset rather than a first-run app.
- It should live under `workshop-archive`, not the beginner Examples section.

Promotion condition:

- Page opens and links are intact.
- Workshop purpose is clear.
- Optional: add a workshop index page later.

### `ws/tmu2025/`

Decision: keep as workshop gallery.

Why:

- The page is meaningful as a collection of student works.
- It should not imply every linked work is a maintained official example.
- Strong individual works can later become separate catalog entries.

Promotion condition:

- Gallery and links are intact.
- A future curation pass selects individual works for maintained examples.

### `apps/ORPHE-TERMINAL/`

Decision: keep as developer tool.

Why:

- It is useful, but it is not a learning example for beginners.
- It belongs under `developer-tool` and future Tools / Developer Utilities navigation.

Promotion condition:

- One-device Chrome test confirms connection and basic data read/write.
- Tool copy explains the intended developer workflow.

## Needs-Review Decisions

| Entry | Decision | Reason | Next action |
|---|---|---|---|
| `examples/GAME-RHYTHM/` | rewrite | Potentially valuable rhythm game, but it carries an old local SDK copy and needs modernization. | Keep unlisted; rewrite as a maintained rhythm example later. |
| `examples/ICC2022Sep/` | archive | Historical event/demo artifact with large vendored dependencies. | Keep as archive unless a modern creative example is extracted. |
| `examples/p5.ORPHE.FSR_visualise_0327_submit/` | domain review | May be FSR / ORPHE INSOLE specific rather than general ORPHE CORE.js. | Keep unlisted until product scope is decided. |
| `ws/tmu2022/` | archive | Old workshop archive with zip content and older demo conventions. | Keep unlisted; clean archive metadata only if needed. |

## Claude Tier 1 PR Intake

Claude's new Tier 1 work should enter the catalog only after helper API review.

| PR | Entry | Current intake decision |
|---|---|---|
| `#79` | `js/CoreAnalytics.js` | Review API naming and gait step semantics before examples depend on it. |
| `#81` | `js/CoreRecorder.js` | Review JSON/CSV schema and replay semantics before examples depend on it. |
| `#82` | `CSV-RECORDER` | Good target for `recording-analysis`; wait for `CoreRecorder.js` review and real-device check. |
| `#83` | `STEP-COUNT-DASHBOARD` | Good target for `gait-analysis`; wait for `CoreAnalytics.js` review and real-device check. |
| `#84` | `REPLAY-PLAYER` | Good target for `recording-analysis`; can be reviewed without hardware because it ships sample data. |

Catalog policy:

- Claude PR READMEs may propose metadata.
- Codex should reconcile `examples/catalog.json` after helper PRs are accepted.
- Do not mark new examples `public` until they have browser validation and, where needed, ORPHE CORE validation.
