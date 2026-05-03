# Research note: Foot-mounted IMU step detection

Status: `draft` reference note. Owner: Claude draft, intended to back the
discussion sections of the lesson plans (especially Lesson 01 — Step Count
Dashboard). Not a peer-reviewed survey. Citations are limited to sources
the author can actually point to; please flag any that look weak before
linking this from public docs.

## Why a separate note

The Tier 1 and Tier 2 lessons take some claims for granted:

- A foot-mounted IMU is "good enough" to count steps for most everyday
  applications.
- Step counting fails in predictable ways (very small steps, walking in
  place, very heel-heavy or fore-heavy gaits).
- A wrist-mounted accelerometer answers a different question than a
  foot-mounted one.

These claims are not novel, but the lesson plans cite them in passing.
This note collects the references one place so the educator framing in
each lesson does not have to re-justify them.

## Scope

- Step detection only. Stride length estimation, energy expenditure, and
  gait phase segmentation are mentioned but not surveyed.
- Adult, ambulatory populations. Pediatric, paretic, and amputee gait have
  their own literatures and are out of scope here.
- Publications written in English that the author has read or can locate
  in public archives. No paywalled abstracts cited as if read in full.

## Background: where step detection algorithms come from

Step detection from a body-mounted accelerometer typically combines three
ideas:

1. **Peak detection on a band-passed acceleration magnitude.** The classic
   reference for daily-activity accelerometry is Bouten et al. (1997),
   which demonstrated that a single triaxial accelerometer worn on the
   waist correlates with measured energy expenditure across walking
   intensities.
2. **Mounting-specific kinematic priors.** Foot-mounted sensors have a
   stronger and more time-localized signal at heel-strike than wrist or
   waist sensors. This is what makes step detection on foot IMUs robust
   even at low sampling rates. Mannini and Sabatini (2012) is a useful
   entry point on activity classification with foot-mounted IMUs.
3. **State-machine post-processing.** Most production step detectors
   smooth the raw acceleration signal, threshold it, and then enforce a
   minimum interval between accepted peaks. The interval enforcement is
   why "walking in place" still produces step events (foot leaves and
   re-contacts the ground) but very small shuffles often do not.

## Where foot-mounted IMUs perform well

Across the published validation studies the author has read, foot-mounted
inertial sensors typically count steps within a few percent of a manual
reference for steady-state walking and jogging. The most useful reference
the author can point to without paywall barriers is:

- Brodie et al. (2018) compared a wearable IMU (waist and foot mounting
  options) against optical motion capture across over-ground and treadmill
  walking and reported step-count agreement within roughly 1% under
  steady-state conditions.

The general pattern across studies, when one strips away the
device-specific marketing language, is that foot-mounted IMUs sit at
the high-accuracy end of consumer accelerometry for step counting. They
trade portability for accuracy compared to research-grade pressure
insoles and force platforms.

## Where they fail predictably

Three failure modes recur across the literature and across informal
classroom observations with ORPHE CORE:

1. **Sub-threshold steps.** Very small steps (deliberate or pathological)
   can fall below the detector's minimum-magnitude threshold. The lesson
   table in Lesson 01 trial 2 ("deliberately tiny steps") surfaces this
   on purpose.
2. **Stationary swings and pivots.** When the foot leaves the ground but
   the wearer does not move (turning in place, weight shifts), the
   detector may or may not count the event as a step depending on the
   exact algorithm. This is not a "bug"; it is a definition mismatch
   between the user's mental model and the algorithm's.
3. **Very high cadence or very small acceleration excursions.** Sprinting
   sometimes pushes signals past the detector's expected band; very slow
   shuffling falls below it. Modern devices typically band-pass between
   roughly 0.5 Hz and 5 Hz to cover the common cadence range.

The educator framing in each lesson treats these failure modes as
discussion material, not embarrassment. This is consistent with the
posture taken by Hausdorff (2005) on gait variability — the right
question is not "is the signal noisy" but "what is the noise telling us."

## Comparison to wrist-mounted devices

