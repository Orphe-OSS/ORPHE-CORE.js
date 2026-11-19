// main.js — SUPER VIRTUAL ADVENTURE: flow, input, camera, HUD.
//
// The rules live in rules.js and the course in level.js; this file runs them at a
// fixed 120 steps a second, turns the two inputs the ORPHE CORE script in
// index.html provides (window.setAccelPressed(), window.gameJump()) into the
// rules' { accel, jump }, and shows the result: a first-person camera, the side
// view, the cues and the sound. The same two inputs come from the keyboard
// (← run, → jump) and from touch.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { RULES, createSim, step, advise, botInput, gradeOf, prepareLevel } from './rules.js';
import { buildLevel } from './level.js';
import { createWorld } from './world.js';
import { createBody } from './body.js';
import { createAudio } from './audio.js';
import { createSideView } from './sideview.js';
// the live strip chart of the sensor signal, shared with the other virtual-sports games
import { createScope } from '../GAME-SUPER-START/scope.js';
// ORPHE INSOLE plays through the hurdle game's adapter: it feeds the same window.devices /
// setAccelPressed() / gameJump() surface as the CORE script in index.html.
import { DEVICE, loadInsoleSdk, setupInsole } from '../GAME-SUPER-HURDLE/insole.js';

const BUILD = new URL(import.meta.url).searchParams.get('v') || 'dev';
const QUERY = new URLSearchParams(window.location.search);
const AUTOPLAY = QUERY.get('autoplay') === '1';      // the demo player plays the real game (for recording a demo, and for smoke tests)
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
};

// ---------------------------------------------------------------------------
// Renderer
const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.NoToneMapping;      // flat, bright colours: the picture is a cartoon, not a photograph
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, 16 / 9, 0.08, 1600);
camera.rotation.order = 'YXZ';
scene.add(camera);
const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
// The runner's own legs and arms: a second little scene, fixed to the eyes, drawn over the world
// (as first-person games do). The feet are then always in the picture.
const body = createBody();
class OverlayPass extends Pass {
  constructor(overlayScene, overlayCamera) { super(); this.scene = overlayScene; this.camera = overlayCamera; this.needsSwap = false; }
  render(r, writeBuffer, readBuffer) {
    const auto = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(this.renderToScreen ? null : readBuffer);
    r.clearDepth();
    r.render(this.scene, this.camera);
    r.autoClear = auto;
  }
}
composer.addPass(new OverlayPass(body.scene, body.camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 1.02);   // only what is brighter than white glows: the sun, coins in fever
composer.addPass(bloom);
composer.addPass(new OutputPass());

const QUALITY = { high: { ratio: 2, bloom: true }, medium: { ratio: 1.25, bloom: true }, low: { ratio: 1, bloom: false } };
let qualityMode = store.get('adventure.quality', 'auto');
let quality = qualityMode === 'auto' ? 'high' : qualityMode;
function resize() {
  const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
  const q = QUALITY[quality];
  const ratio = Math.min(window.devicePixelRatio || 1, q.ratio);
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(ratio);
  composer.setSize(w, h);
  bloom.enabled = q.bloom;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  body.setAspect(w / h);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Game state
const level = prepareLevel(buildLevel());
// The signs along the road are drawn with the page's pixel font. Wait for it (briefly: the game
// also works with the fallback font).
try { await Promise.race([document.fonts.load('32px "DotGothic16"', `${level.signs.map((sg) => sg.ja + sg.en).join('')}ZONE CHECKPOINT GOAL DASH SLOW 0123456789 m`), new Promise((r) => setTimeout(r, 1800))]); } catch { /* no font API */ }
const world = createWorld({ scene, level });
const audio = createAudio();
const side = createSideView($('sideview'), level);
// 'normal': a miss sends the runner back to the start (or the checkpoint half way), three hearts, then game over.
// 'easy':   a miss costs a heart and the run goes on; helper bridges; nobody is stuck. (See createSim in rules.js.)
let gameMode = store.get('adventure.mode', 'normal') === 'easy' ? 'easy' : 'normal';
const modeKey = (name) => (gameMode === 'normal' ? `adventure.${name}.normal` : `adventure.${name}`);
let sim = createSim(level, { mode: gameMode });
let cueMemo = {};              // what advise() remembers between frames (STOP stays STOP until the runner has stopped)
let advice = advise(sim, cueMemo);
let mode = 'title';            // 'title' (the demo plays) | 'countdown' | 'play' | 'result'
let demo = true;
let acc = 0, freeze = 0, wall = 0, resultAt = 0, zoneShown = -1, farthest = 0, lastMiss = null, overAt = 0;
const settings = { assist: store.get('adventure.assist', true), cues: store.get('adventure.cues', true), volume: store.get('adventure.volume', 0.85) };
const input = { keyAccel: false, touchAccel: false, sensorAccel: false, sensorAt: -1e9, jump: false, keyJumpAt: -1e9 };
const stats = { held: 0, ignored: 0 };

// ---------------------------------------------------------------------------
// Input: two things only. Run and jump.
const RUN_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW']);
const JUMP_KEYS = new Set(['ArrowRight', 'KeyD', 'Space']);
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) { if (e.code === 'Enter' && e.target.id === 'player-name') { e.preventDefault(); startGame(); } return; }
  if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement) return;   // Enter / Space on a focused button is that button's
  audio.unlock();
  if (RUN_KEYS.has(e.code)) { input.keyAccel = true; e.preventDefault(); }
  if (JUMP_KEYS.has(e.code) && mode === 'play') { if (!e.repeat) pressJump(); e.preventDefault(); }
  if (e.code === 'Escape') toTitle();
  if ((e.code === 'Enter' || (e.code === 'Space' && mode !== 'play')) && !e.repeat) {
    if (mode === 'title') startGame();
    else if (mode === 'result' && stage.classList.contains('settled')) startGame();
  }
});
addEventListener('keyup', (e) => { if (RUN_KEYS.has(e.code)) input.keyAccel = false; });
addEventListener('blur', () => { input.keyAccel = false; releaseTouches(); });
// touch: hold the left half to run, tap the right half to jump
const touches = new Map();
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (mode !== 'play') return;
  const left = e.clientX < window.innerWidth / 2;
  touches.set(e.pointerId, left);
  if (left) input.touchAccel = true; else pressJump();
});
const endTouch = (e) => { touches.delete(e.pointerId); input.touchAccel = [...touches.values()].some(Boolean); };
// on window: a button released over the result card (which covers the canvas) still counts
addEventListener('pointerup', endTouch);
addEventListener('pointercancel', endTouch);
function releaseTouches() { touches.clear(); input.touchAccel = false; }

