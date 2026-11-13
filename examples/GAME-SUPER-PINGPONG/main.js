// main.js — flow and glue: lobby -> range calibration -> countdown -> match -> result.
//
//   input.js    tilt angle and paddle position from the CORE's quaternion (or keys)
//   game.js     the rules (ball, paddles, points, items, CPU)
//   analysis.js match log -> six rehabilitation scores
//   world.js / fx.js   the scene and its effects      audio.js   sound
//   ui.js / report.js  DOM                            store.js   localStorage
//
// The ORPHE CORE connection itself lives in index.html (CoreToolkit, unchanged); this
// module only receives its samples through window.pingpongBridge.
import * as THREE from 'three';
import { createFx } from './fx.js';
import { createWorld, seasonForMonth, TEAM } from './world.js';
import { renderPortraits, isCharacter } from './characters.js';
import { PongSim, COURT, CPU_LEVELS, ITEM_TYPES, ballSpeedFor, ballRadiusFor, paddleHalfFor, rallyPaceFor, predictY } from './game.js';
import { TiltInput, Calibrator } from './input.js';
import { analyzeSession, EXERCISES } from './analysis.js';
import { AudioEngine } from './audio.js';
import { createUI } from './ui.js';
import { renderReport, buildCsv } from './report.js';
import { loadSettings, saveSettings, saveCalibration, loadHistory, addHistory, clearHistory, ASSIST_PULL, PLAYER_NAMES } from './store.js';

const query = new URLSearchParams(location.search);
const settings = loadSettings();
const inputs = [new TiltInput(0), new TiltInput(1)];
const calibrators = inputs.map((input) => new Calibrator(input));
const audio = new AudioEngine();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SIM_DT = 1 / 120;
const LOG_HZ = 50;
const T = COURT.tableH;
const MILESTONE_WORDS = { 5: 'いいぞ！', 10: 'お見事！', 15: '絶好調！', 20: 'あっぱれ！', 30: '名人級！', 40: '神業！', 50: '伝説！', 75: '伝説！', 100: '百打！' };

let phase = 'boot';          // boot | lobby | calib | countdown | play | finish | result
let sim = null;
let paused = false;
let timeScale = 1, slowUntil = 0, freezeUntil = 0, resumeRamp = 1;
let simAcc = 0;
let clock = 0;               // seconds of real time since boot
let countdown = null;        // { t, shown }
let calibState = null;       // { sides, startAt, autoGoAt, returnTo }
let finishState = null;      // { at, reportAt, shells }
let log = null;
let lastMatch = null;        // what the CSV button exports
let focusUntil = 0;
/** ?demo=1: a simple bot plays for the humans, so the whole flow and the report can be previewed without a CORE. */
const demo = query.has('demo');
const bots = [0, 1].map(() => ({ target: 0, pos: 0, reactAt: 0, miss: 0 }));

for (const side of [0, 1]) {
  const p = settings.players[side];
  inputs[side].setExercise(p.exercise);
  inputs[side].settings.gain = p.gain; inputs[side].settings.invert = p.invert; inputs[side].setSmooth(p.smooth);
}

// ------------------------------------------------------------------ renderer and scene
const canvas = document.getElementById('gl');
let renderer, world, fx, ui;
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
const perf = { fps: 60, slowFor: 0 };

const humans = () => (settings.mode === 'solo' ? [0] : [0, 1]);
const isHuman = (side) => humans().includes(side);
const names = () => (settings.mode === 'solo' ? [PLAYER_NAMES[0], CPU_LEVELS[settings.cpuLevel].name] : PLAYER_NAMES.slice());
const pan = (x) => clamp(x / 1.7, -1, 1);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  world.resize(w / h);
  fx.setSize(w, h, pixelRatio);
}

// ------------------------------------------------------------------ settings -> everything else
function simConfig() {
  const solo = settings.mode === 'solo';
  const [p0, p1] = settings.players;
  return {
    mode: settings.mode, pointsToWin: settings.points,
    ballSpeed: ballSpeedFor(settings.ballSpeed), ballRadius: ballRadiusFor(settings.ballSize),
    paddleHalf: [paddleHalfFor(p0.paddle), paddleHalfFor(solo ? 3 : p1.paddle)],
    ...rallyPaceFor(settings.rallyPace), items: settings.items,
    assist: [ASSIST_PULL[p0.assist], solo ? 0 : ASSIST_PULL[p1.assist]],
    cpu: [null, solo ? settings.cpuLevel : null],
  };
}

/** The opponents of the solo mode: the inn's clerk, its landlady and the resident master. */
const CPU_CHARACTERS = ['tanuki', 'neko', 'daruma'];

/** Put the chosen characters at the table (in solo mode the right-hand one is the CPU's). */
function applyCharacters() {
  if (!world) return;   // a setting changed while the scene is still loading; boot() applies them once it exists
  for (const side of [0, 1]) {
    const picked = settings.players[side].character;
    if (!isCharacter(picked)) settings.players[side].character = 'daruma';
  }
  world.setCharacter(0, settings.players[0].character);
  world.setCharacter(1, settings.mode === 'solo' ? CPU_CHARACTERS[settings.cpuLevel] : settings.players[1].character);
}

