// main.js — SUPER VIRTUAL JUMP: the long jump and the triple jump, in the stadium of SUPER VIRTUAL HURDLE.
//
// Two inputs: stamping = run, and a real vertical jump = jump (the higher the player jumps, the
// further the jumper flies). The sensor scripts in index.html (ORPHE CORE) and
// ../GAME-SUPER-HURDLE/insole.js (ORPHE INSOLE) call window.setAccelPressed() and
// window.jumpSample(); the keyboard and the touch screen stand in for both (the jump key is held
// for as long as the jump lasts).
//
//   jumpdetect.js  take-off, landing and height of a real jump, from acceleration + quaternion
//   rules.js   what the inputs are worth (run-up speed, the board, contacts, the landing, wind)
//   field.js   the runway, the boards and the pit, laid into the stadium
//   poses.js   how the jumper moves
//   audio.js   the crowd's hands and the sounds of board and sand
//   this file  the competition (three rounds against seven rivals), camera, HUD, records
import { createStage, bindChrome, THREE, EYE_H, MAX_SPEED } from '../GAME-SUPER-START/stage.js';
import { createScope } from '../GAME-SUPER-START/scope.js';
import { createRecorder } from '../GAME-SUPER-START/recorder.js';
import { DEVICE, loadInsoleSdk, setupInsole } from '../GAME-SUPER-HURDLE/insole.js';
import { RULES, EVENTS, createAttempt, createWind, createField as createRivals, standings, technique, gradeOf, liftScale } from './rules.js';
import { JumpDetector, SerialClock, flightHeightCm, DETECT_DEFAULTS } from './jumpdetect.js';
import { createField, RX, PIT_Z0 } from './field.js';
import { poseFlight, poseLanded, poseHop, poseStep, poseStance, poseReady, poseSlump, mirror } from './poses.js';
import { JumpAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const BUILD = new URL(import.meta.url).searchParams.get('v') || 'dev';
const params = new URLSearchParams(window.location.search);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const ROUNDS = 3;
const SLOW_ZONE = 0.25;         // the game clock around the board
const SLOW_LAST = 0.15, SLOW_LAST_M = 3.0;  // and over the last metres before the line (a real jump takes a moment to wind up)
const SLOW_AIR = 0.5;           // and in the air
const SLOW_CHARGE = 0.03;       // while the player is really in the air and the height is not known yet
const SLOW_TOUCH = 0.2, SLOW_STANCE = 0.15, TOUCH_LEAD = 0.09;   // around a contact of the triple jump (game s before the touch)
const CLOCK_SEC = 40;           // time allowed on the runway
const QUIET_G = 2.4, QUIET_MS = 220;   // the stamping has to stop for this long before a sensor take-off is listened for
const CHARGE_TIMEOUT_MS = 1400; // a take-off whose landing never comes
const KEY_MAX_HOLD_MS = 900;
const LAND_Q = 0.8;             // how far the legs reach in the landing pose
const GRADE_TEXT = { perfect: ['PERFECT', 'かんぺき'], great: ['GREAT', 'いいぞ'], good: ['GOOD', 'まずまず'], miss: ['MISS', 'おそい…'] };
const GRADE_COLOR = { perfect: 0xffd34d, great: 0xb6ff3c, good: 0x22e3ff, miss: 0xff3d6e };
const BOT = params.get('bot');  // perfect | great | good | foul | miss | none : plays by itself (for checking the game without a sensor)

let stage = null, chrome = null, field = null, audio = null;
let eventKey = params.get('event') === 'triple' || params.get('event') === 'long' ? params.get('event') : store.get('superjump.event', 'long');
if (!EVENTS[eventKey]) eventKey = 'long';
let mode = 'title';             // title | intro | ready | run | landed | replay | measure | between | final
let modeT = 0;                  // real seconds in this mode (the waits between attempts were all cut to 0.8x on 2026-11-23: they felt long)
let comp = null;                // the competition: { event, rivals, marks, results, round, name }
let sim = null, windFn = null, windT = 0;
let ts = 1;                     // time scale of the game clock
let last = performance.now(), frameAt = last;
let clockLeft = CLOCK_SEC, lastClockTick = 99;
let record = [], replay = null; // the attempt as it was shown, for the replay
let landedBody = null, through = null;
let measure = null;
let clap = { next: 0, at: -9, interval: 0.72, n: 0 };
let betweenAuto = 0;
let introState = null;
let lastResult = null;
const view = { pitch: -0.05, fov: 70, fp: false, shot: 0, shotT: 0, raise: 0 };
const rec = createRecorder('super-jump');
const settings = { rec: store.get('superjump.rec', true) !== false, refCm: Math.min(60, Math.max(20, Number(store.get('superjump.refcm', RULES.JUMP_REF_CM)) || RULES.JUMP_REF_CM)) };

// ---------------------------------------------------------------- input
const input = { keyAccel: false, touchAccel: false, sensorAccel: false, sensorAt: -1e9, released: false };
const SENSOR_ACCEL_HOLD_MS = 220, SENSOR_STALE_MS = 500;
window.setAccelPressed = function (pressed) {
  input.sensorAccel = !!pressed;
  if (pressed) input.sensorAt = performance.now();
};
function sensorFresh(now = performance.now()) {
  const d = window.devices;
  return !!d && now - Math.max(d[0].at || 0, d[1].at || 0) < SENSOR_STALE_MS;
}
function accelNow() {
  if (BOT) return botAccel();
  if (input.keyAccel || input.touchAccel) return true;
  const now = performance.now();
  return sensorFresh(now) && (input.sensorAccel || now - input.sensorAt < SENSOR_ACCEL_HOLD_MS);
}
/** Game seconds that have passed since the last frame's step (inputs arrive between frames). */
const ahead = () => Math.min(0.05, Math.max(0, (performance.now() - frameAt) / 1000)) * ts;

// ---- the jump. A real jump arrives in two halves: the feet leave the floor (take-off), and
// when they are back its height is known (launch). Between the two the game all but stops.
//   sensor   jumpdetect.js on each foot; the first foot to leave is the one that is measured
//   key      down = take-off, up = landing: the height is the one of a free flight that long
const jump = { source: null, foot: null, at: 0, cm: null, shownAt: -1e9, armed: false, zoneAt: 0, loudAt: 0, lastTick: 0 };
const detectors = [new JumpDetector(), new JumpDetector()];
const clocks = [new SerialClock(), new SerialClock()];
const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
function resetJump() {
  jump.source = null; jump.foot = null; jump.cm = null; jump.armed = false; jump.shownAt = -1e9;
  for (const d of detectors) d.disarm();
  $('jp-power').classList.remove('show', 'charging', 'locked');
  $('stage').classList.remove('charge');
}
/** The feet left the floor. Returns false when it meant nothing where the jumper is. */
function doTakeoff(source, foot = null, aheadSec = null) {
  if (mode !== 'run' || !sim || jump.source) return false;
  if (source === 'sensor' && sim.phase === 'run' && !jump.armed) return false;   // still stamping
  const ev = sim.takeoff(aheadSec == null ? ahead() : aheadSec);
  if (!ev) return false;
  jump.source = source; jump.foot = foot; jump.at = performance.now(); jump.cm = null; jump.lastTick = 0;
  const el = $('jp-power');
  el.classList.remove('locked'); el.classList.add('show', 'charging');
  $('jp-power-note').textContent = '高く！ / HIGHER';
  rec.event(jump.at, 'jump-takeoff', { source, foot });
  handle(ev);
  return true;
}
/** The feet are back on the floor: the jump was `cm` high. */
function doLaunch(cm, info = {}) {
  if (!jump.source) return false;
  const source = jump.source;
  jump.source = null; jump.foot = null;
  if (mode !== 'run' || !sim) return false;
  const ev = sim.launch(cm);
  if (!ev) return false;
  rec.event(performance.now(), 'jump-measured', { source, cm: r1(cm), ...info });
  handle(ev);
  return true;
}
const keyCm = (now = performance.now()) => Math.min(settings.refCm * 1.6, flightHeightCm((now - jump.at) / 1000));
function releaseJumpKey(source) {
  if (jump.source !== source) return;
  doLaunch(keyCm(), { kind: source, flight: r1((performance.now() - jump.at) / 100) / 10 });
}
/** Enter / the jump key outside the jump itself: on to the next picture. */
function doNav() {
  if (mode === 'between') { nextAttempt(); return true; }
  if (mode === 'replay') { startMeasure(); return true; }
  if (mode === 'landed' && modeT > 0.4) { startReplay(); return true; }
  return false;
}
function jumpKeyDown(source) { if (mode === 'run') doTakeoff(source); else doNav(); }

/** Every sensor sample, with the quaternion of the same sample (CORE: index.html; INSOLE: the wrapper in boot()). */
window.jumpSample = function (id, acc, quat) {
  if (!acc || !quat || (id !== 0 && id !== 1)) return;
  const now = performance.now();
  window.devices[id].quat = quat;
  const t = !insole && acc.serial_number !== undefined && acc.packet_number !== undefined
    ? clocks[id].time(acc.serial_number, acc.packet_number)
    : clocks[id].arrival(now, insole ? 0.01 : 0.02);
  if (Math.hypot(acc.x, acc.y, acc.z) > QUIET_G) jump.loudAt = now;
  const det = detectors[id];
  // the detector only listens where a jump means something: armed at the board, and from the
  // first take-off to the sand
  det.enabled = !BOT && mode === 'run' && !!sim && (sim.phase === 'run' ? jump.armed : sim.phase !== 'landed' && sim.phase !== 'through');
  const r = det.push(t, acc, quat);
  if (!r) return;
  if (r.type === 'takeoff') {
    if (!doTakeoff('sensor', id) && !jump.source) det.disarm();
    return;
  }
  if (jump.source !== 'sensor') return;
  if (jump.foot !== id) {
    // the other foot of the same jump: its landing counts when it is a real impact (the foot that
    // took off first may have lost that sample), nothing else of it does
    if (r.type === 'jump') doLaunch(r.cm, { kind: 'integrated', raw: r1(r.raw), flight: Math.round(r.flight * 1000) / 1000, still: r.still, foot: id, other: true });
    else if (r.type === 'rejected') doLaunch(Math.min(settings.refCm * 1.2, flightHeightCm(r.flight)), { kind: 'flight-time', reason: r.reason, flight: Math.round(r.flight * 1000) / 1000, foot: id, other: true });
    return;
  }
  if (r.type === 'jump') doLaunch(r.cm, { kind: 'integrated', raw: r1(r.raw), flight: Math.round(r.flight * 1000) / 1000, still: r.still, foot: id });
  else if (r.type === 'rejected') doLaunch(Math.min(settings.refCm * 1.2, flightHeightCm(r.flight)), { kind: 'flight-time', reason: r.reason, flight: Math.round(r.flight * 1000) / 1000, foot: id });
  else if (r.type === 'soft') doLaunch(Math.max(RULES.MISS_CM, Math.min(settings.refCm * 1.2, flightHeightCm(r.flight))), { kind: 'soft', flight: Math.round(r.flight * 1000) / 1000, impact: r.impact == null ? null : r1(r.impact), foot: id });
  else if (r.type === 'cancel') doLaunch(RULES.MISS_CM, { kind: 'cancel', foot: id });
};
// The hurdle game's toe-up input (the INSOLE adapter still calls it) means nothing here.
window.gameJump = function () { return false; };

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'a' || k === 'A') { input.keyAccel = true; e.preventDefault(); return; }
  if (e.repeat) return;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') { jumpKeyDown('key'); e.preventDefault(); return; }
  if (k === ' ' || k === 'Enter') {
    e.preventDefault();
    if (mode === 'title') { if ($('ranking-layer').style.display === 'none') startCompetition(); } else if (mode === 'final') { if (finalShown) startCompetition(); } else if (k === ' ' || mode !== 'run') jumpKeyDown('key');
    return;
  }
  if (k === 'Escape') { if (mode !== 'title') toTitle(); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'a' || k === 'A') { input.keyAccel = false; input.released = true; }
  if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === ' ') releaseJumpKey('key');
});
window.addEventListener('blur', () => { input.keyAccel = false; input.touchAccel = false; releaseJumpKey('key'); releaseJumpKey('touch'); });
function bindTouch() {
  const canvas = $('game-canvas');
  const ids = new Map();
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const leftHalf = e.clientX < window.innerWidth / 2;
    ids.set(e.pointerId, leftHalf);
    if (leftHalf) input.touchAccel = true; else jumpKeyDown('touch');
  });
  const up = (e) => {
    if (!ids.has(e.pointerId)) return;
    if (!ids.get(e.pointerId)) releaseJumpKey('touch');
    ids.delete(e.pointerId);
    input.touchAccel = [...ids.values()].some(Boolean);
    if (!input.touchAccel) input.released = true;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}

