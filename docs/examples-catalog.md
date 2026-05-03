# ORPHE-CORE.js Example Catalog Draft

This document defines how ORPHE-CORE.js examples should be counted, reviewed, and prepared for a future "100 examples" experience.

The key rule is:

> Count a learnable unit as one example, not just one directory.

That means browser apps, starter templates, getting-started guides, workshop apps, and small code recipes can all count as examples when they teach a distinct concept.

## Goals

- Help beginners understand what ORPHE CORE is, what 6-axis IMU data means, and how to build with it.
- Make ORPHE CORE's edge-side Gait Analysis advantage visible through practical examples.
- Separate public examples from internal tests, broken experiments, duplicates, and candidates that need review.
- Give humans and AI agents a shared source of truth before adding new examples.

## Machine-Readable Catalog

The draft data lives in [`examples/catalog.json`](../examples/catalog.json).

Each catalog entry uses these core fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable identifier |
| `title` | Display title |
| `path` | Demo, guide, template, or internal page path |
| `type` | `web-app`, `starter-template`, `guide`, `workshop`, `internal-test` |
| `status` | `public`, `public-candidate`, `needs-fix`, `needs-review`, `internal`, `overlap` |
| `audience` | Beginner, researcher, game player, creative coder, maintainer, etc. |
| `value` | Why this example should exist |
| `topics` | Search/filter tags |
| `data` | ORPHE-CORE.js callbacks or data concepts used |
| `devices` | Expected ORPHE CORE count |
| `validation` | Current validation state |
| `issues` | Known issues |
| `next_actions` | Next work items |

The catalog also carries display-oriented fields so the landing page, examples gallery, and validation scripts can consume the same data without guessing:

| Field | Meaning |
| --- | --- |
| `category` | Primary gallery category: `getting-started`, `sensor-basics`, `gait-analysis`, `recording-analysis`, `playable-app`, `creative-coding`, `research-integration`, `workshop-archive`, `developer-tool`, or `internal-test`. |
| `difficulty` | Beginner-facing level: `beginner`, `intermediate`, or `advanced`. This is about onboarding cost, not code quality. |
| `featured` | Boolean shortcut for entries that should appear in the first public gallery row. |
| `thumbnail` | Existing preview image path, or `null` when a thumbnail still needs to be prepared. |
| `sort_order` | Stable display order for public navigation. Required for `featured` entries. |
| `links` | Structured entry points such as `demo` and `source`. |
| `requires_device` | Whether the entry needs ORPHE CORE or a compatible BLE device to be meaningful. |
| `device_count` | Expected number of ORPHE CORE modules. This mirrors `devices` for display code. |
| `needs_real_device_validation` | Whether physical ORPHE CORE verification is still needed. |
| `public_navigation` | `featured`, `listed`, or `hidden`. This separates public value from first-screen priority. |

Use `thumbnail: null` instead of omitting the field. Missing thumbnails are an explicit production task, not an accidental absence.

## Status Definitions

| Status | Meaning |
| --- | --- |
| `public` | Worth keeping in public navigation. Device verification can still be tracked separately. |
| `public-candidate` | Valuable, but needs copy, thumbnail, validation, or small cleanup before promotion. |
| `needs-fix` | Has a concrete broken path, stale dependency, or behavior issue. |
| `needs-review` | Likely valuable, but purpose, audience, or device behavior needs review. |
| `internal` | QA or maintenance tool. Not counted as a public example. |
| `overlap` | Useful as part of a family, but confusing if presented as a separate top-level example. |

`status` and `public_navigation` are intentionally separate. An entry can be `public-candidate` and still be `listed` when it is useful to show, while `needs-review` entries should normally stay `hidden` until a human confirms the purpose and device behavior.

## Current Broad Count

> Note: the broad count below is a planning snapshot. The current machine-readable status counts are maintained in `examples/catalog.json`.

As of 2026-05-01 after the example cleanup PRs:

| Bucket | Count | Public count? |
| --- | ---: | --- |
| `examples/` web apps | 35 | Mostly yes |
| `starter-templates/` | 9 | Yes |
| Getting-started guides | 5 | Yes |
| Tutorial pages | 2 | Needs review |
| Workshop HTML apps | 21 | After review |
| `apps/ORPHE-TERMINAL` | 1 | Needs review |
| Root demo HTML | 2 | Needs review |
| Extra example test/demo HTML | 4 | Mostly no |
| Modifiable sketches/modules | 38 | As recipes |
| `tests/bridge` internal pages | 6 | No |
| AI/sensor recipe docs | 5 | Needs review |

Broad learning/example units: **128**.

This is enough raw material for "100 examples", but it is not yet organized enough to present that claim publicly.

## Coverage Model

ORPHE-CORE.js should eventually teach four layers:

| Layer | What it teaches | Current state |
| --- | --- | --- |
| Sensor Basics | acc, gyro, euler, quat, range, filters, BLE frequency | Starter templates exist, but concept examples are thin. |
| ORPHE Gait Analysis | steps, direction, distance, stride, footAngle, pronation, landingImpact | APIs and examples exist, but not as a clear learning path. |
| Recording / Analysis | CSV, calibration, replay, left-right comparison | `SENSOR-CALIBRATION` exists, but needs clearer positioning. |
| Playable Apps | games, sound, visuals, creative coding | Many examples exist, but sensor concepts are not always explained. |

