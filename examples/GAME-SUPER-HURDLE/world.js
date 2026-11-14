// world.js — the night stadium for the 110mH final.
//
// Everything here is presentation only: geometry, materials, lights and the
// small animated set pieces (crowd, LED boards, big screen, hurdles tipping).
// Game rules live in main.js and never read anything back from this module
// except the hurdle z positions it was given.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LANE_W = 1.22;
export const LANES = 9;
export const PLAYER_LANE = 5; // x = 0 is the centre of lane 5; lane 1 is the infield side (-x)
export const TRACK_HALF = (LANES * LANE_W) / 2;
export const laneX = (lane) => (lane - PLAYER_LANE) * LANE_W;
export const HURDLE_VISUAL_H = 1.067;

// 400 m oval: the player runs the home straight toward -z, the infield is on the left.
const R_IN = 36.5;
const R_OUT = R_IN + LANES * LANE_W;
const CX = -(R_IN + TRACK_HALF);
const Z_FIN = -110;
const Z_NEAR = Z_FIN + 84.39;
// Front row of the stands: a rounded rectangle around the oval.
const SP = { cx: CX, cz: -68, hx: 56, hz: 102, rc: 46 };

const FOG_COLOR = new THREE.Color(0x0b1226);
const FOG_DENSITY = 0.0026;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function createWorld({ scene, renderer, logoImage }) {
  const rng = mulberry32(20261111);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const FONT = '"Bebas Neue", "Arial Narrow", Impact, sans-serif';

  function tex(canvas, { srgb = true, repeat = false, aniso = maxAniso } = {}) {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  }

  scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0x93a9ff, 0x40282a, 0.62);
  scene.add(hemi);
  // Key floodlight bank behind/right of the runner: low enough that the
  // runner's own shadow reaches into the first-person view.
  const KEY_DIR = new THREE.Vector3(0.3, 0.44, 0.86).normalize();
  const key = new THREE.DirectionalLight(0xfff1dc, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -17; key.shadow.camera.right = 17;
  key.shadow.camera.top = 13; key.shadow.camera.bottom = -13;
  key.shadow.camera.near = 1; key.shadow.camera.far = 170;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.025;
  scene.add(key, key.target);
  // Far-end bank facing the runner: gives the glossy streak down the lane.
  const front = new THREE.DirectionalLight(0xcfe1ff, 1.05);
  front.position.set(-12, 30, -260);
  front.target.position.set(0, 0, -60);
  scene.add(front, front.target);
  // Opposite stand: fills the left side of bodies and hurdles.
  const side = new THREE.DirectionalLight(0xdfe8ff, 0.85);
  side.position.set(-120, 60, -40);
  side.target.position.set(0, 0, -60);
  scene.add(side, side.target);

  function focusShadow(z) {
    key.target.position.set(0, 0, z - 13);
    key.position.copy(key.target.position).addScaledVector(KEY_DIR, 80);
    key.target.updateMatrixWorld();
  }
  focusShadow(0);

  // ---------------------------------------------------------------- sky
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform float uTime;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 zen = vec3(0.006, 0.012, 0.045);
        vec3 mid = vec3(0.022, 0.035, 0.115);
        vec3 hor = vec3(0.075, 0.068, 0.175);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, zen, smoothstep(0.18, 0.85, h));
        // afterglow of the sunset behind the far stand
        vec2 hd = normalize(d.xz + 1e-5);
        float west = max(0.0, -hd.y);
        col += vec3(1.0, 0.36, 0.12) * pow(west, 5.0) * exp(-h * 11.0) * 0.75;
        col += vec3(0.55, 0.16, 0.42) * pow(west, 2.0) * exp(-h * 4.5) * 0.32;
        // floodlight haze hanging over the bowl
        col += vec3(0.07, 0.09, 0.16) * exp(-h * 5.0);
        // thin clouds catching the glow
        float cl = fbm(vec3(d.xz / (h + 0.18) * 1.6, 3.0) + vec3(uTime * 0.004, 0.0, 0.0));
        cl = smoothstep(0.48, 0.85, cl) * smoothstep(0.02, 0.25, h) * (1.0 - smoothstep(0.5, 0.95, h));
        col += cl * mix(vec3(0.04, 0.05, 0.11), vec3(0.3, 0.14, 0.2), pow(west, 2.0)) * 0.42;
        // stars
        vec3 p = d * 190.0; vec3 ip = floor(p); vec3 fp = fract(p) - 0.5;
        float r = hash(ip);
        float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 4.0) + r * 60.0);
        float star = step(0.9965, r) * (1.0 - smoothstep(0.0, 0.42, length(fp))) * tw;
        col += vec3(0.8, 0.88, 1.0) * star * smoothstep(0.06, 0.35, h) * (1.0 - cl) * 1.6;
        // moon
        vec3 md = normalize(vec3(0.42, 0.5, -0.76));
        float mdot = dot(d, md);
        col += vec3(1.0, 0.97, 0.9) * smoothstep(0.99955, 0.9997, mdot) * 2.2;
        col += vec3(0.5, 0.58, 0.8) * pow(max(mdot, 0.0), 420.0) * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // ---------------------------------------------------------------- ground textures
  function trackCanvas() {
    // One lane wide (1.22 m) by two lane-widths long, with half a lane line on each edge.
    const W = 512, H = 1024;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        let n = (rng() - 0.5) * 34;
        const r = rng();
        if (r < 0.035) n += 46 * rng();
        else if (r < 0.08) n -= 52 * rng();
        const u = x / W;
        const wear = Math.exp(-Math.pow((u - 0.5) / 0.26, 2)) * 9;
        d[i] = clamp255(176 + n + wear);
        d[i + 1] = clamp255(50 + n * 0.5 + wear * 0.45);
        d[i + 2] = clamp255(41 + n * 0.42 + wear * 0.35);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const lw = (0.05 / LANE_W) * W;
    ctx.fillStyle = '#efece4';
    ctx.fillRect(0, 0, lw / 2, H);
    ctx.fillRect(W - lw / 2, 0, lw / 2, H);
    return c;
  }
  function grainCanvas(base, amp, size = 256) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      let n = (rng() - 0.5) * amp;
      if (rng() < 0.05) n -= amp * rng();
      d[i * 4] = clamp255(base[0] + n);
      d[i * 4 + 1] = clamp255(base[1] + n * 0.8);
      d[i * 4 + 2] = clamp255(base[2] + n * 0.8);
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function grainNormalCanvas(size = 256, strength = 2.4) {
    const h = new Float32Array(size * size);
    for (let i = 0; i < h.length; i++) h[i] = rng();
    const b = new Float32Array(size * size);
    const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      b[y * size + x] = (at(x, y) * 2 + at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)) / 6;
    }
    const bt = (x, y) => b[((y + size) % size) * size + ((x + size) % size)];
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (bt(x - 1, y) - bt(x + 1, y)) * strength;
      const dy = (bt(x, y - 1) - bt(x, y + 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (dx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function grassCanvas() {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const band = y < S / 2 ? 1 : 0;
      const n = (rng() - 0.5) * 26;
      const i = (y * S + x) * 4;
      img.data[i] = clamp255(26 + band * 9 + n * 0.5);
      img.data[i + 1] = clamp255(96 + band * 22 + n);
      img.data[i + 2] = clamp255(40 + band * 7 + n * 0.4);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  const trackMap = tex(trackCanvas(), { repeat: true });
  const grainNormal = tex(grainNormalCanvas(), { srgb: false, repeat: true });
  grainNormal.repeat.set(3, 6);
  const trackMat = new THREE.MeshStandardMaterial({
    map: trackMap, normalMap: grainNormal, normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.6, metalness: 0.0,
  });

  // Straight: start chute + home straight + run-out, as one plane.
  function scaleUv(geo, su, sv) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    return geo;
  }
  function flat(geo) { geo.rotateX(-Math.PI / 2); return geo; }
  {
    const zA = 9.5, zB = -133;
    const len = zA - zB;
    const g = scaleUv(flat(new THREE.PlaneGeometry(LANES * LANE_W, len, 1, 24)), LANES, len / (LANE_W * 2));
    const m = new THREE.Mesh(g, trackMat);
    m.position.set(0, 0, (zA + zB) / 2);
    m.receiveShadow = true;
    scene.add(m);
    // back straight
    const g2 = scaleUv(flat(new THREE.PlaneGeometry(LANES * LANE_W, Z_NEAR - Z_FIN, 1, 8)), LANES, (Z_NEAR - Z_FIN) / (LANE_W * 2));
    const m2 = new THREE.Mesh(g2, trackMat);
    m2.position.set(2 * CX, 0, (Z_NEAR + Z_FIN) / 2);
    scene.add(m2);
  }
  // Bends: half annuli with (lane, arc-length) UVs so the same lane texture wraps around.
  function bendGeometry(cz, dir) {
    const segs = 72;
    const pos = [], uv = [], nor = [], idx = [];
    const rMid = (R_IN + R_OUT) / 2;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI;
      const ca = Math.cos(a), sa = Math.sin(a);
      pos.push(CX + R_IN * ca, 0, cz + dir * R_IN * sa, CX + R_OUT * ca, 0, cz + dir * R_OUT * sa);
      nor.push(0, 1, 0, 0, 1, 0);
      const v = (a * rMid) / (LANE_W * 2);
      uv.push(0, v, LANES, v);
      if (i < segs) {
        const k = i * 2;
        if (dir < 0) idx.push(k, k + 1, k + 3, k, k + 3, k + 2);
        else idx.push(k, k + 3, k + 1, k, k + 2, k + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  for (const [cz, dir] of [[Z_FIN, -1], [Z_NEAR, 1]]) {
    // a hair below the straight, so the chute / run-out overlapping the bends cannot z-fight
    const bend = new THREE.Mesh(bendGeometry(cz, dir), trackMat);
    bend.position.y = -0.014;
    bend.receiveShadow = true;
    scene.add(bend);
  }

  // Shapes are authored in (x, -z) and laid flat.
  function ovalShape(r) {
    const s = new THREE.Shape();
    const y1 = -Z_NEAR, y2 = -Z_FIN;
    s.moveTo(CX + r, y1);
    s.lineTo(CX + r, y2);
    s.absarc(CX, y2, r, 0, Math.PI, false);
    s.lineTo(CX - r, y1);
    s.absarc(CX, y1, r, Math.PI, Math.PI * 2, false);
    return s;
  }
  function standShape(inset = 0) {
    const { cx, cz, hx, hz, rc } = SP;
    const x0 = cx - hx - inset, x1 = cx + hx + inset;
    const y0 = -(cz + hz) - inset, y1 = -(cz - hz) + inset;
    const r = rc + inset;
    const s = new THREE.Shape();
    s.moveTo(x1, y0 + r);
    s.lineTo(x1, y1 - r);
    s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
    s.lineTo(x0 + r, y1);
    s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x0, y0 + r);
    s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    s.lineTo(x1 - r, y0);
    s.absarc(x1 - r, y0 + r, r, Math.PI * 1.5, Math.PI * 2, false);
    return s;
  }
  {
    // Apron between the track and the stands (slate blue synthetic surface).
    const apronTex = tex(grainCanvas([34, 58, 84], 22), { repeat: true });
    apronTex.repeat.set(0.6, 0.6);
    const apron = new THREE.Mesh(
      flat(new THREE.ShapeGeometry(standShape(0.5), 24)),
      new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.82, normalMap: grainNormal, normalScale: new THREE.Vector2(0.3, 0.3) }),
    );
    apron.position.y = -0.06;
    apron.receiveShadow = true;
    scene.add(apron);
    // Infield "D" areas in a darker tartan, then the pitch on top.
    const dTex = tex(grainCanvas([150, 44, 38], 26), { repeat: true });
    dTex.repeat.set(0.7, 0.7);
    const infield = new THREE.Mesh(
      flat(new THREE.ShapeGeometry(ovalShape(R_IN), 48)),
      new THREE.MeshStandardMaterial({ map: dTex, roughness: 0.78 }),
    );
    infield.position.y = -0.035;
    infield.receiveShadow = true;
    scene.add(infield);
    const grassTex = tex(grassCanvas(), { repeat: true });
    const PW = 68, PL = 105, pcz = (Z_FIN + Z_NEAR) / 2;
    const pitch = new THREE.Mesh(
      scaleUv(flat(new THREE.PlaneGeometry(PW, PL)), PW / 11, PL / 11),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
    );
    pitch.position.set(CX, -0.02, pcz);
    pitch.receiveShadow = true;
    scene.add(pitch);
    // Pitch markings.
    const parts = [];
    const rect = (x, z, w, l) => { const g = flat(new THREE.PlaneGeometry(w, l)); g.translate(x, 0, z); parts.push(g); };
    const lw = 0.14;
    rect(CX - PW / 2, pcz, lw, PL); rect(CX + PW / 2, pcz, lw, PL);
    rect(CX, pcz - PL / 2, PW, lw); rect(CX, pcz + PL / 2, PW, lw); rect(CX, pcz, PW, lw);
    for (const s of [-1, 1]) {
      const gz = pcz + s * PL / 2;
      rect(CX, gz - s * 16.5, 40.3, lw); rect(CX - 20.15, gz - s * 8.25, lw, 16.5); rect(CX + 20.15, gz - s * 8.25, lw, 16.5);
      rect(CX, gz - s * 5.5, 18.3, lw); rect(CX - 9.15, gz - s * 2.75, lw, 5.5); rect(CX + 9.15, gz - s * 2.75, lw, 5.5);
    }
    const ring = flat(new THREE.RingGeometry(9.08, 9.22, 72)); ring.translate(CX, 0, pcz); parts.push(ring);
    const lines = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: 0xdfe6dc, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    lines.position.y = -0.012;
    scene.add(lines);
  }

  // ---------------------------------------------------------------- painted markings on the track
  const paintMat = new THREE.MeshStandardMaterial({
    color: 0xe9e6dd, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  {
    const parts = [];
    const rect = (x, z, w, l) => { const g = flat(new THREE.PlaneGeometry(w, l)); g.translate(x, 0, z); parts.push(g); };
    rect(0, 0.025, LANES * LANE_W, 0.05);          // start line (trailing edge at z = 0)
    rect(0, Z_FIN - 0.025, LANES * LANE_W, 0.05);  // finish line
    for (let i = 0; i < 10; i++) {                  // hurdle position ticks on each lane line
      const z = -(13.72 + i * 9.14);
      for (let l = 0; l <= LANES; l++) rect(-TRACK_HALF + l * LANE_W, z, 0.12, 0.05);
    }
    const m = new THREE.Mesh(mergeGeometries(parts), paintMat);
    m.position.y = 0.006;
    m.receiveShadow = true;
    scene.add(m);
  }
  // Lane numbers and distance stencils share one alpha-textured decal mesh each.
  function decalAtlas(labels, cellW, cellH, draw) {
    const c = makeCanvas(cellW * labels.length, cellH);
    const ctx = c.getContext('2d');
    labels.forEach((label, i) => { ctx.save(); ctx.translate(i * cellW, 0); draw(ctx, label, cellW, cellH); ctx.restore(); });
    return c;
  }
  function decalMesh(texture, cells, items, opacity = 0.9) {
    const parts = items.map(({ cell, x, z, w, l }) => {
      const g = flat(new THREE.PlaneGeometry(w, l));
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / cells);
      g.translate(x, 0, z);
      return g;
    });
    const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({
      map: texture, transparent: true, opacity, depthWrite: false, roughness: 0.7,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
    }));
    m.position.y = 0.008;
    m.receiveShadow = true;
    return m;
  }
  const decals = new THREE.Group();
  scene.add(decals);
  function buildDecals() {
    while (decals.children.length) { const m = decals.children.pop(); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); }
    const laneLabels = Array.from({ length: LANES }, (_, i) => String(i + 1));
    const laneTex = tex(decalAtlas(laneLabels, 96, 224, (ctx, label, w, h) => {
      ctx.fillStyle = '#f1eee6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `210px ${FONT}`;
      ctx.fillText(label, w / 2, h / 2 + 10);
    }));
    const laneItems = [];
    for (let l = 1; l <= LANES; l++) {
      laneItems.push({ cell: l - 1, x: laneX(l), z: -1.25, w: 0.5, l: 1.5 });
      laneItems.push({ cell: l - 1, x: laneX(l), z: Z_FIN + 1.6, w: 0.5, l: 1.5 });
    }
    decals.add(decalMesh(laneTex, LANES, laneItems, 0.92));
    const dist = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const distTex = tex(decalAtlas(dist.map((d) => `${d}`), 160, 256, (ctx, label, w, h) => {
      ctx.fillStyle = '#f1eee6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `150px ${FONT}`;
      ctx.fillText(label, w / 2, h / 2 - 34);
      ctx.font = `74px ${FONT}`;
      ctx.fillText('m', w / 2, h - 46);
      ctx.fillRect(18, 10, w - 36, 8);
    }));
    // lanes 4 and 5 are the two lanes a human can run in (solo: lane 5, VS: lanes 4 + 5)
    const distItems = [];
    for (const lane of [PLAYER_LANE - 1, PLAYER_LANE]) dist.forEach((d, i) => distItems.push({ cell: i, x: laneX(lane), z: -d - 1.0, w: 0.82, l: 2.0 }));
    decals.add(decalMesh(distTex, dist.length, distItems, 0.6));
  }
  buildDecals();

  // ---------------------------------------------------------------- stands
  function standSegments() {
    const { cx, cz, hx, hz, rc } = SP;
    const x0 = cx - hx, x1 = cx + hx, z0 = cz - hz, z1 = cz + hz;
    const H = Math.PI / 2;
    return [
      { ax: x1, az: z1 - rc, bx: x1, bz: z0 + rc, nx: 1, nz: 0 },
      { cx: x1 - rc, cz: z0 + rc, a0: 0, a1: H },
      { ax: x1 - rc, az: z0, bx: x0 + rc, bz: z0, nx: 0, nz: -1 },
      { cx: x0 + rc, cz: z0 + rc, a0: H, a1: 2 * H },
      { ax: x0, az: z0 + rc, bx: x0, bz: z1 - rc, nx: -1, nz: 0 },
      { cx: x0 + rc, cz: z1 - rc, a0: 2 * H, a1: 3 * H },
      { ax: x0 + rc, az: z1, bx: x1 - rc, bz: z1, nx: 0, nz: 1 },
      { cx: x1 - rc, cz: z1 - rc, a0: 3 * H, a1: 4 * H },
    ];
  }
  const segs = standSegments();
  const segLen = (s, off = 0) => (s.cx === undefined ? Math.hypot(s.bx - s.ax, s.bz - s.az) : (SP.rc + off) * (s.a1 - s.a0));
  const basePerimeter = segs.reduce((a, s) => a + segLen(s), 0);
  function segPoint(s, t, off) {
    if (s.cx === undefined) {
      return { x: s.ax + (s.bx - s.ax) * t + s.nx * off, z: s.az + (s.bz - s.az) * t + s.nz * off, nx: s.nx, nz: s.nz };
    }
    const a = s.a0 + (s.a1 - s.a0) * t;
    const nx = Math.cos(a), nz = -Math.sin(a);
    return { x: s.cx + nx * (SP.rc + off), z: s.cz + nz * (SP.rc + off), nx, nz };
  }
  // Polyline of the front row, used to sweep every ribbon-like piece of the bowl.
  const basePts = [];
  {
    let acc = 0;
    for (const s of segs) {
      const n = s.cx === undefined ? 4 : 20;
      const L = segLen(s);
      for (let i = 0; i <= n; i++) basePts.push({ ...segPoint(s, i / n, 0), d: acc + (i / n) * L });
      acc += L;
    }
  }
  function ribbon(offA, yA, offB, yB, uScale = 0.25, vA = 0, vB = 1) {
    const pos = [], uv = [], idx = [];
    basePts.forEach((p, i) => {
      pos.push(p.x + p.nx * offA, yA, p.z + p.nz * offA, p.x + p.nx * offB, yB, p.z + p.nz * offB);
      uv.push(p.d * uScale, vA, p.d * uScale, vB);
      if (i < basePts.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const TIER = {
    lower: { off0: 0.3, y0: 1.75, rows: 18, depth: 0.8, rise: 0.4 },
    upper: { off0: 16.2, y0: 11.3, rows: 20, depth: 0.8, rise: 0.56 },
  };
  const tierEnd = (t) => ({ off: t.off0 + t.rows * t.depth, y: t.y0 + t.rows * t.rise });
  const ROOF = { offIn: 7.5, yIn: 31.5, offOut: 37, yOut: 27 };
  {
    const seatC = makeCanvas(64, 64);
    const sctx = seatC.getContext('2d');
    sctx.fillStyle = '#0d111d'; sctx.fillRect(0, 0, 64, 64);
    sctx.fillStyle = '#1c2a4e';
    for (let i = 0; i < 4; i++) sctx.fillRect(i * 16 + 2, 16, 12, 36);
    const seatTex = tex(seatC, { repeat: true, aniso: 4 });
    const seatMat = new THREE.MeshLambertMaterial({ map: seatTex, side: THREE.DoubleSide });
    const concrete = new THREE.MeshLambertMaterial({ color: 0x151a28, side: THREE.DoubleSide });
    const dark = new THREE.MeshLambertMaterial({ color: 0x080b14, side: THREE.DoubleSide });
    for (const t of [TIER.lower, TIER.upper]) {
      const e = tierEnd(t);
      scene.add(new THREE.Mesh(ribbon(t.off0, t.y0, e.off, e.y, 0.5, 0, t.rows), seatMat));
    }
    const lo = tierEnd(TIER.lower), up = tierEnd(TIER.upper);
    scene.add(new THREE.Mesh(ribbon(0, -0.1, 0, TIER.lower.y0), concrete));                 // front wall
    scene.add(new THREE.Mesh(ribbon(0, TIER.lower.y0, TIER.lower.off0, TIER.lower.y0), concrete));
    scene.add(new THREE.Mesh(ribbon(lo.off, lo.y, lo.off + 1.6, lo.y), concrete));          // concourse
    scene.add(new THREE.Mesh(ribbon(lo.off + 1.6, lo.y, lo.off + 1.6, TIER.upper.y0 + 0.2), dark));
    scene.add(new THREE.Mesh(ribbon(up.off, up.y, up.off, ROOF.yOut), dark));                // back wall
    scene.add(new THREE.Mesh(ribbon(ROOF.offIn, ROOF.yIn, ROOF.offOut, ROOF.yOut), new THREE.MeshLambertMaterial({ color: 0x10141f, side: THREE.DoubleSide })));
    scene.add(new THREE.Mesh(ribbon(ROOF.offIn, ROOF.yIn + 0.9, ROOF.offOut, ROOF.yOut + 2.2), dark));
    scene.add(new THREE.Mesh(ribbon(ROOF.offIn, ROOF.yIn - 0.2, ROOF.offIn, ROOF.yIn + 0.9), dark));
  }
  // Continuous light strip under the roof edge + a thin accent line on the tier fascia.
  const roofStrip = new THREE.Mesh(
    ribbon(ROOF.offIn + 0.5, ROOF.yIn - 0.35, ROOF.offIn + 1.5, ROOF.yIn - 0.5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 2.0, 2.3), side: THREE.DoubleSide, fog: false }),
  );
  scene.add(roofStrip);

  // LED ribbon board on the fascia between the tiers (scrolling, emissive).
  const ledCanvas = makeCanvas(2048, 128);
  const ledTex = tex(ledCanvas, { repeat: true });
  function drawLed() {
    const ctx = ledCanvas.getContext('2d');
    const W = ledCanvas.width, H = ledCanvas.height;
    ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H);
    const cell = W / 4;
    const panels = [
      (x) => {
        const g = ctx.createLinearGradient(x, 0, x + cell, 0);
        g.addColorStop(0, '#04122a'); g.addColorStop(1, '#062a4a');
        ctx.fillStyle = g; ctx.fillRect(x, 0, cell, H);
        if (logoImage) {
          const lh = H * 0.56, lw = lh * (logoImage.width / logoImage.height);
          ctx.drawImage(logoImage, x + (cell - lw) / 2, (H - lh) / 2, lw, lh);
        } else {
          ctx.fillStyle = '#fff'; ctx.font = `96px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('ORPHE', x + cell / 2, H / 2 + 6);
        }
      },
      (x) => {
        const g = ctx.createLinearGradient(x, 0, x + cell, 0);
        g.addColorStop(0, '#10e0ff'); g.addColorStop(1, '#b4ff3a');
        ctx.fillStyle = g; ctx.fillRect(x, 0, cell, H);
        ctx.fillStyle = '#04101c'; ctx.font = `86px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('SUPER VIRTUAL HURDLE', x + cell / 2, H / 2 + 6, cell - 30);
      },
      (x) => {
        ctx.fillStyle = '#060a16'; ctx.fillRect(x, 0, cell, H);
        ctx.fillStyle = '#ffffff'; ctx.font = `100px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('110mH', x + cell * 0.33, H / 2 + 6);
        ctx.fillStyle = '#ffd34d';
        ctx.fillText('FINAL', x + cell * 0.72, H / 2 + 6);
      },
      (x) => {
        const g = ctx.createLinearGradient(x, 0, x + cell, 0);
        g.addColorStop(0, '#1b0a3a'); g.addColorStop(1, '#3a0a2e');
        ctx.fillStyle = g; ctx.fillRect(x, 0, cell, H);
        ctx.fillStyle = '#fff'; ctx.font = `74px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ORPHE CORE', x + cell * 0.3, H / 2 + 6);
        ctx.fillStyle = '#22e3ff'; ctx.font = `46px ${FONT}`;
        ctx.fillText('MOVE TO PLAY', x + cell * 0.77, H / 2 + 6);
      },
    ];
    panels.forEach((p, i) => p(i * cell));
    ledTex.needsUpdate = true;
  }
  drawLed();
  const ledGain = new THREE.Color(1.5, 1.5, 1.5);
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, color: ledGain, side: THREE.DoubleSide });
  {
    const lo = tierEnd(TIER.lower);
    // Negative u so the text reads left-to-right from inside the bowl.
    scene.add(new THREE.Mesh(ribbon(lo.off + 1.55, lo.y + 0.25, lo.off + 1.55, lo.y + 1.75, -1 / 46), ledMat));
  }
  // Trackside LED boards on both sides of the home straight.
  {
    const zA = 6.5, zB = -129, len = zA - zB, h = 0.92;
    const mk = (x, rotY) => {
      const g = scaleUv(new THREE.PlaneGeometry(len, h), len / 15.2, 1);
      const m = new THREE.Mesh(g, ledMat);
      m.position.set(x, h / 2 + 0.04, (zA + zB) / 2);
      m.rotation.y = rotY;
      scene.add(m);
      const back = new THREE.Mesh(new THREE.BoxGeometry(len, h + 0.06, 0.12), new THREE.MeshLambertMaterial({ color: 0x07090f }));
      back.position.copy(m.position);
      back.position.x += rotY < 0 ? 0.08 : -0.08;
      back.rotation.y = rotY;
      back.castShadow = true;
      scene.add(back);
    };
    mk(TRACK_HALF + 1.75, -Math.PI / 2);
    mk(-TRACK_HALF - 1.2, Math.PI / 2);
  }

  // ---------------------------------------------------------------- crowd
  function crowdAtlas() {
    // R = shirt, G = skin, B = hair. Two frames: seated/neutral and arms up.
    const c = makeCanvas(256, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 128); // opaque, so edge pixels stay smooth masks
    ctx.globalCompositeOperation = 'lighter';
    const person = (ox, armsUp) => {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.moveTo(ox + 22, 128); ctx.lineTo(ox + 22, 84);
      ctx.quadraticCurveTo(ox + 24, 60, ox + 48, 58); ctx.lineTo(ox + 80, 58);
      ctx.quadraticCurveTo(ox + 104, 60, ox + 106, 84); ctx.lineTo(ox + 106, 128);
      ctx.closePath(); ctx.fill();
      if (armsUp) {
        ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 17; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ox + 32, 74); ctx.lineTo(ox + 14, 24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox + 96, 74); ctx.lineTo(ox + 114, 24); ctx.stroke();
        ctx.fillStyle = '#00ff00';
        ctx.beginPath(); ctx.arc(ox + 13, 16, 10, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(ox + 115, 16, 10, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#00ff00';
      ctx.beginPath(); ctx.arc(ox + 64, 38, 23, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0000ff';
      ctx.beginPath(); ctx.arc(ox + 64, 32, 24, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
    };
    person(0, false); person(128, true);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  const crowdUniforms = {
    uAtlas: { value: crowdAtlas() },
    uTime: { value: 0 }, uExcite: { value: 0.15 }, uWavePos: { value: 0 }, uWaveAmp: { value: 0 },
    uFogColor: { value: FOG_COLOR }, uFogDensity: { value: FOG_DENSITY },
    uFlash: { value: 0 },
  };
  const flashSeeds = [];
  {
    const seat = [], rnd = [], shirt = [], skin = [];
    const palette = [
      [0.92, 0.92, 0.9], [0.86, 0.1, 0.12], [0.1, 0.25, 0.75], [0.05, 0.07, 0.16], [0.95, 0.78, 0.1],
      [0.08, 0.08, 0.09], [0.1, 0.5, 0.25], [0.45, 0.47, 0.5], [0.9, 0.4, 0.6], [0.95, 0.5, 0.1], [0.1, 0.75, 0.85],
    ].map((c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace));
    const skins = [[0.96, 0.8, 0.68], [0.85, 0.64, 0.5], [0.62, 0.43, 0.32], [0.4, 0.27, 0.2], [0.98, 0.86, 0.76]]
      .map((c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace));
    const addRow = (off, y, shade) => {
      let acc = 0;
      for (const s of segs) {
        const L = segLen(s, off), L0 = segLen(s);
        const n = Math.max(1, Math.round(L / 0.62));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          if (rng() < 0.07) continue;
          const p = segPoint(s, t, off);
          const sPer = (acc + t * L0) / basePerimeter;
          // fan blocks: neighbours tend to share a colour
          const block = Math.floor(sPer * 90 + off * 0.11);
          const blockCol = palette[(block * 7 + 3) % palette.length];
          const col = rng() < 0.42 ? blockCol : palette[Math.floor(rng() * palette.length)];
          const sk = skins[Math.floor(rng() * skins.length)];
          seat.push(p.x + (rng() - 0.5) * 0.12, y, p.z + (rng() - 0.5) * 0.12);
          rnd.push(rng(), 0.9 + rng() * 0.22, sPer, shade * (0.8 + rng() * 0.3));
          shirt.push(col.r, col.g, col.b);
          skin.push(sk.r, sk.g, sk.b);
          if (rng() < 0.085) flashSeeds.push(p.x, y + 1.0, p.z, rng());
        }
        acc += L0;
      }
    };
    for (const [t, shadeA, shadeB] of [[TIER.lower, 1.0, 0.86], [TIER.upper, 0.8, 0.5]]) {
      for (let r = 0; r < t.rows; r++) {
        addRow(t.off0 + (r + 0.45) * t.depth, t.y0 + r * t.rise + 0.06, shadeA + (shadeB - shadeA) * (r / (t.rows - 1)));
      }
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    g.setAttribute('aSeat', new THREE.InstancedBufferAttribute(new Float32Array(seat), 3));
    g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(new Float32Array(rnd), 4));
    g.setAttribute('aShirt', new THREE.InstancedBufferAttribute(new Float32Array(shirt), 3));
    g.setAttribute('aSkin', new THREE.InstancedBufferAttribute(new Float32Array(skin), 3));
    g.instanceCount = seat.length / 3;
    const mat = new THREE.ShaderMaterial({
      uniforms: crowdUniforms,
      vertexShader: /* glsl */`
        attribute vec3 aSeat; attribute vec4 aRnd; attribute vec3 aShirt; attribute vec3 aSkin;
        uniform float uTime, uExcite, uWavePos, uWaveAmp, uFogDensity;
        varying vec2 vUv; varying vec3 vShirt; varying vec3 vSkin; varying float vBright; varying float vFog; varying float vArms;
        void main() {
          float ph = aRnd.x;
          float act = smoothstep(ph * 0.85, ph * 0.85 + 0.2, uExcite);
          float hop = act * abs(sin(uTime * (4.5 + ph * 3.0) + ph * 40.0));
          float dw = abs(fract(aRnd.z - uWavePos + 0.5) - 0.5);
          float wave = uWaveAmp * (1.0 - smoothstep(0.0, 0.035, dw));
          float lift = max(hop * 0.2, wave * 0.5);
          vArms = step(0.5, max(wave, act * step(0.25, sin(uTime * (1.6 + ph * 2.0) + ph * 17.0))));
          vec3 base = aSeat + vec3(0.0, lift, 0.0);
          vec3 toCam = cameraPosition - base;
          vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));
          vec3 wp = base + right * (position.x * 0.66 * aRnd.y) + vec3(0.0, position.y * 1.08 * aRnd.y, 0.0);
          vec4 mv = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mv;
          vUv = uv; vShirt = aShirt; vSkin = aSkin; vBright = aRnd.w;
          float d = length(mv.xyz);
          vFog = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uAtlas; uniform vec3 uFogColor; uniform float uFlash;
        varying vec2 vUv; varying vec3 vShirt; varying vec3 vSkin; varying float vBright; varying float vFog; varying float vArms;
        void main() {
          vec4 m = texture2D(uAtlas, vec2(vUv.x * 0.5 + vArms * 0.5, vUv.y));
          float cover = m.r + m.g + m.b;
          if (cover < 0.42) discard;
          vec3 col = (vShirt * m.r + vSkin * m.g + vec3(0.03, 0.025, 0.02) * m.b) / cover;
          col *= vBright * (0.62 + uFlash * 0.5);
          gl_FragColor = vec4(mix(col, uFogColor, vFog), 1.0);
        }`,
    });
    const crowd = new THREE.Mesh(g, mat);
    crowd.frustumCulled = false;
    scene.add(crowd);
  }
  // Camera flashes twinkling across the stands.
  const flashUniforms = { uTime: { value: 0 }, uDensity: { value: 0.012 }, uSize: { value: 1 } };
  {
    const n = flashSeeds.length / 4;
    const pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = flashSeeds[i * 4]; pos[i * 3 + 1] = flashSeeds[i * 4 + 1]; pos[i * 3 + 2] = flashSeeds[i * 4 + 2];
      ph[i] = flashSeeds[i * 4 + 3];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: flashUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aPhase; uniform float uTime, uDensity, uSize; varying float vI;
        float hash(float n) { return fract(sin(n) * 43758.5453123); }
        void main() {
          float tt = uTime * 2.3 + aPhase * 97.0;
          float r = hash(floor(tt) * 12.9898 + aPhase * 4321.0);
          vI = step(1.0 - uDensity, r) * exp(-fract(tt) * 8.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vI > 0.02 ? clamp(uSize * 900.0 / -mv.z, 3.0, 46.0) * (0.55 + vI) : 0.0;
        }`,
      fragmentShader: /* glsl */`
        varying float vI;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float core = 1.0 - smoothstep(0.0, 0.5, length(c)); core *= core * core;
          float streak = max(0.0, 1.0 - abs(c.y) * 16.0) * (1.0 - smoothstep(0.05, 0.5, abs(c.x)));
          gl_FragColor = vec4(vec3(0.82, 0.9, 1.0) * (core * 5.0 + streak * 1.6) * vI, 1.0);
        }`,
    }));
    pts.frustumCulled = false;
    scene.add(pts);
  }

  // ---------------------------------------------------------------- floodlights
  function glowTexture() {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.08, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.25, 'rgba(200,220,255,0.28)'); g.addColorStop(0.6, 'rgba(160,190,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, h, a] of [[250, 5, 0.5], [5, 170, 0.28]]) {
      const lg = ctx.createRadialGradient(128, 128, 0, 128, 128, Math.max(w, h) / 2);
      lg.addColorStop(0, `rgba(255,255,255,${a})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg; ctx.fillRect(128 - w / 2, 128 - h / 2, w, h);
    }
    return tex(c, { aniso: 1 });
  }
  const lampMat = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(2.4, 2.5, 2.9), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true });
  const lamps = [];
  {
    for (const s of segs) {
      const L = segLen(s, ROOF.offIn);
      const n = Math.max(1, Math.round(L / 21));
      for (let i = 0; i < n; i++) {
        const p = segPoint(s, (i + 0.5) / n, ROOF.offIn + 1.4);
        const sp = new THREE.Sprite(lampMat);
        sp.position.set(p.x, ROOF.yIn - 1.1, p.z);
        sp.scale.setScalar(11);
        scene.add(sp);
        lamps.push(sp);
      }
    }
  }
  // Soft beams from a few lamp banks, just enough to read as haze in the air.
  {
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: new THREE.Color(0.55, 0.65, 0.95) } },
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vV; varying float vH;
        void main() {
          vH = uv.y;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying float vH;
        void main() {
          float rim = pow(abs(dot(normalize(vN), normalize(vV))), 2.5);
          float a = rim * pow(clamp(vH, 0.0, 1.0), 1.6) * 0.05; // clamp: MSAA can extrapolate varyings below 0 -> NaN
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
    });
    const targets = [[-18, -20], [-20, -60], [-18, -100], [-60, -110], [-64, -30]];
    const sources = [lamps[1], lamps[3], lamps[5], lamps[Math.floor(lamps.length * 0.55)], lamps[Math.floor(lamps.length * 0.72)]];
    sources.forEach((src, i) => {
      if (!src) return;
      const to = new THREE.Vector3(targets[i][0], 0, targets[i][1]);
      const from = src.position.clone();
      const len = from.distanceTo(to);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 15, len, 24, 1, true), beamMat);
      cone.position.copy(from).add(to).multiplyScalar(0.5);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize());
      cone.renderOrder = 5;
      scene.add(cone);
    });
  }

  // ---------------------------------------------------------------- big screen + finish clock
  const jumbo = { canvas: makeCanvas(1024, 416), last: '' };
  jumbo.tex = tex(jumbo.canvas, { aniso: 8 });
  {
    const W = 33, H = 13.4;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: jumbo.tex, color: new THREE.Color(1.55, 1.55, 1.55), fog: false }));
    screen.position.set(-3, 23.4, -174);
    scene.add(screen);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, H + 1.4, 1.2), new THREE.MeshLambertMaterial({ color: 0x05070c }));
    frame.position.copy(screen.position); frame.position.z -= 0.7;
    scene.add(frame);
  }
  const clock = { canvas: makeCanvas(256, 96), last: '' };
  clock.tex = tex(clock.canvas, { aniso: 4 });
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.95, 0.5), new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.76), new THREE.MeshBasicMaterial({ map: clock.tex, color: new THREE.Color(2.2, 2.2, 2.2) }));
    face.position.z = 0.26;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8), new THREE.MeshStandardMaterial({ color: 0x22252c }));
    post.position.y = -1.1;
    g.add(body, face, post);
    g.position.set(-TRACK_HALF - 2.4, 1.75, Z_FIN - 2.2);
    g.rotation.y = 0.5;
    body.castShadow = true;
    scene.add(g);
  }
  function drawClock(text) {
    if (clock.last === text) return;
    clock.last = text;
    const ctx = clock.canvas.getContext('2d');
    ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#ffb21e'; ctx.font = `92px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 52);
    clock.tex.needsUpdate = true;
  }
  function drawJumbo(s) {
    const key2 = JSON.stringify(s);
    if (jumbo.last === key2) return;
    jumbo.last = key2;
    const c = jumbo.canvas, ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#050a18'); bg.addColorStop(1, '#02040a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, '#12dcff'); bar.addColorStop(1, '#b6ff3c');
    ctx.fillStyle = bar; ctx.fillRect(0, 0, W, 10); ctx.fillRect(0, 84, W, 3);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.font = `58px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText('SUPER VIRTUAL HURDLE', 28, 50);
    ctx.fillStyle = '#ffd34d'; ctx.textAlign = 'right';
    ctx.fillText('110mH FINAL', W - 28, 50);
    ctx.textAlign = 'center';
    if (s.mode === 'title') {
      if (logoImage) {
        const lh = 150, lw = lh * (logoImage.width / logoImage.height);
        ctx.drawImage(logoImage, (W - lw) / 2, 130, lw, lh);
      } else {
        ctx.fillStyle = '#fff'; ctx.font = `200px ${FONT}`; ctx.fillText('ORPHE', W / 2, 215);
      }
      ctx.fillStyle = '#22e3ff'; ctx.font = `64px ${FONT}`;
      ctx.fillText('VIRTUAL SPORTS  ·  MOVE TO PLAY', W / 2, 350);
    } else if (s.mode === 'duo') {
      // VS mode: both runners' clocks side by side
      ctx.fillStyle = '#1b2947'; ctx.fillRect(W / 2 - 2, 104, 4, 290);
      s.cols.forEach((c, i) => {
        const cx = W * (0.25 + 0.5 * i);
        ctx.fillStyle = c.color; ctx.font = `74px ${FONT}`; ctx.fillText(c.label, cx, 140);
        ctx.fillStyle = c.done ? '#ffd34d' : '#ffffff'; ctx.font = `210px ${FONT}`; ctx.fillText(c.time, cx, 268);
        ctx.fillStyle = '#9fb4d8'; ctx.font = `52px ${FONT}`; ctx.fillText(c.sub || '', cx, 378);
      });
    } else if (s.mode === 'text') {
      ctx.fillStyle = s.color || '#ffffff'; ctx.font = `210px ${FONT}`;
      ctx.fillText(s.text, W / 2, 232, W - 60);
      if (s.sub) { ctx.fillStyle = '#9fb4d8'; ctx.font = `58px ${FONT}`; ctx.fillText(s.sub, W / 2, 366); }
    } else {
      ctx.fillStyle = s.color || '#ffffff'; ctx.font = `300px ${FONT}`;
      ctx.fillText(s.time, W / 2 - 40, 226);
      ctx.fillStyle = '#9fb4d8'; ctx.font = `90px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText('SEC', W / 2 + 330, 268);
      ctx.textAlign = 'center'; ctx.font = `62px ${FONT}`;
      ctx.fillStyle = s.subColor || '#22e3ff';
      ctx.fillText(s.sub || '', W / 2, 372);
    }
    jumbo.tex.needsUpdate = true;
  }
  drawJumbo({ mode: 'title' });
  drawClock('0.00');

  // ---------------------------------------------------------------- hurdles
  function paint(g, hex) {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  }
  const box = (w, h, d, x, y, z, color) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);
  const HH = HURDLE_VISUAL_H;
  const hurdleGeo = mergeGeometries([
    box(0.05, 0.04, 0.74, -0.57, 0.02, 0.33, 0x23272e), box(0.05, 0.04, 0.74, 0.57, 0.02, 0.33, 0x23272e),
    box(0.036, HH - 0.03, 0.036, -0.57, (HH - 0.03) / 2, 0, 0xcfd4dc), box(0.036, HH - 0.03, 0.036, 0.57, (HH - 0.03) / 2, 0, 0xcfd4dc),
    box(1.14, 0.03, 0.03, 0, 0.07, 0, 0x23272e),
    box(1.2, 0.07, 0.022, 0, HH - 0.035, 0, 0xf4f3ee),
    box(0.15, 0.072, 0.026, -0.42, HH - 0.035, 0, 0x121418), box(0.15, 0.072, 0.026, 0.42, HH - 0.035, 0, 0x121418),
    box(0.3, 0.024, 0.027, 0, HH - 0.035, 0, 0x10cfee),
  ]);
  const hurdleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.12 });
  const tippable = new Map(); // lane -> hurdles that can be knocked over (the lanes a human may run in)
  function buildHurdles(zs, tippableLanes, instancedLanes) {
    for (const lane of tippableLanes) {
      tippable.set(lane, zs.map((z) => {
        const pivot = new THREE.Group();
        const mesh = new THREE.Mesh(hurdleGeo, hurdleMat.clone());
        mesh.castShadow = true;
        pivot.add(mesh);
        pivot.position.set(laneX(lane), 0, z);
        scene.add(pivot);
        return { pivot, mesh, angle: 0, vel: 0, falling: false, glow: 0 };
      }));
    }
    const field = new THREE.InstancedMesh(hurdleGeo, hurdleMat, zs.length * instancedLanes.length);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const lane of instancedLanes) for (const z of zs) { m.makeTranslation(laneX(lane), 0, z); field.setMatrixAt(i++, m); }
    field.castShadow = true;
    scene.add(field);
    // Starting blocks (rail + two pedals) and lane boxes.
    const blockGeo = mergeGeometries([
      box(0.09, 0.03, 0.9, 0, 0.015, 0.45, 0x8a9099),
      box(0.14, 0.13, 0.2, -0.13, 0.085, 0.36, 0x15171c), box(0.14, 0.13, 0.2, 0.13, 0.085, 0.72, 0x15171c),
    ]);
    const lanes = [...instancedLanes, ...tippableLanes];
    const blocks = new THREE.InstancedMesh(blockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }), lanes.length);
    const boxGeo = mergeGeometries([box(0.4, 0.42, 0.3, 0, 0.21, 0, 0xe4e7ee), box(0.4, 0.035, 0.3, 0, 0.44, 0, 0x10cfee), box(0.3, 0.24, 0.02, 0, 0.24, 0.16, 0x16181e)]);
    const boxes = new THREE.InstancedMesh(boxGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), lanes.length);
    lanes.forEach((lane, b) => {
      m.makeTranslation(laneX(lane), 0, 0.12); blocks.setMatrixAt(b, m);
      m.makeTranslation(laneX(lane), 0, 2.6); boxes.setMatrixAt(b, m);
    });
    blocks.castShadow = true; boxes.castShadow = true;
    scene.add(blocks, boxes);
  }
  function updateHurdles(dt) {
    for (const list of tippable.values()) for (const h of list) {
      if (h.falling) {
        h.vel -= 17 * dt;
        h.angle += h.vel * dt;
        if (h.angle <= -Math.PI / 2) {
          h.angle = -Math.PI / 2;
          if (h.vel < -1.6) h.vel = -h.vel * 0.24; else { h.vel = 0; h.falling = false; }
        }
        h.pivot.rotation.x = h.angle;
      }
      if (h.glow > 0) {
        h.glow = Math.max(0, h.glow - dt * 2.2);
        h.mesh.material.emissive.setRGB(0.15 * h.glow, 1.4 * h.glow, 0.5 * h.glow);
      }
    }
  }

  // ---------------------------------------------------------------- AR overlays: take-off zone + finish gate
  const guideGeo = flat(new THREE.PlaneGeometry(1.06, 1));
  // One take-off marker per human runner; main.js shows each only in its owner's view.
  const guides = [0, 1].map(() => {
    const uniforms = { uTime: { value: 0 }, uAlpha: { value: 0 }, uActive: { value: 0 }, uLen: { value: 1 } };
    const mesh = new THREE.Mesh(guideGeo, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uAlpha, uActive, uLen; varying vec2 vUv;
      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float y = vUv.y * uLen;
        float ch = fract(y * 1.15 + x * 0.55 - uTime * 2.4); // chevrons point at the hurdle
        float band = smoothstep(0.0, 0.1, ch) * (1.0 - smoothstep(0.42, 0.6, ch));
        float rail = smoothstep(0.86, 0.93, x) * (1.0 - smoothstep(0.96, 1.0, x));
        float ends = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.94, 1.0, vUv.y));
        vec3 col = mix(vec3(0.08, 0.75, 1.0), vec3(0.55, 1.0, 0.18), uActive);
        float a = (band * (0.26 + 0.5 * uActive) * (1.0 - x * 0.5) + rail * 0.8) * ends * uAlpha;
        gl_FragColor = vec4(col * a * (1.0 + uActive * 0.6), 1.0);
      }`,
  }));
    mesh.position.y = 0.02;
    mesh.renderOrder = 4;
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, uniforms, want: false };
  });

  const gateUniforms = { uTime: { value: 0 }, uBurst: { value: 0 }, uAlpha: { value: 1 } };
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(LANES * LANE_W, 3.4, 1, 1), new THREE.ShaderMaterial({
    uniforms: gateUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uBurst, uAlpha; varying vec2 vUv;
      void main() {
        float lane = vUv.x * ${LANES.toFixed(1)};
        float post = 1.0 - smoothstep(0.0, 0.045, abs(fract(lane + 0.5) - 0.5));
        float scan = 0.55 + 0.45 * sin(vUv.y * 90.0 - uTime * 5.0);
        float fade = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.7);
        vec2 cb = floor(vec2(lane * 4.0, (vUv.y - 0.86) * 48.0));
        float checker = step(0.86, vUv.y) * step(vUv.y, 0.985) * mod(cb.x + cb.y, 2.0);
        float sweep = (1.0 - smoothstep(0.0, 0.25, abs(fract(vUv.x * 0.5 - uTime * 0.12) - 0.5))) * 0.35;
        vec3 col = vec3(0.2, 0.85, 1.0) * (fade * 0.16 * scan + post * (0.5 + fade) + sweep * fade * 0.3) + vec3(1.0) * checker * 0.85;
        col *= uAlpha * (1.0 + uBurst * 6.0) * (1.0 - smoothstep(0.0, 1.0, uBurst) * 0.999);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  gate.position.set(0, 1.7, Z_FIN);
  gate.renderOrder = 4;
  scene.add(gate);
  let gateBurst = -1;

  // ---------------------------------------------------------------- API
  const state = { excite: 0.15, exciteTarget: 0.15, flash: 0.012, flashTarget: 0.012, wave: -1, time: 0, ledPulse: 0 };
  const eachHurdle = (fn) => { for (const list of tippable.values()) list.forEach(fn); };
  return {
    lamps, guides,
    buildHurdles,
    focusShadow,
    drawJumbo, drawClock,
    /** Re-render every font-dependent texture (called once the display font is ready). */
    redrawText() { drawLed(); buildDecals(); jumbo.last = ''; clock.last = ''; drawJumbo({ mode: 'title' }); drawClock('0.00'); },
    setExcitement(target, flashTarget) { state.exciteTarget = target; if (flashTarget !== undefined) state.flashTarget = flashTarget; },
    /** Instant swell that then relaxes back toward the target. */
    kick(amount, flash = 0) { state.excite = Math.min(1, state.excite + amount); state.flash = Math.min(0.6, state.flash + flash); },
    startWave() { if (state.wave < 0) state.wave = 0; },
    pulseLed(v = 1) { state.ledPulse = v; },
    hitHurdle(lane, i, speed) { const h = tippable.get(lane)?.[i]; if (!h || h.angle !== 0) return; h.falling = true; h.vel = -(3.2 + speed * 0.4); },
    clearHurdle(lane, i) { const h = tippable.get(lane)?.[i]; if (h) h.glow = 1; },
    burstGate() { if (gate.visible && gateBurst < 0) gateBurst = 0; },
    /** Take-off zone of runner `slot`. Only records what to show; viewGuides() applies it per view. */
    setGuide(slot, visible, x = 0, zNear = 0, zFar = 0, active = 0, alpha = 0) {
      const g = guides[slot];
      g.want = visible;
      if (!visible) return;
      const len = Math.max(0.2, zNear - zFar);
      g.mesh.scale.set(1, 1, len);
      g.mesh.position.set(x, 0.02, (zNear + zFar) / 2);
      g.uniforms.uLen.value = len;
      g.uniforms.uActive.value = active;
      g.uniforms.uAlpha.value = alpha;
    },
    /** Show only the marker that belongs to the view about to be rendered. */
    viewGuides(slot) { guides.forEach((g, i) => { g.mesh.visible = g.want && i === slot; }); },
    resetRace() {
      eachHurdle((h) => {
        h.angle = 0; h.vel = 0; h.falling = false; h.glow = 0;
        h.pivot.rotation.x = 0; h.mesh.material.emissive.setRGB(0, 0, 0);
      });
      gateBurst = -1; gateUniforms.uBurst.value = 0; gate.visible = true;
      guides.forEach((g) => { g.want = false; g.mesh.visible = false; });
    },
    /** Time-driven animation, once per frame. */
    update(dt) {
      state.time += dt;
      const t = state.time;
      state.excite += (state.exciteTarget - state.excite) * Math.min(1, dt * 1.6);
      state.flash += (state.flashTarget - state.flash) * Math.min(1, dt * 1.2);
      crowdUniforms.uTime.value = t;
      crowdUniforms.uExcite.value = state.excite;
      if (state.wave >= 0) {
        state.wave += dt / 9;
        crowdUniforms.uWavePos.value = state.wave % 1;
        crowdUniforms.uWaveAmp.value = Math.min(1, state.wave * 8) * Math.min(1, (2 - state.wave) * 8);
        if (state.wave >= 2) { state.wave = -1; crowdUniforms.uWaveAmp.value = 0; }
      }
      crowdUniforms.uFlash.value = Math.min(1, state.flash * 2.5);
      flashUniforms.uTime.value = t;
      flashUniforms.uDensity.value = state.flash;
      skyMat.uniforms.uTime.value = t;
      ledTex.offset.x = (t * 0.018) % 1;
      state.ledPulse = Math.max(0, state.ledPulse - dt * 1.4);
      ledGain.setScalar(1.5 + state.ledPulse * 2.2);
      guides.forEach((g) => { g.uniforms.uTime.value = t; });
      gateUniforms.uTime.value = t;
      if (gateBurst >= 0) {
        gateBurst += dt * 2.2;
        gateUniforms.uBurst.value = Math.min(1, gateBurst);
        if (gateBurst >= 1) { gate.visible = false; gateBurst = -1; }
      }
      updateHurdles(dt);
    },
    /** Camera-dependent bits, once per rendered view. */
    preRender(camera) {
      sky.position.copy(camera.position);
      sky.scale.setScalar(camera.far * 0.09);
      flashUniforms.uSize.value = renderer.getPixelRatio();
    },
  };
}
