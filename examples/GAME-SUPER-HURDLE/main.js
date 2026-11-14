// main.js — World Virtual Hurdles 110m.
//
// This file owns the game rules (constants, physics, stamina, hurdle collision,
// finish, ranking) and the input surface the ORPHE CORE script in index.html
// drives: window.gameJump(), window.setAccelPressed(), window.jumpStartTime.
//
// The rules follow the original single-file version. Two of them now have a
// newer variant that can be switched back from the settings drawer (see RULES):
// what happens in the air, and how stamina works. All per-runner state lives on
// a player object so the same rules drive one runner (SOLO) or two (VS, one
// ORPHE CORE each).
//
// Everything else (stadium, rivals, post-processing, sound, HUD) is presentation
// layered on top through small event hooks.
import * as THREE from 'three';
import { createWorld, laneX, LANES, LANE_W, PLAYER_LANE } from './world.js';
import { Runner, Rival, FirstPersonBody, newPose, poseRun, poseHurdle, poseCrouch, lerpPose, BLOCK_Z } from './runner.js';
import { createFx } from './fx.js';
import { AudioEngine } from './audio.js';
import { createUI } from './ui.js';
import { createTelemetry } from './telemetry.js';
import { analyzeRun } from './analysis.js';
import { DEVICE, loadInsoleSdk, setupInsole } from './insole.js';

window.THREE = THREE;

// Game constants
const COURSE_LEN_M = 110;  // 男子110mハードル規格
const HURDLES = 10;
const FIRST_HURDLE_M = 13.72;  // スタートから最初のハードルまで
const HURDLE_SPACING_M = 9.14;  // 各ハードル間の距離
const PLAYER_EYE_H = 1.7;
const JUMP_V0 = 5.0;
const GRAVITY = 16.0;  // 重力を強くしてジャンプ時間を短縮
const BASE_SPEED = 0.0;
const MAX_SPEED = 12.0;
const SLOWDOWN_FACTOR = 0.20;  // Reduced from 0.40 for gentler slowdown
const RECOVER_SEC = 1.0;
const ACCEL_RATE = 15.0;
const FRICTION = 8.0;
const STAMINA_MAX = 1.0;

// ---- Jump rule "coast" -----------------------------------------------------
// In the air the legs cannot push off the track: input does not accelerate and
// the runner sheds this fraction of speed over one full jump. Proportional (not
// a fixed m/s) so slow runners are not stopped dead.
const JUMP_SPEED_LOSS = 0.12;
const JUMP_AIR_TIME = (2 * JUMP_V0) / GRAVITY;  // 0.625 s
const AIR_DRAG = -Math.log(1 - JUMP_SPEED_LOSS) / JUMP_AIR_TIME;  // per second

// ---- Stamina rule "classic" (the original) ---------------------------------
// Accelerating spends stamina, anything else recovers it; under the block
// threshold the runner cannot accelerate.
const STAMINA_USE_PER_SEC = 0.45;
const STAMINA_REGEN_PER_SEC = 0.45;//0.30から0.6に変更
const STAMINA_BLOCK_THRESHOLD = 0.08;

// ---- Stamina rule "pace" ---------------------------------------------------
// Stamina is a budget for the whole 110 m. Running faster than a comfortable
// cruise burns it, and the burn grows with the square of how far above cruise
// the runner is, so backing off a little saves a lot. Run it dry and the runner
// is out of breath: top speed is halved until stamina is back to the recover
// level. Tuned so that an even pace that empties the tank on the line is the
// fastest way round; flat out all the way dies at about 80 m.
const CRUISE_SPEED = 0.7 * MAX_SPEED;            // 8.4 m/s: at or below this, stamina comes back
const STAMINA_BURN_AT_MAX = 0.22;                // per second at MAX_SPEED
const PACE_REGEN_PER_SEC = 0.10;                 // on the ground, at or below cruise
const EXHAUSTED_SPEED = 0.5 * MAX_SPEED;         // 6 m/s while out of breath
const EXHAUSTED_RECOVER_LEVEL = 0.35;
const EXHAUSTED_REGEN_PER_SEC = 0.10;            // => 3.5 s out of breath

// ---- Rule switches ---------------------------------------------------------
// jump:    'coast'   = no drive in the air, speed decays (new)
//          'classic' = airborne is treated exactly like the ground (original)
// stamina: 'pace'    = speed-based budget with exhaustion (new)
//          'classic' = spend while accelerating, recover otherwise (original)
// guard:   'on'      = a sensor "jump" with no hurdle coming up is ignored (new)
//          'off'     = every sensor jump counts, wherever the runner is (original)
// classic + classic + off is the original game. Chosen in the settings drawer and
// remembered in localStorage.
const RULE_DEFAULTS = { jump: 'coast', stamina: 'pace', guard: 'on' };
const RULES_KEY = 'hurdle.rules';
function loadRules() {
  try {
    const saved = JSON.parse(localStorage.getItem(RULES_KEY) || '{}');
    return {
      jump: saved.jump === 'classic' ? 'classic' : RULE_DEFAULTS.jump,
      stamina: saved.stamina === 'classic' ? 'classic' : RULE_DEFAULTS.stamina,
      guard: saved.guard === 'off' ? 'off' : RULE_DEFAULTS.guard,
    };
  } catch {
    return { ...RULE_DEFAULTS };
  }
}
const RULES = loadRules();

// ORPHE parameters (configurable)
window.accThresholdAccel = 1.1;
window.pitchThresholdJump = 0.15;  // ラジアンで設定

// ---------------------------------------------------------------------------
// Renderer / scene
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene();

// Hurdles (rule-side: only their z matters)
const hurdles = [];
for (let i = 0; i < HURDLES; i++) {
  hurdles.push({ index: i, userData: { z: -(FIRST_HURDLE_M + i * HURDLE_SPACING_M) } });
}

// ---------------------------------------------------------------------------
// Players. SOLO uses P[0] in lane 5; VS uses P[0] in lane 4 (CORE 01, left half
// of the screen) and P[1] in lane 5 (CORE 02, right half).
const VS_LANES = [PLAYER_LANE - 1, PLAYER_LANE];
const VS_TIMEOUT_SEC = 15;       // after the first finisher, the other runner gets this long
const SENSOR_JUMP_COOLDOWN_MS = 700;  // same cooldown the solo sensor script uses
function makePlayer(index) {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.06, 900);
  scene.add(camera);
  // position.z runs 0 → -110, position.y is eye height plus jump lift
  const rig = new THREE.Object3D();
  rig.position.set(0, PLAYER_EYE_H, 0);
  return {
    index, lane: PLAYER_LANE, rig, camera,
    // rules state
    vz: BASE_SPEED, vy: 0, isGround: true, stamina: STAMINA_MAX, exhausted: false, exhaustCount: 0,
    slowRemain: 0, hits: 0, hitMarkers: new Set(), jumpStartTime: 0, runTime: 0, finished: false, dnf: false,
    // Pressed states – used for keyboard and ORPHE input
    accelKeyboard: false, accelOrphe: false, sensorJumpAt: 0, keyJumpAt: 0, guarded: 0, guardAt: 0, jumpHeldAt: 0, heldJumps: 0,
    // presentation state (never read by the rules)
    view: {}, cam: { mode: 'title', blend: 1, blendDur: 1, shot: 0, shotT: 0, shift: 0, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion(), fromFov: 55, fromShift: 0 },
    place: 1, cleared: 0, combo: 0, topSpeed: 0, viewW: 1, fpVisible: false, bodyVisible: false,
    fxView: null, fpBody: null, shadowBody: null, figure: null, hud: null,
    trace: null, analysis: null,
  };
}
const P = [makePlayer(0), makePlayer(1)];
let active = [P[0]];
let mode = 'solo';
try { if (localStorage.getItem('hurdle.mode') === 'vs') mode = 'vs'; } catch { /* storage unavailable */ }

function resetPlayer(p) {
  p.vz = BASE_SPEED; p.vy = 0; p.isGround = true;
  p.stamina = STAMINA_MAX; p.exhausted = false; p.exhaustCount = 0;
  p.slowRemain = 0; p.hits = 0; p.hitMarkers.clear();
  p.jumpStartTime = 0; p.runTime = 0; p.finished = false; p.dnf = false;
  p.accelKeyboard = false; p.accelOrphe = false; p.sensorJumpAt = 0; p.guarded = 0; p.guardAt = 0; p.jumpHeldAt = 0; p.heldJumps = 0;
  p.rig.position.set(laneX(p.lane), PLAYER_EYE_H, 0);
  Object.assign(p.view, {
    finishT: 0, runoutV: 0, stepPhase: 0, crouch: 0, crouchTarget: 0, air: 0, landY: 0, landV: 0,
    trauma: 0, hitRoll: 0, fovKick: 0, hit: 0, flash: 0, fade: 0, exhaust: 0,
  });
  p.place = 1; p.cleared = 0; p.combo = 0; p.topSpeed = 0;
  // what the post-race analysis needs: reaction, per-hurdle take-offs and splits, a 20 Hz pace trace
  p.trace = { firstAccel: null, hurdles: [], samples: [], blockedTime: 0, lastJump: null, sampleAt: -1 };
  p.analysis = null;
}

// ---------------------------------------------------------------------------
// Presentation modules
const audio = new AudioEngine();
const telemetry = createTelemetry();
// The two sensor units in play: ORPHE CORE (window.bles) by default, ORPHE INSOLE when selected in the dock.
let sensors = [];
let insole = null;
const RIVAL_LANES = [2, 3, 4, 6, 7, 8, 9];
let ui = null;
let world = null;
let fx = null;
let rivals = [];
const activeRivals = () => (mode === 'vs' ? rivals.filter((r) => !VS_LANES.includes(r.lane)) : rivals);

// Game state
let state = 'ready';
let countdownValue = 0;
let countdownTimer = 0;
let clock = new THREE.Clock();
let startEpoch = 0;
let firstFinishAt = 0;          // race seconds when the first human crossed the line (VS)
// jumpStartTime は updateSensorDisplay (通常 <script> ブロック側) からも
// 参照されるため、ESM スコープに閉じる let ではなく window 経由で公開する。
window.jumpStartTime = 0;  // Track jump timing for status display
// Track where ranking was opened from
let rankingReturnTo = 'start'; // 'start' or 'finish'

// Race-level presentation state
const stageView = { phase: 'title', time: 0, jumboAt: 0, waveAt: 12 };
P.forEach(resetPlayer);

// Utility for formatting numbers
function fmt(n, d = 2) { return n.toFixed(d); }
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const raceNow = () => (performance.now() - startEpoch) / 1000;

