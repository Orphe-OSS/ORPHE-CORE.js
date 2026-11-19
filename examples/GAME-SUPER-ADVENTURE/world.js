// world.js — what the course looks like: a block-built road across a lake, under a blue sky,
// built from level.js.
//
// The look is the one side-scrolling platformers have had for forty years, turned to face the
// runner: grass-topped blocks of earth, floating blocks, gold coins, round green hills, puffy
// clouds. Everything is drawn here (pixel textures on small canvases, simple shapes); there are
// no image files.
//
// The road runs away from the camera along -z (z = -s). Everything here is presentation: it
// reads the simulation, never changes it.
import * as THREE from 'three';
import { RULES, enemyS, hammerState, bridgeState } from './rules.js';
import { inked, hatchTexture, INK, PAPER } from './body.js';

export const TRACK_W = 3.4;
const TILE = 0.85;          // four tiles across the road
const WATER_Y = -8;

// one palette per zone
export const PALETTES = [
  { top: 0x1f7af0, horizon: 0xbfe6ff, fog: 0xcbeaff, grass: 0x5ccb3c, grassHi: 0x8fe35c, lip: 0x3fa52c, dirt: 0xc8813f, dirtDark: 0x9a5c2a, hill: 0x45b03c, hillHi: 0x6bcf52, water: 0x2f9cf0, jelly: 0xff5f8f, accent: 0x2f7dff },
  { top: 0x2468e6, horizon: 0xd6f0ff, fog: 0xdcf2ff, grass: 0x45d2ac, grassHi: 0x8cecd2, lip: 0x26a888, dirt: 0xd8a55e, dirtDark: 0xa97a3c, hill: 0x38b894, hillHi: 0x66d9b6, water: 0x4ab2ff, jelly: 0x8f6bff, accent: 0x00a8c8 },
  { top: 0x4a63d6, horizon: 0xffd0a0, fog: 0xffddb8, grass: 0xaab0bc, grassHi: 0xcdd2da, lip: 0x7f8592, dirt: 0x7d8390, dirtDark: 0x5c616c, hill: 0x9a7650, hillHi: 0xb89468, water: 0x5c8fe0, jelly: 0xff8a3a, accent: 0xe05a2a },
  { top: 0x1a66e0, horizon: 0xffeaa8, fog: 0xfff0c6, grass: 0x82d83c, grassHi: 0xb8f25e, lip: 0x58ac28, dirt: 0xd98a3a, dirtDark: 0xa6622a, hill: 0x58b83c, hillHi: 0x88d85c, water: 0x3aa8f0, jelly: 0xb48cff, accent: 0xff9a1a },
];
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const css = (hex) => `#${new THREE.Color(hex).getHexString()}`;
const shade = (hex, k) => css(new THREE.Color(hex).multiplyScalar(k));

