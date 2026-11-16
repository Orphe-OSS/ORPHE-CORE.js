// SUPER VIRTUAL START — the start of a sprint final, and nothing else.
//
//   ON YOUR MARKS -> SET (hold still) -> a random wait -> the gun -> move
//
// One ORPHE CORE held in the hand (or the Space key) is the whole input. The rules are in
// start.js, the reading of the sensor in motion.js, the stadium in stage.js; this file is the
// flow between them and the result screen.
import { createStage, bindChrome, attachCore, MAX_SPEED } from './stage.js';
import { MotionTracker, SampleClock, MOTION_DEFAULTS } from './motion.js';
import { StartProcedure, gradeReaction, formatReaction, REACTION_GRADES, FALSE_START_MS } from './start.js';
import { createScope, drawReactionPlot } from './scope.js';
import { createRecorder } from './recorder.js';

const $ = (id) => document.getElementById(id);
const TAU_ACCEL = 1.25;           // s: how quickly the runner approaches top speed (same curve as the rivals)
const RUN_VMAX = 11.6;            // m/s
const RUN_SECONDS = 1.9;          // how long the drive out of the blocks is shown before the result
const SCALE_MAX_MS = 400;         // right edge of the reaction scale on the result card
const BEST_KEY = 'superstart.best';
const RANKING_KEY = 'superstart.rankings';
const TUNE_KEY = 'superstart.tuning';
const NAME_KEY = 'superstart.name';
const RANKING_LIMIT = 100;

// ---------------------------------------------------------------------------
// Sensor
const tracker = new MotionTracker({ bufferMs: 6000 });   // long enough to draw the whole attempt on the result card
const sampleClock = new SampleClock();
const tuning = { still: 1, move: 1, lagMs: 0 };
try { Object.assign(tuning, JSON.parse(localStorage.getItem(TUNE_KEY) || '{}')); } catch { /* storage unavailable */ }
function applyTuning() {
  tracker.set({
    stillAcc: MOTION_DEFAULTS.stillAcc * tuning.still, stillGyro: MOTION_DEFAULTS.stillGyro * tuning.still,
    moveAcc: MOTION_DEFAULTS.moveAcc * tuning.move, moveGyro: MOTION_DEFAULTS.moveGyro * tuning.move,
  });
  try { localStorage.setItem(TUNE_KEY, JSON.stringify(tuning)); } catch { /* ignore */ }
  for (const s of scopes) s.setLines(scopeLines());
}
const sensor = { samples: 0, rateAt: 0, rate: 0, lagSum: 0, lagN: 0, lag: 0 };
// The signal as the game judges it, in threshold units: 1.0 = "moved". Drawn live in the dock and
// during SET, and once more on the result card with the moments that decided the attempt.
const SCOPE_SERIES = [{ color: '#22e3ff', label: 'ACC 加速度' }, { color: '#ff7ad9', label: 'GYRO 角速度' }];
const scopeLines = () => [
  { y: 1, color: '#ffd34d', label: '動いた' },
  { y: tracker.o.stillAcc / tracker.o.moveAcc, color: '#b6ff3c', label: '静止', dash: true },
];
let scopes = [];
applyTuning();
// Every attempt is recorded with its raw samples (see recorder.js) and stored in this browser.
const recorder = createRecorder('super-start');
function onSample(f, acc, gyro, lag) {
  sensor.samples++;
  recorder.sample(f.t, acc, gyro);
  if (Number.isFinite(lag)) { sensor.lagSum += lag; sensor.lagN++; }
  const v = [f.dyn / tracker.o.moveAcc, f.rot / tracker.o.moveGyro];
  for (const s of scopes) s.push(f.t, v);
}
const sensorLive = (now) => !tracker.stale(now);

// ---------------------------------------------------------------------------
// State
let stage = null, chrome = null;
let state = 'title';              // title | call | run | result
let proc = new StartProcedure();
let keyAt = null;                 // time of a Space press during the procedure
let attempt = null;               // { type, ms, reason, rivals: [{ lane, ms }] }
let runT = 0, resultAt = 0, cardShown = false;
let lastFrame = performance.now();
const session = [];               // legal reaction times of this page visit, in order
const attempts = [];              // every attempt of this page visit with what it was decided from (startDebug.history)
let heartOn = false;
let watchSince = null;            // sample time from which a movement counts (set when the starter is satisfied)
let fire = null;                  // { at, audioDelayMs } of this attempt's gun, or null if it has not fired
let gunSeenAt = null;             // when the flash is due (the moment the gun is heard), while it is pending
let lastOnset = null;             // the movement the sensor found in this attempt: { t, trigger, peak }

const readBest = () => { try { const v = parseFloat(localStorage.getItem(BEST_KEY)); return Number.isFinite(v) ? v : null; } catch { return null; } };
const readRanking = () => { try { const v = JSON.parse(localStorage.getItem(RANKING_KEY) || '[]'); return Array.isArray(v) ? v.filter((r) => r && Number.isFinite(r.ms)) : []; } catch { return []; } };
const writeRanking = (list) => { try { localStorage.setItem(RANKING_KEY, JSON.stringify(list.slice(0, RANKING_LIMIT))); } catch { /* ignore */ } };