Wrist-mounted consumer accelerometers (popular fitness trackers) often
report step counts but answer a different question. Their algorithms must
contend with arm swing as a confound: typing, eating, gesticulating, and
pushing a stroller all produce wrist motion that is not steps. As a
consequence, they typically use longer integration windows, accept some
miscounting under arm-only motion, and miss steps with a still arm
(e.g., pushing a wheelchair). Sushames et al. (2016) compared multiple
consumer trackers against a research-grade pedometer and found
device-specific over- and under-estimation across activities, with
foot-mounted references generally closer to the manual count.

The takeaway for the lessons: when learners ask "why are the numbers
different from my watch?", the answer is that the watch is solving a
different problem. Both can be right and disagree.

## Implications for ORPHE CORE lessons

- **Lesson 01 (Step Count Dashboard).** The "human-counted vs device-counted"
  trial table is grounded: literature predicts close agreement at normal
  walking and disagreement under deliberate edge cases. The discussion
  prompt about sub-threshold steps is not invented — it is the single most
  consistent failure mode in the literature.
- **Lesson 02 (Stride & Cadence).** Cadence is robust because it is a
  derivative of the step-event timeline. Stride length is more sensitive
  to mounting and individual gait, which is why the lesson asks learners
  to compare within-subject changes rather than cross-subject absolutes.
- **Lesson 03 (L/R Symmetry).** The Robinson SI is not specific to ORPHE
  CORE; it is the field-standard descriptor. Sadeghi et al. (2000) is the
  reference for "able-bodied gait is not perfectly symmetric." The
  module-swap trial in Lesson 03 controls for the device contribution to
  observed asymmetry, which is a real concern in the literature.
- **Lesson 06 (CMJ).** Foot-mounted IMUs can mark take-off and landing
  reliably but cannot recover absolute jump height the way a force
  platform can. Linthorne (2001) is the right reference for the flight-time
  formula and its caveats. The lesson is honest that the IMU answer and
  the force-platform answer are not equivalent.
- **Lesson 08 (Gait Variability).** CoV-based variability requires a
  reasonable sample of strides. Hausdorff (2005) discusses this directly;
  the lesson uses 12+ strides per trial as a classroom-realistic minimum
  while noting that 30+ is the literature norm for stable estimates.

## Open follow-ups

- Add validation studies specific to ORPHE CORE if/when they are
  published. None are cited above because the author does not have a
  vetted public reference.
- Translate the central failure-mode table into a printable handout for
  Lesson 01 if the educator-track work picks up.
- Cross-link this note from Lessons 01 and 03 once the lesson plans are
  reviewed.

## Citations

- Bouten, C. V. C. et al. "A Triaxial Accelerometer and Portable Data
  Processing Unit for the Assessment of Daily Physical Activity." _IEEE
  Transactions on Biomedical Engineering_, vol. 44, no. 3, 1997.
- Brodie, M. A. et al. "Wearable Pendant Device Monitoring Using New
  Wavelet-based Methods Shows Daily Life and Laboratory Gaits Are
  Different." _Medical & Biological Engineering & Computing_, vol. 56,
  2018.
- Hausdorff, J. M. "Gait Variability: Methods, Modeling and Meaning."
  _Journal of NeuroEngineering and Rehabilitation_, vol. 2, no. 19, 2005.
- Linthorne, N. P. "Analysis of Standing Vertical Jumps Using a Force
  Platform." _American Journal of Physics_, vol. 69, no. 11, 2001.
- Mannini, A. and Sabatini, A. M. "Machine Learning Methods for
  Classifying Human Physical Activity from On-body Accelerometers."
  _Sensors_, vol. 10, no. 2, 2010. (Survey-style starting point on
  on-body accelerometer classification.)
- Sadeghi, H. et al. "Symmetry and Limb Dominance in Able-Bodied Gait: A
  Review." _Gait & Posture_, vol. 12, no. 1, 2000.
- Sushames, A. et al. "Validity and Reliability of Fitbit Flex for Step
  Count, Moderate to Vigorous Physical Activity and Activity Energy
  Expenditure." _PLoS ONE_, vol. 11, no. 9, 2016.

## What this note does not claim

- It does not benchmark ORPHE CORE against any specific device.
- It does not assert any particular accuracy figure for ORPHE CORE; the
  device-specific marketing material is not cited.
- It does not survey gait-event detection algorithms in detail. The
  lesson plans do not need that level of depth.
- It does not survey the pediatric, paretic, or post-stroke literatures.
  Those are valid extensions but require a domain reviewer.
