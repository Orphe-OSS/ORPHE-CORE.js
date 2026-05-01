# 100 Examples Roadmap

This roadmap explains how ORPHE-CORE.js can grow from the current catalog into a public "100 examples" experience.

It intentionally does not add new examples yet. The immediate goal is to decide what should be cleaned up, promoted, documented, or created later.

## Definition

An example is a learnable unit.

It can be:

- a browser app
- a starter template
- a getting-started guide
- a workshop app
- a focused code recipe extracted from an existing app
- a small analysis or visualization utility

It should not be counted publicly if it is:

- an internal QA page
- a broken experiment
- a duplicate without a distinct learning goal
- a device-specific prototype whose target hardware is unclear

## Current Position

The repository already has enough raw material to support the 100 examples direction:

- 48 catalog entries in `examples/catalog.json`
- 8 recipe candidates
- 35 `examples/` web app directories
- 9 starter templates
- 5 getting-started guides
- workshop archives and app/tool candidates
- many existing sketches and modules that can become recipes

The work is not to inflate the count. The work is to make each public item answer:

1. What can I learn here?
2. What ORPHE CORE data does it use?
3. How many devices do I need?
4. Can I run it now?
5. Is it a beginner sample, an analysis utility, or a playful app?

## Promotion Levels

Use these levels when moving toward 100 public examples:

| Level | Meaning | Required work |
| --- | --- | --- |
| Gallery-ready | Can appear in public navigation. | Clear title, catalog entry, demo link, source link, device count, no known broken links. |
| Teaching-ready | Can be recommended to a beginner or workshop. | Gallery-ready plus README or guide explaining what to learn. |
| Showcase-ready | Can be featured on the landing page. | Teaching-ready plus thumbnail, polished first screen, and verified behavior. |
| Archive-only | Useful record, but not first-run material. | Catalog entry and archive explanation. |
| Internal | QA or maintenance only. | Keep out of public examples. |

## Cleanup Before Adding More

Finish these before building new examples:

1. Make catalog metadata complete enough for filtering and navigation.
2. Add a validation script and keep it passing.
3. Fix weak titles and empty links.
4. Add thumbnails or explicit placeholders for public navigation entries.
5. Move internal development notes out of public example directories, or clearly mark them.
6. Decide naming policy for directories with spaces, submission suffixes, or test-like names.
7. Promote `public-candidate` entries in small batches after browser review.

## Target Mix For 100 Public Examples

This distribution keeps the catalog balanced instead of becoming only games or only starter templates:

| Area | Target count | Current signal | Gap |
| --- | ---: | --- | --- |
| Getting started | 10 | Strong | Mostly polish and docs |
| 6-axis IMU basics | 18 | Medium | Needs focused concept examples |
| ORPHE Gait Analysis | 20 | Medium | Needs clearer dedicated demos |
| Recording / Replay / Analysis | 14 | Thin | Needs utilities and CSV/replay flows |
| Calibration / Debugging | 8 | Thin | Needs practical field tools |
| Playable apps | 18 | Strong | Needs concept explanations and validation |
| Creative coding | 8 | Medium | Needs p5.js / sound / visual recipes |
| Research / integrations | 4 | Medium | Needs clearer scope and disclaimers |

Total target: 100.

## Missing Example Designs

Do not implement these until the existing catalog is stable. Use this list to choose future work.

### 6-Axis IMU Basics

1. Acceleration magnitude monitor
2. Acceleration axis explainer
3. Gyro turn-rate monitor
4. Euler angle viewer
5. Quaternion orientation viewer
6. Euler vs Quaternion comparison
7. Sensor range comparison: 2G / 4G / 8G / 16G
8. Low-pass filter visualizer
9. Moving average filter visualizer
10. BLE packet interval monitor
11. Packet drop detector
12. Orientation reset demo
13. Shake detector
14. Tap detector
15. Step impulse visualizer
16. Left/right sensor sync viewer
17. Sensor values to Chart.js
18. Sensor values to p5.js particles

### ORPHE Gait Analysis