// ---------------------------------------------------------------------------
// UI helpers
const root = $('stage');
const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
function setScreen(name) {
  // the hurdle stylesheet keys the dock / top bar on these names
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
function updateBest() {
  const best = readBest();
  $('best-time').textContent = best == null ? '-.---' : formatReaction(best);
}

// ---------------------------------------------------------------------------
// Flow
function toTitle() {
  if (recorder.active) recorder.cancel();      // an attempt that was left before it was decided
  state = 'title';
  gunSeenAt = null;
  tracker.hold(false);
  setScreen('start');
  chrome.setCinema(false);
  hideCall(); setSteady(null);
  $('rt-live').classList.remove('show');
  $('rt-card').classList.remove('show');
  heart(false);
  stage.timeScale = 1; stage.rivalScale = 1; stage.rivalSteps = false; stage.shiftTarget = 0;
  stage.resetRunner();
  resetRivals();
  stage.world.resetRace();
  stage.fx.reset();
  stage.setCam('title', 1.2);
  stage.world.drawJumbo({ mode: 'title' });
  stage.world.drawClock('0.000');
  stage.world.setExcitement(0.14, 0.02);
  stage.audio.stopRace();
  stage.audio.setCrowd(0.14, 0);
  stage.audio.setMusic('title', 1.2);
  updateBest();
}

function resetRivals() {
  for (const r of stage.rivals) {
    // a final-class field: 10.0 - 10.9 s runners, reactions 0.128 - 0.205 s
    r.reset(10.0 + Math.random() * 0.9 + (110 - 100) / 11, 0.128 + Math.random() * 0.077);
    r.figure.root.visible = true;
  }
}

function heart(on) {
  heartOn = on;
  stage.audio.heartRate = on ? 1.15 : 0;
}

function beginAttempt() {
  stage.audio.init();
  if (recorder.active) recorder.cancel();
  recorder.begin({
    build: window.START_BUILD, tuning: { ...tuning }, thresholds: { stillAcc: tracker.o.stillAcc, stillGyro: tracker.o.stillGyro, moveAcc: tracker.o.moveAcc, moveGyro: tracker.o.moveGyro },
    sensor: { name: window.bles?.[0]?.bluetoothDevice?.name ?? null, range: window.bles?.[0]?.device_information?.range ?? null, live: sensorLive(performance.now()) },
    audioDelayMs: Math.round(stage.audio.outputDelayMs()), name: $('player-name').value.trim() || null, userAgent: navigator.userAgent,
  });
  state = 'call';
  attempt = null; keyAt = null; cardShown = false; watchSince = null; fire = null; lastOnset = null; gunSeenAt = null;
  setScreen('countdown');
  chrome.setCinema(true);
  $('rt-live').classList.remove('show');
  $('rt-card').classList.remove('show');
  $('foul-flash').classList.remove('show');
  stage.timeScale = 1; stage.rivalScale = 1; stage.rivalSteps = false; stage.shiftTarget = 0;
  stage.resetRunner();
  resetRivals();
  stage.world.resetRace();
  stage.fx.reset();
  stage.setCam('fp', stage.cam.mode === 'title' ? 2.3 : 1.2);
  stage.audio.ui('start');
  stage.audio.setMusic('off', 0.5);
  stage.audio.stopRace();
  tracker.hold(false);
  proc = new StartProcedure();
  proc.begin(performance.now());
  onMarks();
}

function onMarks() {
  call('ON YOUR MARKS', '位置について');
  setSteady(null);
  heart(false);
  stage.view.crouchTarget = 0.5; stage.view.lookUpTarget = 0;
  stage.rivals.forEach((r) => r.setCrouch(0));
  stage.world.drawJumbo({ mode: 'text', text: 'ON YOUR MARKS', sub: "MEN'S 100m · FINAL" });
  stage.world.setExcitement(0.1, 0.02);
  stage.audio.setCrowd(0.1, 0.5);
}
function onSet() {
  call('SET', '用意', 'set');
  stage.view.crouchTarget = 1; stage.view.lookUpTarget = 1;
  stage.rivals.forEach((r) => r.setCrouch(1));
  stage.world.drawJumbo({ mode: 'text', text: 'SET', color: '#ffd34d', sub: 'SILENCE FOR THE START' });
  stage.world.setExcitement(0.0, 0.004);
  stage.audio.setCrowd(0.02, 1);
  stage.audio.countBeep();
  heart(true);
}
function onSteady() {
  // from here on any movement is a false start; the first push is measured against this pose
  tracker.hold(true);
  // samples are dated when they were measured, a little before they arrive: search from the last
  // one seen, so a movement measured just before this moment but delivered after it is not missed
  watchSince = tracker.last ? Math.min(tracker.last.t, proc.watchFrom) : proc.watchFrom;
  setSteady(1, 'STEADY', true);
}
function onUnsteady() {
  tracker.hold(false);
  call('STAND UP', 'いちど楽にして、もう一度', 'warn');
  stage.audio.ui('click');
  setTimeout(() => { if (state === 'call' && proc.phase === 'marks') onMarks(); }, 1300);
  stage.view.crouchTarget = 0.3;
  stage.rivals.forEach((r) => r.setCrouch(0));
  heart(false);
  stage.audio.setCrowd(0.12, 0.3);
}
function onFire(now) {
  // The gun. A sound scheduled now leaves the speaker a little later: about 20 ms on built-in
  // speakers, 150-200 ms on Bluetooth headphones. The moment the runner can react to is when it
  // is heard, so that is the gun time, and everything that is SEEN (the flash, the rivals
  // leaving) waits for the same moment in onGunSeen(). Showing the flash at once while timing
  // from the sound made a reaction to the flash look 0.1-0.2 s too fast: a false start.
  stage.audio.gun();
  fire = { at: now, audioDelayMs: stage.audio.outputDelayMs() };
  proc.fired(now + fire.audioDelayMs);
  gunSeenAt = now + fire.audioDelayMs;
  // sound follows the same delay as the gun, so it is started here
  heart(false);
  stage.audio.setCrowd(0.75, 0);
  stage.audio.setMusic('race', 0.05);
}
function onGunSeen() {
  gunSeenAt = null;
  hideCall(); setSteady(null);
  stage.view.flash = 0.42; stage.view.fovKick = 3;
  stage.rivals.forEach((r) => r.start());
  stage.rivalSteps = true;
  stage.world.kick(0.85, 0.3);
  stage.world.setExcitement(0.5, 0.03);
  stage.world.pulseLed(1);
  stage.world.drawJumbo({ mode: 'text', text: 'GO', color: '#b6ff3c', sub: "MEN'S 100m · FINAL" });
}

/** The grades that get the crowd on its feet. */
const sharp = (g) => g.grade === 'S' || g.grade === 'A' || g.grade === 'B';
function rivalRows() { return stage.rivals.map((r) => ({ lane: r.lane, ms: r.reaction * 1000, who: 'RIVAL' })); }

/** What the decision was made from, kept with the attempt (result card, export, startDebug). */
function debugInfo(now) {
  const o = tracker.o;
  return {
    decidedAt: now, steadyAt: proc.steadyAt, watchSince, gunFiredAt: fire ? fire.at : null, gunAt: fire ? proc.gunAt : null,
    audioDelayMs: fire ? fire.audioDelayMs : null,
    trigger: lastOnset ? lastOnset.trigger : null,       // the sensor passed the "moved" threshold (the official moment)
    onsetEstimate: lastOnset ? lastOnset.t : null,       // where that movement began to rise (shown, not used)
    keyAt, lagOffsetMs: tuning.lagMs, sensorLive: sensorLive(now), sampleRate: Math.round(sensor.rate), deliveryLagMs: Math.round(sensor.lag),
    stampsUsable: sampleClock.usable,
    thresholds: { stillAcc: o.stillAcc, stillGyro: o.stillGyro, moveAcc: o.moveAcc, moveGyro: o.moveGyro },
  };
}
function onReaction(ms, now) {
  attempt = { type: 'reaction', ms, rivals: rivalRows(), debug: debugInfo(now) };
  session.push(ms);
  state = 'run';
  tracker.hold(false);
  // the runner left the blocks `ms` after the gun; detection came a little later, so catch up
  runT = Math.max(0, (now - (proc.gunAt + ms)) / 1000);
  stage.view.crouchTarget = 0; stage.view.lookUpTarget = 0; stage.view.fovKick = 5;
  chrome.setCinema(false);
  setScreen('race');
  const text = formatReaction(ms);
  $('rt-live-value').textContent = text;
  restart($('rt-live'), 'show');
  const g = gradeReaction(ms);
  stage.world.drawJumbo({ mode: 'time', time: text, sub: `REACTION TIME · ${g.en}`, color: sharp(g) ? '#b6ff3c' : '#ffffff' });
  stage.world.drawClock(text);
  if (sharp(g)) stage.audio.chime(g.grade === 'S' ? 3 : 2);
}

function onFoul(result, now) {
  attempt = { type: result.type, ms: result.ms, reason: result.reason, rivals: rivalRows(), debug: debugInfo(now) };
  state = 'result'; resultAt = now; cardShown = false;
  gunSeenAt = null;      // a movement before the gun was seen: the flash and the rivals never come
  heart(false); hideCall(); setSteady(null);
  tracker.hold(false);
  const falseStart = result.type === 'false-start';
  if (falseStart) {
    stage.audio.recall();
    stage.audio.foul();
    stage.audio.crowdGasp();
    stage.view.hit = 1; stage.view.trauma = 0.5;
    restart($('foul-flash'), 'show');
    stage.world.drawJumbo({ mode: 'text', text: 'FALSE START', color: '#ff3d6e', sub: 'LANE 5' });
    // rivals who were already away ease down; the ones still on the blocks relax
    for (const r of stage.rivals) { if (r.started) r.finished = true; else r.setCrouch(0); }
  } else {
    stage.world.drawJumbo({ mode: 'text', text: 'NO START', color: '#9fb4d8', sub: 'LANE 5' });
  }
  stage.audio.setMusic('off', 0.3);
  stage.audio.setCrowd(0.2, 0);
  stage.world.setExcitement(0.15, 0.01);
  stage.view.crouchTarget = 0; stage.view.lookUpTarget = 0;
  chrome.setCinema(false);
  setScreen('race');
}

function showCard() {
  cardShown = true;
  // close the recording of this attempt: the moments that decided it, then what it came to
  {
    const d = attempt.debug;
    for (const [type, t] of [['steady', d.steadyAt], ['gun-triggered', d.gunFiredAt], ['gun-heard', d.gunAt], ['threshold-crossed', d.trigger], ['movement-began-estimate', d.onsetEstimate], ['key', d.keyAt], ['decided', d.decidedAt]]) {
      if (t != null) recorder.event(t, type);
    }
    recorder.end({ type: attempt.type, ms: attempt.ms == null ? null : +attempt.ms.toFixed(1), reason: attempt.reason ?? null, audioDelayMs: d.audioDelayMs, lagOffsetMs: d.lagOffsetMs, sampleRate: d.sampleRate, deliveryLagMs: d.deliveryLagMs, stampsUsable: d.stampsUsable, rivalsMs: attempt.rivals.map((r) => Math.round(r.ms)) });
  }
  const a = attempt;
  const legal = a.type === 'reaction';
  setScreen('finish');
  root.classList.add('settled');
  stage.shiftTarget = 0.3;
  stage.view.settleTarget = 1;
  $('rt-live').classList.remove('show');
  $('rt-main').hidden = !legal;
  $('rt-foul').hidden = legal;
  $('name-form').hidden = !legal;
  $('save-status').textContent = '';
  $('save-score').disabled = false;
  $('rt-badge').classList.remove('show');

  const rows = [...a.rivals];
  if (legal) {
    const g = gradeReaction(a.ms);
    $('rt-value').textContent = formatReaction(a.ms);
    $('rt-grade').dataset.grade = g.grade;
    $('rt-grade-letter').textContent = g.grade;
    $('rt-grade-en').textContent = g.en;
    $('rt-grade-ja').textContent = g.ja;
    rows.push({ lane: 5, ms: a.ms, who: 'YOU' });
    const best = readBest();
    if (best == null || a.ms < best) {
      try { localStorage.setItem(BEST_KEY, String(a.ms)); } catch { /* ignore */ }
      $('rt-badge').classList.add('show');
      stage.fx.confetti(stage.rig.position.x, 3.2, stage.rig.position.z - 7, 160);
      stage.audio.fanfare(1);
    } else {
      stage.audio.fanfare(sharp(g) ? 1 : 0);
    }
    if (g.grade === 'S') { for (let i = 0; i < 3; i++) stage.fx.firework(-14 + i * 10, stage.rig.position.z - 60 - i * 8); }
    stage.audio.setMusic('result', 0.8);
    stage.audio.crowdCheer(sharp(g) ? 0.8 : 0.45);
    stage.world.setExcitement(sharp(g) ? 0.7 : 0.4, 0.05);
    stage.audio.setCrowd(sharp(g) ? 0.6 : 0.35, 0);
  } else {
    const falseStart = a.type === 'false-start';
    $('rt-foul').dataset.kind = falseStart ? 'false' : 'none';
    $('rt-foul-title').textContent = falseStart ? 'FALSE START' : 'NO START';
    $('rt-foul-ja').textContent = falseStart ? 'フライング' : '反応なし';
    $('rt-foul-reason').textContent = !falseStart
      ? '号砲から 2.5 秒たっても動きがありませんでした。CORE の接続を確かめるか、もう少し大きく動かしてください。'
      : a.reason === 'too-fast'
        ? `反応 ${formatReaction(a.ms)} 秒。号砲から ${(FALSE_START_MS / 1000).toFixed(3)} 秒より速い反応は、音を聞いてからでは間に合わないので、フライングになります。`
        : '号砲の前に動きました。「SET」のあとは、号砲が鳴るまで止まったままでいます。';
    rows.push({ lane: 5, ms: null, who: 'YOU', foul: falseStart ? 'FS' : 'DNS' });
  }
  drawScale(legal ? a.ms : (a.type === 'false-start' && a.ms != null ? a.ms : null), a.rivals);
  drawBoard(rows);
  drawSession();
  drawWave();
  attempts.push({ type: a.type, ms: a.ms, reason: a.reason ?? null, debug: a.debug });
  try { const n = localStorage.getItem(NAME_KEY); if (n && !$('player-name').value) $('player-name').value = n; } catch { /* ignore */ }
  $('rt-card').classList.add('show');
  updateBest();
}

function drawScale(ms, rivals) {
  const pos = (v) => `${Math.max(0, Math.min(100, (v / SCALE_MAX_MS) * 100))}%`;
  const bar = $('rt-scale-bar');
  bar.textContent = '';
  let from = 0;
  const bands = [{ below: FALSE_START_MS, grade: 'F', en: 'FALSE START' }, ...REACTION_GRADES.filter((g) => g.below <= SCALE_MAX_MS).map((g) => ({ ...g })), { below: SCALE_MAX_MS, grade: 'E', en: 'LATE' }];
  for (const b of bands) {
    if (b.below <= from) continue;
    const seg = document.createElement('i');
    seg.dataset.grade = b.grade;
    seg.style.left = pos(from);
    seg.style.width = `${((Math.min(b.below, SCALE_MAX_MS) - from) / SCALE_MAX_MS) * 100}%`;
    seg.textContent = b.grade === 'F' ? 'フライング' : b.grade;
    bar.appendChild(seg);
    from = b.below;
  }
  const ticks = $('rt-scale-ticks');
  ticks.textContent = '';
  for (const t of [0, 100, 200, 300, 400]) {
    const s = document.createElement('span');
    s.style.left = pos(t);
    s.textContent = (t / 1000).toFixed(1);
    if (t === 100) s.classList.add('limit');
    ticks.appendChild(s);
  }
  const rv = $('rt-scale-rivals');
  rv.textContent = '';
  for (const r of rivals) {
    const d = document.createElement('i');
    d.style.left = pos(r.ms);
    d.title = `LANE ${r.lane}  ${formatReaction(r.ms)}`;
    rv.appendChild(d);
  }
  const me = $('rt-scale-me');
  me.hidden = ms == null;
  if (ms != null) { me.style.left = pos(Math.max(0, ms)); me.classList.toggle('foul', ms < FALSE_START_MS); }
}

function drawBoard(rows) {
  rows.sort((a, b) => (a.ms ?? 1e9) - (b.ms ?? 1e9) || a.lane - b.lane);
  const board = $('rt-board');
  board.textContent = '';
  rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = `board-row${r.who === 'YOU' ? ' me' : ''}${r.ms == null ? ' pending' : ''}`;
    const cell = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; row.appendChild(s); };
    cell('pos', r.ms == null ? '–' : String(i + 1));
    cell('lane', `LANE ${r.lane}`);
    cell('who', r.who);
    cell('time', r.ms == null ? r.foul : formatReaction(r.ms));
    board.appendChild(row);
  });
  const mine = rows.findIndex((r) => r.who === 'YOU');
  $('rt-place').textContent = rows[mine].ms == null ? '' : `${mine + 1} 位 / ${rows.length} 人`;
}

