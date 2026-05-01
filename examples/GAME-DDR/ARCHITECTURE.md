# 🏗️ ORPHE DDR GAME - System Architecture

## 📐 Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.html                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Header: Title, Description                               │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │ ORPHE Toolkit 1 │  │ ORPHE Toolkit 2 │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │          Canvas (600x800px)                      │    │  │
│  │  │  ┌────┬────┬────┬────┐                          │    │  │
│  │  │  │Lane│Lane│Lane│Lane│  ← Falling Arrows        │    │  │
│  │  │  │ 0  │ 1  │ 2  │ 3  │                          │    │  │
│  │  │  │ ←  │ ↓  │ ↑  │ →  │                          │    │  │
│  │  │  └────┴────┴────┴────┘                          │    │  │
│  │  │  ════════════════════  ← Hit Line (y=650)       │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  Score Panel: Score | Combo | Perfect | Good | Miss      │  │
│  │  Controls: [START] [RESTART] [Chart Select]              │  │
│  │  Settings: Note Speed | Judge Window | Volume            │  │
│  │  Instructions: Keyboard & ORPHE Controls                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      INPUT LAYER                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐              ┌──────────────────┐         │
│  │  Keyboard       │              │  ORPHE CORE      │         │
│  │  Arrow Keys     │              │  gait.direction  │         │
│  └────────┬────────┘              └─────────┬────────┘         │
│           │                                  │                  │
│           └──────────────┬───────────────────┘                  │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                   CONTROLLER LAYER                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      main.js                             │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │  Game State Manager                            │     │  │
│  │  │  - loading / ready / playing / gameOver        │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │  Input Router                                  │     │  │
│  │  │  - handleOrpheInput(direction)                 │     │  │
│  │  │  - handleGameInput(lane)                       │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │  Game Loop                                     │     │  │
│  │  │  - requestAnimationFrame                       │     │  │
│  │  │  - 60 FPS target                               │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     MODEL LAYER                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ AudioManager │  │ ChartManager │  │PlayerManager │         │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤         │
│  │ - audio      │  │ - notes[]    │  │ - score      │         │
│  │ - volume     │  │ - bpm        │  │ - combo      │         │
│  │ - isPlaying  │  │ - offset     │  │ - perfect    │         │
│  │              │  │              │  │ - good       │         │
│  │ play()       │  │ loadChart()  │  │ - miss       │         │
│  │ stop()       │  │ checkHit()   │  │              │         │
│  │ getCurrent() │  │ getVisible() │  │ processHit() │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      VIEW LAYER                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  GameRenderer                            │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │  Canvas Rendering (600x800px)                  │     │  │
│  │  │  - drawBackground()                            │     │  │
│  │  │  - drawLanes()                                 │     │  │
│  │  │  - drawNotes(notes)                            │     │  │
│  │  │  - drawHitLine()                               │     │  │
│  │  │  - drawJudgment()                              │     │  │
│  │  │  - drawHitEffects()                            │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  HTML UI Updates                         │  │
│  │  - Score panel elements                                  │  │
│  │  - Button states                                         │  │
│  │  - Settings sliders                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Input Processing Flow

```
USER INPUT
    │
    ├─ KEYBOARD: Arrow Key Press
    │      │
    │      └─> keydown event
    │             │
    │             └─> keyMap[key] → lane
    │                      │
    │                      └─> playerManager.handleInput(lane)
    │
    └─ ORPHE: Step Detection
           │
           └─> ble.gotGait(_gait)
                  │
                  └─> direction = _gait.direction
                         │
                         ├─> Check: direction !== lastDirection
                         │       │
                         │       └─> YES: Continue
                         │       └─> NO: Ignore (prevent duplicate)
                         │
                         └─> orpheDirectionMap[direction] → lane
                                │
                                └─> handleOrpheInput(direction)
                                       │
                                       └─> handleGameInput(lane)

GAME INPUT HANDLER
    │
    └─> handleGameInput(lane)
           │
           ├─> Get currentTime from audioManager
           │
           └─> chartManager.checkHit(currentTime, lane, window)
                  │
                  ├─> Find matching note in time window
                  │
                  └─> Return hitResult { note, accuracy }
                         │
                         └─> playerManager.processHit(hitResult)
                                │
                                ├─> Calculate score
                                ├─> Update combo
                                ├─> Update statistics
                                └─> Show judgment
                                       │
                                       └─> gameRenderer.showJudgment()
```

---

## 📊 Game Loop Sequence

