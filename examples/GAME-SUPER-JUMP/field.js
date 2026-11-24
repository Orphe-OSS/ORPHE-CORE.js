// field.js — the jumps area, built into the night stadium of GAME-SUPER-HURDLE.
//
// The stadium has a wide apron between the home straight and the main stand; the runway and
// the sand pit are laid there, right under the crowd (as in most real stadiums). Presentation
// only: main.js tells it where things are (in metres from the foul line, the same unit as
// rules.js) and it draws them. Nothing here decides anything.
import * as THREE from 'three';
import { Runner, newPose } from '../GAME-SUPER-HURDLE/runner.js';

export const RX = 10.7;            // x of the runway centre line (track lanes end at x = 5.5, the stand starts at 14)
export const RUNWAY_W = 1.22;
export const PIT_W = 2.75;
export const PIT_Z0 = -63;         // near edge of the sand
export const PIT_LEN = 10;
const RUNWAY_Z0 = -3;              // where the runway begins

const flat = (geo) => { geo.rotateX(-Math.PI / 2); return geo; };
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rnd32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FONT = '"Bebas Neue", "Arial Narrow", Impact, sans-serif';

/**
 * boards: { long: metres from the pit, triple: metres from the pit } — the foul line of each event.
 */
export function createField({ scene, renderer, boards = { long: 2, triple: 13 } }) {
  const rng = rnd32(20261123);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (canvas, { repeat = false, srgb = true } = {}) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  const root = new THREE.Group();
  scene.add(root);
  const lineZ = { long: PIT_Z0 + boards.long, triple: PIT_Z0 + boards.triple };
  let eventKey = 'long';
  const zOf = (s) => lineZ[eventKey] - s;

  // ---------------------------------------------------------------- runway
  function grain(base, amp, size = 256) {
    const c = canvasOf(size, size), ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const n = (rng() - 0.5) * amp + (rng() < 0.04 ? -amp * 0.8 : 0);
      img.data[i * 4] = Math.max(0, Math.min(255, base[0] + n));
      img.data[i * 4 + 1] = Math.max(0, Math.min(255, base[1] + n * 0.7));
      img.data[i * 4 + 2] = Math.max(0, Math.min(255, base[2] + n * 0.6));
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  {
    const len = RUNWAY_Z0 - PIT_Z0;
    const t = tex(grain([168, 52, 40], 30), { repeat: true });
    t.repeat.set(1.4, len / 0.9);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY_W + 0.5, 0.07, len), new THREE.MeshStandardMaterial({ map: t, roughness: 0.72 }));
    slab.position.set(RX, -0.035, (RUNWAY_Z0 + PIT_Z0) / 2);
    slab.receiveShadow = true;
    root.add(slab);
    const paint = new THREE.MeshStandardMaterial({ color: 0xe9e6dd, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    for (const side of [-1, 1]) {
      const l = new THREE.Mesh(flat(new THREE.PlaneGeometry(0.05, len)), paint);
      l.position.set(RX + side * RUNWAY_W / 2, 0.004, (RUNWAY_Z0 + PIT_Z0) / 2);
      l.receiveShadow = true;
      root.add(l);
    }
  }

  // ---------------------------------------------------------------- take-off boards
  const boardGlow = {};
  for (const key of ['long', 'triple']) {
    const z = lineZ[key];
    const board = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY_W, 0.03, 0.2), new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0 }));
    board.position.set(RX, 0.0, z + 0.1);
    board.receiveShadow = true;
    const clay = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY_W, 0.034, 0.1), new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.6, emissive: 0xff3d00, emissiveIntensity: 0.25 }));
    clay.position.set(RX, 0.0, z - 0.05);
    // a thin line of light on the foul line of the board in use
    const glow = new THREE.Mesh(flat(new THREE.PlaneGeometry(RUNWAY_W + 0.9, 0.05)), new THREE.MeshBasicMaterial({ color: 0x9fffe0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.set(RX, 0.03, z);
    glow.renderOrder = 5;
    root.add(board, clay, glow);
    boardGlow[key] = { board, clay, glow };
  }

  // ---------------------------------------------------------------- the pit
  const pitCz = PIT_Z0 - PIT_LEN / 2;
  {
    const size = 512;
    const c = canvasOf(size, size), ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const rake = Math.sin((x / size) * Math.PI * 2 * 22 + Math.sin(y * 0.05) * 0.8) * 9;     // raked along the pit
        const n = (rng() - 0.5) * 34 + rake;
        const i = (y * size + x) * 4;
        img.data[i] = 196 + n; img.data[i + 1] = 170 + n * 0.95; img.data[i + 2] = 122 + n * 0.8; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = tex(c, { repeat: true });
    t.repeat.set(1.5, 5);
    const sand = new THREE.Mesh(flat(new THREE.PlaneGeometry(PIT_W, PIT_LEN, 1, 1)), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
    sand.position.set(RX, -0.012, pitCz);
    sand.receiveShadow = true;
    root.add(sand);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xdcdad2, roughness: 0.6 });
    const rim = (x, z, w, l) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, l), rimMat); m.position.set(x, -0.02, z); m.receiveShadow = true; root.add(m); };
    rim(RX - PIT_W / 2 - 0.06, pitCz, 0.12, PIT_LEN + 0.24); rim(RX + PIT_W / 2 + 0.06, pitCz, 0.12, PIT_LEN + 0.24);
    rim(RX, PIT_Z0 - PIT_LEN - 0.06, PIT_W, 0.12);
    // the runway widens into the pit's near edge
    rim(RX - (PIT_W + RUNWAY_W + 0.5) / 4, PIT_Z0 + 0.06, (PIT_W - RUNWAY_W - 0.5) / 2, 0.12);
    rim(RX + (PIT_W + RUNWAY_W + 0.5) / 4, PIT_Z0 + 0.06, (PIT_W - RUNWAY_W - 0.5) / 2, 0.12);
  }

  // ---------------------------------------------------------------- LED ribbon on the wall of the stand
  // The wall right beside the runway is dark; an advertising ribbon lights it (and the jumper).
  const ribbon = {};
  {
    const c = canvasOf(2048, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#04060c'; ctx.fillRect(0, 0, 2048, 128);
    const cells = [['SUPER VIRTUAL JUMP', '#22e3ff'], ['LONG JUMP', '#ffffff'], ['ORPHE', '#b6ff3c'], ['TRIPLE JUMP', '#ffffff'], ['MOVE TO PLAY', '#ffd34d'], ['ORPHE CORE', '#22e3ff'], ['ORPHE INSOLE', '#b6ff3c']];
    ctx.textBaseline = 'middle'; ctx.font = `92px ${FONT}`;
    let x = 30;
    for (const [text, color] of cells) {
      ctx.fillStyle = color; ctx.fillText(text, x, 70);
      x += ctx.measureText(text).width + 34;
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 20, 30, 5, 68);
      x += 16;
    }
    ribbon.tex = tex(c, { repeat: true });
    const zA = 6, zB = -96, len = zA - zB, h = 0.8;
    ribbon.tex.repeat.set(len / 22, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshBasicMaterial({ map: ribbon.tex, color: new THREE.Color(1.35, 1.35, 1.35) }));
    m.position.set(13.55, 0.62, (zA + zB) / 2);
    m.rotation.y = -Math.PI / 2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, h + 0.08, len), new THREE.MeshLambertMaterial({ color: 0x07090f }));
    back.position.set(13.62, 0.62, (zA + zB) / 2);
    root.add(m, back);
    // its light spilling on the apron
    const spill = new THREE.Mesh(flat(new THREE.PlaneGeometry(1.6, len)), new THREE.MeshBasicMaterial({ color: 0x2aa9c8, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
    spill.position.set(12.75, -0.05, (zA + zB) / 2);
    root.add(spill);
  }

  // ---------------------------------------------------------------- labels
  function labelSprite(w = 1.5, h = 0.5) {
    const c = canvasOf(384, 128);
    const t = tex(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    sp.scale.set(w, h, 1);
    sp.renderOrder = 6;
    return {
      sprite: sp,
      set(text, color = '#ffffff', sub = '') {
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 384, 128);
        ctx.fillStyle = 'rgba(4, 8, 20, 0.78)';
        ctx.beginPath(); ctx.roundRect(4, 14, 376, 100, 18); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke();
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillStyle = color; ctx.font = `50px ${FONT}`;
        ctx.fillText(sub, 22, 68);
        ctx.fillStyle = '#ffffff'; ctx.font = `84px ${FONT}`; ctx.textAlign = 'right';
        ctx.fillText(text, 364, 70);
        t.needsUpdate = true;
      },
    };
  }

  // distance boards along the stand side of the pit, one set per event
  const distanceSets = {};
  for (const [key, list] of Object.entries({ long: [5, 6, 7, 8, 9], triple: [14, 15, 16, 17, 18, 19] })) {
    const g = new THREE.Group();
    for (const m of list) {
      const z = lineZ[key] - m;
      if (z > PIT_Z0 - 0.3 || z < PIT_Z0 - PIT_LEN + 0.3) continue;
      const c = canvasOf(128, 96), ctx = c.getContext('2d');
      ctx.fillStyle = '#f6f4ee'; ctx.fillRect(0, 0, 128, 96);
      ctx.fillStyle = '#0a0c12'; ctx.font = `88px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(m), 64, 54);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.08, side: THREE.DoubleSide }));
      plate.position.set(RX + PIT_W / 2 + 0.45, 0.24, z);
      plate.rotation.y = -0.9;          // turned toward the runner coming down the runway
      plate.castShadow = true;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.065, 0.03), new THREE.MeshStandardMaterial({ color: 0x1a2030 }));
      tick.position.set(RX + PIT_W / 2 + 0.06, -0.016, z);
      g.add(plate, tick);
    }
    root.add(g);
    distanceSets[key] = g;
  }

  // AR lines across the sand: the mark to beat, the personal best, the world record
  const LINE_COLORS = { lead: [0xffd34d, '#ffd34d'], best: [0x22e3ff, '#22e3ff'], wr: [0xff4fd8, '#ff4fd8'] };
  const arLines = {};
  for (const key of Object.keys(LINE_COLORS)) {
    const mat = new THREE.MeshBasicMaterial({ color: LINE_COLORS[key][0], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const bar = new THREE.Mesh(flat(new THREE.PlaneGeometry(PIT_W, 0.07)), mat);
    bar.renderOrder = 5;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(PIT_W, 0.45), new THREE.MeshBasicMaterial({ color: LINE_COLORS[key][0], transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    wall.position.y = 0.225;
    wall.renderOrder = 5;
    const label = labelSprite(1.14, 0.38);
    label.sprite.position.set(-PIT_W / 2 - 0.72, 0.42, 0);
    const g = new THREE.Group();
    g.add(bar, wall, label.sprite);
    g.visible = false;
    root.add(g);
    arLines[key] = { g, label, color: LINE_COLORS[key][1] };
  }

  // ---------------------------------------------------------------- wind: a flag and a gauge
  const flag = { group: new THREE.Group(), w: 0, shown: 0 };
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0xcfd4dc, roughness: 0.4, metalness: 0.6 }));
    pole.position.y = 1.6;
    pole.castShadow = true;
    flag.geo = new THREE.PlaneGeometry(1.0, 0.55, 10, 1);
    flag.geo.translate(0.5, 0, 0);
    flag.base = flag.geo.attributes.position.array.slice();
    flag.cloth = new THREE.Mesh(flag.geo, new THREE.MeshStandardMaterial({ color: 0xffd34d, roughness: 0.8, side: THREE.DoubleSide, emissive: 0xffa000, emissiveIntensity: 0.15 }));
    flag.pivot = new THREE.Group();
    flag.pivot.position.y = 2.85;
    flag.pivot.add(flag.cloth);
    flag.group.add(pole, flag.pivot);
    root.add(flag.group);
  }
  const gauge = { canvas: canvasOf(256, 128), last: null, group: new THREE.Group() };
  {
    gauge.tex = tex(gauge.canvas);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.48, 0.12), new THREE.MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.5 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.42), new THREE.MeshBasicMaterial({ map: gauge.tex, color: new THREE.Color(1.7, 1.7, 1.7) }));
    face.position.z = 0.065;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x22252c }));
    legs.position.y = -0.58;
    box.castShadow = true;
    gauge.group.add(box, face, legs);
    gauge.group.rotation.y = 0.35;
    root.add(gauge.group);
  }
  function drawGauge(w) {
    const text = `${w > 0 ? '+' : w < 0 ? '−' : ''}${Math.abs(w).toFixed(1)}`;
    if (gauge.last === text) return;
    gauge.last = text;
    const ctx = gauge.canvas.getContext('2d');
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#7f8aa3'; ctx.font = `30px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('WIND m/s', 14, 22);
    ctx.fillStyle = w > 2 ? '#ff5a5a' : w >= 0 ? '#9dff5a' : '#ffb21e';
    ctx.font = `104px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(text, 128, 82);
    gauge.tex.needsUpdate = true;
  }
  drawGauge(0);

  // ---------------------------------------------------------------- people: the judge at the board, athletes waiting
  const judge = { figure: new Runner({ skin: 0xd9a47f, top: 0xf2f2f4, shorts: 0x1a2340, shoes: 0xf2f2f2, hair: 0x30261c }), raise: [0, 0], target: [0, 0], t: 0 };
  {
    const mk = (color, emissive) => {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xcfd4dc }));
      stick.position.y = -0.5;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide, emissive, emissiveIntensity: 0.35 }));
      cloth.position.set(0, -0.62, -0.17);
      cloth.rotation.y = Math.PI / 2;
      const g = new THREE.Group();
      g.add(stick, cloth);
      return g;
    };
    judge.figure.arms[0].elbow.add(mk(0xffffff, 0xffffff));    // white in the left hand: a good jump
    judge.figure.arms[1].elbow.add(mk(0xf01828, 0xf01828));    // red in the right: a foul
    judge.figure.root.rotation.y = Math.PI / 2;                 // facing the board
    root.add(judge.figure.root);
  }
  const waiting = [
    { skin: 0x8d5a3b, top: 0xd81e2c, shorts: 0xd81e2c, shoes: 0xf4f000, hair: 0x120c08 },
    { skin: 0xe0ac86, top: 0xf7d518, shorts: 0x0f6a36, shoes: 0xff5a1f, hair: 0x2a1a10 },
    { skin: 0x5c3a26, top: 0xf2f2f2, shorts: 0x15233f, shoes: 0x22e3ff, hair: 0x0c0806 },
  ].map((look, i) => {
    const f = new Runner({ ...look, bib: String(i + 2) });
    f.root.rotation.y = -Math.PI / 2 - 0.3 + i * 0.25;
    root.add(f.root);
    return { figure: f, seed: i * 2.1 };
  });
  function posePerson(P, t, seed, armL = 0, armR = 0) {
    Object.assign(P, newPose());
    P.leg = [0.04, 0, -0.06, 0, -0.03, 0, -0.04, 0];
    P.arm = [0.05 + armL, -0.1, 0.12 + 0.1 * armL, 0.05 + armR, 0.1, 0.12 + 0.1 * armR];
    P.torsoX = -0.03 + 0.012 * Math.sin(t * 1.3 + seed);
    P.torsoY = 0.05 * Math.sin(t * 0.4 + seed);
    P.hipsY = 0.93 + 0.004 * Math.sin(t * 1.3 + seed);
    return P;
  }

  // ---------------------------------------------------------------- marks in the sand
  const craterGeo = flat(new THREE.CircleGeometry(0.34, 20));
  const craterMat = new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 1, transparent: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const craters = [];
  const peg = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x22e3ff, emissiveIntensity: 1.6 }));
  peg.rotation.x = Math.PI;
  peg.visible = false;
  root.add(peg);

  // the measuring tape: a line of light from the foul line to the mark
  const tape = new THREE.Mesh(flat(new THREE.PlaneGeometry(0.035, 1)), new THREE.MeshBasicMaterial({ color: 0x9fffe0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  tape.renderOrder = 6;
  root.add(tape);

  // where the next contact will be: a ring on the ground that closes as the foot comes down
  const ringGeo = flat(new THREE.RingGeometry(0.86, 1.0, 48));
  const mkRing = (opacity) => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x22e3ff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = 6; m.visible = false;
    root.add(m);
    return m;
  };
  const ringOuter = mkRing(0.9), ringInner = mkRing(0.75);
  const spot = new THREE.Mesh(flat(new THREE.CircleGeometry(0.3, 28)), new THREE.MeshBasicMaterial({ color: 0x22e3ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  spot.renderOrder = 6; spot.visible = false;
  root.add(spot);

  // ---------------------------------------------------------------- sand in the air
  const SN = 700;
  const sandP = { pos: new Float32Array(SN * 3), vel: new Float32Array(SN * 3), life: new Float32Array(SN), next: 0, live: 0 };
  sandP.pos.fill(-999);
  const sandGeo = new THREE.BufferGeometry();
  sandGeo.setAttribute('position', new THREE.BufferAttribute(sandP.pos, 3).setUsage(THREE.DynamicDrawUsage));
  const grainDot = canvasOf(32, 32);
  { const g = grainDot.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 13, 0, 7); g.fill(); }
  const sandPts = new THREE.Points(sandGeo, new THREE.PointsMaterial({ color: 0xb9a070, size: 0.028, map: tex(grainDot), alphaTest: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false }));
  sandPts.frustumCulled = false;
  root.add(sandPts);
  function burst(x, z, power = 1, forward = 6) {
    const n = Math.round(260 + 380 * power);
    for (let k = 0; k < n; k++) {
      const i = sandP.next; sandP.next = (sandP.next + 1) % SN;
      const a = rng() * Math.PI * 2, r = rng();
      sandP.pos[i * 3] = x + Math.cos(a) * r * 0.3; sandP.pos[i * 3 + 1] = 0.02; sandP.pos[i * 3 + 2] = z + Math.sin(a) * r * 0.3;
      const up = (1.2 + rng() * 3.6) * (0.6 + 0.6 * power);
      sandP.vel[i * 3] = Math.cos(a) * (0.4 + rng() * 2.2); sandP.vel[i * 3 + 1] = up; sandP.vel[i * 3 + 2] = -forward * (0.15 + rng() * 0.75) + Math.sin(a) * 1.2;
      sandP.life[i] = 0.7 + rng() * 0.9;
    }
    sandP.live = 2;
  }
  function updateSand(dt) {
    if (sandP.live <= 0) return;
    sandP.live -= dt;
    for (let i = 0; i < SN; i++) {
      if (sandP.life[i] <= 0) continue;
      sandP.life[i] -= dt;
      const j = i * 3;
      sandP.vel[j + 1] -= 9.81 * dt;
      sandP.pos[j] += sandP.vel[j] * dt; sandP.pos[j + 1] += sandP.vel[j + 1] * dt; sandP.pos[j + 2] += sandP.vel[j + 2] * dt;
      if (sandP.pos[j + 1] < 0 || sandP.life[i] <= 0) { sandP.pos[j + 1] = -999; sandP.life[i] = 0; }
    }
    sandGeo.attributes.position.needsUpdate = true;
  }

  // ---------------------------------------------------------------- API
  let time = 0;
  const P = newPose();
  const api = {
    RX, root,
    get event() { return eventKey; },
    /** World z of a point s metres past the foul line of the board in use. */
    z: zOf,
    /** Choose the event: which board is live, which distance boards stand by the pit. */
    setEvent(key) {
      eventKey = key;
      for (const k of Object.keys(distanceSets)) distanceSets[k].visible = k === key;
      const z = lineZ[key];
      // only the board in use is uncovered (a second one on the runway invites a jump at the wrong place)
      for (const k of Object.keys(boardGlow)) boardGlow[k].board.visible = boardGlow[k].clay.visible = k === key;
      judge.figure.root.position.set(RX + 1.75, 0, z - 0.25);
      flag.group.position.set(RX + 2.55, 0, z - 7.5);
      gauge.group.position.set(RX - 1.75, 1.0, z + 3.5);
      const start = z + 40;
      waiting.forEach((w, i) => w.figure.root.position.set(RX + 1.9 + 0.35 * (i % 2), 0, start + 2.2 + i * 1.3));
      for (const k of Object.keys(arLines)) arLines[k].g.visible = false;
      api.clearMarks();
    },
    /** Light the foul line (0..1). */
    setBoardGlow(a) {
      for (const k of Object.keys(boardGlow)) {
        const on = k === eventKey ? a : 0;
        boardGlow[k].glow.material.opacity = on * 0.9;
        boardGlow[k].board.material.emissiveIntensity = on * 0.5;
      }
    },
    setWind(w) { flag.w = w; drawGauge(w); },
    /** A line across the sand at mark `m` (null hides it). */
    setLine(key, m, text = '') {
      const l = arLines[key];
      const z = m == null ? 0 : zOf(m);
      l.g.visible = m != null && z < PIT_Z0 - 0.05 && z > PIT_Z0 - PIT_LEN;
      if (!l.g.visible) return;
      l.g.position.set(RX, 0.02, z);
      l.label.set(m.toFixed(2), l.color, text);
    },
    /** The floating labels of the lines (only readable from the runway: hidden for the outside cameras). */
    setLabels(on) { for (const k of Object.keys(arLines)) arLines[k].label.sprite.visible = on; },
    judge: {
      /** Raise the white flag (true), the red one (false) or lower both (null). */
      show(valid) { judge.target = valid == null ? [0, 0] : valid ? [1, 0] : [0, 1]; },
    },
    /** Sand thrown up at mark s. */
    burst(s, power = 1, forward = 6) { burst(RX, zOf(s), power, forward); },
    /** Leave a print in the sand at s (kept until clearMarks). */
    addMark(s, withPeg = true) {
      const z = zOf(s);
      if (z > PIT_Z0 || z < PIT_Z0 - PIT_LEN) { peg.visible = false; return; }
      const m = new THREE.Mesh(craterGeo, craterMat);
      m.position.set(RX, -0.008, z - 0.3);
      m.scale.set(1.25, 1, 1.5);
      root.add(m);
      craters.push(m);
      if (craters.length > 6) root.remove(craters.shift());
      peg.visible = withPeg;
      peg.position.set(RX, 0.1, z);
    },
    clearMarks() { for (const m of craters) root.remove(m); craters.length = 0; peg.visible = false; },
    hidePeg() { peg.visible = false; },
    /** The line of light from the foul line to s (alpha 0 hides it). */
    setTape(s, alpha = 1) {
      tape.material.opacity = alpha;
      tape.visible = alpha > 0.01 && s > 0.05;
      if (!tape.visible) return;
      tape.scale.set(1, 1, s);
      tape.position.set(RX, 0.035, zOf(s / 2));
    },
    /**
     * The contact ring at s: `closing` runs 1 → 0 as the foot comes down (the outer ring shrinks
     * onto the inner one). color: hex. Pass null to hide.
     */
    setRing(s, closing = 0, color = 0x22e3ff, y = 0.03) {
      const on = s != null;
      ringOuter.visible = ringInner.visible = spot.visible = on;
      if (!on) return;
      const z = zOf(s);
      ringInner.position.set(RX, y, z); ringInner.scale.setScalar(0.42);
      spot.position.set(RX, y, z); spot.scale.setScalar(1.25);
      ringOuter.position.set(RX, y + 0.004, z); ringOuter.scale.setScalar(0.42 + 1.9 * Math.max(0, closing));
      ringOuter.material.color.setHex(color); ringInner.material.color.setHex(color); spot.material.color.setHex(color);
    },
    update(dt) {
      time += dt;
      updateSand(dt);
      ribbon.tex.offset.x = (time * 0.012) % 1;
      // the flag: which way it flies says tail or head wind, how limp it hangs says how much
      flag.shown += (flag.w - flag.shown) * Math.min(1, dt * 2);
      const w = flag.shown, mag = Math.min(1, Math.abs(w) / 2.6);
      flag.pivot.rotation.y = w >= 0 ? Math.PI / 2 : -Math.PI / 2;
      flag.cloth.rotation.z = -(1 - mag) * 1.15;
      const pos = flag.geo.attributes.position.array, base = flag.base;
      for (let i = 0; i < pos.length; i += 3) {
        const x = base[i];
        pos[i + 2] = Math.sin(x * 7 - time * (4 + 9 * mag)) * 0.07 * x * (0.4 + mag);
      }
      flag.geo.attributes.position.needsUpdate = true;
      // people
      judge.t += dt;
      for (const i of [0, 1]) judge.raise[i] += (judge.target[i] - judge.raise[i]) * Math.min(1, dt * 9);
      posePerson(P, time, 5, judge.raise[0] * 2.85, judge.raise[1] * 2.85);
      P.arm[2] = 0.12 * (1 - judge.raise[0]); P.arm[5] = 0.12 * (1 - judge.raise[1]);
      judge.figure.apply(P);
      for (const wt of waiting) wt.figure.apply(posePerson(P, time, wt.seed));
      // pulse of the AR lines
      const pulse = 0.7 + 0.3 * Math.sin(time * 4);
      for (const k of Object.keys(arLines)) arLines[k].g.children[0].material.opacity = 0.55 + 0.35 * pulse;
    },
  };
  api.setEvent('long');
  return api;
}
