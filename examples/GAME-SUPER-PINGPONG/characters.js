// characters.js — the players that stand at the two ends of the table.
//
// Six lucky charms and folk toys of the kind found around a hot-spring town, all built
// from primitives and canvas textures. Each model faces +z, stands on y = 0, wears its
// team colour somewhere obvious and brings one movement of its own (animate()).
// world.js owns everything they share: sliding along the bench, hopping, toppling over
// and getting up again.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const TEAM = [
  { key: 'aka', name: 'あか', color: 0xe2512c, rgb: [1.0, 0.42, 0.2], body: '#c22d1a', bodyDark: '#8f1c10', kanji: '福' },
  { key: 'ao', name: 'あお', color: 0x2a6fd6, rgb: [0.25, 0.55, 1.0], body: '#23469a', bodyDark: '#162c66', kanji: '寿' },
];

export const CHARACTERS = [
  { key: 'daruma', name: 'だるま', line: '七転び八起き。勝つと目が入る' },
  { key: 'neko', name: 'まねきねこ', line: '手まねきで福をよぶ' },
  { key: 'beko', name: '赤べこ', line: '首をふって うなずく' },
  { key: 'tanuki', name: 'たぬき', line: '旅館の番頭。腹つづみ' },
  { key: 'capy', name: 'カピバラ', line: 'ゆず湯で のんびり' },
  { key: 'usagi', name: '雪うさぎ', line: 'ぴょんと 高くはねる' },
];

/** Height of the cushion every character sits on. */
export const CUSHION_H = 0.06;

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function canvasTexture(w, h, draw, { repeat = null, srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  return tex;
}

export const std = (color, roughness = 0.8, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export function shadowed(mesh, cast = true, receive = true) { mesh.castShadow = cast; mesh.receiveShadow = receive; return mesh; }

const KANJI_FONT = '"Yuji Syuku", "Hiragino Mincho ProN", "Yu Mincho", serif';
const INK = '#1a1310';

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A unit-sphere helper bound to one shared geometry: blob(material, radius, x, y, z, sx, sy, sz). */
function blobMaker(geometry) {
  return (material, r, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = part(geometry, material, x, y, z);
    m.scale.set(r * sx, r * sy, r * sz);
    return m;
  };
}

/** Egg-shaped body turned on a lathe: the roly-poly silhouette of a papier-mâché toy. */
function eggGeometry(height, radius, { taper = 0.17, power = 0.62, segments = 48 } = {}) {
  const pts = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = t * Math.PI;
    pts.push(new THREE.Vector2(Math.max(0.0005, radius * Math.sin(a) ** power * (1 - taper * t)), height * (0.5 - 0.5 * Math.cos(a))));
  }
  return new THREE.LatheGeometry(pts, segments);
}

/** Free everything a model owns. */
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) { for (const key of ['map', 'emissiveMap']) if (m[key]) m[key].dispose(); m.dispose(); }
  });
}

/** Square floor cushion in the team colour with gold tassels. */
export function buildCushion(team) {
  const g = new THREE.Group();
  const pad = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.46, CUSHION_H + 0.012, 0.46, 3, 0.03), std(team.bodyDark, 0.95)), true, true);
  pad.position.y = (CUSHION_H + 0.012) / 2 - 0.006;
  g.add(pad);
  const gold = std(0xe2b548, 0.5, 0.3);
  const tassel = new THREE.SphereGeometry(0.018, 8, 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(part(tassel, gold, sx * 0.215, 0.03, sz * 0.215));
  return g;
}

