// stage.js — the night stadium of GAME-SUPER-HURDLE, set up for the other track events.
//
// The stadium, the athletes, the post-processing and the sound engine are imported from
// ../GAME-SUPER-HURDLE/ as they are (no hurdles are built), so every event is held in the same
// place and improvements to the stadium reach all of them. This file owns what an event needs
// around them: the renderer, one first-person runner in lane 5, seven rivals, the camera and
// the per-frame update. Rules live in each game's main.js; nothing here decides anything.
//
// GAME-SUPER-RELAY imports this file too.
import * as THREE from 'three';
import { createWorld, laneX, PLAYER_LANE } from '../GAME-SUPER-HURDLE/world.js';
import { Runner, Rival, FirstPersonBody, newPose, poseRun, poseCrouch, lerpPose, BLOCK_Z } from '../GAME-SUPER-HURDLE/runner.js';
import { createFx } from '../GAME-SUPER-HURDLE/fx.js';
import { AudioEngine } from '../GAME-SUPER-HURDLE/audio.js';

export { THREE, laneX, PLAYER_LANE, BLOCK_Z, Runner, newPose, poseRun, poseCrouch, lerpPose };
export const EYE_H = 1.7;
export const MAX_SPEED = 12;          // m/s: the speed at which the camera effects are at full strength
export const TRACK_LEN = 110;         // the straight is built for the 110 m hurdles
const HURDLE_DIR = new URL('../GAME-SUPER-HURDLE/', import.meta.url);

const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

const RIVAL_LOOKS = [
  { skin: 0x8d5a3b, top: 0xd81e2c, shorts: 0xd81e2c, shoes: 0xf4f000, hair: 0x120c08 },
  { skin: 0xe0ac86, top: 0xf7d518, shorts: 0x0f6a36, shoes: 0xff5a1f, hair: 0x2a1a10 },
  { skin: 0x5c3a26, top: 0xf2f2f2, shorts: 0x15233f, shoes: 0x22e3ff, hair: 0x0c0806 },
  { skin: 0xc68d63, top: 0xff7a14, shorts: 0x111318, shoes: 0xb6ff3c, hair: 0x1a1210 },
  { skin: 0xf0c8a4, top: 0x2aa6e6, shorts: 0xf2f2f2, shoes: 0xff3d6e, hair: 0x6b4a22 },
  { skin: 0x70442c, top: 0x119a4a, shorts: 0xf2f2f2, shoes: 0xffd34d, hair: 0x0c0806 },
  { skin: 0xd9a47f, top: 0x7b3fd1, shorts: 0x111318, shoes: 0xffffff, hair: 0x1c1410 },
];
const PLAYER_LOOK = { skin: 0xe2b08c, top: 0x12c8e6, shorts: 0x0c0e14, shoes: 0x19e0ff, hair: 0x1c1410, accent: 0x19e0ff };