function applySettings() {
  applyCharacters();
  for (const side of [0, 1]) {
    const p = settings.players[side];
    inputs[side].settings.gain = p.gain; inputs[side].settings.invert = p.invert; inputs[side].setSmooth(p.smooth);
  }
  audio.setVolumes({ bgm: settings.bgmVolume, sfx: settings.sfxVolume });
  audio.setBgmMode(settings.bgm);
  audio.setMuted(settings.muted);
  ui.setMuted(settings.muted);
  // a match in progress follows the sliders live
  if (sim && sim.cfg.mode !== 'attract' && (phase === 'play' || phase === 'countdown')) {
    const cfg = simConfig();
    Object.assign(sim.cfg, { ballSpeed: cfg.ballSpeed, accelRate: cfg.accelRate, accelMax: cfg.accelMax, items: cfg.items, assist: cfg.assist });
    sim.ball.r = cfg.ballRadius;
    sim.paddles.forEach((p, side) => { if (p.cpu) return; const big = p.half > p.baseHalf; p.baseHalf = cfg.paddleHalf[side]; p.half = big ? Math.min(p.baseHalf * 1.5, COURT.halfW * 0.6) : p.baseHalf; });
    if (!settings.guide) { world.setGuide(0, null); world.setGuide(1, null); }
  }
}

// ------------------------------------------------------------------ ORPHE CORE bridge (see index.html)
const bridge = window.pingpongBridge;
bridge.onQuat = (id, quat) => {
  const now = performance.now();
  const input = inputs[id];
  input.feedQuat(quat, now);
  if (raw) raw.rows.push(`${((now - raw.t0) / 1000).toFixed(3)},${id},${quat.w.toFixed(5)},${quat.x.toFixed(5)},${quat.y.toFixed(5)},${quat.z.toFixed(5)},${input.rawDeg.toFixed(2)},${input.deg.toFixed(2)},${input.position().toFixed(3)},${input.range.up.toFixed(1)},${input.range.down.toFixed(1)},${input.axis.map((v) => v.toFixed(3)).join(' ')},${input.calibrated ? 'measured' : input.autoFitted ? 'auto' : 'default'},`);
};