// ------------------------------------------------------------------ だるま
function drawDaruma(ctx, w, h, team, eye) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, team.body); grad.addColorStop(0.75, team.body); grad.addColorStop(1, team.bodyDark);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * (1 - 0.615);
  const gold = '#f1c453';
  // gold brush strokes on the cheeks of the body
  ctx.strokeStyle = gold; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      ctx.lineWidth = 9 - i * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + s * (150 + i * 20), cy - 80 + i * 8);
      ctx.quadraticCurveTo(cx + s * (196 + i * 24), cy + 10, cx + s * (150 + i * 20), cy + 120 - i * 10);
      ctx.stroke();
    }
  }
  // face
  ctx.beginPath(); ctx.ellipse(cx, cy, 120, 102, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f6e9cc'; ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = gold; ctx.stroke();
  // eyes: the viewer's right one is painted when the wish is made, the other when it comes true
  for (const s of [-1, 1]) {
    const ex = cx + s * 47, ey = cy - 8;
    ctx.beginPath(); ctx.arc(ex, ey, 31, 0, Math.PI * 2);
    ctx.fillStyle = '#fffdf6'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    const pupil = s === 1 ? 1 : eye;
    if (pupil > 0.01) { ctx.beginPath(); ctx.arc(ex, ey + 2, 17 * pupil, 0, Math.PI * 2); ctx.fillStyle = '#15100d'; ctx.fill(); }
    ctx.beginPath(); ctx.lineWidth = 15; ctx.strokeStyle = INK;
    ctx.moveTo(ex - s * 34, ey - 50); ctx.quadraticCurveTo(ex + s * 8, ey - 72, ex + s * 44, ey - 38);
    ctx.stroke();
  }
  // moustache and mouth
  ctx.lineWidth = 9; ctx.strokeStyle = INK;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * 6, cy + 40);
    ctx.bezierCurveTo(cx + s * 34, cy + 30, cx + s * 62, cy + 44, cx + s * 78, cy + 66);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.lineWidth = 7; ctx.strokeStyle = '#c0392b';
  ctx.moveTo(cx - 13, cy + 62); ctx.quadraticCurveTo(cx, cy + 71, cx + 13, cy + 62); ctx.stroke();
  // belly kanji
  ctx.fillStyle = gold; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 118px ${KANJI_FONT}`;
  ctx.fillText(team.kanji, cx, h * (1 - 0.245));
}

function buildDaruma(team) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  drawDaruma(ctx, 1024, 512, team, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const root = new THREE.Group();
  const body = part(eggGeometry(0.52, 0.235), std(0xffffff, 0.34, 0.02, { map: tex }));
  body.rotation.y = Math.PI;   // the lathe seam is at +z: turn the painted face to the front
  root.add(body);
  let eye = 0, eyeTarget = 0;
  return {
    root, hopScale: 1,
    animate(dt) {
      if (Math.abs(eye - eyeTarget) < 0.004) return;
      eye += Math.sign(eyeTarget - eye) * Math.min(Math.abs(eyeTarget - eye), dt * 1.6);
      drawDaruma(ctx, 1024, 512, team, eye); tex.needsUpdate = true;
    },
    /** The winner gets the second eye painted in. */
    celebrate() { eyeTarget = 1; },
    reset() { eyeTarget = 0; eye = 0; drawDaruma(ctx, 1024, 512, team, 0); tex.needsUpdate = true; },
  };
}

// ------------------------------------------------------------------ まねきねこ
function buildNeko(team) {
  const root = new THREE.Group();
  const blob = blobMaker(new THREE.SphereGeometry(1, 28, 20));
  const white = std(0xfbf7ee, 0.32);
  const teamMat = std(team.color, 0.42, 0, { emissive: team.color, emissiveIntensity: 0.14 });
  const gold = std(0xe9b93c, 0.32, 0.55);
  const dark = std(0x2b2420, 0.5);
  const pink = std(0xf2a0a8, 0.6);
  // body with calico patches on the back
  const bodyTex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#fbf7ee'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8963a'; ctx.beginPath(); ctx.ellipse(70, 110, 62, 46, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2420'; ctx.beginPath(); ctx.ellipse(450, 150, 48, 38, -0.4, 0, Math.PI * 2); ctx.fill();
  });
  const body = part(eggGeometry(0.37, 0.2, { taper: 0.34, power: 0.58 }), std(0xffffff, 0.32, 0, { map: bodyTex }));
  body.rotation.y = Math.PI;
  root.add(body);
  // head: the face looks along +z, which is u = 0.25 on a sphere
  const headTex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#fbf7ee'; ctx.fillRect(0, 0, w, h);
    const cx = w * 0.25, cy = h * 0.5;
    ctx.fillStyle = '#e8963a'; ctx.beginPath(); ctx.ellipse(cx - 62, 30, 50, 44, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2420'; ctx.beginPath(); ctx.ellipse(cx + 70, 26, 44, 38, 0, 0, Math.PI * 2); ctx.fill();
    for (const s of [-1, 1]) {
      const ex = cx + s * 33, ey = cy - 4;
      ctx.beginPath(); ctx.ellipse(ex, ey, 17, 19, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f6d04a'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#2b2420'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(ex, ey, 6.5, 14, 0, 0, Math.PI * 2); ctx.fillStyle = '#17110e'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex - 5, ey - 8, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      // whiskers
      ctx.lineWidth = 1.8; ctx.strokeStyle = '#2b2420'; ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + s * 24, cy + 22 + k * 3); ctx.lineTo(cx + s * 66, cy + 20 + k * 11); ctx.stroke(); }
      ctx.fillStyle = 'rgba(240,130,130,0.5)'; ctx.beginPath(); ctx.arc(cx + s * 54, cy + 14, 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#e8808a'; ctx.beginPath(); ctx.moveTo(cx - 7, cy + 12); ctx.lineTo(cx + 7, cy + 12); ctx.lineTo(cx, cy + 20); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = '#2b2420';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * 7, cy + 21, 7, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke(); }
  });
  const head = part(new THREE.SphereGeometry(1, 32, 24), std(0xffffff, 0.32, 0, { map: headTex }), 0, 0.415, 0.012);
  head.scale.set(0.172, 0.152, 0.162);
  root.add(head);
  const earGeo = new THREE.ConeGeometry(0.06, 0.105, 4);
  const innerGeo = new THREE.ConeGeometry(0.036, 0.07, 4);
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    const outer = part(earGeo, white); outer.rotation.y = Math.PI / 4;
    const inner = part(innerGeo, teamMat, 0, -0.008, 0.018); inner.rotation.y = Math.PI / 4;
    ear.add(outer, inner);
    ear.position.set(s * 0.1, 0.548, 0.0); ear.rotation.z = -s * 0.3;
    root.add(ear); ears.push(ear);
  }
  // collar and bell
  const collar = part(new THREE.TorusGeometry(0.122, 0.021, 10, 30), teamMat, 0, 0.305, 0.005); collar.rotation.x = Math.PI / 2;
  root.add(collar);
  const bell = blob(gold, 0.04, 0, 0.275, 0.138);
  root.add(bell, part(new THREE.BoxGeometry(0.03, 0.006, 0.012), dark, 0, 0.262, 0.172));
  // the beckoning paw
  const paw = new THREE.Group();
  paw.add(part(new THREE.CapsuleGeometry(0.046, 0.1, 6, 12), white, 0, 0.07, 0));
  paw.add(blob(white, 0.058, 0, 0.155, 0.02), blob(pink, 0.024, 0, 0.158, 0.07, 1, 1, 0.5));
  paw.position.set(0.158, 0.33, 0.03);
  root.add(paw);
  // the other paw holds a gold coin
  root.add(blob(white, 0.05, -0.135, 0.19, 0.115));
  const kobanTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e9b93c'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a8761a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(w / 2, h / 2, 54, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7a4d0c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 70px ${KANJI_FONT}`;
    ctx.fillText('福', w / 2, h / 2 + 4);
  });
  const koban = part(new THREE.CylinderGeometry(0.075, 0.075, 0.014, 28), [gold, std(0xffffff, 0.35, 0.4, { map: kobanTex }), gold], -0.045, 0.15, 0.188);
  koban.rotation.set(Math.PI / 2 - 0.25, 0, 0.18); koban.scale.x = 0.72;
  root.add(koban);
  root.add(blob(white, 0.05, -0.08, 0.03, 0.15, 1, 0.6, 1.25), blob(white, 0.05, 0.08, 0.03, 0.15, 1, 0.6, 1.25));
  root.add(blob(white, 0.045, 0, 0.1, -0.19), blob(dark, 0.03, 0, 0.135, -0.213));
  return {
    root, hopScale: 1,
    animate(dt, t, s) {
      const busy = s.cheer || s.win;
      paw.rotation.x = 0.25 + Math.sin(t * (busy ? 11 : 2.6)) * (busy ? 0.55 : 0.32) + s.kick * 0.5;
      bell.position.x = Math.sin(t * 22) * 0.006 * s.kick;
      const twitch = (t * 0.37) % 1 < 0.06 ? Math.sin(t * 60) * 0.12 : 0;
      ears[0].rotation.z = 0.3 + twitch; ears[1].rotation.z = -0.3 - twitch;
    },
  };
}