```
┌─────────────────────────────────────────────────────┐
│  GAME LOOP (60 FPS)                                 │
└─────────────────────────────────────────────────────┘
        │
        ├─> [1] Check game state
        │      │
        │      └─> If NOT playing: Exit
        │
        ├─> [2] Get current audio time
        │      │
        │      └─> audioManager.getCurrentTime()
        │
        ├─> [3] Fetch visible notes
        │      │
        │      └─> chartManager.getVisibleNotes(currentTime, 3s)
        │             │
        │             └─> Returns notes within 3 second window
        │
        ├─> [4] Render frame
        │      │
        │      └─> gameRenderer.render(notes, currentTime)
        │             │
        │             ├─> Clear canvas
        │             ├─> Draw background (animated)
        │             ├─> Draw lanes (4 dividers)
        │             ├─> Draw notes (calculate Y position)
        │             ├─> Draw hit line (white line + guides)
        │             ├─> Draw hit effects (particle animations)
        │             ├─> Draw judgment text (fade out)
        │             └─> Draw lane indicators (bottom)
        │
        ├─> [5] Check completion
        │      │
        │      ├─> chartManager.isComplete(currentTime)
        │      └─> audioManager.hasEnded()
        │             │
        │             └─> If TRUE: endGame()
        │             └─> If FALSE: Continue
        │
        └─> [6] Request next frame
               │
               └─> requestAnimationFrame(gameLoop)
```

---

## 🔌 ORPHE CORE Integration

```
┌─────────────────────────────────────────────────────┐
│  ORPHE SETUP                                        │
└─────────────────────────────────────────────────────┘
        │
        ├─> Create devices: bles = [Orphe(0), Orphe(1)]
        │
        ├─> Setup device 1
        │      │
        │      ├─> bles[0].setup()
        │      └─> buildCoreToolkit('#toolkit_placeholder1', '01', 0, 'STEP_ANALYSIS')
        │
        ├─> Setup device 2
        │      │
        │      ├─> bles[1].setup()
        │      └─> buildCoreToolkit('#toolkit_placeholder2', '02', 1, 'STEP_ANALYSIS')
        │
        └─> Register callbacks
               │
               ├─> onConnect
               │      │
               │      └─> connectedDevices++
               │             │
               │             └─> If >= 1: Enable ORPHE input
               │
               └─> gotGait
                      │
                      └─> Receive _gait object
                             │
                             ├─> Extract direction (0, 2, 4, 6)
                             │
                             ├─> Check for direction change
                             │      │
                             │      └─> Prevent duplicate triggers
                             │
                             ├─> Map to lane
                             │      │
                             │      ├─> 0 → Lane 0 (←)
                             │      ├─> 2 → Lane 2 (↑)
                             │      ├─> 4 → Lane 1 (↓)
                             │      └─> 6 → Lane 3 (→)
                             │
                             └─> Trigger input handler
```

---

## 🎵 Chart Processing

```
┌─────────────────────────────────────────────────────┐
│  CHART LOADING & PROCESSING                         │
└─────────────────────────────────────────────────────┘
        │
        ├─> [1] Load Chart File
        │      │
        │      └─> fetch('assets/charts/sample.json')
        │             │
        │             └─> Parse JSON
        │
        ├─> [2] Parse Chart Data
        │      │
        │      ├─> Extract: name, bpm, offset, notes[]
        │      └─> Sort notes by time
        │
        ├─> [3] During Gameplay
        │      │
        │      ├─> Get visible notes
        │      │      │
        │      │      └─> Filter notes within time window
        │      │             │
        │      │             └─> currentTime + 3 seconds
        │      │
        │      └─> Check for hits
        │             │
        │             ├─> Compare input time vs note time
        │             │
        │             └─> Calculate accuracy
        │                    │
        │                    ├─> ±0.05s → Perfect
        │                    ├─> ±0.10s → Good
        │                    ├─> ±0.15s → OK
        │                    └─> Else   → Miss
        │
        └─> [4] Mark Note as Hit
               │
               └─> note.hit = true (prevent re-hit)
```

---

## 🎨 Rendering Pipeline

