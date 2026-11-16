// SUPER VIRTUAL RELAY — a 4 x 100 m relay with one ORPHE CORE as the baton.
//
//   on the track: shake it (the harder, the faster)
//   in the takeover zone: time slows down; hold it still while it changes hands, then shake again
//
// The rules are in relay.js, the start procedure in ../GAME-SUPER-START/start.js, the reading of
// the sensor in motion.js and the stadium in stage.js. This file is the flow between them, the
// exchange scene, the HUD, the sound of speed and the result screen.
import { createStage, bindChrome, attachCore, MAX_SPEED, THREE, BLOCK_Z, Runner, newPose, poseRun } from '../GAME-SUPER-START/stage.js';
import { MotionTracker, SampleClock } from '../GAME-SUPER-START/motion.js';
import { StartProcedure, formatReaction } from '../GAME-SUPER-START/start.js';
import { createScope, createRawScope } from '../GAME-SUPER-START/scope.js';
import { createRecorder } from '../GAME-SUPER-START/recorder.js';
import { RelayRace, RELAY_DEFAULTS, CALM_DEFAULTS, SWING_DEFAULTS, makeRivalTeam, roughness, swingSpeed, formatTime, gradePass } from './relay.js';

const $ = (id) => document.getElementById(id);
const TRACK_HALF = (9 * 1.22) / 2;
const LANE_W = 1.22;
const FINISH_Z = -110;            // where the stadium's finish gate stands
// The other teams are club runners, not a world final: an ordinary person swinging hard (about
// 250 deg/s, 8.7 m/s) with decent exchanges comes in around 49 s, level with the best of them.
const RIVAL_TIMES = [50.5, 52.0, 53.5, 55.0, 57.0, 59.0, 62.0];
const NEAR_M = 30;                // "zone ahead" cue from this far out
const FALL_MS = 150;              // free fall this long = the baton was dropped (about 11 cm of fall; to be checked against hard shaking on a real sensor)
const SLOW = 0.3;                 // the exchange is played at this speed
const SPEED_STEPS = [3, 5, 7, 8.5, 9.8, 10.8];   // m/s: passing one of these is heard
const BEST_KEY = 'superrelay.best';
const RANKING_KEY = 'superrelay.rankings';
const TUNE_KEY = 'superrelay.tuning.v3';
const NAME_KEY = 'superrelay.team';
const RUNNERS_KEY = 'superrelay.runners';
const RANKING_LIMIT = 100;
const LEG_NAMES = ['1走', '2走', '3走', '4走'];
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// Sensor
const tracker = new MotionTracker();
const sampleClock = new SampleClock();
// topSwing: the swing (mean angular speed, deg/s) that is worth the top speed of 12.4 m/s
const tuning = { topSwing: SWING_DEFAULTS.topSwing, calm: 1, passSec: RELAY_DEFAULTS.passSec, rule: 'penalty' };
try { Object.assign(tuning, JSON.parse(localStorage.getItem(TUNE_KEY) || '{}')); } catch { /* storage unavailable */ }
const saveTuning = () => { try { localStorage.setItem(TUNE_KEY, JSON.stringify(tuning)); } catch { /* ignore */ } };
const calmTune = () => ({ calmAcc: CALM_DEFAULTS.calmAcc * tuning.calm, calmGyro: CALM_DEFAULTS.calmGyro * tuning.calm });
// what the samples since the last frame said (a frame sees several samples at 200 Hz)
const agg = { n: 0, rough: 0, fall: false, strokes: 0 };
const sensor = { samples: 0, rateAt: 0, rate: 0 };
const AXES = [{ color: '#ff5d6c', label: 'X' }, { color: '#7dff6a', label: 'Y' }, { color: '#5aa9ff', label: 'Z' }];
let dockScope = null, gyroScope = null, accScope = null;
let lastStrokes = 0;
function onSample(f, acc, gyro) {
  sensor.samples++;
  recorder.sample(f.t, acc, gyro);
  const c = calmTune();
  agg.n++;
  agg.rough = Math.max(agg.rough, roughness(f, c));
  if (f.fallMs >= FALL_MS) agg.fall = true;
  if (tracker.strokes !== lastStrokes) { agg.strokes += tracker.strokes - lastStrokes; lastStrokes = tracker.strokes; }
  if (!dockScope) return;
  dockScope.push(f.t, [Math.max(Math.abs(f.lin[0]), Math.abs(f.lin[1]), Math.abs(f.lin[2])) / c.calmAcc, Math.max(Math.abs(f.gyro[0]), Math.abs(f.gyro[1]), Math.abs(f.gyro[2])) / c.calmGyro]);
  gyroScope.push(f.t, [f.gyro[0] / c.calmGyro, f.gyro[1] / c.calmGyro, f.gyro[2] / c.calmGyro]);
  accScope.push(f.t, [f.lin[0] / c.calmAcc, f.lin[1] / c.calmAcc, f.lin[2] / c.calmAcc]);
}

// How fast is a swing? One fixed scale for everybody (relay.js, swingSpeed): the mean angular speed
// of the hand in deg/s is worth a speed in m/s, with no ceiling at an ordinary person's best. The
// harder the swing, the faster, up to what a human arm can do.
const swingTune = () => ({ topSwing: tuning.topSwing });
const speedOfSwing = () => swingSpeed(tracker.swing, tracker.shakeG, swingTune());

// Every run is recorded (raw samples, game state, events) so the scale can be set from real swings.
const recorder = createRecorder('super-relay');
const FRAME_COLUMNS = ['race_s', 'distance_m', 'speed_mps', 'leg', 'awaiting', 'gauge', 'swing_dps', 'shake_G', 'target_mps', 'rough', 'time_scale', 'place'];
let lastFrameRec = 0;
/** Per leg: how hard and how often the runner swung, for the result card and the recording. */
let legStats = [];
const newLegStat = () => ({ sec: 0, swingSum: 0, swingPeak: 0, strokes: 0, topSpeed: 0 });

// ---------------------------------------------------------------------------
// State
let stage = null, chrome = null;
let state = 'title';              // title | call | recall | race | result
let proc = new StartProcedure();
let race = new RelayRace();
let teams = [];                   // the seven rival teams, in the order of stage.rivals
let keyHeld = false, keyAt = null;
let reactionMs = null;
let view = { base: 0 };           // z = -(s - base): which stretch of the race lies on the straight
let place = 1, finalPlace = null;
let resultAt = 0, cardShown = false, runout = 0, dqReason = '';
let lastFrame = performance.now();
let zoneMarks = null;
let savedAt = null;
let gunFired = false;             // the rival teams only run once the gun has gone
let gunSeenAt = null;             // when the gun is heard (the audio output has a delay); the race starts then
let watchSince = null;            // sample time from which a movement counts (set when the starter is satisfied)
let slow = 1;                     // current time scale of the race (SLOW during an exchange)
let roughFor = 0;                 // seconds the hands have been past the limit without a break
let lastV = 0, speedStep = 0, lastStepAt = 0, lastLeakAt = 0, lastGaugeTick = 0, strokeSide = 1;
let lastInput = { effort: 0, rough: 0, drop: false };
let runners = [];                 // optional names of the four runners

