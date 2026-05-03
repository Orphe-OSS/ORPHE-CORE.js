# Claude Handoff — 2026-05-03 (Tier 2 sprint)

Sprint label: **Tier 2 sprint**.
Run as a 2-hour autonomous batch following the Tier 1 sprint
([handoff doc](./claude-handoff-2026-05-03.md)). At the start of this
sprint, Tier 1 PR #77 (lessons) and PR #85 (Tier 1 handoff) had been
merged to `main` by Codex; PRs #79 / #81 / #82 / #83 / #84 were still
in review.

## What landed in this sprint

| # | Branch | PR | Base | Purpose |
|---|---|---|---|---|
| T2-1 | `claude/lessons-tier2-draft` | #86 | `main` | Tier 2 lesson plans (07–10) plus README index update. |
| T2-2 | `claude/example-foot-angle-dashboard-poc` | #88 | `main` | `examples/FOOT-ANGLE-DASHBOARD/` PoC — independent of all in-flight helper PRs. |
| T2-3 | `claude/core-analytics-tests` | #89 | PR #79 | `tests/core-analytics.test.js` (Plain Node, 30 cases). |
| T2-4 | `claude/core-recorder-tests` | #91 | PR #81 | `tests/core-recorder.test.js` (Plain Node, 25 cases). |
| T2-5 | `claude/research-imu-step-detection` | #92 | `main` | `docs/ai/research-imu-step-detection.md` reference note. |
| T2-6 | `claude/handoff-tier2-2026-05-03` | (this PR) | `main` | This document. |

All six branches were created from `main` (or from their stated base
branch). None of them touch `js/ORPHE-CORE.js`, `js/CoreToolkit.js`,
`js/BleSharedBridge.js`, `js/CoreAnalytics.js`, `js/CoreRecorder.js`,
`index.html`, `examples/catalog.json`, or any existing example. The two
test PRs (T2-3 / T2-4) sit on top of the Tier 1 helper PRs because they
need the helpers to exist; they do not modify the helpers.

## Suggested merge order

```
PR #86  (Tier 2 lessons)            ─────────────────────────►
PR #88  (FOOT-ANGLE-DASHBOARD)      ─────────────────────────►
PR #92  (research note)             ─────────────────────────►
PR #79  (CoreAnalytics) ────────►   PR #89  (analytics tests)
PR #81  (CoreRecorder)  ────────►   PR #91  (recorder tests)
PR (this) (Tier 2 handoff)          ─────────────────────────►
```

Recommended order:

1. PR #86 — Tier 2 lessons. Pure docs, no risk.
2. PR #88 — FOOT-ANGLE-DASHBOARD. Standalone example, no helper dependency.
3. PR #92 — research note. Pure docs.
4. PR #79 — CoreAnalytics helper.
5. PR #89 — CoreAnalytics tests; rebase after #79 merges.
6. PR #81 — CoreRecorder helper.
7. PR #91 — CoreRecorder tests; rebase after #81 merges.
8. This handoff PR — can land at any time.

