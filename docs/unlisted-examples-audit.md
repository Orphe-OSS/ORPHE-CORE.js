# Unlisted examples audit

This audit covers examples and app-like assets that are not directly linked
from the lower example sections of `index.html`. The goal is to create a
promotion queue without adding unvalidated work to the landing page.

## Classification rules

- `promote-after-fix`: has clear learning, analysis, or playable value after
  small documentation or metadata fixes.
- `keep-unlisted`: useful but too specific, archival, or advanced for the LP.
- `needs-rewrite`: idea is useful but structure/UI needs a larger rewrite.
- `duplicate`: overlaps strongly with an existing listed example.
- `archive-candidate`: low public value or too stale for first-time users.
- `needs-real-device-validation`: static review is insufficient.

## Examples not directly promoted in `index.html`

| Path | Classification | Public value | Main work before promotion |
| --- | --- | --- | --- |
| `examples/CORE_TIME_SYNC/` | `promote-after-fix` + `needs-real-device-validation` | Useful utility for timestamp/time-sync workflows. | Add README, title/heading, explain device time behavior, validate with one device. |
| `examples/GAME-MARIO/` | `promote-after-fix` + `needs-real-device-validation` | Recognizable playable game using foot motion. | Resolve stale helper code references, playtest, improve README with controls. |
| `examples/GAME-PK/` | `promote-after-fix` | Playable public candidate. | Move or prune internal debug docs before LP promotion. |
| `examples/GAME-RHYTHM/` | `needs-rewrite` | Rhythm interaction idea is useful. | Uses bundled old SDK/assets; needs modernization before promotion. |
| `examples/GAME-SHOOTING/` | `promote-after-fix` + `needs-real-device-validation` | Simple shooting game, good creative example candidate. | Playtest, README/play instructions, confirm CoreToolkit flow. |
| `examples/GAME-SHOOTING2/` | `duplicate` or `promote-after-fix` | Similar to `GAME-SHOOTING`. | Decide whether it is a meaningful variant before promotion. |
| `examples/GAME-HURDLE-VS/` | `duplicate` + `needs-real-device-validation` | Multiplayer/variant of listed hurdle game. | Consolidate under the Virtual Sports family before catalog promotion. |
| `examples/GAME-HURDLE-2D-VS/` | `duplicate` | Variant of hurdle family. | Keep unlisted until family naming and README strategy is decided. |
| `examples/GAME-HURDLE-400M-VS/` | `public-candidate` + `needs-real-device-validation` | 400m hurdle variant broadens the Virtual Sports category. | README and thumbnail prepared; needs two-device playtest before public navigation. |
| `examples/GAME-HURDLE-VS-advance/` | `duplicate` | Advanced hurdle variant. | Keep unlisted; publish only if it is clearly better than the base VS version. |
| `examples/GAME-SPRINT-100M-VS/` | `public-candidate` + `needs-real-device-validation` | Sprint game variant may broaden sports examples. | README and thumbnail prepared; needs two-device playtest before public navigation. |
| `examples/WORKSHOP_07/` | `keep-unlisted` | Workshop tutorial value. | Link from docs/workshop area, not LP example cards. |
| `examples/p5.ORPHE.FSR_visualise_0327_submit/` | `needs-rewrite` | Research/visualization idea may be useful. | Rename strategy, README, determine if FSR dependency/context is still relevant. |
| `ws/tmu2025/` | `keep-unlisted` + `needs-real-device-validation` | Many student/tutorial apps could become future examples. | Curate individual apps into catalog entries before promotion. |
| `ws/tmu2022/` | `archive-candidate` | Workshop archive with old dependencies. | Do not promote until old SDK copies and zip asset policy are decided. |
| `apps/ORPHE-TERMINAL/` | `promote-after-fix` | Developer utility. | Expand README and decide if it belongs under apps/tools rather than examples. |

## Suggested small PR queue

1. `CORE_TIME_SYNC`: README + title/heading only.
2. `GAME-SHOOTING`: README/play instructions only.
3. `GAME-MARIO`: README/play instructions + stale helper audit, no logic change.
4. `apps/ORPHE-TERMINAL`: README expansion.
5. Virtual Sports family: documentation-only map of HURDLE / SPRINT variants before any rename.

## Do not promote yet

- `GAME-RHYTHM`, because it carries an old bundled SDK copy.
- `ws/tmu2022`, because it is an archive with old dependencies and zip content.
- `p5.ORPHE.FSR_visualise_0327_submit`, because the name and context need a
  product decision before user-facing promotion.

## Human review needed

- Which game variants should count toward the future "100 examples" goal?
- Which HURDLE / SPRINT variants should become separate Virtual Sports examples
  versus staying grouped under one catalog entry.
- Whether workshop archives should be searchable in `examples/index.html` or
  stay in docs only.
