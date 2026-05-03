# In-flight Work

Last updated: 2026-05-03 (Claude Tier 1 reconstruction sprint)

This file is a lightweight coordination board for humans, Codex, and Claude. It is not a changelog. Keep it short and update it before starting or ending a multi-file task.

## Rules

- Read `docs/agents.md` before starting agent work.
- Do not push directly to `main`.
- One PR should have one purpose.
- Update this file before starting work and before ending a session.
- If a row is older than 24 hours and has no active PR, treat it as stale.
- Do not edit files claimed by another active row unless explicitly coordinated.
- If a task needs real-device validation, mark it clearly.

## Active Work

| Agent | Branch | Purpose | Files / Areas | Status | Last Update | Notes |
|---|---|---|---|---|---|---|
| Codex | codex/examples-static-quality-audit | Static quality audit and safe checks for existing examples | `scripts/check-examples-static-quality.js`, `docs/examples-static-quality-audit.md`, `docs/in-flight.md` | merged | 2026-05-03 00:05 JST | No real-device claims. Focus on public/public-candidate example quality, links, thumbnails, titles, CoreToolkit bridge, and catalog consistency. |
| Claude | claude/research-imu-competitors-yWYtf | IMU competitor research and lesson concept | `docs/ai/` research docs | reference | 2026-05-02 23:35 JST | Research should inform roadmap, not directly edit core SDK. |
| Claude | claude/lessons-tier1-draft | Tier 1 lesson plans (45-min class drafts) | `docs/lessons/*` | active | 2026-05-03 JST | 6 lessons: Step Count Dashboard / Stride & Cadence / L/R Symmetry / CSV Recorder / Replay Player / Vertical Jump (CMJ). No core SDK or catalog edits. |
| Claude | claude/core-analytics-api-draft | `CoreAnalytics.js` API draft (session summary, baseline, symmetry, CMJ) | `js/CoreAnalytics.js` | planned | 2026-05-03 JST | New file only, opt-in feed* methods over existing callbacks. Codex review needed before any example consumes it as stable. |
| Claude | claude/core-recorder-api-draft | `CoreRecorder.js` API draft (CSV/JSON schema 0.0.1-draft, fromJSON roundtrip) | `js/CoreRecorder.js` | planned | 2026-05-03 JST | New file only. Does not modify `examples/SENSOR-CALIBRATION/recorder.js`. Codex review needed for schema. |
| Claude | claude/example-csv-recorder-poc | New `examples/CSV-RECORDER/` PoC (depends on `CoreRecorder.js` PR) | `examples/CSV-RECORDER/*` | planned | 2026-05-03 JST | Uses CoreToolkit; calls `guardCoreToolkitBluetooth({ coreIds: [0] })`. Catalog metadata proposed in README, not edited in `examples/catalog.json`. |
| Claude | claude/example-step-count-dashboard-poc | New `examples/STEP-COUNT-DASHBOARD/` PoC (depends on `CoreAnalytics.js` PR) | `examples/STEP-COUNT-DASHBOARD/*` | planned | 2026-05-03 JST | Uses CoreToolkit; calls `guardCoreToolkitBluetooth({ coreIds: [0] })`. Includes baseline-comparison panel. |
| Claude | claude/example-replay-player-poc | New `examples/REPLAY-PLAYER/` PoC (depends on `CoreRecorder.js` PR) | `examples/REPLAY-PLAYER/*` | planned | 2026-05-03 JST | Ships synthetic `sample-session.js` so the page boots without hardware. Uses CoreToolkit only as an optional live-feed path. |
| Claude | claude/handoff-2026-05-03 | Session handoff doc | `docs/ai/claude-handoff-2026-05-03.md` | planned | 2026-05-03 JST | Records Tier 1 sprint state, dependency order, and what each PR still needs from a human owner. |

## Planned Work

| Priority | Owner | Topic | Files / Areas | Notes |
|---|---|---|---|---|
| P1 | Codex | Existing example quality pass | `examples/*`, `examples/catalog.json` | Bring current examples to public quality before broad new additions. |
| P1 | Codex | Core SDK/API quality | `js/ORPHE-CORE.js`, `js/CoreToolkit.js` | BLE behavior and callback compatibility are highest priority. |
| P2 | Claude draft, Codex review | `CoreAnalytics.js` API proposal | `js/CoreAnalytics.js`, docs/examples using it | Start as separate helper module, not direct `ORPHE-CORE.js` methods. |
| P2 | Claude draft, Codex review | `CoreRecorder.js` extraction proposal | `js/CoreRecorder.js`, `examples/SENSOR-CALIBRATION/recorder.js` | Reuse existing recorder logic without breaking current example. |
| P2 | Claude | Lesson plans | `docs/lessons/` | Tier 1 lessons can be drafted independently. |
| P3 | Codex | Catalog metadata workflow | `examples/catalog.json`, scripts | Consider per-example metadata to reduce conflicts. |

## File Ownership Guidelines

| Area | Primary Owner | Notes |
|---|---|---|
| `js/ORPHE-CORE.js` | Codex | Core SDK changes require design review and real-device validation. |
| `js/CoreToolkit.js` | Codex | Connection UI changes require browser and real-device validation. |
| Existing `examples/*` behavior | Codex | Preserve behavior unless the PR explicitly targets a fix. |
| New `examples/<new>/` | Claude draft, Codex review | Keep isolated; do not edit existing examples in the same PR. |
| `js/CoreAnalytics.js` | Claude draft, Codex review | New file is okay; API must remain separable from core until reviewed. |
| `js/CoreRecorder.js` | Claude draft, Codex review | New file is okay; extraction from existing recorder needs Codex review. |
| `examples/catalog.json` | Codex | Claude should propose metadata, not directly edit unless assigned. |
| `README.md`, `index.html` | Codex | Public-facing navigation and positioning changes need preview. |
| `docs/lessons/` | Claude | Include citations and educator framing. |

## Pending Coordination

| Topic | Owner | Decision Needed |
|---|---|---|
| Per-example metadata | Codex | Decide whether to introduce `example.meta.json` and a catalog build script. |
| `CoreAnalytics.js` API | Codex + Claude | Decide method names, input shape, and session data format. |
| `CoreRecorder.js` API | Codex + Claude | Decide CSV/JSON schema and replay compatibility. |
| Tier 1 examples | Human + Codex + Claude | Confirm acceptance criteria and real-device validation requirements. |
| Educator navigation | Human + Codex | Decide when `For Educators` appears in `index.html`. |

## Session Notes

- Codex should prioritize library stability, existing example cleanup, and public-quality validation.
- Claude can move faster on isolated new examples, lesson plans, and research docs.
- Any changes to BLE, callbacks, gait interpretation, or public catalog status need Codex/human review.