// Keyboard controls remain available.
// SOLO: ← accelerate, → jump.  VS: PLAYER 1 = A / D, PLAYER 2 = ← / →.
const KEYS = {
  solo: { ArrowLeft: [0, 'accel'], ArrowRight: [0, 'jump'] },
  vs: { KeyA: [0, 'accel'], KeyD: [0, 'jump'], ArrowLeft: [1, 'accel'], ArrowRight: [1, 'jump'] },
};
addEventListener('keydown', e => {
  const bind = KEYS[mode][e.code];
  if (bind) {
    const p = P[bind[0]];
    if (bind[1] === 'jump') { jump(p); p.keyJumpAt = performance.now(); } else p.accelKeyboard = true;
  }
  if (e.code === 'Escape') resetGame();  // ESCキーでリセット
  if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
    if (stageView.phase === 'title' && document.getElementById('ranking-layer').style.display === 'none') startGame();
  }
});
addEventListener('keyup', e => {
  const bind = KEYS[mode][e.code];
  if (bind && bind[1] === 'accel') P[bind[0]].accelKeyboard = false;
});

// Jump routine
function jump(p) {
  if (state !== 'running' || p.finished || !active.includes(p)) return;
  if (p.isGround) {
    p.vy = JUMP_V0;
    p.isGround = false;
    p.jumpStartTime = performance.now();
    window.jumpStartTime = p.jumpStartTime;
    onJump(p);
  }
}

// ---- Sensor jump guard -----------------------------------------------------
// The sensors read "toe up" as a jump, and a foot stamping hard to accelerate
// pitches past that threshold on its own. Recorded races show where that hurts:
// off the blocks, getting going again after a hit, and on the run-in, each time
// costing a full jump with no drive (and a string of them after a hit, because
// a stopped runner stamps hardest). They also show the opposite mistake: first-
// time players lift the toe a few tenths too early (11 of the 23 jumps that hit
// in the 2026-11-13 care-home recordings) and come down on the bar.
// With the guard on, a sensor jump takes off only inside the take-off zone:
//   - in the zone (or later): it jumps at once, as before;
//   - too early: it is held for up to JUMP_HOLD_MS and released the moment the
//     zone starts, which is the earliest take-off that clears;
//   - nowhere near a hurdle (more than JUMP_GUARD_SEC away, or past the last
//     one): it is ignored and counted.
// A late toe-up still hits. Keyboard jumps are never filtered.
const JUMP_GUARD_SEC = 1.0;
const JUMP_HOLD_MS = 450;
const JUMP_GUARD_MIN_SPEED = 0.5;   // m/s floor for the time-to-bar estimate
function nextHurdle(p) {
  for (const h of hurdles) { if (!p.hitMarkers.has(h) && h.userData.z < p.rig.position.z) return h; }
  return null;
}
/** Seconds of flight to the next bar if the runner took off now; null with no hurdle left or out of range. */
function timeToBar(p) {
  const next = nextHurdle(p);
  if (!next) return null;
  return airTime(Math.max(0, p.rig.position.z - next.userData.z - 0.35), Math.max(p.vz, JUMP_GUARD_MIN_SPEED));
}
/** A jump asked for by a sensor. Returns false when the guard held or ignored it (so callers can skip their cooldown). */
function sensorJump(p) {
  if (RULES.guard === 'on' && state === 'running' && !p.finished && p.isGround && active.includes(p)) {
    const t = timeToBar(p);
    if (t == null || t > CUE_EARLY_SEC) {
      const now = performance.now();
      p.jumpHeldAt = now;                                  // released by releaseHeldJump() when the zone starts
      if ((t == null || t > JUMP_GUARD_SEC) && now - p.guardAt > SENSOR_JUMP_COOLDOWN_MS) {   // the trigger repeats every sample while the toe is up: count episodes
        p.guardAt = now;
        p.guarded++;
        const next = nextHurdle(p);
        telemetry.event(p.index, 'jumpIgnored', { hurdle: next ? next.index : -1, gap: next ? r2(p.rig.position.z - next.userData.z) : null, speed: r2(p.vz) });
      }
      return false;
    }
  }
  p.jumpHeldAt = 0;
  jump(p);
  return true;
}
/** Every frame: a sensor jump that came too early takes off as the runner reaches the take-off zone. */
function releaseHeldJump(p) {
  if (!p.jumpHeldAt) return;
  const now = performance.now();
  if (now - p.jumpHeldAt > JUMP_HOLD_MS || RULES.guard !== 'on') { p.jumpHeldAt = 0; return; }
  if (!p.isGround || p.finished) return;
  const t = timeToBar(p);
  if (t != null && t <= CUE_EARLY_SEC) {
    const waited = now - p.jumpHeldAt;
    p.jumpHeldAt = 0;
    jump(p);
    if (!p.isGround) { p.sensorJumpAt = now; p.heldJumps++; telemetry.event(p.index, 'jumpHeld', { waitedMs: Math.round(waited) }); }
  }
}

// ---- Toe-up zero -------------------------------------------------------------
// "Toe up" is the pitch going below -threshold, measured from wherever the sensor's own zero
// happens to be. In one recorded VS race both units rested at +0.81 / +0.29 rad (strapped at a
// different angle), so lifting the toes never got near the threshold: 18 hurdles, no jump.
// When a foot is held still through the end of the countdown, that resting pitch becomes the
// zero for the race. A foot that is moving during the countdown keeps the sensor's own zero.
// Part of the guard switch; the sensor script itself is not touched (see boot()).
const pitchZero = [0, 0];
const ZERO_WINDOW_MS = 1500, ZERO_MAX_SPREAD = 0.06;
let zeroSamples = [];
function sampleRestingPitch() {
  const devices = window.devices;
  if (!devices) return;
  const now = performance.now();
  zeroSamples.push([now, 0, 1].map((v, k) => (k === 0 ? v : (devices[v]?.eulers?.pitch ?? 0) + pitchZero[v])));
  while (zeroSamples.length && now - zeroSamples[0][0] > ZERO_WINDOW_MS) zeroSamples.shift();
}
function applyRestingPitch() {
  for (const i of [0, 1]) {
    const xs = zeroSamples.map((r) => r[i + 1]).sort((a, b) => a - b);
    let zero = 0;
    if (RULES.guard === 'on' && xs.length >= 20) {
      const spread = xs[Math.floor(xs.length * 0.95)] - xs[Math.floor(xs.length * 0.05)];
      if (spread <= ZERO_MAX_SPREAD) zero = Math.min(1.2, Math.max(-0.2, xs[xs.length >> 1]));
    }
    pitchZero[i] = zero;
    if (insole) insole.setPitchZero(i, zero);
  }
  zeroSamples = [];
  telemetry.event(-1, 'pitchZero', { zero: pitchZero.map(r2) });
}

// SOLO with ORPHE CORE: the sensor script in index.html starts its 700 ms cooldown on every
// trigger it sends, including one that produced no jump (the guard ignored it). Left alone it
// would then sit out a real take-off: after a hit the next bar is about a second away, and a
// stamp ignored early in the re-acceleration would mute the sensor script right through the
// take-off zone. So while such a cooldown is running, the toe is watched here instead, with the
// same threshold and the same cooldown counted from the last jump that actually happened (what
// VS does all the time). ORPHE INSOLE does not need this: insole.js skips its cooldown itself.
let soloCoverUntil = 0;   // performance.now() until which the sensor script is muted by a trigger that did not jump
function pollSoloCover() {
  const now = performance.now();
  const p = P[0], devices = window.devices;
  if (now >= soloCoverUntil || !devices || !p.isGround || now - p.sensorJumpAt <= SENSOR_JUMP_COOLDOWN_MS) return;
  const toeUp = [devices[0], devices[1]].some((d) => d && d.eulers && d.eulers.pitch < -window.pitchThresholdJump);
  if (toeUp && sensorJump(p) && !p.isGround) p.sensorJumpAt = now;
}

// VS: each runner is driven by one CORE. The sensor script in index.html keeps
// window.devices[id] up to date for both devices; read each one separately here
// with the same thresholds and jump cooldown it applies in SOLO.
function pollVsSensors() {
  const devices = window.devices;
  if (!devices) return;
  const now = performance.now();
  for (const p of active) {
    const d = devices[p.index];
    if (!d) continue;
    if (d.acc) p.accelOrphe = Math.hypot(d.acc.x, d.acc.y, d.acc.z) > window.accThresholdAccel;
    if (d.eulers && d.eulers.pitch < -window.pitchThresholdJump && now - p.sensorJumpAt > SENSOR_JUMP_COOLDOWN_MS) {
      if (sensorJump(p)) p.sensorJumpAt = now;
    }
  }
}

function startGame() {
  if (state !== 'ready' || countdownTimer || !world) return;

  // Initialize audio and put the runners on the start line
  audio.init();
  setupRace();
  onCountdownStart();

  countdownValue = 3;
  onCountdownTick(3);
  // Countdown timer
  countdownTimer = setInterval(() => {
    countdownValue--;
    if (countdownValue > 0) {
      onCountdownTick(countdownValue);
    } else {
      // countdownValue === 0: Show GO! and start game immediately
      clearInterval(countdownTimer);
      countdownTimer = 0;
      state = 'running';
      clock.start();
      startEpoch = performance.now();
      onGo();
    }
  }, 1000);
}

function showRanking(from = 'start') {
  rankingReturnTo = from;
  ui.setScreen('ranking');
}

function hideRanking() {
  ui.setScreen(rankingReturnTo === 'finish' ? 'finish' : 'title');
  if (rankingReturnTo === 'finish') document.getElementById('result-card').classList.add('show');
}

// localStorage key for this browser's own scores. Bumping this
// string would effectively reset everyone's local ranking history.
const LOCAL_RANKING_KEY = 'superhurdle.localRankings';
// The original GAME-HURDLE keeps its own list under this key on the same origin. While this
// game was still developed inside GAME-HURDLE it saved there too; those entries carry a
// `rules` field, which the original never writes, so they are moved over once.
const ORIGINAL_RANKING_KEY = 'hurdle.localRankings';
(function adoptEarlierScores() {
  try {
    if (localStorage.getItem(LOCAL_RANKING_KEY) !== null) return;
    const parsed = JSON.parse(localStorage.getItem(ORIGINAL_RANKING_KEY) || '[]');
    const all = Array.isArray(parsed) ? parsed : [];
    const mine = all.filter((r) => r && typeof r.rules === 'string');
    localStorage.setItem(LOCAL_RANKING_KEY, JSON.stringify(mine));
    if (mine.length) localStorage.setItem(ORIGINAL_RANKING_KEY, JSON.stringify(all.filter((r) => !mine.includes(r))));
  } catch { /* storage unavailable: start with an empty list */ }
})();
const RANKING_DISPLAY_LIMIT = 100;