/** The hurdle game's sound engine plus the few sounds the start line needs. */
export class StageAudio extends AudioEngine {
  constructor() {
    super();
    this.cheerUrl = new URL('sound/sound-audience.mp3', HURDLE_DIR).href;
  }
  /** How long after a sound is scheduled "now" it actually leaves the speaker, in ms (0 if unknown). */
  outputDelayMs() {
    const c = this.ctx;
    if (!c) return 0;
    const s = (Number.isFinite(c.baseLatency) ? c.baseLatency : 0) + (Number.isFinite(c.outputLatency) ? c.outputLatency : 0);
    return Math.min(250, Math.max(0, s * 1000));
  }
  /** Two shots in quick succession: the recall after a false start. */
  recall() {
    if (!this.ctx) return;
    for (const dt of [0, 0.28]) {
      const t = this.now + dt;
      this.noise(t, { dur: 0.016, type: 'highpass', freq: 1200, gain: 0.9, attack: 0.0005, send: 1 });
      this.noise(t, { dur: 0.2, type: 'lowpass', freq: 5200, sweep: 500, gain: 0.8, attack: 0.001, send: 1 });
      this.tone(t, { f0: 130, f1: 38, glide: 0.16, dur: 0.4, gain: 0.85, attack: 0.001, send: 0.5 });
    }
  }
  /** A low buzzer under the red card. */
  foul() {
    if (!this.ctx) return;
    const t = this.now + 0.5;
    this.tone(t, { f0: 196, dur: 0.5, gain: 0.3, type: 'sawtooth', attack: 0.01, send: 0.4 });
    this.tone(t, { f0: 147, dur: 0.6, gain: 0.3, type: 'sawtooth', attack: 0.01, send: 0.4 });
  }
  /** A soft tick while a gauge fills (pitch 0..1). */
  tick01(p = 0) {
    if (!this.ctx) return;
    this.tone(this.now, { f0: 520 + 620 * p, dur: 0.06, gain: 0.09, attack: 0.002, dest: this.uiBus });
  }
  /**
   * A tone that follows a speed, so gaining and losing it can be heard: the pitch is the speed,
   * and it gets louder and brighter while the speed is changing.
   * speed 0..1; delta = change of that per second (positive = gaining).
   */
  speedTone(speed, delta = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    if (!this._rev) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'square';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
      const g = ctx.createGain(); g.gain.value = 0;
      const g2 = ctx.createGain(); g2.gain.value = 0.4;
      o1.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(this.sfxBus);
      o1.start(); o2.start();
      this._rev = { o1, o2, f, g };
    }
    const r = this._rev;
    const s = Math.min(1.1, Math.max(0, speed));
    const hz = 58 * Math.pow(2, 2.3 * s);
    r.o1.frequency.setTargetAtTime(hz, now, 0.05);
    r.o2.frequency.setTargetAtTime(hz * 1.5, now, 0.05);
    r.f.frequency.setTargetAtTime(240 + 2400 * s + 1400 * Math.max(0, delta), now, 0.05);
    r.g.gain.setTargetAtTime(s < 0.03 ? 0 : 0.018 + 0.05 * Math.min(1, Math.abs(delta) * 2.5), now, 0.07);
  }
  speedToneOff() { if (this._rev && this.ctx) this._rev.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }
  stopRace() { super.stopRace(); this.speedToneOff(); this.timeReset(); }
  /** Two rising notes: a speed step gained (i = which step, 0..). */
  gearUp(i = 0) {
    if (!this.ctx) return;
    const t = this.now, f = 523.25 * Math.pow(2, i / 6);
    this.tone(t, { f0: f, dur: 0.12, gain: 0.13, type: 'triangle', attack: 0.003, send: 0.3 });
    this.tone(t + 0.07, { f0: f * 1.5, dur: 0.2, gain: 0.13, type: 'triangle', attack: 0.003, send: 0.4 });
  }
  /** Two falling notes: a speed step lost. */
  gearDown(i = 0) {
    if (!this.ctx) return;
    const t = this.now, f = 392 * Math.pow(2, i / 6);
    this.tone(t, { f0: f, dur: 0.12, gain: 0.12, type: 'sawtooth', attack: 0.003 });
    this.tone(t + 0.08, { f0: f * 0.7, f1: f * 0.5, glide: 0.2, dur: 0.26, gain: 0.12, type: 'sawtooth', attack: 0.003 });
  }
  /** The swish of one arm stroke (power 0..1). */
  swish(power = 1, pan = 0) {
    if (!this.ctx) return;
    this.noise(this.now, { dur: 0.09, type: 'bandpass', freq: 1600 + 1800 * power, sweep: 700, q: 1.2, gain: 0.05 + 0.1 * power, attack: 0.01, pan });
  }
  /** Baton speed leaking away in rough hands: a short falling blip, lower the more is lost. */
  leak(amount = 0.5) {
    if (!this.ctx) return;
    const f = 520 - 260 * Math.min(1, amount);
    this.tone(this.now, { f0: f, f1: f * 0.6, glide: 0.12, dur: 0.14, gain: 0.1 + 0.1 * Math.min(1, amount), type: 'square', attack: 0.003, dest: this.uiBus });
  }
  /**
   * Time slowing down hard (dir = -1) or snapping back (dir = +1).
   *
   * Slowing is three things at once. The whole mix (crowd, music, wind, footsteps) is pulled
   * under a low-pass in a fifth of a second, as if the stadium had been shut behind glass. Over
   * it, straight to the output so it stays sharp, a bright hiss and a tone fall three octaves
   * ("shuuun") and land on a sub-bass thud. Then a thin ringing holds for as long as time is slow.
   * Snapping back reverses it: the filter opens, the sweep rises, a crash.
   */
  timeWarp(dir = -1) {
    if (!this.ctx || !this.warp) return;
    const ctx = this.ctx, t = this.now, ui = this.uiBus;
    const f = this.warp.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(200, f.value), t);
    if (dir < 0) {
      f.exponentialRampToValueAtTime(480, t + 0.2);
      this.noise(t, { dur: 0.5, type: 'bandpass', freq: 9000, sweep: 240, q: 1.8, gain: 0.7, attack: 0.004, dest: ui });
      this.tone(t, { f0: 1760, f1: 82, glide: 0.4, dur: 0.55, gain: 0.3, type: 'sawtooth', attack: 0.003, dest: ui });
      this.tone(t, { f0: 3520, f1: 164, glide: 0.4, dur: 0.5, gain: 0.14, type: 'sine', attack: 0.003, dest: ui });
      this.tone(t + 0.34, { f0: 110, f1: 28, glide: 0.6, dur: 1.3, gain: 0.95, attack: 0.008, dest: ui });
      this.noise(t + 0.34, { dur: 0.25, type: 'lowpass', freq: 400, gain: 0.5, attack: 0.004, dest: ui });
      if (!this._ring) {
        // the held breath: two close high partials beating slowly against each other
        const g = ctx.createGain(); g.gain.value = 0;
        const oscs = [3951, 3967, 5274].map((hz) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz; o.connect(g); o.start(); return o; });
        g.connect(ui);
        this._ring = { g, oscs };
      }
      this._ring.g.gain.cancelScheduledValues(t);
      this._ring.g.gain.setValueAtTime(0, t + 0.3);
      this._ring.g.gain.linearRampToValueAtTime(0.011, t + 0.9);
    } else {
      f.exponentialRampToValueAtTime(20000, t + 0.14);
      if (this._ring) { this._ring.g.gain.cancelScheduledValues(t); this._ring.g.gain.setTargetAtTime(0, t, 0.03); }
      this.noise(t, { dur: 0.24, type: 'bandpass', freq: 260, sweep: 9000, q: 1.4, gain: 0.6, attack: 0.01, dest: ui });
      this.tone(t, { f0: 82, f1: 1760, glide: 0.2, dur: 0.24, gain: 0.3, type: 'sawtooth', attack: 0.004, dest: ui });
      this.noise(t + 0.19, { dur: 0.7, type: 'highpass', freq: 5200, gain: 0.34, attack: 0.002, dest: ui, send: 0.5 });
      this.tone(t + 0.19, { f0: 150, f1: 46, glide: 0.2, dur: 0.4, gain: 0.8, attack: 0.002, dest: ui });
    }
  }
  /** Back to normal time at once, whatever was going on (a race abandoned in the middle of an exchange). */
  timeReset() {
    if (!this.ctx || !this.warp) return;
    const t = this.now;
    this.warp.frequency.cancelScheduledValues(t);
    this.warp.frequency.setTargetAtTime(20000, t, 0.03);
    if (this._ring) { this._ring.g.gain.cancelScheduledValues(t); this._ring.g.gain.setTargetAtTime(0, t, 0.03); }
  }
  /** Adds the time-warp filter over the whole mix, and a bus that bypasses it for the sounds that must stay clear. */
  init(context) {
    const had = !!this.ctx;
    super.init(context);
    if (had || !this.ctx || this.warp) return;
    const ctx = this.ctx;
    this.warp = ctx.createBiquadFilter();
    this.warp.type = 'lowpass'; this.warp.frequency.value = 20000; this.warp.Q.value = 1.1;
    this.master.disconnect();
    this.master.connect(this.warp);
    this.warp.connect(this.limiter);
    this.uiBus = ctx.createGain();
    this.uiBus.gain.value = 0.9;
    this.uiBus.connect(this.limiter);
  }
  /** Ascending chime: something went right (a clean exchange, a personal best). */
  chime(steps = 3) {
    if (!this.ctx) return;
    const t = this.now;
    [0, 4, 7, 12].slice(0, steps + 1).forEach((semi, i) => {
      const f = 587.33 * Math.pow(2, semi / 12);
      this.tone(t + i * 0.07, { f0: f, dur: 0.5, gain: 0.14, attack: 0.003, send: 0.5 });
      this.tone(t + i * 0.07, { f0: f * 2, dur: 0.25, gain: 0.05, attack: 0.003, send: 0.5 });
    });
  }
}