function drawSession() {
  const el = $('rt-session');
  if (!session.length) { el.textContent = ''; return; }
  const best = Math.min(...session);
  const mean = session.reduce((a, b) => a + b, 0) / session.length;
  el.textContent = `今回のセッション：${session.length} 本 ・ ベスト ${formatReaction(best)} ・ 平均 ${formatReaction(mean)}`;
}

// ---------------------------------------------------------------------------
// The signal, shown
function drawScopes(now) {
  const live = sensorLive(now);
  const f = tracker.last;
  const tint = !live ? null : f.level >= 1 ? 'rgba(255, 211, 77, 0.18)' : f.quiet ? 'rgba(182, 255, 60, 0.07)' : null;
  $('scope-dock-box').classList.toggle('live', live);
  const inCall = state === 'call' && live;
  $('call-scope').classList.toggle('show', inCall);
  if (inCall) {
    const cap = proc.phase === 'hold' ? '手の動き　黄の線を超えるとフライング' : '手の動き　緑の線より下で静止';
    if ($('call-scope-cap').textContent !== cap) $('call-scope-cap').textContent = cap;
    scopes[1].setTint(tint);
    scopes[1].draw(now);
  }
  const screen = root.dataset.screen;
  if (live && (screen === 'start' || screen === 'finish')) { scopes[0].setTint(tint); scopes[0].draw(now); }
}