// ---- ORPHE CORE (called by the sensor script in index.html)
// Stamping reads as "pressed" only while the acceleration is above the threshold, which flickers
// with every step. Holding it for a moment turns the flicker into steady running, and the rules
// add a short coast (RULES.COAST_SEC) before the brake, so a dash survives the gaps between steps;
// stopping the feet still starts the brake within half a second.
const SENSOR_ACCEL_HOLD_MS = 220;
const SENSOR_STALE_MS = 500;
window.setAccelPressed = function (pressed) {
  input.sensorAccel = !!pressed;
  if (pressed) input.sensorAt = performance.now();
};
// ---- the raw signal, as a strip chart (dock on the title screen, corner of the screen while playing)
// Acceleration of each foot in G, and the toe-up angle drawn on the same scale (so one line marks
// both thresholds: stamping above it runs, toe-up above it jumps).
const SCOPE_OPTS = { seconds: 4, max: 3.6, series: [{ color: '#35d0ff', label: 'L 加速度' }, { color: '#ff6bb0', label: 'R 加速度' }, { color: '#ffd21f', label: 'つま先' }] };
const scopes = [createScope($('scope-dock'), SCOPE_OPTS), createScope($('scope-hud'), SCOPE_OPTS)];
const mag = (a) => (a ? Math.hypot(a.x, a.y, a.z) : 0);
let sensorAt = -1e9;
/** Called by the sensor callbacks (CORE: index.html; INSOLE: the wrapper in boot()) on every sample. */
window.sensorTap = function () {
  const d = window.devices;
  if (!d) return;
  const now = performance.now(), th = window.accThresholdAccel || 1.1, pt = window.pitchThresholdJump || 0.15;
  let toe = 0;
  for (const i of [0, 1]) if (d[i].eulers && now - (d[i].at || 0) < SENSOR_STALE_MS) toe = Math.max(toe, -d[i].eulers.pitch);
  const values = [mag(d[0].acc), mag(d[1].acc), Math.max(0, toe) / pt * th];
  for (const sc of scopes) sc.push(now, values);
  sensorAt = now;
};
let scopeTh = 0;
function drawScopes(now) {
  const live = now - sensorAt < 1500;
  $('scope-dock-box').classList.toggle('live', live);
  $('scope-hud-box').classList.toggle('live', live);
  if (!live) return;
  const th = window.accThresholdAccel || 1.1;
  if (th !== scopeTh) { scopeTh = th; for (const sc of scopes) sc.setLines([{ y: th, color: '#ffffff', label: `しきい値 ${th.toFixed(1)} G`, dash: true }]); }
  const tint = accelNow() ? 'rgba(53, 224, 106, 0.16)' : null;
  for (const sc of scopes) { sc.setTint(tint); sc.draw(now); }
}

function accelNow() {
  const now = performance.now();
  if (input.keyAccel || input.touchAccel) return true;
  const d = window.devices;
  const fresh = d && now - Math.max(d[0].at || 0, d[1].at || 0) < SENSOR_STALE_MS;   // a sensor that dropped out must not leave the runner running
  return !!fresh && (input.sensorAccel || now - input.sensorAt < SENSOR_ACCEL_HOLD_MS);
}

// ---- Sensor jump assist ------------------------------------------------------
// A foot stamping hard pitches past the toe-up threshold on its own, and first-time players
// lift the toe a little early. With the assist on, a sensor jump is taken only where advise()
// sees a reason to jump (something to clear, a coin block, a creature to land on):
//   - a reason right now: jump at once;
//   - not yet (too early): held, and released the moment the reason appears, if that is within
//     JUMP_HOLD_MS of the last toe-up sample (as in SUPER VIRTUAL HURDLE: a toe kept up keeps
//     the request alive, and so does stamping that keeps tripping the threshold);
//   - standing still: always allowed (so a player can try the jump before running).
// Keyboard and touch jumps are never filtered.
const JUMP_HOLD_MS = 450;
let heldAt = 0, heldPress = false;     // heldPress: the held jump came from a key or a tap, not from a sensor
function sensorJump() {
  const p = sim.p;
  if (!settings.assist) { input.jump = true; return true; }
  if (!p.ground && p.coyote <= 0) { heldAt = performance.now(); heldPress = false; return false; }   // in the air: remembered for the landing, no cooldown
  if (advice.jump || p.vs < 0.8) { heldAt = 0; input.jump = true; return true; }
  if (!heldAt) stats.ignored++;
  heldAt = performance.now(); heldPress = false;
  return false;
}
function releaseHeldJump() {
  if (!heldAt) return;
  const waited = performance.now() - heldAt;
  if (advice.jump && sim.p.ground) {
    if (!heldPress) stats.ignored = Math.max(0, stats.ignored - 1);
    heldAt = 0; heldPress = false; input.jump = true; stats.held++;
  } else if (waited > JUMP_HOLD_MS) {
    if (heldPress) input.jump = true;      // a key was pressed on purpose: it jumps in the end, whatever the cue says
    heldAt = 0; heldPress = false;
  }
}
/**
 * A jump from the keyboard or the touch screen. It is never ignored. With the assist on, the JUMP
 * cue comes up a little before the jump would work (advice.soon); a press in that moment waits
 * for the right place instead of jumping short.
 */
function pressJump() {
  input.keyJumpAt = performance.now();
  if (settings.assist && advice.soon && !advice.jump && sim.p.ground) { heldAt = performance.now(); heldPress = true; return; }
  input.jump = true;
}
window.gameJump = function () {
  if (mode !== 'play' || demo || AUTOPLAY) return false;     // not racing: nothing jumps, and the sensor script's cooldown does not start
  return sensorJump();
};