The Tier 1 example PoCs (#82 / #83 / #84) are still in review and unchanged
by this sprint.

## What each PR still needs from a human owner

### PR #86 — Tier 2 lessons (07–10)
- Tier 2 lessons 09 and 10 reference the planned `FOOT-ANGLE-DASHBOARD`
  (PR #88) and the Tier 1 helper PRs (#82, #84) respectively. Decide
  whether to publish them as drafts now or wait for the dependent
  examples to land.
- Lesson 09 ships placeholder bin thresholds (5° / 15°). Tune per cohort
  against camera footage before classroom use.
- Lesson 10 is a workflow / meta-lesson — confirm it stays in the Tier 1
  ladder vs. moving into a separate "research workflow" track later.

### PR #88 — FOOT-ANGLE-DASHBOARD
- Confirm default bin thresholds (5° / 15°) are sensible for typical
  cohorts, or lock per mount/shoe.
- Capture thumbnail from a real walking session before promoting.
- Decide whether bin counts should retain history beyond the 12-row
  recent buffer.

### PR #89 — CoreAnalytics tests
- 30 cases, all passing locally. Test harness is Plain Node (no framework).
- Decide between `tests/` (current) and `js/__tests__/` for layout.
- CI wiring is intentionally not added — separate decision.

### PR #91 — CoreRecorder tests
- 25 cases, all passing locally.
- Pins one behavior difference between `CoreRecorder.feed*` and
  `CoreAnalytics.feed*`: the recorder records null payloads as empty
  objects, the analytics module discards them. Worth aligning during
  PR #81 API review; the test makes the current behavior explicit so a
  regression in either direction is visible.

### PR #92 — research note
- Citations are conservative and limited to sources the author can point
  to. Flag any that look weak from a domain perspective.
- Cross-link from Lessons 01 and 03 only after the citations are
  reviewed.

## Sprint constraints honored

These were the explicit guardrails from the human at sprint start:

- ✅ One PR = one purpose.
- ✅ No direct push to `main`.
- ✅ No edits to `js/ORPHE-CORE.js`, `js/CoreToolkit.js`,
  `js/BleSharedBridge.js`, `js/CoreAnalytics.js`, `js/CoreRecorder.js`,
  `index.html`, `examples/catalog.json`, existing examples, or
  `examples/SENSOR-CALIBRATION/recorder.js`.
- ✅ FOOT-ANGLE-DASHBOARD (the only new example) calls
  `guardCoreToolkitBluetooth({ coreIds: [0] })` immediately after
  `buildCoreToolkit`.
- ✅ Catalog metadata for the new example is proposed in its README; no
  edits to `examples/catalog.json`.
- ✅ Test harnesses are Plain Node (no `package.json` dependency tree).
- ✅ Each PR's commits include `node --check` (when adding JS),
  `node scripts/check-examples-catalog.js`, and
  `node scripts/check-examples-static-quality.js`.

## Validation summary

| Check | Result on each PR |
|---|---|
| `node --check <changed-js-file>` | OK on every PR that adds JS. |
| `node scripts/check-examples-catalog.js` | `Catalog OK: 48 entries checked` on every PR. |
| `node scripts/check-examples-static-quality.js` | 0 errors / 0 warnings / 0 info on `main` and on every PR that touches an example. |
| `node tests/core-analytics.test.js` | `30 passed, 0 failed` on PR #89. |
| `node tests/core-recorder.test.js` | `25 passed, 0 failed` on PR #91. |
| Real-device validation | **Not performed.** FOOT-ANGLE-DASHBOARD's README lists what to verify before promoting from `public-candidate` to `public`. |

## What this sprint did not do

- **No core SDK or CoreToolkit changes.**
- **No `examples/catalog.json` edits.**
- **No `index.html` or root README changes.**
- **No CI wiring** for the new test harnesses (separate decision, Codex).
- **No real-device validation claims** for the new example.
- **No translation, no slide decks, no thumbnails.**
- **No edits to the Tier 1 PRs.** Codex is reviewing those; this sprint
  ran in parallel and avoided them.

## Open coordination questions

1. **`feed*` null-guard alignment.** `CoreRecorder.feed*` records
   null payloads as empty rows; `CoreAnalytics.feed*` discards them.
   Pick one convention and pin it in the schema notes.
2. **Test harness home.** `tests/` (current), `js/__tests__/`, or
   `__tests__/` at repo root? CI wiring waits on this decision.
3. **Tier 2 lesson publication.** Lessons 09 and 10 reference PRs that
   are still in review. Publish as drafts now or wait?
4. **Bin-threshold scheme for foot-angle.** Default 5° / 15° in both
   the example and Lesson 09. Tune per cohort or accept as starting
   point?

## Pointer files

- Process and ownership: [`docs/agents.md`](../agents.md).
- Coordination board: [`docs/in-flight.md`](../in-flight.md).
- Tier 1 handoff: [`docs/ai/claude-handoff-2026-05-03.md`](./claude-handoff-2026-05-03.md).
- Lesson index: [`docs/lessons/README.md`](../lessons/README.md).
- IMU step-detection reference: [`docs/ai/research-imu-step-detection.md`](./research-imu-step-detection.md) (lands in PR #92).
