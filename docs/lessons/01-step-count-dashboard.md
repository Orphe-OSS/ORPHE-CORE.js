# Lesson 01: Step Count Dashboard

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: introductory sports science, HCI, or physical computing students
  with basic JavaScript reading ability.
- Devices: 1 ORPHE CORE per learner pair.
- Notification: `STEP_ANALYSIS`.
- Example: `examples/STEP-COUNT-DASHBOARD/` (planned in a sibling PR). Until it
  lands, run the lesson against `examples/CORETOOLKIT-STARTER/` and use the
  console to inspect `gotGait` / `gotStepsNumber`.
- Browser: Chrome on macOS or Windows. Safari and Firefox cannot use Web
  Bluetooth.

## Learning objectives

By the end of the session, learners can:

1. Explain why a foot-mounted IMU can count steps even when the wearer is
   walking in place, and where that breaks down.
2. Read the difference between an event-driven `STEP_ANALYSIS` callback and a
   high-rate `SENSOR_VALUES` callback.
3. Modify a small dashboard to add a new metric (for example, the moving
   average of cadence over the last 10 steps).

## Required materials

- One laptop per pair, charged, on a campus or guest network.
- One ORPHE CORE module per pair, charged, with the foot mount attached.
- A 3 m straight walking lane and a 5 m lane.
- Stopwatch on the instructor's phone for the validation activity.

## Pre-class setup

The instructor should:

- Clone the repo and run `python3 -m http.server 8767` from the repo root.
- Confirm `examples/STEP-COUNT-DASHBOARD/index.html` (or
  `examples/CORETOOLKIT-STARTER/index.html` as the fallback) opens in Chrome and
  the CoreToolkit switch is enabled.
- Pre-pair the demo ORPHE CORE so the instructor demo doesn't burn class time on
  the device chooser.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Show one walking demo. Ask learners to predict what the dashboard reports and what it cannot infer. |
| 5–15 min | Concept | Walk through `STEP_ANALYSIS` vs `SENSOR_VALUES` using the side-by-side table from `CLAUDE.md`. Explain why this lesson uses the lower-rate event stream. |
| 15–35 min | Hands-on | Pairs walk a 5 m lane three times: normal pace, deliberately small steps, and walking in place. They record the dashboard's step count and the human-counted step count for each trial. |
| 35–42 min | Modify | Add one of the suggested code snippets (see "Modification ideas") to the example and re-run a single 5 m trial. |
| 42–45 min | Debrief | Each pair reports one moment where the device count and the human count diverged and proposes a hypothesis. |

## Hands-on activity

Pairs use the planned `examples/STEP-COUNT-DASHBOARD/` page (or
`examples/CORETOOLKIT-STARTER/` with the developer console showing
`gotStepsNumber` updates) and complete this trial table:

| Trial | Description | Human-counted steps | Device-counted steps | Notes |
|---|---|---|---|---|
| 1 | Normal pace, 5 m lane | | | |
| 2 | Deliberately tiny steps, 5 m lane | | | |
| 3 | Walking in place for 20 s | | | |

The point of trial 2 is to surface that step detection has a minimum signal
threshold, and the point of trial 3 is to surface that the device measures foot
events, not floor displacement.

## Modification ideas

Have learners add one of the following to the dashboard's `<script>` block. The
exact API names match the planned `examples/STEP-COUNT-DASHBOARD/` example; if
you are using `CORETOOLKIT-STARTER` as a fallback, attach the same logic to
`bles[0].gotGait`.

```javascript
// 1. Show the rolling 10-step cadence in steps/min.
let stepTimestamps = [];
ble.gotGait = function () {
  stepTimestamps.push(performance.now());
  if (stepTimestamps.length > 10) stepTimestamps.shift();
  if (stepTimestamps.length >= 2) {
    const elapsedSec = (stepTimestamps.at(-1) - stepTimestamps[0]) / 1000;
    const cadence = ((stepTimestamps.length - 1) / elapsedSec) * 60;
    document.getElementById('cadence').textContent = cadence.toFixed(0);
  }
};

// 2. Show the swing/stance ratio.
ble.gotGait = function (gait) {
  const swing = gait.swing_phase_duration ?? 0;
  const stance = gait.standing_phase_duration ?? 0;
  if (stance > 0) {
    document.getElementById('ratio').textContent = (swing / stance).toFixed(2);
  }
};
```

## Discussion prompts

- "Where would you trust a foot-mounted step count more than a wrist-mounted
  one, and where would you trust the wrist more?"
- "If you wanted to compare two students' step counts, what new question would
  you have to answer about the device or the protocol?"
- "What does it mean that the device gives you both `steps` on `gait` and a
  separate `gotStepsNumber` callback?" Use this to introduce the idea that
  redundant signals exist for different application styles.

## Assessment ideas

- A two-paragraph reflection naming one limitation of the dashboard for a
  rehabilitation context. Look for whether learners recognize that step count
  alone does not describe gait quality.
- A small code change reviewed in pairs. The grade is on whether the code reads
  and stops cleanly, not on bytes added.

## Safety and ethics

- The ORPHE CORE module is small and falls inside the shoe, so the only
  physical risk is dropping the laptop while learners switch shoes. Have
  learners sit while attaching the module.
- Treat all step counts as personal data for the duration of the class and have
  learners delete browser localStorage for the example after class if any
  identifying notes were typed in.

## References

- Whittle, M. W. _Gait Analysis: An Introduction_. 5th ed., Churchill
  Livingstone, 2014. Chapter on the gait cycle for swing/stance terminology.
- Bouten, C. V. C. et al. "A Triaxial Accelerometer and Portable Data Processing
  Unit for the Assessment of Daily Physical Activity." _IEEE Transactions on
  Biomedical Engineering_, vol. 44, no. 3, 1997. Used to anchor the lesson's
  framing of why a foot IMU is a reasonable activity sensor.

## Out of scope

- Comparisons to clinical gold-standard gait labs. Mention as a follow-up
  research direction, not a class deliverable.
- Statistical tests on the trial table. Defer to a follow-up methods class.

## Open questions for the human owner

- Should the dashboard expose step count from `gotGait.steps` or from
  `gotStepsNumber`? Decide before this lesson is published so the activity
  matches the example.
- Do we want a printable trial table for classroom use? If yes, generate from
  this Markdown rather than maintaining a parallel PDF.