const live = (now) => !tracker.stale(now);
const readBest = () => { try { const v = parseFloat(localStorage.getItem(BEST_KEY)); return Number.isFinite(v) ? v : null; } catch { return null; } };
const readRanking = () => { try { const v = JSON.parse(localStorage.getItem(RANKING_KEY) || '[]'); return Array.isArray(v) ? v.filter((r) => r && Number.isFinite(r.time)) : []; } catch { return []; } };
const writeRanking = (list) => { try { localStorage.setItem(RANKING_KEY, JSON.stringify(list.slice(0, RANKING_LIMIT))); } catch { /* ignore */ } };
/** "1走" or, when the team typed names, "1走 KIKU". */
const legLabel = (i) => (runners[i] ? `${LEG_NAMES[i]} ${runners[i]}` : LEG_NAMES[i]);
const legShort = (i) => runners[i] || LEG_NAMES[i];
function readRunners() {
  const text = $('team-names').value;
  runners = text.split(/[,、，\n]/).map((s) => s.trim().slice(0, 14)).filter(Boolean).slice(0, 4);
  try { localStorage.setItem(RUNNERS_KEY, text); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// UI helpers
const root = $('stage');
const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
function setScreen(name) {
  root.dataset.screen = name;
  root.classList.remove('settled');
  $('ranking-layer').style.display = 'none';
}
function call(en, ja, cls = '') {
  const c = $('call');
  $('call-en').textContent = en;
  $('call-ja').textContent = ja;
  c.className = `call show ${cls}`;
  restart(c, 'pop');
}
function hideCall() { $('call').classList.remove('show'); }
function setSteady(ratio, label, done = false) {
  const s = $('steady');
  s.classList.toggle('show', ratio != null);
  s.classList.toggle('done', done);
  if (ratio == null) return;
  $('steady-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  $('steady-label').textContent = label;
}
function popup(text, kind = 'info', small = '') {
  const el = document.createElement('div');
  el.className = `popup ${kind}`;
  el.textContent = text;
  if (small) { const s = document.createElement('small'); s.textContent = small; el.appendChild(s); }
  $('popup-layer').appendChild(el);
  setTimeout(() => el.remove(), 1500);
}
function setCue(mode) { const c = $('rh-cue'); if (c.dataset.mode !== mode) { c.dataset.mode = mode; restart(c, 'pop'); } }
function setLeg(leg) {
  for (const el of $('rh-legs').children) {
    const i = +el.dataset.leg;
    el.classList.toggle('on', i === leg);
    el.classList.toggle('done', i < leg);
  }
  $('rh-cue-run-ja').textContent = leg === 0 && !runners[0] ? '振れ！' : `${legShort(leg)}　振れ！`;
  $('runner-tag-name').textContent = legShort(leg);
}
function updateBest() {
  const best = readBest();
  $('best-time').textContent = best == null ? '--.--' : formatTime(best);
}

// ---------------------------------------------------------------------------
// The stretch of the race that lies on the straight
/** z on the stadium straight for race distance s. */
const zOf = (s) => -(s - view.base);
/** After an exchange: lay the next leg out so that its zone (or the finish) fits on the straight. */
function layoutLeg(leg) {
  // legs 1 and 2: their takeover zone ends 122 m down the straight; the anchor: the finish is at the gate
  view.base = leg === 0 ? 0 : leg < RELAY_DEFAULTS.legs - 1 ? leg * RELAY_DEFAULTS.legM - 12 : race.total + FINISH_Z;
  stage.world.setGate(leg === RELAY_DEFAULTS.legs - 1);
  stage.rig.position.z = zOf(race.s);
}
function buildZoneMarks() {
  const g = new THREE.Group();
  const line = (color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W, 0.28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, fog: false }));
    m.position.y = 0.03; m.renderOrder = 5;
    return m;
  };
  const glow = (geo, color, opacity) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  const curtain = (color, opacity) => {
    const m = glow(new THREE.PlaneGeometry(LANE_W, 3.4), color, opacity);
    m.position.y = 1.7; m.renderOrder = 5;
    return m;
  };
  // real tracks mark the takeover zone with yellow lines; the blue lane and the curtains make it readable at speed
  const start = new THREE.Group(), end = new THREE.Group();
  start.add(line(new THREE.Color(2.4, 1.9, 0.2)), curtain(0x22e3ff, 0.3));
  end.add(line(new THREE.Color(2.6, 0.5, 0.6)), curtain(0xff3d6e, 0.3));
  const floor = glow(new THREE.PlaneGeometry(LANE_W, 1).rotateX(-Math.PI / 2), 0x1f8dff, 0.3);
  floor.position.y = 0.015; floor.renderOrder = 3;
  g.add(floor, start, end);
  g.visible = false;
  stage.scene.add(g);
  return { group: g, start, end, floor };
}

// ---------------------------------------------------------------------------
// The baton and the exchange scene
//
// On the track the camera follows the runner, who carries a glowing baton. In the zone time slows
// and the camera closes in on two hands: the baton travels from one to the other as the gauge
// fills, and trembles when the sensor does.
const HAND = new THREE.Vector3(0, -0.29, 0);       // the fist, in the forearm's frame
const pass = { active: false, t: 0, blend: 0, k: 0, done: false };
let baton = null, batonGlow = null, receiver = null;
const hA = new THREE.Vector3(), hB = new THREE.Vector3(), mid = new THREE.Vector3(), camGoal = new THREE.Vector3();
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qGrip = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const receiverPose = newPose();

function buildBaton() {
  baton = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.3, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.1, 0.5), fog: false }));
  baton.visible = false;
  batonGlow = new THREE.PointLight(0xffd34d, 0, 3.5, 2);
  baton.add(batonGlow);
  stage.scene.add(baton);
  // the next runner: same kit as the one arriving
  receiver = new Runner({ skin: 0xd9a47f, top: 0x12c8e6, shorts: 0x0c0e14, shoes: 0x19e0ff, hair: 0x2a1a10, bib: '5' });
  receiver.root.visible = false;
  stage.scene.add(receiver.root);
}
function beginExchange(k) {
  Object.assign(pass, { active: true, t: 0, blend: 0, k, done: false });
  receiver.root.visible = true;
  stage.setCam('free', 0.45);
}
/** cut = jump straight back behind the runner (the next leg is laid out somewhere else on the straight). */
function endExchange(cut = true) {
  pass.active = false; pass.blend = 0;
  receiver.root.visible = false;
  stage.setCam('chase', cut ? 0.001 : 0.4);
}
/** The arriving runner reaches forward with the baton (right hand). */
function heroPose(P) {
  if (!pass.active) return;
  const b = smooth(pass.blend);
  P.arm[3] = lerp(P.arm[3], 1.22, b); P.arm[4] = lerp(P.arm[4], 0.1, b); P.arm[5] = lerp(P.arm[5], 0.12, b);
  P.torsoY = lerp(P.torsoY, -0.12, b);
}
/** Called by the stage once the runner is posed: the receiver, the baton, the close-up camera. */
function placeBaton(dt) {
  const hero = stage.hero;
  if (!hero.root.visible) { baton.visible = false; return; }
  hero.root.updateMatrixWorld(true);
  const armA = hero.arms[1].elbow;
  hA.copy(HAND); armA.localToWorld(hA);
  armA.getWorldQuaternion(qA).multiply(qGrip);
  baton.visible = true;
  if (!pass.active) {
    baton.position.copy(hA);
    baton.quaternion.copy(qA);
    batonGlow.intensity = 0.6;
    return;
  }
  pass.t += dt;
  pass.blend = Math.min(1, pass.blend + dt / 0.35);
  // the next runner is already moving, a stride ahead and half a lane to the side, left hand back
  const k = Math.min(1, race.v / MAX_SPEED);
  const gap = lerp(2.1, 1.16, smooth(pass.t / 0.7));
  receiver.root.position.set(hero.root.position.x + 0.44, hero.root.position.y, hero.root.position.z - gap);
  poseRun(receiverPose, Math.PI * stage.view.stepPhase + 1.2, Math.max(0.35, k), 0.2);
  receiverPose.arm[0] = -1.08; receiverPose.arm[1] = -0.3; receiverPose.arm[2] = 0.1;
  receiverPose.torsoY = 0.1;
  receiver.apply(receiverPose);
  receiver.root.updateMatrixWorld(true);
  const armB = receiver.arms[0].elbow;
  hB.copy(HAND); armB.localToWorld(hB);
  armB.getWorldQuaternion(qB).multiply(qGrip);
  // the baton crosses from hand to hand as the gauge fills, and shakes as the sensor does
  const g = pass.done ? 1 : smooth(race.gauge);
  const r = Math.min(2.5, lastInput.rough);
  const t = stage.time;
  baton.position.lerpVectors(hA, hB, g);
  baton.position.x += 0.012 * r * Math.sin(t * 61); baton.position.y += 0.016 * r * Math.sin(t * 47 + 1);
  baton.quaternion.slerpQuaternions(qA, qB, g);
  batonGlow.intensity = 0.8 + 1.6 * g;
  // close on the hands, from the infield side, drifting slowly
  mid.lerpVectors(hA, hB, 0.5);
  const a = 0.25 * Math.sin(pass.t * 0.5);
  camGoal.set(mid.x - 1.7 * Math.cos(a), mid.y + 0.3 + 0.06 * Math.sin(pass.t * 0.7), mid.z - 0.7 + 1.7 * Math.sin(a));
  mid.y -= 0.2;      // aim below the hands so they sit in the upper half, clear of the panel at the bottom
  const f = stage.freeCam;
  if (pass.t <= dt * 1.5) { f.pos.copy(camGoal); f.look.copy(mid); } else { f.pos.lerp(camGoal, Math.min(1, dt * 8)); f.look.lerp(mid, Math.min(1, dt * 12)); }
  f.fov = 34;
}
/** The runner's name floats above the runner while the camera follows. */
const tagPos = new THREE.Vector3();
function placeTag() {
  const tag = $('runner-tag');
  const show = state === 'race' && !pass.active && stage.cam.mode === 'chase' && stage.cam.blend > 0.9 && !!$('runner-tag-name').textContent;
  tag.classList.toggle('show', show);
  if (!show) return;
  tagPos.set(stage.hero.root.position.x, stage.hero.root.position.y + 2.02, stage.hero.root.position.z).project(stage.camera);
  tag.style.transform = `translate(${((tagPos.x + 1) / 2) * window.innerWidth}px, ${((1 - tagPos.y) / 2) * window.innerHeight}px)`;
}