// ---- Toe-up zero: the resting pitch of each sensor, measured while the player stands still
// during the countdown (see window.pitchZero in index.html).
const ZERO_WINDOW_MS = 1500, ZERO_MAX_SPREAD = 0.06;
let zeroSamples = [];
let insole = null;            // set at boot when ORPHE INSOLE is selected
const insoleZero = [0, 0];
/** Pitch of sensor i as it would read with no zero applied; null before the first sample. */
function rawPitch(i) {
  const d = window.devices[i];
  if (insole) return d.at ? d.eulers.pitch + insoleZero[i] : null;
  return d.raw ? d.raw.pitch : null;
}
function sampleRestingPitch() {
  const d = window.devices;
  if (!d) return;
  const now = performance.now();
  zeroSamples.push([now, rawPitch(0), rawPitch(1)]);
  while (zeroSamples.length && now - zeroSamples[0][0] > ZERO_WINDOW_MS) zeroSamples.shift();
}
function applyRestingPitch() {
  for (const i of [0, 1]) {
    const xs = zeroSamples.map((r) => r[i + 1]).filter((v) => v != null).sort((a, b) => a - b);
    let zero = 0;
    if (xs.length >= 20) {
      const spread = xs[Math.floor(xs.length * 0.95)] - xs[Math.floor(xs.length * 0.05)];
      if (spread <= ZERO_MAX_SPREAD) zero = Math.min(1.2, Math.max(-0.4, xs[xs.length >> 1]));
    }
    if (insole) { insoleZero[i] = zero; insole.setPitchZero(i, zero); } else window.pitchZero[i] = zero;
  }
  zeroSamples = [];
}

// ---------------------------------------------------------------------------
// HUD
const hud = {
  hearts: [...$('hearts').children], notes: $('hud-notes'), score: $('hud-score'), time: $('hud-time'), zoneName: $('hud-zone-name'),
  cue: $('cue'), cueText: $('cue-text'), cueSub: $('cue-sub'), popups: $('popups'), fever: $('fever'), feverFill: $('fever-fill'),
  speed: $('speed'), speedFill: $('speed-fill'), speedNum: $('speed-num'), speedBand: $('speed-band'), pace: $('pace'), paceText: $('pace-text'), paceSub: $('pace-sub'),
  banner: $('zone-banner'), vignette: $('vignette'), fade: $('fade'),
};
const SPEED_SCALE = RULES.MAX_SPEED + 1;                       // right-hand end of the speed gauge
for (const [id, v] of [['speed-tick-run', RULES.RUN_SPEED], ['speed-tick-dash', RULES.DASH_SPEED], ['speed-tick-max', RULES.OVER_SPEED]]) $(id).style.left = `${v / SPEED_SCALE * 100}%`;
$('speed-danger').style.left = `${RULES.OVER_SPEED / SPEED_SCALE * 100}%`;
const PACE = {
  dash: ['DASH!', '足ぶみを つづけろ！'], keep: ['OK!', 'そのまま ダッシュ！'], slow: ['SLOW', 'ゆっくり！ 足を止めろ'], ok: ['OK!', 'この はやさで'],
  over: ['はやすぎ！', 'とまれない… 足をゆるめろ'],
};
$('hud-notes-total').textContent = `/ ${level.totals.notes}`;
const shown = { hearts: -1, notes: -1, score: -1, cue: '', time: '', pace: '', band: '' };
function popup(text, kind = '', sub = '') {
  const el = document.createElement('div');
  el.className = `popup ${kind}`;
  el.innerHTML = sub ? `<b>${text}</b><span>${sub}</span>` : `<b>${text}</b>`;
  hud.popups.appendChild(el);
  while (hud.popups.children.length > 4) hud.popups.firstChild.remove();
  setTimeout(() => el.remove(), 1500);
}
function flash(kind) {
  hud.vignette.className = '';
  void hud.vignette.offsetWidth;
  hud.vignette.className = kind;
}
function blackout(ms) {
  hud.fade.style.transition = 'none'; hud.fade.style.opacity = '1';
  setTimeout(() => { hud.fade.style.transition = `opacity ${ms}ms ease`; hud.fade.style.opacity = '0'; }, 60);
}
function showZone(i) {
  const z = level.zones[i];
  $('zone-no').textContent = `ZONE ${i + 1}`; $('zone-en').textContent = z.name; $('zone-ja').textContent = z.ja;
  hud.zoneName.textContent = `ZONE ${i + 1}  ${z.name}`;
  hud.banner.classList.remove('show'); void hud.banner.offsetWidth; hud.banner.classList.add('show');
}
const CUES = {
  jump: ['JUMP', 'つま先UP！', 'bi-chevron-double-up'], bonus: ['JUMP', 'ボーナス ♪', 'bi-music-note-beamed'],
  stop: ['STOP', '足を止めろ！', 'bi-hand-index-thumb-fill'], wait: ['WAIT', 'まだ…', 'bi-hourglass-split'], go: ['GO!', '走れ！', 'bi-chevron-double-right'],
};
function cueNow() {
  if (!settings.cues || mode !== 'play' && mode !== 'title') return '';
  const p = sim.p;
  if (p.finished || p.over || freeze > 0) return '';
  // with the assist on, the cue comes up SOON_SEC early: a jump asked for then is held until it works
  if (advice.jump === 'need' || (advice.soon && settings.assist && p.ground)) return 'jump';
  if (advice.gate) return advice.gate === 'go' && p.vs > 3 ? '' : advice.gate;
  if (advice.jump === 'bonus') return 'bonus';
  return '';
}
function updateHud(dt) {
  const p = sim.p;
  if (shown.hearts !== p.hearts) { shown.hearts = p.hearts; hud.hearts.forEach((el, i) => el.classList.toggle('lost', i >= p.hearts)); }
  if (shown.notes !== p.notes) { shown.notes = p.notes; hud.notes.textContent = p.notes; hud.notes.parentElement.classList.remove('pulse'); void hud.notes.offsetWidth; hud.notes.parentElement.classList.add('pulse'); }
  if (shown.score !== p.score) { shown.score = p.score; hud.score.textContent = p.score.toLocaleString(); }
  const t = sim.t.toFixed(1);
  if (shown.time !== t) { shown.time = t; hud.time.textContent = t; }
  hud.speedFill.style.transform = `scaleX(${Math.min(1, p.vs / SPEED_SCALE)})`;
  hud.speedNum.textContent = p.vs.toFixed(1);
  // the speed the road ahead asks for: a band on the gauge, and DASH / SLOW / OK above it
  const pc = settings.cues && !p.finished && !p.over && (mode === 'play' || mode === 'title') ? advice.pace : null;
  const band = pc ? `${Math.round(pc.min / SPEED_SCALE * 1000)}:${Math.round(Math.min(pc.max, SPEED_SCALE) / SPEED_SCALE * 1000)}` : '';
  if (band !== shown.band) {
    shown.band = band;
    hud.speedBand.style.opacity = pc ? '1' : '0';
    if (pc) { const [a, b] = band.split(':').map(Number); hud.speedBand.style.left = `${a / 10}%`; hud.speedBand.style.width = `${Math.max(1, (b - a) / 10)}%`; }
  }
  // faster than can be handled (and nothing ahead that asks for it): say so
  // (not on a runway: there the wide hole ahead asks for all the speed there is)
  const tooFast = p.vs > RULES.OVER_SPEED + 0.3 && p.fever <= 0 && !p.finished && !p.over && mode === 'play' && !(pc && pc.dash && pc.kind === 'ok');
  if (tooFast && !demo && wall - overAt > 0.45) { overAt = wall; audio.sfx.overspeed(); }
  stage.classList.toggle('overspeed', tooFast);
  let pace = !pc || !pc.kind ? '' : pc.kind === 'ok' && pc.dash ? 'keep' : pc.kind;
  if (tooFast && settings.cues && pace !== 'slow') pace = 'over';
  if (pace !== shown.pace) {
    const from = shown.pace;
    shown.pace = pace;
    hud.pace.className = `pace ${pace ? `show ${pace}` : ''}`;
    hud.speed.dataset.pace = pace;
    if (pace) {
      [hud.paceText.textContent, hud.paceSub.textContent] = PACE[pace];
      if (!demo) { if (pace === 'slow') audio.sfx.cue('slow'); else if (pace === 'dash') audio.sfx.cue('dash'); else if (pace !== 'over' && (from === 'dash' || from === 'slow')) audio.sfx.cue('ok'); }
    }
  }
  hud.speed.classList.toggle('dashing', p.vs >= RULES.DASH_SPEED - 0.6 && p.dashing);
  stage.style.setProperty('--rush', Math.max(0, Math.min(1.6, (p.vs - 6) / 4)).toFixed(2));
  hud.fever.classList.toggle('on', p.fever > 0);
  if (p.fever > 0) hud.feverFill.style.transform = `scaleX(${p.fever / RULES.FEVER_SEC})`;
  const cue = cueNow();
  if (cue !== shown.cue) {
    const from = shown.cue;
    shown.cue = cue;
    hud.cue.className = `cue ${cue ? `show ${cue}` : ''}`;
    if (cue) {
      const [text, sub, icon] = CUES[cue];
      hud.cueText.textContent = text; hud.cueSub.textContent = sub; hud.cue.firstElementChild.className = `bi ${icon}`;
      if (!demo) { if (cue === 'stop') audio.sfx.cue('stop'); else if (cue === 'go' && (from === 'wait' || from === 'stop')) audio.sfx.cue('go'); else if (cue === 'jump') audio.sfx.cue('jump'); }
    }
  }
  const z = world.zoneAt(p.s);
  if (z !== zoneShown) { zoneShown = z; audio.setZone(z); if (mode === 'play') showZone(z); else hud.zoneName.textContent = `ZONE ${z + 1}  ${level.zones[z].name}`; }
}

