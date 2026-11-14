// world.js — the scene: the game corner of a hot-spring inn at night, opening onto a
// garden with an open-air bath. Everything is procedural (geometry + canvas textures).
//
// Simulation -> world mapping (see game.js): x stays x, the court's y is -z (the far
// side of the table is up on screen), heights sit on top of the table at y = COURT.tableH.
import * as THREE from 'three';
import { COURT } from './game.js';
import { TEAM, CUSHION_H, buildCharacter, buildCushion, isCharacter, canvasTexture, std, shadowed, rng } from './characters.js';

export { TEAM };

const T = COURT.tableH, HL = COURT.halfL, HW = COURT.halfW, PX = COURT.paddleX;
const PLAYER_X = 1.86, BENCH_Y = 0.5;
const BALL_BASE_R = 0.036;

export const SEASONS = {
  spring: { key: 'spring', label: '春', drift: 'petal', foliage: [0xf6b9cf, 0xf9d3e0, 0xee9dbb, 0xfbe6ee], moss: '#2f5a33', glow: 0xffb8d0 },
  summer: { key: 'summer', label: '夏', drift: 'firefly', foliage: [0x3f8a45, 0x57a551, 0x2f6f3d, 0x79b85c], moss: '#2b5a2f', glow: 0xb8ffb0 },
  autumn: { key: 'autumn', label: '秋', drift: 'maple', foliage: [0xd8452a, 0xf08a2a, 0xf2c032, 0xb5301f], moss: '#33502b', glow: 0xff9a50 },
  winter: { key: 'winter', label: '冬', drift: 'snow', foliage: [0xe9eef5, 0xd6dfea, 0xf6f9fc, 0xc6d2e2], moss: '#9aa9b8', glow: 0xcfe0ff },
};

/** The garden follows the calendar: 3-5 spring, 6-8 summer, 9-11 autumn, 12-2 winter. */
export function seasonForMonth(month) {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

function drawPlanks(ctx, w, h, { base, rows, seed, gap = 0.6 }) {
  const r = rng(seed);
  const rowH = h / rows;
  for (let i = 0; i < rows; i++) {
    let x = -r() * w * 0.5;
    while (x < w) {
      const len = w * (0.3 + r() * 0.45);
      const tone = 0.8 + r() * 0.4;
      ctx.fillStyle = `rgb(${(base[0] * tone) | 0},${(base[1] * tone) | 0},${(base[2] * tone) | 0})`;
      ctx.fillRect(x, i * rowH, len + 1, rowH + 1);
      for (let g = 0; g < 12; g++) {
        ctx.strokeStyle = `rgba(25,12,4,${0.05 + r() * 0.1})`;
        ctx.lineWidth = 0.8 + r() * 1.6;
        const gy = i * rowH + r() * rowH;
        ctx.beginPath(); ctx.moveTo(x, gy);
        ctx.bezierCurveTo(x + len * 0.3, gy + (r() - 0.5) * 7, x + len * 0.6, gy + (r() - 0.5) * 7, x + len, gy + (r() - 0.5) * 5);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(12,6,2,${gap})`; ctx.fillRect(x + len - 1.5, i * rowH, 3, rowH);
      x += len;
    }
    ctx.fillStyle = `rgba(12,6,2,${gap})`; ctx.fillRect(0, i * rowH, w, 2.5);
  }
}

function softDotTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { srgb: false });
}

// ------------------------------------------------------------------ kokeshi audience
function buildKokeshi(i) {
  const r = rng(100 + i);
  const hue = [[196, 52, 40], [45, 86, 150], [205, 150, 50], [86, 120, 60]][i % 4];
  const bodyTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f0dcb4'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgb(${hue[0]},${hue[1]},${hue[2]})`;
    ctx.fillRect(0, 0, w, 26); ctx.fillRect(0, h - 44, w, 44); ctx.fillRect(0, 48, w, 10); ctx.fillRect(0, h - 70, w, 8);
    for (let k = 0; k < 4; k++) {   // chrysanthemum
      const cx = (k + 0.5) * (w / 4), cy = h * 0.5;
      for (let p = 0; p < 10; p++) { const a = (p / 10) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 12, 5, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#e8b840'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgb(${hue[0]},${hue[1]},${hue[2]})`;
    }
  });
  const headTex = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4dfbd'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#17110e'; ctx.fillRect(0, 0, w, 40);            // hair
    const cx = w * 0.25, cy = 70;                                     // the face looks along +z (u = 0.25)
    ctx.beginPath(); ctx.moveTo(cx - 34, 38); ctx.quadraticCurveTo(cx, 58, cx + 34, 38); ctx.fill();   // fringe
    ctx.strokeStyle = '#17110e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * 11, cy, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.fillStyle = '#d2473a'; ctx.beginPath(); ctx.arc(cx, cy + 13, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(232,120,110,0.5)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * 19, cy + 8, 5, 0, Math.PI * 2); ctx.fill(); }
  });
  const hgt = 0.2 + r() * 0.07;
  const prof = [[0.001, 0], [0.058, 0.004], [0.062, hgt * 0.5], [0.05, hgt * 0.86], [0.03, hgt], [0.001, hgt + 0.004]].map((p) => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(prof, 20), std(0xffffff, 0.45, 0, { map: bodyTex })), true, false));
  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.078, 22, 16), std(0xffffff, 0.4, 0, { map: headTex })), true, false);
  head.position.y = hgt + 0.058;
  g.add(head);
  return { group: g, head, hop: 0, hopV: 0, delay: 0, phase: r() * 6.28, baseY: 0 };
}

// ------------------------------------------------------------------ world
/**
 * @param {object} options
 * @param {string} options.season - key of SEASONS
 * @param {(scene: THREE.Scene, camera: THREE.Camera) => object} options.makeFx - builds fx.js for this scene
 */
