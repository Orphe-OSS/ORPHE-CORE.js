# Lesson 02: Stride & Cadence

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: introductory sports science, kinesiology, or applied data students
  who have completed Lesson 01 or an equivalent.
- Devices: 1 ORPHE CORE per learner pair.
- Notification: `STEP_ANALYSIS`.
- Example: `examples/STEP-COUNT-DASHBOARD/` _(planned)_, with the stride and
  cadence panels enabled. Until it lands, run the lesson against
  `examples/CORETOOLKIT-STARTER/` and inspect `bles[0].gotStride` and
  `bles[0].gotGait` from the developer console.
- Browser: Chrome on macOS or Windows.

## Learning objectives

By the end of the session, learners can:

1. Define stride length and cadence in their own words and explain why they are
   complementary, not interchangeable.
2. Read a `gotStride` payload (`{x, y, z, steps_number}`) and explain why the
   `x` component dominates for forward walking.
3. Decide when stride length is more informative than step count for a given
   research or product question.

## Required materials

- One laptop per pair, charged.
- One ORPHE CORE per pair, charged.
- A 10 m walking lane with a measuring tape laid alongside it.
- Painter's tape to mark a start line and a turn-around line.

## Pre-class setup

The instructor should:

- Confirm the local server is running.
- Confirm the planned example or `CORETOOLKIT-STARTER` opens cleanly in Chrome.
- Print or sketch a simple cadence-vs-stride scatter plot on the board so the
  class has a shared mental model before learners collect data.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Define stride length and cadence verbally and on the board. Ask: "Two runners cover 100 m in the same time. How might their stride and cadence differ?" |
| 5–15 min | Concept | Walk through the `gait` and `stride` payloads. Highlight that `gait.steps` is a count, `gait.standing_phase_duration` and `swing_phase_duration` are seconds, and `stride` is a 3-axis displacement in meters. |
| 15–35 min | Hands-on | Pairs walk a 10 m lane four times: normal pace, fast pace, deliberately long stride, deliberately fast cadence. They record cadence and average stride per trial. |
| 35–42 min | Plot | Pairs sketch their four points on a cadence (x) vs stride length (y) plot. |
| 42–45 min | Debrief | Pairs share which trial surprised them and why. |

## Hands-on activity

For each trial, learners walk 10 m, then read off:

- `cadence` = (steps reported during the trial / trial duration in seconds) × 60.
- `average stride` = mean of the magnitudes of the `gotStride` payloads received
  during the trial. The planned dashboard surfaces this as a number; the
  fallback path is to push each `Math.hypot(stride.x, stride.y, stride.z)` into
  an array and average it after the trial.

| Trial | Description | Cadence (steps/min) | Avg stride (m) | Notes |
|---|---|---|---|---|
| 1 | Normal pace | | | |
| 2 | Fast pace | | | |
| 3 | Deliberately long stride | | | |
| 4 | Deliberately fast cadence | | | |

The expected pattern is that trials 3 and 4 sit on opposite axes of the cadence
vs stride plot, which makes the trade-off concrete.

## Code snippet for the fallback path

If learners are using `CORETOOLKIT-STARTER` because the planned dashboard has
not landed yet, paste the following into the developer console after the
CoreToolkit switch is on:

```javascript
window.strideSamples = [];
bles[0].gotStride = function (stride) {
  const magnitude = Math.hypot(stride.x ?? 0, stride.y ?? 0, stride.z ?? 0);
  window.strideSamples.push({ t: performance.now(), magnitude, stride });
};
function strideStats() {
  const ms = window.strideSamples.map(s => s.magnitude);
  const mean = ms.reduce((a, b) => a + b, 0) / (ms.length || 1);
  return { count: ms.length, meanMeters: mean };
}
```

After each trial, call `strideStats()` in the console and clear
`window.strideSamples = []` before the next trial.

## Discussion prompts

- "Stride length is reported on three axes. When would the y or z component
  matter as much as x?" Use this to introduce lateral movement and ramps.
- "If two learners report the same average stride, but the variance is very
  different, what hypotheses do you have about their gait?"
- "Cadence is convenient because it is one number. What does that convenience
  cost you compared to stride length?"

## Assessment ideas

- A short written analysis: pick one of the four trials and describe what a
  coach or clinician would actually do with the cadence and stride numbers.
- A code review where learners explain why `Math.hypot` is used instead of
  reading `stride.x` directly.

## Safety and ethics

- Use a clear lane with no foot traffic. Spotters at each end during fast trials
  if the room is small.
- The lesson can produce gait data that, in aggregate, can identify a learner.
  Treat the trial table as personal data for the class and discard.

## References

- Perry, J. and Burnfield, J. M. _Gait Analysis: Normal and Pathological
  Function_. 2nd ed., SLACK Inc., 2010. Chapter on stride and cadence
  terminology.
- Cavagna, G. A. and Margaria, R. "Mechanics of Walking." _Journal of Applied
  Physiology_, vol. 21, no. 1, 1966. Use as the historical reference for the
  cadence/stride trade-off.

## Out of scope

- Energetics or VO2 estimation. The example does not measure metabolic load.
- Treadmill calibration. Lesson assumes overground walking.

## Open questions for the human owner

- Should the planned dashboard show stride magnitude, or each component? Decide
  before this lesson is published so the activity matches the example.
- Do we expose cadence as steps/minute or as Hz? Pick one for consistency across
  Tier 1 lessons.