// ------------------------------------------------------------------ raw recording (settings.record)
// One row per sensor sample with the game's own values next to it, plus the match events, saved
// automatically when the match ends or is abandoned: nobody has to remember to press a button.
let raw = null;
function startRaw() {
  raw = settings.record ? { t0: performance.now(), at: Date.now(), rows: [] } : null;
}
function rawEvent(label) { if (raw) raw.rows.push(`${((performance.now() - raw.t0) / 1000).toFixed(3)},,,,,,,,,,,,,${label}`); }
function saveRaw(outcome) {
  const rec = raw;
  raw = null;
  if (!rec || rec.rows.length < 50) return;
  const d = new Date(rec.at);
  const two = (v) => String(v).padStart(2, '0');
  const head = [
    '# SUPER PINGPONG raw log (ORPHE CORE)',
    `# date,${d.toISOString()},outcome,${outcome}`,
    `# mode,${settings.mode},points,${settings.points},ball_speed,${settings.ballSpeed},rally_pace,${settings.rallyPace},items,${settings.items},guide,${settings.guide}`,
    ...[0, 1].map((side) => { const p = settings.players[side], i = inputs[side]; return `# player,${side},exercise,${i.exercise},gain,${p.gain},smooth,${p.smooth},invert,${p.invert},paddle,${p.paddle},assist,${p.assist},sensor_hz,${i.hz.toFixed(0)},human,${isHuman(side)}`; }),
    `# user_agent,${navigator.userAgent.replace(/,/g, ';')}`,
    'time_s,player,quat_w,quat_x,quat_y,quat_z,tilt_raw_deg,tilt_deg,paddle,range_up_deg,range_down_deg,axis,control,event',
  ];
  const blob = new Blob(['\ufeff', head.concat(rec.rows).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `super-pingpong-raw-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  ui.toast('生データを保存しました');
}
bridge.onReady = (id) => {
  // No stored calibration is applied: the sensor is strapped on anew every time, and the axis and
  // range are learned from the movement during play (input.js AUTO). A measured calibration from
  // the settings ("可動域をはかり直す") holds for this page load only.
  ui.toast(`${PLAYER_NAMES[id]}の ORPHE CORE がつながりました`);
  audio.ui('done');
};
bridge.onDisconnect = (id) => {
  inputs[id].resetStream();
  ui.toast(`${PLAYER_NAMES[id]}の ORPHE CORE の接続が切れました`);
  if ((phase === 'play' || phase === 'countdown') && isHuman(id) && !paused) { setPaused(true); ui.openDrawer(`p${id}`); }
};

// ------------------------------------------------------------------ keyboard / pointer fallback
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  keys.add(e.code);
  // the arrow keys steer a paddle during a match; everywhere else they keep scrolling the page / sheet
  const steering = (phase === 'play' || phase === 'countdown') && !ui.drawerOpen;
  if (steering && ['ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && !(e.target instanceof HTMLButtonElement)) e.preventDefault();
  if (e.code === 'Escape') { if (ui.drawerOpen) actions.closeSettings(); else if (phase === 'play' || phase === 'countdown') actions.openSettings(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
const pointers = new Map();
function pointerSide(e) { return settings.mode === 'solo' ? 0 : e.clientX < window.innerWidth / 2 ? 0 : 1; }
canvas.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, { side: pointerSide(e), y: e.clientY }); canvas.setPointerCapture?.(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { const p = pointers.get(e.pointerId); if (p) p.y = e.clientY; });
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, (e) => pointers.delete(e.pointerId));

function updateInputs(dt, now) {
  for (const side of [0, 1]) {
    const input = inputs[side];
    if (input.isLive(now)) continue;
    if (demo && isHuman(side) && (phase === 'play' || phase === 'countdown')) { input.setVirtualPosition(botPosition(side, dt), dt, now); continue; }
    let dir = 0;
    const up = side === 0 ? 'KeyW' : 'ArrowUp', down = side === 0 ? 'KeyS' : 'ArrowDown';
    if (keys.has(up) || (settings.mode === 'solo' && side === 0 && keys.has('ArrowUp'))) dir += 1;
    if (keys.has(down) || (settings.mode === 'solo' && side === 0 && keys.has('ArrowDown'))) dir -= 1;
    let touched = false;
    for (const p of pointers.values()) {
      if (p.side !== side) continue;
      input.setVirtualPosition(clamp(1 - 2 * ((p.y / window.innerHeight - 0.28) / 0.5), -1, 1), dt, now);
      touched = true;
    }
    if (!touched) input.stepVirtual(dir, dt, now);
  }
}

/** Demo bot: follows the ball with a reaction delay, a speed limit and the odd misjudgement. */
function botPosition(side, dt) {
  const bot = bots[side], b = sim.ball;
  const dir = side === 0 ? -1 : 1;
  if (b.state === 'live' && Math.sign(b.vx) === dir) {
    if (clock >= bot.reactAt && bot.reactAt > 0) {
      const y = predictY(b.x, b.y, b.vx, b.vy, dir * COURT.paddleX, sim.wall);
      bot.target = clamp(y / sim.travel(side) + bot.miss, -1, 1);
      bot.reactAt = -1;
    }
  } else if (b.state !== 'live') bot.target *= 0.985;
  const step = 1.5 * dt;
  bot.pos += clamp(bot.target - bot.pos, -step, step);
  return bot.pos + Math.sin(clock * 9 + side) * 0.004;
}

// ------------------------------------------------------------------ phases
function startAttract() {
  // the exhibition rally behind the lobby keeps the gentle pace, whatever the match setting is
  sim = new PongSim({ mode: 'attract', cpu: [1, 1], items: false, ...rallyPaceFor(1), ballSpeed: ballSpeedFor(6), ballRadius: ballRadiusFor(3), paddleHalf: [paddleHalfFor(3), paddleHalfFor(3)] });
  sim.startMatch();
}

function enterLobby() {
  saveRaw('abandoned');   // a match left half-way is still worth looking at
  phase = 'lobby';
  paused = false; timeScale = 1; finishState = null; calibState = null; countdown = null;
  ui.closeDrawer(); ui.showSheet(false); ui.winBanner(null); ui.banner(null); ui.countdown(null); ui.hint(null);
  ui.setMatchLock(false);
  ui.show('lobby');
  world.setView('title'); world.clearItems(); world.resetCharacters(); world.setBoard('0', '0', false);
  world.setGuide(0, null); world.setGuide(1, null); world.focusOn(null);
  audio.setScene('title'); audio.intensity = 0;
  fx.reset();
  startAttract();
}

function enterCalibration(sides = humans(), returnTo = 'match') {
  const now = performance.now();
  // nothing to measure when nobody has a CORE streaming
  if (!sides.some((side) => inputs[side].isLive(now))) { finishCalibration(returnTo); return; }
  phase = 'calib';
  calibState = { sides, startAt: clock + 1.6, autoGoAt: null, returnTo, started: false };
  for (const side of sides) calibrators[side].phase = 'idle';
  ui.calibSetup(sides.map((side) => ({ side, exercise: inputs[side].exercise })));
  ui.calibReady(false);
  ui.show('calib');
  world.setView('calib');
  audio.setScene('calib');
}

function updateCalibration(dt) {
  const now = performance.now();
  const cs = calibState;
  if (!cs.started && clock >= cs.startAt) { cs.started = true; for (const side of cs.sides) calibrators[side].start(now); audio.ui('tick'); }
  let allDone = cs.started;
  for (const side of cs.sides) {
    const cal = calibrators[side];
    const before = cal.phase;
    if (cs.started) cal.update(dt, now);
    if (cal.phase !== before) {
      if (cal.phase === 'done') { audio.ui('done'); saveCalibration(side, inputs[side].exportCalibration()); }
      else if (cal.phase === 'failed') audio.ui('tick');
      else audio.count();
    }
    if (cal.phase !== 'done') allDone = false;
    ui.calibUpdate(side, {
      phase: cal.phase, progress: cal.progress, liveDeg: cal.liveDeg, result: cal.result, reason: cal.reason, exercise: inputs[side].exercise,
      tiltDeg: cal.phase === 'down' || cal.phase === 'done' ? (cal.phase === 'done' ? inputs[side].deg : cal.liveDeg) : cal.liveDeg,
    });
  }
  if (allDone) {
    // hands-free: the match starts by itself a few seconds after everyone is measured
    if (cs.autoGoAt === null) cs.autoGoAt = clock + 4;
    const left = Math.ceil(cs.autoGoAt - clock);
    ui.calibReady(true, cs.returnTo === 'match' ? `試合開始（${Math.max(0, left)}）` : `もどる（${Math.max(0, left)}）`);
    if (clock >= cs.autoGoAt) finishCalibration(cs.returnTo);
  } else { cs.autoGoAt = null; ui.calibReady(false); }
}

function finishCalibration(returnTo) {
  calibState = null;
  if (returnTo === 'play') {
    phase = 'play';
    ui.show('hud'); world.setView('play'); audio.setScene('play');
    setPaused(false);
  } else if (returnTo === 'lobby') enterLobby();
  else beginMatch();
}

function newLog() {
  return {
    fs: LOG_HZ, acc: 0, t: [], angle: [[], []], pos: [[], []], ballX: [], ballY: [], events: [],
    hits: [[], []], misses: [[], []], incomings: [[], []],
    reps: [0, 1].map(() => ({ dir: 0, hi: 0, lo: 0, ups: 0, started: false })),
    coreSamples: [0, 0],   // how many samples of each player came from a CORE (the rest: keys / pointer / demo bot)
  };
}
/** Seconds of play logged so far. The log runs on real time: the players move in real time even while the ball is in slow motion. */
const logTime = () => log.t.length / LOG_HZ;
/** What drove a player over the whole match: only an (almost) pure CORE log is compared with CORE history. */
function logSource(side) {
  const share = log.t.length ? log.coreSamples[side] / log.t.length : 0;
  return share >= 0.9 ? 'core' : share <= 0.1 ? 'keys' : 'mixed';
}

function beginMatch() {
  phase = 'countdown';
  paused = false; timeScale = 1; resumeRamp = 1; finishState = null;
  sim = new PongSim(simConfig());
  saveRaw('restarted');
  startRaw();
  log = newLog();
  bots.forEach((b) => { b.target = 0; b.pos = 0; b.reactAt = 0; });
  const exercises = [0, 1].map((side) => (isHuman(side) ? inputs[side].exercise : null));
  ui.hudSetup({ mode: settings.mode, names: names(), points: settings.points, goal: sim.coopGoal, lives: sim.lives, exercises });
  ui.showSheet(false); ui.winBanner(null);
  ui.setMatchLock(true);
  ui.show('hud');
  world.setView('play'); world.clearItems(); world.resetCharacters(); world.hideBall(); world.focusOn(null);
  world.setBoard('0', '0', false);
  audio.setScene('play'); audio.intensity = 0;
  fx.reset();
  countdown = { t: 3.99, shown: null };
  const now = performance.now();
  const anyCore = humans().some((side) => inputs[side].isLive(now));
  const ex = EXERCISES[inputs[0].exercise];
  ui.hint(demo ? 'デモ: コンピューターが かわりに動かしています' : anyCore ? `はじめに 大きく上げ下げしてみましょう。${ex.upHint.replace('を', 'を ')}と ラケットが奥へ動きます` : settings.mode === 'solo' ? 'W / S キーで ラケットを動かします' : 'あか: W / S キー　　あお: ↑ / ↓ キー', 7000);
}

function updateCountdown(dt) {
  countdown.t -= dt;
  const n = Math.ceil(countdown.t - 1);
  if (n >= 1 && n !== countdown.shown) { countdown.shown = n; ui.countdown(String(n)); audio.count(); }
  else if (n < 1 && countdown.shown !== 0) { countdown.shown = 0; ui.countdown('はじめ！', true); audio.go(); sim.startMatch(); phase = 'play'; }
  if (countdown.t <= 0) { ui.countdown(null); countdown = null; }
}

function setPaused(value) {
  paused = value;
  if (!paused) { resumeRamp = 0.15; ui.banner('再開', 700); }
}

// ------------------------------------------------------------------ match events
function popupAt(text, x, y, z, kind) {
  const p = world.project(x, y, z);
  ui.popup(text, p.x, p.y, kind);
}

/** Co-op: the two cards of the scene's scoreboard read as one counter (tens | ones). */
function setCoopBoard() { world.setBoard(String(Math.floor(sim.totalHits / 10)), String(sim.totalHits % 10)); }

function refreshEffects() {
  for (const side of [0, 1]) {
    const p = sim.paddles[side];
    const list = [];
    if (p.bigUntil > 0) list.push(`🍊 ${ITEM_TYPES.mikan.effect}`);
    if (p.guard) list.push('🎍 竹がき');
    ui.effects(side, list);
  }
  ui.slow(sim.slowUntil > 0);
}

function handleEvent(ev) {
  const attract = sim.cfg.mode === 'attract';
  if (!attract && raw && ['serve', 'hit', 'miss', 'point', 'item-get', 'guard'].includes(ev.type)) rawEvent(`${ev.type}:${ev.side ?? ev.server ?? ev.scorer ?? ''}${ev.smash ? ':smash' : ''}${ev.type === 'hit' ? `:${ev.rawOffset.toFixed(2)}` : ''}`);
  switch (ev.type) {
    case 'serve-ready':
      world.setGuide(0, null); world.setGuide(1, null);
      break;
    case 'serve':
      if (!attract) audio.serve();
      break;
    case 'incoming':
      if (attract) break;
      if (settings.guide && !sim.isCpu(ev.side)) world.setGuide(ev.side, ev.targetY);
      if (isHuman(ev.side)) log.incomings[ev.side].push({ t: logTime(), target: ev.target });
      if (demo) { const bot = bots[ev.side]; bot.reactAt = clock + 0.3 + Math.random() * 0.35; bot.miss = Math.random() < 0.16 ? (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.4) : (Math.random() - 0.5) * 0.14; }
      break;
    case 'hit': {
      const pos = world.racketPosition(ev.side);
      const power = clamp((ev.speed / sim.cfg.ballSpeed - 0.8) / 1.2, 0, 1);
      world.hit(ev.side, power, ev.smash);
      world.setGuide(ev.side, null);
      fx.hitBurst(pos.x, pos.y, pos.z, ev.smash ? [1, 0.55, 0.2] : TEAM[ev.side].rgb, ev.side === 0 ? 1 : -1, ev.smash ? 1 : power);
      if (attract) break;
      audio.hit(ev.side, power, ev.smash, pan(pos.x));
      if (isHuman(ev.side)) {
        // an assisted return the player's own command would have missed counts as a miss in the analysis
        if (Math.abs(ev.rawOffset) <= 1) log.hits[ev.side].push({ t: logTime(), offset: ev.rawOffset }); else log.misses[ev.side].push({ t: logTime() });
      }
      log.events.push({ t: logTime(), label: `hit:${ev.side}${ev.smash ? ':smash' : ''}` });
      ui.rally(ev.rally);
      if (settings.mode === 'coop') { ui.coop(sim.totalHits, sim.coopGoal, sim.lives); setCoopBoard(); }
      if (ev.smash) {
        popupAt('スマッシュ！', pos.x * 0.8, pos.y + 0.25, pos.z, 'smash');
        world.shake(0.05); fx.punch(0.8); fx.flash(0.1);
        freezeUntil = clock + 0.07;
      }
      break;
    }
    case 'wall':
      world.railHit(ev.far);
      fx.puff(ev.x, T + 0.05, -ev.y, 0.6);
      if (!attract) audio.rail(pan(ev.x));
      break;
    case 'bounce':
      fx.puff(ev.x, T + 0.012, -ev.y, 0.5);
      if (!attract) audio.bounce(pan(ev.x), ev.speed);
      break;
    case 'floor':
      if (!attract) audio.floor(pan(ev.x), ev.speed);
      break;
    case 'guard': {
      const pos = world.racketPosition(ev.side);
      fx.sphereBurst(pos.x * 1.1, T + 0.2, -ev.y, [0.75, 0.95, 0.4], { n: 36, speed: 1.6, life: 0.6 });
      audio.guard(pan(pos.x));
      popupAt('竹がき セーフ！', pos.x * 0.8, T + 0.4, -ev.y, 'item');
      refreshEffects();
      break;
    }
    case 'miss':
      world.setGuide(ev.side, null);
      if (!attract && isHuman(ev.side)) log.misses[ev.side].push({ t: logTime() });
      if (!attract) log.events.push({ t: logTime(), label: `miss:${ev.side}` });
      break;
    case 'point':
      onPoint(ev, attract);
      break;
    case 'milestone': {
      if (attract) break;
      audio.milestone(ev.rally);
      ui.popup(MILESTONE_WORDS[ev.rally] || 'すごい！', 0.5, 0.42, 'kanji');
      world.cheer(1);
      fx.flash(0.08);
      // paper confetti from both ends; from 20 on, fireworks go up outside (heard from the table)
      for (const side of [0, 1]) { const p = world.characterPosition(side); fx.confetti(p.x * 0.8, T + 0.5, p.z, 16 + Math.min(40, ev.rally), { vx: -Math.sign(p.x) * 1.2, vy: 2.4 }); }
      if (ev.rally >= 20) audio.firework(0);
      break;
    }
    case 'goal':
      ui.banner('目標達成！', 2200);
      audio.milestone(30); audio.cheer(0.7);
      for (const side of [0, 1]) { const p = world.characterPosition(side); fx.confetti(p.x * 0.8, T + 0.5, p.z, 60, { vx: -Math.sign(p.x) * 1.2, vy: 2.8 }); }
      audio.firework(0);
      break;
    case 'item-spawn':
      world.addItem(ev.item);
      audio.item('spawn', pan(ev.item.x));
      break;
    case 'item-get': {
      world.removeItem(ev.item.id);
      audio.item('get', pan(ev.item.x));
      const info = ITEM_TYPES[ev.item.type];
      popupAt(`${info.label}！ ${info.effect}`, ev.item.x, T + 0.3, -ev.item.y, 'item');
      fx.sphereBurst(ev.item.x, T + 0.15, -ev.item.y, [1, 0.8, 0.35], { n: 30, speed: 1.4, life: 0.6, up: 0.6 });
      refreshEffects();
      break;
    }
    case 'item-gone':
      world.removeItem(ev.item.id);
      break;
    case 'item-end':
      audio.item('end');
      refreshEffects();
      break;
    case 'over':
      if (!attract) finishMatch(ev);
      break;
    default:
  }
}

function onPoint(ev, attract) {
  const coop = settings.mode === 'coop';
  world.point(coop || attract ? null : ev.scorer, ev.loser);
  world.focusOn(null);
  if (attract) return;
  refreshEffects();
  ui.rally(0);
  audio.intensity = 0;
  const loserPos = world.characterPosition(ev.loser);
  if (coop) {
    ui.coop(sim.totalHits, sim.coopGoal, sim.lives);
    audio.point(0, false);
    popupAt(ev.final ? 'おつかれさま！' : 'ドンマイ！', loserPos.x * 0.75, loserPos.y + 0.7, loserPos.z, 'soft');
    if (!ev.final && sim.lives === 1) setTimeout(() => { if (phase === 'play') ui.banner('あと 1回！', 1400); }, 700);
  } else {
    ui.score(ev.score[0], ev.score[1]);
    world.setBoard(String(ev.score[0]), String(ev.score[1]));
    const scorerPos = world.characterPosition(ev.scorer);
    audio.point(pan(scorerPos.x), ev.final);
    popupAt(ev.rally >= 8 ? 'ナイスラリー！' : '一点！', scorerPos.x * 0.72, scorerPos.y + 0.75, scorerPos.z, '');
    popupAt('七転び八起き', loserPos.x * 0.75, loserPos.y + 0.7, loserPos.z, 'soft');
    fx.confetti(scorerPos.x, scorerPos.y + 0.6, scorerPos.z, 46, { vx: -Math.sign(scorerPos.x) * 0.6 });
    world.focusOn(scorerPos.x * 0.5, 0.12); focusUntil = clock + 1.3;
    if (ev.matchPoint.length) setTimeout(() => { if (phase === 'play') { ui.banner('マッチポイント', 1500); audio.matchPoint(); } }, 800);
  }
  if (ev.final) { timeScale = 0.3; slowUntil = clock + 1.2; fx.flash(0.2); }
}

function finishMatch(ev) {
  phase = 'finish';
  const coop = settings.mode === 'coop';
  const winner = ev.winner;
  world.setGuide(0, null); world.setGuide(1, null); world.clearItems(); world.focusOn(null);
  for (const p of sim.paddles) p.guard = false;
  ui.hint(null); ui.banner(null); ui.rally(0);
  ui.show('result');   // the HUD steps aside for the winner's close-up
  audio.win(); audio.setScene('result'); audio.intensity = 0;
  if (coop) {
    world.setView('winboth');
    if (winner === 'both') world.celebrate('both');
    ui.winBanner(`ふたりのラリー ${ev.totalHits}回`, winner === 'both' ? '大成功！' : 'おつかれさま！');
  } else {
    world.setView(winner === 0 ? 'win0' : 'win1');
    world.celebrate(winner);
    ui.winBanner('勝負あり', `${names()[winner]}の勝ち！`);
    const p = world.characterPosition(winner);
    fx.confetti(p.x, p.y + 0.9, p.z, 220, { vy: 3.2, spread: 1.6 });
  }
  // the brush stroke belongs to the daruma, whose second eye is painted in
  const painted = [0, 1].some((side) => (winner === side || winner === 'both') && world.characterKind(side) === 'daruma');
  setTimeout(() => { if (phase === 'finish' && painted) audio.eyePaint(); }, 700);
  finishState = { at: clock, reportAt: clock + 5.2, nextShell: clock + 0.5, shells: winner === null ? 0 : 14, lean: winner === 0 ? 1 : winner === 1 ? -1 : 0, ev };
}

function updateFinish() {
  const fs = finishState;
  // shells go up beyond the bamboo grove, on the side of the garden the winner's camera looks at
  if (fs.shells > 0 && clock >= fs.nextShell) { fs.shells--; fs.nextShell = clock + 0.3 + Math.random() * 0.35; fx.firework(fs.lean * 1.5 + (Math.random() - 0.5) * 8, -15 - Math.random() * 4); }
  if (phase === 'finish' && clock >= fs.reportAt) showReport(fs.ev);
}

function showReport(ev) {
  saveRaw(`finished ${ev.score.join('-')}`);
  phase = 'result';
  ui.setMatchLock(false);
  const at = Date.now();
  const durationSec = logTime();
  const match = { mode: settings.mode, score: ev.score, winner: ev.winner, bestRally: ev.bestRally, totalHits: ev.totalHits, goal: sim.coopGoal, durationSec, at, names: names() };
  try {
    const players = humans().map((side) => playerReport(side, at, durationSec));
    lastMatch = { match, players, frames: log };
    renderReport(match, players);
  } catch (error) {
    // show the score even if the analysis failed
    console.error('[PINGPONG] report failed', error);
    lastMatch = null;
    try { renderReport(match, []); } catch (inner) { console.error(inner); }
    ui.toast('動きの分析を作れませんでした');
  }
  ui.winBanner(null);
  ui.show('result');
  ui.showSheet(true);
  audio.ui('done');
}

/** Analyse one human player's log, compare it with their history and store it. */
function playerReport(side, at, durationSec) {
  const input = inputs[side];
  const source = logSource(side);
  const calib = (input.calibrated || input.autoFitted) && source === 'core' ? { up: input.range.up, down: input.range.down } : null;
  const result = analyzeSession({ fs: LOG_HZ, exercise: input.exercise, calib, angle: log.angle[side], pos: log.pos[side], hits: log.hits[side], misses: log.misses[side], incomings: log.incomings[side] });
  const history = loadHistory(side, input.exercise).filter((e) => e.source === source);
  const previous = history.length ? history[history.length - 1] : null;
  addHistory({ at, side, exercise: input.exercise, source, mode: settings.mode, total: result.total, scores: result.scores, reps: result.activity.reps, usedTotal: result.rom.usedTotal, durationSec });
  return { side, name: PLAYER_NAMES[side], source, result, previous, history, calib: calib || input.range, log: { fs: LOG_HZ, angle: log.angle[side], hits: log.hits[side], misses: log.misses[side] } };
}

function downloadCsv() {
  if (!lastMatch) return;
  const d = new Date(lastMatch.match.at);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const blob = new Blob(['﻿', buildCsv(lastMatch.match, lastMatch.players, lastMatch.frames)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `super-pingpong-${stamp}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  ui.toast('記録を CSV で保存しました');
}

// ------------------------------------------------------------------ what the UI asks for
const actions = {
  tap: () => audio.ui('tap'),
  select: () => audio.ui('select'),
  changed: () => { applySettings(); saveSettings(settings); },
  exerciseChanged(side) {
    if (inputs[side].exercise === settings.players[side].exercise) return;   // the selected button was pressed again
    // a different exercise means a different mounting: the stored axis and range no longer apply
    inputs[side].clearCalibration();
    inputs[side].setExercise(settings.players[side].exercise);
    saveCalibration(side, null);
  },
  // straight into the match: there is no time for a calibration round in a recreation session
  start() { audio.unlock().then(() => audio.ui('start')); beginMatch(); },
  openSettings(tab) {
    ui.openDrawer(tab);
    if (phase === 'play' || phase === 'countdown') paused = true;
    audio.ui('tap');
  },
  closeSettings() {
    ui.closeDrawer();
    if (paused && (phase === 'play' || phase === 'countdown')) setPaused(false);
    audio.ui('tap');
  },
  quit() { audio.ui('tap'); enterLobby(); },
  toggleSound() { settings.muted = !settings.muted; audio.unlock(); applySettings(); saveSettings(settings); },
  zero(side) { inputs[side].setZero(); ui.toast(`${PLAYER_NAMES[side]}: いまの姿勢を まん中にしました`); audio.ui('done'); },
  recalibrate(side) {
    if (phase === 'finish') return;   // the result is seconds away
    if (!inputs[side].isLive(performance.now())) { ui.toast('ORPHE CORE をつないでから はかってください'); return; }
    ui.closeDrawer();
    if (phase === 'calib' && calibState) {
      // already measuring: add this player and start over, keeping where that run returns to (and the pause)
      if (!calibState.sides.includes(side)) calibState.sides.push(side);
      calibState.sides.sort();
      calibState.started = false; calibState.startAt = clock + 1.2; calibState.autoGoAt = null;
      for (const s of calibState.sides) calibrators[s].phase = 'idle';
      ui.calibSetup(calibState.sides.map((s) => ({ side: s, exercise: inputs[s].exercise })));
      ui.calibReady(false);
      return;
    }
    if (phase === 'result') { ui.showSheet(false); ui.winBanner(null); finishState = null; enterCalibration([side], 'lobby'); return; }
    const back = phase === 'play' || phase === 'countdown' ? 'play' : 'lobby';
    if (phase === 'countdown') { countdown = null; ui.countdown(null); sim.startMatch(); }
    paused = back === 'play';
    enterCalibration([side], back);
  },
  clearCalibration(side) { inputs[side].clearCalibration(); inputs[side].setZero(); saveCalibration(side, null); ui.toast(`${PLAYER_NAMES[side]}: 調整を消しました（標準の範囲に戻ります）`); },
  calibBack() { audio.ui('tap'); const back = calibState ? calibState.returnTo : 'match'; if (back === 'play') finishCalibration('play'); else enterLobby(); },
  calibRetry() { audio.ui('tap'); if (calibState) { calibState.started = false; calibState.startAt = clock + 1.0; calibState.autoGoAt = null; for (const side of calibState.sides) calibrators[side].phase = 'idle'; } },
  calibSkip() { audio.ui('tap'); if (calibState) finishCalibration(calibState.returnTo); },
  calibGo() { audio.ui('start'); if (calibState) finishCalibration(calibState.returnTo); },
  again() { audio.ui('start'); beginMatch(); },
  csv: downloadCsv,
  clearHistory() { clearHistory(); ui.toast('これまでの記録を消しました'); },
};

// ------------------------------------------------------------------ frame loop
function logSample() {
  const now = performance.now();
  log.t.push(log.t.length / LOG_HZ);
  for (const side of [0, 1]) {
    const human = isHuman(side);
    const input = inputs[side];
    const deg = human ? input.deg : 0;
    log.angle[side].push(deg);
    log.pos[side].push(human ? input.position() : 0);
    if (!human) continue;
    if (input.source(now) === 'core') log.coreSamples[side]++;
    // live repetition counter: the same zig-zag rule as analysis.countReps()
    const z = log.reps[side];
    const gate = clamp(0.2 * (input.range.up + input.range.down), 3, 10);
    if (!z.started) { z.hi = deg; z.lo = deg; z.started = true; }
    if (z.dir <= 0) { if (deg < z.lo) z.lo = deg; if (deg - z.lo >= gate) { z.dir = 1; z.hi = deg; z.ups++; } }
    if (z.dir >= 0) { if (deg > z.hi) z.hi = deg; if (z.hi - deg >= gate) { z.dir = -1; z.lo = deg; } }
  }
  log.ballX.push(sim.ball.state === 'hidden' ? 0 : sim.ball.x);
  log.ballY.push(sim.ball.state === 'hidden' ? 0 : sim.ball.y);
}

let lastFrame = performance.now();
let uiAcc = 0;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, Math.max(0, (nowMs - lastFrame) / 1000));
  lastFrame = nowMs;
  clock += realDt;
  perf.fps += (1 / Math.max(realDt, 1e-3) - perf.fps) * 0.05;

  updateInputs(realDt, nowMs);
  if (slowUntil && clock >= slowUntil) { timeScale = 1; slowUntil = 0; }
  if (focusUntil && clock >= focusUntil) { world.focusOn(null); focusUntil = 0; }
  resumeRamp = Math.min(1, resumeRamp + realDt * 0.8);
  const frozen = clock < freezeUntil;
  const animDt = paused ? 0 : realDt * timeScale * resumeRamp;
  const simDt = frozen ? 0 : animDt;

  if (phase === 'calib') updateCalibration(realDt);
  if (countdown && !paused && (phase === 'countdown' || phase === 'play')) updateCountdown(realDt);
  if (finishState) updateFinish();

  if (sim) {
    if (sim.cfg.mode !== 'attract') for (const side of humans()) sim.setInput(side, inputs[side].position());
    simAcc += simDt;
    let steps = 0;
    while (simAcc >= SIM_DT && steps < 12) {
      sim.step(SIM_DT); simAcc -= SIM_DT; steps++;
    }
    if (steps === 12) simAcc = 0;
    if (log && phase === 'play' && !paused) { log.acc += realDt; while (log.acc >= 1 / LOG_HZ) { log.acc -= 1 / LOG_HZ; logSample(); } }
    for (const ev of sim.drain()) handleEvent(ev);
    if (phase === 'play') {
      const matchPoint = settings.mode !== 'coop' && Math.max(sim.score[0], sim.score[1]) === settings.points - 1;
      const want = clamp(sim.rally / 14, 0, 1) * 0.85 + (matchPoint ? 0.15 : 0);
      audio.intensity += (want - audio.intensity) * Math.min(1, realDt * 2);
    }
    world.sync(sim, animDt, clock);
  }

  uiAcc += realDt;
  if (uiAcc >= 0.066) {
    uiAcc = 0;
    for (const side of [0, 1]) {
      const input = inputs[side];
      const live = input.isLive(nowMs);
      ui.setCoreState(side, { live, hz: input.hz, cpu: settings.mode === 'solo' && side === 1 });
      if (input.staleCalibration) {
        input.staleCalibration = false;
        saveCalibration(side, null);
        ui.toast(`${PLAYER_NAMES[side]}: 着け方が変わったようです。はかり直してください`);
      }
      if (phase === 'play' || phase === 'countdown') {
        if (isHuman(side)) { ui.tilt(side, input.position(), input.deg); if (log) ui.reps(side, log.reps[side].ups); }
      }
      if (ui.drawerOpen) ui.setLive(side, { deg: input.deg, pos: input.position(), up: input.range.up, down: input.range.down, source: input.source(nowMs) });
    }
  }

  const view = phase === 'play' || phase === 'countdown' ? 1 : 0.55;
  fx.uniforms.uTilt.value += (view - fx.uniforms.uTilt.value) * Math.min(1, realDt * 3);
  fx.uniforms.uFocus.value = world.tableScreenY();
  fx.uniforms.uDim.value += ((phase === 'result' || phase === 'calib' ? 0.55 : 0) - fx.uniforms.uDim.value) * Math.min(1, realDt * 3);
  fx.update(animDt || (paused ? 0 : realDt), realDt);
  fx.render();

  // auto quality: step the resolution down when the frame rate stays low
  if (perf.fps < 42 && pixelRatio > 1) { perf.slowFor += realDt; if (perf.slowFor > 2.5) { pixelRatio = Math.max(1, pixelRatio - 0.25); perf.slowFor = 0; resize(); } } else perf.slowFor = 0;
}