// ---- the raw signal, as a strip chart (dock on the title screen, corner of the screen while playing)
const SCOPE_OPTS = { seconds: 4, max: 12, series: [{ color: '#35d0ff', label: 'L 加速度' }, { color: '#ff6bb0', label: 'R 加速度' }] };
let scopes = [];
const mag = (a) => (a ? Math.hypot(a.x, a.y, a.z) : 0);
let sensorAt = -1e9, scopeTh = 0;
const PHASE_CODE = { ready: 0, run: 1, air: 2, stance: 3, landed: 4, through: 5, charge: 6 };
/** Called by the sensor callbacks on every sample (CORE: index.html; INSOLE: the wrapper in boot()). */
window.sensorTap = function (id = 0) {
  const d = window.devices;
  if (!d) return;
  const now = performance.now();
  const values = [mag(d[0].acc), mag(d[1].acc)];
  for (const sc of scopes) sc.push(now, values);
  sensorAt = now;
  if (rec.active) {
    const s = d[id], a = s.acc || {}, g = s.gyro || {}, q = s.quat || {};
    const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
    const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null);
    rec.frame(now, [id, r3(a.x), r3(a.y), r3(a.z), r3(g.x), r3(g.y), r3(g.z), r4(q.w), r4(q.x), r4(q.y), r4(q.z),
      sim ? r3(sim.s) : null, sim ? r3(sim.v) : null, sim ? PHASE_CODE[sim.phase] : -1, r3(ts), comp ? comp.round + 1 : 0, a.serial_number ?? null, a.packet_number ?? null]);
  }
};
const FRAME_COLUMNS = ['foot', 'ax_G', 'ay_G', 'az_G', 'gx_dps', 'gy_dps', 'gz_dps', 'qw', 'qx', 'qy', 'qz', 's_m', 'speed_mps', 'phase', 'time_scale', 'attempt', 'serial', 'packet'];
function drawScopes(now) {
  const live = now - sensorAt < 1500;
  $('scope-dock-box').classList.toggle('live', live);
  $('scope-hud-box').classList.toggle('live', live);
  $('check-accel').classList.toggle('on', live && accelNow());
  $('check-jump').classList.toggle('on', live && (now - jump.loudAt < 250 && detectors.some((dt) => dt.state === 'air') || !!jump.source));
  if (!live) return;
  const th = window.accThresholdAccel || 1.1;
  if (th !== scopeTh) {
    scopeTh = th;
    for (const sc of scopes) sc.setLines([{ y: th, color: '#ffffff', label: `足ぶみ ${th.toFixed(1)} G`, dash: true }, { y: DETECT_DEFAULTS.TO_G, color: '#b6ff3c', label: `踏み切り ${DETECT_DEFAULTS.TO_G} G`, dash: true }, { y: DETECT_DEFAULTS.LD_G, color: '#ffd21f', label: `着地 ${DETECT_DEFAULTS.LD_G} G`, dash: true }]);
  }
  const tint = accelNow() ? 'rgba(53, 224, 106, 0.16)' : null;
  for (const sc of scopes) { sc.setTint(tint); sc.draw(now); }
}

let insole = null;

// ---------------------------------------------------------------- the bot (?bot=perfect|great|good|foul)
const BOT_PLAN = { perfect: { loss: 0.02, e: 0, cm: 46 }, great: { loss: 0.09, e: -0.04, cm: 38 }, good: { loss: 0.2, e: -0.075, cm: 28 }, foul: { loss: -0.06, e: 0, cm: 40 }, miss: { loss: 0.3, e: null, cm: 18 }, none: { loss: null, e: null, cm: 0 } }[BOT] || null;
function botAccel() { return mode === 'ready' ? modeT > 3.4 : mode === 'run'; }
function botStep() {
  if (!BOT_PLAN || mode !== 'run' || !sim) return;
  if (jump.source === 'bot') { if (performance.now() - jump.at > 520) doLaunch(BOT_PLAN.cm, { kind: 'bot' }); return; }
  if (BOT_PLAN.loss != null && sim.phase === 'run' && sim.inZone && sim.s + sim.v * (1 / 60) * ts >= -BOT_PLAN.loss) { doTakeoff('bot', null, Math.max(0, (-BOT_PLAN.loss - sim.s) / Math.max(1, sim.v))); return; }
  const f = sim.flight;
  if (sim.phase === 'air' && f && f.i < sim.event.phases.length - 1 && f.input == null && BOT_PLAN.e != null && sim.t - f.t0 >= f.T + BOT_PLAN.e - 0.004) doTakeoff('bot', null, 0);
  if (sim.phase === 'stance' && sim.stance.input == null && BOT_PLAN.e != null) doTakeoff('bot', null, 0);      // a frame skipped the moment
}

