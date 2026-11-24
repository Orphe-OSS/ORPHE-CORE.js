// poses.js — how the jumper's body moves, on top of the sprint cycle of GAME-SUPER-HURDLE/runner.js.
//
// A pose is the flat set of joint angles of runner.js (newPose): the same pose drives the figure
// seen in the replay and the body the player looks down at in first person.
//   hip / shoulder > 0 swings the limb forward, knee < 0 folds the shin back,
//   elbow > 0 folds the forearm up, torsoX < 0 leans forward.
import { newPose, poseRun, lerpPose } from '../GAME-SUPER-HURDLE/runner.js';

const HIP_Y = 0.93;
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const A = newPose(), B = newPose();

function key(hipsY, torsoX, headX, leg, arm) {
  const P = newPose();
  P.hipsY = hipsY; P.torsoX = torsoX; P.headX = headX;
  P.leg = [leg[0], 0, leg[1], leg[2], leg[3], 0, leg[4], leg[5]];
  P.arm = [arm[0], -0.1, arm[1], arm[2], 0.1, arm[3]];
  return P;
}
/** Blend along a list of [u, pose] keys. */
function along(out, keys, u) {
  if (u <= keys[0][0]) return lerpPose(out, keys[0][1], keys[0][1], 0);
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) return lerpPose(out, keys[i - 1][1], keys[i][1], smooth((u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  }
  const last = keys[keys.length - 1][1];
  return lerpPose(out, last, last, 0);
}

// ---- the long jump (and the last phase of the triple jump): drive, hang, pike, reach
//                  hipsY  torso  head   [L hip, knee, ankle, R hip, knee, ankle]   [L sh, elbow, R sh, elbow]
const DRIVE = key(HIP_Y, -0.02, 0.0, [1.35, -1.5, 0.2, -0.55, -0.25, -0.5], [-0.7, 1.2, 1.7, 1.0]);
const HANG = key(HIP_Y, 0.2, -0.25, [-0.3, -1.15, -0.3, -0.35, -1.2, -0.3], [2.85, 0.25, 2.85, 0.25]);
const PIKE = key(HIP_Y, -0.72, 0.5, [1.45, -0.4, 0.3, 1.45, -0.4, 0.3], [1.5, 0.2, 1.5, 0.2]);
const REACH = key(HIP_Y, -0.95, 0.6, [1.62, -0.12, 0.45, 1.62, -0.12, 0.45], [0.9, 0.1, 0.9, 0.1]);
const DROP = key(HIP_Y, -0.35, 0.3, [1.0, -1.0, 0.1, 1.0, -1.0, 0.1], [0.6, 0.5, 0.6, 0.5]);       // legs let go early: no reach
const SAT_FWD = key(0.31, -0.42, 0.2, [1.95, -2.25, 0.3, 1.95, -2.25, 0.3], [1.25, 0.45, 1.25, 0.45]);  // through the heels, falling forward
const SAT_BACK = key(0.3, 0.28, -0.1, [1.5, -1.3, 0.2, 1.5, -1.3, 0.2], [-0.9, 0.3, -0.9, 0.3]);     // sat back on the hands

/** The flight of a jump, u = 0 (take-off) .. 1 (the sand). reach 0..1: how well the legs are thrown forward at the end. */
export function poseFlight(P, u, reach = 1) {
  lerpPose(B, DROP, REACH, reach);
  return along(P, [[0, DRIVE], [0.14, DRIVE], [0.48, HANG], [0.62, HANG], [0.86, PIKE], [1, B]], u);
}
/** In the sand, w = 0 (touch) .. 1 (settled). q = quality of the landing. */
export function poseLanded(P, w, q = 1) {
  lerpPose(A, DROP, REACH, q);
  lerpPose(B, SAT_BACK, SAT_FWD, smooth(q * 1.6));
  return lerpPose(P, A, B, smooth(w));
}

// ---- hop and step: the sprint cycle, opened up and slowed down
// Phase of the cycle (poseRun's phi): the left leg pushes off at 1.5π and strikes at 0.6π.
const TWO_PI = Math.PI * 2;
function bound(P, phi, lift) {
  poseRun(P, phi, 1, 0.06);
  for (const o of [0, 4]) { P.leg[o] *= 1.18; }
  // both arms swing up through the flight
  P.arm[0] = P.arm[0] * 0.7 + 0.3 * lift; P.arm[3] = P.arm[3] * 0.7 + 0.3 * lift;
  P.torsoX = -0.05; P.headX = 0.03; P.hipsY = HIP_Y;
  return P;
}
/** The hop: off the left foot and back onto it. u = 0..1. */
export function poseHop(P, u) { return bound(P, Math.PI * (1.5 + 1.1 * smooth(u)), Math.sin(Math.PI * u)); }
/** The step: off the left foot, a long held split, onto the right. u = 0..1. */
export function poseStep(P, u) { return bound(P, Math.PI * (1.5 + 0.1 * smooth(u)), Math.sin(Math.PI * u)); }
/** On the ground between two phases (i = 0 after the hop, 1 after the step), w = 0..1 through the contact. */
export function poseStance(P, i, w) {
  const from = i === 0 ? 0.6 : 1.6, to = i === 0 ? 1.5 : 2.5;
  bound(P, Math.PI * (from + (to - from) * w), 0);
  P.hipsY = HIP_Y - 0.07 * Math.sin(Math.PI * w);
  return P;
}
/** The last phase of the triple jump leaves from the right foot: the long-jump flight, mirrored. */
export function mirror(P) {
  for (let k = 0; k < 4; k++) { const t = P.leg[k]; P.leg[k] = P.leg[k + 4]; P.leg[k + 4] = t; }
  for (let k = 0; k < 3; k++) { const t = P.arm[k]; P.arm[k] = P.arm[k + 3]; P.arm[k + 3] = t; }
  P.leg[1] = -P.leg[1]; P.leg[5] = -P.leg[5]; P.arm[1] = -0.1; P.arm[4] = 0.1;
  return P;
}

// ---- on the runway before the run: rocking back and forth, clapping overhead to ask for the rhythm
const STAND = key(HIP_Y, -0.04, 0.0, [0.3, -0.12, 0, -0.22, -0.1, 0.1], [0.05, 0.15, 0.05, 0.15]);
const ROCK = key(HIP_Y - 0.03, -0.14, 0.05, [0.42, -0.35, 0, -0.1, -0.2, 0.05], [-0.25, 0.5, 0.3, 0.6]);
/** t = seconds, clap = 0..1 (1 = hands together overhead), raise = 0..1 arms up. */
export function poseReady(P, t, raise = 0, clap = 0) {
  lerpPose(P, STAND, ROCK, 0.5 + 0.5 * Math.sin(t * 2.1));
  if (raise > 0) {
    const up = 2.75, e = 0.55 - 0.4 * clap;
    P.arm[0] += (up - P.arm[0]) * raise; P.arm[3] += (up - P.arm[3]) * raise;
    P.arm[2] += (e - P.arm[2]) * raise; P.arm[5] += (e - P.arm[5]) * raise;
    P.arm[1] = -0.1 + raise * (0.32 - 0.34 * clap); P.arm[4] = 0.1 - raise * (0.32 - 0.34 * clap);
  }
  return P;
}
/** After a foul or a run-through: jogging out, shoulders dropped. */
export function poseSlump(P, phi) {
  poseRun(P, phi, 0.35, 0.2);
  P.headX = 0.35;
  return P;
}
export { TWO_PI };