// ---------------------------------------------------------------------------
// Events from the rules: sound, popups, camera kicks
const cam = { pitch: -0.13, air: 0, y: 0, shake: 0, kick: 0, bob: 0, stride: 0, look: 0, dolly: 0 };
function onEvent(e) {
  world.onEvent(e, sim);
  const p = sim.p, quiet = demo;
  switch (e.type) {
    case 'jump': if (!quiet) audio.sfx.jump(); break;
    case 'land': stage.classList.remove('falling'); if (!quiet) audio.sfx.land(e.impact); cam.kick = Math.min(0.12, e.impact * 0.009); body.bump(Math.min(1, e.impact * 0.06)); break;
    case 'note': if (!quiet) audio.sfx.note(); break;
    case 'bell':
      if (!quiet) audio.sfx.bell(e.fever);
      cam.shake = Math.max(cam.shake, 0.1);
      popup(e.fever ? 'FEVER BLOCK!' : 'BLOCK!', 'gold', e.fever ? '' : `+${300 + e.notes * 100}`);
      break;
    case 'fever': audio.setFever(true); if (!quiet) audio.sfx.fever(); popup('FEVER!!', 'rainbow', 'むてき＋スピードUP'); flash('fever'); break;
    case 'feverEnd': audio.setFever(false); if (!quiet) audio.sfx.feverEnd(); break;
    case 'stomp':
      if (!quiet) audio.sfx.stomp(e.combo);
      cam.shake = 0.12; body.bump(0.7);
      popup(e.combo > 1 ? `${e.combo} COMBO!` : 'STOMP!', 'good', `+${e.pts}`);
      break;
    case 'blast': if (!quiet) audio.sfx.blast(); popup('BLAST!', 'rainbow', '+200'); break;
    case 'spring': if (!quiet) audio.sfx.spring(); cam.shake = 0.2; popup('BIG JUMP!', 'good'); break;
    case 'dash': if (!quiet) audio.sfx.dash(); popup('DASH!!', 'dash'); break;
    case 'bump': if (!quiet) audio.sfx.bump(); cam.shake = Math.max(cam.shake, 0.1); break;
    case 'hurt':
      if (!quiet) audio.sfx.hurt();
      cam.shake = 0.6; freeze = 0.09; flash('hurt');
      lastMiss = { kind: e.kind, s: p.s };
      popup(e.kind === 'hammer' ? 'ぺしゃんこ！' : e.kind === 'spike' ? 'トゲ！' : 'いたっ！', 'bad', e.hearts > 0 && sim.mode !== 'normal' ? `のこり ♥ ${e.hearts}` : '');
      hintAfterMiss(e.kind);
      break;
    case 'falling':
      if (!quiet) audio.sfx.falling();
      stage.classList.add('falling');
      break;
    case 'fall':
      if (!quiet) audio.sfx.fall();
      stage.classList.remove('falling');
      cam.shake = 0.8;
      freeze = 0.9; blackout(900); flash('hurt');
      lastMiss = { kind: 'fall', gap: p.lastOn && p.lastOn.gap };
      popup('おちた！', 'bad', e.hearts > 0 && sim.mode !== 'normal' ? `のこり ♥ ${e.hearts}` : '');
      cam.y = p.y; cam.air = 0;
      hintAfterMiss('fall');
      break;
    case 'down':
      stage.classList.remove('falling');
      if (!quiet) audio.sfx.down();
      freeze = 1.0; blackout(900);
      if (sim.mode === 'normal') popup(p.cp >= 0 ? '中間ポイントから もう一度！' : 'スタートから もう一度！', 'bad', `のこり ♥ ${e.hearts}`);
      else popup('ハートが なくなった…', 'bad', 'チェックポイントから もう一度');
      cam.y = p.y; cam.air = 0;
      audio.setFever(false);
      // nothing asked for before the miss carries over to the new start
      heldAt = 0; heldPress = false; input.jump = false; cueMemo = {};
      break;
    case 'gameover':
      stage.classList.remove('falling');
      audio.setFever(false);
      resultAt = wall + 2.2;
      if (quiet) break;                       // the demo on the title screen simply starts over
      audio.sfx.down();
      audio.stopMusic();
      freeze = 0; blackout(1400);
      popup('GAME OVER', 'bad big');
      break;
    case 'assist': if (!quiet) audio.sfx.assist(); popup('おたすけ橋 出現！', 'gold', 'HELPER BRIDGE'); break;
    case 'checkpoint': if (!quiet) audio.sfx.checkpoint(); popup('CHECKPOINT', 'good', sim.mode === 'normal' ? 'ミスしても ここから！' : ''); break;
    case 'finale':
      if (!quiet) audio.sfx.finale(e.dist);
      cam.shake = 0.35;
      popup(`${e.dist.toFixed(2)} m`, 'gold big', `LONG JUMP　+${e.pts}`);
      break;
    case 'goal': onGoal(); break;
    default: break;
  }
}