// ---------------------------------------------------------------------------
// Flow
function resetField() {
  race = new RelayRace({ rule: tuning.rule, passSec: tuning.passSec });
  const times = [...RIVAL_TIMES];
  for (let i = times.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [times[i], times[j]] = [times[j], times[i]]; }
  teams = stage.rivals.map((r, i) => {
    const team = makeRivalTeam(times[i] + (Math.random() - 0.5) * 0.5, 0.13 + Math.random() * 0.08);
    r.finishZ = -1e9;                  // the figure never "finishes" on its own: the team model decides
    r.reset(11, team.reaction);
    r.vmax = 0.01;                     // the figure's own speed only drives its stride; see updateTeams()
    r.figure.root.visible = true;
    return team;
  });
  view.base = 0;
  reactionMs = null; finalPlace = null; place = 1; savedAt = null; dqReason = '';
  gunFired = false; gunSeenAt = null; watchSince = null;
  slow = 1; roughFor = 0; lastV = 0; speedStep = 0;
  legStats = [newLegStat(), newLegStat(), newLegStat(), newLegStat()];
  tracker.hold(false);
  pass.active = false; pass.blend = 0;
  if (receiver) receiver.root.visible = false;
  if (baton) baton.visible = false;      // shown again as soon as the runner is on screen
  stage.timeScale = 1; stage.rivalScale = 1; stage.rivalSteps = false; stage.shiftTarget = 0;
  stage.resetRunner();
  stage.world.resetRace();
  stage.world.setGate(false);
  stage.world.setGuide(0, false);
  stage.fx.reset();
  stage.audio.speedToneOff();
  if (zoneMarks) zoneMarks.group.visible = false;
  root.classList.remove('in-zone', 'rough', 'over');
  $('finish-banner').classList.remove('show');
  setLeg(0);
  $('rh-time').textContent = '0.00';
  $('popup-layer').textContent = '';
}

// ---------------------------------------------------------------------------
// Recording: every run, as it is played
function beginRecording() {
  if (recorder.active) recorder.cancel();       // restarted before the last one got anywhere
  const ble = window.bles?.[0];
  recorder.begin({
    build: window.RELAY_BUILD, runners: [...runners], legNames: LEG_NAMES,
    tuning: { ...tuning },
    swingScale: { ...SWING_DEFAULTS, ...swingTune() },
    calmLimit: calmTune(),
    rules: { ...race.o },
    slowMotion: SLOW,
    rivalTimes: teams.map((t) => +t.targetTime.toFixed(2)),
    sensor: { name: ble?.bluetoothDevice?.name ?? null, range: ble?.device_information?.range ?? null, live: live(performance.now()) },
    audioDelayMs: stage.audio.ready ? Math.round(stage.audio.outputDelayMs()) : null,
    userAgent: navigator.userAgent,
  }, FRAME_COLUMNS);
  lastFrameRec = 0;
}
function recordEvent(e, now) {
  const { type, ...rest } = e;
  const data = {};
  for (const [k, v] of Object.entries(rest)) data[k] = typeof v === 'number' ? +v.toFixed(3) : v;
  recorder.event(now, type, data);
}
/** What the run came to, stored with the recording. */
function runSummary(extra = {}) {
  return {
    time: race.time, dq: race.dq, dqReason: dqReason || null, penalty: race.penalty, drops: race.drops, place: finalPlace,
    reactionMs: reactionMs == null ? null : +reactionMs.toFixed(1), topSpeed: +race.topSpeed.toFixed(2),
    splits: race.splits.map((t) => +t.toFixed(3)),
    passes: race.passes.map((p) => ({ k: p.k, keep: p.keep == null ? null : +p.keep.toFixed(3), handSec: p.handSec == null ? null : +p.handSec.toFixed(2), roughAvg: +p.roughAvg.toFixed(2), over: p.over, dropped: p.dropped })),
    legs: legStats.map((s, i) => ({ runner: runners[i] || null, sec: +s.sec.toFixed(2), swingMeanDps: s.sec > 0 ? +(s.swingSum / s.sec).toFixed(1) : null, swingPeakDps: +s.swingPeak.toFixed(1), strokesPerSec: s.sec > 0 ? +(s.strokes / s.sec).toFixed(2) : null, topSpeed: +s.topSpeed.toFixed(2) })),
    ...extra,
  };
}
async function refreshRecCount() {
  const n = await recorder.count();
  $('rec-count').textContent = `保存済み ${n} 件`;
}

function toTitle() {
  // a race that was under way is kept, marked as abandoned; one that never started is dropped
  if (recorder.active) { if (gunFired) recorder.end(runSummary({ abandoned: true })); else recorder.cancel(); }
  state = 'title';
  setScreen('start');
  chrome.setCinema(false);
  hideCall(); setSteady(null);
  $('result-card').classList.remove('show');
  resetField();
  stage.audio.heartRate = 0;
  stage.setCam('title', 1.2);
  stage.world.drawJumbo({ mode: 'title' });
  stage.world.drawClock('0.00');
  stage.world.setExcitement(0.14, 0.02);
  stage.audio.stopRace();
  stage.audio.setCrowd(0.14, 0);
  stage.audio.setMusic('title', 1.2);
  updateBest();
}

