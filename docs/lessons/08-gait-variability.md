# Lesson 08: Gait Variability

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: students who have completed Lesson 02 (Stride & Cadence) and are
  comfortable computing a mean and a standard deviation in a spreadsheet or
  notebook.
- Devices: 1 ORPHE CORE per learner pair.
- Notification: `STEP_ANALYSIS`.
- Example: planned `examples/STEP-COUNT-DASHBOARD/` (PR #83) when it lands;
  fallback path is `examples/CORETOOLKIT-STARTER/` with a developer-console
  collector.
- Browser: Chrome on macOS or Windows.

## Learning objectives

By the end of the session, learners can:

1. Define gait variability and explain why a stable mean stride does not
   imply low variability.
2. Compute the coefficient of variation (CoV) of stride length and swing
   time and explain what each tells you about the walker.
3. Identify two situations where higher variability is healthy and two
   where it is a warning sign.

## Required materials

- One laptop per pair, charged.
- One ORPHE CORE per pair, charged.
- A 20 m walking lane (a corridor works) or a 10 m lane walked twice.
- A spreadsheet for the post-collection inspection.

## Pre-class setup

The instructor should:

- Confirm the data collector path opens cleanly and produces stride and gait
  events in the console while walking.
- Print the trial table so learners do not lose data while typing.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Show two short clips of walkers (or describe them verbally). Ask: "Which one would you trust to walk down a step in the dark?" Introduce the idea that walking _consistency_ is itself a signal. |
| 5–15 min | Concept | Define mean, standard deviation (SD), and CoV = SD / mean × 100. Walk through why CoV is unitless and why it is useful when comparing strides across people. |
| 15–35 min | Hands-on | Pairs walk three trials: normal pace 20 m, dual-task pace (counting backward from 100 by 7s) 20 m, and tired pace (after a 30 s shuttle). They collect at least 12 strides per trial. |
| 35–42 min | Compute | Pairs compute mean and CoV of stride magnitude and swing time per trial. |
| 42–45 min | Debrief | Each pair compares the three trials and proposes a hypothesis for the change. |

## Hands-on activity

Each trial yields 12+ strides. The trial table is:

| Trial | Description | Strides collected | Mean stride (m) | SD stride (m) | CoV stride (%) | Mean swing (s) | CoV swing (%) |
|---|---|---|---|---|---|---|---|
| 1 | Normal pace 20 m | | | | | | |
| 2 | Dual-task (count backward) 20 m | | | | | | |
| 3 | After 30 s shuttle | | | | | | |

Expected pattern: CoV typically increases under dual-task and after fatigue.
The size of the increase is the discussion, not just the direction.

## Code snippet for the fallback path

If the planned `STEP-COUNT-DASHBOARD` is not yet on `main`, paste the
following into the developer console of `CORETOOLKIT-STARTER` while walking:

```javascript
window.gaitLog = { strides: [], gaits: [] };
bles[0].gotStride = function (stride) {
  window.gaitLog.strides.push({ t: performance.now(), magnitude: Math.hypot(stride.x, stride.y, stride.z) });
};
bles[0].gotGait = function (gait) {
  window.gaitLog.gaits.push({
    t: performance.now(),
    swing: gait.swing_phase_duration,
    stance: gait.standing_phase_duration,
  });
};

function statsFor(values) {
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length || 1));
  return { n: values.length, mean, sd, covPercent: mean === 0 ? NaN : (sd / mean) * 100 };
}

function trialReport() {
  return {
    stride: statsFor(window.gaitLog.strides.map(s => s.magnitude)),
    swing: statsFor(window.gaitLog.gaits.map(g => g.swing).filter(v => typeof v === 'number')),
  };
}
```

Reset between trials with `window.gaitLog = { strides: [], gaits: [] };`.

## Discussion prompts

- "Why is CoV better than SD for comparing your stride to a friend's?" Use
  to introduce normalization.
- "Name a situation where high stride CoV is a good thing." Examples:
  navigating obstacles, terrain adaptation. The point is variability is
  not pathology by default.
- "Your CoV is 6% in trial 1 and 14% in trial 2. Can you say the dual task
  caused the change with this data?" Use to introduce the difference between
  description and inference.

## Assessment ideas

- A short report comparing the three trials with one paragraph on what would
  have to be true for the difference to be considered clinically meaningful.
- A code reading exercise where learners explain why CoV uses SD divided by
  mean and what happens when mean is small.

## Safety and ethics

- The 30 s shuttle should be voluntary; offer an alternative where a partner
  carries a 5 kg bag instead.
- Variability data feels personal. Do not require learners to share their
  numbers.

## References

- Hausdorff, J. M. "Gait Variability: Methods, Modeling and Meaning."
  _Journal of NeuroEngineering and Rehabilitation_, vol. 2, no. 19, 2005.
  Authoritative review for the lesson.
- Hollman, J. H., McDade, E. M., and Petersen, R. C. "Normative Spatiotemporal
  Gait Parameters in Older Adults." _Gait & Posture_, vol. 34, no. 1, 2011.
  Use as a reference for typical CoV ranges.

## Out of scope

- Detrended fluctuation analysis or other long-range correlation methods.
- Inferential statistics across cohorts. Lesson is descriptive.

## Open questions for the human owner

- Should `CoreAnalytics` expose a `getStrideStats` that includes CoV
  directly? Currently it returns mean and SD only.
- Do we want a recommended "minimum strides for a meaningful CoV" number to
  print in the lesson? Literature commonly cites 30+ strides for stable
  estimates; classroom slots may not allow this.
