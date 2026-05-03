# Lesson 06: Vertical Jump (Countermovement Jump)

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: students with prior physics or biomechanics exposure who can read
  a small JavaScript callback. Lesson assumes Lessons 01–02 vocabulary
  (cadence, swing/stance) and Lesson 04's data inspection habits.
- Devices: 1 ORPHE CORE per learner pair, mounted on the dominant foot.
- Notification: `SENSOR_VALUES`. Use range `acc=16`, `gyro=2000` so peaks are
  not clipped; this matches the action-game guidance in `CLAUDE.md`.
- Example: a CMJ panel inside the planned `examples/STEP-COUNT-DASHBOARD/` or
  a small standalone CMJ example. Until either lands, run the lesson against
  `examples/CORETOOLKIT-STARTER/` with `STEP_ANALYSIS_AND_SENSOR_VALUES` and
  inspect `bles[0].gotConvertedAcc` from the developer console.
- Browser: Chrome on macOS or Windows.

## Learning objectives

By the end of the session, learners can:

1. Describe the four phases of a countermovement jump (CMJ): unweighting,
   braking, propulsion, flight, and landing.
2. Use a foot-mounted IMU to identify the unweighting and landing peaks in
   `gotConvertedAcc` and explain why the flight phase is the part the IMU does
   _not_ measure directly.
3. Compute a flight-time-based jump height estimate and discuss why it
   differs from a force-platform estimate.

## Required materials

- One laptop per pair, charged.
- One ORPHE CORE per pair, charged, mounted on the dominant foot.
- A 2 m × 2 m clear floor area per learner.
- Optional: a phone with a slow-motion camera for cross-checking flight time.

## Pre-class setup

The instructor should:

- Confirm the lesson page connects and the connector switch is on.
- Run one CMJ themselves and confirm the `gotConvertedAcc` magnitude rises to
  at least 4–5 G at landing on the chosen device, so the lesson does not chase
  ghost peaks.
- Lay out clear floor space and remind learners not to jump on a desk chair
  area.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Show one slow-motion CMJ if available. Ask: "Which moment of this jump do you think the foot sensor measures most directly?" |
| 5–15 min | Concept | Walk the four-phase CMJ on the board. Explain that the IMU sees foot acceleration, not center-of-mass force, so it is excellent at marking events and weaker at amplitudes. |
| 15–35 min | Hands-on | Pairs perform three sets of three CMJs each. Per jump, they record the timestamp of the unweighting trough and the landing peak from `gotConvertedAcc`. They derive flight time = landing time − take-off time. |
| 35–42 min | Compute | Pairs compute jump height from flight time using `h = g × t² / 8` and discuss the assumptions (g = 9.81 m/s², take-off height equals landing height). |
| 42–45 min | Debrief | Each pair reports one source of measurement error and one source of biological variability they observed. |

## Hands-on activity

Per learner, three jumps. Per jump, fill in the table.

| Jump | Take-off time (s) | Landing time (s) | Flight time (s) | Estimated height (cm) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

The estimated height comes from `h = (9.81 × t²) / 8`, where `t` is the flight
time in seconds and `h` is in meters; multiply by 100 for cm.

Take-off time can be estimated as the moment after the unweighting trough
where vertical acceleration crosses back through 1 G upward, and landing time
as the first peak that exceeds an instructor-chosen threshold (start with 4 G).

## Code snippet for the hands-on path

This snippet is intentionally written so it can be pasted into the developer
console of `CORETOOLKIT-STARTER` while waiting for the planned example to
land. It marks events; it does not pretend to be a force platform.

```javascript
window.cmjEvents = [];
const TAKEOFF_THRESHOLD_LOW = 0.6;  // G, magnitude during unweighting
const LANDING_THRESHOLD = 4.0;      // G, peak at landing
let inUnweighting = false;

bles[0].gotConvertedAcc = function (acc) {
  const magnitude = Math.hypot(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0);
  const t = performance.now() / 1000;
  if (!inUnweighting && magnitude < TAKEOFF_THRESHOLD_LOW) {
    inUnweighting = true;
    window.cmjEvents.push({ t, kind: 'takeoff_window_start', magnitude });
  }
  if (inUnweighting && magnitude > LANDING_THRESHOLD) {
    inUnweighting = false;
    window.cmjEvents.push({ t, kind: 'landing', magnitude });
  }
};

function lastJump() {
  const events = window.cmjEvents.slice(-2);
  if (events.length < 2) return null;
  const flight = events[1].t - events[0].t;
  return { flightSec: flight, heightMeters: (9.81 * flight * flight) / 8 };
}
```

The thresholds are deliberately conservative so that this lesson can run
without per-learner tuning. Stronger jumpers will exceed them; the discussion
section below uses that as a teaching moment, not a bug.

## Discussion prompts

- "Why does this method overestimate jump height for some learners and
  underestimate it for others?" Use to introduce that take-off and landing
  postures change effective height of the foot relative to the center of
  mass.
- "If the IMU does not measure the flight phase, why does it give us a flight
  time at all?" Use to discuss event timing vs continuous measurement.
- "What would you change in the protocol if the goal was to compare two
  learners rather than two trials of the same learner?"

## Assessment ideas

- A one-page report comparing each learner's three jumps and proposing one
  protocol change that would make the within-learner numbers more stable.
- A code review where learners explain why `Math.hypot` is used and what would
  change if the lesson used only the z-axis.

## Safety and ethics

- Clear floor space, no chairs in the landing area.
- Learners with recent lower-limb injury opt out and act as recorders.
- Body-weight inferences (e.g., power) are explicitly out of scope; the lesson
  only reports flight time and the derived height.

## References

- Linthorne, N. P. "Analysis of Standing Vertical Jumps Using a Force
  Platform." _American Journal of Physics_, vol. 69, no. 11, 2001. Use for the
  derivation of `h = g × t² / 8` and for the explicit caveats around
  IMU-based estimates.
- Bosco, C., Luhtanen, P., and Komi, P. V. "A Simple Method for Measurement of
  Mechanical Power in Jumping." _European Journal of Applied Physiology and
  Occupational Physiology_, vol. 50, no. 2, 1983. Historical reference for
  flight-time-based jump assessment.

## Out of scope

- Power, strength, or rate-of-force-development estimates. The IMU does not
  measure these directly.
- Comparing across learners as if the numbers were absolute. The lesson is
  about within-learner change and measurement awareness.

## Open questions for the human owner

- Do we want a dedicated CMJ example, or does the CMJ panel live inside the
  Step Count Dashboard? The lesson is written to survive either choice.
- Should we ship a recommended threshold table per body size, or keep the
  threshold tuning as a discussion point? Either is workable; pick one before
  publication so the lesson and the example agree.