function beginCall() {
  stage.audio.init();
  readRunners();
  state = 'call';
  keyAt = null; cardShown = false;
  setScreen('countdown');
  chrome.setCinema(true);
  $('result-card').classList.remove('show');
  $('foul-flash').classList.remove('show');
  resetField();
  beginRecording();
  stage.setCam('chase', stage.cam.mode === 'title' ? 2.3 : 1.2);
  stage.audio.ui('start');
  stage.audio.setMusic('off', 0.5);
  stage.audio.stopRace();
  proc = new StartProcedure();
  proc.begin(performance.now());
  onMarks();
}
function onMarks() {
  call('ON YOUR MARKS', `位置について　${legShort(0)} が CORE を持つ`);
  setSteady(null);
  stage.audio.heartRate = 0;
  stage.view.crouchTarget = 0.5; stage.view.lookUpTarget = 0;
  stage.rivals.forEach((r) => r.setCrouch(0));
  stage.world.drawJumbo({ mode: 'text', text: 'ON YOUR MARKS', sub: '4 x 100m RELAY · FINAL' });
  stage.world.setExcitement(0.1, 0.02);
  stage.audio.setCrowd(0.1, 0.5);
}
function onSet() {
  call('SET', '用意', 'set');
  // a run key that is already down at "set" is a runner who is moving: it counts from here
  if (keyHeld && keyAt == null) keyAt = performance.now();
  stage.view.crouchTarget = 1; stage.view.lookUpTarget = 1;
  stage.rivals.forEach((r) => r.setCrouch(1));
  stage.world.drawJumbo({ mode: 'text', text: 'SET', color: '#ffd34d', sub: 'SILENCE FOR THE START' });
  stage.world.setExcitement(0.0, 0.004);
  stage.audio.setCrowd(0.02, 1);
  stage.audio.countBeep();
  stage.audio.heartRate = 1.15;
}
function onUnsteady() {
  tracker.hold(false);
  call('STAND UP', 'いちど楽にして、もう一度', 'warn');
  stage.audio.ui('click');
  setTimeout(() => { if (state === 'call' && proc.phase === 'marks') onMarks(); }, 1300);
  stage.view.crouchTarget = 0.3;
  stage.rivals.forEach((r) => r.setCrouch(0));
  stage.audio.heartRate = 0;
  stage.audio.setCrowd(0.12, 0.3);
}
function onFire(now) {
  // The gun is heard a little after it is triggered (about 20 ms on built-in speakers, 150-200 ms
  // on Bluetooth headphones). That moment is the gun time; what is seen waits for it in onGunSeen().
  const delay = stage.audio.outputDelayMs();
  stage.audio.gun();
  proc.fired(now + delay);
  gunSeenAt = now + delay;
  recorder.event(now, 'gun-triggered', { audioDelayMs: Math.round(delay) });
  recorder.event(now + delay, 'gun-heard');
  stage.audio.heartRate = 0;
  stage.audio.setCrowd(0.75, 0);
  stage.audio.setMusic('race', 0.05);
}
function onGunSeen() {
  gunSeenAt = null;
  gunFired = true;
  hideCall(); setSteady(null);
  stage.view.flash = 0.42; stage.view.fovKick = 4;
  stage.view.crouchTarget = 0; stage.view.lookUpTarget = 0;
  stage.rivals.forEach((r) => r.start());
  stage.rivalSteps = true;
  stage.world.kick(0.85, 0.3);
  stage.world.setExcitement(0.5, 0.03);
  stage.world.pulseLed(1);
  // the race clock starts with the gun, whether or not anyone has moved yet
  state = 'race';
  chrome.setCinema(false);
  setScreen('race');
  setCue('run');
  layoutLeg(0);
}
function onFalseStart(result) {
  gunSeenAt = null;
  recorder.event(performance.now(), 'false-start', { reason: result.reason, ms: result.ms == null ? null : +result.ms.toFixed(1) });
  if (tuning.rule !== 'dq') recorder.end(runSummary({ falseStart: true }));    // under the strict rule the DQ card ends it
  stage.audio.recall();
  stage.audio.foul();
  stage.audio.crowdGasp();
  stage.audio.speedToneOff();
  stage.view.hit = 1; stage.view.trauma = 0.5;
  stage.audio.heartRate = 0;
  hideCall(); setSteady(null);
  tracker.hold(false);
  restart($('foul-flash'), 'show');
  stage.world.drawJumbo({ mode: 'text', text: 'FALSE START', color: '#ff3d6e', sub: 'LANE 5' });
  stage.audio.setMusic('off', 0.3);
  stage.audio.setCrowd(0.2, 0);
  if (tuning.rule === 'dq') {
    dqReason = result.reason === 'too-fast'
      ? `スタートの反応が ${formatReaction(result.ms)} 秒でした。0.100 秒より速い反応はフライングです。`
      : '号砲の前に動きました（フライング）。';
    for (const r of stage.rivals) { if (r.started) r.finished = true; else r.setCrouch(0); }
    race.dq = true; race.finished = true;
    endRace(performance.now());
  } else {
    // party rule: everyone back to the blocks
    state = 'recall';
    setScreen('countdown');
    setTimeout(() => { if (state === 'recall') beginCall(); }, 1900);
  }
}

// ---------------------------------------------------------------------------
// Race events
function onRaceEvent(e, now) {
  const audio = stage.audio;
  if (e.type === 'zone-enter') {
    root.classList.add('in-zone');
    lastGaugeTick = 0; roughFor = 0;
    beginExchange(e.k);
    audio.timeWarp(-1);
    audio.heartRate = 1.5;
    audio.setCrowd(0.3, 0.6);
    $('rh-pass-en').textContent = 'SLOW HANDS';
    $('rh-pass-ja').textContent = `波形を帯の中に　そっと ${legShort(e.k + 1)} へ`;
    $('pass-keep').textContent = '100%';
  } else if (e.type === 'pass' || (e.type === 'zone-over' && !e.dq)) {
    root.classList.remove('in-zone', 'rough');
    audio.heartRate = 0;
    audio.setCrowd(0.7, 0);
    audio.timeWarp(1);
    const leg = e.k + 1;
    endExchange();
    setLeg(leg);
    setCue('run');
    layoutLeg(leg);                       // the cut: the next runner's stretch is laid on the straight
    stage.view.flash = 0.3; stage.view.fovKick = 5;
    stage.world.kick(0.4, 0.1);
    stage.world.pulseLed(1);
    speedStep = SPEED_STEPS.filter((s) => race.v >= s).length;
    if (e.type === 'pass') {
      const keep = Math.round(e.keep * 100);
      const g = gradePass({ keep: e.keep });
      audio.chime(g.grade === 'S' ? 3 : g.grade === 'A' ? 2 : 1);
      audio.jump();
      popup(g.grade === 'S' ? 'PERFECT PASS!' : 'PASS!', 'clear', `バトン速度 ${keep}% ・ ${legShort(leg)} GO!`);
    } else {
      audio.foul();
      stage.view.hit = 0.8; stage.view.trauma = 0.4;
      popup('ZONE OVER', 'hit', `ゾーンを出た　+${e.penalty.toFixed(1)} 秒`);
    }
  } else if (e.type === 'zone-over') {
    dqReason = `${legLabel(e.k)} から ${legLabel(e.k + 1)} へのバトンが、テイクオーバーゾーン（30m）の中で渡りませんでした。`;
    root.classList.remove('in-zone', 'rough');
    audio.heartRate = 0;
    audio.foul(); audio.crowdGasp();
    endExchange(false);
    stage.view.hit = 1; stage.view.trauma = 0.5;
    popup('ZONE OVER', 'hit', '失格 / DISQUALIFIED');
    endRace(now);
  } else if (e.type === 'drop') {
    audio.hurdleHit(); audio.crowdGasp();
    stage.view.hit = 1; stage.view.trauma = 0.7;
    popup('BATON DROPPED!', 'hit', 'バトン落下　拾って渡し直す');
  } else if (e.type === 'split') {
    stage.world.pulseLed(0.6);
  } else if (e.type === 'finish') {
    endRace(now);
  }
}