// Read this browser's saved scores. Returns [] on parse failure.
function readLocalRanking() {
  try {
    const raw = localStorage.getItem(LOCAL_RANKING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[HURDLE] Failed to read local rankings:', e);
    return [];
  }
}

function writeLocalRanking(list) {
  try {
    // keep the best RANKING_DISPLAY_LIMIT of every board, so one rule set cannot push another out
    const valid = (Array.isArray(list) ? list : [])
      .filter(r => r && typeof r.time === 'number' && Number.isFinite(r.time))
      .sort((a, b) => a.time - b.time);
    const kept = new Map();
    const trimmed = valid.filter((r) => {
      const board = r.rules || CLASSIC_BOARD;
      kept.set(board, (kept.get(board) || 0) + 1);
      return kept.get(board) <= RANKING_DISPLAY_LIMIT;
    });
    localStorage.setItem(LOCAL_RANKING_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[HURDLE] Failed to persist local rankings:', e);
  }
}

// One board per rule set: the jump and stamina rules change what a time is worth (flat out is
// about 9.7 s under the original rules and 11.5 s under the new ones), so times are only ranked
// against times run under the same pair. Entries without a `rules` field, i.e. the frozen
// snapshot and everything saved before the rules could be switched, were run under the
// original rules and stay on that board.
const CLASSIC_BOARD = 'classic.classic';
const rankingBoard = () => `${RULES.jump}.${RULES.stamina}`;
const onBoard = (r, board) => (r.rules || CLASSIC_BOARD) === board;
function rankingBoardLabel() {
  if (rankingBoard() === CLASSIC_BOARD) return '従来ルール / CLASSIC RULES';
  return `ジャンプ：${RULES.jump === 'coast' ? '新' : '従来'}　スタミナ：${RULES.stamina === 'pace' ? '新（ペース配分）' : '従来'}`;
}

// Snapshot (legend) + localStorage (you) for the current rule set, fastest first.
async function mergedRanking() {
  const board = rankingBoard();
  const frozenRaw = await (window.frozenRankingReady || Promise.resolve([]));
  const frozen = (Array.isArray(frozenRaw) ? frozenRaw : []).map(r => ({ ...r, source: 'legend' }));
  const local = readLocalRanking().map(r => ({ ...r, source: 'local' }));
  return [...frozen, ...local]
    .filter(r => onBoard(r, board))
    .filter(r => typeof r.time === 'number' && Number.isFinite(r.time))
    .sort((a, b) => a.time - b.time)
    .slice(0, RANKING_DISPLAY_LIMIT);
}

// Load and display ranking data: snapshot (legend) + localStorage (you).
async function loadRankingData() {
  const rankingList = document.getElementById('ranking-list');
  if (!rankingList) return;

  const label = document.getElementById('ranking-board');
  if (label) label.textContent = rankingBoardLabel();
  // Show loading message while the snapshot fetch settles
  rankingList.innerHTML = '<div class="loading-message">読み込み中... / Loading...</div>';

  const merged = await mergedRanking();

  rankingList.innerHTML = '';
  if (merged.length === 0) {
    rankingList.innerHTML = '<div class="loading-message">ランキングデータがありません。<br>あなたが完走するとここに記録が追加されます。 / No data yet — finish a run to add the first entry.</div>';
    return;
  }

  let rank = 1;
  for (const data of merged) {
    rankingList.appendChild(createRankingItem(rank, data));
    rank++;
  }
}

// Create a ranking item element. Local rows are highlighted with a
// pill marker so the player can spot their own scores in the list.
function createRankingItem(rank, data) {
  const item = document.createElement('div');
  item.className = 'ranking-item' + (data.source === 'local' ? ' is-local' : '');

  const rankDiv = document.createElement('div');
  rankDiv.className = 'ranking-rank' + (rank <= 3 ? ' top3' : '');
  rankDiv.textContent = rank + '位';

  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'ranking-details';

  const nameDiv = document.createElement('div');
  nameDiv.className = 'ranking-name';
  nameDiv.textContent = data.name || 'Unknown Player';
  if (data.source === 'local') {
    const tag = document.createElement('span');
    tag.className = 'ranking-tag-local';
    tag.textContent = 'YOU';
    nameDiv.appendChild(tag);
  }

  const scoreDiv = document.createElement('div');
  scoreDiv.className = 'ranking-score';
  const time = typeof data.time === 'number' ? data.time : 0;
  const hurdleHits = typeof data.hurdles === 'number' ? data.hurdles : 0;
  scoreDiv.textContent = `${time.toFixed(2)}秒 / ${hurdleHits}回ヒット`;

  const dateDiv = document.createElement('div');
  dateDiv.className = 'ranking-date';
  // Accept ISO strings (frozen + new local saves), Firestore-style
  // {toDate}, or numeric epoch ms — all yield Date safely.
  let dateText = '-';
  if (data.date) {
    let parsed = null;
    if (typeof data.date === 'string') parsed = new Date(data.date);
    else if (typeof data.date === 'number') parsed = new Date(data.date);
    else if (typeof data.date.toDate === 'function') parsed = data.date.toDate();
    if (parsed && !isNaN(parsed.getTime())) {
      dateText = parsed.toLocaleDateString('ja-JP') + ' ' + parsed.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
  }
  dateDiv.textContent = dateText;

  detailsDiv.appendChild(nameDiv);
  detailsDiv.appendChild(scoreDiv);
  detailsDiv.appendChild(dateDiv);

  item.appendChild(rankDiv);
  item.appendChild(detailsDiv);

  return item;
}

// Save the just-finished run to localStorage. Returns true on success.
function saveScoreToRanking(name, timeSeconds, hurdleHits) {
  if (typeof timeSeconds !== 'number' || !Number.isFinite(timeSeconds)) {
    console.warn('[HURDLE] saveScoreToRanking: ignoring non-numeric time', timeSeconds);
    return false;
  }
  const list = readLocalRanking();
  list.push({
    name: (name || 'Anonymous').toString().slice(0, 24),
    time: timeSeconds,
    hurdles: typeof hurdleHits === 'number' ? hurdleHits : 0,
    date: new Date().toISOString(),
    rules: rankingBoard(),
  });
  writeLocalRanking(list);
  console.log('[HURDLE] Local score saved.');
  return true;
}

// Export save function for use in game
window.saveScoreToRanking = saveScoreToRanking;

// Reset game function (preserves ORPHE CORE connection)
function resetGame() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = 0; }
  // Reset game state
  state = 'ready';
  countdownValue = 0;
  clock = new THREE.Clock();
  startEpoch = 0;
  firstFinishAt = 0;
  soloCoverUntil = 0;
  window.jumpStartTime = 0;  // Reset jump timing
  P.forEach(resetPlayer);
  // Reset ranking return state
  rankingReturnTo = 'start';

  onReset();
}

// One runner, one frame of the rules.
function stepPlayer(p, dt) {
  const pressing = p.accelKeyboard || p.accelOrphe;
  // 'coast': airborne runners cannot drive. 'classic': the air is treated like the ground.
  const coasting = !p.isGround && RULES.jump === 'coast';
  if (RULES.stamina === 'classic') {
    // Determine whether acceleration key is considered pressed
    const canAccel = pressing && (p.stamina > STAMINA_BLOCK_THRESHOLD);
    if (coasting) {
      // No drive from the legs, stamina on hold, a little speed bleeds off.
      p.vz *= Math.exp(-AIR_DRAG * dt);
      if (p.vz < BASE_SPEED) p.vz = BASE_SPEED;
    } else if (canAccel) {
      p.stamina -= STAMINA_USE_PER_SEC * dt;
      if (p.stamina < 0) p.stamina = 0;
      p.vz += ACCEL_RATE * dt;
    } else {
      p.stamina += STAMINA_REGEN_PER_SEC * dt;
      if (p.stamina > STAMINA_MAX) p.stamina = STAMINA_MAX;
      if (p.vz > BASE_SPEED) {
        p.vz -= FRICTION * dt;
        if (p.vz < BASE_SPEED) p.vz = BASE_SPEED;
      }
    }
    if (p.vz > MAX_SPEED) p.vz = MAX_SPEED;
  } else {
    // Pace model: input only steers speed; stamina follows how fast the runner goes.
    const cap = p.exhausted ? EXHAUSTED_SPEED : MAX_SPEED;
    if (coasting) {
      p.vz *= Math.exp(-AIR_DRAG * dt);
    } else if (pressing && p.vz < cap) {
      p.vz = Math.min(cap, p.vz + ACCEL_RATE * dt);
    } else if (p.vz > BASE_SPEED) {
      // not driving, or still above what tired legs can hold
      p.vz -= FRICTION * dt;
    }
    if (p.vz < BASE_SPEED) p.vz = BASE_SPEED;
    if (p.exhausted) {
      p.stamina += EXHAUSTED_REGEN_PER_SEC * dt;
      if (p.stamina >= EXHAUSTED_RECOVER_LEVEL) { p.exhausted = false; onRecovered(p); }
    } else {
      const over = (p.vz - CRUISE_SPEED) / (MAX_SPEED - CRUISE_SPEED);
      if (over > 0) p.stamina -= STAMINA_BURN_AT_MAX * over * over * dt;
      else if (p.isGround) p.stamina += PACE_REGEN_PER_SEC * dt;
      if (p.stamina > STAMINA_MAX) p.stamina = STAMINA_MAX;
      if (p.stamina <= 0) { p.stamina = 0; p.exhausted = true; p.exhaustCount++; onExhausted(p); }
    }
  }
  // Recover from slow-down
  if (p.slowRemain > 0) {
    p.slowRemain -= dt;
    const t = Math.max(0, p.slowRemain) / RECOVER_SEC;
    p.vz = p.vz * (1 - t) + (p.vz * SLOWDOWN_FACTOR) * t;
  }
  // Forward motion
  p.rig.position.z -= p.vz * dt;
  // Vertical motion
  p.rig.position.y += p.vy * dt;
  p.vy -= GRAVITY * dt;
  if (p.rig.position.y <= PLAYER_EYE_H) {
    p.rig.position.y = PLAYER_EYE_H; p.vy = 0;
    if (!p.isGround) onLand(p);
    p.isGround = true;
    p.jumpStartTime = 0;  // Reset jump timing
  }
  // Timer
  p.runTime = raceNow();
  // Hurdle collisions
  for (const h of hurdles) {
    if (p.hitMarkers.has(h)) continue;
    const dzToBar = Math.abs(p.rig.position.z - h.userData.z);
    if (dzToBar < 0.35) {
      const lift = p.rig.position.y - PLAYER_EYE_H;
      const neededLift = 0.35;
      if (lift < neededLift) {
        p.hits++;
        const speedAtImpact = p.vz;
        p.vz = Math.max(2.5, p.vz * SLOWDOWN_FACTOR);
        p.slowRemain = RECOVER_SEC;
        onHurdleHit(p, h.index, speedAtImpact);
      } else {
        onHurdleClear(p, h.index);
      }
      p.hitMarkers.add(h);
    }
  }
  // Finish line
  if (p.rig.position.z <= -COURSE_LEN_M) {
    p.finished = true;
    onPlayerFinish(p);
  }
}

// Update loop: integrates ORPHE and keyboard input
function update(dt) {
  if (state !== 'running') return;
  if (mode === 'vs') pollVsSensors(); else pollSoloCover();
  for (const p of active) {
    releaseHeldJump(p);
    if (!p.finished) stepPlayer(p, dt);
  }
  window.jumpStartTime = Math.max(0, ...active.map((p) => p.jumpStartTime));
  // VS: the race waits for the second runner, but not forever
  if (firstFinishAt && raceNow() - firstFinishAt > VS_TIMEOUT_SEC) {
    for (const p of active) { if (!p.finished) { p.finished = true; p.dnf = true; } }
  }
  if (active.every((p) => p.finished)) {
    state = 'finish';
    onRaceFinish();
  }
}

// Export reset function for potential external use
window.resetGame = resetGame;

// ---------------------------------------------------------------------------
// ORPHE CORE integration with CoreToolkit
// Note: This will be initialized outside the module script

// Export functions for external access.
// The sensor script calls these with both COREs combined, which is what SOLO
// wants (either foot). In VS each CORE belongs to one runner, so these are
// ignored there and pollVsSensors() reads the two devices separately.
window.gameJump = function() {
  if (mode !== 'solo') return true;
  const p = P[0];
  const wasGround = p.isGround;
  const accepted = sensorJump(p);
  if (accepted && wasGround && !p.isGround) p.sensorJumpAt = performance.now();
  else if (!insole && state === 'running') soloCoverUntil = performance.now() + SENSOR_JUMP_COOLDOWN_MS;
  return accepted;
};
window.setAccelPressed = function(pressed) {
  if (mode === 'solo') P[0].accelOrphe = pressed;
};

// ===========================================================================
// Presentation hooks (visuals, sound, HUD). Nothing below changes the rules.
// ===========================================================================
const RIVAL_LOOKS = [
  { skin: 0x8d5a3b, top: 0xd81e2c, shorts: 0xd81e2c, shoes: 0xf4f000, hair: 0x120c08 },
  { skin: 0xe0ac86, top: 0xf7d518, shorts: 0x0f6a36, shoes: 0xff5a1f, hair: 0x2a1a10 },
  { skin: 0x5c3a26, top: 0xf2f2f2, shorts: 0x15233f, shoes: 0x22e3ff, hair: 0x0c0806 },
  { skin: 0xc68d63, top: 0xff7a14, shorts: 0x111318, shoes: 0xb6ff3c, hair: 0x1a1210 },
  { skin: 0xf0c8a4, top: 0x2aa6e6, shorts: 0xf2f2f2, shoes: 0xff3d6e, hair: 0x6b4a22 },
  { skin: 0x70442c, top: 0x119a4a, shorts: 0xf2f2f2, shoes: 0xffd34d, hair: 0x0c0806 },
  { skin: 0xd9a47f, top: 0x7b3fd1, shorts: 0x111318, shoes: 0xffffff, hair: 0x1c1410 },
];
const PLAYER_LOOKS = [
  { skin: 0xe2b08c, top: 0x12c8e6, shorts: 0x0c0e14, shoes: 0x19e0ff, hair: 0x1c1410, accent: 0x19e0ff, color: '#22e3ff' },
  { skin: 0xd9a47f, top: 0xff4f7d, shorts: 0x0c0e14, shoes: 0xff7a9c, hair: 0x2a1a10, accent: 0xff4f7d, color: '#ff4f7d' },
];
const RIVAL_TIMES = [12.55, 13.15, 13.8, 14.5, 15.3, 16.3, 17.6];
const paceMode = () => RULES.stamina === 'pace';
const blocked = (p) => (paceMode() ? p.exhausted : p.stamina < STAMINA_BLOCK_THRESHOLD);
const pan = (p) => (mode === 'vs' ? (p.index ? 0.55 : -0.55) : 0);
const whoLabel = (p) => (mode === 'vs' ? `P${p.index + 1}` : 'YOU');

function shuffleRivals() {
  const times = [...RIVAL_TIMES];
  for (let i = times.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [times[i], times[j]] = [times[j], times[i]];
  }
  rivals.forEach((r, i) => r.reset(times[i] + (Math.random() - 0.5) * 0.36, 0.13 + Math.random() * 0.08));
}

/** Lanes, HUD panes and render views for the selected mode. */
function applyMode() {
  active = mode === 'vs' ? [P[0], P[1]] : [P[0]];
  P[0].lane = mode === 'vs' ? VS_LANES[0] : PLAYER_LANE;
  P[1].lane = VS_LANES[1];
  P.forEach(resetPlayer);
  for (const r of rivals) r.figure.root.visible = activeRivals().includes(r);
  if (ui) ui.setMode(mode);
}
function setupRace() {
  applyMode();
  const total = active.length + activeRivals().length;
  for (const p of active) {
    p.hud.configure({
      tag: mode === 'vs' ? `PLAYER ${p.index + 1}` : '110mH FINAL',
      lane: `LANE ${p.lane}`,
      total,
      pace: paceMode(),
      cruiseRatio: paceMode() ? CRUISE_SPEED / MAX_SPEED : null,
      markAt: paceMode() ? EXHAUSTED_RECOVER_LEVEL : STAMINA_BLOCK_THRESHOLD,
      markAlways: !paceMode(),
      warn: paceMode() ? '息切れ！回復中… / OUT OF BREATH' : '息切れ！足を止めて回復 / OUT OF BREATH',
    });
    p.hud.reset();
  }
  // the second view starts from wherever the title camera is, then flies to its own blocks
  P[1].camera.position.copy(P[0].camera.position);
  P[1].camera.quaternion.copy(P[0].camera.quaternion);
  P[1].camera.fov = P[0].camera.fov;
  P[1].cam.shift = P[0].cam.shift;
}

const r2 = (v) => (v == null ? null : +v.toFixed(2));
/** Everything needed to interpret a recording later. */
function sessionMeta() {
  const bles = sensors;
  const meta = {
    app: 'GAME-SUPER-HURDLE', deviceType: insole ? 'insole' : 'core', insoleToe: insole ? insole.toeState() : null,
    mode, rules: { ...RULES }, lanes: active.map((p) => p.lane),
    thresholds: { accG: window.accThresholdAccel, jumpPitchRad: window.pitchThresholdJump },
    constants: { COURSE_LEN_M, FIRST_HURDLE_M, HURDLE_SPACING_M, MAX_SPEED, ACCEL_RATE, FRICTION, JUMP_V0, GRAVITY, JUMP_SPEED_LOSS, CRUISE_SPEED, STAMINA_BURN_AT_MAX, EXHAUSTED_SPEED, EXHAUSTED_RECOVER_LEVEL, JUMP_GUARD_SEC, JUMP_HOLD_MS, CUE_EARLY_SEC, CUE_LATE_SEC },
    devices: [0, 1].map((i) => ({ id: i, player: mode === 'vs' ? i : 0, name: bles[i]?.bluetoothDevice?.name ?? null, info: bles[i]?.device_information ?? null })),
    sdk: { orphe: window.orphe_js_version_date ?? null, toolkit: window.coreToolkit_version_date ?? null },
    userAgent: navigator.userAgent, screen: [window.innerWidth, window.innerHeight, window.devicePixelRatio],
  };
  try { return JSON.parse(JSON.stringify(meta)); } catch { return { app: 'GAME-SUPER-HURDLE', mode }; }
}
/** Seconds until a runner taking off `dist` metres before the bar gets there, under the current jump rule. */
function airTime(dist, speed) {
  if (speed <= 0.01) return null;
  if (RULES.jump !== 'coast') return dist / speed;
  const x = 1 - (AIR_DRAG * dist) / speed;
  return x > 0 ? -Math.log(x) / AIR_DRAG : null;
}
function traceHurdle(p, index, hit, speed) {
  const j = p.trace.lastJump;
  const mine = j && j.index === index ? j : null;
  p.trace.hurdles.push({ i: index, t: p.runTime, hit, speed, tth: mine ? mine.tth : null, gap: mine ? mine.gap : null });
  telemetry.event(p.index, hit ? 'hit' : 'clear', { hurdle: index, speed: r2(speed), lift: r2(p.rig.position.y - PLAYER_EYE_H), takeoffGap: mine ? r2(mine.gap) : null });
}

function onCountdownStart() {
  stageView.phase = 'countdown';
  zeroSamples = [];
  telemetry.start(sessionMeta());   // records only while the toggle is on; starts here so the reaction to the gun is captured
  telemetry.event(-1, 'countdown', null);
  for (const p of active) { p.view.crouchTarget = 0.5; p.view.fade = 0; setCamMode(p, 'fp', 2.3); }
  layoutViews();
  ui.setScreen('countdown');
  ui.setCinema(true);
  audio.ui('start');
  audio.setMusic('off', 0.5);
}
function onCountdownTick(n) {
  telemetry.event(-1, 'count', n);
  ui.countdown(n);
  audio.countBeep();
  if (n === 3) {
    world.drawJumbo({ mode: 'text', text: 'ON YOUR MARKS', sub: mode === 'vs' ? 'PLAYER 1  vs  PLAYER 2' : "MEN'S 110m HURDLES · FINAL" });
    world.setExcitement(0.1, 0.02);
    audio.setCrowd(0.1, 0.5);
    activeRivals().forEach((r) => r.setCrouch(0));
  } else if (n === 2) {
    world.drawJumbo({ mode: 'text', text: 'SET', color: '#ffd34d', sub: 'SILENCE FOR THE START' });
    world.setExcitement(0.0, 0.004);
    audio.setCrowd(0.02, 1);
    audio.heartbeat();
    activeRivals().forEach((r) => r.setCrouch(1));
    for (const p of active) p.view.crouchTarget = 1;
  } else {
    audio.heartbeat();
    audio.riser(0.95);
  }
}
function onGo() {
  stageView.phase = 'race';
  telemetry.beginStats();
  telemetry.event(-1, 'go', null);
  applyRestingPitch();
  for (const p of active) { p.view.crouchTarget = 0; p.view.fovKick = 5; p.view.flash = 0.3; p.view.stepPhase = 0; }
  ui.countdownGo();
  ui.setScreen('race');
  ui.setCinema(false);
  audio.gun();
  audio.setMusic('race', 0.05);
  audio.setCrowd(0.75, 0);
  world.kick(0.85, 0.3);
  world.setExcitement(0.5, 0.03);
  world.pulseLed(1);
  activeRivals().forEach((r) => r.start());
}
function onJump(p) {
  audio.jump();
  p.view.fovKick = Math.max(p.view.fovKick, 2.5);
  const next = nextHurdle(p);
  const gap = next ? p.rig.position.z - next.userData.z : null;
  p.trace.lastJump = { index: next ? next.index : -1, gap, tth: gap == null ? null : airTime(Math.max(0, gap - 0.35), p.vz) };
  telemetry.event(p.index, 'jump', { hurdle: p.trace.lastJump.index, gap: r2(gap), speed: r2(p.vz) });
}
function onLand(p) {
  telemetry.event(p.index, 'land', { speed: r2(p.vz) });
  audio.land(0.7 + 0.3 * (p.vz / MAX_SPEED));
  p.view.landV = -1.1;
}
function onHurdleClear(p, index) {
  traceHurdle(p, index, false, p.vz);
  p.cleared++;
  p.combo++;
  audio.hurdleClear(p.combo);
  audio.hurdlePass();
  world.clearHurdle(p.lane, index);
  world.kick(0.1, 0.02);
  p.hud.hurdle(index, false, p.hits, p.cleared);
  if (p.combo >= 3) p.hud.popup(`CLEAR ×${p.combo}`, 'clear', p.combo >= 10 ? 'PERFECT RUN' : 'COMBO');
  else p.hud.popup('CLEAR!', 'clear');
}
function onHurdleHit(p, index, speedAtImpact) {
  traceHurdle(p, index, true, speedAtImpact);
  p.combo = 0;
  p.view.trauma = 1;
  p.view.hitRoll = 0.08;
  p.view.hit = 1;
  audio.hurdleHit();
  audio.crowdGasp();
  world.hitHurdle(p.lane, index, speedAtImpact);
  fx.hitSparks(p.rig.position.x, 1.0, hurdles[index].userData.z);
  p.hud.hurdle(index, true, p.hits, p.cleared);
  p.hud.popup('HIT!', 'hit');
}
function onExhausted(p) {
  telemetry.event(p.index, 'exhausted', { dist: r2(-p.rig.position.z) });
  p.view.trauma = Math.max(p.view.trauma, 0.45);
  audio.crowdGasp();
  p.hud.popup('息切れ！', 'hit', 'OUT OF BREATH');
}
function onRecovered(p) {
  telemetry.event(p.index, 'recovered', { dist: r2(-p.rig.position.z) });
  p.hud.popup('回復！', 'clear', 'SECOND WIND');
}

const finishTimers = [];
function placeLabel(n) {
  return n === 1 ? '1ST PLACE · GOLD' : n === 2 ? '2ND PLACE · SILVER' : n === 3 ? '3RD PLACE · BRONZE' : `${n}TH PLACE`;
}
/** Finish place among everyone who has crossed the line so far. */
function finishPlace(p) {
  let ahead = activeRivals().filter((r) => r.finished && r.finishTime < p.runTime).length;
  for (const q of active) if (q !== p && q.finished && !q.dnf && q.runTime < p.runTime) ahead++;
  return 1 + ahead;
}
/** One human crossed the line: the moment itself (flash, gate, confetti, roar). */
function onPlayerFinish(p) {
  const first = !firstFinishAt;
  if (first) firstFinishAt = p.runTime;
  p.place = finishPlace(p);
  telemetry.event(p.index, 'finish', { time: r2(p.runTime), place: p.place });
  p.cam.mode = 'finish';
  p.view.finishT = 0;
  p.view.runoutV = p.vz;
  p.view.flash = 0.75;
  p.view.trauma = Math.max(p.view.trauma, 0.35);
  p.hud.jumpCue(false);
  world.setGuide(p.index, false);
  world.kick(1, 0.5);
  world.pulseLed(1);
  audio.crowdCheer(first ? 0.9 : 0.6);
  if (mode === 'vs') {
    p.hud.setDone(true);
    p.hud.popup('FINISH', 'info', `${fmt(p.runTime, 2)}s`);
  }
  if (!first) return;
  const z = -COURSE_LEN_M;
  world.burstGate();
  fx.gateShatter(z, (LANES * LANE_W) / 2);
  fx.confetti(-5.6, 1.2, z - 1, 220, { vx: 5.5, vy: 10, vz: -4, spread: 3.2 });
  fx.confetti(5.6, 1.2, z - 1, 220, { vx: -5.5, vy: 10, vz: -4, spread: 3.2 });
  fx.fountain(-5.9, z - 0.6, 2.6);
  fx.fountain(5.9, z - 0.6, 2.6);
  audio.gateShatter();
  audio.fountain(2.6);
  finishTimers.push(setTimeout(() => {
    fx.confetti(-4.5, 3.5, z - 17, 200, { vx: 3, vy: 8, vz: 0, spread: 4 });
    fx.confetti(4.5, 3.5, z - 17, 200, { vx: -3, vy: 8, vz: 0, spread: 4 });
  }, 900));
}
/** Every human is done: result card, fireworks, music. */
function onRaceFinish() {
  stageView.phase = 'finish';
  const done = active.filter((p) => !p.dnf);
  for (const p of active) { p.place = p.dnf ? active.length + activeRivals().length : finishPlace(p); p.hud.jumpCue(false); world.setGuide(p.index, false); }
  // coaching-style analysis for every human runner
  const entries = active.map((p) => {
    p.analysis = analyzeRun({
      time: p.runTime, dnf: p.dnf, hits: p.hits, cleared: p.cleared, hurdles: HURDLES, topSpeed: p.topSpeed,
      staminaLeft: p.stamina, exhaustCount: p.exhaustCount, paceRule: paceMode(), courseLen: COURSE_LEN_M, maxSpeed: MAX_SPEED,
      ignoredJumps: p.guarded, heldJumps: p.heldJumps,
      trace: p.trace, sensor: telemetry.sensorStats(mode === 'vs' ? [p.index] : [0, 1], p.runTime, mode === 'vs'),
    });
    return { label: mode === 'vs' ? `PLAYER ${p.index + 1}` : 'YOU', color: PLAYER_LOOKS[p.index].color, analysis: p.analysis };
  });
  telemetry.stop(true, {
    players: active.map((p) => ({
      index: p.index, lane: p.lane, time: p.dnf ? null : p.runTime, hits: p.hits, cleared: p.cleared, topSpeed: p.topSpeed,
      staminaLeft: p.stamina, exhaustCount: p.exhaustCount, ignoredJumps: p.guarded, heldJumps: p.heldJumps, pitchZero: mode === 'vs' ? [pitchZero[p.index]] : [...pitchZero], place: p.place, score: p.analysis.total, grade: p.analysis.grade,
      axes: Object.fromEntries(p.analysis.axes.map((a) => [a.key, a.score])), metrics: p.analysis.metrics, splits: p.analysis.splits,
    })),
  });
  ui.setScreen('finish');
  audio.stopRace();
  audio.setCrowd(1, 0);
  audio.setMusic('off', 0.15);
  world.setExcitement(1, 0.32);
  let podium = false;
  if (mode === 'vs') {
    const winner = done.length === 0 ? -1 : done.reduce((a, b) => (b.runTime < a.runTime ? b : a)).index;
    ui.showFinishVs({
      winner, analysis: entries,
      players: active.map((p) => ({ time: p.dnf ? null : p.runTime, hits: p.hits, clean: p.cleared, top: p.topSpeed, staminaLeft: p.stamina, exhaustCount: p.exhaustCount, place: p.place })),
    });
    world.drawJumbo(winner < 0
      ? { mode: 'text', text: 'NO FINISHER', sub: 'TRY AGAIN' }
      : { mode: 'text', text: `PLAYER ${winner + 1} WINS`, color: PLAYER_LOOKS[winner].color, sub: active.map((p) => `P${p.index + 1} ${p.dnf ? 'DNF' : fmt(p.runTime, 2)}`).join('   ·   ') });
    world.drawClock(done.length ? fmt(Math.min(...done.map((p) => p.runTime)), 2) : '--');
    podium = done.some((p) => p.place <= 3);
    audio.fanfare(1);
  } else {
    const p = P[0];
    // personal best is tracked separately from the (optional) ranking entry
    const prevBest = readBest();
    const isPB = !Number.isFinite(prevBest) || p.runTime < prevBest;
    if (isPB) { try { localStorage.setItem(bestKey(), String(p.runTime)); } catch { /* ignore */ } }
    ui.showFinish({ time: p.runTime, hits: p.hits, clean: p.cleared, top: p.topSpeed, staminaLeft: p.stamina, exhaustCount: p.exhaustCount, place: p.place, isPB, analysis: entries });
    ui.setBest(isPB ? p.runTime : prevBest);
    world.drawJumbo({ mode: 'time', time: fmt(p.runTime, 2), color: '#ffd34d', sub: placeLabel(p.place), subColor: '#b6ff3c' });
    world.drawClock(fmt(p.runTime, 2));
    podium = p.place <= 3;
    audio.fanfare(podium ? 1 : 0);
  }
  finishTimers.push(setTimeout(() => audio.setMusic('result', 1.2), 1700));
  // fireworks behind the far stand; a bigger show for a win or a podium finish
  const shells = mode === 'vs' ? 12 : P[0].place === 1 ? 16 : podium ? 11 : 6;
  for (let i = 0; i < shells; i++) {
    finishTimers.push(setTimeout(() => fx.firework(-34 + Math.random() * 62, -198 - Math.random() * 20), 500 + i * 520 + Math.random() * 300));
  }
  finishTimers.push(setTimeout(() => { world.setExcitement(0.62, 0.07); audio.setCrowd(0.6, 0); }, 9000));
}
function onReset() {
  finishTimers.forEach(clearTimeout); finishTimers.length = 0;
  if (telemetry.active) telemetry.stop(false, null);   // an abandoned run is still worth keeping for debugging
  stageView.phase = 'title';
  if (!world) return;
  applyMode();
  world.resetRace();
  world.setExcitement(0.14, 0.012);
  world.drawJumbo({ mode: 'title' });
  world.drawClock('0.00');
  fx.reset();
  shuffleRivals();
  P.forEach((p) => p.hud.reset());
  ui.setCinema(false);
  ui.setScreen('title');
  ui.setDrawer(false);
  layoutViews();
  setCamMode(P[0], 'title', 1.4);
  P[0].cam.shot = 0; P[0].cam.shotT = 0.7;
  audio.stopRace();
  audio.setCrowd(0.14, 0);
  audio.setMusic('title', 1.2);
}

// Personal best is kept per rule set: times under different rules are not comparable.
const bestKey = () => (RULES.jump === 'classic' && RULES.stamina === 'classic' ? 'hurdle.personalBest' : `hurdle.personalBest.${RULES.jump}.${RULES.stamina}`);
function readBest() {
  try { return parseFloat(localStorage.getItem(bestKey())); } catch { return NaN; }
}

// ---------------------------------------------------------------------------
// Camera director: title fly-arounds → fly-in to the blocks → first person → finish drift
const tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), tQuat = new THREE.Quaternion();
const tEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const lookM = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const SHOT_SECONDS = 9.5;
const TITLE_SHOTS = [
  (t, p, l) => { p.set(0.3, 2.35 + 0.05 * t, 7.6 - 0.55 * t); l.set(0.4, 0.3, -30); return 52; },
  (t, p, l) => { p.set(6.2, 0.95 + 0.03 * t, -6 - 2.4 * t); l.set(-4, 1.0, -30 - 2.4 * t); return 46; },
  (t, p, l) => { p.set(9 - 0.4 * t, 7.5 + 0.35 * t, -124 + 1.0 * t); l.set(-2, 0.5, -72); return 50; },
  (t, p, l) => { p.set(-38 + 1.2 * t, 23 - 0.3 * t, 12); l.set(-16, 2, -66); return 56; },
];
function setCamMode(p, camMode, blendDur) {
  const cam = p.cam;
  cam.fromPos.copy(p.camera.position);
  cam.fromQuat.copy(p.camera.quaternion);
  cam.fromFov = p.camera.fov;
  cam.fromShift = cam.shift;
  cam.mode = camMode; cam.blend = 0; cam.blendDur = Math.max(0.001, blendDur);
}
function updateCamera(p, dt) {
  const cam = p.cam, v = p.view, camera = p.camera, rig = p.rig;
  let fov = 55, shift = 0;
  const k = Math.min(1, (p.finished ? v.runoutV : p.vz) / MAX_SPEED);
  if (cam.mode === 'title') {
    cam.shotT += dt;
    if (cam.shotT > SHOT_SECONDS) { cam.shotT = 0; cam.shot = (cam.shot + 1) % TITLE_SHOTS.length; }
    fov = TITLE_SHOTS[cam.shot](cam.shotT, tPos, tLook);
    lookM.lookAt(tPos, tLook, UP);
    tQuat.setFromRotationMatrix(lookM);
    shift = 0.15;
    v.fade = Math.max(1 - cam.shotT / 0.7, (cam.shotT - (SHOT_SECONDS - 0.7)) / 0.7, 0);
  } else {
    v.fade = Math.max(0, v.fade - dt * 2);
    const sp = Math.PI * v.stepPhase;
    const bob = 0.05 * k * Math.abs(Math.sin(sp)) - 0.03 * k;
    const sway = 0.03 * k * Math.sin(sp);
    const arc = Math.sin(Math.PI * jumpProgress(p)) * v.air;
    const a = v.trauma * v.trauma;
    const t = stageView.time;
    const crouchY = -0.8 * Math.min(1, v.crouch * 1.5);
    tPos.set(
      rig.position.x + sway + a * 0.05 * Math.sin(t * 61),
      rig.position.y + bob + crouchY + v.landY + a * 0.06 * Math.sin(t * 73 + 1),
      rig.position.z,
    );
    let pitch = -0.02 - 0.012 * k - 0.15 * arc - 0.42 * v.crouch + a * 0.035 * Math.sin(t * 67 + 2);
    let yaw = a * 0.03 * Math.sin(t * 53 + 4);
    const roll = 0.011 * k * Math.sin(sp) + v.hitRoll + a * 0.05 * Math.sin(t * 59 + 3);
    fov = 70 + 13 * Math.pow(k, 1.5) + v.fovKick + 2 * arc;
    if (cam.mode === 'finish') {
      // settle into a wide shot of the far stand, the big screen and the fireworks
      const h = smooth((v.finishT - 1.1) / 2.6);
      tPos.y += 0.45 * h;
      pitch += 0.2 * h;
      yaw += (0.05 * Math.sin(t * 0.33) - 0.04) * h;
      fov += (60 - fov) * h;
      if (mode === 'solo') shift = 0.36 * h;   // SOLO: the result card sits on the left
    }
    tEuler.set(pitch, yaw, roll);
    tQuat.setFromEuler(tEuler);
  }
  if (cam.blend < 1) {
    cam.blend = Math.min(1, cam.blend + dt / cam.blendDur);
    const e = smooth(cam.blend);
    camera.position.lerpVectors(cam.fromPos, tPos, e);
    camera.quaternion.slerpQuaternions(cam.fromQuat, tQuat, e);
    camera.fov = cam.fromFov + (fov - cam.fromFov) * e;
    cam.shift = cam.fromShift + (shift - cam.fromShift) * e;
  } else {
    camera.position.copy(tPos);
    camera.quaternion.copy(tQuat);
    camera.fov = fov;
    cam.shift = shift;
  }
  // Slide the vanishing point sideways so the scene sits beside the UI panels.
  const w = p.viewW, h = window.innerHeight;
  if (Math.abs(cam.shift) > 0.001) camera.setViewOffset(w, h, -cam.shift * w, 0, w, h);
  else if (camera.view) camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
// Take-off cue. A take-off clears the bar when it comes 0.081 s to 0.544 s before it (the jump
// arc is 0.35 m up for that long). The cue used to light at 0.47 s. In recorded sensor races,
// when it lit on the approach (first hurdle, after a hit, a slower pace) the jump registered a
// median 0.24 s later, i.e. about 0.2 s before the bar, close to the late edge. Lighting it at the
// earliest take-off that still clears gives that time back without ever asking for a jump that
// would fall short.
// At race pace it cannot help: the flight covers most of the 9.14 m between hurdles and the
// runner lands already inside the next zone with about 0.2 s on the ground (0.15-0.19 s in the
// recordings), far too short to react to a sign. So the zone for the hurdle after the one being
// jumped stays on the track while airborne (unlit), where it can be seen coming.
const CUE_EARLY_SEC = 0.53;
const CUE_LATE_SEC = 0.11;
/** Metres covered per m/s of take-off speed after t seconds in the air under the current jump rule. */
function airDistance(t) { return RULES.jump === 'coast' ? (1 - Math.exp(-AIR_DRAG * t)) / AIR_DRAG : t; }
function jumpProgress(p) {
  if (!p.jumpStartTime) return 0;
  return Math.min(1, (performance.now() - p.jumpStartTime) / (JUMP_AIR_TIME * 1000));
}
/** Stamina an even pace would have left at this point: full at the gun, empty on the line. */
function paceTarget(p) {
  return 1 - Math.min(1, Math.max(0, (-p.rig.position.z - 2) / (COURSE_LEN_M - 2)));
}

// ---------------------------------------------------------------------------
// Per-frame presentation
const posePlayer = newPose(), poseA = newPose(), poseB = newPose();
function presentPlayer(p, dt, sdt) {
  const v = p.view;
  const running = state === 'running' && !p.finished;

  // run-out past the line (visual only: the official time is already recorded)
  if (p.finished) {
    v.finishT += dt;
    v.runoutV = Math.max(0, v.runoutV - (v.runoutV * 0.9 + 1.2) * sdt);
    p.rig.position.z = Math.max(-COURSE_LEN_M - 16, p.rig.position.z - v.runoutV * sdt);
    if (p.rig.position.y > PLAYER_EYE_H) {
      p.rig.position.y += p.vy * sdt; p.vy -= GRAVITY * sdt;
      if (p.rig.position.y <= PLAYER_EYE_H) { p.rig.position.y = PLAYER_EYE_H; p.vy = 0; p.isGround = true; p.jumpStartTime = 0; onLand(p); }
    }
  }
  const speed = running ? p.vz : p.finished ? v.runoutV : 0;
  const k = speed / MAX_SPEED;
  if (running) {
    p.topSpeed = Math.max(p.topSpeed, p.vz);
    const tr = p.trace, t = raceNow();
    if (tr.firstAccel == null && (p.accelKeyboard || p.accelOrphe)) tr.firstAccel = t;
    if (blocked(p)) tr.blockedTime += dt;
    if (t - tr.sampleAt >= 0.05) { tr.sampleAt = t; tr.samples.push([t, -p.rig.position.z, p.vz, p.stamina, paceTarget(p)]); }
  }

  // step cadence drives footsteps, camera bob, arm swing and the runner's shadow
  const stepRate = 1.4 + 2.6 * k;
  const before = Math.floor(v.stepPhase);
  if (p.isGround && speed > 0.4) v.stepPhase += stepRate * sdt;
  if (Math.floor(v.stepPhase) !== before && p.isGround && speed > 3.0) {
    audio.footstep(pan(p) * 2.2 + (Math.floor(v.stepPhase) % 2 ? 1 : -1), 0.75 + 0.35 * k);
  }

  // springs and decays
  v.crouch += (v.crouchTarget - v.crouch) * Math.min(1, dt * (v.crouchTarget > v.crouch ? 3.2 : 2.6));
  v.air += ((p.isGround ? 0 : 1) - v.air) * Math.min(1, dt * (p.isGround ? 9 : 14));
  v.landV += (-v.landY * 230 - v.landV * 24) * dt;
  v.landY += v.landV * dt;
  v.trauma = Math.max(0, v.trauma - dt * 1.7);
  v.hitRoll *= Math.exp(-dt / 0.12);
  v.fovKick *= Math.exp(-dt / 0.35);
  v.hit = Math.max(0, v.hit - dt * 1.5);
  v.flash = Math.max(0, v.flash - dt * 2.4);

  // body: shadow caster + first-person limbs for the owner, a full figure for the opponent's view
  const phi = Math.PI * v.stepPhase;
  const u = jumpProgress(p);
  p.bodyVisible = stageView.phase !== 'title';
  if (p.bodyVisible) {
    poseRun(poseA, phi, Math.max(0.1, k), 0.12 + 0.2 * v.crouch);
    lerpPose(posePlayer, poseA, poseHurdle(poseB, u), v.air);
    if (v.crouch > 0.02) lerpPose(posePlayer, posePlayer, poseCrouch(poseB, Math.min(1, v.crouch * 1.2)), smooth(v.crouch * 1.4));
    for (const body of [p.shadowBody, p.figure]) {
      body.root.position.set(p.rig.position.x, p.rig.position.y - PLAYER_EYE_H, p.rig.position.z + 0.12);
      body.apply(posePlayer);
    }
    p.fpBody.update(phi, k, v.air, u);
  }
  p.fpVisible = p.bodyVisible && p.cam.mode !== 'title' && p.cam.blend > 0.85;

  updateCamera(p, dt);

  // take-off guide for the next hurdle
  if (running) {
    const next = nextHurdle(p);
    let cue = false;
    // in the air, the hurdle this jump was for has no zone to show; the one after it does
    const flyingOver = !p.isGround && (!p.trace.lastJump || !next || p.trace.lastJump.index === next.index);
    if (next && p.vz > 2.5 && !flyingOver) {
      const zNear = next.userData.z + 0.35 + p.vz * airDistance(CUE_EARLY_SEC);
      const zFar = next.userData.z + 0.35 + p.vz * airDistance(CUE_LATE_SEC);
      const d = p.rig.position.z - next.userData.z;
      const inside = p.isGround && p.rig.position.z <= zNear && p.rig.position.z >= zFar;
      world.setGuide(p.index, d < 34, p.rig.position.x, zNear, zFar, inside ? 1 : 0, smooth((34 - d) / 14));
      cue = inside;
    } else {
      world.setGuide(p.index, false);
    }
    p.hud.jumpCue(cue);
  }

  // post FX for this runner's view
  const U = p.fxView.uniforms;
  U.uSpeed.value = p.cam.mode === 'title' ? 0 : k;
  U.uHit.value = v.hit;
  U.uFlash.value = v.flash;
  U.uFade.value = v.fade;
  const tired = running && (blocked(p) ? 1 : p.stamina < 0.15 ? (1 - p.stamina / 0.15) * 0.6 : 0);
  v.exhaust += ((tired || 0) - v.exhaust) * Math.min(1, dt * 4);
  U.uExhaust.value = v.exhaust;
  p.fxView.lines.update(sdt, p.rig.position.x, p.rig.position.z, p.cam.mode === 'title' ? 0 : speed);
}

function present(dt, rawDt) {
  stageView.time += dt;
  const running = state === 'running';
  // SOLO: a beat of slow motion on the line. VS keeps real time because the other runner is still racing.
  let ts = 1;
  if (mode === 'solo' && P[0].finished) {
    const ft = P[0].view.finishT;
    ts = ft < 0.8 ? 0.28 : Math.min(1, 0.28 + ((ft - 0.8) / 0.8) * 0.72);
  }
  const sdt = dt * ts;

  for (const p of active) presentPlayer(p, dt, sdt);

  // rivals + live places
  const rivalDt = running ? rawDt : stageView.phase === 'finish' ? sdt : dt;
  for (const r of activeRivals()) r.update(rivalDt);
  if (running) {
    for (const p of active) {
      if (p.finished) continue;
      let ahead = activeRivals().filter((r) => r.z < p.rig.position.z - 0.001).length;
      for (const q of active) if (q !== p && (q.finished || q.rig.position.z < p.rig.position.z - 0.001)) ahead++;
      p.place = 1 + ahead;
    }
  }

  // crowd, music and breathing follow the fastest / most tired human
  if (running) {
    const racing = active.filter((p) => !p.finished);
    if (racing.length) {
      const k = Math.max(...racing.map((p) => p.vz)) / MAX_SPEED;
      const e = 0.42 + 0.45 * k;
      world.setExcitement(e, 0.02 + 0.03 * k);
      audio.setCrowd(e, 0);
      audio.setRace(k, Math.min(...racing.map((p) => p.stamina)), racing.some(blocked));
    }
  }
  if (stageView.phase === 'title') {
    stageView.waveAt -= dt;
    if (stageView.waveAt < 0) { stageView.waveAt = 26; world.startWave(); }
  }

  // big screen + trackside clock (throttled: each redraw re-uploads a texture)
  if (running && stageView.time - stageView.jumboAt > 0.07) {
    stageView.jumboAt = stageView.time;
    const now = raceNow();
    if (mode === 'vs') {
      world.drawJumbo({ mode: 'duo', cols: active.map((p) => ({
        label: `PLAYER ${p.index + 1}`, color: PLAYER_LOOKS[p.index].color, done: p.finished,
        time: p.finished ? fmt(p.runTime, 2) : fmt(now, 1), sub: p.finished ? 'FINISH' : `${fmt(p.vz * 3.6, 0)} km/h`,
      })) });
    } else {
      world.drawJumbo({ mode: 'time', time: fmt(now, 1), sub: `${fmt(P[0].vz * 3.6, 0)} km/h` });
    }
    world.drawClock(fmt(now, 1));
  }

  // HUD
  if (running) {
    for (const p of active) {
      const others = activeRivals().map((r) => (BLOCK_Z - r.z) / (COURSE_LEN_M + BLOCK_Z));
      for (const q of active) if (q !== p) others.push(-q.rig.position.z / COURSE_LEN_M);
      p.hud.update({
        time: p.runTime,
        remaining: Math.max(0, COURSE_LEN_M + p.rig.position.z),
        progress: Math.min(1, -p.rig.position.z / COURSE_LEN_M),
        speed: p.finished ? 0 : p.vz, speedRatio: p.finished ? 0 : p.vz / MAX_SPEED,
        stamina: p.stamina, blocked: !p.finished && blocked(p),
        pace: paceMode() ? paceTarget(p) : null,
        burning: paceMode() && !p.finished && !p.exhausted && p.vz > CRUISE_SPEED,
        place: p.place, rivals: others,
      });
    }
  }
  if (stageView.phase === 'finish') {
    const rows = [
      ...active.map((p) => ({ lane: p.lane, time: p.dnf ? null : p.runTime, who: whoLabel(p) })),
      ...activeRivals().map((r) => ({ lane: r.lane, time: r.finished ? r.finishTime : null, who: 'RIVAL' })),
    ];
    rows.sort((a, b) => (a.time ?? 1e9) - (b.time ?? 1e9) || a.lane - b.lane);
    ui.updateBoard(rows);
  }
  if (telemetry.active) {
    for (const p of active) telemetry.frame([p.index, r2(-p.rig.position.z), r2(p.rig.position.y - PLAYER_EYE_H), r2(p.vz), +p.stamina.toFixed(3), p.exhausted ? 1 : 0, p.isGround ? 1 : 0, p.accelKeyboard ? 1 : 0, p.accelOrphe ? 1 : 0, p.place]);
  }
  const t = performance.now();
  ui.pollSensors({ accel: P.some((p) => p.accelKeyboard), jump: P.some((p) => t - p.keyJumpAt < 250) });

  world.update(sdt);
  fx.update(sdt);
  audio.tick();
}

// ---------------------------------------------------------------------------
// Views: one full-screen view (SOLO and the title), or two side by side (VS race).
const splitScreen = () => mode === 'vs' && stageView.phase !== 'title';
function renderView(p, x, w, h) {
  // each view shows its own first-person limbs, shadow body, speed lines and take-off guide,
  // and the other human as a full figure
  for (const q of active) {
    const own = q === p;
    q.fpBody.group.visible = own && q.fpVisible;
    q.shadowBody.root.visible = own && q.bodyVisible;
    q.figure.root.visible = !own && q.bodyVisible;
    q.fxView.lines.mesh.visible = own && q.fxView.lines.on;
  }
  world.viewGuides(p.index);
  world.focusShadow(stageView.phase === 'title' ? p.camera.position.z + 5 : p.rig.position.z);
  world.preRender(p.camera);
  p.fxView.render(x, w, h);
}
function render() {
  const w = window.innerWidth, h = window.innerHeight;
  if (splitScreen()) {
    renderer.setScissorTest(true);
    const half = Math.floor(w / 2);
    renderView(P[0], 0, half, h);
    renderView(P[1], half, w - half, h);
  } else {
    renderer.setScissorTest(false);
    for (const q of P) { if (q !== P[0]) { q.fpBody.group.visible = false; q.shadowBody.root.visible = false; q.figure.root.visible = false; q.fxView.lines.mesh.visible = false; } }
    renderView(P[0], 0, w, h);
  }
}

// ---------------------------------------------------------------------------
// Resolution / quality: start sharp, step down if the frame time says so.
const QUALITY = { high: 2, medium: 1.25, low: 0.85 };
const AUTO_STEPS = [1.5, 1.25, 1.0, 0.85, 0.7];
const perf = { mode: 'auto', step: 0, acc: 0, frames: 0, slow: 0, fps: 60 };
function pixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  if (perf.mode !== 'auto') return Math.min(dpr, QUALITY[perf.mode]);
  return Math.min(dpr, AUTO_STEPS[perf.step]);
}
function layoutViews() {
  const w = window.innerWidth, h = window.innerHeight, pr = pixelRatio();
  fx.setCanvasSize(w, h, pr);
  const half = Math.floor(w / 2);
  P.forEach((p, i) => {
    p.viewW = splitScreen() ? (i === 0 ? half : w - half) : w;
    p.fxView.setSize(p.viewW, h, pr);
    p.camera.aspect = p.viewW / h;
    p.camera.updateProjectionMatrix();
  });
}
function trackPerformance(rawDt) {
  perf.acc += rawDt; perf.frames++;
  if (perf.acc < 0.5) return;
  perf.fps = perf.frames / perf.acc;
  perf.acc = 0; perf.frames = 0;
  ui.setFps(perf.fps, `${pixelRatio().toFixed(2)}x`);
  if (perf.mode !== 'auto' || document.hidden) return;
  perf.slow = perf.fps < 48 ? perf.slow + 1 : 0;
  if (perf.slow >= 4 && perf.step < AUTO_STEPS.length - 1) { perf.step++; perf.slow = 0; layoutViews(); }
}