async function loadLogo() {
  try {
    const img = new Image();
    img.src = new URL('rogo.png', HURDLE_DIR).href;
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
  } catch { return null; }
}

const TITLE_SHOTS = [
  (t, p, l) => { p.set(0.3, 2.35 + 0.05 * t, 7.6 - 0.55 * t); l.set(0.4, 0.3, -30); return 52; },
  (t, p, l) => { p.set(6.2, 0.95 + 0.03 * t, -6 - 2.4 * t); l.set(-4, 1.0, -30 - 2.4 * t); return 46; },
  (t, p, l) => { p.set(9 - 0.4 * t, 7.5 + 0.35 * t, -124 + 1.0 * t); l.set(-2, 0.5, -72); return 50; },
  (t, p, l) => { p.set(-38 + 1.2 * t, 23 - 0.3 * t, 12); l.set(-16, 2, -66); return 56; },
];
const SHOT_SECONDS = 9.5;
const QUALITY = { high: 2, medium: 1.25, low: 0.85 };
const AUTO_STEPS = [1.5, 1.25, 1.0, 0.85, 0.7];

/**
 * Build the stadium. Resolves once the display font and the logo are in.
 * options: { canvas, labels: { event, tag, tagAccent }, rivalLanes }
 */
export async function createStage({ canvas, labels, rivalLanes = [2, 3, 4, 6, 7, 8, 9] }) {
  const fontReady = Promise.race([
    document.fonts.load('64px "Bebas Neue"').catch(() => {}),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  const [logo] = await Promise.all([loadLogo(), fontReady]);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.06, 900);
  scene.add(camera);

  const audio = new StageAudio();
  const world = createWorld({ scene, renderer, logoImage: logo, labels });
  const fx = createFx({ renderer, scene });
  const fxView = fx.createView(camera);

  // the runner: an eye point that the game moves, a shadow-only body and first-person arms
  const rig = new THREE.Object3D();
  rig.position.set(0, EYE_H, 0);
  const shadowBody = new Runner({ shadowOnly: true });
  scene.add(shadowBody.root);
  // the same runner as a visible figure, for events that film the runner from outside (stage.showHero)
  const hero = new Runner({ ...PLAYER_LOOK, bib: String(PLAYER_LANE) });
  hero.root.visible = false;
  scene.add(hero.root);
  const fpBody = new FirstPersonBody({ skin: PLAYER_LOOK.skin, accent: PLAYER_LOOK.accent });
  camera.add(fpBody.group);

  const rivals = rivalLanes.map((lane, i) => {
    const r = new Rival({ lane, x: laneX(lane), look: RIVAL_LOOKS[i % RIVAL_LOOKS.length], hurdleZ: [], finishZ: -TRACK_LEN });
    r.onStep = (rv) => {
      if (!stage.rivalSteps) return;
      const dx = rv.figure.root.position.x - rig.position.x, dz = rv.z - rig.position.z;
      audio.rivalStep(Math.max(-1, Math.min(1, dx / 2.5)), Math.hypot(dx, dz));
    };
    scene.add(r.figure.root);
    return r;
  });

  // presentation state
  // warp: a burst of radial blur (time slamming into slow motion, or out of it); decays by itself
  const v = { crouch: 0, crouchTarget: 0, fovKick: 0, flash: 0, hit: 0, fade: 0, trauma: 0, stepPhase: 0, settle: 0, settleTarget: 0, lookUp: 0, lookUpTarget: 0, warp: 0 };
  const cam = { mode: 'title', blend: 1, blendDur: 1, shot: 0, shotT: 0, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion(), fromFov: 55 };
  const tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), tQuat = new THREE.Quaternion();
  const tEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const lookM = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);
  const posePlayer = newPose(), poseA = newPose(), poseB = newPose();
  const perf = { mode: 'auto', step: 0, acc: 0, frames: 0, slow: 0, fps: 60 };
  let waveAt = 12;

  function pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    return Math.min(dpr, perf.mode !== 'auto' ? QUALITY[perf.mode] : AUTO_STEPS[perf.step]);
  }
  function layout() {
    const w = window.innerWidth, h = window.innerHeight, pr = pixelRatio();
    fx.setCanvasSize(w, h, pr);
    fxView.setSize(w, h, pr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function updateCamera(dt) {
    let fov = 55;
    const k = Math.min(1, stage.speed / MAX_SPEED);
    if (cam.mode === 'title') {
      cam.shotT += dt;
      if (cam.shotT > SHOT_SECONDS) { cam.shotT = 0; cam.shot = (cam.shot + 1) % TITLE_SHOTS.length; }
      fov = TITLE_SHOTS[cam.shot](cam.shotT, tPos, tLook);
      lookM.lookAt(tPos, tLook, UP);
      tQuat.setFromRotationMatrix(lookM);
      v.fade = Math.max(1 - cam.shotT / 0.7, (cam.shotT - (SHOT_SECONDS - 0.7)) / 0.7, 0);
    } else if (cam.mode === 'free') {
      // the game places the camera itself (stage.freeCam): close-ups, replays
      v.fade = Math.max(0, v.fade - dt * 2);
      const a = v.trauma * v.trauma, t = stage.time;
      tPos.copy(stage.freeCam.pos);
      tPos.x += a * 0.03 * Math.sin(t * 61); tPos.y += a * 0.03 * Math.sin(t * 73 + 1);
      lookM.lookAt(tPos, stage.freeCam.look, UP);
      tQuat.setFromRotationMatrix(lookM);
      fov = stage.freeCam.fov;
    } else if (cam.mode === 'chase') {
      // behind and a little above the runner's right shoulder
      v.fade = Math.max(0, v.fade - dt * 2);
      const sp = Math.PI * v.stepPhase;
      const a = v.trauma * v.trauma, t = stage.time;
      const low = Math.min(1, v.crouch * 1.3);
      tPos.set(
        rig.position.x + 0.5 + 0.02 * k * Math.sin(sp) + a * 0.05 * Math.sin(t * 61),
        rig.position.y - EYE_H + 1.95 - 0.85 * low + 0.03 * k * Math.abs(Math.sin(sp)) + 0.5 * v.settle + a * 0.06 * Math.sin(t * 73 + 1),
        rig.position.z + 3.1 - 0.9 * low - 0.35 * k,
      );
      // aimed low, so the runner sits above the instruction panel at the bottom of the screen
      tLook.set(rig.position.x + 0.05, rig.position.y - EYE_H + 0.7 - 0.3 * low + 1.0 * v.settle, rig.position.z - 7);
      lookM.lookAt(tPos, tLook, UP);
      tQuat.setFromRotationMatrix(lookM);
      fov = 60 + 20 * Math.pow(k, 1.5) + v.fovKick;
      fov += (56 - fov) * v.settle;
    } else {
      v.fade = Math.max(0, v.fade - dt * 2);
      const sp = Math.PI * v.stepPhase;
      const bob = 0.05 * k * Math.abs(Math.sin(sp)) - 0.03 * k;
      const sway = 0.03 * k * Math.sin(sp);
      const a = v.trauma * v.trauma;
      const t = stage.time;
      const crouchY = -0.8 * Math.min(1, v.crouch * 1.5);
      tPos.set(
        rig.position.x + sway + a * 0.05 * Math.sin(t * 61),
        rig.position.y + bob + crouchY + 0.45 * v.settle + a * 0.06 * Math.sin(t * 73 + 1),
        rig.position.z,
      );
      // settle: stand tall and take in the far stand and the big screen (results)
      // lookUp: lift the eyes from the track toward the lane ahead (the SET position)
      const pitch = -0.02 - 0.012 * k - 0.42 * v.crouch + 0.2 * v.settle + 0.16 * v.lookUp * v.crouch + a * 0.035 * Math.sin(t * 67 + 2);
      const yaw = a * 0.03 * Math.sin(t * 53 + 4) + (0.05 * Math.sin(t * 0.33) - 0.04) * v.settle;
      const roll = 0.011 * k * Math.sin(sp) + a * 0.05 * Math.sin(t * 59 + 3);
      fov = 70 + 13 * Math.pow(k, 1.5) + v.fovKick;
      fov += (60 - fov) * v.settle;
      tEuler.set(pitch, yaw, roll);
      tQuat.setFromEuler(tEuler);
    }
    if (cam.blend < 1) {
      cam.blend = Math.min(1, cam.blend + dt / cam.blendDur);
      const e = smooth(cam.blend);
      camera.position.lerpVectors(cam.fromPos, tPos, e);
      camera.quaternion.slerpQuaternions(cam.fromQuat, tQuat, e);
      camera.fov = cam.fromFov + (fov - cam.fromFov) * e;
    } else {
      camera.position.copy(tPos);
      camera.quaternion.copy(tQuat);
      camera.fov = fov;
    }
    // slide the vanishing point sideways so the scene sits beside the UI panel
    const w = window.innerWidth, h = window.innerHeight;
    const shift = stage.shift;
    if (Math.abs(shift) > 0.001) camera.setViewOffset(w, h, -shift * w, 0, w, h);
    else if (camera.view) camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  const stage = {
    renderer, scene, camera, world, fx, fxView, audio, rivals, rig, view: v, cam, perf,
    logo,
    time: 0,
    speed: 0,           // m/s, set by the game every frame; drives bob, arms, blur and footsteps
    timeScale: 1,       // < 1 = slow motion for everything that moves
    rivalScale: 1,      // extra factor for the rivals alone
    rivalSteps: false,  // rival footsteps audible
    shift: 0, shiftTarget: 0,
    footsteps: true,
    hero,                 // the runner as a visible figure
    showHero: false,      // film the runner from outside (use with the 'chase' or 'free' camera)
    freeCam: { pos: new THREE.Vector3(0, 2, 4), look: new THREE.Vector3(0, 1, 0), fov: 50 },
    poseHook: null,       // (pose) => void: adjust the runner's pose before it is applied
    afterPose: null,      // (dt, sdt) => void: called once the runner is posed, before the camera
    onFps: null,
    layout,
    /** 'title' = roaming stadium shots, 'fp' = through the runner's eyes, 'chase' = behind the runner, 'free' = stage.freeCam. */
    setCam(mode, blendDur = 1) {
      cam.fromPos.copy(camera.position);
      cam.fromQuat.copy(camera.quaternion);
      cam.fromFov = camera.fov;
      cam.mode = mode; cam.blend = 0; cam.blendDur = Math.max(0.001, blendDur);
      if (mode === 'title') { cam.shotT = 0; }
    },
    setQuality(q) { perf.mode = q; perf.step = 0; perf.slow = 0; layout(); },
    /** Put the runner back on the blocks. */
    resetRunner() {
      rig.position.set(0, EYE_H, 0);
      stage.speed = 0;
      Object.assign(v, { crouch: 0, crouchTarget: 0, fovKick: 0, flash: 0, hit: 0, trauma: 0, stepPhase: 0, settle: 0, settleTarget: 0, lookUp: 0, lookUpTarget: 0, warp: 0 });
    },
    /** Advance everything by one frame and draw it. rawDt in seconds. */
    frame(rawDt) {
      const dt = Math.min(rawDt, 0.05);
      const sdt = dt * stage.timeScale;
      stage.time += dt;
      const speed = stage.speed;
      const k = Math.min(1, speed / MAX_SPEED);

      // cadence drives footsteps, camera bob, arm swing and the runner's shadow
      const before = Math.floor(v.stepPhase);
      if (speed > 0.4) v.stepPhase += (1.4 + 2.6 * k) * sdt;
      if (Math.floor(v.stepPhase) !== before && speed > 3.0 && stage.footsteps) {
        audio.footstep(Math.floor(v.stepPhase) % 2 ? 1 : -1, 0.75 + 0.35 * k);
      }
      v.crouch += (v.crouchTarget - v.crouch) * Math.min(1, dt * (v.crouchTarget > v.crouch ? 3.2 : 2.6));
      v.settle += (v.settleTarget - v.settle) * Math.min(1, dt * 1.4);
      v.lookUp += (v.lookUpTarget - v.lookUp) * Math.min(1, dt * 3);
      v.trauma = Math.max(0, v.trauma - dt * 1.7);
      v.fovKick *= Math.exp(-dt / 0.35);
      v.warp *= Math.exp(-dt / 0.2);
      v.hit = Math.max(0, v.hit - dt * 0.8);
      v.flash = Math.max(0, v.flash - dt * 2.4);
      stage.shift += (stage.shiftTarget - stage.shift) * Math.min(1, dt * 2.5);

      const title = cam.mode === 'title';
      const phi = Math.PI * v.stepPhase;
      // the runner casts a shadow in first person; filmed from outside it is the visible figure
      shadowBody.root.visible = !title && !stage.showHero;
      hero.root.visible = !title && stage.showHero;
      if (!title) {
        poseRun(poseA, phi, Math.max(0.1, k), 0.12 + 0.2 * v.crouch);
        lerpPose(posePlayer, poseA, poseA, 0);
        if (v.crouch > 0.02) lerpPose(posePlayer, posePlayer, poseCrouch(poseB, Math.min(1, v.crouch * 1.2)), smooth(v.crouch * 1.4));
        if (stage.poseHook) stage.poseHook(posePlayer);
        const body = stage.showHero ? hero : shadowBody;
        body.root.position.set(rig.position.x, rig.position.y - EYE_H, rig.position.z + 0.12);
        body.apply(posePlayer);
        fpBody.update(phi, k, 0, 0);
        // the game's turn to place what depends on the runner's pose (a baton, a second runner, the camera)
        if (stage.afterPose) stage.afterPose(dt, sdt);
      }
      fpBody.group.visible = cam.mode === 'fp' && cam.blend > 0.85;

      updateCamera(dt);

      const U = fxView.uniforms;
      U.uSpeed.value = (title ? 0 : cam.mode === 'free' ? k * 0.25 : cam.mode === 'chase' ? k * 0.8 : k) + v.warp;
      U.uHit.value = v.hit;
      U.uFlash.value = v.flash;
      U.uFade.value = v.fade;
      U.uExhaust.value = 0;
      fxView.lines.update(sdt, rig.position.x, rig.position.z, title ? 0 : speed);
      fxView.lines.mesh.visible = fxView.lines.on;

      for (const r of rivals) r.update(sdt * stage.rivalScale);
      if (title) { waveAt -= dt; if (waveAt < 0) { waveAt = 26; world.startWave(); } }

      world.update(sdt);
      fx.update(sdt);
      audio.tick();

      renderer.setScissorTest(false);
      world.viewGuides(0);
      world.focusShadow(title ? camera.position.z + 5 : rig.position.z);
      world.preRender(camera);
      fxView.render(0, window.innerWidth, window.innerHeight);

      // resolution: start sharp, step down if the frame time says so
      perf.acc += rawDt; perf.frames++;
      if (perf.acc >= 0.5) {
        perf.fps = perf.frames / perf.acc;
        perf.acc = 0; perf.frames = 0;
        if (stage.onFps) stage.onFps(perf.fps, pixelRatio());
        if (perf.mode === 'auto' && !document.hidden) {
          perf.slow = perf.fps < 48 ? perf.slow + 1 : 0;
          if (perf.slow >= 4 && perf.step < AUTO_STEPS.length - 1) { perf.step++; perf.slow = 0; layout(); }
        }
      }
    },
    /** Compile every shader up front so the first seconds never hitch. */
    warmUp() {
      layout();
      updateCamera(0);
      renderer.compile(scene, camera);
    },
  };
  world.redrawText();
  window.addEventListener('resize', layout);
  return stage;
}

/**
 * The parts of the page chrome every event shares: sound / fullscreen / settings drawer buttons,
 * the volume and quality controls, UI blips and the CoreToolkit modal fix.
 * Expects the same element ids as GAME-SUPER-HURDLE.
 */
export function bindChrome(stage, { coreIds = [0] } = {}) {
  const $ = (id) => document.getElementById(id);
  const root = $('stage');
  const audio = stage.audio;
  const drawer = $('settings-drawer');
  const setDrawer = (open) => { drawer.classList.toggle('open', open); drawer.setAttribute('aria-hidden', open ? 'false' : 'true'); };
  $('btn-settings').addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
  $('open-settings')?.addEventListener('click', () => setDrawer(true));
  $('close-settings').addEventListener('click', () => setDrawer(false));

  const soundBtn = $('btn-sound');
  const syncSound = () => {
    soundBtn.classList.toggle('off', audio.muted);
    soundBtn.firstElementChild.className = audio.muted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill';
  };
  soundBtn.addEventListener('click', () => { audio.setMuted(!audio.muted); syncSound(); });
  syncSound();
  const vol = $('volume-slider'), volValue = $('volume-value');
  vol.value = String(audio.volume);
  volValue.textContent = `${Math.round(audio.volume * 100)}%`;
  vol.addEventListener('input', () => { audio.setVolume(parseFloat(vol.value)); volValue.textContent = `${Math.round(audio.volume * 100)}%`; });

  const fsBtn = $('btn-fullscreen');
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    fsBtn.firstElementChild.className = document.fullscreenElement ? 'bi bi-fullscreen-exit' : 'bi bi-arrows-fullscreen';
  });
  $('quality-select').addEventListener('change', (e) => stage.setQuality(e.target.value));
  const fpsValue = $('fps-value');
  stage.onFps = (fps, pr) => { if (fpsValue) fpsValue.textContent = `${Math.round(fps)} fps · ${pr.toFixed(2)}x`; };

  const CLICKABLE = '.hx-btn, .icon-btn, .dock-link, .back-button, .mode-btn';
  let lastHover = null;
  root.addEventListener('pointerover', (e) => {
    const b = e.target.closest?.(CLICKABLE);
    if (b && b !== lastHover) audio.ui('hover');
    lastHover = b;
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest?.(CLICKABLE);
    if (b && !b.dataset.quiet) audio.ui('click');
  });

  // CoreToolkit nests its Bootstrap settings modal inside the toolkit element. Re-parent it to
  // <body> so the dock's own stacking context cannot trap it behind the modal backdrop.
  for (const id of coreIds) {
    const modal = $(`settings_modal${id}`);
    if (modal) document.body.appendChild(modal);
  }
  // connection state of each CORE slot, read from the toolkit's own switch
  const connected = (id) => {
    const sw = $(`switch_ble${id}`), group = $(`ui${id}`);
    return !!(sw && sw.checked && group && group.style.visibility === 'visible');
  };
  setInterval(() => {
    for (const id of coreIds) {
      const sw = $(`switch_ble${id}`);
      const on = connected(id);
      const connecting = !!(sw && sw.disabled && window.bles?.[id]?._coreToolkitConnecting);
      $(`dock-row-${id}`)?.classList.toggle('connected', on);
      const st = $(`dock-state-${id}`);
      if (st) st.textContent = on ? '接続済 ✓' : connecting ? '接続中…' : '未接続';
    }
  }, 300);

  // browsers only allow audio after a gesture: the first click / key starts the ambience
  const unlock = () => {
    const first = !audio.ready;
    audio.init();
    if (first) root.dispatchEvent(new CustomEvent('audio-ready'));
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  return {
    setDrawer, connected,
    setScreen(name) { root.dataset.screen = name; },
    setCinema(on) { root.classList.toggle('cinema', on); },
    loadingDone() { $('loading').classList.add('done'); },
    loadingFailed() {
      const l = $('loading');
      l.classList.add('error');
      l.querySelector('.loading-text').textContent = '読み込みに失敗しました。ページを再読み込みしてください / Failed to load';
    },
  };
}

/**
 * Feed a MotionTracker from one ORPHE CORE. The SDK delivers acceleration and gyro for a sample
 * in two callbacks (acc first); they are joined here and put on the page clock.
 * Existing callbacks on the device are kept and still called.
 */
export function attachCore(ble, tracker, clock, onSample) {
  if (!ble) return;
  let acc = null;
  const prevAcc = ble.gotConvertedAcc, prevGyro = ble.gotConvertedGyro;
  ble.gotConvertedAcc = function (a) {
    acc = a;
    if (typeof prevAcc === 'function') prevAcc.call(this, a);
  };
  ble.gotConvertedGyro = function (g) {
    if (acc && g) {
      const arrival = performance.now();
      const t = clock.map(g.timestamp, arrival);
      const f = tracker.push({ t, ax: acc.x, ay: acc.y, az: acc.z, gx: g.x, gy: g.y, gz: g.z });
      // 4th argument: how much later than the fastest delivery this sample arrived, in ms
      if (onSample) onSample(f, acc, g, arrival - t);
    }
    if (typeof prevGyro === 'function') prevGyro.call(this, g);
  };
}
