# Lesson 10: From Recording to Research

Status: `draft`. Reviewed by: _none yet_.

## At a glance

- Duration: 45 minutes.
- Audience: students who have completed at least Lessons 04 (CSV Recorder)
  and 05 (Replay Player), or who arrive with their own recorded session.
- Devices: 0 (workflow lesson). One ORPHE CORE if the class collects a fresh
  recording during the session.
- Notification: any. The lesson is about what happens after the device is
  put away.
- Example: planned `examples/CSV-RECORDER/` (PR #82) and
  `examples/REPLAY-PLAYER/` (PR #84). Until those land, use any existing
  recorded JSON the instructor has on hand.
- Browser: Chrome on macOS or Windows for any live BLE work; any browser
  for replay and analysis.

## Learning objectives

By the end of the session, learners can:

1. Describe the four stages of an end-to-end ORPHE CORE workflow —
   record, replay, analyze, share — and one decision that lives in each
   stage.
2. Distinguish between data wrangling that is documentation
   (reproducible, version-controlled) and data wrangling that is throwaway
   (one-off scripts in a notebook).
3. Outline a small research-style question their cohort could answer with
   one ORPHE CORE and a 30-minute protocol, and identify where the project
   would stop in this lesson.

## Required materials

- One laptop per pair, charged.
- A previously recorded JSON file shared by the instructor, or one collected
  in the first 5 minutes of class.
- A blank document (any editor) for the project skeleton activity.

## Pre-class setup

The instructor should:

- Have a 60-second recorded JSON file (synthetic or real) ready to share via
  a URL or a local file copy.
- Pick the worked example for the "analyze" stage. Reasonable choices:
  cadence over time, stride CoV across the recording, or a CMJ event count.
- Decide whether the cohort is going to share recordings publicly or only
  inside the room — this changes the "share" stage discussion.

## Schedule

| Time | Block | Activity |
|---|---|---|
| 0–5 min | Frame | Show a recording, a derived plot, and one sentence of conclusion. Ask: "What did the analyst _decide_ that you cannot see in the plot?" |
| 5–15 min | Concept | Walk through the four-stage workflow on the board. For each stage, name one decision and one common failure mode. |
| 15–30 min | Hands-on | Pairs replay the shared recording in the planned `REPLAY-PLAYER` example (or a developer-console replay), compute the worked example metric, and write down their result. |
| 30–40 min | Project | Each pair drafts a one-page project skeleton using the supplied template. |
| 40–45 min | Debrief | Two pairs read their project skeleton aloud and the class flags the one decision that would most change the result. |

## The four-stage workflow

| Stage | One decision | One failure mode |
|---|---|---|
| Record | What to record (notification type, device range, session length). | Recording everything, then realizing the per-trial label is missing. |
| Replay | Replay speed, which handlers to wire. | Treating replayed time as wall time in downstream code. |
| Analyze | Which metric, which subset, which baseline. | Sliding the analysis until the desired result appears. |
| Share | Who sees the recording, the metric, or only the conclusion. | Shipping a CSV with identifiers because nobody removed them. |

## Project skeleton template

Pairs fill this in during the 10-minute "Project" block.

```
Title:
  (One sentence stating the question.)

Cohort and N:
  (Who, how many, recruited how.)

Protocol (30 minutes total):
  Step 1 ........... (e.g. baseline 2 minute walk)
  Step 2 ...........
  Step 3 ...........

Recording configuration:
  Notification type:
  Range (acc, gyro):
  Session label:
  Metadata to attach:

Analysis plan:
  Metric:
  Comparison:
  What would convince you of the answer?

Sharing plan:
  Who sees the recording:
  Who sees the derived metric:
  Who sees only the conclusion:

Where this project stops in this lesson:
  (Be honest about what is doable in 30 minutes vs what becomes a follow-up.)
```

## Discussion prompts

- "If two researchers analyze the same recording and report different
  numbers, where in the four stages did they diverge?"
- "Which stage do you think is the most reproducible, and which the least?"
- "What is the smallest change to the recording stage that would force a
  change in the sharing stage?" Use to surface that consent and identifiers
  must be decided up front, not at publication.

## Assessment ideas

- A one-page reflection turning the project skeleton into a paragraph the
  learner could send to a mentor for feedback.
- A code review where learners trace one analysis script (their own or
  shared) and annotate which choices are documented and which are
  throwaway.

## Safety and ethics

- This is the lesson where the cohort confronts data ethics directly.
  Reserve at least 5 minutes of the share-stage discussion for real consent,
  not abstract consent. If the class is going to share recordings outside
  the room, walk through the explicit decision before the recording starts,
  not after.

## References

- Wickham, H. and Grolemund, G. _R for Data Science_. 2nd ed., O'Reilly,
  2023. Free online; the chapters on workflow and reproducibility translate
  cleanly to JavaScript notebooks.
- Sandve, G. K. et al. "Ten Simple Rules for Reproducible Computational
  Research." _PLOS Computational Biology_, vol. 9, no. 10, 2013. Short and
  classroom-friendly.
- Wilkinson, M. D. et al. "The FAIR Guiding Principles for Scientific Data
  Management and Stewardship." _Scientific Data_, vol. 3, 2016. Use the
  one-paragraph summary, not the full article, in class.

## Out of scope

- Statistical inference, hypothesis testing, or sample-size justification.
- Choice of programming language for the analysis stage. The lesson is
  language-agnostic on purpose.
- Publication strategy and authorship.

## Open questions for the human owner

- Should this lesson live as Lesson 10 in the Tier 1 ladder, or be moved
  into a separate "research workflow" track once we add Tier 3 lessons?
- Do we want to ship a worked-example notebook (Python or JS) alongside
  this lesson? It would anchor the "analyze" stage in code.
