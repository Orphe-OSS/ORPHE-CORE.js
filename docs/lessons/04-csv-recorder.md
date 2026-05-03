# Lesson 04: CSV Recorder

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: students who can read JavaScript and have used a spreadsheet for
  basic data analysis. No prior recording experience required.
- Devices: 1 ORPHE CORE per learner pair.
- Notification: `STEP_ANALYSIS_AND_SENSOR_VALUES`.
- Example: `examples/CSV-RECORDER/` _(planned in a sibling PR)_. Until it
  lands, run the lesson against `examples/SENSOR-CALIBRATION/`, which already
  records CSV in the existing recorder; do not modify that example for the
  lesson.
- Browser: Chrome on macOS or Windows.

## Learning objectives

By the end of the session, learners can:

1. Explain why a recorded CSV file from an IMU is not the same as a clean
   dataset, and identify three things that have to be decided before recording.
2. Record a session, describe the schema of the resulting CSV, and replay or
   plot it in any spreadsheet or notebook.
3. Add one new column to the recorder by defining what value goes into it and
   what timestamp it is anchored to.

## Required materials

- One laptop per pair, charged.
- One ORPHE CORE per pair, charged.
- A short walking lane (5 m is enough).
- A spreadsheet (Google Sheets, Excel, or Numbers) for the post-recording
  inspection.

## Pre-class setup

The instructor should:

- Confirm that the planned recorder example or `SENSOR-CALIBRATION` opens in
  Chrome and the recording controls work.
- Have a sample CSV from a previous run open in the spreadsheet so the class
  can see the target format before they collect their own data.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Show a 5 s recorded CSV. Ask: "What three decisions did the recorder make for you, and which one would you most want to change?" |
| 5–15 min | Concept | Walk through the schema: each row is one sample, columns are timestamp, sample type, and the per-callback fields. Explain why `gotAcc` and `gotConvertedAcc` need different rows or different columns and which the lesson uses. |
| 15–35 min | Hands-on | Pairs record three sessions: 10 s of standing still, 10 s of normal walking, 10 s of stomping in place. They open each CSV in a spreadsheet and inspect at least one cell per sample type. |
| 35–42 min | Modify | Pairs add a column to the recorder for either device id or notification type and re-record one session. |
| 42–45 min | Debrief | Each pair reports one column they wished was already there and what they would use it for. |

## Hands-on activity

Each pair fills in this inspection table for the three sessions. Cell values
are read directly from the spreadsheet view of the CSV.

| Session | Sample types observed | First timestamp | Last timestamp | Approx. samples per second | Notes |
|---|---|---|---|---|---|
| Standing | | | | | |
| Walking | | | | | |
| Stomping | | | | | |

Expected outcomes:

- Standing should have very low gait events but normal `gotConvertedAcc` rates.
- Stomping should produce many `gait` and `landing impact` rows and saturate
  the accelerometer if the range is set to 2 G — this is a good moment to
  return to `CLAUDE.md`'s sensor range guidance.
- Walking should fall in between.

## Code snippet for the fallback path

If learners are using `SENSOR-CALIBRATION` because the planned example has not
landed yet, do not edit the existing recorder. Instead, attach a parallel
listener for inspection only:

```javascript
window.lessonSamples = [];
const ble = bles[0];
ble.gotConvertedAcc = function (acc) {
  window.lessonSamples.push({ t: Date.now(), kind: 'acc', x: acc.x, y: acc.y, z: acc.z });
};
ble.gotGait = function (gait) {
  window.lessonSamples.push({ t: Date.now(), kind: 'gait', steps: gait.steps, swing: gait.swing_phase_duration });
};
function downloadLessonCSV() {
  const header = 't,kind,x,y,z,steps,swing\n';
  const rows = window.lessonSamples.map(s =>
    `${s.t},${s.kind},${s.x ?? ''},${s.y ?? ''},${s.z ?? ''},${s.steps ?? ''},${s.swing ?? ''}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'lesson-04.csv' });
  a.click();
  URL.revokeObjectURL(url);
}
```

This is a teaching helper, not the recorder API. The planned `CoreRecorder.js`
helper provides a real, opt-in feed-based recorder.

## Discussion prompts

- "If two learners record the same walk, why would their CSVs be different
  shapes?" Use to introduce the idea that recordings are sampled, not
  continuous.
- "What is the right timestamp for an analysis you have not designed yet?"
  Discuss the trade-off between `performance.now()`, `Date.now()`, and the
  device-emitted timestamp where available.
- "If you wanted to share this CSV publicly, what would you remove or
  anonymize?"

## Assessment ideas

- A one-page reflection describing the schema of a recorded CSV and one column
  the learner would add, with the new column's definition.
- A code review where learners explain why the `gotAcc` and `gotConvertedAcc`
  callbacks both exist and which one they used.

## Safety and ethics

- The recording can include enough sensor data to identify a person across
  sessions. Treat all CSVs as personal data and do not share off the local
  laptop without consent.
- Do not record minors without parental consent if the cohort includes them.

## References

- Bouten, C. V. C. et al. "A Triaxial Accelerometer and Portable Data
  Processing Unit for the Assessment of Daily Physical Activity." _IEEE
  Transactions on Biomedical Engineering_, vol. 44, no. 3, 1997. Use to ground
  the discussion of what an IMU recording is.
- Tukey, J. W. _Exploratory Data Analysis_. Addison-Wesley, 1977. Use for the
  framing that inspecting a recording is itself a method, not a chore.

## Out of scope

- File formats other than CSV. JSON support is intentionally introduced in
  Lesson 05 (Replay Player), not here.
- Cloud upload or remote storage. Out of scope for this lesson and not
  supported by the planned recorder.

## Open questions for the human owner

- The planned `CoreRecorder.js` API uses opt-in `feedAcc` / `feedGait` calls.
  Should this lesson teach learners to wire those calls themselves, or hide
  them behind a single "start recording" button in the example?
- Do we want to ship a small synthetic CSV with the example so this lesson can
  be run without a device for at least the inspection block?
