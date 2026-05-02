# Agent Collaboration Guide

This repository is developed by humans, Codex, and Claude in parallel. The goal is to grow ORPHE-CORE.js as a reliable open-source JavaScript library for ORPHE CORE, while making every public example understandable, runnable, and useful for education, sports science, rehabilitation, and creative coding.

## Priorities

1. Keep the core ORPHE-CORE.js library reliable.
2. Keep BLE connection, shared connection, reconnection, and CoreToolkit behavior stable.
3. Bring existing examples to public quality before adding many new examples.
4. Make examples easy to evaluate: what it does, required devices, data used, how to run, and what to verify.
5. Add education and research material in a way that does not destabilize the core library.

## Branches and PRs

- Do not push directly to `main`.
- Use PRs for all changes.
- Use one PR for one purpose.
- Use `codex/<topic>` for Codex branches.
- Use `claude/<topic>` for Claude branches.
- Keep PRs small enough that a human can review and accept or reject them independently.
- Do not combine behavior changes, renames, deletes, and docs cleanup in one PR.

## Ownership

| Area | Primary owner | Notes |
|---|---|---|
| `js/ORPHE-CORE.js` | Codex | Core SDK, BLE, parser, callbacks, bridge, reconnect. Real-device validation is required for behavior changes. |
| `js/CoreToolkit.js` | Codex | Connection UI and device controls. Browser and real-device validation are required. |
| Existing `examples/*` behavior | Codex | Existing examples must not be changed broadly without explicit scope. |
| `examples/catalog.json` | Codex | Claude should propose metadata in PR body or per-example metadata files, not edit this file directly unless coordinated. |
| `index.html` | Codex | Public LP/navigation changes need preview. |
| New `examples/<new>/` | Claude draft, Codex review | New examples should be self-contained and avoid touching existing examples. |
| `js/CoreAnalytics.js` | Claude draft, Codex API review | Keep analytics separate from `ORPHE-CORE.js` until the API is stable. |
| `js/CoreRecorder.js` | Claude draft, Codex API review | Prefer extracting reusable recording logic from existing examples without breaking them. |
| `docs/lessons/` | Claude | Lesson plans, citations, and educator material. |
| `docs/ai/` | Shared | Research notes and AI handoff prompts. |

## Core Library Rules

- `ORPHE-CORE.js` should stay focused on BLE connection, data parsing, core state, and callback dispatch.
- Do not add high-level analytics directly into `ORPHE-CORE.js` until the same API has been proven in examples or helper modules.
- Prefer separate modules first:
  - `CoreAnalytics.js` for symmetry, baselines, session summaries, CMJ, and gait metrics.
  - `CoreRecorder.js` for CSV/JSON recording and replay data formats.
- Any new helper API must work with the existing callback model:
  - `gotAcc`
  - `gotConvertedAcc`
  - `gotGyro`
  - `gotQuat`
  - `gotEuler`
  - `gotGait`
  - `gotStride`
  - `gotPronation`
  - `gotStepsNumber`
- Do not replace the callback model without a separate design discussion.

## Example Quality Bar

An example can be promoted toward public navigation only when it has:

- A clear title.
- A short explanation of what it does.
- Required device count.
- Data/notification type used.
- Startup instructions.
- Real-device validation status.
- Known limitations.
- Thumbnail when shown in a gallery.
- A README if the example is not trivial.

Use these statuses consistently:

- `public`: ready to show broadly.
- `public-candidate`: useful but still needs validation or polish.
- `needs-review`: unclear scope or needs human decision.
- `needs-fix`: known issue blocks public use.
- `internal`: test, debug, or internal utility.

## Metadata and Catalog

For now, `examples/catalog.json` is the source for public galleries. To reduce conflicts:

- Claude should not directly update `examples/catalog.json` unless explicitly assigned.
- New examples should include proposed catalog metadata in their PR body.
- If a new example needs structured metadata, add an `example.meta.json` proposal in the example directory and mark it as a proposal.
- Codex will reconcile proposals into `examples/catalog.json`.

Future direction:

- Add a script that builds `examples/catalog.json` from per-example metadata files.
- Keep generated output deterministic.
- Add validation to CI or local scripts before merging.

## Validation Expectations

Run the smallest relevant checks for each PR. Common checks:

- `git diff --check`
- `node scripts/check-examples-catalog.js`
- `node --check <changed-js-file>`
- `curl -I http://localhost:8767/<changed-page>/`
- Browser preview for LP or gallery changes.
- Real-device Chrome validation for BLE behavior changes.

Never claim real-device validation unless it was actually performed.

## Human Decision Points

Escalate these to a human:

- Public navigation changes.
- Example promotion from `public-candidate` to `public`.
- Large renames or deletes.
- Changes to BLE behavior.
- Changes to ORPHE CORE data interpretation.
- API naming in `ORPHE-CORE.js`, `CoreAnalytics.js`, or `CoreRecorder.js`.
- Legal or branding-sensitive names.

## Handoff Format

Every PR should include:

- Summary
- Validation
- Needs real-device validation
- Out of scope
- Questions for human
- Next PR candidates

At session end, update `docs/in-flight.md` or leave a PR comment with the current branch, touched files, validation, and remaining questions.
