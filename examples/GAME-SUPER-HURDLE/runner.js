// runner.js — procedural athletes.
//
// One jointed figure is used three ways: the rival sprinters, an invisible
// copy of the player that only casts a shadow (so you can see yourself run),
// and the first-person arms / lead leg attached to the camera.
// Figures face -z (the running direction). Joint conventions:
//   hip / shoulder rotation.x > 0 swings the limb forward,
//   knee rotation.x < 0 folds the shin back, elbow rotation.x > 0 folds the forearm up.
import * as THREE from 'three';

const HIP_Y = 0.93;
const THIGH = 0.44, SHIN = 0.43, UPPER = 0.29, FORE = 0.26;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- poses
// A pose is a flat set of joint angles so different motions can be blended.
export function newPose() {
  return {
    hipsY: HIP_Y, hipsRy: 0, torsoX: 0, torsoY: 0, headX: 0,
    leg: [0, 0, 0, 0, 0, 0, 0, 0],   // [hipX, hipZ, knee, ankle] x (left, right)
    arm: [0, 0, 0, 0, 0, 0],         // [shoulderX, shoulderZ, elbow] x (left, right)
  };
}
export function lerpPose(out, a, b, t) {
  out.hipsY = lerp(a.hipsY, b.hipsY, t); out.hipsRy = lerp(a.hipsRy, b.hipsRy, t);
  out.torsoX = lerp(a.torsoX, b.torsoX, t); out.torsoY = lerp(a.torsoY, b.torsoY, t);
  out.headX = lerp(a.headX, b.headX, t);
  for (let i = 0; i < 8; i++) out.leg[i] = lerp(a.leg[i], b.leg[i], t);
  for (let i = 0; i < 6; i++) out.arm[i] = lerp(a.arm[i], b.arm[i], t);
  return out;
}
/** Sprint cycle. phi advances 2π per stride (two steps), k is effort 0..1, lean in radians. */
export function poseRun(P, phi, k, lean = 0.14) {
  for (let s = 0; s < 2; s++) {
    const p = phi + s * Math.PI;
    const o = s * 4;
    P.leg[o] = (0.2 + 0.85 * Math.sin(p)) * k;
    P.leg[o + 1] = 0;
    P.leg[o + 2] = -(0.1 + (0.2 + 1.6 * Math.pow(Math.max(0, Math.cos(p + 0.45)), 1.4)) * k);
    P.leg[o + 3] = (0.12 - 0.55 * Math.max(0, -Math.sin(p))) * k;
    const q = p + Math.PI; // each arm swings with the opposite leg
    const a = s * 3;
    P.arm[a] = lerp(0.0, 0.05 + 0.95 * Math.sin(q), k);
    P.arm[a + 1] = (s === 0 ? -1 : 1) * 0.07;
    P.arm[a + 2] = lerp(0.2, 1.5 + 0.4 * Math.sin(q), k);
  }
  P.torsoX = -lean;
  P.torsoY = 0.16 * k * Math.sin(phi);
  P.hipsRy = -0.12 * k * Math.sin(phi);
  P.hipsY = HIP_Y - 0.035 * k + 0.04 * k * Math.cos(2 * phi + 0.5);
  P.headX = lean * 0.7;
  return P;
}
/** Hurdle clearance, u = 0 (take-off) .. 1 (landing). Left leg leads. */
export function poseHurdle(P, u, lean = 0.14) {
  const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
  P.leg[0] = 1.55 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.12)), 0.8);
  P.leg[1] = 0;
  P.leg[2] = -(0.2 + 0.7 * (1 - arc));
  P.leg[3] = 0.25;
  P.leg[4] = -0.7 + 1.7 * u;
  P.leg[5] = 1.1 * arc;
  P.leg[6] = -1.9;
  P.leg[7] = -0.2;
  P.arm[0] = -0.8; P.arm[1] = -0.2; P.arm[2] = 1.3;
  P.arm[3] = 1.25; P.arm[4] = 0.1; P.arm[5] = 0.45;
  P.torsoX = -(lean + 0.5 * arc);
  P.torsoY = 0.1; P.hipsRy = 0;
  P.hipsY = HIP_Y + 0.36 * arc;
  P.headX = (lean + 0.5 * arc) * 0.8;
  return P;
}
/** Start blocks. c = 0 "on your marks" (kneeling), c = 1 "set" (hips up). */
export function poseCrouch(P, c) {
  const pitch = lerp(1.2, 1.72, c);
  P.hipsY = lerp(0.5, 0.74, c); P.hipsRy = 0;
  P.torsoX = -pitch; P.torsoY = 0; P.headX = lerp(0.85, 0.55, c);
  P.leg[0] = lerp(1.25, 0.95, c); P.leg[1] = 0; P.leg[2] = -lerp(2.1, 1.55, c); P.leg[3] = -0.5;
  P.leg[4] = lerp(0.35, 0.2, c); P.leg[5] = 0; P.leg[6] = -lerp(1.75, 1.15, c); P.leg[7] = -0.7;
  P.arm[0] = pitch; P.arm[1] = -0.12; P.arm[2] = 0.04;
  P.arm[3] = pitch; P.arm[4] = 0.12; P.arm[5] = 0.04;
  return P;
}