function canvasTex(w, h, draw, { repeat = false, pixel = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (pixel) g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (pixel) t.magFilter = THREE.NearestFilter;     // big square pixels up close, smooth far away
  t.anisotropy = 8;
  return t;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
/** A box pulled part of the way to a sphere: a soft cube. */
function softBox(w, h, d, k = 0.35) {
  const geo = new THREE.BoxGeometry(w, h, d, 6, 6, 6);
  const pos = geo.attributes.position, v = new THREE.Vector3(), n = new THREE.Vector3();
  const half = new THREE.Vector3(w / 2, h / 2, d / 2);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).divide(half).normalize().multiply(half).multiplyScalar(1.18);   // the same point on the ellipsoid around the box
    v.lerp(n, k);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
/** Several geometries as one (positions + normals only). */
function mergeGeo(parts) {
  const pos = [], nor = [];
  for (const g of parts) {
    const ni = g.index ? g.toNonIndexed() : g;
    pos.push(...ni.attributes.position.array); nor.push(...ni.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}
/**
 * A box whose faces repeat a tile at its real size. Sides are measured down from the top edge, so the
 * pattern lines up along a row of blocks of different heights. The top runs along the course from s0.
 * top: { u, v } overrides the repeat on the top face (u across, v per metre along the course).
 */
function tiledBox(w, h, d, s0 = 0, top = null) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, nor = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, u * d / TILE, (v - 1) * h / TILE);
    else if (Math.abs(nor.getZ(i)) > 0.5) uv.setXY(i, u * w / TILE, (v - 1) * h / TILE);
    else if (top) uv.setXY(i, u * top.u, (s0 + v * d) * top.v);
    else uv.setXY(i, u * w / TILE, (s0 + v * d) / TILE);
  }
  return geo;
}

export function createWorld({ scene, level }) {
  const zones = level.zones;
  const zoneAt = (s) => { let z = 0; for (let i = 0; i < zones.length; i++) if (s >= zones[i].s) z = i; return z; };
  const palAt = (s) => PALETTES[zones[zoneAt(s)].palette];
  const W = TRACK_W;
  const root = new THREE.Group();
  scene.add(root);
  const JA = '"DotGothic16", "Hiragino Maru Gothic ProN", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif';
  const EN = '"DotGothic16", "Bebas Neue", "Arial Narrow", sans-serif';

  // ------------------------------------------------------------ sky, light, fog
  scene.fog = new THREE.Fog(PALETTES[0].fog, 45, 300);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xa8d890, 2.0);
  const sunLight = new THREE.DirectionalLight(0xfff6e0, 2.1);
  sunLight.position.set(-4, 10, 8);      // from behind the runner's left shoulder: tops and the faces ahead are lit
  scene.add(hemi, sunLight);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
        void main(){ float h = max(0.0, vDir.y); vec3 c = mix(horizon, top, pow(min(1.0, h * 1.9), 0.55));
        gl_FragColor = vec4(c, 1.0); }`,
    })
  );
  sky.renderOrder = -10;
  scene.add(sky);

  const sunTex = canvasTex(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.22, 'rgba(255,250,210,1)');
    grad.addColorStop(0.3, 'rgba(255,236,150,0.55)'); grad.addColorStop(1, 'rgba(255,236,150,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(330, 330), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false, color: new THREE.Color(1.6, 1.5, 1.2) }));
  sun.renderOrder = -9;
  scene.add(sun);

  // the lake the road crosses
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, deep: { value: new THREE.Color() }, far: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mv = viewMatrix * wp; vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float time; uniform vec3 deep; uniform vec3 far; varying vec3 vW; varying float vD;
        void main(){
          vec2 p = floor(vW.xz * 2.0) / 2.0;                                    // half-metre squares: pixel water
          float wave = sin(p.x * 0.7 + time * 1.1) * sin(p.y * 0.5 - time * 0.8);
          float glint = step(0.93, sin(p.x * 2.3 + time * 0.9) * sin(p.y * 1.9 - time * 1.4));
          vec3 c = deep * (0.92 + 0.1 * wave) + glint * 0.35;
          gl_FragColor = vec4(mix(c, far, smoothstep(40.0, 300.0, vD)), 1.0);
        }`,
    })
  );
  water.position.y = WATER_Y;
  scene.add(water);

  // ------------------------------------------------------------ clouds and hills
  const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();   // the same scenery every time
  const dummy = new THREE.Object3D();
  {
    const puff = (x, y, z, r) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
    const cloudGeo = mergeGeo([puff(0, 0, 0, 1), puff(1.2, -0.15, 0, 0.75), puff(-1.2, -0.2, 0.1, 0.7), puff(0.5, 0.45, -0.1, 0.7), puff(-0.5, 0.35, 0, 0.6)]);
    cloudGeo.scale(1, 0.62, 0.8);
    const count = Math.ceil((level.length + 420) / 9);
    const clouds = new THREE.InstancedMesh(cloudGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xb8d4f0, emissiveIntensity: 0.55 }), count);
    for (let i = 0; i < count; i++) {
      const s = -80 + i * 9 + rnd() * 6, side = rnd() < 0.5 ? -1 : 1;
      dummy.position.set(side * (9 + rnd() * 70), 9 + rnd() * 30, -s);
      dummy.scale.setScalar(1.8 + rnd() * 4.2);
      dummy.rotation.set(0, rnd() * 0.6 - 0.3, 0);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.frustumCulled = false;
    root.add(clouds);

    // round hills with stripes, rising out of the lake on both sides
    const hillTex = canvasTex(8, 64, (g, w, h) => { for (let y = 0; y < h; y += 8) { g.fillStyle = (y / 8) % 2 ? '#ffffff' : '#dcdcdc'; g.fillRect(0, y, w, 8); } }, { pixel: true });
    const hillGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const hillCount = Math.ceil((level.length + 420) / 11) * 2;
    const hills = new THREE.InstancedMesh(hillGeo, new THREE.MeshLambertMaterial({ map: hillTex }), hillCount);
    const c = new THREE.Color();
    for (let i = 0; i < hillCount; i++) {
      const s = -90 + Math.floor(i / 2) * 11 + rnd() * 8, side = i % 2 ? 1 : -1;
      const r = 6 + rnd() * 16;
      const P = palAt(Math.max(0, Math.min(level.length, s)));
      dummy.position.set(side * (W / 2 + 7 + r * 0.9 + rnd() * 55), WATER_Y - 0.5, -s);
      dummy.scale.set(r, r * (0.8 + rnd() * 0.9), r);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      hills.setMatrixAt(i, dummy.matrix);
      hills.setColorAt(i, c.set(rnd() < 0.5 ? P.hill : P.hillHi));
    }
    hills.instanceColor.needsUpdate = true;
    hills.frustumCulled = false;
    root.add(hills);
  }

  // ------------------------------------------------------------ pixel textures
  /** Grass: a checkerboard of two greens (it shows how fast the ground goes by), with a few bright pixels. */
  const grassTex = (P) => canvasTex(32, 32, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? css(P.grass) : shade(P.grass, 0.9); g.fillRect(x * 16, y * 16, 16, 16); }
    g.fillStyle = css(P.grassHi);
    for (const [x, y] of [[3, 4], [4, 4], [11, 9], [20, 3], [21, 3], [26, 12], [6, 21], [7, 21], [14, 27], [24, 22], [29, 28]]) g.fillRect(x, y, 1, 2);
    g.fillStyle = shade(P.grass, 0.78);
    for (const [x, y] of [[8, 13], [18, 7], [2, 29], [22, 18], [28, 5], [12, 19]]) g.fillRect(x, y, 2, 1);
  }, { repeat: true, pixel: true });
  /** Earth: rows of blocks with a light edge on top and a dark one below. */
  const dirtTex = (P) => canvasTex(32, 32, (g) => {
    g.fillStyle = css(P.dirt); g.fillRect(0, 0, 32, 32);
    for (let row = 0; row < 2; row++) for (let col = -1; col < 2; col++) {
      const x = col * 16 + (row ? 8 : 0), y = row * 16;
      g.fillStyle = shade(P.dirt, 1.14); g.fillRect(x + 1, y + 1, 14, 2);
      g.fillStyle = css(P.dirtDark); g.fillRect(x, y + 14, 16, 2); g.fillRect(x + 15, y, 1, 16);
      g.fillStyle = shade(P.dirt, 0.9); g.fillRect(x + 4, y + 7, 3, 2); g.fillRect(x + 10, y + 10, 2, 2);
    }
  }, { repeat: true, pixel: true });
  /** A building block: bevelled, for platforms in the air. */
  const blockTex = (base) => canvasTex(16, 16, (g) => {
    g.fillStyle = css(base); g.fillRect(0, 0, 16, 16);
    g.fillStyle = shade(base, 1.25); g.fillRect(0, 0, 16, 2); g.fillRect(0, 0, 2, 16);
    g.fillStyle = shade(base, 0.62); g.fillRect(0, 14, 16, 2); g.fillRect(14, 0, 2, 16);
    g.fillStyle = shade(base, 0.85); g.fillRect(5, 5, 6, 6);
  }, { repeat: true, pixel: true });
  const chevTex = (dir) => canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineJoin = 'miter'; g.lineCap = 'butt';
    for (const y0 of [34, 62]) {
      g.beginPath();
      if (dir > 0) { g.moveTo(8, y0); g.lineTo(32, y0 - 22); g.lineTo(56, y0); }     // points away from the runner: go!
      else { g.moveTo(8, y0 - 22); g.lineTo(32, y0); g.lineTo(56, y0 - 22); }        // points at the runner: ease off
      g.stroke();
    }
  }, { repeat: true });
  const dashTex = chevTex(1), slowTex = chevTex(-1);
  const hazardTex = canvasTex(128, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#fff';
    for (let x = -64; x < w + 64; x += 44) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 22, h); g.lineTo(x + 54, 0); g.lineTo(x + 32, 0); g.closePath(); g.fill(); }
  }, { repeat: true });
  const beltTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffb020'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(12, 20); g.lineTo(32, 42); g.lineTo(52, 20); g.stroke();   // points toward the runner: the belt runs backwards
    g.fillStyle = '#22252c'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  }, { repeat: true });

  const mats = PALETTES.map((P) => ({
    side: new THREE.MeshLambertMaterial({ map: dirtTex(P) }),
    top: new THREE.MeshLambertMaterial({ map: grassTex(P) }),
    lip: new THREE.MeshLambertMaterial({ color: P.lip }),
    block: new THREE.MeshLambertMaterial({ map: blockTex(P.dirt) }),
  }));
  const beltMat = new THREE.MeshLambertMaterial({ map: beltTex });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // ------------------------------------------------------------ the road
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const addBox = (mat, sx, sy, sz, x, y, z, parent = root) => {
    const m = new THREE.Mesh(unitBox, mat);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  /** A flat strip on top of the road from a to b; v runs along the course so the pattern lines up. */
  function topPlane(a, b, mat, width = W, vScale = 1 / TILE, uScale = width / TILE) {
    const len = b - a;
    const geo = new THREE.PlaneGeometry(width, len).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uScale, (a + uv.getY(i) * len) * vScale);
    const m = new THREE.Mesh(geo, mat);
    m.position.z = -(a + b) / 2;
    return m;
  }
  const grounds = level.platforms.filter((p) => p.kind === 'ground').sort((p, q) => p.a - q.a);
  const prevOf = (p) => grounds.find((q) => Math.abs(q.b - p.a) < 0.05);
  const nextOf = (p) => grounds.find((q) => Math.abs(q.a - p.b) < 0.05);
  const bridgeAt = (s) => level.bridges.some((br) => Math.abs(br.a - s) < 0.05 || Math.abs(br.b - s) < 0.05);

  for (const p of level.platforms) {
    const M = mats[zones[zoneAt((p.a + p.b) / 2)].palette];
    const len = p.b - p.a, mid = -(p.a + p.b) / 2;
    if (p.kind !== 'ground') {
      // a row of blocks in the air
      const m = new THREE.Mesh(tiledBox(W, p.thick, len, p.a), M.block);
      m.position.set(0, p.h - p.thick / 2, mid);
      root.add(m);
      continue;
    }
    const bodyH = p.h - WATER_Y + 2;
    let topMat = M.top, topUV = null;
    if (p.belt) { topMat = beltMat; topUV = { u: 3, v: 1 / 1.1 }; }
    else if (p.finale) { topMat = runwayMaterial(p); topUV = { u: 1, v: 0 }; }
    const geo = tiledBox(W, bodyH, len, p.a, topUV);
    if (p.finale) { const uv = geo.attributes.uv, nor = geo.attributes.normal; for (let i = 0; i < uv.count; i++) if (nor.getY(i) > 0.5) uv.setXY(i, uv.getX(i), i % 4 < 2 ? 1 : 0); }
    const body = new THREE.Mesh(geo, [M.side, M.side, topMat, M.side, M.side, M.side]);
    body.position.set(0, p.h - bodyH / 2, mid);
    root.add(body);
    // the turf hangs over the edge of the earth a little
    if (!p.belt && !p.finale) addBox(M.lip, W + 0.14, 0.2, len + 0.06, 0, p.h - 0.104, mid);
    // a white line at the edge of every hole (or blink bridge)
    const prev = prevOf(p), next = nextOf(p);
    if (!prev && p.a > 0.5) addBox(lineMat, W, 0.02, 0.14, 0, p.h + 0.008, -p.a - 0.07);
    if ((!next || bridgeAt(p.b)) && p.b < level.length - 0.5 && !(level.finale && Math.abs(p.b - level.finale.board) < 0.05)) addBox(lineMat, W, 0.02, 0.14, 0, p.h + 0.008, -p.b + 0.07);
  }

  /** The long-jump runway: distance marks from the take-off board. */
  function runwayMaterial(p) {
    const len = p.b - p.a, PX = 64;
    const tex = canvasTex(Math.round(W * PX), Math.round(len * PX), (g, w, h) => {
      g.fillStyle = '#f0d9a0'; g.fillRect(0, 0, w, h);                 // sand
      g.fillStyle = '#e6c888';
      for (let i = 0; i < 900; i++) g.fillRect(Math.floor(Math.random() * w / 4) * 4, Math.floor(Math.random() * h / 4) * 4, 4, 4);
      const F = level.finale;
      for (let d = 2; d < 16; d++) {
        const s = F.board + d;
        if (s <= p.a || s >= level.goal) continue;
        const y = h - (s - p.a) * PX;
        const major = d >= 5;
        g.fillStyle = major ? '#e0452a' : '#b08a50';
        g.fillRect(0, y - 3, w, 6);
        g.font = `${major ? 60 : 46}px ${EN}`;
        g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.fillText(`${d} m`, w / 2, y - 8);
      }
      // the goal line
      const gy = h - (level.goal - p.a) * PX;
      for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#222'; g.fillRect(i * w / 12, gy - 20 + j * 20, w / 12, 20); }
    });
    return new THREE.MeshLambertMaterial({ map: tex });
  }
  // take-off board
  if (level.finale) {
    const F = level.finale;
    addBox(new THREE.MeshBasicMaterial({ color: 0xffffff }), W, 0.02, 0.45, 0, F.h + 0.012, -(F.board - 0.225));
    addBox(new THREE.MeshBasicMaterial({ color: 0xe0452a }), W, 0.02, 0.1, 0, F.h + 0.014, -(F.board - 0.05));
  }

  // ------------------------------------------------------------ paint on the road: where to dash, where to slow down
  function textPlane(w, h, draw, pxPerM = 128) {
    const tex = canvasTex(Math.round(w * pxPerM), Math.round(h * pxPerM), draw);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  }
  function roadWord(s, y, word, color) {
    const plane = textPlane(W - 0.3, 1.5, (g, w, h) => {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${Math.round(h * 0.78)}px ${EN}`;
      g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(word, w / 2, h / 2);
      g.fillStyle = color; g.fillText(word, w / 2, h / 2);
    });
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, y + 0.02, -s);
    root.add(plane);
  }
  const C_DASH = new THREE.Color(0x2f8bff), C_DASH_OK = new THREE.Color(0x35e06a), C_SLOW = new THREE.Color(0xffd21f), C_SLOW_BAD = new THREE.Color(0xff3b30);
  const paceViews = [];
  /** Chevrons on every piece of ground between a and b. */
  function paint(a, b, h, kind, limit) {
    const tex = (kind === 'dash' ? dashTex : slowTex).clone();
    tex.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 });
    let any = false;
    for (const p of grounds) {
      const pa = Math.max(a, p.a + 0.15), pb = Math.min(b, p.b - 0.2);
      if (pb - pa < 0.8 || Math.abs(p.h - h) > 0.01 || p.belt) continue;
      const strip = topPlane(pa, pb, mat, 1.5, 1 / 1.5, 1);
      strip.position.y = p.h + 0.014;
      root.add(strip);
      any = true;
    }
    if (any) paceViews.push({ kind, a, b, limit, mat, tex });
  }
  for (const g of level.gaps || []) {
    if (g.dash) {
      const a = Math.max(g.from.a + 2.6, g.a - g.runup - 7);
      paint(a, g.a - 0.4, g.h, 'dash', g.vmin + 0.4);
      roadWord(a - 1.2, g.h, 'DASH', '#39a0ff');
    } else if (g.slow) {
      const a = Math.max(g.from.a + 0.3, g.a - 9);
      paint(a, g.a - 0.4, g.h, 'slow', g.vmax);
      if (g.a - a > 6) roadWord(a - 1.2, g.h, 'SLOW', '#ffd21f');
    }
  }
  for (const z of level.slowZones || []) {
    paint(z.a, z.b, z.h, 'slow', z.max);
    roadWord(z.a - 1.2, z.h, 'SLOW', '#ffd21f');
  }

  // ------------------------------------------------------------ coins
  const coinParts = [
    [new THREE.CylinderGeometry(0.21, 0.21, 0.05, 18).rotateX(Math.PI / 2), 0xf7a81c],     // the rim
    [new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14).rotateX(Math.PI / 2), 0xffe14a],     // the face
    [new THREE.BoxGeometry(0.05, 0.16, 0.1), 0xf7a81c],                                    // the mark on it
  ];
  const coinGeo = mergeGeo(coinParts.map(([g]) => g));
  {
    const col = [], c = new THREE.Color();
    for (const [g, hex] of coinParts) { c.set(hex); const n = (g.index ? g.index.count : g.attributes.position.count); for (let i = 0; i < n; i++) col.push(c.r, c.g, c.b); }
    coinGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  const notes = new THREE.InstancedMesh(coinGeo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffa000, emissiveIntensity: 0.25 }), level.notes.length);
  notes.frustumCulled = false;
  root.add(notes);
  const noteHidden = new Uint8Array(level.notes.length);
  const noteIndex = new Map(level.notes.map((n, i) => [n.id, i]));
  function updateNotes(s, time, gone) {
    const list = level.notes;
    let lo = 0, hi = list.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].s < s - 6) lo = m + 1; else hi = m; }
    for (let i = lo; i < list.length && list[i].s < s + 130; i++) {
      const n = list[i];
      const hidden = gone.has(n.id);
      if (hidden && noteHidden[i]) continue;
      noteHidden[i] = hidden ? 1 : 0;
      dummy.position.set(0, n.y + 0.05 * Math.sin(time * 3 + n.s), -n.s);
      dummy.rotation.set(0, time * 3.2 + n.s * 0.5, 0);
      // a coin about to be picked up shrinks, so it never fills the view
      dummy.scale.setScalar(hidden ? 0 : Math.min(1, Math.max(0.3, (n.s - s - 0.4) / 3)));
      dummy.updateMatrix();
      notes.setMatrixAt(i, dummy.matrix);
    }
    dummy.rotation.set(0, 0, 0);
    notes.instanceMatrix.needsUpdate = true;
  }
  function resetNotes() {
    noteHidden.fill(0);
    level.notes.forEach((n, i) => { dummy.position.set(0, n.y, -n.s); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); notes.setMatrixAt(i, dummy.matrix); });
    notes.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ coin blocks (hit them with the head)
  const coinBlockTex = canvasTex(32, 32, (g) => {
    g.fillStyle = '#f7a81c'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#ffd866'; g.fillRect(0, 0, 32, 3); g.fillRect(0, 0, 3, 32);
    g.fillStyle = '#b3650c'; g.fillRect(0, 29, 32, 3); g.fillRect(29, 0, 3, 32);
    // a coin in the middle
    g.fillStyle = '#b3650c'; g.beginPath(); g.arc(16.5, 17, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(16, 16, 8.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f7a81c'; g.fillRect(14, 10, 4, 12);
  }, { pixel: true });
  const feverBlockTex = canvasTex(32, 32, (g) => {
    g.fillStyle = '#ffe14a'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 3); g.fillRect(0, 0, 3, 32);
    g.fillStyle = '#d18a00'; g.fillRect(0, 29, 32, 3); g.fillRect(29, 0, 3, 32);
    // a bolt of lightning: speed
    g.fillStyle = '#e0452a';
    g.beginPath(); g.moveTo(19, 4); g.lineTo(8, 18); g.lineTo(15, 18); g.lineTo(12, 28); g.lineTo(24, 13); g.lineTo(17, 13); g.closePath(); g.fill();
  }, { pixel: true });
  const bellViews = new Map();
  for (const b of level.bells) {
    const size = b.fever ? 1.05 : 0.8;
    const mat = new THREE.MeshLambertMaterial({ map: b.fever ? feverBlockTex : coinBlockTex, emissive: b.fever ? 0xffb000 : 0x000000, emissiveIntensity: 0.5 });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    cube.position.set(0, b.y + size / 2 + 0.02, -b.s);
    root.add(cube);
    bellViews.set(b.id, { b, cube, mat, size, y: cube.position.y, gone: false });
  }

  // ------------------------------------------------------------ creatures
  // Three of them, all this game's own, drawn the way ORPHE-kun is drawn: white, a black outline,
  // big eyes with lashes, pen hatching instead of colour. (Faces are little ink drawings on a card.)
  //   プルプル (jelly)   a soft cube with a sprout on its head. Hops along in time with the music. Stomp it.
  //   ダッシュまる (dasher) a ball in goggles with a fin, always in a hurry. Stomp it, if you can time it.
  //   トゲまる (spike)   a grumpy chestnut. Does not move, cannot be stomped.
  const paper = new THREE.MeshBasicMaterial({ color: PAPER }), ink = new THREE.MeshBasicMaterial({ color: INK });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
  const shadowGeo = new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2);
  const ball = (r, mat, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.scale.set(sx, sy, sz); return m; };
  const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  // ---- faces: drawn with a pen that wobbles a little
  const wob = (() => { let q = 99; return () => ((q = (q * 16807) % 2147483647) / 2147483647 - 0.5) * 3; })();
  function stroke(g, pts, width = 7) {
    g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#17171c';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x + wob(), y + wob()) : g.moveTo(x, y)));
    g.stroke();
  }
  function oval(g, cx, cy, rx, ry, fill, width = 7) {
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (width) { g.lineWidth = width; g.strokeStyle = '#17171c'; g.stroke(); }
  }
  /** One big eye: an upright oval, a large pupil with a glint, lashes at the outer corner. side: -1 left, +1 right. */
  function eye(g, cx, cy, rx, ry, side, mood) {
    if (mood === 'blink') { stroke(g, [[cx - rx, cy], [cx - rx * 0.4, cy + ry * 0.3], [cx + rx * 0.4, cy + ry * 0.3], [cx + rx, cy]]); return; }
    oval(g, cx, cy, rx, ry, '#ffffff');
    const k = mood === 'scared' ? 0.28 : 0.52;
    oval(g, cx - side * rx * 0.12, cy + ry * 0.14, rx * k, ry * (k + 0.06), '#17171c', 0);
    oval(g, cx - side * rx * 0.12 + rx * 0.16, cy - ry * 0.02, rx * 0.13, rx * 0.13, '#ffffff', 0);
    for (const a of [-0.9, -0.55, -0.2]) {            // lashes
      const ang = side > 0 ? a : Math.PI - a, x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry;
      stroke(g, [[x, y], [x + Math.cos(ang) * 15, y + Math.sin(ang) * 15]], 5);
    }
    if (mood === 'angry') stroke(g, [[cx + side * rx * 1.25, cy - ry * 1.5], [cx - side * rx * 0.9, cy - ry * 0.75]], 9);
    else if (mood === 'scared') stroke(g, [[cx + side * rx * 1.1, cy - ry * 1.1], [cx - side * rx * 0.6, cy - ry * 1.5]], 6);
    else stroke(g, [[cx - rx * 0.8, cy - ry * 1.28], [cx, cy - ry * 1.42], [cx + rx * 0.8, cy - ry * 1.28]], 5);
  }
  function mouth(g, cx, cy, mood, w = 30) {
    if (mood === 'angry') stroke(g, [[cx - w, cy + 6], [cx - w * 0.5, cy - 6], [cx, cy + 6], [cx + w * 0.5, cy - 6], [cx + w, cy + 6]], 6);
    else if (mood === 'scared') oval(g, cx, cy + 4, w * 0.45, w * 0.6, '#17171c', 0);
    else if (mood === 'grin') { stroke(g, [[cx - w, cy - 4], [cx - w * 0.5, cy + 12], [cx + w * 0.5, cy + 12], [cx + w, cy - 4]], 6); stroke(g, [[cx - w * 0.5, cy + 2], [cx - w * 0.5, cy + 12]], 4); stroke(g, [[cx, cy + 4], [cx, cy + 12]], 4); stroke(g, [[cx + w * 0.5, cy + 2], [cx + w * 0.5, cy + 12]], 4); }
    else if (mood === 'frown') stroke(g, [[cx - w, cy + 10], [cx - w * 0.4, cy - 2], [cx + w * 0.4, cy - 2], [cx + w, cy + 10]], 6);
    else {                                              // an open smile
      g.beginPath(); g.moveTo(cx - w, cy - 6); g.quadraticCurveTo(cx, cy + w * 1.3, cx + w, cy - 6); g.closePath();
      g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#17171c'; g.lineJoin = 'round'; g.stroke();
    }
  }
  const FACES = {
    jelly(g, mood) { eye(g, 76, 84, 36, 46, -1, mood); eye(g, 180, 84, 36, 46, 1, mood); mouth(g, 128, 160, mood, 26); },
    dasher(g, mood) {
      // goggles: a strap, two round lenses
      stroke(g, [[0, 78], [44, 76]], 12); stroke(g, [[212, 76], [256, 78]], 12); stroke(g, [[110, 76], [146, 76]], 9);
      for (const [cx, side] of [[78, -1], [178, 1]]) {
        oval(g, cx, 78, 38, 38, '#ffffff', 9);
        if (mood === 'blink') stroke(g, [[cx - 20, 80], [cx + 20, 80]], 6);
        else { oval(g, cx - side * 6, 84, mood === 'scared' ? 8 : 16, mood === 'scared' ? 10 : 18, '#17171c', 0); oval(g, cx - side * 6 + 6, 76, 5, 5, '#ffffff', 0); }
        stroke(g, [[cx - 24, 56], [cx - 12, 50]], 4);     // a shine on the lens
      }
      mouth(g, 128, 150, mood === 'scared' ? 'scared' : 'grin', 34);
    },
    spike(g, mood) {
      // half-closed eyes under heavy lids, a frown
      for (const [cx, side] of [[84, -1], [172, 1]]) {
        g.save(); g.beginPath(); g.rect(cx - 40, 84, 80, 60); g.clip();
        oval(g, cx, 84, 30, 30, '#ffffff');
        if (mood !== 'blink') oval(g, cx - side * 4, 96, mood === 'scared' ? 7 : 13, mood === 'scared' ? 7 : 13, '#17171c', 0);
        g.restore();
        stroke(g, [[cx - 36, 84], [cx + 36, 84]], 9);
        stroke(g, [[cx + side * 40, 50], [cx - side * 30, 68]], 8);     // a heavy brow
      }
      mouth(g, 128, 156, mood === 'scared' ? 'scared' : 'frown', 26);
    },
  };
  const faceCache = {};
  function faces(kind) {
    if (!faceCache[kind]) {
      faceCache[kind] = {};
      for (const mood of ['idle', 'blink', 'angry', 'scared']) faceCache[kind][mood] = canvasTex(256, 192, (g, w, h) => { g.clearRect(0, 0, w, h); FACES[kind](g, mood); });
    }
    return faceCache[kind];
  }
  /** The face card: a plane bent to sit on a round body. bend: how much it curves back at the sides. */
  function faceCard(kind, w, h, bend) {
    const geo = new THREE.PlaneGeometry(w, h, 8, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, -bend * (pos.getX(i) ** 2 + 0.6 * pos.getY(i) ** 2));
    const tex = faces(kind);
    const mat = new THREE.MeshBasicMaterial({ map: tex.idle, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    let shown = 'idle';
    return { mesh, setMood(mood) { if (mood !== shown) { shown = mood; mat.map = tex[mood]; } } };
  }
  const jellyGeo = softBox(0.92, 0.76, 0.92, 0.38).translate(0, 0.38, 0);
  const leafGeo = new THREE.SphereGeometry(0.1, 10, 8).scale(1, 0.3, 0.6);
  function makeJelly() {
    const body = new THREE.Group();
    body.add(inked(jellyGeo, paper, 0.024));
    const face = faceCard('jelly', 0.78, 0.585, 0.25);
    body.add(at(face.mesh, 0, 0.4, 0.505));
    // a sprout on top: a stem and two leaves
    const sprout = new THREE.Group();
    sprout.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.16, 6), ink), 0, 0.08, 0));
    for (const side of [-1, 1]) { const leaf = at(inked(leafGeo, paper, 0.012), side * 0.085, 0.18, 0); leaf.rotation.z = side * 0.5; sprout.add(leaf); }
    sprout.position.y = 0.78;
    body.add(sprout);
    const feet = [-1, 1].map((side) => at(ball(0.11, ink, 1, 0.6, 1.5), side * 0.22, 0.05, 0.14));
    return { body, face, sprout, feet, color: PAPER };
  }
  const dasherGeo = new THREE.SphereGeometry(0.46, 20, 14).scale(1, 0.84, 1).translate(0, 0.4, 0);
  function makeDasher() {
    const body = new THREE.Group();
    body.add(inked(dasherGeo, paper, 0.024));
    const face = faceCard('dasher', 0.8, 0.6, 0.9);
    body.add(at(face.mesh, 0, 0.42, 0.475));
    // a fin from the forehead to the back of the head, and a hatched racing stripe would be too much: just the fin
    const fin = new THREE.Group();
    [[0.76, 0.14, 0.13], [0.82, -0.02, 0.16], [0.78, -0.19, 0.14], [0.68, -0.33, 0.1]].forEach(([y, z, hgt]) => fin.add(at(ball(1, ink, 0.03, hgt, 0.1), 0, y, z)));
    body.add(fin);
    const feet = [-1, 1].map((side) => at(ball(0.1, ink, 1, 0.6, 1.6), side * 0.2, 0.05, 0.1));
    return { body, face, sprout: fin, feet, color: PAPER };
  }
  const burrHatch = hatchTexture(5, 2.6);
  burrHatch.repeat.set(4, 4);
  const burrMat = new THREE.MeshBasicMaterial({ map: burrHatch });
  const burrGeo = new THREE.SphereGeometry(0.3, 16, 12).translate(0, 0.31, 0);
  const spikeCone = new THREE.ConeGeometry(0.075, 0.22, 7).translate(0, 0.11, 0);
  function makeSpike() {
    const body = new THREE.Group();
    body.add(inked(burrGeo, burrMat, 0.02));
    // spikes all over the top and the sides, none on the face
    const ico = new THREE.IcosahedronGeometry(1, 1).attributes.position, seen = new Set(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
    for (let i = 0; i < ico.count; i++) {
      v.fromBufferAttribute(ico, i).normalize();
      const key = v.toArray().map((x) => x.toFixed(2)).join();
      if (seen.has(key) || v.y < -0.25 || (v.z > 0.45 && v.y < 0.5)) continue;
      seen.add(key);
      const cone = inked(spikeCone, paper, 0.014);
      cone.position.copy(v).multiplyScalar(0.27).add(at(new THREE.Object3D(), 0, 0.31, 0).position);
      cone.quaternion.setFromUnitVectors(up, v);
      body.add(cone);
    }
    const face = faceCard('spike', 0.5, 0.375, 1.3);
    body.add(at(face.mesh, 0, 0.27, 0.315));
    const feet = [-1, 1].map((side) => at(ball(0.07, ink, 1, 0.6, 1.4), side * 0.13, 0.04, 0.12));
    return { body, face, sprout: null, feet, color: PAPER };
  }
  const enemyViews = new Map();
  for (const en of level.enemies) {
    const group = new THREE.Group();
    const parts = en.type === 'jelly' ? makeJelly() : en.type === 'dasher' ? makeDasher() : makeSpike();
    for (const foot of parts.feet) group.add(foot);
    group.add(parts.body);
    group.position.set(0, en.h, -en.a);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.scale.setScalar(en.type === 'spike' ? 0.75 : 1);
    shadow.position.set(0, en.h + 0.018, -en.a);
    root.add(group, shadow);
    enemyViews.set(en.id, { en, group, shadow, ...parts, seed: (en.a * 7.3) % 5, state: 'alive', t: 0, vel: new THREE.Vector3() });
  }

  // ------------------------------------------------------------ hammers: blocks of stone on chains
  const stoneTex = canvasTex(32, 32, (g) => {
    g.fillStyle = '#8f96a3'; g.fillRect(0, 0, 32, 32);
    for (let row = 0; row < 2; row++) for (let col = -1; col < 2; col++) {
      const x = col * 16 + (row ? 8 : 0), y = row * 16;
      g.fillStyle = '#b6bcc8'; g.fillRect(x + 1, y + 1, 14, 2);
      g.fillStyle = '#5e6470'; g.fillRect(x, y + 14, 16, 2); g.fillRect(x + 15, y, 1, 16);
    }
  }, { repeat: true, pixel: true });
  const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex });
  const dangerMat = new THREE.MeshBasicMaterial({ map: canvasTex(64, 16, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e0302a'; g.fillRect(i * 8, 0, 8, h); } }, { repeat: true, pixel: true }) });
  const chainMat = new THREE.MeshLambertMaterial({ color: 0x4a4f5a });
  const hammerViews = [];
  for (const hm of level.hammers) {
    const len = hm.b - hm.a;
    const group = new THREE.Group();
    group.position.set(0, hm.h, -(hm.a + hm.b) / 2);
    const head = new THREE.Group();
    const block = new THREE.Mesh(tiledBox(W - 0.1, 1.7, len), stoneMat);
    block.position.y = 0.95;
    const band = new THREE.Mesh(tiledBox(W - 0.06, 0.22, len + 0.04), dangerMat);
    band.position.y = 0.11;
    head.add(block, band);
    for (const side of [-1, 1]) { const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 30, 6), chainMat); chain.position.set(side * (W / 2 - 0.5), 16.8, 0); head.add(chain); }
    const markMat = new THREE.MeshBasicMaterial({ map: hazardTex, color: 0xe0302a, transparent: true, opacity: 0.5, depthWrite: false });
    const mark = topPlane(-len / 2 - 0.3, len / 2 + 0.3, markMat, W, 1 / 0.9, 4);
    mark.position.set(0, 0.016, 0);
    group.add(head, mark);
    root.add(group);
    hammerViews.push({ hm, group, head, markMat, last: 'up' });
  }

  // ------------------------------------------------------------ blink bridges: blocks that come and go
  const blinkTex = blockTex(0xf4f8ff);
  const bridgeViews = [];
  for (const br of level.bridges) {
    const P = palAt(br.a), len = br.b - br.a;
    const mat = new THREE.MeshLambertMaterial({ map: blinkTex, color: P.accent, transparent: true, opacity: 0.95 });
    const slab = new THREE.Mesh(tiledBox(W - 0.1, br.thick, len, br.a), mat);
    slab.position.set(0, br.h - br.thick / 2, -(br.a + br.b) / 2);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W - 0.1, br.thick, len)), new THREE.LineBasicMaterial({ color: 0xffffff }));
    edges.position.copy(slab.position);
    root.add(slab, edges);
    bridgeViews.push({ br, mat, slab, base: new THREE.Color(P.accent) });
  }

  // ------------------------------------------------------------ springboards
  const drumViews = new Map();
  for (const sp of level.springs) {
    const len = sp.b - sp.a;
    const group = new THREE.Group();
    group.position.set(0, sp.h, -(sp.a + sp.b) / 2);
    const base = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.08, len), new THREE.MeshLambertMaterial({ color: 0x4a4f5a }));
    base.position.y = 0.04;
    const coil = new THREE.Group();
    for (const x of [-0.9, 0, 0.9]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 10), new THREE.MeshLambertMaterial({ color: 0xd8dde6 })); c.position.set(x, 0.5, 0); coil.add(c); }
    coil.scale.y = 0.22; coil.position.y = 0.08;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.12, len + 0.1), new THREE.MeshLambertMaterial({ color: 0xe0302a }));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.125, 0.22), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    pad.add(stripe);
    pad.position.y = 0.36;
    group.add(base, coil, pad);
    root.add(group);
    drumViews.set(sp.id, { group, coil, pad, t: 1 });
  }

  // ------------------------------------------------------------ signs, checkpoints, goal
  const postMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2a });
  const signViews = [];
  for (const sg of level.signs) {
    const plane = textPlane(4.2, 1.2, (g, w, h) => {
      // a wooden board
      g.fillStyle = '#7a4a1e'; roundRect(g, 2, 2, w - 4, h - 4, 14); g.fill();
      g.fillStyle = '#c98a48'; roundRect(g, 10, 10, w - 20, h - 20, 9); g.fill();
      g.fillStyle = 'rgba(122, 74, 30, 0.35)';
      for (let y = 34; y < h - 14; y += 30) g.fillRect(14, y, w - 28, 3);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = 58;
      g.font = `${size}px ${JA}`;
      while (g.measureText(sg.ja).width > w - 60 && size > 26) { size -= 3; g.font = `${size}px ${JA}`; }
      g.lineWidth = 8; g.strokeStyle = '#4a2a0c'; g.strokeText(sg.ja, w / 2, h * 0.4);
      g.fillStyle = '#fff'; g.fillText(sg.ja, w / 2, h * 0.4);
      g.fillStyle = '#4a2a0c'; g.font = `26px ${EN}`;
      g.fillText(sg.en, w / 2, h * 0.78);
    });
    // beside the road, turned toward the runner, alternating sides: never in the way of what is ahead
    const sideOf = signViews.length % 2 ? 1 : -1;
    const group = new THREE.Group();
    group.position.set(sideOf * (W / 2 + 3.3), sg.h + 2.3, -(sg.s + 8));
    group.rotation.y = -sideOf * 0.45;
    plane.position.z = 0.07;
    group.add(plane);
    for (const x of [-1.5, 1.5]) { const post = new THREE.Mesh(unitBox, postMat); post.scale.set(0.1, 14, 0.08); post.position.set(x, -7.2, 0); group.add(post); }
    root.add(group);
    signViews.push({ sg, group, plane });
  }
  const gateViews = [];
  const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 8).translate(0, 0.5, 0);
  function gate(s, y, label, colorHex, tall = 3.9, ink = '#ffffff') {
    const mat = new THREE.MeshLambertMaterial({ color: colorHex });
    const group = new THREE.Group();
    group.position.set(0, y, -s);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, new THREE.MeshLambertMaterial({ color: 0xffffff })); post.scale.y = tall + 0.4; post.position.x = side * (W / 2 + 0.25); group.add(post);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat); knob.position.set(side * (W / 2 + 0.25), tall + 0.45, 0); group.add(knob);
    }
    const banner = new THREE.Mesh(unitBox, mat); banner.scale.set(W + 0.5, 0.74, 0.06); banner.position.y = tall - 0.3; group.add(banner);
    if (label) {
      const plate = textPlane(W + 0.3, 0.6, (g, w, h) => {
        g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
        let size = 52;
        g.font = `${size}px ${EN}`;
        while (g.measureText(label).width > w - 20 && size > 20) { size -= 2; g.font = `${size}px ${EN}`; }
        g.fillText(label, w / 2, h * 0.52);
      });
      plate.position.set(0, tall - 0.3, 0.04); group.add(plate);
    }
    root.add(group);
    return { group, mat, base: new THREE.Color(colorHex) };
  }
  // A gate at every checkpoint. In normal mode only the one in the middle of the course counts:
  // the zone gates stay as gates, the others are not there.
  for (const cp of level.checkpoints) {
    const z = zones.find((zn) => Math.abs(zn.s - cp.s) < 3);
    const label = cp.mid ? '★ CHECKPOINT ★' : z ? `ZONE ${zones.indexOf(z) + 1}  ${z.name}` : 'CHECKPOINT';
    gateViews.push({ ...gate(cp.s, cp.y, label, cp.mid ? 0xff9a1a : z ? 0xe0452a : 0x2f7dff, cp.mid ? 4.3 : z ? 3.9 : 3.5), cp, zone: !!z });
  }
  const goalY = level.finale ? level.finale.landH : 0;
  {
    const goal = gate(level.goal, goalY, 'GOAL', 0x18181c, 4.6, '#ffd21f');
    // a chequered band over the banner
    const band = textPlane(W + 0.5, 0.36, (g, w, h) => { const n = 22, c = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#18181c'; g.fillRect(i * c, j * h / 2, c + 1, h / 2); } });
    band.position.set(0, 4.6 + 0.26, 0.04);
    goal.group.add(band);
  }

  // ------------------------------------------------------------ helper bridges (built when someone keeps falling)
  const assistViews = [];
  function addAssist(a, b, h) {
    const len = b - a;
    const geo = new THREE.BoxGeometry(W - 0.2, 0.2, len, 1, 1, 12);
    const col = [], pos = geo.attributes.position, c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { c.setHSL((pos.getZ(i) / len + 0.5) * 0.85, 1, 0.6); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    m.position.set(0, h - 0.1, -(a + b) / 2);
    m.scale.x = 0.01;
    root.add(m);
    assistViews.push({ m, t: 0 });
    burst(0, h + 0.4, -(a + b) / 2, 60, { speed: 4, rainbow: true, up: 3 });
  }

  // ------------------------------------------------------------ where a jump comes down
  // (the runner's own legs and arms are drawn by body.js, on top of the world)
  const markTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 16;
    g.beginPath(); g.arc(w / 2, h / 2, 48, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 10;
    g.beginPath(); g.arc(w / 2, h / 2, 48, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h / 2, 8, 0, Math.PI * 2); g.fill();
  });
  const markMat = new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false, opacity: 0.8 });
  const landMark = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), markMat);
  landMark.visible = false;
  root.add(landMark);
  const C_WHITE = new THREE.Color(0xffffff), C_GREEN = new THREE.Color(0x3fff5a), C_RED = new THREE.Color(0xff3b30), C_GOLD = new THREE.Color(0xffd21f);

  // ------------------------------------------------------------ particles: little squares
  const MAXP = 900;
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pVel = new Float32Array(MAXP * 3), pAlpha = new Float32Array(MAXP);
  const pLife = new Float32Array(MAXP), pMax = new Float32Array(MAXP), pGrav = new Float32Array(MAXP);
  let pNext = 0;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
  const points = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { size: { value: 0.16 }, scale: { value: 600 } },
    vertexShader: `attribute float alpha; attribute vec3 color; uniform float size; uniform float scale; varying vec3 vC; varying float vA;
      void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.2, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ if (vA <= 0.01) discard; gl_FragColor = vec4(vC, vA); }',
  }));
  points.frustumCulled = false;
  root.add(points);
  const tmpC = new THREE.Color();
  function burst(x, y, z, count, { speed = 3, color = 0xffffff, rainbow = false, up = 1.5, life = 0.8, gravity = 6, spread = 0.2 } = {}) {
    for (let k = 0; k < count; k++) {
      const i = pNext; pNext = (pNext + 1) % MAXP;
      const a = Math.random() * Math.PI * 2, e = Math.acos(2 * Math.random() - 1), v = speed * (0.35 + 0.65 * Math.random());
      pPos[i * 3] = x + (Math.random() - 0.5) * spread; pPos[i * 3 + 1] = y + (Math.random() - 0.5) * spread; pPos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
      pVel[i * 3] = v * Math.sin(e) * Math.cos(a); pVel[i * 3 + 1] = v * Math.cos(e) + up; pVel[i * 3 + 2] = v * Math.sin(e) * Math.sin(a);
      if (rainbow) tmpC.setHSL(Math.random(), 1, 0.6); else tmpC.set(color);
      pCol[i * 3] = tmpC.r; pCol[i * 3 + 1] = tmpC.g; pCol[i * 3 + 2] = tmpC.b;
      pLife[i] = pMax[i] = life * (0.6 + 0.8 * Math.random()); pGrav[i] = gravity;
    }
  }
  function updateParticles(dt) {
    for (let i = 0; i < MAXP; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt;
      pVel[i * 3 + 1] -= pGrav[i] * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pAlpha[i] = Math.min(1, Math.max(0, pLife[i] / pMax[i]) * 2.5);
      if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; pAlpha[i] = 0; }
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.alpha.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }
  pPos.fill(-999);

  // ------------------------------------------------------------ colours that follow the runner through the zones
  const cTop = new THREE.Color(), cHor = new THREE.Color(), cFog = new THREE.Color(), cWater = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
  function blendPalette(s, key, out) {
    const i = zoneAt(s), next = zones[i + 1];
    out.set(PALETTES[zones[i].palette][key]);
    if (next) { const t = smooth((s - (next.s - 14)) / 14); if (t > 0) out.lerp(cB.set(PALETTES[next.palette][key]), t); }
    return out;
  }
  let fireworks = 0, fwTimer = 0, feverGlow = 0, lastRun = 0;

  // ------------------------------------------------------------ per frame
  /**
   * view: { sim, advice, dt, time, beat (0..1 pulse on each beat), camera, hideMark, early, onHammer }
   */
  function update(view) {
    const { sim, advice, dt, time, beat, camera } = view;
    const p = sim.p, s = p.s;

    // sky and light
    blendPalette(s, 'top', cTop); blendPalette(s, 'horizon', cHor); blendPalette(s, 'fog', cFog); blendPalette(s, 'water', cWater);
    feverGlow += ((p.fever > 0 ? 1 : 0) - feverGlow) * Math.min(1, dt * 5);
    if (feverGlow > 0.01) { cA.setHSL((time * 0.35) % 1, 0.9, 0.62); cHor.lerp(cA, 0.5 * feverGlow); cFog.lerp(cA, 0.3 * feverGlow); cTop.lerp(cA, 0.25 * feverGlow); }
    sky.material.uniforms.top.value.copy(cTop);
    sky.material.uniforms.horizon.value.copy(cHor);
    scene.fog.color.copy(cFog);
    sky.position.copy(camera.position);
    sun.position.set(camera.position.x + 170, camera.position.y + 210, camera.position.z - 620);
    sun.lookAt(camera.position);
    water.position.set(0, WATER_Y, Math.round(camera.position.z / 2) * 2 - 300);
    water.material.uniforms.time.value = time;
    water.material.uniforms.deep.value.copy(cWater);
    water.material.uniforms.far.value.copy(cFog);
    beltTex.offset.y = (time * 2) / 1.1;       // the pattern slides toward the runner at the belt's 2 m/s
    updateNotes(s, time, sim.gone);

    // the paint on the road: blue chevrons run ahead on a runway (green once fast enough);
    // yellow ones point back at the runner on a slow stretch (red when too fast)
    for (const v of paceViews) {
      if (v.b < s - 4 || v.a > s + 140) continue;
      if (v.kind === 'dash') {
        const ok = p.vs >= v.limit;
        v.tex.offset.y = -time * (ok ? 4 : 2);
        v.mat.color.copy(ok ? C_DASH_OK : C_DASH);
        v.mat.opacity = ok ? 0.95 : 0.6 + 0.3 * Math.sin(time * 6);
      } else {
        const bad = p.vs > v.limit + 0.05 && s > v.a - 14 && s < v.b;
        v.tex.offset.y = time * 0.7;
        v.mat.color.copy(bad ? C_SLOW_BAD : C_SLOW);
        v.mat.opacity = bad ? 0.55 + 0.45 * (Math.sin(time * 20) > 0 ? 1 : 0) : 0.8;
      }
    }

    // coin blocks
    for (const v of bellViews.values()) {
      const gone = sim.gone.has(v.b.id);
      if (gone !== v.gone) { v.gone = gone; v.cube.visible = !gone; }
      if (gone) continue;
      v.cube.position.y = v.y + 0.04 * Math.sin(time * 2 + v.b.s);
      const k = 1 + 0.05 * beat;
      v.cube.scale.setScalar(k);
      if (v.b.fever) { v.cube.rotation.y = time * 1.2; v.mat.emissive.setHSL((time * 0.6) % 1, 1, 0.5); }
    }
    // creatures
    for (const v of enemyViews.values()) {
      const en = v.en;
      if (v.state === 'gone' && !sim.gone.has(en.id)) { v.state = 'alive'; v.group.rotation.set(0, 0, 0); v.body.scale.set(1, 1, 1); v.body.position.y = 0; }   // back after a miss (normal mode)
      if (v.state === 'alive') {
        if (sim.gone.has(en.id)) { v.state = 'gone'; v.group.visible = false; v.shadow.visible = false; continue; }
        const es = enemyS(en, sim.t);
        if (es < s - 8 || es > s + 120) { v.group.visible = false; v.shadow.visible = false; continue; }
        v.group.visible = true; v.shadow.visible = true;
        v.group.position.set(0, en.h, -es);
        v.shadow.position.z = -es;
        const d = es - s, near = d < 9 && d > -1, scared = p.fever > 0 && near;
        const way = Math.sign(enemyS(en, sim.t + 0.05) - es);          // +1: walking away from the runner
        // the face: a blink now and then, a scowl when the runner is close, fright when the runner is in fever
        v.face.setMood(scared ? 'scared' : (time + v.seed) % 3.1 < 0.12 ? 'blink' : near ? 'angry' : 'idle');
        if (en.type === 'jelly') {
          const hop = Math.abs(Math.sin(sim.t * Math.PI / RULES.BEAT / 2 + en.a));
          v.body.position.y = 0.16 * hop;
          v.body.scale.set(1 + 0.1 * (1 - hop), 0.88 + 0.2 * hop, 1 + 0.1 * (1 - hop));
          v.body.rotation.x = -0.08 * way * hop;
          v.sprout.rotation.z = 0.35 * Math.sin(time * 5 + v.seed) * (0.4 + hop);
          for (let i = 0; i < 2; i++) { const f = v.feet[i]; f.position.z = 0.14 + 0.07 * Math.sin(time * 9 + i * Math.PI); f.position.y = 0.05 + 0.05 * hop; }
        } else if (en.type === 'dasher') {
          const run = time * 22;
          v.body.position.y = 0.05 + 0.04 * Math.abs(Math.sin(run));
          v.body.rotation.x = -0.28 * way;                              // leans into its run
          v.body.rotation.z = scared ? 0.2 * Math.sin(time * 40) : 0.05 * Math.sin(run);
          for (let i = 0; i < 2; i++) { const f = v.feet[i]; f.position.z = 0.1 + 0.2 * Math.sin(run + i * Math.PI); f.position.y = 0.05 + 0.07 * Math.max(0, Math.cos(run + i * Math.PI)); }
        } else {
          const breath = 1 + 0.035 * Math.sin(time * 2.2 + v.seed);
          v.body.scale.set(breath, 2 - breath, breath);
          v.body.rotation.y = 0.12 * Math.sin(time * 0.7 + v.seed);
        }
      } else if (v.state === 'squash') {
        v.t += dt;
        const k = Math.min(1, v.t / 0.1);
        v.body.scale.set(1 + 0.6 * k, Math.max(0.08, 1 - 0.92 * k), 1 + 0.6 * k);
        v.body.position.y = 0; v.body.rotation.set(0, 0, 0);
        if (v.t > 0.32) { v.state = 'gone'; v.group.visible = false; v.shadow.visible = false; }
      } else if (v.state === 'fly') {
        v.t += dt;
        v.vel.y -= 12 * dt;
        v.group.position.addScaledVector(v.vel, dt);
        v.group.rotation.x += dt * 9; v.group.rotation.z += dt * 6;
        v.shadow.visible = false;
        if (v.t > 1.6) { v.state = 'gone'; v.group.visible = false; }
      }
    }
    // hammers
    for (const v of hammerViews) {
      const st = hammerState(v.hm, sim.t);
      const shake = st.state === 'warn' ? 0.05 * Math.sin(time * 70) : 0;
      v.head.position.set(shake, st.sole, 0);
      v.markMat.opacity = st.state === 'warn' ? 0.55 + 0.45 * Math.sin(time * 30) : st.state === 'up' ? 0.35 : 0.8;
      if (st.state !== v.last) {
        if (st.state === 'down' && Math.abs(v.hm.a - s) < 60) {
          const z = -(v.hm.a + v.hm.b) / 2;
          for (const x of [-1.2, 0, 1.2]) burst(x, v.hm.h + 0.1, z + 0.9, 8, { speed: 2.5, color: 0xd8c8a8, up: 1.2, life: 0.5 });
          if (view.onHammer) view.onHammer(Math.abs((v.hm.a + v.hm.b) / 2 - s));
        }
        v.last = st.state;
      }
    }
    // blink bridges
    for (const v of bridgeViews) {
      const st = bridgeState(v.br, sim.t);
      const steady = sim.steady.has(v.br.id);
      const on = steady || st.on;
      const blink = !steady && st.warn ? (Math.sin(time * 26) > 0 ? 1 : 0.4) : 1;
      v.mat.opacity = on ? 0.97 * blink : 0.1;
      v.slab.scale.y = on ? 1 : 0.5;
      if (steady) v.mat.color.setHSL((time * 0.4) % 1, 1, 0.6); else v.mat.color.copy(v.base);
    }
    // springboards
    for (const v of drumViews.values()) {
      let k = 0;
      if (v.t < 1) { v.t = Math.min(1, v.t + dt * 2.6); k = Math.sin(v.t * Math.PI) * (1 - v.t) * 2.2; }
      v.coil.scale.y = 0.22 + 0.9 * k;
      v.pad.position.y = 0.36 + 0.9 * k + 0.02 * beat;
    }
    for (const v of assistViews) { if (v.t < 1) { v.t = Math.min(1, v.t + dt * 2.5); v.m.scale.x = smooth(v.t); } }
    for (const v of signViews) {
      const d = v.sg.s + 8 - s;
      v.group.visible = d > 7 && d < 70;        // gone before it fills the corner of the eye
      if (v.group.visible) v.plane.material.opacity = Math.min(1, (d - 7) / 4);
    }
    const reached = p.cp >= 0 && sim.cps[p.cp] ? sim.cps[p.cp].s : -1;
    for (const v of gateViews) {
      const counts = sim.mode !== 'normal' || v.cp.mid;
      v.group.visible = counts || v.zone;
      v.mat.color.copy(counts && v.cp.s <= reached + 0.01 ? C_DASH_OK : v.base);
    }

    if (p.fever > 0 && p.vs > 2 && time - lastRun > 0.03) { lastRun = time; burst(0, p.y + 0.15, -s - 1.6, 2, { speed: 0.8, rainbow: true, up: 0.6, life: 0.6, gravity: 0, spread: 1.2 }); }

    // where a jump taken now (or the flight in progress) comes down
    const land = advice && advice.land;
    if (land && !view.hideMark && (!p.ground || p.vs > 1.2)) {
      landMark.visible = true;
      landMark.position.set(0, land.y + 0.03, -land.s);
      const urgent = advice.jump === 'need' || (advice.soon && view.early), bonus = advice.jump === 'bonus';
      markMat.color.copy(!land.ok ? C_RED : urgent ? C_GREEN : bonus ? C_GOLD : C_WHITE);
      markMat.opacity = !p.ground ? 0.95 : urgent || bonus ? 1 : 0.4;
      const k = (urgent || bonus ? 1.25 + 0.2 * Math.sin(time * 16) : 1) * (p.ground ? 1 : 0.8 + 0.5 * Math.min(1, (p.y - land.y) / 2));
      landMark.scale.set(k, 1, k);
      landMark.rotation.y = time * 1.5;
    } else landMark.visible = false;

    // confetti at the goal
    if (fireworks > 0) {
      fireworks -= dt; fwTimer -= dt;
      if (fwTimer <= 0) {
        fwTimer = 0.14 + Math.random() * 0.2;
        burst((Math.random() - 0.5) * 22, goalY + 5 + Math.random() * 9, -(level.goal + 6 + Math.random() * 22), 70, { speed: 7, rainbow: true, up: 1, life: 1.4, gravity: 3 });
      }
    }
    updateParticles(dt);
  }

  // ------------------------------------------------------------ events from the rules
  function onEvent(e, sim) {
    const p = sim.p;
    switch (e.type) {
      case 'note': { const n = level.notes[noteIndex.get(e.id)]; if (n) burst(0, n.y, -n.s, 6, { speed: 2.2, color: 0xffd21f, up: 1.6, life: 0.4 }); break; }
      case 'bell': {
        const v = bellViews.get(e.id);
        if (v) {
          // the block breaks; its coins fly up
          burst(0, v.y, -v.b.s, e.fever ? 60 : 16, { speed: e.fever ? 6 : 3.5, color: 0xf7a81c, rainbow: e.fever, up: 2, life: e.fever ? 1.1 : 0.6, spread: 0.6 });
          burst(0, v.y + 0.5, -v.b.s, e.fever ? 30 : 10, { speed: 2, color: 0xffe14a, up: 5, life: 0.7, gravity: 12 });
        }
        break;
      }
      case 'stomp': {
        const v = enemyViews.get(e.id);
        if (v) { v.state = 'squash'; v.t = 0; v.group.visible = true; burst(0, v.en.h + 0.3, v.group.position.z, 22, { speed: 3.5, color: v.color, up: 2, life: 0.6 }); burst(0, v.en.h + 0.6, v.group.position.z, 6, { speed: 2, color: 0xffe14a, up: 3, life: 0.5 }); }
        break;
      }
      case 'blast': {
        const v = enemyViews.get(e.id);
        if (v) { v.state = 'fly'; v.t = 0; v.group.visible = true; v.vel.set((Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4), 7 + Math.random() * 3, -(p.vs + 6)); burst(0, v.en.h + 0.5, v.group.position.z, 26, { speed: 5, rainbow: true, up: 2, life: 0.7 }); }
        break;
      }
      case 'spring': { const v = drumViews.get(e.id); if (v) v.t = 0; burst(0, p.y + 0.3, -p.s, 34, { speed: 4, color: 0xffffff, up: 4, life: 0.7 }); break; }
      case 'land': if (e.impact > 4) burst(0, p.y + 0.05, -p.s - 0.3, Math.min(16, Math.round(e.impact * 1.4)), { speed: 1.6, color: 0xf0e6c8, up: 0.5, life: 0.35, gravity: 2, spread: 0.8 }); break;
      case 'checkpoint': burst(0, p.y + 2, -p.s, 50, { speed: 5, color: 0x35e06a, up: 2, life: 0.9 }); break;
      case 'assist': if (e.a != null) addAssist(e.a, e.b, e.h); break;
      case 'finale': burst(0, p.y + 0.2, -p.s, 60, { speed: 5, color: 0xf0d9a0, up: 3, life: 1 }); break;
      case 'goal': fireworks = 14; fwTimer = 0; break;
      default: break;
    }
  }

  function reset() {
    resetNotes();
    for (const v of enemyViews.values()) {
      v.state = 'alive'; v.t = 0; v.group.visible = true; v.group.rotation.set(0, 0, 0);
      v.group.position.set(0, v.en.h, -v.en.a);
      v.body.scale.set(1, 1, 1); v.body.position.y = 0; v.body.rotation.set(0, 0, 0);
    }
    for (const v of bellViews.values()) { v.gone = false; v.cube.visible = true; }
    for (const v of assistViews) { root.remove(v.m); v.m.geometry.dispose(); }
    assistViews.length = 0;
    for (const v of drumViews.values()) v.t = 1;
    fireworks = 0;
    pLife.fill(0); pPos.fill(-999); pAlpha.fill(0);
  }
  resetNotes();

  return { update, onEvent, reset, burst, zoneAt, palette: palAt };
}