// ------------------------------------------------------------------ 赤べこ
function buildBeko(team) {
  const root = new THREE.Group();
  const blob = blobMaker(new THREE.SphereGeometry(1, 24, 18));
  const coat = std(team.body, 0.34, 0.02);
  const white = std(0xfbf5e6, 0.4);
  const dark = std(0x1f1a17, 0.45);
  const cream = std(0xf1e2c2, 0.5);
  const body = part(new THREE.CapsuleGeometry(0.128, 0.2, 8, 22), coat, 0, 0.222, -0.035);
  body.rotation.x = Math.PI / 2;
  root.add(body);
  const legGeo = new THREE.CylinderGeometry(0.037, 0.042, 0.12, 12);
  const hoofGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.026, 12);
  for (const sx of [-1, 1]) for (const z of [0.075, -0.14]) root.add(part(legGeo, coat, sx * 0.076, 0.07, z), part(hoofGeo, dark, sx * 0.076, 0.013, z));
  // painted markings: spots on the flanks, bands round the body, a line along the back
  for (const sx of [-1, 1]) for (const z of [0.03, -0.11]) {
    root.add(blob(white, 0.042, sx * 0.121, 0.245, z, 0.22, 1, 1), blob(dark, 0.018, sx * 0.129, 0.245, z, 0.3, 1, 1));
  }
  const bandGeo = new THREE.TorusGeometry(0.129, 0.011, 8, 30);
  root.add(part(bandGeo, white, 0, 0.222, 0.075), part(bandGeo, white, 0, 0.222, -0.155));
  root.add(part(new THREE.BoxGeometry(0.022, 0.008, 0.2), dark, 0, 0.351, -0.04));
  const tail = new THREE.Group();
  tail.add(part(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 6), dark, 0, -0.055, 0), blob(dark, 0.024, 0, -0.115, 0));
  tail.position.set(0, 0.29, -0.265); tail.rotation.x = -0.5;
  root.add(tail);
  root.add(blob(dark, 0.072, 0, 0.255, 0.098, 1, 1, 0.3));   // the opening the head hangs in
  // the nodding head
  const head = new THREE.Group();
  head.add(blob(coat, 0.108, 0, -0.02, 0.09, 1, 0.95, 1.12));
  head.add(blob(cream, 0.07, 0, -0.058, 0.172, 1.05, 0.8, 0.78));
  for (const s of [-1, 1]) {
    head.add(blob(dark, 0.011, s * 0.026, -0.052, 0.224));
    head.add(blob(white, 0.027, s * 0.058, 0.016, 0.158), blob(dark, 0.014, s * 0.062, 0.016, 0.179));
    head.add(blob(coat, 0.03, s * 0.108, 0.035, 0.05, 1.3, 0.6, 0.8));
    const horn = part(new THREE.ConeGeometry(0.019, 0.065, 8), cream, s * 0.062, 0.088, 0.06); horn.rotation.z = -s * 0.5;
    head.add(horn);
  }
  head.add(blob(white, 0.03, 0, 0.045, 0.196, 1, 1, 0.25));
  head.position.set(0, 0.275, 0.12);
  head.scale.setScalar(1.2);   // the big head is what makes an akabeko
  root.add(head);
  // the toy is modelled small; bring it up to the size of the others (world.js rescales the root itself when hopping)
  const whole = new THREE.Group();
  whole.add(...root.children);
  whole.scale.setScalar(1.24);
  root.add(whole);
  let nod = 0, nodV = 0, lastKick = 0;
  return {
    root, hopScale: 0.8,
    animate(dt, t, s) {
      if (s.kick > lastKick + 0.2) nodV += 5.5;
      lastKick = s.kick;
      if (s.cheer || s.win) nodV += Math.sin(t * 13) * 34 * dt;
      nodV += (-nod * 130 - nodV * 4.5) * dt;
      nod += nodV * dt;
      head.rotation.x = 0.1 + Math.sin(t * 1.9) * 0.07 + nod;
      tail.rotation.z = Math.sin(t * 3.1) * 0.25;
    },
  };
}

