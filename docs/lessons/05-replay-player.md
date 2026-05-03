# Lesson 05: Replay Player

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: students who have completed Lesson 04 (CSV Recorder) or have a
  recording from a prior session. The lesson runs without a device by using a
  shipped synthetic sample.
- Devices: 0 (synthetic sample) or 1 (live recording at the start of class).
- Notification: none from BLE; the player calls the same callback shapes from
  recorded JSON.
- Example: `examples/REPLAY-PLAYER/` _(planned in a sibling PR)_, including a
  `sample-session.js` that boots without hardware. Until it lands, run the
  lesson by manually feeding a JSON array into a Lesson 04 recording in the
  developer console.
- Browser: Chrome on macOS or Windows. Safari and Firefox are fine for replay
  even though they cannot do live BLE.

## Learning objectives

By the end of the session, learners can:

1. Explain why replay is a different problem from recording, and name two
   things a replay player must decide that a recorder did not.
2. Step through a recorded session and inspect the same callback payloads
   their analysis code would see live.
3. Distinguish a clean playback (one event per real event) from a re-issued
   playback (the same event fired multiple times) and explain when each is
   appropriate.

## Required materials

- One laptop per pair, charged. No ORPHE CORE required.
- The shipped `sample-session.js` from the planned example.
- Optional: a CSV or JSON recording from Lesson 04 to use as a second dataset.

## Pre-class setup

The instructor should:

- Confirm that the planned `examples/REPLAY-PLAYER/` page opens, plays the
  shipped sample, and surfaces the timestamps and callback names as it plays.
- If using a Lesson 04 recording, convert it to JSON ahead of time so class
  time is spent on analysis, not format conversion.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Play the shipped sample. Ask: "If this had a bug, where in the recorder, the file, or the player would you look first?" |
| 5–15 min | Concept | Walk through what the player does: read the JSON, sort by timestamp, schedule each callback to fire at the right relative time. Discuss real-time vs faster-than-real-time playback. |
| 15–35 min | Hands-on | Pairs play three sessions: the shipped sample at 1×, the shipped sample at 4×, and (if available) a Lesson 04 recording at 1×. They record the elapsed playback time and the number of `gotGait` events. |
| 35–42 min | Modify | Pairs reduce the playback to "events only" by filtering the sample to drop `gotConvertedAcc` rows in the player. They observe what their downstream callback code stops receiving. |
| 42–45 min | Debrief | Each pair reports one assumption their analysis code made about the source of the data. |

## Hands-on activity

| Trial | Source | Speed | Elapsed wall time | gotGait events | gotConvertedAcc events | Notes |
|---|---|---|---|---|---|---|
| 1 | Shipped sample | 1× | | | | |
| 2 | Shipped sample | 4× | | | | |
| 3 | Lesson 04 recording (optional) | 1× | | | | |

Discuss why trial 2 should produce the same number of `gotGait` events as
trial 1 in roughly a quarter of the wall time, and why downstream code that
uses `Date.now()` for windows breaks under faster-than-real-time playback.

## Code snippet for the fallback path

If the planned example has not landed yet, the lesson can run from the console
on any page that already loads `ORPHE-CORE.js`. Drop a recorded array into the
page and replay it through a fake `bles[0]`-shaped object:

```javascript
window.recorded = [
  { t: 0, kind: 'gait', payload: { steps: 1, swing_phase_duration: 0.45, standing_phase_duration: 0.55, direction: 2 } },
  { t: 480, kind: 'gait', payload: { steps: 2, swing_phase_duration: 0.46, standing_phase_duration: 0.54, direction: 2 } },
  // ...
];

const fake = { gotGait: function (g) { console.log('gait', g); } };
const start = performance.now();
function playAt(speed = 1) {
  window.recorded.forEach(function (sample) {
    setTimeout(function () {
      if (sample.kind === 'gait' && fake.gotGait) fake.gotGait(sample.payload);
    }, sample.t / speed);
  });
}
playAt(1);
```

This is a teaching helper, not the player API. The planned `CoreRecorder.js`
helper provides a `replay` shape that feeds the real callback model without
requiring the user to write the loop above.

## Discussion prompts

- "What does it mean for a callback that was originally driven by a sensor to
  now be driven by a file?" Use to introduce determinism.
- "If your analysis code uses `performance.now()` to measure elapsed time, what
  happens during a 4× replay?" Use to motivate that the player should provide a
  virtual clock the analysis code can opt into.
- "Why would you ever not want a perfect replay?" Use to introduce
  data-augmentation use cases.

## Assessment ideas

- A one-paragraph reflection on whether the learner's downstream analysis code
  would survive being replayed at 4×, and what change would make it survive.
- A small code change that adds a "skip first 2 seconds" feature to the
  playback loop, to surface that the player is just code.

## Safety and ethics

- Replays remove some of the immediacy of personal data, but the underlying
  recording is still personal. Use only the shipped sample or fully consenting
  recordings.

## References

- Tukey, J. W. _Exploratory Data Analysis_. Addison-Wesley, 1977. Carry over
  from Lesson 04 — replay is part of inspection.
- Hilbert, M. and López, P. "The World's Technological Capacity to Store,
  Communicate, and Compute Information." _Science_, vol. 332, no. 6025, 2011.
  Use for a one-line framing that recorded data outlives the moment of
  recording.

## Out of scope

- Networked or multi-machine replay. The lesson runs locally only.
- Re-encoding recordings into different schemas. Stick to the JSON shape the
  recorder produces.

## Open questions for the human owner

- Should the player support a virtual clock (a `now()` injected into analysis
  code), or rely on `performance.now()` and document the trade-off? The lesson
  can teach either, but please pick one.
- The synthetic sample shipped with the example should be short enough to
  iterate on (≤30 s) and long enough to show a few `gotGait` events. Confirm
  the target length before this lesson is published.