/** After a fall: say why, in terms of speed (the thing this course is about). */
function hintAfterMiss(kind) {
  if (demo || kind !== 'fall') return;
  const last = sim.p.lastOn, g = last && last.gap;
  if (g && sim.assists.some((q) => q.a <= g.a + 0.1 && q.b >= g.b - 0.1)) return;      // a helper bridge was just built over it
  let text = '';
  if (g && g.dash) text = `この穴は ダッシュが必要！（${(g.vmin + 0.4).toFixed(1)} m/s 以上）　もどって助走しよう`;
  else if (g && g.slow) text = `小さな足場は ゆっくり！（${g.vmax.toFixed(1)} m/s 以下）`;
  if (!text) return;
  const el = $('hint');
  el.textContent = text;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

// ---------------------------------------------------------------------------
// Flow
function screen(name) { stage.dataset.screen = name; }
function newRun() {
  sim = createSim(level, { mode: gameMode });
  farthest = 0; lastMiss = null;
  cueMemo = {};
  advice = advise(sim, cueMemo);
  world.reset();
  acc = 0; freeze = 0; heldAt = 0; heldPress = false; zoneShown = -1;
  releaseTouches();
  stats.held = 0; stats.ignored = 0;
  input.jump = false;
  cam.y = sim.p.y; cam.air = 0; cam.shake = 0; cam.look = 0; cam.dolly = 0;
  audio.setFever(false);
  stage.classList.remove('settled');
  stage.classList.remove('falling', 'overspeed');
  shown.cue = ''; shown.pace = ''; shown.band = '';
  hud.cue.className = 'cue'; hud.pace.className = 'pace'; hud.speedBand.style.opacity = '0';
  $('hint').classList.remove('show');
  hud.popups.replaceChildren();
}
function toTitle() {
  clearTimeout(countTimer);
  mode = 'title'; demo = true;
  newRun();
  screen('title');
  renderRanking();
  audio.startMusic({ zone: 0, level: 0.55, tune: true });
}
let countTimer = 0;
function startGame() {
  if (mode === 'countdown') return;
  audio.unlock();
  clearTimeout(countTimer);
  const name = ($('player-name').value || $('result-name').value || '').trim();
  $('player-name').value = name; $('result-name').value = name;
  mode = 'countdown'; demo = false;
  newRun();
  screen('countdown');
  audio.stopMusic();
  zeroSamples = [];
  const caption = $('count-caption'), number = $('count-number');
  let n = 3;
  const tick = () => {
    if (mode !== 'countdown') return;
    if (n > 0) {
      caption.textContent = n === 3 ? '足を止めて、まっすぐ立とう / STAND STILL' : 'READY';
      number.textContent = n; number.className = 'count-number pop'; void number.offsetWidth; number.className = 'count-number pop go-anim';
      audio.sfx.count(false);
      n--;
      countTimer = setTimeout(tick, 850);
    } else {
      applyRestingPitch();
      number.textContent = 'GO!'; caption.textContent = '足ぶみで前へ！';
      audio.sfx.count(true);
      mode = 'play';
      screen('play');
      audio.startMusic({ zone: 0, level: 1 });
    }
  };
  tick();
}
function onGoal() {
  if (demo) { resultAt = wall + 4; return; }
  resultAt = wall + 2.6;
  audio.sfx.gong(); audio.sfx.fanfare();
  popup('GOAL!!', 'gold big');
  flash('fever');
}
function showResult() {
  mode = 'result';
  const p = sim.p, over = p.over;
  const grade = over ? '×' : gradeOf(level, p.score);
  const best = store.get(modeKey('best'), null);
  const isBest = !over && (!best || p.score > best.score);
  if (isBest) store.set(modeKey('best'), { score: p.score, time: p.time });
  $('result-card').classList.toggle('over', over);
  $('result-tag').textContent = over ? 'GAME OVER' : `STAGE 01 · DASH MEADOW${gameMode === 'easy' ? ' · やさしい' : ''}`;
  $('result-badge').style.display = isBest ? '' : 'none';
  $('result-grade').textContent = grade; $('result-grade').dataset.grade = over ? 'D' : grade;
  // game over: how far the runner got, instead of a score
  $('result-score-label').textContent = over ? 'DISTANCE' : 'SCORE';
  $('result-score').textContent = over ? `${Math.floor(farthest)} m` : p.score.toLocaleString();
  $('result-time').textContent = over ? `ゴールまで あと ${Math.ceil(level.goal - farthest)} m` : `${p.time.toFixed(1)} s`;
  $('rs-notes').textContent = `${p.notes} / ${level.totals.notes}`;
  $('rs-bells').textContent = `${p.bells} / ${level.totals.bells}`;
  $('rs-stomps').textContent = p.bestCombo > 1 ? `${p.stomps}（最大 ${p.bestCombo} コンボ）` : `${p.stomps}`;
  $('rs-jump').textContent = p.finaleDist != null ? `${p.finaleDist.toFixed(2)} m` : '—';
  $('rs-dash').textContent = `${p.dashSec.toFixed(1)} s`;
  $('rs-top').textContent = `${p.topSpeed.toFixed(1)} m/s`;
  $('rs-miss').textContent = `${p.hurts + p.falls}`;
  $('rs-bonus').textContent = over ? '—' : `+${(p.bonus.time + p.bonus.hearts + p.bonus.clean).toLocaleString()}`;
  $('rs-bonus-note').textContent = over ? '' : `タイム ${p.bonus.time}・ハート ${p.bonus.hearts}${p.bonus.clean ? `・ノーミス ${p.bonus.clean}` : ''}`;
  $('result-comment').textContent = over ? overComment() : comment(p);
  $('save-status').textContent = '';
  $('save-score').disabled = false;
  lastEntry = null;
  renderRanking();
  screen('result');
  audio.startMusic({ zone: over ? 2 : 1, level: over ? 0.35 : 0.6, tune: !over });
  setTimeout(() => stage.classList.add('settled'), 700);
  console.log(over ? `[ADVENTURE] game over at ${farthest.toFixed(0)} m (${p.time.toFixed(1)} s)` : `[ADVENTURE] goal ${p.time.toFixed(1)} s, score ${p.score} (${grade}), assist: held ${stats.held}, ignored ${stats.ignored}`);
}
/** After a game over: what the last miss was, and what to do about it. */
function overComment() {
  const m = lastMiss;
  if (m && m.kind === 'fall' && m.gap && m.gap.dash) return `広い穴に届きませんでした。青い矢印の道では足ぶみを止めずにダッシュ（${(m.gap.vmin + 0.4).toFixed(1)} m/s 以上、矢印が緑になるまで）。速いほど遠くへとべます。`;
  if (m && m.kind === 'fall' && m.gap && m.gap.slow) return '小さな足場をとびこしました。黄色い矢印の道では足ぶみをゆるめて、スピードゲージを緑の帯に入れてからジャンプ。';
  if (m && m.kind === 'fall') return '穴の手前で JUMP の合図が出たら、つま先を上げよう。緑の着地マークが穴の向こうに出ていれば、とびこえられます。';
  if (m && m.kind === 'hammer') return 'ハンマーの前で STOP が出たら、すぐ足ぶみを止める。ダッシュからは止まるまで 8 m かかります。GO が出たら一気に走りぬけよう。';
  if (m && m.kind === 'spike') return 'トゲまるは ふめません。JUMP の合図でとびこえよう。';
  if (m) return 'プルプルとダッシュまるは、上からふめば たおせます。JUMP の合図でつま先を上げよう。横からぶつかるとミス。';
  return 'もう一度！ コースをおぼえるほど速くなります。';
}
function comment(p) {
  const miss = p.hurts + p.falls;
  if (gameMode === 'normal' && p.downs === 0 && p.time < 55) return `ノーミスで ${p.time.toFixed(1)} 秒！ 上級者の走りです。次はコインとブロックも全部ねらって最高スコアを。`;
  if (gameMode === 'normal' && p.downs > 0) return `ミス ${p.downs} 回でゴール。次はノーミスをねらおう。コースをおぼえるほど速くなります。`;
  if (miss === 0 && p.notes >= level.totals.notes * 0.9) return 'ノーミスでコインもほぼ全部！ ダッシュと減速の使い分けは完ぺき。次はタイムをけずろう。';
  if (miss === 0) return 'ノーミス！ スピードに乗ったまま、コインのアーチとブロックをもっと集めてみよう。';
  if (sim.assists.length > 0) return '広い穴は、足ぶみを止めずに 2 秒つづけてダッシュ（青い矢印が緑になるまで）。速いほど遠くへとべます。';
  if (p.falls >= 3) return '青い矢印の道は「ダッシュ」、黄色い矢印の道は「ゆっくり」。下のスピードゲージを緑の帯に合わせてからジャンプ。';
  if (p.hurts >= 3) return 'STOP が出たら足ぶみを止める。ダッシュからは止まるまで 8 m かかるので、早めにブレーキ。';
  if (p.dashSec < 12) return 'もっとダッシュできます。足ぶみをつづけるほど速くなり、タイムボーナスも走り幅とびも伸びます。';
  if (p.finaleDist != null && p.finaleDist < 6) return '最後の走り幅とびは、全力ダッシュのまま「ふみきり板」ぎりぎりでとぶと記録がのびます。';
  return 'ナイスラン！ 金のブロックでフィーバーに入ったまま、ふみきり板までかけぬけてみよう。';
}

// ---- ranking (this browser only)
let lastEntry = null;
const loadRanking = () => { const list = store.get(modeKey('ranking'), []); return Array.isArray(list) ? list : []; };
function renderRanking() {
  const list = loadRanking();
  const row = (r, i) => `<li class="${lastEntry && r.at === lastEntry.at ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${escapeHtml(r.name || 'NO NAME')}</span><span class="gr">${r.grade}</span><b>${Number(r.score).toLocaleString()}</b><em>${Number(r.time).toFixed(1)}s</em></li>`;
  const html = list.slice(0, 5).map(row).join('') || '<li class="empty">まだ記録がありません</li>';
  $('rank-list').innerHTML = html; $('result-rank').innerHTML = html;
  const best = store.get(modeKey('best'), null);
  $('best-score').textContent = best ? Number(best.score).toLocaleString() : '—';
  $('best-time').textContent = best ? `${Number(best.time).toFixed(1)} s` : '—';
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (mode !== 'result' || lastEntry || sim.p.over) return;
  const p = sim.p;
  const name = $('result-name').value.trim().slice(0, 16);
  $('player-name').value = name;
  lastEntry = { name, score: p.score, time: Math.round(p.time * 10) / 10, grade: gradeOf(level, p.score), at: Date.now() };
  const list = [...loadRanking(), lastEntry].sort((a, b) => b.score - a.score || a.time - b.time).slice(0, 30);
  store.set(modeKey('ranking'), list);
  const rank = list.indexOf(lastEntry) + 1;
  $('save-status').textContent = rank ? `${rank} 位で登録しました` : 'ランキング圏外（30位まで保存）';
  $('save-score').disabled = true;
  renderRanking();
});