```
┌─────────────────────────────────────────────────────┐
│  CANVAS RENDERING (Each Frame)                      │
└─────────────────────────────────────────────────────┘
        │
        ├─> [1] Clear Canvas
        │      │
        │      └─> ctx.clearRect(0, 0, 600, 800)
        │
        ├─> [2] Background Layer
        │      │
        │      ├─> Gradient fill (#1a1a2e → #0f3460)
        │      └─> Animated scan lines (scrolling effect)
        │
        ├─> [3] Lane Dividers
        │      │
        │      └─> 3 vertical lines (4 lanes total)
        │
        ├─> [4] Notes Layer
        │      │
        │      └─> For each visible note:
        │             │
        │             ├─> Calculate Y position
        │             │      │
        │             │      └─> y = hitLineY - (timeDiff × noteSpeed)
        │             │
        │             ├─> Draw note background
        │             │      │
        │             │      └─> Rounded rectangle with lane color
        │             │
        │             ├─> Draw arrow symbol
        │             │      │
        │             │      └─> ←, ↓, ↑, or →
        │             │
        │             └─> Draw glow effect (if near hit line)
        │
        ├─> [5] Hit Line Layer
        │      │
        │      ├─> Main white line (y=650, glowing)
        │      └─> Timing guide lines (±20px, gold)
        │
        ├─> [6] Effects Layer
        │      │
        │      └─> For each active effect:
        │             │
        │             ├─> Draw expanding circle
        │             ├─> Fade alpha
        │             └─> Remove if expired
        │
        ├─> [7] Judgment Layer
        │      │
        │      └─> If active:
        │             │
        │             ├─> Draw text (center screen)
        │             ├─> Apply fade out
        │             └─> Decrease timer
        │
        └─> [8] UI Layer
               │
               └─> Lane indicators at bottom
                      │
                      ├─> Arrow symbols
                      └─> Key hints
```

---

## 📦 Module Dependencies

```
┌──────────────┐
│  index.html  │
└──────┬───────┘
       │ loads
       ├────────────────────────────────┐
       │                                │
       ▼                                ▼
┌──────────────┐               ┌──────────────┐
│  ORPHE-CORE  │               │  Bootstrap   │
│  CoreToolkit │               │  CSS/JS      │
└──────┬───────┘               └──────────────┘
       │
       ├─> bles[0], bles[1]
       │
       ▼
┌──────────────┐
│   main.js    │
└──────┬───────┘
       │ imports
       ├───────────────────────────────────┐
       │                                   │
       ▼                                   ▼
┌──────────────┐                   ┌──────────────┐
│  audio.js    │                   │  chart.js    │
│ AudioManager │                   │ ChartManager │
└──────────────┘                   └──────┬───────┘
                                          │ loads
                                          ▼
                                   ┌──────────────┐
                                   │ charts/*.json│
                                   └──────────────┘
       ▼                                   ▼
┌──────────────┐                   ┌──────────────┐
│  player.js   │                   │  render.js   │
│PlayerManager │                   │GameRenderer  │
└──────────────┘                   └──────────────┘
```

---

## 🔒 State Management

```
┌─────────────────────────────────────────────────────┐
│  GAME STATES                                        │
└─────────────────────────────────────────────────────┘

   ┌─────────┐
   │ loading │ ← Initial state
   └────┬────┘
        │ init() complete
        ▼
   ┌─────────┐
   │  ready  │ ← Waiting for player
   └────┬────┘
        │ startGame() called
        ▼
   ┌─────────┐     countdown(3,2,1)
   │countdown│ ────────────────────┐
   └─────────┘                     │
                                   ▼
   ┌─────────┐
   │ playing │ ← Active gameplay
   └────┬────┘
        │ song ends OR complete
        ▼
   ┌─────────┐
   │gameOver │ ← Show results
   └────┬────┘
        │ restartGame()
        └──────────────> back to ready
```

---

## 📈 Performance Characteristics

```
FRAME BUDGET (16.67ms @ 60 FPS)
├─ Input Processing:     <1ms
├─ Game Logic:          ~2ms
├─ Note Calculations:   ~1ms
├─ Canvas Rendering:    ~8ms
├─ Effect Updates:      ~2ms
└─ Buffer:              ~3ms
                       ------
                        16ms
```

---

## 🎯 Critical Paths

### Hit Detection Path (Time Critical)
```
Input → handleGameInput → checkHit → processHit → showJudgment
         <1ms              <1ms        <1ms         <1ms
                    Total: ~4ms latency
```

### Rendering Path (Frame Critical)
```
gameLoop → getVisibleNotes → render → display
  ~1ms         ~1ms            ~8ms     ~0ms
              Total: ~10ms per frame
```

---

## 🔄 Event Flow Summary

```
Startup:  init() → setupUI() → setupOrpheCORE() → loadChart() → ready
   ↓
Start:    startGame() → countdown() → play audio → playing state
   ↓
Loop:     gameLoop() → update positions → render frame → repeat
   ↓
Input:    keyboard/ORPHE → handleInput → checkHit → update score
   ↓
End:      complete/timeout → endGame() → show results → gameOver
   ↓
Restart:  restartGame() → reset state → ready
```

---

**Architecture Complete** ✅  
**All systems integrated and documented** 🎉