function endRace(now) {
  state = 'result'; resultAt = now; cardShown = false;
  runout = race.v;
  slow = 1;
  root.classList.remove('in-zone', 'rough');
  root.classList.add('over');
  if (!race.dq) { $('rh-time').textContent = formatTime(race.time); restart($('finish-banner'), 'show'); }
  stage.audio.heartRate = 0;
  stage.audio.speedToneOff();
  stage.world.setGuide(0, false);
  if (zoneMarks) zoneMarks.group.visible = false;
  if (race.dq) {
    finalPlace = null;
    stage.audio.setMusic('off', 0.3);
    stage.audio.setCrowd(0.2, 0);
    stage.world.setExcitement(0.15, 0.01);
    stage.world.drawJumbo({ mode: 'text', text: 'DQ', color: '#ff3d6e', sub: 'LANE 5 · DISQUALIFIED' });
    return;
  }
  // rivals are calibrated to their target time, so the final order is known now
  finalPlace = 1 + teams.filter((t) => (t.time ?? t.targetTime) < race.time).length;
  const best = readBest();
  const isBest = best == null || race.time < best;
  if (isBest) { try { localStorage.setItem(BEST_KEY, String(race.time)); } catch { /* ignore */ } }
  race.isBest = isBest;
  stage.world.burstGate();
  stage.fx.gateShatter(FINISH_Z, TRACK_HALF);
  stage.audio.gateShatter();
  stage.audio.stopRace();
  stage.view.flash = 0.5; stage.view.trauma = 0.35;
  stage.world.drawJumbo({ mode: 'time', time: formatTime(race.time), sub: `${finalPlace}${ordinal(finalPlace)} · LANE 5`, color: finalPlace === 1 ? '#ffd34d' : '#ffffff', subColor: '#22e3ff' });
  stage.world.drawClock(formatTime(race.time));
  stage.world.setExcitement(finalPlace <= 3 ? 0.95 : 0.6, 0.2);
  stage.audio.setCrowd(finalPlace <= 3 ? 0.95 : 0.6, 0);
  stage.audio.crowdCheer(finalPlace <= 3 ? 0.9 : 0.5);
  stage.audio.setMusic('result', 0.8);
  stage.audio.fanfare(finalPlace <= 3 ? 1 : 0);
  if (finalPlace <= 3) {
    stage.fx.confetti(0, 4, FINISH_Z - 6, finalPlace === 1 ? 420 : 200);
    const shells = finalPlace === 1 ? 7 : 3;
    for (let i = 0; i < shells; i++) setTimeout(() => { if (state === 'result') stage.fx.firework(-22 + Math.random() * 44, FINISH_Z - 40 - Math.random() * 30); }, 300 + i * 420);
    stage.world.startWave();
  }
}
const ordinal = (n) => (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

// ---------------------------------------------------------------------------
// Result card
function row(parent, cells, cls = '') {
  const r = document.createElement('div');
  r.className = `rc-row ${cls}`;
  for (const [c, text] of cells) { const s = document.createElement('span'); s.className = c; s.textContent = text; r.appendChild(s); }
  parent.appendChild(r);
}
function showCard() {
  cardShown = true;
  // the recording ends here (it includes the run-out) and is stored in this browser
  recorder.end(runSummary()).then(() => { $('btn-raw').hidden = !recorder.last; });
  setScreen('finish');
  root.classList.add('settled');
  stage.shiftTarget = 0.3;
  stage.view.settleTarget = 1;
  const dq = race.dq;
  $('rc-main').hidden = dq;
  $('rc-dq').hidden = !dq;
  $('name-form').hidden = dq;
  $('save-status').textContent = '';
  $('save-score').disabled = false;
  $('rt-badge').classList.toggle('show', !dq && !!race.isBest);
  if (dq) {
    $('rc-dq-reason').textContent = dqReason;
  } else {
    $('rc-time').textContent = formatTime(race.time);
    const bits = [];
    if (reactionMs != null) bits.push(`スタートの反応 ${formatReaction(reactionMs)} 秒`);
    bits.push(`最高速 ${race.topSpeed.toFixed(1)} m/s`);
    if (race.penalty > 0) bits.push(`ペナルティ +${race.penalty.toFixed(1)} 秒を含む`);
    if (race.drops > 0) bits.push(`バトン落下 ${race.drops} 回`);
    $('rc-sub').textContent = bits.join(' ・ ');
    const medal = finalPlace === 1 ? 'gold' : finalPlace === 2 ? 'silver' : finalPlace === 3 ? 'bronze' : '';
    $('rc-medal').dataset.medal = medal;
    $('rc-place').textContent = String(finalPlace);
    $('rc-place-suffix').textContent = ordinal(finalPlace);
    $('rc-medal-label').textContent = medal ? medal.toUpperCase() : `${finalPlace} 位 / 8`;
  }
  // splits
  const sp = $('rc-splits');
  sp.textContent = '';
  for (let i = 0; i < RELAY_DEFAULTS.legs; i++) {
    const t = race.splits[i], prev = i === 0 ? 0 : race.splits[i - 1];
    // how the runner of this leg swung: the mean angle swept per second, and the strokes per second
    const st = legStats[i];
    const swung = st && st.sec > 0.5 && st.swingSum > 0 ? `振り ${(st.swingSum / st.sec).toFixed(0)}°/s ・ ${(st.strokes / st.sec).toFixed(1)}回/秒` : '';
    row(sp, [['rc-name', runners[i] || `${i * 100}–${(i + 1) * 100} m`], ['rc-num', t == null ? '–' : (t - prev).toFixed(2)], ['rc-note', t == null ? '' : swung || `通過 ${formatTime(t)}`]]);
  }
  // exchanges: what was left of the baton speed
  const ps = $('rc-passes');
  ps.textContent = '';
  for (let k = 0; k < RELAY_DEFAULTS.legs - 1; k++) {
    const p = race.passes[k];
    const name = `${legShort(k)} → ${legShort(k + 1)}`;
    if (!p) { row(ps, [['rc-name', name], ['rc-num', '–'], ['rc-grade', ''], ['rc-note', '']]); continue; }
    const g = gradePass(p);
    const note = p.over ? '渡らず' : `${g.ja} ・ 手の時間 ${p.handSec.toFixed(1)} 秒`;
    row(ps, [['rc-name', name], ['rc-num', p.keep == null ? '–' : `${Math.round(p.keep * 100)}%`], ['rc-grade', g.grade], ['rc-note', note]], `g-${g.grade === '×' ? 'x' : g.grade}`);
  }
  // the field
  const rows = teams.map((t, i) => ({ lane: stage.rivals[i].lane, time: t.time ?? t.targetTime, who: 'RIVAL' }));
  rows.push({ lane: 5, time: dq ? null : race.time, who: 'YOU' });
  rows.sort((a, b) => (a.time ?? 1e9) - (b.time ?? 1e9) || a.lane - b.lane);
  const board = $('rc-board');
  board.textContent = '';
  rows.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = `board-row${r.who === 'YOU' ? ' me' : ''}${r.time == null ? ' pending' : ''}`;
    for (const [c, text] of [['pos', r.time == null ? '–' : String(i + 1)], ['lane', `LANE ${r.lane}`], ['who', r.who], ['time', r.time == null ? 'DQ' : formatTime(r.time)]]) {
      const s = document.createElement('span'); s.className = c; s.textContent = text; el.appendChild(s);
    }
    board.appendChild(el);
  });
  try { const n = localStorage.getItem(NAME_KEY); if (n && !$('player-name').value) $('player-name').value = n; } catch { /* ignore */ }
  $('result-card').classList.add('show');
  updateBest();
}

// ---------------------------------------------------------------------------
// Ranking (this browser only)
let rankingFrom = 'start';
function showRanking(from) {
  rankingFrom = from;
  const list = $('ranking-list');
  list.textContent = '';
  const all = readRanking().sort((a, b) => a.time - b.time);
  if (!all.length) {
    const p = document.createElement('p');
    p.className = 'loading-message';
    p.textContent = 'まだ記録がありません / No records yet';
    list.appendChild(p);
  }
  all.forEach((r, i) => {
    const item = document.createElement('div');
    item.className = `ranking-item${savedAt && r.at === savedAt ? ' is-local' : ''}`;
    for (const [c, text] of [['rk-rank', String(i + 1)], ['rk-name', r.name], ['rk-grade', r.penalty ? `+${r.penalty}` : ''], ['rk-time', formatTime(r.time)]]) {
      const s = document.createElement('span'); s.className = c; s.textContent = text; item.appendChild(s);
    }
    list.appendChild(item);
  });
  $('ranking-layer').style.display = '';
}
function hideRanking() { $('ranking-layer').style.display = 'none'; }
function saveScore(e) {
  e.preventDefault();
  if (race.dq || !race.finished || savedAt) return;
  const name = $('player-name').value.trim().slice(0, 24);
  if (!name) { $('save-status').textContent = 'チーム名を入れてください'; return; }
  const list = readRanking();
  savedAt = Date.now();
  list.push({ name, time: Math.floor(race.time * 100) / 100, penalty: race.penalty, at: savedAt });
  list.sort((a, b) => a.time - b.time);
  writeRanking(list);
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
  $('save-status').textContent = `登録しました：${list.findIndex((r) => r.at === savedAt) + 1} 位`;
  $('save-score').disabled = true;
}