// ---------------------------------------------------------------------------
// One simulation step
const AUTO_BOT = { cruise: 9 };          // ?autoplay=1: a fast run that stays under control
const DEMO_BOT = { cruise: 6.5 };       // jogs, dashes where a hole needs it, slows where the road says so
let stepDist = 0, stepSide = 0;
function stepOnce() {
  let inp;
  if (demo || AUTOPLAY) {
    inp = botInput(sim, advice, demo ? DEMO_BOT : AUTO_BOT);
    if (inp.jump) advice = { ...advice, jump: null };
  } else {
    inp = { accel: accelNow(), jump: input.jump };
    input.jump = false;
  }
  const p = sim.p, before = p.s;
  step(sim, inp);
  if (p.ground && p.vs > 1) {
    stepDist += Math.abs(p.s - before);
    if (stepDist > 0.85 + 0.75 * (p.vs / RULES.MAX_SPEED)) { stepDist = 0; stepSide ^= 1; if (!demo) audio.sfx.step(stepSide, p.vs >= RULES.DASH_SPEED); }
  }
  if (sim.events.length) {
    const events = sim.events.splice(0);
    for (const e of events) onEvent(e);
  }
}

// ---------------------------------------------------------------------------
// Camera: the runner's eyes
function updateCamera(dt, time) {
  const p = sim.p, moving = Math.min(1.6, p.vs / 9), wild = Math.max(0, Math.min(1, (p.vs - RULES.OVER_SPEED) / 3));
  cam.air += ((p.ground ? 0 : 1) - cam.air) * Math.min(1, dt * 7);
  cam.y += (p.y - cam.y) * Math.min(1, dt * (p.ground ? 22 : 60));
  // in the air the eyes drop to the landing spot (and to whatever is about to be stomped)
  const falling = !p.ground && p.y < p.airFromY - 1.5 && advice.land && !advice.land.ok;
  const wantPitch = -0.13 - 0.3 * cam.air - (falling ? 0.5 : 0) + cam.look;
  cam.pitch += (wantPitch - cam.pitch) * Math.min(1, dt * 6);
  cam.stride += dt * (5 + 9 * moving) * (p.ground ? Math.min(1, p.vs / 1.2) : 0);
  const bob = p.ground ? 0.032 * moving * Math.sin(cam.stride * 2) : 0;
  cam.shake = Math.max(0, cam.shake - dt * 1.8);
  cam.kick = Math.max(0, cam.kick - dt * 0.6);
  const sx = cam.shake * 0.12 * Math.sin(time * 71), sy = cam.shake * 0.1 * Math.sin(time * 57 + 1);
  camera.position.set(0.035 * moving * Math.sin(cam.stride) + sx, cam.y + RULES.EYE + bob - cam.kick + sy, -p.s - cam.dolly);
  camera.rotation.set(cam.pitch, 0, 0.012 * moving * Math.sin(cam.stride) + sx * 0.3);
  // the faster, the wider the view: a dash is felt at the edges of the screen
  // ... and past the speed that can be handled the picture stretches and shakes
  const fov = 68 + 10 * Math.min(1, moving) ** 2 + 12 * wild + (p.fever > 0 ? 3 : 0);
  if (p.fever <= 0) cam.shake = Math.max(cam.shake, 0.22 * wild);
  if (Math.abs(fov - camera.fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------------------
// Dock lamps and connection state (read-only)
const checkAccel = $('check-accel'), checkJump = $('check-jump');
let dockAt = 0;
function updateDock(now) {
  if (now - dockAt < 80) return;
  dockAt = now;
  const d = window.devices;
  let toe = now - input.keyJumpAt < 200;
  if (d) for (const id of [0, 1]) if (d[id].eulers && now - (d[id].at || 0) < SENSOR_STALE_MS && d[id].eulers.pitch < -window.pitchThresholdJump) toe = true;
  checkAccel.classList.toggle('on', accelNow());
  checkJump.classList.toggle('on', toe);
  for (const id of [0, 1]) {
    const sw = $(`switch_ble${id}`), group = $(`ui${id}`);
    const connected = !!(sw && sw.checked && group && group.style.visibility === 'visible');
    const connecting = !!(sw && sw.disabled && window.bles && window.bles[id] && window.bles[id]._coreToolkitConnecting);
    $(`dock-row-${id}`).classList.toggle('connected', connected);
    $(`dock-state-${id}`).textContent = connected ? '接続済 ✓' : connecting ? '接続中…' : '未接続';
  }
}

// ---------------------------------------------------------------------------
// Settings drawer, top bar
const drawer = $('drawer');
const openDrawer = (open) => { drawer.classList.toggle('open', open); drawer.setAttribute('aria-hidden', String(!open)); };
$('btn-settings').addEventListener('click', () => openDrawer(!drawer.classList.contains('open')));
$('close-drawer').addEventListener('click', () => openDrawer(false));
$('opt-assist').checked = settings.assist;
$('opt-assist').addEventListener('change', (e) => { settings.assist = e.target.checked; store.set('adventure.assist', settings.assist); });
$('opt-cues').checked = settings.cues;
$('opt-cues').addEventListener('change', (e) => { settings.cues = e.target.checked; store.set('adventure.cues', settings.cues); });
const volumeSlider = $('volume-slider');
volumeSlider.value = settings.volume;
const showVolume = () => { $('volume-value').textContent = `${Math.round(settings.volume * 100)}%`; };
showVolume(); audio.setVolume(settings.volume);
volumeSlider.addEventListener('input', (e) => { settings.volume = parseFloat(e.target.value); audio.setVolume(settings.volume); store.set('adventure.volume', settings.volume); showVolume(); });
if (QUERY.get('mute') === '1') audio.setMuted(true);
const soundBtn = $('btn-sound');
const showSound = () => { soundBtn.firstElementChild.className = audio.muted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill'; };
soundBtn.addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); showSound(); });
showSound();
$('btn-fullscreen').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen?.().catch(() => {}); });
const qualitySelect = $('quality-select');
qualitySelect.value = qualityMode;
qualitySelect.addEventListener('change', (e) => { qualityMode = e.target.value; store.set('adventure.quality', qualityMode); quality = qualityMode === 'auto' ? 'high' : qualityMode; resize(); });
const MODE_NOTE = {
  normal: 'ハートは3つ。<b>ミスするとスタートにもどる</b>（中間ポイントを通ったあとは、そこから）。ハートがなくなるとゲームオーバー。',
  easy: 'ミスしても その場から続行。同じ穴に2回落ちると「おたすけ橋」。<b>だれでもゴールできる</b>。',
};
function showMode() {
  document.querySelectorAll('#mode-switch button').forEach((b) => { const on = b.dataset.mode === gameMode; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  $('mode-note').innerHTML = MODE_NOTE[gameMode];
  $('hud-mode').textContent = gameMode === 'normal' ? 'NORMAL' : 'EASY　やさしい';
  $('rank-mode').textContent = gameMode === 'normal' ? 'NORMAL' : 'EASY';
}
document.querySelectorAll('#mode-switch button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.mode === gameMode || mode !== 'title') return;
  gameMode = b.dataset.mode;
  store.set('adventure.mode', gameMode);
  showMode();
  toTitle();
}));
showMode();
$('start-btn').addEventListener('click', startGame);
$('retry-btn').addEventListener('click', startGame);
$('title-btn').addEventListener('click', toTitle);
addEventListener('pointerdown', () => audio.unlock(), { once: true });

