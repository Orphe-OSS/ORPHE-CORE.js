# Lesson 07: Signal Processing Intro (Filters and Smoothing)

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: students who have completed at least one Tier 1 lesson and have
  written a small JavaScript callback before.
- Devices: 1 ORPHE CORE per learner pair.
- Notification: `SENSOR_VALUES`. Range `acc=16`, `gyro=2000` so peaks aren't
  clipped.
- Example: any page that exposes `bles[0].gotConvertedAcc` (e.g.
  `examples/CORETOOLKIT-STARTER/`). The lesson is run from the developer
  console — no new example is required.
- Browser: Chrome on macOS or Windows.

## Learning objectives

By the end of the session, learners can:

1. Explain why a raw IMU stream needs filtering before most kinds of
   downstream analysis.
2. Implement a moving-average filter and a simple low-pass (exponential)
   filter on `gotConvertedAcc` and describe what each one removes.
3. Choose a filter (or no filter) given a downstream task — step counting,
   CMJ peak detection, posture, and one they invent.

## Required materials

- One laptop per pair, charged.
- One ORPHE CORE per pair, charged, mounted on the dominant foot.
- A 5 m walking lane.
- A clear floor area for one short jump.

## Pre-class setup

The instructor should:

- Confirm the connection switch works in `CORETOOLKIT-STARTER` and the
  `gotConvertedAcc` magnitude is sensible while standing (~1 G).
- Print the table of "filter vs use case" from the discussion section so
  learners can fill it in during class.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Show one raw acceleration trace from a 3 s stand. Ask: "Why is the line never flat?" |
| 5–15 min | Concept | Walk through three sources of noise: sensor noise, mounting noise, and biological noise. Introduce moving average and exponential smoothing as two different answers. |
| 15–35 min | Hands-on | Pairs paste two filter snippets into the developer console while standing, walking, and jumping. They report the magnitude before and after each filter. |
| 35–42 min | Choose | Pairs map four downstream tasks (step count, CMJ peak, posture, one of their own) to "no filter / moving average / low-pass" and justify each choice in one sentence. |
| 42–45 min | Debrief | Each pair reads one of their filter choices and the justification. |

## Hands-on activity

Open `CORETOOLKIT-STARTER`, turn on the BLE switch, and paste the following
into the developer console:

```javascript
// State for the filters.
window.filterState = {
  raw: [],
  movingAvg: [],
  lowPass: { y: null },
};

// Moving average over the last N samples.
function movingAverage(buffer, sample, n) {
  buffer.push(sample);
  if (buffer.length > n) buffer.shift();
  return buffer.reduce((a, b) => a + b, 0) / buffer.length;
}

// Exponential smoothing (1-pole low-pass). alpha = 1 means no filter.
function lowPass(state, sample, alpha) {
  if (state.y == null) state.y = sample;
  state.y = state.y + alpha * (sample - state.y);
  return state.y;
}

bles[0].gotConvertedAcc = function (acc) {
  const magnitude = Math.hypot(acc.x, acc.y, acc.z);
  const ma = movingAverage(window.filterState.movingAvg, magnitude, 10);
  const lp = lowPass(window.filterState.lowPass, magnitude, 0.1);
  window.filterState.raw.push(magnitude);
  if (window.filterState.raw.length > 200) window.filterState.raw.shift();
  console.log(`raw ${magnitude.toFixed(2)} | ma ${ma.toFixed(2)} | lp ${lp.toFixed(2)}`);
};
```

Trial table:

| Trial | Activity | raw mean | ma mean | lp mean | raw peak | ma peak | lp peak |
|---|---|---|---|---|---|---|---|
| 1 | Stand still 5 s | | | | | | |
| 2 | Walk 5 s | | | | | | |
| 3 | One CMJ | | | | | | |

The point of trial 3 is to make the trade-off visible: a long moving average
will smear the CMJ peak, a low-pass with a small alpha will smooth standing
noise but lag during the jump.

## Discussion prompts

- "When is `alpha = 0.1` better than a 10-sample moving average?" Use to
  introduce frequency response intuitively.
- "If your filter changes the timing of a peak, can you still call it a peak?"
  Use to introduce phase delay.
- "If the device sampled at 50 Hz instead of 200 Hz, would the same filter
  do the same thing?" Use to motivate why filter parameters depend on
  sampling rate.

## Filter-vs-task table

Have learners fill this in during the "Choose" block:

| Task | Recommended filter | Why |
|---|---|---|
| Step count from `gotConvertedAcc` | | |
| CMJ landing peak | | |
| Standing posture (mean tilt) | | |
| _Your own task_ | | |

Reasonable answers:
- Step count: short moving average or no filter; the gait callback already
  encapsulates a detector.
- CMJ landing peak: no filter; smoothing reduces the peak you are trying to
  measure.
- Standing posture: long moving average or low-pass; you want the signal that
  is _not_ moving.

## Assessment ideas

- A short reflection naming one situation where adding a filter would mask a
  bug rather than fix one.
- A code review where learners explain the difference between "filter the
  stream" and "filter what you log."

## Safety and ethics

- No new physical risk. Standard CMJ safety from Lesson 06 applies if you
  include a jump trial.

## References

- Smith, S. W. _The Scientist and Engineer's Guide to Digital Signal
  Processing_. California Technical Publishing, 1997. Free online; chapters
  on moving average and recursive filters are accessible to non-EE majors.
- Oppenheim, A. V. and Schafer, R. W. _Discrete-Time Signal Processing_. 3rd
  ed., Pearson, 2010. Reference for instructors who want the formal version.

## Out of scope

- Frequency-domain methods (FFT, spectrograms). Defer to a Tier 3 lesson.
- Causal vs non-causal filters. Mention only.
- Filter design from a target frequency response. The lesson teaches two
  filters by name, not by derivation.

## Open questions for the human owner

- Do we want to ship a small filter helper inside `CoreAnalytics` later
  (e.g. `CoreAnalytics.movingAverage`) so learners stop pasting console
  code?
- Should the lesson include an FFT excursion at the end, or stay strictly
  time-domain?
