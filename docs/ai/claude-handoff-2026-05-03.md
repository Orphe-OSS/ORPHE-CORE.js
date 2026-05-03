# Claude Handoff — 2026-05-03

Sprint label: **Tier 1 reconstruction sprint**.
Reason for the handoff doc: a previous Claude session drafted seven branches
locally (lesson plans, two helper modules, three example PoCs, and this
handoff), then closed without push permissions. This sprint re-creates those
branches from scratch and pushes each one as a self-contained PR.

## What landed in this sprint

| # | Branch | PR | Base | Purpose |
|---|---|---|---|---|
| 1 | `claude/lessons-tier1-draft` | #77 | `main` | Six 45-min Tier 1 lesson plans (`docs/lessons/*`) plus an in-flight rows update. |
| 2 | `claude/core-analytics-api-draft` | #79 | `main` | `js/CoreAnalytics.js` 0.0.1-draft (session summary, baseline, symmetry, CMJ). |
| 3 | `claude/core-recorder-api-draft` | #81 | `main` | `js/CoreRecorder.js` 0.0.1-draft (CSV/JSON schema, fromJSON / fromCSV roundtrip, replay). |
| 4 | `claude/example-csv-recorder-poc` | #82 | PR #81 | `examples/CSV-RECORDER/` PoC. |
| 5 | `claude/example-step-count-dashboard-poc` | #83 | PR #79 | `examples/STEP-COUNT-DASHBOARD/` PoC. |
| 6 | `claude/example-replay-player-poc` | #84 | PR #81 | `examples/REPLAY-PLAYER/` PoC with shipped synthetic sample. |
| 7 | `claude/handoff-2026-05-03` | (this PR) | `main` | This document. |

All seven branches were re-created from `main` (or from their stated base
branch). None of them touch `js/ORPHE-CORE.js`, `js/CoreToolkit.js`,
`js/BleSharedBridge.js`, `index.html`, `examples/catalog.json`, or any
existing example's behavior.

## Suggested merge order

The two helper-module PRs are independent of each other. The three example
PoCs each depend on exactly one helper PR. PR #77 (lessons) and this handoff
PR are independent of all of them.

```
PR #77  (lessons)               ─────────────────────────────►
PR #79  (CoreAnalytics) ─────►  PR #83  (STEP-COUNT-DASHBOARD)
PR #81  (CoreRecorder)  ─┬───►  PR #82  (CSV-RECORDER)
                         └───►  PR #84  (REPLAY-PLAYER)
PR (this) (handoff)             ─────────────────────────────►
```

Recommended order:

1. PR #77 — pure docs, no risk.
2. PR #79 — new file, no other example consumes it on `main` yet.
3. PR #83 — depends on #79; rebase after #79 merges.
4. PR #81 — new file, no other example consumes it on `main` yet.
5. PR #82 — depends on #81; rebase after #81 merges.
6. PR #84 — depends on #81; rebase after #81 merges.
7. This handoff PR — can land at any time.