// ------------------------------------------------------------------ boot
async function boot() {
  ui = createUI({ settings, actions, cpuCharacters: CPU_CHARACTERS });
  ui.sync();
  // the scene paints kanji and digits into textures, so the fonts have to be there first
  await Promise.race([
    Promise.all([document.fonts.load('900 64px "Yuji Syuku"', '福寿湯祭'), document.fonts.load('64px "Bebas Neue"', '0123456789')]).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (error) {
    document.querySelector('#loading p').textContent = 'このブラウザでは 3D 表示（WebGL）が使えません。Chrome でお試しください。';
    throw error;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const season = query.get('season') || (settings.season === 'auto' ? seasonForMonth(new Date().getMonth() + 1) : settings.season);
  world = createWorld({ season, makeFx: (scene, camera) => createFx({ renderer, scene, camera }) });
  fx = world.fx;
  audio.season = world.season.key;
  world.callbacks.onShishi = () => audio.shishi();
  fx.onFireworkBurst = (x) => audio.firework(pan(x * 0.3));
  window.addEventListener('resize', resize);
  resize();
  // portraits for the character picker, rendered once from the same models
  try { ui.setPortraits(renderPortraits(renderer)); } catch (error) { console.warn('[PINGPONG] character portraits unavailable', error); }
  // browsers only allow sound after a gesture
  const unlock = () => { audio.unlock().then(() => { audio.setSeason(world.season.key); applySettings(); }); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  applySettings();
  enterLobby();
  requestAnimationFrame(frame);
  setTimeout(() => ui.setLoading(true), 350);
  if (query.has('help')) ui.help(true);
}

window.pingpongDebug = {
  get phase() { return phase; }, get sim() { return sim; }, get fps() { return perf.fps; }, get pixelRatio() { return pixelRatio; },
  get paused() { return paused; }, get calib() { return calibState; },
  get log() { return log; }, inputs, settings, audio, actions,
  get world() { return world; }, get fx() { return fx; }, get renderer() { return renderer; },
};

boot();