// ---------------------------------------------------------------------------
// Frame loop
let last = performance.now(), fpsFrames = 0, fpsTime = 0, slowChunks = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, Math.max(0, rawDt));
  wall += dt;

  // fps, and stepping the quality down on machines that cannot keep up
  fpsFrames++; fpsTime += rawDt;
  if (fpsTime >= 1) {
    const fps = fpsFrames / fpsTime;
    $('fps-value').textContent = `${Math.round(fps)} fps`;
    if (qualityMode === 'auto' && document.visibilityState === 'visible') {
      slowChunks = fps < 42 ? slowChunks + 1 : 0;
      if (slowChunks >= 3 && quality !== 'low') { quality = quality === 'high' ? 'medium' : 'low'; slowChunks = 0; resize(); console.log(`[ADVENTURE] quality -> ${quality} (${Math.round(fps)} fps)`); }
    }
    fpsFrames = 0; fpsTime = 0;
  }

  const active = (mode === 'play' || mode === 'title') && !sim.p.finished && !sim.p.over;
  if (active) {
    if (freeze > 0) freeze -= dt;
    else {
      acc += dt;
      let n = 0;
      while (acc >= RULES.DT && n++ < 7) {
        acc -= RULES.DT;
        // the demo player re-plans every other step, as the tests do, however many steps this frame takes
        if ((demo || AUTOPLAY) && n > 1 && n % 2 === 1) advice = advise(sim, cueMemo);
        stepOnce();
        if (freeze > 0 || sim.p.finished) { acc = 0; break; }
      }
      if (acc > RULES.DT * 2) acc = 0;
    }
    advice = advise(sim, cueMemo);
    if (mode === 'play' && !demo && !AUTOPLAY) releaseHeldJump();
  } else if (mode === 'countdown') {
    sampleRestingPitch();
    advice = advise(sim, cueMemo);
  }
  // after the goal: a moment to enjoy it, then the result (or, for the demo, start over)
  farthest = Math.max(farthest, sim.p.s);
  if (sim.p.over && mode === 'play') { if (wall >= resultAt) showResult(); }
  else if (sim.p.over && mode === 'title') { if (wall >= resultAt) toTitle(); }
  else if (sim.p.finished && mode !== 'result') {
    cam.look += (0.26 - cam.look) * Math.min(1, dt * 1.5);
    cam.dolly += dt * 1.2;
    if (wall >= resultAt) { if (demo) toTitle(); else showResult(); }
  } else if (mode === 'result') {
    cam.look += (0.3 - cam.look) * Math.min(1, dt * 1.5);
    cam.dolly = Math.min(4, cam.dolly + dt * 0.5);
  }

  const clock = mode === 'play' ? sim.t : wall;
  audio.tick(clock);
  const beat = (1 - ((clock / RULES.BEAT) % 1)) ** 3;
  updateCamera(dt, wall);
  world.update({
    sim, advice, dt, time: wall, beat, camera,
    hideMark: !settings.cues || sim.p.finished || sim.p.over, early: settings.assist,
    onHammer: demo ? null : (distance) => audio.sfx.hammer(distance),
  });
  body.update({ sim, dt, time: wall, visible: mode !== 'result' && !sim.p.over && !(sim.p.finished && cam.dolly > 0.4) });
  updateHud(dt);
  if (mode !== 'result') side.draw(sim, wall);
  updateDock(now);
  drawScopes(now);
  composer.render();
}