/** The attempt on the result card: the trace around the gun and the moments that decided it. */
function drawWave() {
  const a = attempt, d = a.debug;
  const fired = d.gunAt != null;
  const ref = fired ? d.gunAt : d.trigger;       // centre on the gun, or on the movement if no gun was fired
  const show = d.sensorLive && ref != null;
  $('rt-wave').hidden = !show;
  $('btn-export').hidden = !show;
  if (!show) return;
  const from = fired ? -400 : -700, to = fired ? 600 : 300;
  const th = d.thresholds;
  a.traceRef = ref;
  a.trace = tracker.buf.filter((p) => p.t >= ref + from - 50 && p.t <= ref + to + 50).map((p) => ({ t: p.t, v: [p.dyn / th.moveAcc, p.rot / th.moveGyro] }));
  const marks = [];
  if (fired) marks.push({ at: 0, color: '#ffffff', label: '号砲' });
  const legal = a.type === 'reaction';
  if (d.trigger != null) {
    const at = d.trigger - ref;
    marks.push({ at, color: legal ? '#ffd34d' : '#ff3d6e', label: !fired ? 'ここで動いた（号砲の前）' : `しきい値を超えた ${formatReaction(at)}` });
    if (d.onsetEstimate != null && d.trigger - d.onsetEstimate >= 10) marks.push({ at: d.onsetEstimate - ref, color: '#9fb4d8', dash: true, label: '動き始め', align: 'right' });
  }
  if (d.keyAt != null && d.trigger == null) marks.push({ at: d.keyAt - ref, color: '#ffd34d', label: 'キー' });
  drawReactionPlot($('rt-wave-canvas'), {
    samples: a.trace, t0: ref, from, to, series: SCOPE_SERIES, marks,
    bands: fired ? [{ from: 0, to: FALSE_START_MS, color: 'rgba(227, 23, 62, 0.3)' }] : [],
    lines: [{ y: 1, color: '#ffd34d', label: '動いた' }, { y: th.stillAcc / th.moveAcc, color: '#b6ff3c', label: '静止', dash: true }],
  });
  $('rt-wave-info').textContent = `センサー ${d.sampleRate} Hz ・ 受信の遅れ +${d.deliveryLagMs} ms ・ 音の遅れ補正 ${Math.round(d.audioDelayMs ?? 0)} ms`;
}