// ------------------------------------------------------------------ たぬき
function buildTanuki(team) {
  const root = new THREE.Group();
  const blob = blobMaker(new THREE.SphereGeometry(1, 24, 18));
  const fur = std(0x7a5230, 0.75);
  const darkFur = std(0x3a2616, 0.75);
  const teamMat = std(team.color, 0.5, 0, { emissive: team.color, emissiveIntensity: 0.14 });
  const cream = std(0xf1dfbd, 0.5);
  const bodyTex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7a5230'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f3e3c2'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.56, 96, 92, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w / 2 - 9, h * 0.6 - 9); ctx.lineTo(w / 2 + 9, h * 0.6 + 9); ctx.moveTo(w / 2 + 9, h * 0.6 - 9); ctx.lineTo(w / 2 - 9, h * 0.6 + 9); ctx.stroke();
  });
  const belly = part(eggGeometry(0.36, 0.215, { taper: 0.42, power: 0.55 }), std(0xffffff, 0.7, 0, { map: bodyTex }));
  belly.rotation.y = Math.PI;
  root.add(belly);
  const headTex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8a5e36'; ctx.fillRect(0, 0, w, h);
    const cx = w * 0.25, cy = h * 0.5;
    ctx.fillStyle = '#f1dfbd'; ctx.beginPath(); ctx.ellipse(cx, cy + 28, 44, 30, 0, 0, Math.PI * 2); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(cx + s * 37, cy - 8); ctx.rotate(s * 0.4);
      ctx.fillStyle = '#3a2616'; ctx.beginPath(); ctx.ellipse(0, 0, 31, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(cx + s * 33, cy - 8, 13, 0, Math.PI * 2); ctx.fillStyle = '#fffdf6'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s * 32, cy - 6, 8, 0, Math.PI * 2); ctx.fillStyle = '#15100d'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s * 29, cy - 10, 3, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.fillStyle = 'rgba(235,120,105,0.55)'; ctx.beginPath(); ctx.arc(cx + s * 58, cy + 24, 10, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#15100d'; ctx.beginPath(); ctx.ellipse(cx, cy + 12, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2616'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy + 20, 17, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  });
  const head = part(new THREE.SphereGeometry(1, 32, 24), std(0xffffff, 0.7, 0, { map: headTex }), 0, 0.425, 0.01);
  head.scale.set(0.165, 0.145, 0.152);
  root.add(head);
  for (const s of [-1, 1]) root.add(blob(darkFur, 0.046, s * 0.105, 0.535, 0, 1, 1.1, 0.7), blob(fur, 0.025, s * 0.105, 0.532, 0.022, 1, 1.1, 0.6));
  // straw hat pushed back on the head, tied with a team-coloured cord
  const hatTex = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#d9b76a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,85,30,0.5)'; ctx.lineWidth = 1.5;
    for (let x = 0; x < w; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 10; y < h; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  });
  const hat = new THREE.Group();
  hat.add(part(new THREE.ConeGeometry(0.25, 0.1, 36), std(0xffffff, 0.85, 0, { map: hatTex, side: THREE.DoubleSide })));
  const hatBand = part(new THREE.TorusGeometry(0.075, 0.012, 8, 24), teamMat, 0, 0.012, 0); hatBand.rotation.x = Math.PI / 2;
  hat.add(hatBand);
  hat.position.set(0, 0.565, -0.075); hat.rotation.x = -0.5;
  root.add(hat);
  const scarf = part(new THREE.TorusGeometry(0.118, 0.024, 10, 28), teamMat, 0, 0.318, 0.01); scarf.rotation.x = Math.PI / 2;
  root.add(scarf, blob(teamMat, 0.032, 0.05, 0.285, 0.125, 1, 1.5, 0.6));
  // arms, the sake flask every tanuki statue carries, feet and tail
  for (const s of [-1, 1]) root.add(blob(fur, 0.05, s * 0.178, 0.225, 0.07, 0.9, 1.3, 0.9), blob(darkFur, 0.05, s * 0.085, 0.022, 0.16, 1, 0.5, 1.3));
  const flaskPts = [[0.001, 0], [0.042, 0.006], [0.046, 0.06], [0.03, 0.095], [0.014, 0.11], [0.02, 0.13], [0.001, 0.132]].map((p) => new THREE.Vector2(p[0], p[1]));
  const flask = new THREE.Group();
  flask.add(part(new THREE.LatheGeometry(flaskPts, 16), cream), part(new THREE.TorusGeometry(0.016, 0.006, 6, 14), teamMat, 0, 0.112, 0));
  flask.children[1].rotation.x = Math.PI / 2;
  flask.add(part(new THREE.BoxGeometry(0.03, 0.03, 0.004), darkFur, 0, 0.05, 0.045));
  flask.position.set(-0.215, 0.1, 0.1); flask.rotation.z = 0.25;
  root.add(flask);
  const tail = new THREE.Group();
  tail.add(blob(fur, 0.1, 0, 0, -0.07, 1, 1, 1.35), blob(darkFur, 0.062, 0, 0.01, -0.175));
  tail.position.set(0, 0.13, -0.15);
  root.add(tail);
  let drum = 0;
  return {
    root, hopScale: 0.9,
    animate(dt, t, s) {
      // belly drum: a few quick beats after a hit, a roll while cheering
      drum = Math.max(drum * Math.exp(-dt * 3.2), s.kick, s.cheer || s.win ? 0.8 : 0);
      const beat = 1 + Math.sin(t * 26) * 0.045 * drum;
      belly.scale.set(beat, 1, beat);
      tail.rotation.y = Math.sin(t * 5.2) * (0.14 + 0.3 * drum);
      hat.rotation.z = Math.sin(t * 2.1) * 0.03;
      flask.rotation.x = Math.sin(t * 3.3) * 0.1 * (0.4 + drum);
    },
  };
}

