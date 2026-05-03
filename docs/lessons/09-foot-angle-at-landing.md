# Lesson 09: Foot Angle at Landing

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: students with prior gait vocabulary (Lessons 01 and 02) and
  basic familiarity with the difference between a peak detector and a
  continuous signal.
- Devices: 1 ORPHE CORE per learner pair, mounted firmly on the dominant
  foot.
- Notification: `STEP_ANALYSIS_AND_SENSOR_VALUES`. The lesson uses
  `gotFootAngle`, `gotLandingImpact`, and `gotPronation`.
- Example: planned `examples/FOOT-ANGLE-DASHBOARD/` (sibling PR in this
  Tier 2 sprint). Fallback: `examples/CORETOOLKIT-STARTER/` with a
  developer-console collector.
- Browser: Chrome on macOS or Windows.

## Learning objectives

By the end of the session, learners can:

1. Define foot angle at landing (also called foot strike angle) and explain
   why it is one of several plausible characterizations of "how the foot
   meets the ground."
2. Read the three callback payloads relevant to landing (`gotFootAngle`,
   `gotLandingImpact`, `gotPronation`) and explain what each does and does
   not capture.
3. Distinguish three commonly described landing styles (heel, midfoot, fore)
   from the foot-angle signal and discuss why a bin label is not the same
   as a measurement.

## Required materials

- One laptop per pair, charged.
- One ORPHE CORE per pair, charged.
- A 10 m walking lane and a 10 m jogging lane (the same lane is fine).
- Optional: a phone with a slow-motion camera for cross-checking landing
  style.

## Pre-class setup

The instructor should:

- Confirm `gotFootAngle` events fire while walking on the planned dashboard
  or in the fallback console collector.
- Decide and announce the heel/midfoot/fore bin thresholds the lesson will
  use, to keep classroom variability honest. A reasonable starting set is
  `< 5°` fore, `5–15°` midfoot, `> 15°` heel; the actual numbers depend on
  mounting and should be re-validated against camera footage when possible.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Show one slow-motion clip of a heel landing and one of a forefoot landing. Ask: "What do you think the device is going to disagree with you about?" |
| 5–15 min | Concept | Walk through the three callbacks. `gotFootAngle.value` is the angle at landing. `gotLandingImpact.value` is a magnitude proxy. `gotPronation` is a 3-axis rotation. Discuss why the device cannot label "heel/midfoot/fore" by itself. |
| 15–35 min | Hands-on | Pairs perform three sets of 10 walks and 10 jogs each, deliberately changing landing style between sets. They record foot angle, landing impact, and pronation per stride. |
| 35–42 min | Bin | Pairs assign each stride to one of the three landing-style bins using the announced thresholds. They count agreements and disagreements with their intended style. |
| 42–45 min | Debrief | Pairs share one stride that the device labeled differently than they intended and propose why. |

## Hands-on activity

| Trial | Activity | n strides | Mean foot angle (°) | Mean landing impact | Mean pronation magnitude | Bin distribution (heel / mid / fore) |
|---|---|---|---|---|---|---|
| 1 | Walk, deliberately heel-strike | | | | | |
| 2 | Walk, deliberately fore-strike | | | | | |
| 3 | Jog, natural | | | | | |

The point of trial 3 is to surface that "natural" is not a single bin —
many learners' jog landings are bimodal across the foot.

## Code snippet for the fallback path

If `FOOT-ANGLE-DASHBOARD` is not yet available, paste the following into the
developer console of `CORETOOLKIT-STARTER`:

```javascript
window.landingLog = [];
bles[0].gotFootAngle = function (fa) {
  window.landingLog.push({ t: performance.now(), angle: fa.value });
};
bles[0].gotLandingImpact = function (li) {
  const last = window.landingLog[window.landingLog.length - 1];
  if (last && performance.now() - last.t < 100) last.impact = li.value;
};
bles[0].gotPronation = function (p) {
  const last = window.landingLog[window.landingLog.length - 1];
  if (last && performance.now() - last.t < 100) {
    last.pronationMagnitude = Math.hypot(p.x, p.y, p.z);
  }
};

function binStride(angle) {
  if (angle < 5)  return 'fore';
  if (angle < 15) return 'mid';
  return 'heel';
}

function trialReport() {
  const samples = window.landingLog.slice();
  const bins = { heel: 0, mid: 0, fore: 0 };
  for (const s of samples) {
    if (typeof s.angle === 'number') bins[binStride(s.angle)]++;
  }
  return { n: samples.length, bins, samples };
}
```

Reset between trials with `window.landingLog = [];`.

## Discussion prompts

- "Why is a single threshold table never the right answer for cross-learner
  comparison?" Use to motivate that mounting and shoe geometry shift the
  numbers.
- "If your jog produces a bimodal foot-angle distribution, is that a coaching
  moment or a measurement moment?"
- "What would change if the device were on the other foot?"

## Assessment ideas

- A short reflection comparing the bin thresholds the class used to a
  threshold scheme the learner finds in the literature, with one paragraph
  on which they would prefer for their own data and why.
- A code review where learners explain why the snippet attaches `impact`
  and `pronationMagnitude` to the most recent foot-angle sample within a
  100 ms window, and what assumption that bakes in.

## Safety and ethics

- Deliberately changing landing style risks discomfort. Allow pairs to opt
  out and act as recorders. Do not push to fatigue.
- Slow-motion video, if used, should be deleted at the end of class unless
  a separate consent has been collected.

## References

- Lieberman, D. E. et al. "Foot Strike Patterns and Collision Forces in
  Habitually Barefoot Versus Shod Runners." _Nature_, vol. 463, no. 7280,
  2010. Use to ground the discussion of why landing style is interesting.
- Altman, A. R. and Davis, I. S. "A Kinematic Method for Footstrike Pattern
  Detection in Barefoot and Shod Runners." _Gait & Posture_, vol. 35, no. 2,
  2012. Use as a reference for the angle-based classification scheme that
  the lesson loosely follows.

## Out of scope

- Force-platform comparisons. ORPHE CORE is an inertial sensor.
- Coaching or shoe-recommendation conclusions. The lesson is about
  measurement, not prescription.

## Open questions for the human owner

- The bin thresholds (5° / 15°) are placeholders. Should they be tuned per
  cohort against camera footage before the lesson is published?
- Should the planned `FOOT-ANGLE-DASHBOARD` example expose the bin
  thresholds as a UI control, or hard-code them and let the lesson discuss
  the trade-off?
