# CORE 3 public-example compatibility checks

Date: 2026-11-11. Published baseline: `1a7998991089c0e7e9eed40e8b73007f57d07421` (PR #145).
Follow-up branch: `fix/core3-other-examples`.

At the published baseline, four pages loaded the older release SDK and three
hurdle variants repeated connection startup from per-characteristic connection
events. These defects were reproduced from the published source, then fixed in
this change. This is not an all-examples hardware pass.

## Published-source checks

- Fetched all 33 `examples/*/index.html` pages from
  `https://orphe-oss.github.io/ORPHE-CORE.js/`. All returned HTTP 200 and matched
  the corresponding baseline checkout files byte for byte.
- Fetched 69 directly referenced JavaScript URLs: same-site scripts and the
  release-pinned ORPHE SDK. None failed; all applicable same-site files matched
  the baseline checkout. Other third-party libraries, dynamic imports, models,
  media and game assets were not exhaustively fetched or executed.
- 29 pages load the current same-site SDK, including the cache-query form used
  by ORPHE-PIANO. Four pages load the older `v1.4.2` CDN SDK.
- Feeding one synthetic 104-byte header-50 notification to the downloaded
  same-site SDK produced four converted-acceleration and four Euler callbacks,
  all finite. The downloaded CDN SDK produced zero of either callback for the
  same input. Both SDKs produced four of each for a synthetic 92-byte input.
  These are decoder tests, not new Bluetooth measurements.

| Published page | Reproduced issue | Follow-up change |
| --- | --- | --- |
| `GAME-RHYTHM` | Old CDN SDK rejects 104-byte sensor notifications | Load `../../js/ORPHE-CORE.js` |
| `WORKSHOP_07` | Same | Same |
| `drum_test` | Same | Same |
| `p5.ORPHE.FSR_visualise_0327_submit` | Same | Same |
| `GAME-HURDLE-VS` | Two GATT connection events from one device start `begin()` on both slots; sensor callbacks are not installed initially | Install callbacks once; CoreToolkit owns startup; explicit device choice for each player |
| `GAME-HURDLE-2D-VS` | Same | Same |
| `GAME-HURDLE-VS-advance` | Same | Same |

The downloaded active inline code reproduced two nested `begin()` calls in
each affected hurdle variant after `DEVICE_INFORMATION` and `DATE_TIME`
events from slot 0 alone. This counts characteristics as devices and can
attempt another chooser without a user gesture. It is not CORE-3-specific.

## Regression checks on this branch

- `hurdle-vs-sensor-initialization.test.js` executes each variant's actual
  initialization and sensor handlers. Either player's input works before the
  other connects; repeated GATT and reconnect events never call `begin()`;
  callbacks retain their identity; independent acceleration and jump cooldowns
  work; remembered CORE 2 devices cannot replace an explicit CORE 3 choice.
- `examples-core-sdk-source.test.js` checks all 33 actual entry pages load the
  deployed SDK covered by the decoder/discovery regression suite. Commented-out
  alternative script tags do not count.
- Both added tests failed against the published baseline and pass after the
  follow-up changes. The complete `npm test` suite passes.
- `npm run lint`: zero errors, 77 pre-existing warnings.
- `git diff --check`: passes.

## Hardware coverage and remaining work

The earlier CORE 3 two-device and CORE 2 regression measurements are recorded
in [core3-compat-validation.md](core3-compat-validation.md). They are earlier
measurements and do not establish a fresh post-deployment result for other
examples.

During this follow-up the user connected two CORE 3 devices to the published
virtual hurdle page and confirmed that both devices' displays continued updating
for more than one minute. The confirmation answered a question explicitly asking
whether both Hz displays remained active and Pitch/Accel changed with light
movement: "2台とも1分以上、表示が更新し続けている".

Result: the requested two-device continuous-display check passed by user
observation. The computer-control connection remained unavailable, so the agent
did not independently obtain new packet counters, error/disconnect counters or
an exact duration. This result establishes observed display continuity, not
lossless delivery or the absence of short intermediate transport interruptions.

For a future instrumented reliability run after computer control is restored, use
the opt-in `tests/physical-game-probe.js` on the actual public GAME-HURDLE page.
For both slots, record a baseline and a snapshot after at least 60 seconds:
connected state, changing packet/sample counters, nonfinite values, errors and
disconnects. Observe updates during the interval as well: two endpoint snapshots
cannot exclude intermediate stream stalls. A 60-second connected state alone is
not a no-data-loss result. Other examples still needing physical checks include
INFORMATION/LIGHT, VISUALIZE, VIEW,
CORETOOLKIT-STARTER, STEP_ANALYSIS consumers and the affected game variants.
Camera, external heart-rate/FSR hardware, audio and foot-worn gameplay need their
own applicable functional checks.

No example beyond GAME-HURDLE has a new physical-device pass in this follow-up.
These follow-up changes were still local when the observations above were
recorded. The pull request tracks subsequent merge and deployment status.