// ---------------------------------------------------------------------------
// Per-frame
function readInput(now, dt) {
  const sensorLive = live(now);
  let target = 0, rough = 0, drop = false, swing = 0;
  if (sensorLive) {
    swing = tracker.swing;
    target = speedOfSwing();
    rough = agg.n ? agg.rough : roughness(tracker.last, calmTune());
    drop = agg.fall;
  } else if (tracker.inUse(now)) {
    // a sensor that was sending a moment ago and has stopped is lost, not still: the exchange
    // must not complete by itself while it is away
    rough = 3;
  }
  // keyboard: the key down is a strong swing (worth 11.4 m/s), the key up is perfectly still
  if (keyHeld) { target = race.o.vmax; rough = 3; }
  const strokes = agg.strokes;
  agg.n = 0; agg.rough = 0; agg.fall = false; agg.strokes = 0;
  // effort 0..1 only drives sounds and bars: the share of the top speed this swing is worth
  lastInput = { target, effort: Math.min(1, target / SWING_DEFAULTS.topSpeed), rough, drop, strokes, swing, dt };
  return lastInput;
}

/**
 * Advance the seven other teams and put their runners on the straight. The team model owns the
 * distance; the figure is placed from it every frame and its own speed only drives the stride.
 * Returns how many teams are ahead of the player's baton.
 */
function updateTeams(dt) {
  let ahead = 0;
  teams.forEach((team, i) => {
    team.step(dt);
    const r = stage.rivals[i];
    r.vmax = Math.max(0.01, team.v);
    if (team.finished && !r.finished) r.finished = true;
    const z = zOf(team.s) + BLOCK_Z;
    r.figure.root.position.z = z;
    r.figure.root.visible = z < 12 && z > -132;
    if (team.s > race.s) ahead++;
  });
  return ahead;
}

function updateRace(now, dt) {
  const input = readInput(now, dt);
  const audio = stage.audio;
  // the start: reaction time, or a reaction too fast to be legal
  if (proc.phase === 'fired') {
    const on = live(now) ? tracker.findOnset(watchSince ?? proc.watchFrom) : null;
    // the official moment is the signal passing the threshold, as a timing system would take it
    for (const e of proc.step(now, { stillMs: 0, onsetAt: on ? Math.max(proc.watchFrom, on.t) : null, keyAt })) {
      if (e.type === 'reaction') { reactionMs = e.ms; recorder.event(now, 'reaction', { ms: +e.ms.toFixed(1) }); popup(formatReaction(e.ms), 'info', 'REACTION TIME'); } else if (e.type === 'false-start') { onFalseStart(e); return; }
    }
    if (proc.phase === 'done') tracker.hold(false);   // the SET pose is no longer the reference
  }

  // Time: the exchange is played in slow motion, as long as the hands are trying. Hands that stay
  // past the limit lose the slow motion (it is a help for a careful exchange, not a place to wait).
  const wasAwaiting = race.awaiting;
  if (wasAwaiting) roughFor = input.rough >= 1 ? roughFor + dt : Math.max(0, roughFor - dt * 3);
  const slowGoal = wasAwaiting ? (roughFor > 1.3 ? 1 : SLOW) : 1;
  slow += (slowGoal - slow) * Math.min(1, dt * (slowGoal < slow ? 10 : 6));
  const raceDt = dt * slow;
  stage.timeScale = slow;

  const legNow = race.leg, wasRunning = !wasAwaiting;
  for (const e of race.step(raceDt, { target: input.target, rough: input.rough, drop: input.drop, handDt: dt })) { recordEvent(e, now); onRaceEvent(e, now); }
  // how this runner swung while running (the exchange is not part of it)
  if (wasRunning && legStats[legNow] && (reactionMs != null || race.s > 0.5)) {
    const st = legStats[legNow];
    st.sec += dt; st.swingSum += input.swing * dt; st.swingPeak = Math.max(st.swingPeak, input.swing);
    st.strokes += input.strokes; st.topSpeed = Math.max(st.topSpeed, race.v);
  }
  if (now - lastFrameRec >= 50) {
    lastFrameRec = now;
    recorder.frame(now, [+race.t.toFixed(3), +race.s.toFixed(2), +race.v.toFixed(3), race.leg, race.awaiting ? 1 : 0, +race.gauge.toFixed(3), +tracker.swing.toFixed(1), +tracker.shakeG.toFixed(3), +input.target.toFixed(2), +input.rough.toFixed(2), +slow.toFixed(2), place]);
  }
  if (state !== 'race') return;

  // the runner and the seven other teams on the straight
  stage.speed = race.v;
  stage.rig.position.z = zOf(race.s);
  place = 1 + updateTeams(raceDt);

  const k = race.v / MAX_SPEED;
  const awaiting = race.awaiting;
  const dv = dt > 0 ? (race.v - lastV) / dt : 0;       // m/s per real second
  lastV = race.v;
  audio.speedTone(k, dv / 8);
  if (awaiting) {
    // hushed and muffled; every leak of speed is heard, and so is the gauge filling
    audio.setRace(0.04, 1, false);
    stage.world.setExcitement(0.25, 0.01);
    const tick = Math.floor(race.gauge * 10);
    if (tick > lastGaugeTick) audio.tick01(race.gauge);
    lastGaugeTick = tick;
    const out = input.rough >= 1;
    if (out !== root.classList.contains('rough')) {
      root.classList.toggle('rough', out);
      $('rh-pass-en').textContent = out ? 'TOO ROUGH!' : 'SLOW HANDS';
    }
    if (input.rough > 0.35 && race.zone.handSec > RELAY_DEFAULTS.graceSec && now - lastLeakAt > (out ? 150 : 260)) {
      lastLeakAt = now;
      audio.leak(Math.min(1, input.rough / 2));
      if (out) stage.view.trauma = Math.max(stage.view.trauma, 0.25);
    }
  } else {
    audio.setRace(k, 1, false);
    const e = 0.42 + 0.45 * k;
    stage.world.setExcitement(e, 0.02 + 0.03 * k);
    audio.setCrowd(e, 0);
    // every arm stroke is heard, and so is every step of speed gained or lost
    if (input.strokes > 0) { strokeSide = -strokeSide; audio.swish(input.effort, strokeSide * 0.5); }
    const step = SPEED_STEPS.filter((s) => race.v >= s + (speedStep > SPEED_STEPS.indexOf(s) ? -0.3 : 0)).length;
    if (step !== speedStep && now - lastStepAt > 220) {
      if (step > speedStep) audio.gearUp(step - 1); else audio.gearDown(step);
      speedStep = step; lastStepAt = now;
    }
  }

  // the zone on the track: the one ahead, or the one the baton is in
  const zone = race.zone ? { k: race.zone.k, ...race.zoneOf(race.zone.k) } : race.nextZone;
  const showZone = !!zone && zone.start - race.s < 70 && (!race.zone || awaiting);
  zoneMarks.group.visible = showZone;
  if (showZone) {
    const d = zone.start - race.s;
    zoneMarks.start.position.z = zOf(zone.start);
    zoneMarks.end.position.z = zOf(zone.end);
    zoneMarks.floor.position.z = zOf((zone.start + zone.end) / 2);
    zoneMarks.floor.scale.z = zone.end - zone.start;
    stage.world.setGuide(0, true, 0, zOf(zone.start), zOf(zone.end), awaiting ? 1 : 0.45, Math.min(1, Math.max(0, (70 - d) / 20)));
  } else {
    stage.world.setGuide(0, false);
  }

  // HUD
  $('rh-time').textContent = race.t.toFixed(2);
  $('rh-place').textContent = String(place);
  $('rh-speed').textContent = race.v.toFixed(1);
  const delta = $('rh-delta');
  const trend = awaiting ? '' : dv > 0.6 ? '▲' : dv < -0.6 ? '▼' : '';
  if (delta.textContent !== trend) { delta.textContent = trend; delta.className = dv > 0 ? 'up' : 'down'; }
  $('rh-fill').style.width = `${Math.min(100, (race.s / race.total) * 100)}%`;
  $('rh-me').style.left = `${Math.min(100, (race.s / race.total) * 100)}%`;
  const pips = $('rh-rivals').children;
  teams.forEach((team, i) => { pips[i].style.left = `${Math.min(100, (team.s / race.total) * 100)}%`; });
  $('rh-effort').style.transform = `scaleX(${Math.min(1, input.swing / tuning.topSwing)})`;
  $('rh-swing').textContent = keyHeld && !live(now) ? 'KEY' : input.swing.toFixed(0);
  if (awaiting) {
    $('rh-gauge').style.transform = `scaleX(${race.gauge})`;
    const left = Math.max(0, zone.end - race.s);
    $('rh-zone-left').style.transform = `scaleX(${left / (zone.end - zone.start)})`;
    $('rh-zone-m').textContent = left.toFixed(0);
    $('pass-ui').classList.toggle('danger', left < 8);
    $('pass-speed').textContent = race.v.toFixed(1);
    const keep = race.zone.enterV > 0 ? race.v / race.zone.enterV : 1;
    const el = $('pass-keep');
    el.textContent = `${Math.round(keep * 100)}%`;
    el.dataset.level = keep >= 0.8 ? 's' : keep >= 0.7 ? 'a' : keep >= 0.58 ? 'b' : 'c';
  } else if (race.nextZone && race.nextZone.start - race.s <= NEAR_M) {
    setCue('near');
    $('rh-near-m').textContent = Math.max(0, race.nextZone.start - race.s).toFixed(0);
  } else {
    setCue('run');
  }
  if (stage.time - (updateRace.jumboAt || 0) > 0.07) {
    updateRace.jumboAt = stage.time;
    stage.world.drawJumbo({ mode: 'time', time: race.t.toFixed(1), sub: `${legShort(race.leg)} · ${(race.v * 3.6).toFixed(0)} km/h` });
    stage.world.drawClock(race.t.toFixed(1));
  }
}