// ---------------------------------------------------------------- figure
const geoCache = new Map();
function limbGeo(rTop, rBot, len) {
  const key = `l${rTop}:${rBot}:${len}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(rTop, rBot, len, 10, 1).translate(0, -len / 2, 0));
  return geoCache.get(key);
}
function ballGeo(r) {
  const key = `b${r}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.SphereGeometry(r, 14, 10));
  return geoCache.get(key);
}
function boxGeo(w, h, d) {
  const key = `x${w}:${h}:${d}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(key);
}
// Shadow-only material: skipped by the colour and depth passes, but the
// shadow map renders with its own depth material so the figure still casts.
const SHADOW_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

function bibTexture(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6f4ee'; ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = '#0a0c12'; ctx.font = '84px "Bebas Neue", "Arial Narrow", Impact, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Runner {
  constructor({ skin = 0xd9a47f, top = 0x1560ff, shorts = 0x111318, shoes = 0xff4a1c, hair = 0x1c1410, bib = '', shadowOnly = false } = {}) {
    const mat = (color, roughness = 0.62) => (shadowOnly ? SHADOW_ONLY : new THREE.MeshStandardMaterial({ color, roughness }));
    const mSkin = mat(skin, 0.55), mTop = mat(top, 0.7), mShorts = mat(shorts, 0.7), mShoes = mat(shoes, 0.45), mHair = mat(hair, 0.9);
    const add = (parent, geo, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    this.root = new THREE.Group();
    this.hips = new THREE.Group();
    this.root.add(this.hips);
    add(this.hips, ballGeo(0.125), mShorts, 0, -0.01, 0, 1.25, 0.82, 0.92);
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const chestGeo = geoCache.get('chest') || geoCache.set('chest', new THREE.CapsuleGeometry(0.125, 0.25, 6, 14)).get('chest');
    add(this.torso, chestGeo, mTop, 0, 0.27, 0, 1.22, 1, 0.74);
    add(this.torso, limbGeo(0.045, 0.052, 0.1), mSkin, 0, 0.6, 0);
    this.head = new THREE.Group();
    this.head.position.set(0, 0.6, 0);
    this.torso.add(this.head);
    add(this.head, ballGeo(0.105), mSkin, 0, 0.1, -0.01, 0.9, 1.08, 0.98);
    const hairGeo = geoCache.get('hair') || geoCache.set('hair', new THREE.SphereGeometry(0.109, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)).get('hair');
    const hairMesh = add(this.head, hairGeo, mHair, 0, 0.105, 0.0, 0.93, 1.1, 1.02);
    hairMesh.rotation.x = 0.35;
    if (bib && !shadowOnly) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), new THREE.MeshStandardMaterial({ map: bibTexture(bib), roughness: 0.8 }));
      plate.position.set(0, 0.3, 0.096);
      this.torso.add(plate);
    }
    this.arms = [];
    this.legs = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.2, 0.46, 0);
      this.torso.add(shoulder);
      add(shoulder, ballGeo(0.056), mSkin);
      add(shoulder, limbGeo(0.046, 0.038, UPPER), mSkin);
      const elbow = new THREE.Group();
      elbow.position.y = -UPPER;
      shoulder.add(elbow);
      add(elbow, ballGeo(0.038), mSkin);
      add(elbow, limbGeo(0.036, 0.027, FORE), mSkin);
      add(elbow, ballGeo(0.04), mSkin, 0, -FORE - 0.025, 0, 0.85, 1.1, 1);
      this.arms.push({ shoulder, elbow });

      const hip = new THREE.Group();
      hip.position.set(side * 0.09, -0.02, 0);
      this.hips.add(hip);
      add(hip, limbGeo(0.08, 0.056, THIGH), mSkin);
      add(hip, limbGeo(0.087, 0.073, 0.21), mShorts);
      const knee = new THREE.Group();
      knee.position.y = -THIGH;
      hip.add(knee);
      add(knee, ballGeo(0.055), mSkin);
      add(knee, limbGeo(0.052, 0.034, SHIN), mSkin);
      const ankle = new THREE.Group();
      ankle.position.y = -SHIN;
      knee.add(ankle);
      add(ankle, boxGeo(0.085, 0.065, 0.25), mShoes, 0, -0.035, -0.075);
      this.legs.push({ hip, knee, ankle });
    }
    this.pose = newPose();
  }

  apply(P = this.pose) {
    this.hips.position.y = P.hipsY;
    this.hips.rotation.y = P.hipsRy;
    this.torso.rotation.set(P.torsoX, P.torsoY, 0);
    this.head.rotation.x = P.headX;
    for (let s = 0; s < 2; s++) {
      const L = this.legs[s], o = s * 4;
      L.hip.rotation.set(P.leg[o], 0, P.leg[o + 1]);
      L.knee.rotation.x = P.leg[o + 2];
      L.ankle.rotation.x = P.leg[o + 3];
      const A = this.arms[s], a = s * 3;
      A.shoulder.rotation.set(P.arm[a], 0, P.arm[a + 1]);
      A.elbow.rotation.x = P.arm[a + 2];
    }
  }
}

// ---------------------------------------------------------------- rivals
const tmpA = newPose(), tmpB = newPose(), tmpC = newPose();
const TAU_ACCEL = 1.25;         // seconds: how quickly a sprinter approaches top speed
export const BLOCK_Z = 0.5;     // root position on the blocks (hands just behind the line)

export class Rival {
  constructor({ lane, x, look, hurdleZ, finishZ }) {
    this.lane = lane;
    this.figure = new Runner({ ...look, bib: String(lane) });
    this.figure.root.position.set(x, 0, BLOCK_Z);
    this.hurdleZ = hurdleZ;
    this.finishZ = finishZ;
    this.onStep = null;
    this.reset(14);
  }
  reset(targetTime, reaction = 0.16) {
    this.targetTime = targetTime;
    this.reaction = reaction;
    const T = targetTime - reaction;
    const dist = BLOCK_Z - this.finishZ;
    this.vmax = dist / (T - TAU_ACCEL * (1 - Math.exp(-T / TAU_ACCEL)));
    this.t = 0; this.s = 0; this.v = 0; this.phi = Math.random() * 6;
    this.crouch = 0; this.crouchTarget = 0;
    this.started = false; this.finished = false; this.finishTime = null;
    this.steps = 0;
    this.figure.root.position.z = BLOCK_Z;
    this.figure.apply(poseCrouch(this.figure.pose, 0));
  }
  get z() { return this.figure.root.position.z; }
  setCrouch(target) { this.crouchTarget = target; }
  start() { this.started = true; this.t = 0; }
  /** dt is already scaled by any slow-motion. Finish times are measured on the rival's own clock. */
  update(dt) {
    const P = this.figure.pose;
    this.crouch += (this.crouchTarget - this.crouch) * Math.min(1, dt * 5);
    if (!this.started) {
      this.figure.apply(poseCrouch(P, this.crouch));
      return;
    }
    this.t += dt;
    const t = this.t - this.reaction;
    if (t <= 0) { this.figure.apply(poseCrouch(P, this.crouch)); return; }
    const prevZ = this.z;
    if (!this.finished) {
      this.v = this.vmax * (1 - Math.exp(-t / TAU_ACCEL));
    } else {
      this.v = Math.max(0, this.v - (this.v * 0.4 + 0.45) * dt);
    }
    const z = prevZ - this.v * dt;
    this.figure.root.position.z = z;
    if (!this.finished && z <= this.finishZ) {
      this.finished = true;
      const over = (this.finishZ - z) / Math.max(0.01, this.v);
      this.finishTime = this.t - over;
    }
    const k = Math.min(1, this.v / 9.5);
    const cadence = 2.0 + 2.5 * k;                 // steps per second
    const before = Math.floor(this.phi / Math.PI);
    this.phi += Math.PI * cadence * dt;
    if (Math.floor(this.phi / Math.PI) !== before && this.onStep && this.v > 1.5) this.onStep(this);
    const lean = 0.13 + 0.6 * Math.exp(-t / 1.0);
    // after the line: ease down to a standing, breathing figure instead of a frozen stride
    const effort = this.finished ? k : Math.max(0.12, k);
    poseRun(tmpA, this.phi, effort, this.finished ? lean + 0.05 * Math.sin(this.t * 3.1) * (1 - k) : lean);
    // hurdle clearance window around each barrier
    let w = 0, u = 0;
    if (!this.finished) {
      for (const hz of this.hurdleZ) {
        const d = z - hz;
        if (d < 2.2 && d > -1.5) { u = (2.2 - d) / 3.7; w = smooth(u / 0.16) * smooth((1 - u) / 0.2); break; }
      }
    }
    if (w > 0) lerpPose(P, tmpA, poseHurdle(tmpB, u, lean), w);
    else lerpPose(P, tmpA, tmpA, 0);
    if (t < 0.5) lerpPose(P, poseCrouch(tmpC, 1), P, smooth(t / 0.5));
    this.figure.apply(P);
  }
}

// ---------------------------------------------------------------- first-person limbs
export class FirstPersonBody {
  constructor({ skin = 0xe2b08c, shoes = 0x10131a, accent = 0x19e0ff } = {}) {
    const mSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.55 });
    const mBand = new THREE.MeshStandardMaterial({ color: 0x05080c, roughness: 0.4, emissive: accent, emissiveIntensity: 0.7 });
    const mShoe = new THREE.MeshStandardMaterial({ color: shoes, roughness: 0.4 });
    const mGlove = new THREE.MeshStandardMaterial({ color: 0x151920, roughness: 0.55 });
    const mSole = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: accent, emissiveIntensity: 1.7 });
    const mShorts = new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.7 });
    const add = (parent, geo, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      parent.add(m);
      return m;
    };
    this.group = new THREE.Group();
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.215, -0.2, 0.07);
      this.group.add(shoulder);
      add(shoulder, limbGeo(0.048, 0.04, UPPER), mSkin);
      const elbow = new THREE.Group();
      elbow.position.y = -UPPER;
      shoulder.add(elbow);
      add(elbow, ballGeo(0.04), mSkin);
      add(elbow, limbGeo(0.038, 0.03, FORE), mSkin);
      add(elbow, limbGeo(0.0335, 0.0325, 0.022), mBand, 0, -FORE + 0.05, 0);
      // gloved fist: reads as a hand without needing finger geometry
      add(elbow, ballGeo(0.044), mGlove, 0, -FORE - 0.03, 0, 0.92, 1.12, 1.08);
      add(elbow, boxGeo(0.05, 0.008, 0.02), mBand, 0, -FORE - 0.045, -0.043);
      this.arms.push({ shoulder, elbow, side });
    }
    // Lead leg: only swings into view while clearing a hurdle.
    this.hip = new THREE.Group();
    this.hip.position.set(-0.09, -0.8, 0.04);
    this.group.add(this.hip);
    add(this.hip, limbGeo(0.085, 0.06, THIGH), mSkin);
    add(this.hip, limbGeo(0.092, 0.078, 0.22), mShorts);
    this.knee = new THREE.Group();
    this.knee.position.y = -THIGH;
    this.hip.add(this.knee);
    add(this.knee, ballGeo(0.058), mSkin);
    add(this.knee, limbGeo(0.054, 0.036, SHIN), mSkin);
    const ankle = new THREE.Group();
    ankle.position.y = -SHIN;
    ankle.rotation.x = 0.35;
    this.knee.add(ankle);
    add(ankle, boxGeo(0.1, 0.075, 0.28), mShoe, 0, -0.03, -0.08);
    add(ankle, boxGeo(0.104, 0.018, 0.285), mSole, 0, -0.075, -0.08);
    this.hip.visible = false;
  }
  /**
   * phi: stride phase (2π per two steps), k: effort 0..1,
   * air: 0..1 blend into the hurdling pose, u: progress through the jump 0..1.
   */
  update(phi, k, air, u) {
    const kk = smooth(k / 0.3);
    for (const arm of this.arms) {
      const q = phi + (arm.side < 0 ? Math.PI : 0);
      // fists only flick into the bottom of the frame at the top of each swing
      const runSh = lerp(-0.25, 0.15 + 0.65 * Math.sin(q), kk);
      const runEl = lerp(0.5, 1.45 + 0.2 * Math.sin(q), kk);
      // in the air the right arm reaches forward over the lead (left) knee
      const airSh = arm.side > 0 ? 0.85 : -0.75;
      const airEl = arm.side > 0 ? 1.0 : 1.4;
      arm.shoulder.rotation.set(lerp(runSh, airSh, air), 0, arm.side * 0.1);
      arm.elbow.rotation.x = lerp(runEl, airEl, air);
    }
    this.hip.visible = air > 0.02;
    if (this.hip.visible) {
      const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
      this.hip.rotation.x = lerp(0.3, 1.78, air * (0.55 + 0.45 * arc));
      this.knee.rotation.x = -lerp(1.3, 0.22, air * arc);
    }
  }
}