export function createWorld({ season = 'autumn', makeFx }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b1a);
  scene.fog = new THREE.FogExp2(0x0a1024, 0.03);
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 160);
  const fx = makeFx(scene, camera);
  const S = SEASONS[season] || SEASONS.autumn;
  const R = rng(20261112);
  const tickers = [];
  const dot = softDotTexture();
  const callbacks = { onShishi: null };

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0x5d6da6, 0x3a2416, 0.42));
  const key = new THREE.SpotLight(0xffd9a6, 34, 0, 0.8, 0.95, 1.5);
  key.position.set(0, 3.7, 1.0);
  key.target.position.set(0, T, -0.05);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 1; key.shadow.camera.far = 8;
  scene.add(key, key.target);
  const moon = new THREE.DirectionalLight(0x8fa9ff, 0.55);
  moon.position.set(-5, 6, -7);
  scene.add(moon);
  const warm = (x, y, z, intensity, color = 0xffb264, distance = 8) => { const l = new THREE.PointLight(color, intensity, distance, 1.8); l.position.set(x, y, z); scene.add(l); return l; };
  const engawaL = warm(-2.9, 0.75, -2.5, 3.2), engawaR = warm(2.9, 0.75, -2.5, 3.2);
  const treeLight = warm(2.7, 0.35, -4.5, 7, S.glow, 7);
  const poolLight = warm(0.3, 0.4, -5.0, 3.5, 0x62e6d6, 6);

  // ---------------------------------------------------------------- room
  const floorTex = canvasTexture(1024, 1024, (ctx, w, h) => drawPlanks(ctx, w, h, { base: [112, 70, 40], rows: 10, seed: 7 }), { repeat: [4, 3.2] });
  const floor = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(15, 6.4), std(0xffffff, 0.36, 0.0, { map: floorTex })), false, true);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.9);
  scene.add(floor);
  const engawaTex = canvasTexture(1024, 512, (ctx, w, h) => drawPlanks(ctx, w, h, { base: [150, 108, 66], rows: 5, seed: 11, gap: 0.45 }), { repeat: [5, 1] });
  const engawa = shadowed(new THREE.Mesh(new THREE.BoxGeometry(15, 0.26, 0.74), std(0xffffff, 0.5, 0, { map: engawaTex })), false, true);
  engawa.position.set(0, -0.128, -2.67);
  scene.add(engawa);

  const wood = std(0x4a2f1c, 0.6);
  const woodLight = std(0x8a5f38, 0.55);
  for (const x of [-6.6, -2.65, 2.65, 6.6]) {   // pillars along the line between room and veranda
    const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.9, 0.15), wood));
    p.position.set(x, 1.45, -2.3); scene.add(p);
  }
  // Everything overhead goes into one group: a tall (portrait) window pulls the play camera
  // back above the ceiling, and from up there the roof would only hide the table.
  const roof = new THREE.Group();
  scene.add(roof);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(15, 0.2, 0.17), wood);
  beam.position.set(0, 2.8, -2.3); roof.add(beam);
  // plaster wall above the opening and a boarded ceiling (only the low title / result cameras see them)
  const upper = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.3), std(0x3a3128, 0.95));
  upper.position.set(0, 3.5, -2.3); roof.add(upper);
  const ceilTex = canvasTexture(512, 512, (ctx, w, h) => drawPlanks(ctx, w, h, { base: [58, 40, 26], rows: 6, seed: 31 }), { repeat: [5, 3] });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(15, 7), std(0xffffff, 0.9, 0, { map: ceilTex }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, 4.1, 1.2); roof.add(ceiling);
  for (let i = 0; i < 4; i++) { const joist = new THREE.Mesh(new THREE.BoxGeometry(15, 0.16, 0.14), wood); joist.position.set(0, 4.0, -1.2 + i * 1.5); roof.add(joist); }

  // shoji screens left and right of the opening, lit from behind
  const shojiTex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f7ecd0'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.55, 20, w / 2, h * 0.55, w * 0.7);
    g.addColorStop(0, 'rgba(255,214,150,0.55)'); g.addColorStop(1, 'rgba(120,70,30,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3b2415';
    for (let i = 0; i <= 4; i++) ctx.fillRect((i * w) / 4 - 5, 0, 10, h);
    for (let j = 0; j <= 6; j++) ctx.fillRect(0, (j * (h * 0.8)) / 6 - 4, w, 8);
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
    ctx.fillStyle = '#5a3a22'; for (let i = 0; i < 4; i++) ctx.fillRect((i * w) / 4 + 12, h * 0.82, w / 4 - 24, h * 0.15);
  });
  const shojiMat = new THREE.MeshStandardMaterial({ map: shojiTex, emissive: 0xffd9a0, emissiveMap: shojiTex, emissiveIntensity: 0.5, roughness: 0.9 });
  for (const [x0, x1] of [[-6.55, -2.72], [2.72, 6.55]]) {
    const n = 3, wPanel = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wPanel, 2.45), shojiMat);
      m.position.set(x0 + wPanel * (i + 0.5), 1.225, -2.3);
      scene.add(m);
    }
  }

  // floor lamps (andon) on the veranda: the warm row along the top of the play view
  const andonMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffb45e, emissiveIntensity: 1.5, roughness: 0.9 });
  const andons = [];
  for (const x of [-3.5, -1.9, 1.9, 3.5]) {
    const g = new THREE.Group();
    const shade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.4, 0.24), andonMat.clone());
    shade.position.y = 0.3; g.add(shade);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.56, 0.022), wood);
      leg.position.set(sx * 0.125, 0.28, sz * 0.125); g.add(leg);
    }
    for (const y of [0.1, 0.5]) { const ring = new THREE.Mesh(new THREE.BoxGeometry(0.275, 0.022, 0.275), wood); ring.position.y = y; g.add(ring); }
    g.position.set(x, 0, -2.66);
    scene.add(g);
    andons.push({ shade, seed: R() * 10 });
  }

  // paper lanterns on a line above the veranda (seen from the low title and result cameras)
  const lanternTex = (kind) => canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = kind === 0 ? '#e23b22' : '#fbf0d6'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = kind === 0 ? 'rgba(120,20,10,0.5)' : 'rgba(150,120,80,0.4)'; ctx.lineWidth = 2;
    for (let i = 1; i < 12; i++) { ctx.beginPath(); ctx.moveTo(0, (i * h) / 12); ctx.lineTo(w, (i * h) / 12); ctx.stroke(); }
    ctx.fillStyle = kind === 0 ? '#1b1210' : '#c8321e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 120px "Yuji Syuku", "Hiragino Mincho ProN", "Yu Mincho", serif';
    for (const u of [0.25, 0.75]) ctx.fillText(kind === 0 ? '祭' : '湯', w * u, h * 0.52);
  });
  const lanternMats = [0, 1].map((k) => { const t = lanternTex(k); return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: k === 0 ? 1.5 : 1.15, roughness: 0.85 }); });
  const lanterns = [];
  const capMat = std(0x16110e, 0.6);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), lanternMats[i % 2]);
    body.scale.y = 1.22; body.position.y = -0.3; g.add(body);
    for (const y of [-0.1, -0.5]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 14), capMat); cap.position.y = y; g.add(cap); }
    g.position.set(-4.4 + i * 1.1, 2.68, -2.75);
    roof.add(g);
    lanterns.push({ g, seed: R() * 10 });
  }

  // pendant lamps over the table
  const shadeMat = std(0x1d4a3a, 0.4, 0.3, { side: THREE.DoubleSide });
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.5, 1.5), fog: false });
  for (const x of [-0.75, 0.75]) {
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.3, 0.2, 28, 1, true), shadeMat);
    shade.position.set(x, 2.72, 0); roof.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), bulbMat);
    bulb.position.set(x, 2.66, 0); roof.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.3, 6), capMat);
    cord.position.set(x, 3.45, 0); roof.add(cord);
  }

  // ---------------------------------------------------------------- table
  const tableTex = canvasTexture(1024, 640, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#15594b'); g.addColorStop(1, '#104a3f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.035})`; ctx.fillRect(r() * w, r() * h, 2 + r() * 5, 1 + r() * 2); }
    ctx.strokeStyle = 'rgba(247,243,230,0.95)'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    // the middle of the table: a soft shade where the net stands and a painted line across
    const shade = ctx.createLinearGradient(w / 2 - 34, 0, w / 2 + 34, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(0.5, 'rgba(0,0,0,0.42)'); shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade; ctx.fillRect(w / 2 - 34, 0, 68, h);
    ctx.fillStyle = 'rgba(247,243,230,0.95)'; ctx.fillRect(w / 2 - 4, 0, 8, h);
  });
  const tableSide = std(0x123e37, 0.5);
  const tableTop = shadowed(new THREE.Mesh(new THREE.BoxGeometry(HL * 2, 0.04, HW * 2), [tableSide, tableSide, std(0xffffff, 0.5, 0, { map: tableTex }), tableSide, tableSide, tableSide]));
  tableTop.position.set(0, T - 0.02, 0);
  scene.add(tableTop);
  const apron = shadowed(new THREE.Mesh(new THREE.BoxGeometry(HL * 2 - 0.3, 0.09, HW * 2 - 0.3), wood));
  apron.position.set(0, T - 0.085, 0); scene.add(apron);
  for (const x of [-0.95, 0.95]) {
    for (const z of [-0.55, 0.55]) { const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.08, T - 0.12, 0.08), wood)); leg.position.set(x, (T - 0.12) / 2, z); scene.add(leg); }
    const bar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.1), wood)); bar.position.set(x, 0.2, 0); scene.add(bar);
  }
  // net. The play camera sits in the net's own plane and looks along it, so from there a flat
  // mesh is edge-on and invisible: what reads is the thick white tape on top, the posts and the
  // painted line underneath. The mesh shows from the low title and result cameras.
  const netW = HW * 2 + 0.26;
  const netTex = canvasTexture(512, 48, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(14,18,22,0.5)'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(238,242,246,0.9)'; ctx.lineWidth = 1.3;
    for (let x = 0; x <= w; x += 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(netW, COURT.netH - 0.02), new THREE.MeshStandardMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false }));
  net.rotation.y = Math.PI / 2; net.position.set(0, T + (COURT.netH - 0.02) / 2, 0); net.renderOrder = 2;
  scene.add(net);
  const tapeMat = std(0x9a9890, 0.8);   // sits in the hot spot of the lamp over the table: a mid grey already reads as white tape
  const tape = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.026, netW), tapeMat), true, false);
  tape.position.set(0, T + COURT.netH - 0.013, 0); scene.add(tape);
  const netShadow = new THREE.Mesh(new THREE.BoxGeometry(0.008, COURT.netH * 0.7, HW * 2), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  netShadow.position.set(0, T + COURT.netH * 0.4, 0); netShadow.castShadow = true; scene.add(netShadow);
  const metal = std(0x20242a, 0.4, 0.6);
  for (const z of [-HW - 0.13, HW + 0.13]) {
    const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, COURT.netH + 0.05, 10), metal));
    post.position.set(0, T + COURT.netH / 2, z); scene.add(post);
    const clamp = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.1), metal));
    clamp.position.set(0, T - 0.012, z - Math.sign(z) * 0.035); scene.add(clamp);
  }

  // bamboo rails: the walls of the court
  const bambooMat = std(0xa9b765, 0.42);
  const bambooNode = std(0x7d8a45, 0.5);
  const rails = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, HL * 2 + 0.14, 14), bambooMat));
    pole.rotation.z = Math.PI / 2; g.add(pole);
    for (let x = -HL; x <= HL + 0.01; x += HL / 4) { const n = new THREE.Mesh(new THREE.TorusGeometry(0.0365, 0.006, 6, 16), bambooNode); n.rotation.y = Math.PI / 2; n.position.x = x; g.add(n); }
    g.position.set(0, T + 0.035, -s * (HW + 0.035));
    scene.add(g);
    rails.push({ g, kick: 0, far: s === 1 });
  }

  // ---------------------------------------------------------------- benches with red felt, the two players
  const felt = std(0x8e1d1a, 0.98);
  function bench(x, z, sx, sz, y) {
    const g = new THREE.Group();
    const top = shadowed(new THREE.Mesh(new THREE.BoxGeometry(sx, 0.05, sz), woodLight)); top.position.y = y - 0.03; g.add(top);
    const cloth = shadowed(new THREE.Mesh(new THREE.BoxGeometry(sx + 0.03, 0.014, sz + 0.03), felt), false, true); cloth.position.y = y - 0.004; g.add(cloth);
    for (const lx of [-1, 1]) for (const lz of [-1, 1]) { const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, y - 0.05, 0.05), wood)); leg.position.set(lx * (sx / 2 - 0.06), (y - 0.05) / 2, lz * (sz / 2 - 0.06)); g.add(leg); }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  bench(-PLAYER_X, 0, 0.52, HW * 2 + 0.24, BENCH_Y);
  bench(PLAYER_X, 0, 0.52, HW * 2 + 0.24, BENCH_Y);
  // the two players: a cushion on the bench and, on it, whichever character was picked
  const players = [0, 1].map((side) => {
    const rig = new THREE.Group();
    const wobble = new THREE.Group();      // pivots at the base, like a roly-poly
    wobble.position.y = CUSHION_H;
    rig.add(buildCushion(TEAM[side]), wobble);
    rig.position.set(side === 0 ? -PLAYER_X : PLAYER_X, BENCH_Y, 0);
    const yaw = (side === 0 ? 1 : -1) * 0.62;
    rig.rotation.y = yaw;
    scene.add(rig);
    return {
      side, rig, wobble, model: null, yaw, baseYaw: yaw, faceCamera: false,
      z: 0, lean: 0, hop: 0, hopV: 0, kick: 0, tilt: 0, tiltV: 0, tiltTarget: 0, tumbleT: 0, cheerT: 0, spin: 0,
    };
  });
  function setCharacter(side, wanted) {
    const p = players[side];
    const kind = isCharacter(wanted) ? wanted : 'daruma';   // same fallback as buildCharacter, so an unknown key is not rebuilt on every call
    if (p.model && p.model.kind === kind) return;
    if (p.model) { p.wobble.remove(p.model.root); p.model.dispose(); }
    p.model = buildCharacter(kind, side);
    p.wobble.add(p.model.root);
    // the slot may be in the middle of the winner's celebration: the newcomer joins in
    if (p.faceCamera) p.model.celebrate();
  }
  setCharacter(0, 'daruma'); setCharacter(1, 'daruma');

  // ---------------------------------------------------------------- rackets
  const rackets = [0, 1].map((side) => {
    const team = TEAM[side];
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    const rubber = std(team.color, 0.55, 0, { emissive: team.color, emissiveIntensity: 0.22 });
    const blade = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.024, 44), [std(0xdcb47c, 0.55), rubber, std(0x1c1a1c, 0.6)]), true, false);
    blade.rotation.z = -Math.PI / 2;        // the rubber face (top cap) looks along +x
    blade.scale.set(0.17, 1, 0.2);
    tilt.add(blade);
    const handle = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.04), std(0xc99a5b, 0.6)), true, false);
    handle.position.set(0, -0.235, 0); tilt.add(handle);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(team.rgb[0] * 1.6, team.rgb[1] * 1.6, team.rgb[2] * 1.6), fog: false }));
    rim.rotation.y = Math.PI / 2; rim.scale.set(0.2, 0.17, 1); rim.visible = false;
    tilt.add(rim);
    group.add(tilt);
    if (side === 1) group.rotation.y = Math.PI;
    group.position.set(side === 0 ? -PX : PX, T + BALL_BASE_R + COURT.hitH, 0);
    scene.add(group);
    // strip of light on the end of the table: exactly what the racket covers
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1), new THREE.MeshBasicMaterial({
      map: canvasTexture(64, 8, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }, { srgb: false }),
      color: team.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.4,
    }));
    strip.rotation.x = -Math.PI / 2;
    if (side === 1) strip.rotation.z = Math.PI;
    strip.position.set((side === 0 ? -1 : 1) * (HL - 0.075), T + 0.003, 0);
    strip.renderOrder = 1;
    scene.add(strip);
    return { side, group, tilt, blade, rim, strip, swing: 0, swingV: 0, half: 0.2, glow: 0 };
  });

  // bamboo guard fences (item): rise behind a racket and save one miss
  const guards = [0, 1].map((side) => {
    const g = new THREE.Group();
    for (let i = 0; i < 15; i++) {
      const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.36, 8), bambooMat), true, false);
      pole.position.set(0, 0.18, -HW + (i + 0.5) * ((HW * 2) / 15)); g.add(pole);
    }
    for (const y of [0.1, 0.27]) { const tie = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.018, HW * 2), bambooNode); tie.position.y = y; g.add(tie); }
    g.position.set((side === 0 ? -1 : 1) * (PX + 0.17), T - 0.02, 0);
    g.scale.y = 0.001; g.visible = false;
    scene.add(g);
    return { g, on: false, k: 0 };
  });

  // where the ball will arrive (optional guide)
  const guides = [0, 1].map((side) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(...TEAM[side].rgb.map((v) => v * 2.2)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((side === 0 ? -1 : 1) * (HL - 0.11), T + 0.004, 0);
    m.renderOrder = 2;
    scene.add(m);
    return { m, on: false, k: 0, born: 0 };
  });

  // ---------------------------------------------------------------- ball
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffa53a, emissiveIntensity: 0.75, roughness: 0.35 });
  const ball = shadowed(new THREE.Mesh(new THREE.SphereGeometry(BALL_BASE_R, 28, 20), ballMat), true, false);
  ball.visible = false;
  scene.add(ball);
  const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dot, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
  ballShadow.rotation.x = -Math.PI / 2; ballShadow.renderOrder = 1; ballShadow.visible = false;
  scene.add(ballShadow);
  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffb060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5 }));
  ballGlow.visible = false; ballGlow.renderOrder = 4;
  scene.add(ballGlow);
  const ballLight = new THREE.PointLight(0xffb060, 0, 1.6, 2);
  scene.add(ballLight);

  // ---------------------------------------------------------------- items on the table
  const itemMeshes = new Map();
  function buildItem(type) {
    const g = new THREE.Group();
    if (type === 'mikan') {
      const m = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), std(0xf5921e, 0.55, 0, { emissive: 0xf57a10, emissiveIntensity: 0.35 })), true, false);
      m.scale.y = 0.86; g.add(m);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.035, 6), std(0x4c8f3a, 0.6)); leaf.position.y = 0.07; g.add(leaf);
    } else if (type === 'dango') {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), std(0xd9bf8c, 0.7)); g.add(stick);
      [0xf5a9c0, 0xfdf6e6, 0x9cc56a].forEach((c, i) => { const d = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), std(c, 0.6, 0, { emissive: c, emissiveIntensity: 0.25 })), true, false); d.position.y = 0.085 - i * 0.085; g.add(d); });
      g.rotation.z = 0.5;
    } else {
      for (let i = -1; i <= 1; i++) { const p = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.2, 8), std(0xa9b765, 0.45, 0, { emissive: 0x6f8a2a, emissiveIntensity: 0.3 })), true, false); p.position.x = i * 0.05; g.add(p); }
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.05), bambooNode); g.add(tie);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.17, 44), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 2;
    const root = new THREE.Group();
    root.add(g, ring);
    return { root, g, ring, born: 0, gone: 0 };
  }

  function disposeItem(it) {
    scene.remove(it.root);
    it.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
  }

  // ---------------------------------------------------------------- scoreboard and the kokeshi audience
  const audienceBenchY = 0.42;
  bench(-1.22, -1.78, 1.5, 0.4, audienceBenchY);
  bench(1.22, -1.78, 1.5, 0.4, audienceBenchY);
  const kokeshi = [];
  for (let i = 0; i < 8; i++) {
    const k = buildKokeshi(i);
    const sideX = i < 4 ? -1 : 1;
    k.group.position.set(sideX * (0.62 + (i % 4) * 0.4), audienceBenchY, -1.78 + (R() - 0.5) * 0.08);
    k.group.rotation.y = (R() - 0.5) * 0.5;
    const s = 0.95 + R() * 0.25; k.group.scale.setScalar(s);
    k.baseY = audienceBenchY;
    scene.add(k.group);
    kokeshi.push(k);
  }
  const board = new THREE.Group();
  const frame = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.6, 0.05), wood)); board.add(frame);
  const cards = [0, 1].map((side) => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 320;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    mesh.position.set((side === 0 ? -1 : 1) * 0.235, 0, 0.03);
    board.add(mesh);
    return { side, canvas, ctx: canvas.getContext('2d'), tex, mesh, text: '', flip: 0, pending: null };
  });
  for (const x of [-0.3, 0.3]) { const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), wood)); leg.position.set(x, -0.6, -0.06); board.add(leg); }
  board.position.set(0, 1.13, -1.86); board.rotation.x = -0.3;
  scene.add(board);
  function drawCard(card, text) {
    const { ctx, canvas } = card;
    ctx.fillStyle = '#f4ead0'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `#${TEAM[card.side].color.toString(16).padStart(6, '0')}`; ctx.fillRect(0, 0, canvas.width, 34);
    ctx.fillStyle = '#17120f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size = text.length > 2 ? 150 : text.length > 1 ? 210 : 270;
    ctx.font = `${size}px "Bebas Neue", "Arial Narrow", sans-serif`;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 30);
    card.tex.needsUpdate = true;
    card.text = text;
  }
  cards.forEach((c) => drawCard(c, '0'));

  // ---------------------------------------------------------------- garden
  const mossTex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = S.moss; ctx.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 1500; i++) {
      const dark = r() < 0.5;
      ctx.fillStyle = `rgba(${dark ? '8,20,12' : '150,190,120'},${0.05 + r() * 0.12})`;
      ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 4 + r() * 22, 3 + r() * 12, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }, { repeat: [5, 3] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), std(0xffffff, 0.95, 0, { map: mossTex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.26, -7.03);
  scene.add(ground);
  // stepping stones from the veranda to the bath
  const stoneMat = std(0x555a62, 0.95, 0, { flatShading: true });
  for (const [x, z, s] of [[-0.9, -3.35, 0.3], [-0.55, -3.8, 0.26], [-1.0, -4.25, 0.3], [-2.4, -3.5, 0.34], [3.6, -3.45, 0.3]]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 1.08, 0.07, 9), stoneMat);
    st.position.set(x, -0.235, z); st.rotation.y = R() * 3; st.scale.z = 0.8; scene.add(st);
  }

  // the open-air bath: glowing water in a ring of rocks, steam above
  const POOL = { x: 0.55, z: -5.25, rx: 2.3, rz: 1.25 };
  const poolMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float w = sin(p.x * 9.0 + uTime * 0.7) * sin(p.y * 7.0 - uTime * 0.55) + 0.5 * sin((p.x + p.y) * 15.0 + uTime * 1.1);
        float ring = sin(r * 22.0 - uTime * 1.6) * smoothstep(1.0, 0.2, r);
        vec3 deep = vec3(0.006, 0.05, 0.07), lit = vec3(0.1, 0.5, 0.47);
        vec3 col = mix(deep, lit, 0.3 + 0.16 * w + 0.07 * ring);
        col *= 0.55 + 0.9 * smoothstep(1.05, 0.1, r);
        col += vec3(1.0, 0.62, 0.3) * 0.12 * smoothstep(0.6, 1.0, w * 0.5 + 0.5) * smoothstep(0.2, 0.9, p.x * 0.5 + 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 56), poolMat);
  pool.rotation.x = -Math.PI / 2; pool.scale.set(POOL.rx, POOL.rz, 1); pool.position.set(POOL.x, -0.17, POOL.z);
  scene.add(pool);
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockCount = 46;
  const rocks = new THREE.InstancedMesh(rockGeo, std(0x474c55, 0.96, 0, { flatShading: true }), rockCount);
  const tmp = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < rockCount; i++) {
    const a = (i / rockCount) * Math.PI * 2 + R() * 0.1;
    const out = 1.02 + R() * 0.1;
    const s = 0.16 + R() * 0.2;
    tmp.position.set(POOL.x + Math.cos(a) * POOL.rx * out, -0.2 + s * 0.35, POOL.z + Math.sin(a) * POOL.rz * out);
    tmp.rotation.set(R() * 3, R() * 3, R() * 3);
    tmp.scale.set(s * (0.9 + R() * 0.6), s * (0.6 + R() * 0.5), s * (0.9 + R() * 0.6));
    tmp.updateMatrix(); rocks.setMatrixAt(i, tmp.matrix);
    const shade = season === 'winter' && R() < 0.6 ? 1.5 : 0.75 + R() * 0.5;
    rocks.setColorAt(i, tint.setRGB(shade, shade, shade * 1.04));
  }
  scene.add(rocks);
  fx.createSteam({ x: POOL.x, y: -0.1, z: POOL.z, rx: POOL.rx * 0.85, rz: POOL.rz * 0.8, count: 80, height: 2.6 });

  // stone lantern
  {
    const g = new THREE.Group();
    const add = (geo, y, mat = stoneMat) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); return m; };
    add(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 6), 0.05);
    add(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 6), 0.31);
    add(new THREE.CylinderGeometry(0.2, 0.13, 0.07, 6), 0.555);
    add(new THREE.BoxGeometry(0.2, 0.19, 0.2), 0.685, new THREE.MeshStandardMaterial({ color: 0x30281e, emissive: 0xffb050, emissiveIntensity: 1.7, roughness: 0.9 }));
    add(new THREE.ConeGeometry(0.33, 0.19, 6), 0.875);
    add(new THREE.SphereGeometry(0.05, 8, 6), 0.99);
    g.position.set(-2.55, -0.26, -4.3);
    scene.add(g);
    warm(-2.55, 0.5, -4.2, 2.6, 0xffb060, 4.5);
  }

  // maple (or cherry, by season) lit from below
  {
    const trunkMat = std(0x2c1e17, 0.9);
    const base = new THREE.Vector3(3.1, -0.26, -4.9);
    const segs = [[0, 0, 0, 0.13, 1.0, 0.12, -0.25], [0.06, 0.95, 0.02, 0.1, 0.9, -0.45, -0.2], [-0.3, 1.7, -0.12, 0.07, 0.9, -0.9, 0.1], [0.25, 1.6, 0.1, 0.06, 0.8, 0.7, 0.3]];
    for (const [x, y, z, r, len, rz, rx] of segs) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r, len, 7), trunkMat);
      m.position.set(base.x + x, base.y + y + len / 2, base.z + z); m.rotation.set(rx, 0, rz); scene.add(m);
    }
    const blobGeo = new THREE.IcosahedronGeometry(1, 1);
    const blobs = new THREE.InstancedMesh(blobGeo, std(0xffffff, 0.85, 0, { flatShading: true }), 26);
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 1.75;
      tmp.position.set(base.x - 0.75 + Math.cos(a) * rr, base.y + 2.25 + (R() - 0.35) * 0.95, base.z + 0.1 + Math.sin(a) * rr * 0.75);
      tmp.rotation.set(R() * 3, R() * 3, R() * 3);
      const s = 0.32 + R() * 0.36;
      tmp.scale.set(s * 1.25, s * 0.72, s * 1.1);
      tmp.updateMatrix(); blobs.setMatrixAt(i, tmp.matrix);
      blobs.setColorAt(i, tint.setHex(S.foliage[Math.floor(R() * S.foliage.length)]));
    }
    scene.add(blobs);
  }

  // shishi-odoshi: the bamboo deer scarer that fills, tips and knocks on its stone
  const shishi = new THREE.Group();
  {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.2, 9), stoneMat); basin.position.set(0.34, 0.1, 0); shishi.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.19, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.5, 0.48), fog: false })); water.rotation.x = -Math.PI / 2; water.position.set(0.34, 0.205, 0); shishi.add(water);
    for (const z of [-0.06, 0.06]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 6), bambooNode); post.position.set(0, 0.21, z); shishi.add(post); }
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), bambooMat); spout.rotation.z = 1.25; spout.position.set(-0.34, 0.52, 0); shishi.add(spout);
  }
  const shishiArm = new THREE.Group();
  const armPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.62, 10), bambooMat);
  armPole.rotation.z = Math.PI / 2; armPole.position.x = 0.06;
  shishiArm.add(armPole); shishiArm.position.set(0, 0.36, 0); shishi.add(shishiArm);
  shishi.position.set(-1.75, -0.26, -3.75);
  scene.add(shishi);

  // bamboo fence and grove at the back of the garden, then the night sky
  const fenceTex = canvasTexture(1024, 256, (ctx, w, h) => {
    const r = rng(21);
    for (let x = 0; x < w; x += 16) {
      const tone = 0.7 + r() * 0.5;
      ctx.fillStyle = `rgb(${(96 * tone) | 0},${(84 * tone) | 0},${(48 * tone) | 0})`; ctx.fillRect(x, 0, 15, h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 14, 0, 2, h);
      for (let y = r() * 60; y < h; y += 50 + r() * 30) { ctx.fillStyle = 'rgba(30,25,10,0.5)'; ctx.fillRect(x, y, 15, 3); }
    }
    ctx.fillStyle = '#231a10'; for (const y of [40, 150]) ctx.fillRect(0, y, w, 12);
  }, { repeat: [4, 1] });
  const fence = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.0), std(0xffffff, 0.9, 0, { map: fenceTex }));
  fence.position.set(0, 0.74, -8.6); scene.add(fence);
  {
    const stalks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 6), std(0x4c6a36, 0.7), 40);
    const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std(0x2c4a2e, 0.9, 0, { flatShading: true }), 40);
    for (let i = 0; i < 40; i++) {
      const x = -10 + R() * 20, z = -9.2 - R() * 2.2, hgt = 4.2 + R() * 2.6;
      tmp.position.set(x, hgt / 2 - 0.26, z); tmp.rotation.set(0, 0, (R() - 0.5) * 0.12); tmp.scale.set(1, hgt, 1); tmp.updateMatrix(); stalks.setMatrixAt(i, tmp.matrix);
      tmp.position.set(x + (R() - 0.5) * 0.5, hgt - 0.6, z); tmp.rotation.set(R(), R(), R()); tmp.scale.set(0.9 + R() * 0.5, 0.7 + R() * 0.6, 0.8); tmp.updateMatrix(); leaves.setMatrixAt(i, tmp.matrix);
    }
    scene.add(stalks, leaves);
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 24, 16), new THREE.MeshBasicMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false,
    map: canvasTexture(16, 256, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#03050f'); g.addColorStop(0.42, '#0a1230'); g.addColorStop(0.5, '#1b2c5c'); g.addColorStop(0.53, '#0a1024'); g.addColorStop(1, '#05070f'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }),
  }));
  scene.add(sky);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.45, 2.0), fog: false }));
  moonDisc.position.set(-17, 15.5, -52); moonDisc.lookAt(0, 2, 0); scene.add(moonDisc);
  {
    const n = 420, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, e = 0.07 + R() * 1.2, rad = 100;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * rad; pos[i * 3 + 1] = Math.sin(e) * rad; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * rad;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, color: 0xcdd8ff, fog: false, transparent: true, opacity: 0.85 })));
  }
  fx.createDrift({ kind: S.drift, count: S.drift === 'firefly' ? 46 : 110, box: S.drift === 'firefly' ? { x0: -4, x1: 5, y0: 0.1, y1: 1.6, z0: -7.5, z1: -3.2 } : { x0: -5.5, x1: 6, y0: -0.2, y1: 3.4, z0: -8, z1: -2.2 } });

  // ---------------------------------------------------------------- camera
  const cam = { pos: new THREE.Vector3(0, 3.2, 3.2), target: new THREE.Vector3(0, 0.66, -0.16), fov: 36, shake: 0, view: 'title', t: 0, snap: true, aspect: 16 / 9, focus: null, focusK: 0 };
  const wantPos = new THREE.Vector3(), wantTarget = new THREE.Vector3(), lookAt = new THREE.Vector3();
  const PITCH = (38 * Math.PI) / 180;
  function viewPose(name, t) {
    const a = cam.aspect;
    if (name === 'play') {
      const fov = 36;
      const d = Math.max(3.75, 2.5 / (Math.tan((fov * Math.PI) / 360) * a));
      wantTarget.set(0, 0.68, -0.2);
      wantPos.set(0, 0.68 + d * Math.sin(PITCH), -0.2 + d * Math.cos(PITCH));
      return fov;
    }
    if (name === 'calib') { wantPos.set(0, 2.5, 5.0); wantTarget.set(0, 0.85, -0.5); return 36; }
    if (name === 'win0' || name === 'win1') {
      const s = name === 'win0' ? -1 : 1;
      const o = Math.sin(t * 0.35) * 0.22;
      wantPos.set(s * (2.6 + o), 1.25, 2.0); wantTarget.set(s * 0.7, 1.0, -2.6); return 38;
    }
    if (name === 'winboth') { wantPos.set(Math.sin(t * 0.3) * 0.8, 1.55, 4.4); wantTarget.set(0, 0.95, -0.9); return 38; }
    // title: a slow dolly at eye level, table pushed to the right half so the title has room
    const sway = Math.sin(t * 0.085);
    const narrow = a < 1.25;
    wantPos.set(narrow ? sway * 1.2 : -1.35 + sway * 0.8, 1.85 + 0.1 * Math.sin(t * 0.13), narrow ? 6.6 : 5.9);
    wantTarget.set(narrow ? 0 : -1.2 + sway * 0.2, narrow ? 1.5 : 1.12, -1.4);
    return narrow ? 46 : 40;
  }
  function setView(name, snap = false) { cam.view = name; if (snap) cam.snap = true; }
  function updateCamera(dt, t) {
    cam.t += dt;
    const fov = viewPose(cam.view, cam.t);
    if (cam.focus && cam.view === 'play') { wantTarget.lerp(cam.focus, cam.focusK); }
    const k = cam.snap ? 1 : 1 - Math.exp(-dt * (cam.view === 'play' ? 2.6 : 1.7));
    cam.snap = false;
    cam.pos.lerp(wantPos, k); cam.target.lerp(wantTarget, k); cam.fov += (fov - cam.fov) * k;
    cam.shake *= Math.exp(-dt * 9);
    camera.position.copy(cam.pos);
    if (cam.shake > 0.0005) {
      camera.position.x += (Math.sin(t * 91) + Math.sin(t * 57.3)) * 0.5 * cam.shake;
      camera.position.y += (Math.cos(t * 83) + Math.sin(t * 61.7)) * 0.5 * cam.shake;
    }
    if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    lookAt.copy(cam.target);
    camera.lookAt(lookAt);
    roof.visible = camera.position.y < 3.9;
  }

  // ---------------------------------------------------------------- per-frame animation
  const v3 = new THREE.Vector3();
  const animState = { kick: 0, cheer: false, win: false };
  function updateCharacter(d, dt, t, targetZ) {
    const model = d.model;
    // follow the racket along the bench
    const prev = d.z;
    d.z += (targetZ - d.z) * (1 - Math.exp(-dt * 9));
    const speed = dt > 0 ? (d.z - prev) / dt : 0;
    d.lean += (THREE.MathUtils.clamp(speed * 0.22, -0.5, 0.5) - d.lean) * (1 - Math.exp(-dt * 10));
    // hop: a spring pushed by hits and cheers
    d.hopV += (-d.hop * 260 - d.hopV * 14) * dt;
    d.hop += d.hopV * dt;
    if (d.cheerT > 0) { d.cheerT -= dt; if (d.hop < 0.004 && d.hopV < 0.2) d.hopV = 1.9; }
    d.kick *= Math.exp(-dt * 3.5);
    // tumble: fall over, then rock back up (seven falls, eight rises)
    if (d.tumbleT > 0) { d.tumbleT -= dt; d.tiltTarget = d.tumbleT > 0.45 ? 1.45 : 0; }
    d.tiltV += ((d.tiltTarget - d.tilt) * 75 - d.tiltV * 4.2) * dt;
    d.tilt += d.tiltV * dt;
    d.spin *= Math.exp(-dt * 2.2);
    d.rig.position.z = d.z;
    // the winner turns to the camera
    const wantYaw = d.faceCamera ? Math.atan2(camera.position.x - d.rig.position.x, camera.position.z - d.rig.position.z) : d.baseYaw;
    d.yaw += (wantYaw - d.yaw) * (1 - Math.exp(-dt * 3));
    d.rig.rotation.y = d.yaw + d.spin;
    // the hop lifts and squashes the character's own "hopper" (the whole model, or just the rabbit on its tray)
    const breathe = 1 + Math.sin(t * 2.1 + d.side * 1.7) * 0.012;
    const squash = THREE.MathUtils.clamp(-d.hop * 6, -0.16, 0.3);
    model.hopper.position.y = model.hopperBase + Math.max(0, d.hop) * model.hopScale;
    model.hopper.scale.set(1 + squash * 0.6, breathe * (1 - squash), 1 + squash * 0.6);
    // lean with the slide (around the axis pointing along the bench's width) and tumble backwards
    d.wobble.rotation.set(-0.16 - d.tilt * 0.9 + Math.sin(t * 1.3 + d.side) * 0.02, 0, 0);
    d.wobble.rotateOnWorldAxis(v3.set(1, 0, 0), d.lean);
    animState.kick = d.kick; animState.cheer = d.cheerT > 0; animState.win = d.faceCamera;
    model.animate(dt, t, animState);
  }

  let shishiT = 4;
  function update(dt, t, sim) {
    poolMat.uniforms.uTime.value = t;
    for (const a of andons) a.shade.material.emissiveIntensity = 1.45 + Math.sin(t * 7.3 + a.seed) * 0.12 + Math.sin(t * 2.9 + a.seed * 2) * 0.1;
    for (const l of lanterns) { l.g.rotation.z = Math.sin(t * 0.8 + l.seed) * 0.05; l.g.rotation.x = Math.cos(t * 0.63 + l.seed) * 0.035; }
    engawaL.intensity = 3.2 + Math.sin(t * 6.1) * 0.2; engawaR.intensity = 3.2 + Math.sin(t * 5.3 + 2) * 0.2;
    treeLight.intensity = 7 + Math.sin(t * 0.9) * 0.6;
    poolLight.intensity = 3.5 + Math.sin(t * 1.7) * 0.5;

    // shishi-odoshi: 13 s cycle, the knock comes as the tube swings back
    shishiT += dt;
    const c = shishiT % 13;
    let ang = 0.34 - 0.1 * Math.min(1, c / 10.4);
    if (c > 10.4 && c <= 11.2) ang = 0.24 - 0.85 * ((c - 10.4) / 0.8) ** 2;
    else if (c > 11.2 && c <= 11.55) ang = -0.61;
    else if (c > 11.55) ang = -0.61 + 0.95 * Math.min(1, (c - 11.55) / 0.22);
    if (c > 11.77 && shishi.userData.armed) { shishi.userData.armed = false; if (callbacks.onShishi) callbacks.onShishi(); }
    if (c < 1) shishi.userData.armed = true;
    shishiArm.rotation.z = ang;

    for (const k of kokeshi) {
      if (k.delay > 0) { k.delay -= dt; if (k.delay <= 0) k.hopV = 1.5 + Math.random() * 0.8; }
      k.hopV += (-k.hop * 240 - k.hopV * 9) * dt; k.hop += k.hopV * dt;
      k.group.position.y = k.baseY + Math.max(0, k.hop);
      k.group.rotation.z = Math.sin(t * 1.6 + k.phase) * 0.045;
      k.head.rotation.y = Math.sin(t * 0.7 + k.phase) * 0.25 + (sim && sim.ball.state === 'live' ? THREE.MathUtils.clamp(sim.ball.x * 0.35, -0.6, 0.6) : 0);
    }
    for (const card of cards) {
      if (card.flip > 0) {
        card.flip = Math.max(0, card.flip - dt * 3.2);
        if (card.pending !== null && card.flip < 0.5) { drawCard(card, card.pending); card.pending = null; }
        card.mesh.rotation.x = Math.sin(card.flip * Math.PI) * 1.35;
      }
    }
    for (const r of rails) { r.kick *= Math.exp(-dt * 12); r.g.position.y = T + 0.035 + r.kick * 0.03; r.g.rotation.x = r.kick * 0.25 * (r.far ? -1 : 1); }
    for (const g of guards) {
      g.k += ((g.on ? 1 : 0) - g.k) * (1 - Math.exp(-dt * 9));
      g.g.visible = g.k > 0.01; g.g.scale.y = Math.max(0.001, g.k);
    }
    for (const [id, it] of itemMeshes) {
      it.born = Math.min(1, it.born + dt * 3);
      if (it.gone > 0) { it.gone -= dt * 3.2; if (it.gone <= 0) { disposeItem(it); itemMeshes.delete(id); continue; } }
      const s = it.gone > 0 ? it.gone : it.born;
      it.g.position.y = 0.15 + Math.sin(t * 2.4 + id) * 0.025;
      it.g.rotation.y = t * 1.4;
      it.root.scale.setScalar(Math.max(0.001, s * (1 + 0.3 * Math.sin(Math.min(1, it.born) * Math.PI))));
      it.ring.material.opacity = 0.5 + 0.35 * Math.sin(t * 5);
      it.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 5));
    }
    for (const g of guides) {
      g.k += ((g.on ? 1 : 0) - g.k) * (1 - Math.exp(-dt * 10));
      g.m.material.opacity = g.k * (0.55 + 0.35 * Math.sin(t * 9));
      g.m.scale.setScalar(1 + (1 - g.k) * 0.8 + 0.06 * Math.sin(t * 9));
    }
    updateCamera(dt, t);
  }

  /** Copy the simulation state into the scene, once per rendered frame. */
  function sync(sim, dt, t) {
    const b = sim.ball;
    const shown = b.state !== 'hidden';
    ball.visible = shown; ballGlow.visible = shown;
    if (shown) {
      const s = b.r / BALL_BASE_R;
      ball.scale.setScalar(s);
      ball.position.set(b.x, T + b.r + b.z, -b.y);
      ball.rotation.z = -b.spin; ball.rotation.x = b.spin * 0.6;
      const heat = THREE.MathUtils.clamp((b.speed / sim.cfg.ballSpeed - 1) / 0.9, 0, 1) * (b.state === 'live' ? 1 : 0) + (b.smash ? 0.6 : 0);
      ballMat.emissiveIntensity = 0.75 + heat * 1.6;
      ballMat.emissive.setRGB(1.0, 0.65 - 0.3 * Math.min(1, heat), 0.23 - 0.12 * Math.min(1, heat));
      ballGlow.position.copy(ball.position);
      ballGlow.scale.setScalar(b.r * (5 + heat * 4));
      ballGlow.material.opacity = 0.32 + 0.3 * Math.min(1, heat);
      ballLight.position.copy(ball.position); ballLight.intensity = 0.22 + heat * 0.8;
      // blob shadow on the table, or on the floor once the ball is past the edge
      const onTable = Math.abs(b.x) < HL && Math.abs(b.y) < HW;
      const hAbove = onTable ? b.z : T + b.z;
      ballShadow.visible = true;
      ballShadow.position.set(b.x, (onTable ? T : 0) + 0.004, -b.y);
      const size = b.r * (2.6 + hAbove * 3.2);
      ballShadow.scale.set(size, size, 1);
      ballShadow.material.opacity = THREE.MathUtils.clamp(0.55 - hAbove * 0.55, 0.12, 0.55);
      fx.updateTrail(ball.position, b.state === 'live', Math.min(1, heat), b.r * 0.95);
    } else {
      ballShadow.visible = false; ballLight.intensity = 0;
      fx.updateTrail(ball.position, false, 0, 0);
    }
    for (const r of rackets) {
      const p = sim.paddles[r.side];
      r.group.position.z = -p.y;
      r.half += (p.half - r.half) * (1 - Math.exp(-dt * 10));
      r.blade.scale.z = r.half; r.rim.scale.x = r.half;
      r.strip.position.z = -p.y; r.strip.scale.y = r.half * 2;
      r.swingV += (-r.swing * 330 - r.swingV * 21) * dt; r.swing += r.swingV * dt;
      r.tilt.rotation.z = 0.52 - r.swing;
      r.glow *= Math.exp(-dt * 5);
      const big = p.bigUntil > 0;
      r.rim.visible = big || r.glow > 0.05;
      r.strip.material.opacity = 0.34 + r.glow * 0.5 + (big ? 0.2 : 0);
      updateCharacter(players[r.side], dt, t, -p.y * 0.9);
      guards[r.side].on = p.guard;
    }
    update(dt, t, sim);
  }

  const api = {
    scene, camera, fx, callbacks, season: S,
    update, sync, setView,
    resize(aspect) { cam.aspect = aspect; camera.aspect = aspect; camera.updateProjectionMatrix(); },
    /** Screen-space y (0 bottom .. 1 top) of the table centre, for the tilt-shift focus band. */
    tableScreenY() { v3.set(0, T, 0).project(camera); return v3.y * 0.5 + 0.5; },
    project(x, y, z) { v3.set(x, y, z).project(camera); return { x: v3.x * 0.5 + 0.5, y: 1 - (v3.y * 0.5 + 0.5) }; },
    courtToWorld(x, y, z = 0) { return new THREE.Vector3(x, T + z, -y); },
    shake(amount) { cam.shake = Math.max(cam.shake, amount); },
    /** Lean the play camera towards a point for a moment (who just scored). */
    focusOn(x, k = 0.12) { if (x === null) { cam.focus = null; return; } cam.focus = new THREE.Vector3(x, 0.72, -0.2); cam.focusK = k; },
    hit(side, power, smash) {
      const r = rackets[side];
      r.swingV = 9 + power * 6 + (smash ? 8 : 0);
      r.glow = 1;
      players[side].hopV = Math.max(players[side].hopV, 0.9 + power * 0.7 + (smash ? 0.8 : 0));
      players[side].kick = 1;
    },
    railHit(far) { const r = rails.find((q) => q.far === far); if (r) r.kick = 1; },
    point(scorer, loser) {
      if (scorer !== null) { players[scorer].cheerT = 1.3; players[scorer].spin += scorer === 0 ? 5 : -5; }
      if (loser !== null) players[loser].tumbleT = 1.25;
      api.cheer(1);
    },
    cheer(strength = 1) { for (const k of kokeshi) if (Math.random() < 0.55 + strength * 0.45) k.delay = 0.02 + Math.random() * 0.5; },
    /** The winner turns to the camera and celebrates in its own way (the daruma gets its second eye). side: 0 | 1 | 'both' */
    celebrate(side) {
      for (const d of players) if (side === 'both' || d.side === side) { d.cheerT = 6; d.faceCamera = true; d.model.celebrate(); }
    },
    resetCharacters() {
      for (const d of players) {
        d.cheerT = 0; d.tumbleT = 0; d.tiltTarget = 0; d.spin = 0; d.faceCamera = false; d.kick = 0;
        d.model.reset();
      }
    },
    /** Swap the character of one side (key of CHARACTERS in characters.js). */
    setCharacter,
    characterKind(side) { return players[side].model.kind; },
    setBoard(left, right, flip = true) {
      [left, right].forEach((text, i) => {
        const card = cards[i];
        const next = String(text);
        if (next === card.text && card.pending === null) return;
        if (flip) { card.pending = next; card.flip = 1; } else { drawCard(card, next); card.pending = null; card.flip = 0; card.mesh.rotation.x = 0; }
      });
    },
    addItem(item) {
      const it = buildItem(item.type);
      it.root.position.set(item.x, T, -item.y);
      scene.add(it.root);
      itemMeshes.set(item.id, it);
    },
    removeItem(id) { const it = itemMeshes.get(id); if (it && it.gone <= 0) it.gone = 1; },
    clearItems() { for (const [, it] of itemMeshes) disposeItem(it); itemMeshes.clear(); },
    setGuide(side, y) { const g = guides[side]; if (y === null) { g.on = false; return; } g.on = true; g.m.position.z = -THREE.MathUtils.clamp(y, -HW + 0.08, HW - 0.08); },
    hideBall() { ball.visible = false; ballGlow.visible = false; ballShadow.visible = false; ballLight.intensity = 0; fx.updateTrail(ball.position, false, 0, 0); },
    /** World position of a racket, for particles and popups. */
    racketPosition(side) { return rackets[side].group.position; },
    characterPosition(side) { return players[side].rig.position; },
  };
  return api;
}
