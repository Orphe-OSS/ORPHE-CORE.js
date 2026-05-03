# Lesson 03: Left/Right Symmetry

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: students who have completed Lessons 01 and 02 and are comfortable
  switching between two CoreToolkit instances.
- Devices: 2 ORPHE CORE modules per learner pair, one per foot. The lesson can
  fall back to a one-device protocol where the same learner walks twice (once
  per foot) and the data is compared post hoc.
- Notification: `STEP_ANALYSIS`.
- Example: dual-device variant of the planned `examples/STEP-COUNT-DASHBOARD/`,
  or `examples/CORETOOLKIT-STARTER/` opened twice with `bles[0]` and `bles[1]`
  bound to the left and right modules.
- Browser: Chrome on macOS or Windows.

## Learning objectives

By the end of the session, learners can:

1. Define the symmetry index used in the lesson and explain what it does and
   does not capture about gait.
2. Identify at least two physiological reasons two healthy walkers might show
   stable, non-zero asymmetry.
3. Use a paired left/right ORPHE CORE setup to compute symmetry from cadence,
   swing time, and stride length.

## Required materials

- One laptop per pair, charged.
- Two ORPHE CORE modules per pair, charged. One mounted on the left shoe and
  one on the right shoe.
- A 10 m walking lane.
- The trial table from Lesson 02 (cadence and stride values are reused).

## Pre-class setup

The instructor should:

- Confirm that two CoreToolkit switches initialize and that the device chooser
  can distinguish the two modules. Pre-pair both before class.
- Confirm `bles[0].id === 0` and `bles[1].id === 1` after both connect, since
  the lesson uses `this.id` inside callbacks.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Show a short video or live demo of two walkers, one with and one without a mild asymmetry. Ask: "How would you measure that the walkers are different without saying which is 'normal'?" |
| 5–15 min | Concept | Introduce the symmetry index used here: SI = 2 × (R − L) / (R + L) × 100. Discuss why the absolute value is what is reported in most studies and why a zero SI does not mean a perfectly symmetric gait. |
| 15–35 min | Hands-on | Pairs walk a 10 m lane three times. They record left and right cadence, swing time, and stride magnitude per trial, then compute SI for each metric. |
| 35–42 min | Compare | Pairs swap modules to check for device bias: rerun trial 1 with the left and right modules switched. |
| 42–45 min | Debrief | Each pair reports one source of asymmetry that came from the device, the protocol, or the human, and proposes how to control for it. |

## Hands-on activity

For each trial, learners record per foot:

- `cadence_L`, `cadence_R` from `gotGait` events.
- `swing_L`, `swing_R` from `gait.swing_phase_duration`.
- `stride_L`, `stride_R` from the magnitude of `gotStride`.

For each metric `M`, learners compute:

```
SI = 2 × |R − L| / (R + L) × 100   // Robinson symmetry index, percent
```

| Trial | Description | Cadence SI | Swing SI | Stride SI | Notes |
|---|---|---|---|---|---|
| 1 | Normal pace | | | | |
| 2 | Carrying a bag in the right hand | | | | |
| 3 | Trial 1 with modules swapped | | | | |

The expected discussion is that trial 2 shifts SI in a known direction and
trial 3 shows whether the shift came from the body or from the modules.

## Code snippet for the fallback path

If the planned dashboard is not yet available, learners can collect data from
`CORETOOLKIT-STARTER` opened with both switches on, then run:

```javascript
window.lr = { 0: [], 1: [] };
[0, 1].forEach(function (id) {
  bles[id].gotGait = function (gait) {
    window.lr[this.id].push({
      t: performance.now(),
      steps: gait.steps,
      swing: gait.swing_phase_duration,
      stance: gait.standing_phase_duration,
    });
  };
  bles[id].gotStride = function (stride) {
    window.lr[this.id].push({
      t: performance.now(),
      strideMag: Math.hypot(stride.x ?? 0, stride.y ?? 0, stride.z ?? 0),
    });
  };
});

function summarize(samples, key) {
  const values = samples.map(s => s[key]).filter(v => typeof v === 'number');
  return values.reduce((a, b) => a + b, 0) / (values.length || 1);
}

function symmetryIndex(left, right) {
  return (2 * Math.abs(right - left)) / (right + left) * 100;
}
```

## Discussion prompts

- "Why is symmetry not a goal in itself?" Use to introduce the idea that
  asymmetry can be functional (e.g., dominant kicking leg in soccer).
- "Your SI is 4% on cadence but 18% on stride. Which one would you investigate
  first and why?"
- "What part of this protocol is sensitive to mounting?" Use to motivate the
  module-swap trial.

## Assessment ideas

- A short report (one page) describing the symmetry pattern of one learner
  across three trials, with one paragraph on what would have to be true for
  this number to mean something clinical.
- A code reading exercise where learners trace why `this.id` is `0` or `1`
  inside the gait callback (it must be a regular function, not an arrow
  function).

## Safety and ethics

- Asymmetry data can feel personal. Do not require learners to share their own
  numbers; allow opting out and using a peer's anonymized data for the
  reflection.
- Two-module setups require two BLE pairings, so plan for an extra 2–3 minutes
  per pair on the first run.

## References

- Robinson, R. O., Herzog, W., and Nigg, B. M. "Use of Force Platform
  Variables to Quantify the Effects of Chiropractic Manipulation on Gait
  Symmetry." _Journal of Manipulative and Physiological Therapeutics_, vol. 10,
  no. 4, 1987. Use as the original source of the SI formula.
- Sadeghi, H. et al. "Symmetry and Limb Dominance in Able-Bodied Gait: A
  Review." _Gait & Posture_, vol. 12, no. 1, 2000. Use to ground the discussion
  that asymmetry is normal.

## Out of scope

- Statistical inference on small N. Lesson treats SI as a descriptive number.
- Mediolateral COP analysis. ORPHE CORE is an inertial sensor, not a pressure
  insole. Mention as a follow-up technology comparison.

## Open questions for the human owner

- Should the planned dashboard surface SI directly or only the per-foot
  numbers? If it computes SI, lock the formula to the Robinson SI used here so
  the lesson and the example agree.
- Do we want a sample dataset of left/right walking shipped in the example so
  this lesson can be run without two devices?
