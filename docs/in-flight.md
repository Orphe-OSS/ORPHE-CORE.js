# In-flight Work

Last updated: 2026-05-02 23:35 JST

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
| Codex | main | Create agent collaboration docs | `docs/agents.md`, `docs/in-flight.md`, `.github/*`, `docs/ai/*` | active | 2026-05-02 23:35 JST | Codex priority is core library quality and public-quality existing examples. |
| Claude | claude/research-imu-competitors-yWYtf | IMU competitor research and lesson concept | `docs/ai/` research docs | reference | 2026-05-02 23:35 JST | Research should inform roadmap, not directly edit core SDK. |

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