// ------------------------------------------------------------------ カピバラ
function buildCapy(team) {
  const root = new THREE.Group();
  const blob = blobMaker(new THREE.SphereGeometry(1, 28, 20));
  const fur = std(0x9a6b3f, 0.9);
  const light = std(0xb17f50, 0.9);
  const dark = std(0x3b2a1c, 0.7);
  const teamMat = std(team.color, 0.5, 0, { emissive: team.color, emissiveIntensity: 0.14 });
  // a wooden bath tub with hoops in the team colour
  const woodTex = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#c9a26b'; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 21) { ctx.fillStyle = 'rgba(80,50,20,0.45)'; ctx.fillRect(x, 0, 2, h); }
  });
  const wood = std(0xffffff, 0.7, 0, { map: woodTex, side: THREE.DoubleSide });
  root.add(part(new THREE.CylinderGeometry(0.26, 0.235, 0.14, 32, 1, true), wood, 0, 0.07, 0));
  root.add(part(new THREE.CylinderGeometry(0.235, 0.235, 0.012, 32), std(0xb58d58, 0.8), 0, 0.006, 0));
  for (const [y, r] of [[0.035, 0.244], [0.115, 0.258]]) { const hoop = part(new THREE.TorusGeometry(r, 0.009, 8, 40), teamMat, 0, y, 0); hoop.rotation.x = Math.PI / 2; root.add(hoop); }
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.25, 32), new THREE.MeshStandardMaterial({ color: 0x3fb0a6, emissive: 0x2a9a90, emissiveIntensity: 0.55, roughness: 0.25 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.118;
  root.add(water);
  // the capybara, soaking up to its shoulders
  root.add(blob(fur, 1, 0, 0.165, -0.03, 0.185, 0.15, 0.215));
  const head = new THREE.Group();
  head.add(blob(fur, 1, 0, 0, 0, 0.132, 0.12, 0.15));
  head.add(blob(light, 1, 0, -0.022, 0.105, 0.108, 0.092, 0.095));
  head.add(blob(dark, 1, 0, -0.002, 0.193, 0.05, 0.03, 0.02));
  head.add(part(new THREE.BoxGeometry(0.05, 0.006, 0.01), dark, 0, -0.058, 0.19));
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = blob(dark, 1, s * 0.088, 0.04, 0.085, 0.019, 0.011, 0.019);
    eyes.push(eye); head.add(eye);
    head.add(blob(dark, 0.03, s * 0.098, 0.098, -0.04, 0.9, 1, 0.6));
  }
  // folded towel with team stripes, and a yuzu on top
  const towelTex = canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fbf8f0'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `#${team.color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(10, 0, 12, h); ctx.fillRect(28, 0, 5, h); ctx.fillRect(w - 22, 0, 12, h); ctx.fillRect(w - 33, 0, 5, h);
  });
  head.add(part(new RoundedBoxGeometry(0.17, 0.03, 0.115, 2, 0.012), std(0xffffff, 0.9, 0, { map: towelTex }), 0, 0.122, 0.0));
  const yuzu = new THREE.Group();
  yuzu.add(blob(std(0xf3c62d, 0.55, 0, { emissive: 0xd89a10, emissiveIntensity: 0.18 }), 0.052, 0, 0, 0, 1, 0.92, 1));
  const leaf = blob(std(0x3f8f4a, 0.6), 0.03, 0.02, 0.05, 0, 1.2, 0.25, 0.6); leaf.rotation.z = 0.5;
  yuzu.add(leaf, part(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 6), dark, 0, 0.05, 0));
  yuzu.position.set(0, 0.185, 0);
  head.add(yuzu);
  head.position.set(0, 0.3, 0.115);
  root.add(head);
  let bounce = 0, bounceV = 0, lastKick = 0;
  return {
    root, hopScale: 0.55,
    animate(dt, t, s) {
      if (s.kick > lastKick + 0.2) bounceV += 1.5;
      lastKick = s.kick;
      if ((s.cheer || s.win) && bounce <= 0.002 && bounceV <= 0.1) bounceV = 1.9;
      bounceV += (-bounce * 210 - bounceV * 6) * dt - 4 * dt;
      bounce = Math.max(0, bounce + bounceV * dt);
      if (bounce === 0 && bounceV < 0) bounceV = 0;
      yuzu.position.y = 0.185 + bounce;
      yuzu.rotation.z = bounce * 2.4;
      head.rotation.x = Math.sin(t * 1.1) * 0.035;
      // content little squint while things go well
      const squint = s.cheer || s.win ? 0.35 : 1;
      for (const eye of eyes) eye.scale.y = 0.011 * squint;
      water.material.emissiveIntensity = 0.55 + Math.sin(t * 2.4) * 0.08;
    },
  };
}