## Public Examples To Keep

These already have public value and should stay in the catalog:

- `examples/INFORMATION/`
- `examples/LIGHT/`
- `examples/CORETOOLKIT-STARTER/`
- `examples/VIEW/`
- `examples/VISUALIZE/`
- `examples/FOOT ANGLE/`
- `examples/PRONATION/`
- `examples/AIRWALKER/`
- `examples/POSE/`
- `examples/OH1/`
- `examples/SENSOR-CALIBRATION/`
- `examples/GESTURE-DEMO/`
- `examples/GAME-HURDLE/`
- `examples/GAME-UDON/`
- `examples/MOVEYOURFEET/`
- `examples/GAME-PINGPONG/`
- `examples/drum_test/`
- `examples/GAME-BOXING/`
- `examples/GAME-DDR/`
- all `starter-templates/*.html`
- all `docs/getting-started-*.html`

These entries are validated and public in the catalog, but should stay outside
the beginner-facing gallery:

- `examples/CORE_TIME_SYNC/`: developer / recording utility for DateTime and time-sync checks.
- `apps/ORPHE-TERMINAL/`: developer terminal for Device Information, Date Time, and raw streaming data.

## Public Candidates

These should not be hidden, but need explanation, thumbnail work, validation, or positioning before being promoted:

- `examples/WORKSHOP_07/`
- `ws/tmu2025/`

## Needs Review

These may be valuable, but need human or device review before promotion:

- `examples/GAME-RHYTHM/`: contains an old local ORPHE-CORE.js copy.
- `examples/ICC2022Sep/`: useful pose integration, but dependency size and purpose need clarification.
- `examples/p5.ORPHE.FSR_visualise_0327_submit/`: may be ORPHE INSOLE/FSR-specific rather than general ORPHE CORE.js.
- `tutorial/`: old tutorial structure needs review.
- `ws/`: workshop archives are useful but should be presented separately from main examples.
- `apps/ORPHE-TERMINAL/`: likely valuable as an app example, but not a beginner example.

## Needs Fix

Concrete issues found by static path checks:

| Path | Issue | Suggested fix |
| --- | --- | --- |
| `examples/GAME-MARIO/test.html` | `../js/ORPHE-CORE.js` points to a non-existing path from this directory. | Use `../../js/ORPHE-CORE.js` or CDN. |
| `examples/GAME-PINGPONG/test.html` | `../js/ORPHE-CORE.js` points to a non-existing path from this directory. | Use `../../js/ORPHE-CORE.js` or CDN. |
| `examples/GAME-SHOOTING/test.html` | `../js/ORPHE-CORE.js` points to a non-existing path from this directory. | Use `../../js/ORPHE-CORE.js` or CDN. |

## Overlap Families

These should be grouped in the catalog instead of being presented as unrelated examples:

| Family | Members | Recommendation |
| --- | --- | --- |
| Running games | `GAME-HURDLE`, `GAME-HURDLE-VS`, `GAME-HURDLE-VS-advance`, `GAME-HURDLE-2D-VS`, `GAME-HURDLE-400M-VS`, `GAME-SPRINT-100M-VS` | Keep one LP representative, list the rest under a Running Games family. |
| Shooting games | `GAME-SHOOTING`, `GAME-SHOOTING2` | Clarify 2D/3D or old/new relationship. |
| Action games | `GAME-MARIO`, `GAME-PK` | Keep if input mappings are documented. |
| Sensor viewers | `VIEW`, `VISUALIZE`, `CORE_TIME_SYNC`, starter templates | Separate beginner, debugging, and research uses. |
| Workshop archives | `ws/tmu2022`, `ws/tmu2025`, `WORKSHOP_07` | Keep as workshop/archive material, not first-run examples. |

## Internal

Do not count these as public examples:

- `tests/bridge/index.html`
- `tests/bridge/unit-test.html`
- `tests/bridge/integration-test.html`
- `tests/bridge/physical-range-test.html`
- `tests/bridge/physical-reconnect-test.html`
- `tests/bridge/test-frame.html`

## Missing Example Areas

Do not add these yet. They should be added after the existing catalog is cleaned up and validated.

### Sensor Basics

- acceleration magnitude
- accelerometer range comparison: 2G / 4G / 8G / 16G
- gyro turn rate
- Euler vs Quaternion
- reset orientation
- low-pass / moving-average filter
- BLE frequency and packet-drop monitor

### ORPHE Gait Analysis

- gait dashboard
- stride visualizer
- pronation monitor
- landing-impact monitor
- left-right gait balance
- gait CSV recorder
- gait replay

### Playable Apps

- tilt maze
- landing challenge
- stride runner
- pronation balance game
- gait direction puzzle
- two-foot rhythm battle

## Recommended Next PRs

1. Keep this catalog draft and `examples/catalog.json` as the shared planning base.
2. Fix the three broken `test.html` paths in a separate small PR.
3. Add a public examples gallery backed by `examples/catalog.json`.
4. Promote public candidates in batches of 3-5 examples.
5. Extract recipe pages from existing `sketch.js` / `main.js` files.
6. Add missing Sensor Basics and Gait Analysis examples only after the existing catalog is stable.