// ---------------------------------------------------------------- HUD helpers
function setScreen(name) { chrome.setScreen(name); }
function setMode(next) { mode = next; modeT = 0; $('stage').dataset.mode = next; }
function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function popup(text, kind = 'info', small = '') {
  const layer = $('popup-layer');
  const el = document.createElement('div');
  el.className = `jp-popup ${kind}`;
  el.innerHTML = `<b>${text}</b>${small ? `<span>${small}</span>` : ''}`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1900);
  while (layer.children.length > 3) layer.firstChild.remove();
}
function banner(en, ja = '', cls = '') {
  const b = $('jp-banner');
  $('jp-banner-en').textContent = en; $('jp-banner-ja').textContent = ja;
  b.className = `jp-banner ${cls}`;
  restart(b, 'show');
}
const fmt = (m) => (m == null ? '—' : m.toFixed(2));
const windText = (w) => `${w > 0 ? '+' : w < 0 ? '−' : ''}${Math.abs(w).toFixed(1)}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function playerRow() { return { name: comp.name || 'YOU', nat: '', marks: comp.marks }; }
/** The table of the competition. rivalRounds = how many rounds of the rivals are known. */
function renderBoard(el, rivalRounds, { flash = null, compact = false } = {}) {
  const rows = standings(comp.rivals, playerRow(), rivalRounds);
  el.innerHTML = rows.map((r) => {
    const series = compact ? '' : `<span class="series">${Array.from({ length: ROUNDS }, (_, i) => (i < r.marks.length ? (r.marks[i] == null ? '<i class="x">×</i>' : `<i>${r.marks[i].toFixed(2)}</i>`) : '<i class="none">·</i>')).join('')}</span>`;
    return `<div class="jp-row${r.you ? ' me' : ''}${flash && flash === r.name ? ' flash' : ''}"><span class="pl">${r.best == null ? '–' : r.place}</span><span class="who">${esc(r.name)}${r.nat ? `<small>${r.nat}</small>` : ''}</span>${series}<b>${fmt(r.best)}</b></div>`;
  }).join('');
  return rows;
}
function myPlace(rivalRounds) {
  const rows = standings(comp.rivals, playerRow(), rivalRounds);
  const me = rows.find((r) => r.you);
  return { place: me.best == null ? null : me.place, rows, lead: rows.find((r) => !r.you && r.best != null)?.best ?? null };
}
function bestOf(marks) { return marks.reduce((b, m) => (m != null && (b == null || m > b) ? m : b), null); }
function updateLines(rivalRounds) {
  const ev = EVENTS[comp ? comp.event : eventKey];
  const lead = comp ? bestOf(comp.rivals.flatMap((r) => r.marks.slice(0, rivalRounds))) : null;
  const mine = comp ? bestOf(comp.marks) : null;
  field.setLine('lead', lead, 'TOP');
  field.setLine('best', mine, 'YOU');
  field.setLine('wr', ev.wr, 'WR');
}

// ---------------------------------------------------------------- records
const bestKey = (ev) => `superjump.best.${ev}`;
const rankKey = (ev) => `superjump.rankings.${ev}`;
function updateTitleRecords() {
  const ev = EVENTS[eventKey];
  const b = store.get(bestKey(eventKey));
  $('best-mark').textContent = b ? `${b.toFixed(2)} m` : '—';
  $('wr-mark').textContent = `${ev.wr.toFixed(2)} m`;
  $('title-event-ja').textContent = ev.ja;
  $('title-event-en').textContent = ev.en;
  document.querySelectorAll('#event-switch button').forEach((b2) => { const on = b2.dataset.event === eventKey; b2.classList.toggle('on', on); b2.setAttribute('aria-checked', String(on)); });
  $('stage').dataset.event = eventKey;
}
function setEvent(key) {
  if (!EVENTS[key] || key === eventKey && field.event === key) { updateTitleRecords(); return; }
  eventKey = key;
  store.set('superjump.event', key);
  field.setEvent(key);
  updateLines(0);
  updateTitleRecords();
  placeAtStart();
}
function registerScore(name) {
  if (!comp || !comp.final || comp.final.best == null) return false;
  const list = store.get(rankKey(comp.event), []);
  if (comp.rankId) { const old = list.findIndex((r) => r.id === comp.rankId); if (old >= 0) list.splice(old, 1); }
  comp.rankId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  list.push({ id: comp.rankId, name: name || 'YOU', mark: comp.final.best, wind: comp.final.bestWind, wa: comp.final.windAided, place: comp.final.place, at: new Date().toISOString() });
  list.sort((a, b) => b.mark - a.mark);
  store.set(rankKey(comp.event), list.slice(0, 100));
  return true;
}
function showRanking(from) {
  const list = store.get(rankKey(eventKey), []);
  $('ranking-board').textContent = `${EVENTS[eventKey].ja} · このブラウザの記録`;
  $('ranking-list').innerHTML = list.length ? list.slice(0, 30).map((r, i) => `<div class="ranking-item${comp && r.id === comp.rankId ? ' current' : ''}"><span class="rk-rank">${i + 1}</span><span class="rk-name">${esc(r.name)}</span><span class="rk-wind">${windText(r.wind ?? 0)}${r.wa ? ' 参考' : ''}</span><span class="rk-time">${r.mark.toFixed(2)}</span></div>`).join('') : '<p class="ranking-empty">まだ記録がありません / No records yet</p>';
  $('ranking-layer').style.display = '';
  $('ranking-layer').dataset.from = from;
}

// ---------------------------------------------------------------- flow
function placeAtStart() {
  stage.resetRunner();
  stage.rig.position.set(RX, EYE_H, field.z(-RULES.RUNUP));
}
function resetPresentation() {
  ts = 1; stage.timeScale = 1;
  stage.shiftTarget = 0;
  audio.stopRace();
  field.setRing(null); field.setTape(0, 0); field.setBoardGlow(0); field.judge.show(null);
  stage.world.setGuide(0, false);
  $('stage').classList.remove('slow', 'foul', 'air');
  $('jp-mark').classList.remove('show');
  $('jp-card').classList.remove('show');
  $('jp-intro').classList.remove('show');
  $('jp-meter').classList.remove('show');
  $('jp-boardcam').classList.remove('show');
  resetJump();
  landedBody = null; through = null; measure = null; replay = null;
}
function toTitle() {
  if (rec.active) rec.cancel();
  comp = null; sim = null;
  resetPresentation();
  setMode('title');
  setScreen('start');
  $('stage').classList.remove('settled');
  $('result-card').classList.remove('show');
  chrome.setCinema(false);
  field.clearMarks();
  placeAtStart();
  view.fp = false; view.shot = 0; view.shotT = 0;
  stage.setCam('free', 1.2);
  audio.setMusic('title');
  stage.world.setExcitement(0.2, 0.012);
  stage.world.drawJumbo({ mode: 'title' });
  updateLines(0);
  updateTitleRecords();
  stage.fx.reset();
}
function startCompetition() {
  const name = ($('player-name').value || '').trim().slice(0, 16);
  store.set('superjump.name', name);
  comp = { event: eventKey, rivals: createRivals(eventKey, ROUNDS, (Date.now() ^ (Math.random() * 1e9)) >>> 0), marks: [], results: [], round: 0, name, final: null, rankId: null };
  audio.init();
  audio.ui('start');
  field.clearMarks();
  stage.fx.reset();
  $('result-card').classList.remove('show');
  $('stage').classList.remove('settled');
  setScreen('race');
  $('jp-event').textContent = EVENTS[eventKey].en;
  if (settings.rec) {
    rec.begin({ build: BUILD, event: eventKey, name, sensor: insole ? 'insole' : 'core', thresholds: { accel_G: window.accThresholdAccel, jump_ref_cm: settings.refCm, quiet_G: QUIET_G, detect: DETECT_DEFAULTS }, rules: RULES, phases: PHASE_CODE }, FRAME_COLUMNS);
  }
  audio.setMusic('race');
  beginIntro();
}
/** The rivals jump first in every round: their marks come up one by one, then it is the player's turn. */
function beginIntro() {
  resetPresentation();
  setMode('intro');
  placeAtStart();
  view.fp = false; view.shot = 1; view.shotT = 0;
  stage.setCam('free', 0.8);
  chrome.setCinema(true);
  const r = comp.round;
  introState = { shown: 0, next: 0.72, order: comp.rivals.map((_, i) => i).sort((a, b) => (comp.rivals[a].marks[r] ?? 0) - (comp.rivals[b].marks[r] ?? 0)), done: false };
  $('jp-intro-round').textContent = `ROUND ${r + 1} / ${ROUNDS}`;
  $('jp-intro-list').innerHTML = '';
  $('jp-intro').classList.add('show');
  renderBoard($('jp-board'), r);
  $('jp-attempt').textContent = `${r + 1} / ${ROUNDS}`;
  stage.world.setExcitement(0.3, 0.02);
  stage.world.drawJumbo({ mode: 'text', text: `ROUND ${r + 1}`, sub: `${EVENTS[comp.event].en}  ·  FINAL`, color: '#ffffff' });
  updateLines(r);
}
function updateIntro(dt) {
  const st = introState, r = comp.round;
  st.next -= dt;
  if (st.next > 0) return;
  if (st.shown < st.order.length) {
    const rv = comp.rivals[st.order[st.shown]];
    const m = rv.marks[r];
    const el = document.createElement('div');
    el.className = `jp-intro-row${m == null ? ' x' : ''}`;
    el.innerHTML = `<span>${esc(rv.name)} <small>${rv.nat}</small></span><b>${m == null ? 'FOUL ×' : m.toFixed(2)}</b>`;
    $('jp-intro-list').appendChild(el);
    audio.tick01(st.shown / 7);
    st.shown++;
    st.next = 0.21;
    if (st.shown === st.order.length) {
      st.next = 1.2;
      renderBoard($('jp-board'), r + 1);
      updateLines(r + 1);
      const { lead } = myPlace(r + 1);
      $('jp-intro-target').innerHTML = lead != null ? `トップは <b>${lead.toFixed(2)} m</b>　これを超えろ！` : '';
    }
    return;
  }
  beginReady();
}
function beginReady() {
  $('jp-intro').classList.remove('show');
  resetPresentation();
  setMode('ready');
  sim = createAttempt(comp.event, { wind: 0, refCm: settings.refCm });
  windFn = createWind((Date.now() ^ (comp.round * 7919)) >>> 0);
  windT = Math.random() * 20;
  clockLeft = CLOCK_SEC; lastClockTick = 99;
  record = [];
  input.released = !accelNow();
  placeAtStart();
  view.fp = false; view.shot = 2; view.shotT = 0; view.raise = 0;
  stage.setCam('free', 0.7);
  chrome.setCinema(false);
  clap = { next: 1.0, at: -9, interval: 0.74, n: 0 };
  renderBoard($('jp-board'), comp.round + 1);
  updateLines(comp.round + 1);
  banner(`ATTEMPT ${comp.round + 1}`, `${comp.round + 1} 回目の試技`);
  stage.world.setExcitement(0.35, 0.03);
  stage.world.drawJumbo({ mode: 'text', text: (comp.name || 'YOU').toUpperCase(), sub: `ATTEMPT ${comp.round + 1} / ${ROUNDS}`, color: '#22e3ff' });
  rec.event(performance.now(), 'ready', { attempt: comp.round + 1 });
}

/** Everything the rules report: sounds, pictures, the next state. */
function handle(events) {
  const now = performance.now();
  for (const e of events) {
    if (e.type !== 'phase') rec.event(now, e.type, JSON.parse(JSON.stringify(e)));
    if (e.type === 'start') {
      setMode('run');
      view.fp = true;
      stage.setCam('free', 0.45);
      $('jp-banner').classList.remove('show');
      stage.world.setExcitement(0.55, 0.05);
    } else if (e.type === 'zone') {
      if (!e.armed) { popup('TOO SLOW', 'bad', 'スピードが足りない'); continue; }
      jump.zoneAt = now; jump.armed = false;
      audio.timeWarp(-1);
      stage.view.warp = 1.3;
      $('stage').classList.add('slow');
      restart($('warp-fx'), 'go');
      $('jp-boardcam').classList.add('show');
      banner('TAKE-OFF ZONE', '足ぶみを止めて、板の上で 高くジャンプ！', 'zone');
      stage.world.setExcitement(0.8, 0.12);
    } else if (e.type === 'takeoff') {
      audio.board(e.just, e.foul);
      stage.view.fovKick = 9;
      stage.view.trauma = Math.max(stage.view.trauma, 0.35);
      $('stage').classList.add('air');
      $('jp-banner').classList.remove('show');
      field.setBoardGlow(0);
      stage.world.setGuide(0, false);
      if (e.foul) {
        popup(`+${Math.max(1, Math.round(e.toe * 100))} cm`, 'bad', 'FOUL　ふみこえた');
        $('stage').classList.add('foul');
        field.judge.show(false);
      } else {
        const cm = Math.round(e.loss * 100);
        popup(e.just ? 'JUST!' : `−${cm} cm`, e.just ? 'gold' : cm <= 15 ? 'good' : 'info', e.just ? `ロス ${cm} cm　ぴったり` : `ふみきりロス ${cm} cm`);
        if (e.just) stage.view.flash = 0.25;
      }
      boardCam.frozen = { toe: e.toe, foul: e.foul, at: now };
    } else if (e.type === 'charge') {
      // the player is in the air: the game holds its breath until the height is known
      $('stage').classList.add('charge');
      ts = Math.min(ts, 0.08);
    } else if (e.type === 'height') {
      jump.cm = e.cm; jump.shownAt = now;
      const el = $('jp-power');
      el.classList.remove('charging'); el.classList.add('show', 'locked');
      el.dataset.kind = e.scale >= 1 ? 'gold' : e.scale >= 0.85 ? 'good' : 'low';
      $('jp-power-note').textContent = e.scale >= 1 ? `MAX POWER ×${e.scale.toFixed(2)}` : `POWER ${Math.round(e.scale * 100)}%`;
      popup(`${Math.round(e.cm)} cm`, e.scale >= 1 ? 'gold' : e.scale >= 0.85 ? 'good' : 'info', e.scale >= 1 ? 'ジャンプの高さ　最高！' : 'ジャンプの高さ');
      audio.power(e.scale);
      if (e.scale >= 1) stage.view.flash = 0.22;
      stage.world.pulseLed(0.5 + 0.5 * clamp01(e.scale));
    } else if (e.type === 'phase') {
      const n = EVENTS[comp.event].phases.length, finalPhase = e.i === n - 1;
      $('stage').classList.remove('charge');
      stage.view.fovKick = e.i > 0 ? 6 : 10;
      stage.view.trauma = Math.max(stage.view.trauma, 0.25 + 0.25 * clamp01(e.scale));
      audio.crowdRise(Math.min(3, e.T / SLOW_AIR));
      $('jp-meter').classList.toggle('show', !finalPhase);
      meter.input = null; meter.grade = null;
      if (!finalPhase) $('jp-meter-label').textContent = `${EVENTS[comp.event].phases[e.i + 1]} へ！ 足が地面に着く瞬間に もう一度ジャンプ`;
      $('jp-phase').textContent = comp.event === 'triple' ? EVENTS.triple.phases[e.i] : '';
      if (comp.event === 'triple') restart($('jp-phase'), 'pop');
    } else if (e.type === 'ready-contact') {
      meter.input = e.error;
    } else if (e.type === 'touch') {
      stage.view.trauma = Math.max(stage.view.trauma, 0.3);
    } else if (e.type === 'contact') {
      audio.contact(e.i, e.q);
      const [en, ja] = GRADE_TEXT[e.grade];
      popup(en, e.grade === 'perfect' ? 'gold' : e.grade === 'miss' ? 'bad' : 'good', `${EVENTS.triple.phases[e.i]} → ${EVENTS.triple.phases[e.i + 1]}　${ja}`);
      meter.input = e.error; meter.grade = e.grade;
      if (e.q >= 1) stage.view.flash = 0.18;
      stage.world.kick(0.15 + 0.2 * e.q, 0.1 * e.q);
      stage.world.pulseLed(0.6 + 0.4 * e.q);
    } else if (e.type === 'land') {
      onLand(e);
    } else if (e.type === 'through') {
      onThrough(e);
    }
  }
}
function onLand(r) {
  lastResult = r;
  const power = clamp01(liftScale(r.heights[r.heights.length - 1] ?? 0, r.refCm));
  audio.timeWarp(1);
  audio.sand(0.6 + 0.4 * clamp01(r.speed / 10), true);
  field.burst(r.raw, 0.5 + 0.5 * clamp01(r.speed / 10), 3 + 5 * power);
  field.addMark(r.raw, false);
  field.setRing(null);
  stage.view.trauma = 0.85; stage.view.warp = 0.9;
  $('stage').classList.remove('slow', 'air', 'charge');
  $('jp-boardcam').classList.remove('show');
  $('jp-meter').classList.remove('show');
  landedBody = { s: r.raw, q: LAND_Q, t: 0 };
  setMode('landed');
  stage.world.kick(0.5, 0.3);
  if (r.foul) { audio.foul(); audio.crowdGasp(); } else audio.crowdCheer(0.45);
}
function onThrough(r) {
  lastResult = r;
  through = { s: sim.s, v: sim.v, t: 0 };
  if (ts < 0.9) audio.timeWarp(1);
  $('stage').classList.remove('slow', 'air', 'charge');
  $('stage').classList.add('foul');
  $('jp-boardcam').classList.remove('show');
  $('jp-banner').classList.remove('show');
  field.setBoardGlow(0);
  stage.world.setGuide(0, false);
  field.judge.show(false);
  audio.foul(); audio.crowdGasp();
  popup('FOUL', 'bad', r.reason === 'time' ? '時間切れ' : 'とばずに板をこえた');
  setMode('landed');
}
function startReplay() {
  $('jp-meter').classList.remove('show');
  if (!lastResult || lastResult.reason === 'through' || lastResult.reason === 'time' || record.length < 10) { startMeasure(); return; }
  const from = record.findIndex((f) => f.kind !== 'run');
  const i0 = Math.max(0, from - 1);
  replay = { i: i0, t: Math.max(record[0].t, record[i0].t - 0.42), end: record[record.length - 1].t, hold: 0 };
  while (replay.i > 0 && record[replay.i].t > replay.t) replay.i--;
  setMode('replay');
  view.fp = false;
  stage.setCam('free', 0.001);
  chrome.setCinema(true);
  stage.view.fade = 1;
  $('jp-replay').classList.add('show');
  $('stage').classList.remove('foul');
}
function startMeasure() {
  $('jp-replay').classList.remove('show');
  $('jp-meter').classList.remove('show');
  replay = null;
  const r = lastResult;
  setMode('measure');
  view.fp = false;
  chrome.setCinema(true);
  stage.setCam('free', r.reason === 'through' || r.reason === 'time' ? 0.8 : 0.001);   // no replay came before: glide out of the jumper's eyes
  stage.view.fade = 1;
  const valid = !r.foul;
  measure = { valid, mark: r.mark, raw: r.raw, t: 0, shown: 0, done: false, lastTick: 0, dur: valid ? 1.2 : 0.56 };
  $('stage').classList.toggle('foul', !valid);
  const el = $('jp-mark');
  el.className = `jp-mark show${valid ? '' : ' foul'}`;
  $('jp-mark-value').textContent = valid ? '0.00' : 'FOUL';
  $('jp-mark-unit').textContent = valid ? 'm' : '';
  $('jp-mark-sub').textContent = valid ? '計測中… / MEASURING' : r.reason === 'short' ? '砂場に届かなかった / Short of the pit' : r.reason === 'through' ? 'とばずに板をこえた / Ran through' : r.reason === 'time' ? '時間切れ / Time over' : `踏み切りが ${Math.max(1, Math.round((r.toe || 0) * 100))} cm オーバー / Over the line`;
  if (valid) field.addMark(r.raw, true);
}
function finishMeasure() {
  const r = lastResult, m = measure;
  m.done = true;
  const before = myPlace(comp.round + 1);
  const prevBest = bestOf(comp.marks);
  comp.marks.push(r.foul ? null : r.mark);
  comp.results.push(r);
  const after = myPlace(comp.round + 1);
  field.judge.show(m.valid);
  audio.flag(m.valid);
  if (m.valid) {
    const isBest = prevBest == null || r.mark > prevBest;
    const leads = after.place === 1 && isBest;
    $('jp-mark-value').textContent = r.mark.toFixed(2);
    $('jp-mark-sub').innerHTML = `風 WIND <b>${windText(r.wind)}</b>${r.windAided ? '　追い風参考' : ''}　${leads ? '<em>トップに立った！ / INTO THE LEAD</em>' : isBest ? `<em>${after.place} 位に浮上</em>` : '記録更新ならず'}`;
    restart($('jp-mark'), 'slam');
    audio.mark(leads ? 2 : isBest ? 1 : 0);
    audio.crowdCheer(leads ? 1 : isBest ? 0.7 : 0.35);
    stage.world.kick(leads ? 0.9 : isBest ? 0.5 : 0.2, leads ? 0.5 : 0.2);
    stage.world.pulseLed(1);
    stage.view.flash = leads ? 0.3 : 0.12;
    if (leads) { stage.world.startWave(); stage.fx.fountain(RX - 1.6, PIT_Z0 - 17, 2.2); stage.fx.fountain(RX + 1.6, PIT_Z0 - 17, 2.2); audio.fountain(2.2); }
    if (r.mark >= EVENTS[comp.event].wr && !r.windAided) { popup('WORLD RECORD!', 'gold', '世界記録をこえた！'); for (let i = 0; i < 5; i++) { stage.fx.firework(RX - 20 + Math.random() * 14, field.z(r.raw) - 20 - Math.random() * 30); audio.firework(0.3 + i * 0.35, Math.random() - 0.5); } }
    stage.world.drawJumbo({ mode: 'text', text: `${r.mark.toFixed(2)} m`, sub: `${(comp.name || 'YOU').toUpperCase()}  ·  WIND ${windText(r.wind)}`, color: leads ? '#ffd34d' : '#ffffff' });
  } else {
    audio.foul();
    stage.world.drawJumbo({ mode: 'text', text: 'FOUL', sub: (comp.name || 'YOU').toUpperCase(), color: '#ff3d6e' });
  }
  renderBoard($('jp-board'), comp.round + 1, { flash: playerRow().name });
  updateLines(comp.round + 1);
  rec.event(performance.now(), 'mark', { attempt: comp.round + 1, mark: r.foul ? null : r.mark, place: after.place, before: before.place });
  m.cardAt = m.t + (m.valid ? 1.85 : 1.2);
}
function showCard() {
  const r = lastResult, tech = technique(r, comp.event);
  const rows = [];
  const bar = (label, value, text, cls = '') => rows.push(`<div class="jp-stat ${cls}"><span>${label}</span><div class="jp-bar"><i style="width:${Math.round(value)}%"></i></div><b>${text}</b></div>`);
  bar('助走スピード <small>RUN-UP</small>', tech.speed, `${(r.speed || 0).toFixed(2)} m/s`);
  if (r.reason === 'through' || r.reason === 'time') bar('踏み切り <small>BOARD</small>', 0, '—', 'bad');
  else if (r.reason === 'line') bar('踏み切り <small>BOARD</small>', 0, `+${Math.max(1, Math.round(r.toe * 100))} cm`, 'bad');
  else bar('踏み切り <small>BOARD</small>', tech.board, r.just ? `JUST −${Math.round(r.loss * 100)} cm` : `−${Math.round(r.loss * 100)} cm`, r.just ? 'gold' : '');
  if (comp.event === 'triple' && r.contacts && r.contacts.length) {
    bar('リズム <small>HOP・STEP・JUMP</small>', tech.rhythm, r.contacts.map((c) => GRADE_TEXT[c.grade][0]).join(' · '));
  }
  if (r.heights && r.heights.length) bar('ジャンプの高さ <small>JUMP HEIGHT</small>', tech.height, `${r.heights.map((h) => Math.round(h)).join(' · ')} cm`, tech.height >= 100 ? 'gold' : tech.height < 50 ? 'bad' : '');
  $('jp-card-stats').innerHTML = rows.join('');
  const phases = comp.event === 'triple' && r.phases && r.phases.length === 3 && !r.foul
    ? `<div class="jp-phases">${r.phases.map((p, i) => `<span style="flex:${p.toFixed(2)}"><small>${EVENTS.triple.phases[i]}</small>${p.toFixed(2)}</span>`).join('')}</div>` : '';
  $('jp-card-phases').innerHTML = phases;
  $('jp-card-title').textContent = `ATTEMPT ${comp.round + 1} / ${ROUNDS}`;
  $('jp-card-mark').innerHTML = r.foul ? '<b class="x">FOUL</b>' : `<b>${r.mark.toFixed(2)}</b><i>m</i><small>風 ${windText(r.wind)}</small>`;
  $('jp-card-tip').textContent = tipFor(r, tech);
  const lastOne = comp.round + 1 >= ROUNDS;
  $('jp-card-next').innerHTML = lastOne ? '結果発表へ <kbd>Enter</kbd>' : `${comp.round + 2} 回目へ <kbd>Enter</kbd>`;
  $('jp-card').classList.add('show');
  setMode('between');
  betweenAuto = 7.2;
  stage.shiftTarget = -0.1;
  chrome.setCinema(false);
}
function tipFor(r, tech) {
  if (r.reason === 'through') return '板の手前の光るゾーンで足ぶみを止めて、その場で高くジャンプ！';
  if (r.reason === 'time') return '助走路に立ったら、40 秒以内に足ぶみで走り出そう。';
  if (r.reason === 'line') return '攻めすぎ！ 光の線より手前で跳ぶ。少し早めに踏み切ろう。';
  if (r.reason === 'short') return '砂場に届かなかった。助走のスピードと、ジャンプの高さの両方が必要。';
  if (tech.speed < 75) return '助走で足ぶみが止まると失速する。ゾーンに入るまで全力で。';
  if (tech.height < 70) return `ジャンプが低い（基準は ${r.refCm} cm）。しっかり沈んで、腕を振り上げて真上に跳ぼう。`;
  if (r.loss > 0.25) return `踏み切りが ${Math.round(r.loss * 100)} cm 手前。その分だけ記録を損している。もっと板に近づけ！`;
  if (comp.event === 'triple' && tech.rhythm < 70) return '足が地面に着く「瞬間」に次のジャンプ。ホップ・ステップ・ジャンプ のリズムで。';
  if (r.wind < 0) return '向かい風だった。追い風を待ってから走り出すのも技術のうち。';
  return 'いい跳躍！ あとは板にどこまで寄せられるか、どこまで高く跳べるか。';
}
function nextAttempt() {
  if (mode !== 'between') return;
  $('jp-card').classList.remove('show');
  $('jp-mark').classList.remove('show');
  audio.ui('click');
  comp.round++;
  if (comp.round >= ROUNDS) beginFinal(); else beginIntro();
}

// ---------------------------------------------------------------- the result
let finalShown = false, finalT = 0, fireAt = 0;
const MEDAL = [null, ['GOLD', '優勝', '#ffd34d'], ['SILVER', '2 位', '#dfe6f2'], ['BRONZE', '3 位', '#f0a15a']];
function beginFinal() {
  resetPresentation();
  setMode('final');
  finalShown = false; finalT = 0; fireAt = 0.6;
  const rows = standings(comp.rivals, playerRow(), ROUNDS);
  const me = rows.find((r) => r.you);
  const bi = comp.marks.reduce((b, m, i) => (m != null && (b < 0 || m > comp.marks[b]) ? i : b), -1);
  const br = bi >= 0 ? comp.results[bi] : null;
  const legalBest = bestOf(comp.results.filter((r) => !r.foul && !r.windAided).map((r) => r.mark));
  const oldBest = store.get(bestKey(comp.event));
  const newBest = legalBest != null && (oldBest == null || legalBest > oldBest);
  if (newBest) store.set(bestKey(comp.event), legalBest);
  comp.final = { legalBest, place: me.best == null ? 8 : me.place, best: me.best, bestWind: br ? br.wind : 0, windAided: !!(br && br.windAided), newBest, rows, tech: br ? technique(br, comp.event) : null, bestResult: br };
  if (comp.name) registerScore(comp.name);
  setScreen('finish');
  chrome.setCinema(true);
  view.fp = false; view.shot = 0; view.shotT = 0;
  stage.setCam('free', 1.0);
  const medal = comp.final.best != null && comp.final.place <= 3;
  audio.setMusic('result');
  audio.fanfare(medal ? 1 : 0);
  audio.crowdCheer(medal ? 1 : 0.4);
  stage.world.setExcitement(medal ? 0.95 : 0.4, medal ? 0.4 : 0.05);
  if (medal) stage.world.startWave();
  stage.world.drawJumbo({ mode: 'text', text: comp.final.best == null ? 'NO MARK' : `${comp.final.best.toFixed(2)} m`, sub: comp.final.best == null ? (comp.name || 'YOU').toUpperCase() : `${ordinal(comp.final.place)} PLACE  ·  ${(comp.name || 'YOU').toUpperCase()}`, color: medal ? '#ffd34d' : '#ffffff' });
  const run = rec.active ? rec.end({ event: comp.event, name: comp.name, marks: comp.marks, place: comp.final.place, best: comp.final.best, results: comp.results }) : null;
  if (run) run.then(() => refreshRecCount());
  // the hero stands by the pit
  stage.rig.position.set(RX - 0.3, EYE_H, field.z(-3.5));
  stage.shiftTarget = 0.23;
}
function ordinal(n) { return `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`; }
function showFinalCard() {
  finalShown = true;
  const f = comp.final, ev = EVENTS[comp.event];
  $('rt-tag').textContent = `${ev.en} · FINAL`;
  $('rt-badge').classList.toggle('show', f.newBest);
  $('rt-badge').textContent = f.newBest && f.legalBest !== f.best ? `NEW PERSONAL BEST ${f.legalBest.toFixed(2)}` : 'NEW PERSONAL BEST';
  $('rc-mark').textContent = f.best == null ? 'NM' : f.best.toFixed(2);
  $('rc-unit').textContent = f.best == null ? '' : 'm';
  $('rc-sub').innerHTML = f.best == null ? '記録なし（3 回ともファウル）' : `風 ${windText(f.bestWind)}${f.windAided ? '　<b>追い風参考</b>（自己ベスト・公認記録にはなりません）' : ''}　／　世界記録 ${ev.wr.toFixed(2)} まで あと ${Math.max(0, ev.wr - f.best).toFixed(2)} m`;
  const medal = f.best != null && f.place <= 3 ? MEDAL[f.place] : null;
  $('rc-medal').dataset.place = f.best == null ? 0 : f.place;
  $('rc-place').textContent = f.best == null ? '–' : f.place;
  $('rc-place-suffix').textContent = f.best == null ? '' : ordinal(f.place).slice(-2);
  $('rc-medal-label').textContent = medal ? medal[0] : f.best == null ? 'NO MARK' : `${f.place} 位 / 8`;
  $('rc-series').innerHTML = comp.marks.map((m, i) => `<span class="${m == null ? 'x' : m === f.best ? 'best' : ''}"><small>${i + 1}</small>${m == null ? '×' : m.toFixed(2)}</span>`).join('');
  const t = f.tech;
  const stat = (label, v) => `<div class="jp-stat"><span>${label}</span><div class="jp-bar"><i style="width:${v}%"></i></div><b>${v}</b></div>`;
  $('rc-tech').innerHTML = t ? [stat('助走スピード', t.speed), stat('踏み切り', t.board), ...(comp.event === 'triple' ? [stat('リズム', t.rhythm)] : []), stat('ジャンプの高さ', t.height)].join('') + `<div class="jp-total">TECHNIQUE <b>${t.total}</b><small>/100　いちばん良かった試技</small></div>` : '<p class="jp-none">有効な試技がありませんでした。</p>';
  renderBoard($('rc-board'), ROUNDS);
  $('result-name').value = comp.name || '';
  $('save-status').textContent = comp.rankId ? '登録済み ✓' : '';
  $('btn-raw').hidden = !rec.last;
  $('result-card').classList.add('show');
  $('stage').classList.add('settled');
  chrome.setCinema(false);
}
async function refreshRecCount() {
  const n = await rec.count();
  for (const id of ['rec-count', 'rec-count-dock']) { const el = $(id); if (el) el.textContent = n ? `保存済み ${n} 件` : ''; }
}

// ---------------------------------------------------------------- the body and the camera
const tmpV = new THREE.Vector3();
const LOOK = new THREE.Vector3();
/** What the jumper is doing right now, from the rules. */
function bodyNow() {
  if (!sim || mode === 'title' || mode === 'intro' || mode === 'final') return { kind: mode === 'final' ? 'cheer' : 'ready', s: -RULES.RUNUP, y: 0 };
  if (through) return { kind: 'slump', s: through.s, y: 0, v: through.v };
  if (landedBody) return { kind: 'landed', s: landedBody.s, y: 0, q: landedBody.q, w: clamp01(landedBody.t / 0.4), last: true, tj: comp.event === 'triple' };
  const tj = comp.event === 'triple';
  if (sim.phase === 'ready') return { kind: 'ready', s: sim.s, y: 0 };
  if (sim.phase === 'run') return { kind: 'run', s: sim.s, y: 0, v: sim.v };
  if (sim.phase === 'charge') {
    // the moment of the take-off, held while the player is in the air
    const c = sim.charge, n = sim.event.phases.length;
    return { kind: c.i === n - 1 ? 'flight' : c.i === 0 ? 'hop' : 'step', s: sim.s, y: 0, u: 0, q: LAND_Q, tj, v: c.vh, charge: true };
  }
  if (sim.phase === 'air') {
    const f = sim.flight, u = clamp01((sim.t - f.t0) / f.T), n = sim.event.phases.length;
    if (f.i === n - 1) return { kind: 'flight', s: sim.s, y: sim.y, u, q: LAND_Q, tj, v: f.vh };
    return { kind: f.i === 0 ? 'hop' : 'step', s: sim.s, y: sim.y, u, v: f.vh };
  }
  if (sim.phase === 'stance') return { kind: 'stance', s: sim.s, y: sim.y, i: sim.stance.i, w: clamp01((sim.t - sim.stance.t0) / RULES.TRIPLE.stance), v: sim.stance.vh };
  return { kind: 'ready', s: sim.s, y: 0 };
}
let body = { kind: 'ready', s: -RULES.RUNUP, y: 0 };
function heroPose(P) {
  const b = body, t = stage.time;
  switch (b.kind) {
    case 'ready': {
      const age = t - clap.at;
      const c = view.raise > 0.02 ? Math.pow(Math.abs(Math.cos(Math.PI * clamp01(age / clap.interval))), 5) : 0;
      poseReady(P, t, view.raise, c);
      break;
    }
    case 'flight': poseFlight(P, b.u, b.q); if (b.tj) mirror(P); break;
    case 'hop': poseHop(P, b.u); break;
    case 'step': poseStep(P, b.u); break;
    case 'stance': poseStance(P, b.i, b.w); break;
    case 'landed': poseLanded(P, b.w, b.q); if (b.tj) mirror(P); break;
    case 'slump': poseSlump(P, Math.PI * stage.view.stepPhase); break;
    case 'cheer': {
      poseReady(P, t * 0.6, comp && comp.final && comp.final.best != null && comp.final.place <= 3 ? 1 : 0, 0.2 + 0.2 * Math.sin(t * 5));
      break;
    }
    default: break;        // 'run': the sprint cycle the stage already posed
  }
}
function placeBody() {
  const b = body;
  const drop = comp && comp.event === 'triple' ? RULES.TRIPLE.drop : RULES.LONG.drop;
  const y = b.kind === 'landed' ? -drop * (1 - b.w) * 0.93 : Math.max(-drop, b.y || 0);
  if (mode !== 'final') stage.rig.position.set(RX, EYE_H + y, field.z(b.s));
  stage.speed = b.kind === 'run' || b.kind === 'slump' ? b.v || 0 : 0;
}

const TITLE_SHOTS = [
  // low over the sand, looking back up the runway at the jumper
  (t, p, l) => { p.set(RX + 0.9 - 0.05 * t, 0.55 + 0.02 * t, PIT_Z0 - 6.5 + 0.25 * t); l.set(RX - 0.2, 1.0, PIT_Z0 + 30); return 34; },
  // a crane over the pit and the board
  (t, p, l) => { p.set(RX - 7 + 0.3 * t, 6.5 - 0.15 * t, PIT_Z0 + 9 - 0.5 * t); l.set(RX + 1.5, 0.3, PIT_Z0 - 2); return 46; },
  // behind the jumper at the start of the runway
  (t, p, l) => { const z = field.z(-RULES.RUNUP); p.set(RX - 1.3 + 0.06 * t, 1.9 + 0.02 * t, z + 3.6 - 0.1 * t); l.set(RX + 0.1, 1.1, z - 12); return 50; },
];
const SHOT_SECONDS = 9;
function cameraWork(dt) {
  const cam = stage.freeCam;
  const b = body;
  const k = clamp01(stage.speed / MAX_SPEED);
  stage.hero.head.visible = !view.fp;
  field.setLabels(view.fp);
  stage.footsteps = b.kind === 'run' || b.kind === 'slump';
  if (view.fp) {
    // through the jumper's eyes: the camera sits in the head of the figure
    stage.hero.root.updateMatrixWorld(true);
    tmpV.set(0, 0.12, -0.09);
    stage.hero.head.localToWorld(tmpV);
    let pitch = -0.1, fov = 70 + 12 * Math.pow(k, 1.5);
    if (b.kind === 'run' && sim && sim.inZone) { pitch = -0.4; fov = 66; }
    else if (b.kind === 'flight') { pitch = lerp(0.02, -0.62, smooth((b.u - 0.25) / 0.6)); fov = 80; }
    else if (b.kind === 'hop' || b.kind === 'step' || b.kind === 'stance') { pitch = -0.36; fov = 76; }
    else if (b.kind === 'landed') { pitch = lerp(-0.62, -0.2, smooth((landedBody ? landedBody.t : 0) / 0.9)); fov = 72; }
    else if (b.kind === 'ready') { pitch = -0.06; fov = 62; }
    if (b.charge) { pitch = 0.16; fov = 60; }               // eyes up: the jump is happening for real
    view.pitch += (pitch - view.pitch) * Math.min(1, dt * (b.kind === 'flight' ? 9 : 5));
    view.fov += (fov - view.fov) * Math.min(1, dt * 5);
    cam.pos.copy(tmpV);
    cam.look.set(tmpV.x, tmpV.y + Math.sin(view.pitch) * 10, tmpV.z - Math.cos(view.pitch) * 10);
    cam.fov = view.fov + stage.view.fovKick;
    stage.view.warp = Math.max(stage.view.warp, 0.75 * clamp01((b.v || 0) / MAX_SPEED));     // the speed blur of first person
    return;
  }
  view.shotT += dt;
  const rz = stage.rig.position.z, ry = stage.rig.position.y - EYE_H;
  if (mode === 'title' || mode === 'intro') {
    if (view.shotT > SHOT_SECONDS) { view.shotT = 0; view.shot = (view.shot + 1) % TITLE_SHOTS.length; stage.view.fade = 1; }
    cam.fov = TITLE_SHOTS[view.shot % TITLE_SHOTS.length](view.shotT, cam.pos, cam.look);
  } else if (mode === 'ready') {
    // in front of the jumper: the face, the clapping hands, the stand behind
    const t = view.shotT;
    cam.pos.set(RX - 1.5 + 0.12 * t, 1.25 + 0.05 * t, rz - 3.9 + 0.1 * t);
    cam.look.set(RX + 0.1, 1.42, rz);
    cam.fov = 44;
  } else if (mode === 'replay') {
    // television: high on the infield side, a long lens following the jump
    cam.pos.set(RX - 6.6, 2.5, rz + 2.2);
    LOOK.set(RX, 0.95 + ry * 0.6, rz - 0.7);
    cam.look.lerp(LOOK, Math.min(1, dt * 10));
    if (modeT < 0.05) cam.look.copy(LOOK);
    cam.fov = 26;
  } else if (mode === 'measure' || mode === 'between' || mode === 'landed') {
    const zm = field.z(lastResult && lastResult.raw != null ? lastResult.raw : 1.5);
    const a = 0.25 + 0.05 * modeT;
    cam.pos.set(RX - 2.7 - 0.5 * Math.sin(a), 1.0, zm + 3.4 * Math.cos(a));
    cam.look.set(RX + 0.2, 0.35, zm + 0.8);
    cam.fov = 50;
  } else if (mode === 'final') {
    // in front of the jumper, swaying from side to side (the runway corridor is too narrow to circle)
    const a = 0.75 * Math.sin(finalT * 0.28 + 0.6);
    const px = stage.rig.position.x, pz = stage.rig.position.z;
    cam.pos.set(px - 3.7 * Math.sin(a), 1.25 + 0.2 * Math.sin(finalT * 0.3), pz - 3.7 * Math.cos(a));
    cam.look.set(px, 0.98, pz);
    cam.fov = 46;
  }
}

// ---------------------------------------------------------------- the take-off camera (side view of the board) and the contact meter
const boardCam = { frozen: null };
function drawBoardCam(now) {
  const el = $('jp-boardcam');
  if (!el.classList.contains('show') || !sim) return;
  const canvas = $('boardcam-canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  const FROM = -2.6, TO = 0.5;                    // metres from the foul line shown in the window
  const X = (m) => ((m - FROM) / (TO - FROM)) * w;
  const ground = h * 0.7;
  ctx.clearRect(0, 0, w, h);
  // runway, board, plasticine
  ctx.fillStyle = '#7d2a22'; ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = '#f4f2ea'; ctx.fillRect(X(-0.2), ground, X(0) - X(-0.2), h - ground);
  ctx.fillStyle = '#ff5a1f'; ctx.fillRect(X(0), ground, X(0.1) - X(0), h - ground);
  ctx.fillStyle = 'rgba(255, 61, 110, 0.16)'; ctx.fillRect(X(0), 0, w - X(0), ground);
  // ruler
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `${11 * dpr}px "Bebas Neue", sans-serif`;
  for (let cm = -250; cm <= 50; cm += 10) {
    const x = X(cm / 100), major = cm % 50 === 0;
    ctx.fillStyle = cm > 0 ? 'rgba(255,120,140,0.8)' : 'rgba(255,255,255,0.55)';
    ctx.fillRect(x - dpr * 0.5, ground - (major ? 9 : 4) * dpr, dpr, (major ? 9 : 4) * dpr);
    if (major && cm !== 0) ctx.fillText(`${cm > 0 ? '+' : '−'}${Math.abs(cm)}`, x, ground + 4 * dpr);
  }
  // the foul line
  ctx.fillStyle = '#9fffe0'; ctx.fillRect(X(0) - dpr, 0, 2 * dpr, h);
  ctx.fillStyle = '#9fffe0'; ctx.textBaseline = 'top'; ctx.textAlign = 'right';
  ctx.fillText('FOUL LINE ▸', X(0) - 6 * dpr, 4 * dpr);
  // the shoe: the toe is the number that counts
  const fz = boardCam.frozen;
  const toe = fz ? fz.toe : sim.s;
  const lift = fz ? Math.min(1, (now - fz.at) / 500) : 0;
  const tx = X(toe), sy = ground - lift * h * 0.34, L = (X(0.3) - X(0));
  ctx.save();
  ctx.translate(tx, sy);
  ctx.rotate(-lift * 0.5);
  ctx.fillStyle = fz ? (fz.foul ? '#ff3d6e' : '#b6ff3c') : '#22e3ff';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-L, 0); ctx.lineTo(-L, -L * 0.42); ctx.quadraticCurveTo(-L * 0.55, -L * 0.5, -L * 0.42, -L * 0.3); ctx.quadraticCurveTo(-L * 0.1, -L * 0.24, 0, -L * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  if (toe < FROM) { ctx.fillStyle = '#22e3ff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `${14 * dpr}px "Bebas Neue", sans-serif`; ctx.fillText(`▸▸  あと ${(-toe).toFixed(1)} m`, 8 * dpr, ground * 0.5); }
  if (fz) {
    ctx.fillStyle = fz.foul ? '#ff3d6e' : '#b6ff3c';
    ctx.fillRect(tx - dpr, 0, 2 * dpr, ground);
    ctx.font = `${26 * dpr}px "Bebas Neue", sans-serif`; ctx.textAlign = fz.foul ? 'left' : 'right'; ctx.textBaseline = 'middle';
    const cm = Math.round(Math.abs(fz.toe) * 100);
    ctx.fillText(fz.foul ? `+${Math.max(1, cm)} cm  FOUL` : `−${cm} cm`, tx + (fz.foul ? 8 : -8) * dpr, ground * 0.42);
    if (now - fz.at > 520) el.classList.remove('show');
  }
}
const meter = { input: null, grade: null };
const METER_FROM = -0.55, METER_TO = 0.2;
function drawMeter() {
  const el = $('jp-meter');
  el.classList.toggle('up', $('jp-boardcam').classList.contains('show'));
  if (!el.classList.contains('show') || !sim) return;
  const pct = (e) => `${clamp01((e - METER_FROM) / (METER_TO - METER_FROM)) * 100}%`;
  const c = sim.nextContact;
  let e = null;
  if (c) e = -c.in; else if (sim.stance) e = sim.t - sim.stance.t0;
  if (e != null) $('jp-meter-dot').style.left = pct(e);
  $('jp-meter-dot').style.opacity = e == null || e < METER_FROM ? 0.25 : 1;
  const tick = $('jp-meter-tick');
  tick.style.display = meter.input == null ? 'none' : 'block';
  if (meter.input != null) { tick.style.left = pct(meter.input); tick.dataset.grade = meter.grade || gradeOf(meter.input).key; }
}
/** The height of the real jump: climbing with the time in the air, then the measured value. */
function drawPower(now) {
  const el = $('jp-power');
  if (!el.classList.contains('show')) return;
  const ref = settings.refCm, top = ref * 1.5;
  let cm;
  if (jump.source) {
    cm = Math.min(top, flightHeightCm((now - jump.at) / 1000));
    if (now - jump.lastTick > 70) { jump.lastTick = now; audio.tick01(clamp01(cm / top)); }
  } else {
    cm = jump.cm ?? 0;
    if (now - jump.shownAt > 1700) { el.classList.remove('show', 'locked'); return; }
  }
  $('jp-power-fill').style.height = `${clamp01(cm / top) * 100}%`;
  $('jp-power-cm').textContent = String(Math.round(cm));
  el.classList.toggle('over', cm >= ref);
}
function layoutMeter() {
  const span = METER_TO - METER_FROM;
  for (const g of RULES.GRADES) {
    const el = $(`jp-meter-${g.key}`);
    el.style.left = `${((-g.max - METER_FROM) / span) * 100}%`;
    el.style.width = `${((2 * g.max) / span) * 100}%`;
  }
  $('jp-meter-zero').style.left = `${((0 - METER_FROM) / span) * 100}%`;
}

// ---------------------------------------------------------------- per-frame
function tickClap(dt, interval, size, own) {
  clap.interval = interval;
  clap.next -= dt;
  if (clap.next > 0) return;
  clap.next += interval;
  clap.at = stage.time;
  clap.n++;
  audio.clap(size);
  if (own) audio.handClap();
  stage.world.pulseLed(0.35 + 0.4 * size);
}
function update(now, dt) {
  modeT += dt;
  if (BOT) botStep();
  let tsTarget = 1;

  if (mode === 'title') {
    body = { kind: 'ready', s: -RULES.RUNUP, y: 0 };
    view.raise += (0 - view.raise) * Math.min(1, dt * 4);
  } else if (mode === 'intro') {
    body = { kind: 'ready', s: -RULES.RUNUP, y: 0 };
    updateIntro(dt);
  } else if (mode === 'ready') {
    windT += dt;
    sim.wind = windFn(windT);
    // the first seconds: seen from the front, hands overhead; then through the jumper's eyes
    const front = modeT < 2.4;
    if (view.fp === front) { view.fp = !front; stage.setCam('free', 0.9); if (!front) $('jp-banner').classList.remove('show'); }
    view.raise += ((front && modeT > 0.4 ? 1 : 0) - view.raise) * Math.min(1, dt * 5);
    if (modeT > 0.72) tickClap(dt, 0.74, Math.min(0.75, 0.25 + clap.n * 0.07), front);
    if (!accelNow()) input.released = true;
    clockLeft -= dt;
    const sec = Math.ceil(clockLeft);
    if (sec <= 10 && sec !== lastClockTick && sec >= 0) { lastClockTick = sec; audio.clockTick(sec === 0); }
    if (clockLeft <= 0) {
      sim.phase = 'through';
      sim.result = { foul: true, reason: 'time', mark: null, speed: 0, loss: null, toe: null, wind: sim.wind, contacts: [], phases: [] };
      rec.event(now, 'through', { reason: 'time' });
      onThrough(sim.result);
      through.v = 0;
    } else if (modeT > 1.3 && input.released && accelNow()) {
      handle(sim.step(dt, true));
    }
    body = bodyNow();
  } else if (mode === 'run') {
    const preTakeoff = sim.phase === 'run';
    if (preTakeoff) { windT += dt; sim.wind = windFn(windT); }
    // around the board the clock slows, and slows again for the last two metres: the moment to aim
    if (sim.phase === 'run') {
      const zone = sim.inZone && sim.v >= RULES.MIN_RUN;
      tsTarget = zone ? (sim.s > -SLOW_LAST_M ? SLOW_LAST : SLOW_ZONE) : 1;
      // a sensor take-off is listened for once the stamping has stopped (a stamp is as hard as a take-off)
      if (zone && !jump.armed && (!sensorFresh(now) || now - Math.max(jump.zoneAt, jump.loudAt) > QUIET_MS)) {
        jump.armed = true;
        for (const d of detectors) d.disarm();
        banner('JUMP!', 'いまだ！ 高くジャンプ！', 'zone go');
      }
    } else if (sim.phase === 'charge') {
      tsTarget = SLOW_CHARGE;
    } else if (sim.phase === 'stance') {
      tsTarget = sim.stance.input != null ? 0.4 : SLOW_STANCE;      // the ground waits for the jump
    } else {
      const c = sim.nextContact;
      tsTarget = c && !c.final && c.in < TOUCH_LEAD && sim.flight.input == null ? SLOW_TOUCH : SLOW_AIR;
    }
    // a take-off whose landing never comes (a stamp taken for a jump, a key that stays down)
    if (jump.source === 'sensor' && now - jump.at > CHARGE_TIMEOUT_MS) { const f = jump.foot; doLaunch(RULES.MISS_CM, { kind: 'timeout', foot: f }); if (f != null) detectors[f].disarm(); }
    if ((jump.source === 'key' || jump.source === 'touch') && now - jump.at > KEY_MAX_HOLD_MS) releaseJumpKey(jump.source);
    // (the clock is eased below; the step uses the eased value)
    const ev = sim.step(dt * ts, accelNow());
    if (ev.length) handle(ev);
    if (mode === 'run') {
      body = bodyNow();
      if (sim.phase === 'run' && !sim.inZone) {
        const k = clamp01(sim.v / 9.8);
        tickClap(dt, lerp(0.6, 0.21, k), 0.5 + 0.5 * k, false);
        stage.world.setExcitement(0.45 + 0.4 * k, 0.05 + 0.1 * k);
        // the take-off zone, drawn on the runway from far away
        const zl = field.z(0);
        stage.world.setGuide(0, true, RX, zl + RULES.ZONE, zl, 0, 0.9);
        field.setBoardGlow(0.5 + 0.5 * Math.sin(stage.time * 6) * 0.3);
      } else if (sim.phase === 'run') {
        const zl = field.z(0);
        stage.world.setGuide(0, true, RX, zl + RULES.ZONE, zl, 1, 1);
        field.setBoardGlow(1);
      }
      // where the foot comes down next
      const c = sim.nextContact;
      if (c) field.setRing(c.s + (c.final ? (comp.event === 'triple' ? RULES.TRIPLE.reach : 0) : 0), clamp01(c.in / c.T), c.in < 0.09 ? 0xffd34d : 0x22e3ff, c.final ? 0.04 : 0.03); else if (sim.phase !== 'stance') field.setRing(null);
      if ((sim.inZone || sim.phase !== 'run') && sim.phase !== 'charge') record.push({ t: sim.t, ...body });
    }
    audio.setRace(clamp01(sim.v / MAX_SPEED), 1, false);
  } else if (mode === 'landed') {
    if (landedBody) landedBody.t += dt;
    if (through) {
      through.t += dt;
      through.v = Math.max(0, through.v - (2.5 + through.v * 1.2) * dt);
      through.s += through.v * dt;
    }
    body = bodyNow();
    audio.setRace(0, 1, false);
    if (modeT > (through ? 1.3 : 1.0)) startReplay();
  } else if (mode === 'replay') {
    const rp = replay;
    rp.t += dt * 0.775;
    while (rp.i < record.length - 2 && record[rp.i + 1].t <= rp.t) rp.i++;
    const a = record[rp.i], b2 = record[Math.min(record.length - 1, rp.i + 1)];
    const f = b2.t > a.t ? clamp01((rp.t - a.t) / (b2.t - a.t)) : 0;
    body = { ...a, s: lerp(a.s, b2.s, f), y: lerp(a.y || 0, b2.y || 0, f) };
    if (a.kind === b2.kind && a.u != null && b2.u != null) body.u = lerp(a.u, b2.u, f);
    if (a.kind === 'run') body.v = a.v;
    if (rp.t >= rp.end) {
      rp.hold += dt;
      body = { kind: 'landed', s: lastResult.raw, y: 0, q: LAND_Q, w: clamp01(rp.hold / 0.4), tj: comp.event === 'triple' };
      if (rp.hold > 0.72) startMeasure();
    }
  } else if (mode === 'measure' || mode === 'between') {
    const m = measure;
    if (m) {
      m.t += dt;
      if (lastResult.reason === 'through' || lastResult.reason === 'time') body = bodyNow();
      else body = { kind: 'landed', s: lastResult.raw, y: 0, q: LAND_Q, w: 1, tj: comp.event === 'triple' };
      if (!m.done) {
        if (m.valid) {
          const p = smooth(m.t / m.dur);
          const shown = m.raw * p;
          field.setTape(shown, 1);
          $('jp-mark-value').textContent = (Math.floor(shown * 100) / 100).toFixed(2);
          if (m.t - m.lastTick > 0.05) { m.lastTick = m.t; audio.tick01(p); }
        }
        if (m.t >= m.dur) finishMeasure();
      } else if (mode === 'measure' && m.t >= m.cardAt) showCard();
    }
    if (mode === 'between') { betweenAuto -= dt; if (betweenAuto <= 0) nextAttempt(); }
  } else if (mode === 'final') {
    finalT += dt;
    body = { kind: 'cheer', s: 0, y: 0 };
    if (!finalShown && finalT > 1.9) showFinalCard();
    const f = comp.final;
    if (f.best != null && f.place <= 3 && finalT < 14) {
      fireAt -= dt;
      if (fireAt <= 0) {
        fireAt = f.place === 1 ? 0.5 + Math.random() * 0.5 : 1.3 + Math.random();
        stage.fx.firework(RX - 30 + Math.random() * 30, PIT_Z0 - 20 - Math.random() * 50);
        audio.firework(0.3, Math.random() - 0.5);
        if (Math.random() < 0.5) stage.fx.confetti(stage.rig.position.x + (Math.random() - 0.5) * 3, 3.5, stage.rig.position.z + (Math.random() - 0.5) * 3, 40);
      }
    }
  }

  ts += (tsTarget - ts) * Math.min(1, dt * (tsTarget < ts && ts < 0.5 && tsTarget > 0.1 ? 5 : 14));
  if (Math.abs(ts - tsTarget) < 0.005) ts = tsTarget;
  stage.timeScale = ts;
  placeBody();
  field.setWind(sim && (mode === 'ready' || mode === 'run') ? sim.wind : field.windShown || 0);
  if (sim && (mode === 'ready' || mode === 'run')) field.windShown = sim.wind;
  field.update(dt * ts);
}

let hudAt = 0;
function drawHud(now) {
  drawScopes(now);
  drawBoardCam(now);
  drawMeter();
  drawPower(now);
  if (now - hudAt < 50) return;
  hudAt = now;
  const playing = mode === 'ready' || mode === 'run';
  if (sim && playing) {
    const w = sim.wind;
    $('jp-wind-value').textContent = windText(w);
    const wEl = $('jp-wind');
    wEl.dataset.kind = w > RULES.WIND_LEGAL ? 'over' : w >= 0.3 ? 'tail' : w <= -0.3 ? 'head' : 'calm';
    $('jp-wind-arrow').style.transform = `scaleX(${clamp01(Math.abs(w) / 2.5) * (w >= 0 ? 1 : -1) || 0.05})`;
    $('jp-wind-note').textContent = w > RULES.WIND_LEGAL ? '追い風参考' : w >= 0.3 ? '追い風 TAIL' : w <= -0.3 ? '向かい風 HEAD' : '無風 CALM';
    $('jp-clock').textContent = mode === 'ready' ? String(Math.max(0, Math.ceil(clockLeft))) : '';
    $('jp-clock-box').classList.toggle('hurry', mode === 'ready' && clockLeft <= 10);
    $('jp-speed').textContent = sim.v.toFixed(1);
    $('jp-speed-fill').style.width = `${clamp01(sim.v / 10.5) * 100}%`;
    $('jp-go').classList.toggle('show', mode === 'ready' && modeT > 2.56);
  } else {
    $('jp-go').classList.remove('show');
  }
}
function loop(now) {
  const rawDt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now; frameAt = now;
  update(now, Math.min(rawDt, 0.05));
  stage.frame(rawDt);
  drawHud(now);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- boot
window.JUMP_BUILD = BUILD;
window.jumpDebug = {
  get mode() { return mode; }, get sim() { return sim; }, get comp() { return comp; }, get ts() { return ts; }, get body() { return body; },
  start: () => startCompetition(), title: () => toTitle(), setEvent: (k) => setEvent(k), takeoff: () => doTakeoff('key'), launch: (cm) => doLaunch(cm, { kind: 'debug' }), get jump() { return jump; }, detectors, sample: (id, acc, quat) => window.jumpSample(id, acc, quat),
  accel(on) { input.keyAccel = !!on; if (!on) input.released = true; },
  next: () => nextAttempt(),
};
async function boot() {
  const canvas = $('game-canvas');
  try {
    stage = await createStage({ canvas, labels: { event: 'SUPER VIRTUAL JUMP', tag: 'JUMPS', tagAccent: 'FINAL' }, rivalLanes: [] });
  } catch (error) {
    console.error('[JUMP] could not build the stadium', error);
    $('loading').classList.add('error');
    $('loading').querySelector('.loading-text').textContent = '読み込みに失敗しました。ページを再読み込みしてください / Failed to load';
    return;
  }
  audio = stage.audio;
  Object.setPrototypeOf(audio, JumpAudio.prototype);       // the stage's sound engine, plus the sounds of the jumps
  field = createField({ scene: stage.scene, renderer: stage.renderer, boards: { long: EVENTS.long.pitNear, triple: EVENTS.triple.pitNear } });
  field.setEvent(eventKey);
  stage.world.setGate(false);
  stage.showHero = true;
  stage.poseHook = heroPose;
  stage.afterPose = (dt) => cameraWork(dt);
  stage.rivalSteps = false;

  // ---- which sensor: ORPHE CORE (default) or ORPHE INSOLE. The choice is shared with SUPER VIRTUAL HURDLE.
  if (DEVICE === 'insole') {
    try { await loadInsoleSdk(); insole = setupInsole(); } catch (error) { console.error('[JUMP] ORPHE INSOLE support could not be loaded; staying on ORPHE CORE.', error); insole = null; }
    if (insole) {
      for (const dev of insole.devices) {
        const inner = dev.gotConvertedAcc, innerG = dev.gotConvertedGyro;
        dev.gotConvertedGyro = function (g) { window.devices[this.id].gyro = g; return innerG.call(this, g); };
        dev.gotConvertedAcc = function (acc) { window.devices[this.id].at = performance.now(); const r = inner.call(this, acc); window.jumpSample(this.id, acc, this.quat); window.sensorTap(this.id); return r; };
      }
      $('dock-title').textContent = 'ORPHE INSOLE';
      $('dock-hint').innerHTML = 'スイッチをONにしてINSOLEを選ぶ。操作はCOREと同じ：足ぶみで走る、その場で高くジャンプ。キーボードは <kbd>←</kbd> 長押し / <kbd>→</kbd> を跳んでいる間だけ押す。';
    } else {
      const note = $('ble-support-message');
      note.textContent = 'ORPHE INSOLE のライブラリを読み込めませんでした（ネットワークを確認してください）。ORPHE CORE で動作しています。';
      note.style.display = 'block';
    }
  }
  const device = insole ? 'insole' : 'core';
  document.querySelectorAll('#device-switch button').forEach((b) => {
    const on = b.dataset.device === device;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
    b.addEventListener('click', () => {
      if (b.dataset.device === device) return;
      try { localStorage.setItem('hurdle.device', b.dataset.device); } catch { /* storage unavailable */ }
      const url = new URL(window.location.href);
      url.searchParams.delete('device');
      window.location.href = url.toString();     // the two SDKs' toolkits share element ids: switching reloads the page
    });
  });

  chrome = bindChrome(stage, { coreIds: [0, 1] });
  // browsers only start audio after a gesture: bring the music of the current screen in then
  $('stage').addEventListener('audio-ready', () => audio.setMusic(mode === 'title' ? 'title' : mode === 'final' ? 'result' : 'race'));
  scopes = [createScope($('scope-dock'), SCOPE_OPTS), createScope($('scope-hud'), SCOPE_OPTS)];
  bindTouch();
  layoutMeter();

  // ---- title
  $('player-name').value = store.get('superjump.name', '') || '';
  document.querySelectorAll('#event-switch button').forEach((b) => b.addEventListener('click', () => { if (mode === 'title') setEvent(b.dataset.event); }));
  $('start-btn').addEventListener('click', () => { if (mode === 'title') startCompetition(); });
  $('btn-ranking').addEventListener('click', () => showRanking('start'));
  $('btn-ranking-finish').addEventListener('click', () => showRanking('finish'));
  $('back-btn').addEventListener('click', () => { $('ranking-layer').style.display = 'none'; });
  $('ranking-clear').addEventListener('click', () => { if (window.confirm('この種目のランキングを消しますか？')) { store.set(rankKey(eventKey), []); showRanking($('ranking-layer').dataset.from); } });
  $('retry').addEventListener('click', () => { if (mode === 'final') startCompetition(); });
  $('btn-title').addEventListener('click', toTitle);
  $('btn-other').addEventListener('click', () => { const other = eventKey === 'long' ? 'triple' : 'long'; toTitle(); setEvent(other); startCompetition(); });
  $('jp-card-next').addEventListener('click', nextAttempt);
  $('name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = ($('result-name').value || '').trim().slice(0, 16);
    if (comp) comp.name = name;
    store.set('superjump.name', name);
    $('player-name').value = name;
    $('save-status').textContent = registerScore(name) ? '登録しました ✓' : '記録なしのため登録できません';
  });
  // ---- the reference height of the jump (the height that gets the full lift)
  const refEl = $('jumpRef');
  const showRef = () => { refEl.value = String(settings.refCm); $('jumpRefValue').textContent = `${settings.refCm} cm`; };
  refEl.addEventListener('input', () => { settings.refCm = Math.min(60, Math.max(20, parseInt(refEl.value, 10) || RULES.JUMP_REF_CM)); store.set('superjump.refcm', settings.refCm); showRef(); });
  showRef();
  // ---- recording
  for (const id of ['rec-toggle', 'rec-toggle-2']) {
    const el = $(id);
    el.checked = settings.rec;
    el.addEventListener('change', () => { settings.rec = el.checked; store.set('superjump.rec', settings.rec); for (const o of ['rec-toggle', 'rec-toggle-2']) $(o).checked = settings.rec; });
  }
  $('btn-raw').addEventListener('click', () => rec.download());
  $('rec-all').addEventListener('click', () => rec.downloadAll());
  $('rec-clear').addEventListener('click', async () => { if (window.confirm('保存した生データをすべて消しますか？')) { await rec.clear(); refreshRecCount(); } });
  refreshRecCount();

  stage.warmUp();
  toTitle();
  stage.setCam('free', 0.001);
  updateLines(0);
  requestAnimationFrame((t) => { last = t; frameAt = t; loop(t); });
  setTimeout(() => chrome.loadingDone(), 350);
  if (BOT) setTimeout(startCompetition, 1500);
  console.log(`[JUMP] build ${BUILD} (sensor: ${device}, event: ${eventKey})`);
}
boot();