function update(now, dt) {
  tracker.decay(now);
  const sensorLive = live(now);

  if (state === 'call') {
    if (gunSeenAt != null && now >= gunSeenAt) { onGunSeen(); updateRace(now, dt); return; }
    const watch = proc.watchFrom;
    const on = sensorLive && watch != null ? tracker.findOnset(watchSince ?? watch) : null;
    // no sensor at all = keyboard play, nothing to hold still; a sensor that has just gone quiet is lost, never "still"
    const lost = !sensorLive && tracker.inUse(now);
    const events = proc.step(now, { stillMs: sensorLive ? tracker.stillMs(now) : lost ? 0 : Infinity, onsetAt: on ? Math.max(watch, on.t) : null, keyAt });
    for (const e of events) {
      if (e.type === 'set') onSet();
      else if (e.type === 'steady') {
        tracker.hold(true);
        // samples are dated when measured, a little before they arrive: search from the last one seen
        watchSince = tracker.last ? Math.min(tracker.last.t, proc.watchFrom) : proc.watchFrom;
        setSteady(1, 'STEADY', true);
      } else if (e.type === 'unsteady') onUnsteady();
      else if (e.type === 'fire') onFire(now);
      else if (e.type === 'false-start') onFalseStart(e);
    }
    if (state === 'call' && proc.phase === 'set') {
      const still = sensorLive ? tracker.stillMs(now) : lost ? 0 : Infinity;
      const waited = now - proc.setAt;
      setSteady(Math.min(1, Math.min(still, waited) / proc.o.steadyMs), lost ? 'センサーの信号が途切れています / SENSOR LOST' : sensorLive && waited > 1400 && still < 100 ? '手を止めてください / HOLD STILL' : '静止を確認中 / STEADY…');
    }
    agg.n = 0; agg.rough = 0; agg.fall = false; agg.strokes = 0;
  } else if (state === 'race') {
    updateRace(now, dt);
  } else if (state === 'result') {
    const t = (now - resultAt) / 1000;
    if (!race.dq) {
      stage.timeScale = t < 0.8 ? 0.28 : Math.min(1, 0.28 + ((t - 0.8) / 0.8) * 0.72);
      runout = Math.max(0, runout - (runout * 0.9 + 1.2) * dt * stage.timeScale);
      stage.speed = runout;
      stage.rig.position.z = Math.max(FINISH_Z - 16, stage.rig.position.z - runout * dt * stage.timeScale);
    } else {
      stage.timeScale = 1;
      runout = Math.max(0, runout - (runout * 1.2 + 2) * dt);
      stage.speed = runout;
      stage.rig.position.z -= runout * dt;
    }
    // after a false start before the gun nobody has left the blocks
    if (gunFired) updateTeams(dt * stage.timeScale);
    if (!cardShown && t >= (race.dq ? 1.6 : 2.2)) showCard();
  }

  // dock + drawer indicators
  const f = tracker.last;
  const roughNow = sensorLive ? roughness(f, calmTune()) : 0;
  $('check-shake').classList.toggle('on', sensorLive ? tracker.swing > 100 : keyHeld);
  $('check-calm').classList.toggle('on', sensorLive && roughNow < 1);
  if (now - sensor.rateAt >= 500) {
    sensor.rate = (sensor.samples * 1000) / (now - sensor.rateAt);
    sensor.samples = 0; sensor.rateAt = now;
    const delay = stage.audio.ready ? stage.audio.outputDelayMs() : 0;
    const warn = $('audio-warn');
    warn.hidden = delay < 60;
    if (delay >= 60) warn.textContent = `音の出力が約 ${Math.round(delay)} ms 遅れています（Bluetooth イヤホンなど）。音と画面は合わせていますが、操作に対して音が遅れて聞こえます。本体のスピーカーをおすすめします。`;
  }
  if ($('settings-drawer').classList.contains('open')) {
    const c = calmTune();
    const e = sensorLive ? Math.min(1, tracker.swing / tuning.topSwing) : 0;
    $('mon-effort').textContent = sensorLive ? `${tracker.swing.toFixed(0)} °/s ・ ${tracker.shakeG.toFixed(2)} G → ${speedOfSwing().toFixed(1)} m/s` : '--';
    $('mon-effort-bar').style.width = `${e * 100}%`;
    $('mon-acc').textContent = sensorLive && f ? `${Math.max(Math.abs(f.lin[0]), Math.abs(f.lin[1]), Math.abs(f.lin[2])).toFixed(2)} G` : '--';
    $('mon-gyro').textContent = sensorLive && f ? `${Math.max(Math.abs(f.gyro[0]), Math.abs(f.gyro[1]), Math.abs(f.gyro[2])).toFixed(0)} °/s` : '--';
    $('mon-acc-bar').style.width = sensorLive && f ? `${Math.min(100, (Math.max(Math.abs(f.lin[0]), Math.abs(f.lin[1]), Math.abs(f.lin[2])) / (c.calmAcc * 4)) * 100)}%` : '0%';
    $('mon-gyro-bar').style.width = sensorLive && f ? `${Math.min(100, (f.rot / (c.calmGyro * 4)) * 100)}%` : '0%';
    $('mon-acc-calm').style.left = '25%'; $('mon-gyro-calm').style.left = '25%';
    $('mon-state').textContent = !sensorLive ? '未接続 / Not connected' : e > 0.5 ? '⚡ 振っている / Shaking' : roughNow < 1 ? '✋ そっと / Calm' : '… 動いている / Moving';
    $('mon-rate').textContent = sensorLive ? `${sensor.rate.toFixed(0)} Hz` : '-- Hz';
  }
}