// Animation loop
function loop() {
  const rawDt = clock.getDelta();
  if (state === 'running') update(rawDt);
  else if (stageView.phase === 'countdown') sampleRestingPitch();
  present(Math.min(rawDt, 0.05), rawDt);
  render();
  trackPerformance(rawDt);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Boot
async function loadLogo() {
  try {
    const img = new Image();
    img.src = 'rogo.png';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    // The logo file is white on a dark plate: turn brightness into alpha.
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    const bg = px[0];
    for (let i = 0; i < px.length; i += 4) {
      const a = Math.max(0, Math.min(1, (px[i] - bg - 10) / (235 - bg)));
      px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = a * 255;
    }
    ctx.putImageData(data, 0, 0);
    return c;
  } catch {
    return null;
  }
}

function setRules(next) {
  RULES.jump = next.jump === 'classic' ? 'classic' : 'coast';
  RULES.stamina = next.stamina === 'classic' ? 'classic' : 'pace';
  RULES.guard = next.guard === 'off' ? 'off' : 'on';
  try { localStorage.setItem(RULES_KEY, JSON.stringify(RULES)); } catch { /* ignore */ }
  ui.setRules(RULES);
  const best = readBest();
  ui.setBest(Number.isFinite(best) ? best : 0);
  // a rule change mid-race would make the run meaningless: go back to the title
  if (stageView.phase !== 'title') resetGame();
}
function setMode(next) {
  if (stageView.phase !== 'title') return;
  mode = next === 'vs' ? 'vs' : 'solo';
  try { localStorage.setItem('hurdle.mode', mode); } catch { /* ignore */ }
  applyMode();
  shuffleRivals();
}

async function boot() {
  const fontReady = Promise.race([
    document.fonts.load('64px "Bebas Neue"').catch(() => {}),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  const [logo] = await Promise.all([loadLogo(), fontReady]);

  // INSOLE swaps the connection UI before the rest of the UI looks at it
  if (DEVICE === 'insole') {
    try { await loadInsoleSdk(); insole = setupInsole(); } catch (error) { console.error('[HURDLE] ORPHE INSOLE support could not be loaded; staying on ORPHE CORE.', error); insole = null; }
  }
  sensors = insole ? insole.devices : (window.bles || []);

  ui = createUI({
    audio,
    courseLen: COURSE_LEN_M,
    hurdleDistances: hurdles.map((h) => -h.userData.z),
    maxRivals: RIVAL_LANES.length,
    handlers: {
      onQuality(q) { perf.mode = q; perf.step = 0; perf.slow = 0; layoutViews(); },
      onMode: setMode,
      onRules: setRules,
      onRecord(on) { telemetry.setRecording(on); },
      // CORE <-> INSOLE needs a different set of scripts, so switching reloads the page
      onDevice(next) {
        try { localStorage.setItem('hurdle.device', next === 'insole' ? 'insole' : 'core'); } catch { /* ignore */ }
        const url = new URL(window.location.href);
        url.searchParams.delete('device');
        window.location.replace(url.toString());
      },
      onInsoleToe(m) { if (insole) { insole.setToeMode(m); ui.setInsoleToe(insole.toeMode, insole.toeState()); } },
      onExport(kind) {
        if (kind === 'json') telemetry.exportJson();
        else if (kind === 'csv') telemetry.exportCsv();
        else if (kind === 'all') telemetry.exportAll();
        else if (kind === 'clear') telemetry.clear();
      },
      // names: one per human runner ('' = do not save). Returns each saved run's 1-based rank, or 0.
      onSave(names) {
        const saved = active.map((p, i) => !!names[i] && !p.dnf && saveScoreToRanking(names[i], p.runTime, p.hits));
        // rank only after every run is stored, so two saves in one go see each other
        const all = [...(window.__frozenRanking || []), ...readLocalRanking()].filter((r) => typeof r.time === 'number' && onBoard(r, rankingBoard())).sort((a, b) => a.time - b.time);
        return active.map((p, i) => (saved[i] ? all.findIndex((r) => r.time === p.runTime) + 1 || 1 : 0));
      },
    },
  });
  ui.setRules(RULES);
  // sensor taps for the analysis and the optional raw recording (they chain onto the existing callbacks)
  ui.setDevice(insole ? 'insole' : 'core', DEVICE === 'insole' && !insole);
  if (insole) {
    telemetry.setPitchMapper(insole.gamePitch);
    ui.setInsoleToe(insole.toeMode, insole.toeState());
    setInterval(() => ui.setInsoleToe(insole.toeMode, insole.toeState()), 500);
  }
  if (!insole) {
    // ORPHE CORE: hand the sensor script a pitch measured from the resting zero. Wrapped here, before
    // the recorder's tap, so the recording keeps the raw value and index.html stays as it is.
    for (const ble of sensors) {
      const inner = ble?.gotEuler;
      if (typeof inner !== 'function') continue;
      ble.gotEuler = function (e) {
        const zero = pitchZero[this.id] || 0;
        return inner.call(this, zero && e ? { ...e, pitch: e.pitch - zero } : e);
      };
    }
  }
  telemetry.attach(sensors);
  const refreshRec = async () => ui.setRecState({ recording: telemetry.recording, active: telemetry.active, count: await telemetry.count(), hasLast: !!telemetry.last });
  telemetry.onChange(refreshRec);
  refreshRec();
  if (logo) ui.setLogo(logo.toDataURL());
  (window.frozenRankingReady || Promise.resolve([])).then((list) => { window.__frozenRanking = Array.isArray(list) ? list : []; });

  world = createWorld({ scene, renderer, logoImage: logo });
  world.buildHurdles(hurdles.map((h) => h.userData.z), VS_LANES, RIVAL_LANES.filter((l) => !VS_LANES.includes(l)));
  fx = createFx({ renderer, scene });
  fx.onFireworkBurst = (x, y, z) => {
    const c = P[0].camera.position;
    audio.firework(Math.hypot(x - c.x, y - c.y, z - c.z) / 340, Math.max(-1, Math.min(1, (x - c.x) / 40)));
    world.kick(0.05, 0.08);
  };

  rivals = RIVAL_LANES.map((lane, i) => {
    const r = new Rival({ lane, x: laneX(lane), look: RIVAL_LOOKS[i], hurdleZ: hurdles.map((h) => h.userData.z), finishZ: -COURSE_LEN_M });
    r.onStep = (rv) => {
      if (stageView.phase !== 'race') return;
      // heard from the nearest human
      let best = null;
      for (const p of active) {
        const dx = rv.figure.root.position.x - p.rig.position.x, dz = rv.z - p.rig.position.z;
        const d = Math.hypot(dx, dz);
        if (!best || d < best.d) best = { d, dx };
      }
      if (best) audio.rivalStep(Math.max(-1, Math.min(1, best.dx / 2.5)), best.d);
    };
    scene.add(r.figure.root);
    return r;
  });
  P.forEach((p, i) => {
    const look = PLAYER_LOOKS[i];
    p.hud = ui.huds[i];
    p.fxView = fx.createView(p.camera);
    p.shadowBody = new Runner({ shadowOnly: true });
    p.figure = new Runner({ ...look, bib: `P${i + 1}` });
    p.figure.root.visible = false;
    scene.add(p.shadowBody.root, p.figure.root);
    p.fpBody = new FirstPersonBody({ skin: look.skin, accent: look.accent });
    p.camera.add(p.fpBody.group);
  });

  // Buttons
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('retry').addEventListener('click', () => { resetGame(); startGame(); });
  document.getElementById('btn-title').addEventListener('click', resetGame);
  document.getElementById('btn-ranking').addEventListener('click', () => { showRanking('start'); loadRankingData(); });
  document.getElementById('btn-ranking-finish').addEventListener('click', () => { showRanking('finish'); loadRankingData(); });
  document.getElementById('back-btn').addEventListener('click', hideRanking);

  // Browsers only allow audio after a gesture: the first click / key starts the title ambience.
  const unlock = () => {
    const first = !audio.ready;
    audio.init();
    if (first && stageView.phase === 'title') { audio.setCrowd(0.14, 0); audio.setMusic('title', 2.0); }
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('resize', layoutViews);

  let best = readBest();
  if (!Number.isFinite(best) && RULES.jump === 'classic' && RULES.stamina === 'classic') {
    const local = readLocalRanking().map((r) => r.time).filter(Number.isFinite);
    if (local.length) best = Math.min(...local);
  }
  ui.setBest(Number.isFinite(best) ? best : 0);

  onReset();
  P[0].cam.blend = 1;
  // compile every shader up front so the first seconds of the race never hitch
  updateCamera(P[0], 0);
  renderer.compile(scene, P[0].camera);
  loop();
  requestAnimationFrame(() => requestAnimationFrame(() => ui.loadingDone()));
}

// Small read-only window for automated checks and debugging from the console.
window.hurdleDebug = {
  get state() { return state; }, get phase() { return stageView.phase; }, get mode() { return mode; },
  get rules() { return { ...RULES }; },
  get z() { return P[0].rig.position.z; }, get speed() { return P[0].vz; }, get stamina() { return P[0].stamina; },
  get hits() { return P[0].hits; }, get time() { return P[0].runTime; }, get fps() { return perf.fps; },
  get pixelRatio() { return fx ? pixelRatio() : 0; }, get place() { return P[0].place; }, get grounded() { return P[0].isGround; },
  get exhausted() { return P[0].exhausted; },
  /** Per-runner snapshot, e.g. hurdleDebug.players[1].z */
  get players() {
    return active.map((p) => ({ z: p.rig.position.z, speed: p.vz, stamina: p.stamina, hits: p.hits, time: p.runTime, finished: p.finished, grounded: p.isGround, exhausted: p.exhausted, place: p.place, lane: p.lane, ignoredJumps: p.guarded, heldJumps: p.heldJumps, pitchZero: [...pitchZero] }));
  },
  audio, scene, renderer, telemetry, get camera() { return P[0].camera; },
  get analysis() { return active.map((p) => p.analysis); },
  get fx() { return fx; }, get world() { return world; },
  /** Paste `hurdleDebug.sensors()` in the console to see whether CORE data is reaching the game. */
  sensors() {
    const out = sensors.map((b, i) => ({
      type: insole ? 'insole' : 'core', id: i, connected: !!(b?.isConnected ? b.isConnected() : b?.bluetoothDevice?.gatt?.connected), name: b?.bluetoothDevice?.name ?? null,
      rawMonitorMode: !!b?.isGotDataOverridden?.(), tapped: !!b?.__hurdleTapped,
      acc: window.devices?.[i]?.acc, pitch: window.devices?.[i]?.eulers?.pitch,
    }));
    console.table(out);
    return out;
  },
};
// The build id is the ?v= on this module's URL (set once in index.html, see the import map there).
window.HURDLE_BUILD = new URL(import.meta.url).searchParams.get('v') || 'dev';
console.log(`[HURDLE] build ${window.HURDLE_BUILD} (sensor: ${DEVICE})`);

boot().catch((error) => {
  console.error('[HURDLE] failed to start:', error);
  const l = document.getElementById('loading');
  if (l) { l.classList.add('error'); l.querySelector('.loading-text').textContent = '読み込みに失敗しました。ページを再読み込みしてください / Failed to load'; }
});
