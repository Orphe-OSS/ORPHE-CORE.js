// body.js — the runner's own body, as the runner sees it: two legs, two arms.
//
// It is drawn the way first-person games draw a body: in its own little scene, fixed to the
// eyes, on top of the world (main.js renders it as a second pass with its own camera). The feet
// sit where your own feet are when you look ahead: at the bottom edge of the picture, the toes
// just in view, each foot coming up into the picture as it swings forward. The arms pump at
// the lower corners in a run and are thrown up in a jump.
//
// The runner is ORPHE-kun, drawn as in the company's own line drawing: white with a black
// outline, bare arms and legs, hatched shorts, white sneakers with laces. The ORPHE CORE on the
// instep is the one spot of colour. The side view draws the same character as a sprite.
import * as THREE from 'three';
import { RULES } from './rules.js';

export const INK = 0x17171c, PAPER = 0xfffdf6;

/** The same shape pushed out along its normals: drawn inside-out in black behind the shape, it is its outline. */
export function hullOf(geo, t) {
  const g = geo.clone();
  const pos = g.attributes.position, nor = g.attributes.normal;
  // Corners that share a place are pushed the same way (along the average of their normals):
  // otherwise the outline of a box opens up along its edges.
  const sum = new Map(), key = (i) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i), v = sum.get(k) || [0, 0, 0];
    v[0] += nor.getX(i); v[1] += nor.getY(i); v[2] += nor.getZ(i);
    sum.set(k, v);
  }
  const keys = [];
  for (let i = 0; i < pos.count; i++) keys.push(key(i));
  for (let i = 0; i < pos.count; i++) {
    const v = sum.get(keys[i]), len = Math.hypot(v[0], v[1], v[2]) || 1;
    pos.setXYZ(i, pos.getX(i) + v[0] / len * t, pos.getY(i) + v[1] / len * t, pos.getZ(i) + v[2] / len * t);
  }
  return g;
}
export const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
/** A mesh with an ink outline. Returns a group; group.userData.fill is the coloured mesh. */
export function inked(geo, mat, t = 0.012) {
  const group = new THREE.Group();
  const fill = new THREE.Mesh(geo, mat);
  group.add(fill, new THREE.Mesh(hullOf(geo, t), inkMat));
  group.userData.fill = fill;
  return group;
}
/** Diagonal pen strokes on paper: the shorts in the drawing. */
export function hatchTexture(gap = 7, width = 2.2, paper = '#fffdf6') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = paper; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#17171c'; g.lineWidth = width;
  for (let x = -64; x < 128; x += gap) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 64, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createBody() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 20);
  const root = new THREE.Group();
  scene.add(root);

  const paper = new THREE.MeshBasicMaterial({ color: PAPER });
  const ink = new THREE.MeshBasicMaterial({ color: INK });
  const hatch = hatchTexture();
  hatch.repeat.set(3, 2);
  const shorts = new THREE.MeshBasicMaterial({ map: hatch });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x9be82a });

  // a limb: a tapered tube from a to b with its outline, stretched every frame
  function tube(rA, rB, mat, t = 0.009) {
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, 1, 12).translate(0, 0.5, 0), mat);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(rB + t, rA + t, 1, 12).translate(0, 0.5, 0), inkMat);
    root.add(fill, line);
    return [fill, line];
  }
  const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  function stretch(pair, a, b) {
    dir.subVectors(b, a);
    const len = dir.length();
    dir.divideScalar(len || 1);
    for (const mesh of pair) {
      mesh.position.copy(a);
      mesh.quaternion.setFromUnitVectors(UP, dir);
      mesh.scale.set(1, len, 1);
    }
  }
  const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    // ---- a sneaker, as in the drawing: a white upper with a round toe, a sole, laces
    const shoe = new THREE.Group();
    const shoeMat = new THREE.MeshBasicMaterial({ color: PAPER });
    shoe.add(at(inked(new THREE.BoxGeometry(0.15, 0.1, 0.3), shoeMat), 0, 0.1, 0.02));
    const toe = at(inked(new THREE.SphereGeometry(0.078, 14, 10), shoeMat), 0, 0.085, -0.15); toe.scale.set(1, 0.72, 1.25);
    const heel = at(inked(new THREE.SphereGeometry(0.076, 12, 8), shoeMat), 0, 0.1, 0.16); heel.scale.set(1, 0.9, 0.8);
    shoe.add(toe, heel);
    shoe.add(at(inked(new THREE.BoxGeometry(0.165, 0.035, 0.45), shoeMat, 0.009), 0, 0.02, -0.01));          // the sole
    shoe.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.168, 0.01, 0.452), ink), 0, 0.045, -0.01));             // the line between sole and upper
    for (const z of [-0.1, -0.055, -0.01, 0.035]) shoe.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.012, 0.009), ink), 0, 0.153, z));   // laces
    shoe.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.012, 0.16), ink), 0, 0.153, -0.03));
    for (const x of [-0.077, 0.077]) { const panel = at(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.2), ink), x, 0.1, 0.02); panel.rotation.x = -0.3; shoe.add(panel); }   // a stripe on each side
    shoe.add(at(inked(new THREE.BoxGeometry(0.06, 0.024, 0.06), coreMat, 0.006), 0, 0.165, 0.09));              // the ORPHE CORE on the instep
    root.add(shoe);
    legs.push({ side, shoe, shoeMat, sock: tube(0.06, 0.057, paper), shin: tube(0.055, 0.068, paper), thigh: tube(0.085, 0.105, shorts), ankle: new THREE.Vector3(), calf: new THREE.Vector3(), knee: new THREE.Vector3(), hip: new THREE.Vector3(side * 0.16, -1.12, -0.18) });

    // ---- a bare arm and a fist
    const fist = new THREE.Group();
    const palm = inked(new THREE.SphereGeometry(0.056, 14, 10), paper, 0.009); palm.scale.set(1, 0.9, 1.15);
    const thumb = at(inked(new THREE.SphereGeometry(0.027, 10, 8), paper, 0.008), -side * 0.048, 0.03, -0.03); thumb.scale.set(1, 1, 1.5);
    fist.add(palm, thumb);
    for (const x of [-0.03, 0, 0.03]) fist.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.004), ink), x, 0.045, -0.06));   // the lines between the fingers
    root.add(fist);
    arms.push({ side, fist, arm: tube(0.04, 0.052, paper, 0.008), wrist: new THREE.Vector3(), elbow: new THREE.Vector3() });
  }

  let phase = 0, air = 0, lift = 0, hit = 0;
  const lerp = (a, b, t) => a + (b - a) * t;
  const tmp = new THREE.Color();

  /** view: { sim, dt, time, visible } */
  function update({ sim, dt, time, visible = true }) {
    const p = sim.p;
    root.visible = visible && !(p.invuln > 0 && p.invuln < 2 && Math.sin(time * 40) > 0.3);     // blinks for a moment after a miss
    const moving = Math.min(1.5, p.vs / 9);
    phase += dt * (5 + 9 * moving) * (p.ground ? Math.min(1, p.vs / 1.2) : 0.25);
    air += ((p.ground ? 0 : 1) - air) * Math.min(1, dt * 12);
    // arms are thrown up as the jump rises and come down with it
    lift += ((p.ground ? 0 : Math.max(-0.4, Math.min(1, p.vy / 6))) - lift) * Math.min(1, dt * 9);
    const amp = p.vs > 0.3 ? 0.35 + 0.65 * Math.min(1, moving) : 0;
    const dash = Math.max(0, Math.min(1, (p.vs - 6) / 3));
    hit = Math.max(0, hit - dt * 3);

    // the whole body sways a little with the stride
    root.position.set(0.012 * amp * Math.sin(phase), 0.012 * amp * Math.abs(Math.sin(phase)) - 0.03 * hit, 0);

    for (const leg of legs) {
      const ph = phase + (leg.side > 0 ? Math.PI : 0);
      const swing = Math.sin(ph), up = Math.max(0, Math.cos(ph));
      // on the ground: the foot swings out in front (into the picture), back under the body (out of it) and lifts;
      // standing: the toes of both shoes at the bottom edge. In the air: knees up, both feet in view.
      const gx = leg.side * 0.14, gy = -0.665 + 0.15 * up * amp + 0.03 * Math.max(0, swing) * amp, gz = -0.98 - 0.26 * swing * amp;
      const ax = leg.side * 0.17, ay = -0.57 + 0.03 * leg.side + 0.05 * lift, az = -0.96 - 0.04 * leg.side;
      leg.shoe.position.set(lerp(gx, ax, air), lerp(gy, ay, air), lerp(gz, az, air));
      leg.shoe.rotation.set(lerp(0.4 * swing * amp, lift > 0 ? 0.5 : -0.3, air), 0, lerp(0, leg.side * 0.08, air));
      // the leg behind it: ankle -> knee -> hip (the knee and the hip are below the picture)
      leg.ankle.copy(leg.shoe.position).add(dir.set(0, 0.14, 0.13));
      leg.knee.set(leg.side * 0.18, lerp(-0.92 + 0.1 * up * amp, -0.74, air), lerp(-0.55 - 0.08 * swing * amp, -0.52, air));
      leg.calf.lerpVectors(leg.ankle, leg.knee, 0.2);
      stretch(leg.sock, leg.ankle, leg.calf);
      stretch(leg.shin, leg.calf, leg.knee);
      stretch(leg.thigh, leg.knee, leg.hip);
      if (p.fever > 0) leg.shoeMat.color.copy(tmp.setHSL((time * 1.5 + (leg.side > 0 ? 0.5 : 0)) % 1, 1, 0.72));
      else leg.shoeMat.color.set(PAPER);
    }
    for (const arm of arms) {
      // opposite to the leg on the same side
      const pump = Math.max(0, Math.sin(phase + (arm.side > 0 ? 0 : Math.PI)));
      const reach = pump * amp;
      // running: the fist comes up into the lower corner of the picture and goes down again (higher in a dash);
      // in the air: both arms up at the sides
      const gx = arm.side * (0.38 - 0.05 * reach), gy = -0.52 + (0.17 + 0.1 * dash) * reach, gz = -0.56 - 0.12 * reach;
      const ax = arm.side * 0.5, ay = -0.14 + 0.16 * lift, az = -0.74;
      arm.wrist.set(lerp(gx, ax, air), lerp(gy, ay, air), lerp(gz, az, air));
      arm.elbow.set(arm.side * lerp(0.46, 0.56, air), lerp(-0.76, -0.48 + 0.06 * lift, air), lerp(-0.3, -0.42, air));
      arm.fist.position.copy(arm.wrist);
      arm.fist.rotation.set(lerp(-0.3 - 0.5 * reach, -0.9, air), arm.side * lerp(0.25, -0.1, air), 0);
      stretch(arm.arm, arm.wrist, arm.elbow);
    }
  }

  return {
    scene, camera, update,
    /** A jolt through the body (a landing, a stomp). */
    bump(k = 1) { hit = Math.min(1.5, hit + k); },
    setAspect(a) { camera.aspect = a; camera.updateProjectionMatrix(); },
  };
}
