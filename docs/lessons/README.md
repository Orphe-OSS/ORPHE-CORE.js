# Lesson Plans (Draft)

Status: `draft` — opened for review by Codex and human owners. None of these
lesson plans should be linked from the public LP until they have been reviewed
and at least one cohort has run them.

This directory holds 45-minute class plans that pair an ORPHE CORE example with
educator framing, hands-on tasks, and discussion prompts. They are written for
JavaScript-comfortable instructors in undergraduate sports science,
rehabilitation, HCI, or creative coding programs, but most can be adapted for
high school clubs and adult workshops.

## Tier 1 Lessons

The first six plans share the same structure so they can be slotted into any
syllabus order:

| # | Lesson | Example | Notification | Devices |
|---|---|---|---|---|
| 1 | [Step Count Dashboard](./01-step-count-dashboard.md) | `examples/STEP-COUNT-DASHBOARD/` _(planned)_ | `STEP_ANALYSIS` | 1 |
| 2 | [Stride & Cadence](./02-stride-and-cadence.md) | `examples/STEP-COUNT-DASHBOARD/` _(planned)_ | `STEP_ANALYSIS` | 1 |
| 3 | [L/R Symmetry](./03-lr-symmetry.md) | `examples/STEP-COUNT-DASHBOARD/` _(planned, dual-device variant)_ | `STEP_ANALYSIS` | 2 |
| 4 | [CSV Recorder](./04-csv-recorder.md) | `examples/CSV-RECORDER/` _(planned)_ | `STEP_ANALYSIS_AND_SENSOR_VALUES` | 1 |
| 5 | [Replay Player](./05-replay-player.md) | `examples/REPLAY-PLAYER/` _(planned)_ | none — uses recorded JSON | 0 (synthetic data) or 1 (live) |
| 6 | [Vertical Jump (CMJ)](./06-vertical-jump-cmj.md) | `examples/STEP-COUNT-DASHBOARD/` or new `CMJ` _(planned)_ | `SENSOR_VALUES` | 1 |

The example directories listed as _(planned)_ are introduced in sibling PRs in
this sprint. Until those land, instructors can run the lesson against
`examples/CORETOOLKIT-STARTER/` for steps 1–3 and `examples/SENSOR-CALIBRATION/`
for step 4 — the lesson plans call this out explicitly.

## Tier 2 Lessons

The Tier 2 plans extend the Tier 1 ladder. They share the same 45-minute
shape and the same "Status: draft" caveat. Each one names the example it
pairs with and a fallback path that uses an existing example.

| # | Lesson | Example | Notification | Devices |
|---|---|---|---|---|
| 7  | [Signal Processing Intro](./07-signal-processing.md) | any page exposing `gotConvertedAcc` (e.g. `CORETOOLKIT-STARTER`) | `SENSOR_VALUES` | 1 |
| 8  | [Gait Variability](./08-gait-variability.md) | `examples/STEP-COUNT-DASHBOARD/` _(planned)_ or `CORETOOLKIT-STARTER` fallback | `STEP_ANALYSIS` | 1 |
| 9  | [Foot Angle at Landing](./09-foot-angle-at-landing.md) | `examples/FOOT-ANGLE-DASHBOARD/` _(planned)_ or `CORETOOLKIT-STARTER` fallback | `STEP_ANALYSIS_AND_SENSOR_VALUES` | 1 |
| 10 | [From Recording to Research](./10-from-recording-to-research.md) | planned `CSV-RECORDER` + `REPLAY-PLAYER`, or any prior recording | any | 0–1 |

Tier 2 assumes Tier 1 vocabulary. Lessons 07 and 08 stand alone; Lesson 09
pairs with the Tier 2 `FOOT-ANGLE-DASHBOARD` example introduced in this
sprint; Lesson 10 is a workflow / meta-lesson that ties recording, replay,
analysis, and sharing together.

## Educator framing

All Tier 1 lessons assume:

- Chrome on macOS or Windows. Safari and Firefox cannot use the Web Bluetooth
  API and are not supported.
- One ORPHE CORE per learner pair, except where noted.
- A local static server on the example so Web Bluetooth permissions persist.
  `python3 -m http.server 8767` from the repo root works.
- Learners have seen a 5-minute demo of `examples/CORETOOLKIT-STARTER/` so the
  connection toggle is familiar.

## Citations and further reading

Each lesson cites sources by topic rather than by a single textbook so the
material can be substituted for whatever is on the local syllabus. The most
common references are:

- Whittle, M. W. _Gait Analysis: An Introduction_. 5th ed., Churchill
  Livingstone, 2014. Use for terminology around the gait cycle and stance/swing
  phases.
- Perry, J. and Burnfield, J. M. _Gait Analysis: Normal and Pathological
  Function_. 2nd ed., SLACK Inc., 2010. Use for clinical gait deviations.
- Bouten, C. V. C. et al. "A Triaxial Accelerometer and Portable Data Processing
  Unit for the Assessment of Daily Physical Activity." _IEEE Transactions on
  Biomedical Engineering_, vol. 44, no. 3, 1997. Use for the basic case for
  wearable accelerometry.
- Bishop, P. A. and Herron, R. L. "Use and Misuse of the Likert Item Responses
  and Other Ordinal Measures." _International Journal of Exercise Science_,
  vol. 8, no. 3, 2015. Use when teaching learners to design self-report
  follow-ups.
- Linthorne, N. P. "Analysis of Standing Vertical Jumps Using a Force Platform."
  _American Journal of Physics_, vol. 69, no. 11, 2001. Use as the conceptual
  reference for the CMJ lesson; ORPHE CORE is a foot-mounted IMU, not a force
  platform, so the lesson teaches comparison rather than equivalence.

Lesson-specific references appear in each plan.

## Status

These plans are drafts. They have not been classroom-tested with the current
example branches because the dependent examples are still in PR. Treat the
"Activity" sections as design intent until a real cohort has run them.

## Out of scope

- Translation to other languages. Drafts are written in English first so Codex
  can review terminology before localization.
- Slide decks or printable handouts. Add later when the example PRs land.
- Assessment rubrics tied to a specific institution. The "Assessment ideas"
  section gives suggestions, not a graded rubric.