// ------------------------------------------------------------------ 雪うさぎ
function buildUsagi(team) {
  const root = new THREE.Group();
  const blob = blobMaker(new THREE.SphereGeometry(1, 30, 22));
  const snow = std(0xf7fbff, 0.55, 0, { emissive: 0x9fb8d8, emissiveIntensity: 0.1 });
  const leafMat = std(0x3f8f4a, 0.5);
  const berry = std(0xd42a2a, 0.25, 0, { emissive: 0x8a1010, emissiveIntensity: 0.25 });
  const teamMat = std(team.color, 0.42, 0, { emissive: team.color, emissiveIntensity: 0.14 });
  // a black lacquer tray with a rim in the team colour
  root.add(part(new THREE.CylinderGeometry(0.265, 0.25, 0.022, 36), std(0x15110f, 0.2, 0.2), 0, 0.011, 0));
  const rim = part(new THREE.TorusGeometry(0.262, 0.011, 8, 44), teamMat, 0, 0.024, 0); rim.rotation.x = Math.PI / 2;
  root.add(rim);
  // the rabbit: a mound of snow, nandina berries for eyes, two leaves for ears
  const shape = new THREE.Group();
  shape.add(blob(snow, 1, 0, 0.135, 0, 0.19, 0.158, 0.25));
  shape.add(blob(snow, 0.05, 0, 0.14, -0.24));
  for (const s of [-1, 1]) shape.add(blob(berry, 0.026, s * 0.08, 0.182, 0.196));
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.add(blob(leafMat, 1, 0, 0, -0.105, 0.042, 0.012, 0.125));
    ear.add(part(new THREE.BoxGeometry(0.003, 0.004, 0.21), std(0x2f6f3a, 0.6), 0, 0.012, -0.105));
    ear.position.set(s * 0.06, 0.262, 0.1); ear.rotation.set(0.62, s * 0.2, 0);
    shape.add(ear); ears.push(ear);
  }
  shape.scale.setScalar(1.14);
  const bunny = new THREE.Group();   // world.js lifts and squashes this group, so the size lives one level down
  bunny.add(shape);
  bunny.position.y = 0.02;
  root.add(bunny);
  return {
    root, hopScale: 1.9,
    hopper: bunny,   // only the rabbit hops, the tray stays on the cushion
    animate(dt, t, s) {
      const flutter = s.kick * Math.sin(t * 30) * 0.22 + (s.cheer || s.win ? Math.sin(t * 16) * 0.2 : 0);
      ears[0].rotation.x = 0.62 + Math.sin(t * 2.3) * 0.05 + flutter;
      ears[1].rotation.x = 0.62 + Math.sin(t * 2.3 + 0.8) * 0.05 - flutter;
    },
  };
}