The example PoCs (#82, #83, #84) will need a trivial rebase once their
helper PR merges. All three deliberately do **not** edit
`examples/catalog.json`; Codex owns the catalog reconciliation.

## What each PR still needs from a human owner

### PR #77 — lessons
- Decide whether the Tier 1 lesson set lives under `docs/lessons/` or moves
  into `docs/educators/` once we add Tiers 2+.
- Each lesson includes its own "Open questions for the human owner" block.
- Optional: print/PDF appendix per lesson.

### PR #79 — CoreAnalytics
- Confirm method names (`feedAcc` / `feedGait` / etc.) before any example
  pins to them.
- Confirm session-summary schema (`schema: "0.0.1-draft"`).
- Confirm Robinson SI formula (`2 × |R − L| / (R + L) × 100`).

### PR #81 — CoreRecorder
- Confirm JSON schema label (`0.0.1-draft`) and CSV column set.
- Decide whether `meta` is opaque (current) or typed.
- Decide whether CSV roundtrip needs to be byte-exact (current is
  payload-equivalent).

### PR #82 — CSV-RECORDER PoC
- Decide max-samples behavior for very long sessions.
- Capture a thumbnail from a real session before promoting to `public`.

### PR #83 — STEP-COUNT-DASHBOARD PoC
- Decide CMJ panel UX (most recent only vs history table).
- Decide cadence window (10 s vs configurable).
- Capture thumbnail.

### PR #84 — REPLAY-PLAYER PoC
- Confirm synthetic sample length and event density.
- Decide playback-finished detection (timer vs handler-driven).
- Decide whether the optional CoreToolkit live mirror stays inside
  `<details>`, gets promoted, or gets removed.
- Capture thumbnail.

## Sprint constraints honored

These were the explicit guardrails from the human at session start:

- ✅ One PR = one purpose.
- ✅ No direct push to `main`.
- ✅ No edits to `js/ORPHE-CORE.js`, `js/CoreToolkit.js`, `js/BleSharedBridge.js`,
     `index.html`, `examples/catalog.json`, or existing examples.
- ✅ Helper modules are new files only and use opt-in `feed*` methods over the
     existing callback model — no callback replacement, no auto-attach.
- ✅ The three example PoCs all use CoreToolkit and call
     `guardCoreToolkitBluetooth({ coreIds: [0] })` so the static audit is
     satisfied.
- ✅ REPLAY-PLAYER ships `sample-session.js` and boots without hardware.
- ✅ Catalog metadata for new examples is proposed in their READMEs, not
     written into `examples/catalog.json`.
- ✅ `node scripts/check-examples-catalog.js` and
     `node scripts/check-examples-static-quality.js` were re-run for each PR.

## Validation summary

| Check | Result on each PR |
|---|---|
| `node --check <changed-js-file>` | OK on every PR that adds JS. |
| `node scripts/check-examples-catalog.js` | `Catalog OK: 48 entries checked` on every PR. |
| `node scripts/check-examples-static-quality.js` | After the Codex PRs #78 / #80 merged, 0 errors / 0 warnings on `main`. None of these PRs introduce regressions. |
| Real-device validation | **Not performed in this sprint.** Each example PR's "Real-device validation" section lists the specific items that need a human in Chrome with one ORPHE CORE before promotion to `public`. |

## What the sprint did not do

- **No core SDK or CoreToolkit changes.** The helper modules deliberately
  layer on top of the existing callback model.
- **No `examples/catalog.json` edits.** Catalog reconciliation is reserved
  for Codex; proposed entries live in each example's README.
- **No `index.html` or root README changes.** Public-navigation positioning
  is a human-and-Codex decision.
- **No real-device validation claims.** None of the new examples have been
  exercised on hardware in this sprint.
- **No translation, no slide decks, no thumbnails.** Lessons are English-first
  drafts; example thumbnails are explicitly listed as TODO in each README.
- **No changes to `examples/SENSOR-CALIBRATION/recorder.js`.** The new
  `CoreRecorder.js` is a sibling proposal, not a migration.

## Open coordination questions

These are the ones likely to come up in the next session and should be
resolved before any of the new helpers or examples is treated as stable:

1. **API naming lock.** Do `feedAcc` / `feedGait` / `feedStride` etc. survive
   review, or do we converge on a different convention before the example
   layer pins to them?
2. **Schema lock.** Should we move from `0.0.1-draft` to `0.1.0` for the
   CoreRecorder JSON shape after the first device-validated recording?
3. **Catalog plumbing.** Once the three example PRs land, Codex needs to
   reconcile their proposed catalog entries (and capture thumbnails). The
   proposed entries in each README are the source of truth for that
   reconciliation.
4. **Educator navigation.** Do we surface `For Educators` and the lesson
   plans from `index.html` now, or wait for at least one classroom-tested
   lesson?
5. **Real-device validation owner.** Each PR's "Real-device validation"
   section names what to check; assigning a human owner per PR is still open.

## Pointer files

- Process and ownership: [`docs/agents.md`](../agents.md).
- Coordination board: [`docs/in-flight.md`](../in-flight.md).
- Public-candidate validation queue: [`docs/public-candidate-validation.md`](../public-candidate-validation.md).
- Lesson index: [`docs/lessons/README.md`](../lessons/README.md) (lands in PR #77).