/** Save this attempt's numbers and trace, to look at a doubtful decision afterwards. */
function exportAttempt() {
  const a = attempt;
  if (!a || !a.trace) return;
  const ref = a.traceRef;
  const rel = (t) => (t == null ? null : Math.round((t - ref) * 10) / 10);
  const d = a.debug;
  const data = {
    app: 'GAME-SUPER-START', build: window.START_BUILD, savedAt: new Date().toISOString(),
    result: { type: a.type, ms: a.ms, reason: a.reason ?? null },
    // every time below is in ms relative to `zero`
    zero: d.gunAt != null ? 'gun (as heard)' : 'threshold crossing (no gun was fired)',
    times: { steady: rel(d.steadyAt), watchFrom: rel(d.watchSince), gunTriggered: rel(d.gunFiredAt), gunHeard: rel(d.gunAt), thresholdCrossed: rel(d.trigger), movementBeganEstimate: rel(d.onsetEstimate), key: rel(d.keyAt), decided: rel(d.decidedAt) },
    audioDelayMs: d.audioDelayMs, lagOffsetMs: d.lagOffsetMs, sampleRate: d.sampleRate, deliveryLagMs: d.deliveryLagMs, stampsUsable: d.stampsUsable,
    thresholds: d.thresholds, tuning: { ...tuning },
    traceColumns: ['ms', 'acc / moveAcc', 'gyro / moveGyro'],
    trace: a.trace.map((p) => [rel(p.t), +p.v[0].toFixed(3), +p.v[1].toFixed(3)]),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `super-start-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Ranking (this browser only)
let rankingFrom = 'start';
function showRanking(from) {
  rankingFrom = from;
  const list = $('ranking-list');
  list.textContent = '';
  const all = readRanking().sort((a, b) => a.ms - b.ms);
  if (!all.length) {
    const p = document.createElement('p');
    p.className = 'loading-message';
    p.textContent = 'まだ記録がありません / No records yet';
    list.appendChild(p);
  }
  all.forEach((r, i) => {
    const item = document.createElement('div');
    item.className = `ranking-item${attempt && r.at === attempt.savedAt ? ' is-local' : ''}`;
    const add = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; item.appendChild(s); };
    add('rk-rank', String(i + 1));
    add('rk-name', r.name);
    add('rk-grade', gradeReaction(r.ms)?.grade || '');
    add('rk-time', formatReaction(r.ms));
    list.appendChild(item);
  });
  $('ranking-layer').style.display = '';
}
function hideRanking() { $('ranking-layer').style.display = 'none'; }
function saveScore(e) {
  e.preventDefault();
  if (!attempt || attempt.type !== 'reaction' || attempt.savedAt) return;
  const name = $('player-name').value.trim().slice(0, 24);
  if (!name) { $('save-status').textContent = '名前を入れてください'; return; }
  const list = readRanking();
  attempt.savedAt = Date.now();
  list.push({ name, ms: Math.floor(attempt.ms), at: attempt.savedAt });
  list.sort((a, b) => a.ms - b.ms);
  writeRanking(list);
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
  const rank = list.findIndex((r) => r.at === attempt.savedAt) + 1;
  $('save-status').textContent = `登録しました：${rank} 位`;
  $('save-score').disabled = true;
}

// ---------------------------------------------------------------------------
// Per-frame
function update(now, dt) {
  tracker.decay(now);
  const live = sensorLive(now);
  if (gunSeenAt != null && now >= gunSeenAt) onGunSeen();

  if (state === 'call') {
    const watch = proc.watchFrom;
    const on = live && watch != null ? tracker.findOnset(watchSince ?? watch) : null;
    if (on) lastOnset = on;
    // No sensor at all: keyboard play, nothing to hold still. A sensor that was sending a moment
    // ago and has stopped is "lost", and a lost sensor is never taken as still.
    const lost = !live && tracker.inUse(now);
    const events = proc.step(now, {
      stillMs: live ? tracker.stillMs(now) : lost ? 0 : Infinity,
      // The official moment is the one a timing system would use: the signal passing the threshold.
      // (Dating it back to where the movement "began" is fragile: a hand that creeps during the
      // hold makes that look up to 0.15 s earlier, enough to turn a good start into a false one.)
      onsetAt: on ? Math.max(watch, on.trigger - tuning.lagMs) : null,
      keyAt,
    });
    for (const e of events) {
      if (e.type === 'set') onSet();
      else if (e.type === 'steady') onSteady();
      else if (e.type === 'unsteady') onUnsteady();
      else if (e.type === 'fire') onFire(now);
      else if (e.type === 'reaction') onReaction(e.ms, now);
      else onFoul(e, now);
    }
    if (state === 'call' && proc.phase === 'set') {
      const still = live ? tracker.stillMs(now) : lost ? 0 : Infinity;
      const ratio = Math.min(1, Math.min(still, now - proc.setAt) / proc.o.steadyMs);
      const waited = now - proc.setAt;
      setSteady(ratio, lost ? 'センサーの信号が途切れています / SENSOR LOST' : live && waited > 1400 && still < 100 ? '手を止めてください / HOLD STILL' : '静止を確認中 / STEADY…');
    }
  } else if (state === 'run') {
    runT += dt;
    stage.speed = RUN_VMAX * (1 - Math.exp(-runT / TAU_ACCEL));
    stage.rig.position.z -= stage.speed * dt;
    stage.audio.setRace(stage.speed / MAX_SPEED, 1, false);
    if (runT >= RUN_SECONDS) { state = 'result'; resultAt = now; cardShown = false; }
  } else if (state === 'result') {
    const t = (now - resultAt) / 1000;
    const legal = attempt.type === 'reaction';
    if (legal) {
      // a beat of slow motion, then ease down to a jog and stop
      stage.timeScale = t < 0.7 ? 0.3 : Math.min(1, 0.3 + (t - 0.7) * 0.9);
      stage.speed = Math.max(0, stage.speed - (stage.speed * 0.9 + 1.2) * dt * stage.timeScale);
      stage.rig.position.z -= stage.speed * dt * stage.timeScale;
      stage.audio.setRace(stage.speed / MAX_SPEED, 1, false);
    }
    if (!cardShown && t >= (legal ? 0.9 : 1.5)) showCard();
  }

  // dock + drawer indicators
  const f = tracker.last;
  $('check-still').classList.toggle('on', live && !!f && f.quiet);
  $('check-move').classList.toggle('on', live && !!f && f.level >= 1);
  if (now - sensor.rateAt >= 500) {
    // slow audio output (Bluetooth): say so, because it is the first thing to check when the timing feels off
    const delay = stage.audio.ready ? stage.audio.outputDelayMs() : 0;
    const warn = $('audio-warn');
    warn.hidden = delay < 60;
    if (delay >= 60) warn.textContent = `音の出力が約 ${Math.round(delay)} ms 遅れています（Bluetooth イヤホンなど）。号砲の音と画面のフラッシュは同時に出しますが、本体のスピーカーにすると遅れが小さくなります。`;
    sensor.rate = (sensor.samples * 1000) / (now - sensor.rateAt);
    if (sensor.lagN) sensor.lag = sensor.lagSum / sensor.lagN;
    sensor.lagSum = 0; sensor.lagN = 0;
    sensor.samples = 0; sensor.rateAt = now;
    if ($('settings-drawer').classList.contains('open')) drawMonitor(live);
  }
  if ($('settings-drawer').classList.contains('open') && f) {
    const o = tracker.o;
    $('mon-acc-bar').style.width = `${Math.min(100, (f.dyn / (o.moveAcc * 2)) * 100)}%`;
    $('mon-gyro-bar').style.width = `${Math.min(100, (f.rot / (o.moveGyro * 2)) * 100)}%`;
    $('mon-acc-bar').style.background = f.level >= 1 ? '#ff9800' : f.quiet ? '#4caf50' : '#2196f3';
    $('mon-gyro-bar').style.background = $('mon-acc-bar').style.background;
  }
}
function drawMonitor(live) {
  const f = tracker.last, o = tracker.o;
  $('mon-acc').textContent = live && f ? `${f.dyn.toFixed(2)} G` : '--';
  $('mon-gyro').textContent = live && f ? `${f.rot.toFixed(0)} °/s` : '--';
  $('mon-state').textContent = !live ? '未接続 / Not connected' : f.level >= 1 ? '⚡ 動いた / Moving' : f.quiet ? '✋ 静止 / Still' : '… 揺れている / Unsteady';
  $('mon-rate').textContent = live ? `${sensor.rate.toFixed(0)} Hz ・ 受信の遅れ +${sensor.lag.toFixed(0)} ms${sampleClock.usable ? '' : '（時刻は受信時刻）'}` : '-- Hz';
  $('mon-acc-still').style.left = `${(o.stillAcc / (o.moveAcc * 2)) * 100}%`;
  $('mon-gyro-still').style.left = `${(o.stillGyro / (o.moveGyro * 2)) * 100}%`;
  $('mon-acc-move').style.left = '50%';
  $('mon-gyro-move').style.left = '50%';
}

function loop() {
  const now = performance.now();
  const rawDt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;
  update(now, Math.min(rawDt, 0.05));
  drawScopes(now);
  stage.frame(rawDt);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Boot
function bindTuning() {
  const bind = (id, key, fmt) => {
    const el = $(id), out = $(`${id}-value`);
    el.value = String(tuning[key]);
    out.textContent = fmt(tuning[key]);
    el.addEventListener('input', () => { tuning[key] = parseFloat(el.value); out.textContent = fmt(tuning[key]); applyTuning(); });
  };
  bind('still-tol', 'still', (v) => `×${v.toFixed(1)}`);
  bind('move-sens', 'move', (v) => `×${v.toFixed(1)}`);
  bind('lag-offset', 'lagMs', (v) => `${v} ms`);
}

async function boot() {
  stage = await createStage({ canvas: $('game-canvas'), labels: { event: 'SUPER VIRTUAL START', tag: '100m', tagAccent: 'FINAL' } });
  chrome = bindChrome(stage, { coreIds: [0] });
  if (stage.logo) { const img = $('brand-logo'); img.src = stage.logo.toDataURL(); img.hidden = false; }
  attachCore(window.bles?.[0], tracker, sampleClock, onSample);
  scopes = [
    createScope($('scope-dock'), { seconds: 4, series: SCOPE_SERIES, lines: scopeLines() }),
    createScope($('scope-call'), { seconds: 3, series: SCOPE_SERIES, lines: scopeLines() }),
  ];
  // the result card's button saves the raw recording of this attempt (the older trace-only export is the fallback)
  $('btn-export').addEventListener('click', () => { if (!recorder.download()) exportAttempt(); });
  const refreshRec = async () => { $('rec-count').textContent = `保存済み ${await recorder.count()} 件`; };
  $('rec-all').addEventListener('click', () => recorder.downloadAll());
  $('rec-clear').addEventListener('click', async () => { if (window.confirm('このブラウザに保存した生データをすべて消します。よろしいですか？')) await recorder.clear(); });
  recorder.onChange(refreshRec);
  refreshRec();
  bindTuning();

  $('start-btn').addEventListener('click', beginAttempt);
  $('retry').addEventListener('click', beginAttempt);
  $('btn-title').addEventListener('click', toTitle);
  $('btn-ranking').addEventListener('click', () => showRanking('start'));
  $('btn-ranking-finish').addEventListener('click', () => showRanking('finish'));
  $('back-btn').addEventListener('click', hideRanking);
  $('ranking-clear').addEventListener('click', () => { writeRanking([]); showRanking(rankingFrom); });
  $('name-form').addEventListener('submit', saveScore);
  root.addEventListener('audio-ready', () => { if (state === 'title') { stage.audio.setCrowd(0.14, 0); stage.audio.setMusic('title', 2.0); } });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    if (e.code === 'Escape') { if ($('ranking-layer').style.display !== 'none') hideRanking(); else if (state !== 'title') toTitle(); return; }
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    if (e.repeat) return;
    e.preventDefault();
    if ($('ranking-layer').style.display !== 'none') return;
    if (state === 'title') beginAttempt();
    else if (state === 'call') { if (keyAt == null && proc.phase !== 'marks') keyAt = e.timeStamp || performance.now(); }
    else if (state === 'result' && cardShown) beginAttempt();
  });

  toTitle();
  stage.cam.blend = 1;
  stage.warmUp();
  lastFrame = performance.now();
  loop();
  requestAnimationFrame(() => requestAnimationFrame(() => chrome.loadingDone()));
}

// Small read-only window for automated checks and debugging from the console.
window.startDebug = {
  get state() { return state; }, get phase() { return proc.phase; }, get attempt() { return attempt; },
  get session() { return [...session]; }, get history() { return [...attempts]; }, get tuning() { return { ...tuning }; },
  get sensorRate() { return sensor.rate; }, get clockUsable() { return sampleClock.usable; },
  get stage() { return stage; }, tracker, get proc() { return proc; },
  /** Feed one synthetic sample (tests / demos without a sensor). */
  push(s) { const f = tracker.push({ t: performance.now(), ...s }); onSample(f, { x: s.ax, y: s.ay, z: s.az }, { x: s.gx, y: s.gy, z: s.gz }, 0); return f; },
  recorder,
};
window.START_BUILD = new URL(import.meta.url).searchParams.get('v') || 'dev';
console.log(`[START] build ${window.START_BUILD}`);

boot().catch((error) => {
  console.error('[START] failed to start:', error);
  const l = $('loading');
  if (l) { l.classList.add('error'); l.querySelector('.loading-text').textContent = '読み込みに失敗しました。ページを再読み込みしてください / Failed to load'; }
});