const BUILDERS = { daruma: buildDaruma, neko: buildNeko, beko: buildBeko, tanuki: buildTanuki, capy: buildCapy, usagi: buildUsagi };

export const isCharacter = (kind) => Object.prototype.hasOwnProperty.call(BUILDERS, kind);

/**
 * @param {string} kind - key of CHARACTERS (unknown keys fall back to the daruma)
 * @param {0|1} side
 * @returns {{kind:string, side:number, root:THREE.Group, hopper:THREE.Object3D, hopperBase:number, hopScale:number, animate:Function, celebrate:Function, reset:Function, dispose:Function}}
 *   animate(dt, t, state) with state = { kick: 0..1 after a hit, cheer: boolean, win: boolean }
 */
export function buildCharacter(kind, side) {
  const key = isCharacter(kind) ? kind : 'daruma';
  const model = BUILDERS[key](TEAM[side]);
  const hopper = model.hopper || model.root;
  return {
    kind: key, side,
    root: model.root,
    /** The part world.js lifts and squashes when the character hops, and its resting height. */
    hopper, hopperBase: hopper.position.y,
    hopScale: model.hopScale || 1,
    animate: model.animate || (() => {}),
    celebrate: model.celebrate || (() => {}),
    reset: model.reset || (() => {}),
    dispose() { disposeTree(model.root); },
  };
}