// ---------------------------------------------------------------------------
// Boot
window.ADVENTURE_BUILD = BUILD;
window.__adventure = {
  get sim() { return sim; }, get mode() { return mode; }, get advice() { return advice; }, get quality() { return quality; },
  start: startGame, title: toTitle, level, stats, get gameMode() { return gameMode; },
};
async function boot() {
  // ---- which sensor: ORPHE CORE (default) or ORPHE INSOLE. The choice is shared with SUPER VIRTUAL HURDLE.
  if (DEVICE === 'insole') {
    try {
      await loadInsoleSdk();
      insole = setupInsole();
    } catch (error) {
      console.error('[ADVENTURE] ORPHE INSOLE support could not be loaded; staying on ORPHE CORE.', error);
      insole = null;
    }
    if (insole) {
      // the adapter does not time-stamp its samples; accelNow() needs that to notice a sensor that dropped out
      for (const dev of insole.devices) {
        const inner = dev.gotConvertedAcc;
        dev.gotConvertedAcc = function (acc) { window.devices[this.id].at = performance.now(); const r = inner.call(this, acc); window.sensorTap(); return r; };
      }
      $('dock-title').textContent = 'ORPHE INSOLE';
      $('dock-hint').innerHTML = 'スイッチをONにしてINSOLEを選ぶ。操作はCOREと同じ：足ぶみで走る、つま先を上げてジャンプ。キーボードは <kbd>←</kbd> / <kbd>→</kbd>。';
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
  // the toolkits nest their Bootstrap settings modal inside the dock; move it out of the dock's stacking context
  for (const id of [0, 1]) { const modal = $(`settings_modal${id}`); if (modal) document.body.appendChild(modal); }

  resize();
  toTitle();
  requestAnimationFrame((t) => { last = t; frame(t); });
  setTimeout(() => { $('loading').classList.add('done'); }, 350);
  if (AUTOPLAY) setTimeout(startGame, 900);
  console.log(`[ADVENTURE] build ${BUILD} (sensor: ${device})`);
}
boot();