1. Step count dashboard
2. Walking direction viewer
3. Distance estimator display
4. Stride length visualizer
5. Stride height visualizer
6. Foot angle visualizer
7. Pronation monitor
8. Landing impact monitor
9. Ground contact time view
10. Swing time view
11. Left/right gait balance
12. Walking asymmetry detector
13. Pace and cadence dashboard
14. Gait event timeline
15. Running form quick check
16. Rehab progress chart
17. In-place walking detector
18. Jump landing quality checker
19. Gait Analysis values table
20. Gait Analysis values to CSV

### Recording / Replay / Analysis

1. CSV recorder
2. JSON recorder
3. Session annotation tool
4. Replay recorded session
5. Compare two recorded sessions
6. DTW gesture comparison walkthrough
7. Frequency analysis walkthrough
8. Calibration data collector
9. Export to Google Sheets format
10. Export to Python notebook format
11. LocalStorage session history
12. Downloadable sensor log
13. Two-device synchronized recorder
14. Sensor replay with p5.js visualization

### Calibration / Debugging

1. BLE connection status panel
2. Battery and device information panel
3. Firmware information panel
4. Sensor noise floor check
5. Device mount orientation check
6. Left/right assignment helper
7. Two-device reconnect tester
8. Field test checklist page

### Playable Apps

1. Tilt maze
2. Landing challenge
3. Stride runner
4. Pronation balance game
5. Cadence rhythm game
6. Gait direction puzzle
7. Two-foot rhythm battle
8. Jump timing game
9. Kick accuracy game walkthrough
10. Foot angle snowboard game
11. Step-powered endless runner
12. Balance hold challenge
13. Acceleration punch meter
14. Foot drum lesson
15. Walking speed race
16. Stop-and-go reaction game
17. Cooperative two-player walking game
18. Gait-controlled paddle game

### Creative Coding

1. p5.js particles from acceleration
2. p5.js sound from step events
3. Three.js shoe orientation
4. Web Audio gait sequencer
5. Motion typography
6. Footstep drawing machine
7. Sensor-driven color palette
8. Pose plus ORPHE starter

### Research / Integrations

1. Heart-rate plus gait dashboard
2. Camera pose plus ORPHE sync
3. OSC bridge walkthrough
4. WebSocket bridge walkthrough

## Recommended Work Sequence

### Phase 1: Make The Current Catalog Trustworthy

- Keep validation passing.
- Fill missing display metadata.
- Fix weak titles and broken links.
- Add thumbnail placeholders.
- Add README files for public and public-candidate examples.

### Phase 2: Promote Existing Candidates

Promote in batches of 3-5:

1. `DTW`, `CORE_TIME_SYNC`, `SENSOR-CALIBRATION`
2. `GAME-PK`, `GAME-MARIO`, `GAME-SHOOTING`, `GAME-SHOOTING2`
3. `WORKSHOP_07`, `ws/tmu2025`, `apps/ORPHE-TERMINAL`

Each promotion should include:

- catalog update
- title/README cleanup
- thumbnail or placeholder
- browser smoke check
- device verification status

### Phase 3: Extract Recipes From Existing Code

Before writing new examples, extract small recipes from:

- `examples/LIGHT/sketch.js`
- `examples/INFORMATION/sketch.js`
- `examples/VIEW/sketch.js`
- `examples/GESTURE-DEMO/gesture-detector.js`
- `examples/SENSOR-CALIBRATION/recorder.js`
- `examples/DTW/sketch.js`
- `examples/GAME-PK/game_3d.js`
- `examples/GAME-DDR/game/player.js`

Recipes should be small docs or snippets, not new apps.

### Phase 4: Add Missing Concept Examples

Start with 6-axis IMU and Gait Analysis fundamentals before adding more polished games.

Recommended first new examples:

1. Acceleration magnitude monitor
2. Gyro turn-rate monitor
3. Euler vs Quaternion comparison
4. BLE packet interval monitor
5. Step count dashboard
6. Stride visualizer
7. Pronation monitor
8. CSV recorder
9. Replay recorded session
10. Tilt maze

## Human Review Questions

- Should workshop archives count toward the public 100, or be presented as a separate archive?
- Should ORPHE INSOLE / FSR-specific examples live in this catalog or a separate product catalog?
- Should directory renames wait until the gallery can redirect old URLs?
- How strict should `showcase-ready` be about physical-device verification?
- Should examples with external BLE devices, such as OH1, be first-class examples or integrations?