/**
 * Render every character in both team colours to small PNG data URLs for the picker.
 * Render targets get linear, un-tone-mapped output, so the pixels are converted to sRGB here.
 * @returns {Object<string, string[]>} portraits[kind][side]
 */
export function renderPortraits(renderer, size = 168) {
  const px = size * 2;   // rendered at twice the size and scaled down: cheap anti-aliasing
  const target = new THREE.WebGLRenderTarget(px, px);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8468, 1.2));
  const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.9); keyLight.position.set(1.4, 2.2, 2.4); scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xa9c2ff, 0.9); rimLight.position.set(-2, 1.4, -1.6); scene.add(rimLight);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 10);
  camera.position.set(0.66, 0.66, 1.78); camera.lookAt(0, 0.3, 0);
  const pixels = new Uint8Array(px * px * 4);
  const toSrgb = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; toSrgb[i] = 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055); }
  const big = document.createElement('canvas'); big.width = px; big.height = px;
  const bigCtx = big.getContext('2d');
  const small = document.createElement('canvas'); small.width = size; small.height = size;
  const smallCtx = small.getContext('2d');
  const previousTarget = renderer.getRenderTarget();
  const previousColor = renderer.getClearColor(new THREE.Color());
  const previousAlpha = renderer.getClearAlpha();
  const out = {};
  try {
    for (const { key } of CHARACTERS) {
      out[key] = [0, 1].map((side) => {
        const model = buildCharacter(key, side);
        const cushion = buildCushion(TEAM[side]);
        model.root.position.y = CUSHION_H;
        model.animate(0.016, 0.4, { kick: 0, cheer: false, win: false });
        scene.add(cushion, model.root);
        renderer.setRenderTarget(target);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, px, px, pixels);
        const image = bigCtx.createImageData(px, px);
        for (let y = 0; y < px; y++) {
          const src = (px - 1 - y) * px * 4, dst = y * px * 4;   // the read-back is bottom-up
          for (let x = 0; x < px * 4; x += 4) {
            image.data[dst + x] = toSrgb[pixels[src + x]]; image.data[dst + x + 1] = toSrgb[pixels[src + x + 1]];
            image.data[dst + x + 2] = toSrgb[pixels[src + x + 2]]; image.data[dst + x + 3] = pixels[src + x + 3];
          }
        }
        bigCtx.putImageData(image, 0, 0);
        smallCtx.clearRect(0, 0, size, size);
        smallCtx.drawImage(big, 0, 0, size, size);
        scene.remove(cushion, model.root);
        model.dispose(); disposeTree(cushion);
        return small.toDataURL('image/png');
      });
    }
  } finally {
    // whatever happened above, hand the renderer back the way it was
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousColor, previousAlpha);
    target.dispose();
  }
  return out;
}