/** The live traces: in the dock while it is visible, and the raw axes while the baton changes hands. */
function drawScopes(now) {
  const sensorLive = live(now);
  $('scope-dock-box').classList.toggle('live', sensorLive);
  const screen = root.dataset.screen;
  if (sensorLive && (screen === 'start' || screen === 'finish')) {
    dockScope.setTint(roughness(tracker.last, calmTune()) < 1 ? 'rgba(34, 227, 255, 0.1)' : null);
    dockScope.draw(now);
  }
  if (state === 'race' && race.awaiting) {
    const f = tracker.last, c = calmTune();
    const g = sensorLive && f ? Math.max(Math.abs(f.gyro[0]), Math.abs(f.gyro[1]), Math.abs(f.gyro[2])) / c.calmGyro : keyHeld ? 3 : 0;
    const a = sensorLive && f ? Math.max(Math.abs(f.lin[0]), Math.abs(f.lin[1]), Math.abs(f.lin[2])) / c.calmAcc : keyHeld ? 3 : 0;
    gyroScope.draw(now, g);
    accScope.draw(now, a);
  }
}

function loop() {
  const now = performance.now();
  const rawDt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;
  update(now, Math.min(rawDt, 0.05));
  drawScopes(now);
  stage.frame(rawDt);
  placeTag();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Boot
function bindTuning() {
  const bind = (id, key, fmt) => {
    const el = $(id), out = $(`${id}-value`);
    el.value = String(tuning[key]);
    if (out) out.textContent = fmt(tuning[key]);
    el.addEventListener('input', () => {
      tuning[key] = el.tagName === 'SELECT' ? el.value : parseFloat(el.value);
      if (out) out.textContent = fmt(tuning[key]);
      saveTuning();
      syncBandLabels();
    });
  };
  bind('top-swing', 'topSwing', (v) => `${v.toFixed(0)} °/s`);
  bind('calm-tol', 'calm', (v) => `×${v.toFixed(1)}`);
  bind('pass-sec', 'passSec', (v) => `${v.toFixed(1)} s`);
  bind('rule-zone', 'rule', (v) => v);
}
function syncBandLabels() {
  const c = calmTune();
  gyroScope.setBandLabel(`±${c.calmGyro.toFixed(0)} °/s`);
  accScope.setBandLabel(`±${c.calmAcc.toFixed(2)} G`);
}

async function boot() {
  stage = await createStage({ canvas: $('game-canvas'), labels: { event: 'SUPER VIRTUAL RELAY', tag: '4x100m', tagAccent: 'FINAL' } });
  chrome = bindChrome(stage, { coreIds: [0] });
  if (stage.logo) { const img = $('brand-logo'); img.src = stage.logo.toDataURL(); img.hidden = false; }
  // the runner is filmed from behind, baton in hand
  stage.showHero = true;
  stage.poseHook = heroPose;
  stage.afterPose = placeBaton;
  buildBaton();
  zoneMarks = buildZoneMarks();
  dockScope = createScope($('scope-dock'), { seconds: 4, max: 6, series: [{ color: '#22e3ff', label: 'ACC 加速度' }, { color: '#ff7ad9', label: 'GYRO 角速度' }], lines: [{ y: 1, color: '#7fe9ff', label: 'そっと', dash: true }] });
  gyroScope = createRawScope($('scope-gyro'), { seconds: 2.5, series: AXES, title: 'GYRO 角速度' });
  accScope = createRawScope($('scope-acc'), { seconds: 2.5, series: AXES, title: 'ACC 加速度（重力を除く）' });
  attachCore(window.bles?.[0], tracker, sampleClock, onSample);
  bindTuning();
  syncBandLabels();
  try { $('team-names').value = localStorage.getItem(RUNNERS_KEY) || ''; } catch { /* ignore */ }
  readRunners();
  $('team-names').addEventListener('change', readRunners);
  const pips = $('rh-rivals');
  for (let i = 0; i < stage.rivals.length; i++) pips.appendChild(document.createElement('i'));

  $('start-btn').addEventListener('click', beginCall);
  $('retry').addEventListener('click', beginCall);
  $('btn-title').addEventListener('click', toTitle);
  $('btn-ranking').addEventListener('click', () => showRanking('start'));
  $('btn-ranking-finish').addEventListener('click', () => showRanking('finish'));
  $('back-btn').addEventListener('click', hideRanking);
  $('ranking-clear').addEventListener('click', () => { writeRanking([]); showRanking(rankingFrom); });
  $('name-form').addEventListener('submit', saveScore);
  $('btn-raw').addEventListener('click', () => recorder.download());
  $('rec-all').addEventListener('click', async () => { if (!(await recorder.downloadAll())) $('rec-count').textContent = '保存済み 0 件'; });
  $('rec-clear').addEventListener('click', async () => { if (window.confirm('このブラウザに保存した生データをすべて消します。よろしいですか？')) await recorder.clear(); });
  recorder.onChange(refreshRecCount);
  refreshRecCount();
  root.addEventListener('audio-ready', () => { if (state === 'title') { stage.audio.setCrowd(0.14, 0); stage.audio.setMusic('title', 2.0); } });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    if (e.code === 'Escape') { if ($('ranking-layer').style.display !== 'none') hideRanking(); else if (state !== 'title') toTitle(); return; }
    if ($('ranking-layer').style.display !== 'none') return;
    if (e.code === 'Enter' && !e.repeat) {
      e.preventDefault();
      if (state === 'title' || (state === 'result' && cardShown)) beginCall();
      return;
    }
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (e.repeat) return;
    if (state === 'title') { beginCall(); return; }
    keyHeld = true;
    // a key during SET or the hold is a false start; the first key after the gun is the reaction
    if ((state === 'call' && proc.phase !== 'marks') || (state === 'race' && proc.phase === 'fired')) { if (keyAt == null) keyAt = e.timeStamp || performance.now(); }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') keyHeld = false; });
  window.addEventListener('blur', () => { keyHeld = false; });

  toTitle();
  stage.cam.blend = 1;
  stage.warmUp();
  lastFrame = performance.now();
  loop();
  requestAnimationFrame(() => requestAnimationFrame(() => chrome.loadingDone()));
}

// Small read-only window for automated checks and debugging from the console.
window.relayDebug = {
  get state() { return state; }, get phase() { return proc.phase; }, get race() { return race; },
  get teams() { return teams; }, get place() { return place; }, get finalPlace() { return finalPlace; },
  get reactionMs() { return reactionMs; }, get tuning() { return { ...tuning }; }, get view() { return { ...view }; },
  get slow() { return slow; }, get input() { return { ...lastInput }; }, get legStats() { return legStats; }, recorder,
  get stage() { return stage; }, tracker,
  /** Hold / release the run key from a script. */
  key(down) { keyHeld = !!down; if (down && keyAt == null && ((state === 'call' && proc.phase !== 'marks') || (state === 'race' && proc.phase === 'fired'))) keyAt = performance.now(); },
  /** Feed one synthetic sample (tests / demos without a sensor). */
  push(s) { const f = tracker.push({ t: performance.now(), ...s }); onSample(f, { x: s.ax, y: s.ay, z: s.az }, { x: s.gx, y: s.gy, z: s.gz }); return f; },
};
window.RELAY_BUILD = new URL(import.meta.url).searchParams.get('v') || 'dev';
console.log(`[RELAY] build ${window.RELAY_BUILD}`);

boot().catch((error) => {
  console.error('[RELAY] failed to start:', error);
  const l = $('loading');
  if (l) { l.classList.add('error'); l.querySelector('.loading-text').textContent = '読み込みに失敗しました。ページを再読み込みしてください / Failed to load'; }
});
