// fx.js — HDR post-processing (bloom, miniature tilt-shift, grade) and the particle
// systems: sparks / fireworks, confetti, hot-spring steam, seasonal drift, ball trail.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const PASS_VERTEX = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

// One NaN or runaway-bright pixel would be smeared over the frame by the bloom blur.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: PASS_VERTEX,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (!(c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0)) c = vec3(0.0);
      gl_FragColor = vec4(min(c, vec3(40.0)), 1.0);
    }`,
};

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
    uTilt: { value: 1 }, uFocus: { value: 0.5 }, uBand: { value: 0.2 },
    uFlash: { value: 0 }, uFade: { value: 0 }, uPunch: { value: 0 }, uWarm: { value: 0 }, uDim: { value: 0 },
  },
  vertexShader: PASS_VERTEX,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uTilt, uFocus, uBand, uFlash, uFade, uPunch, uWarm, uDim;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 px = 1.0 / uRes;
      // miniature look: sharp band around the table, soft towards the top and bottom of the frame
      float away = smoothstep(uBand, 0.62, abs(vUv.y - uFocus));
      float radius = uTilt * away * uRes.y / 190.0;
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (radius > 0.35) {
        float tot = 1.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996;
          float r = sqrt((float(i) + 0.5) / 12.0) * radius;
          col += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * px).rgb;
          tot += 1.0;
        }
        col /= tot;
      }
      vec2 c = vUv - 0.5;
      float rr = length(c * vec2(uRes.x / uRes.y, 1.0));
      // impact punch: a touch of chromatic split at the edges
      float ab = (0.0006 + uPunch * 0.009) * rr;
      col.r = mix(col.r, texture2D(tDiffuse, vUv + c * ab).r, 0.7);
      col.b = mix(col.b, texture2D(tDiffuse, vUv - c * ab).b, 0.7);
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // grade: cool shadows, warm highlights, a little extra colour
      col = mix(vec3(lum), col, 1.12);
      col *= mix(vec3(0.90, 0.97, 1.12), vec3(1.07, 1.0, 0.90), smoothstep(0.0, 0.7, lum));
      col = mix(col, col * vec3(1.12, 1.0, 0.84), uWarm);
      col *= 1.0 - 0.62 * smoothstep(0.42, 1.12, rr);
      col = mix(col, vec3(lum) * vec3(0.55, 0.6, 0.75), uDim);
      col += vec3(1.0, 0.93, 0.8) * uFlash;
      col *= 1.0 - uFade;
      col += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.018 * (0.5 + lum);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export function createFx({ renderer, scene, camera }) {
  let time = 0;
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass(SanitizeShader));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.5, 0.7, 1.0);
  composer.addPass(bloom);
  const finalPass = new ShaderPass(FinalShader);
  composer.addPass(finalPass);
  composer.addPass(new OutputPass());
  const U = finalPass.uniforms;
  const pointUniforms = { uScale: { value: 500 } };

  // ---------------------------------------------------------------- sparks (hits, fireworks, glitter)
  const MAX = 4200;
  const sp = {
    pos: new Float32Array(MAX * 3), col: new Float32Array(MAX * 3), size: new Float32Array(MAX),
    vel: new Float32Array(MAX * 3), base: new Float32Array(MAX * 3),
    life: new Float32Array(MAX), max: new Float32Array(MAX), drag: new Float32Array(MAX), grav: new Float32Array(MAX),
    bsize: new Float32Array(MAX), twinkle: new Float32Array(MAX), next: 0,
  };
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(sp.pos, 3).setUsage(THREE.DynamicDrawUsage));
  spGeo.setAttribute('aColor', new THREE.BufferAttribute(sp.col, 3).setUsage(THREE.DynamicDrawUsage));
  spGeo.setAttribute('aSize', new THREE.BufferAttribute(sp.size, 1).setUsage(THREE.DynamicDrawUsage));
  const sparkMaterial = new THREE.ShaderMaterial({
    uniforms: pointUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      attribute float aSize; attribute vec3 aColor; uniform float uScale; varying vec3 vColor;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize > 0.0 ? max(1.5, aSize * uScale / -mv.z) : 0.0;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      void main() {
        float a = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vColor * a * a, 1.0);
      }`,
  });
  const sparks = new THREE.Points(spGeo, sparkMaterial);
  sparks.frustumCulled = false;
  sparks.renderOrder = 6;
  scene.add(sparks);

  function spark(x, y, z, vx, vy, vz, r, g, b, life, size, drag = 1, grav = 9.8, twinkle = 0) {
    const i = sp.next; sp.next = (sp.next + 1) % MAX;
    sp.pos[i * 3] = x; sp.pos[i * 3 + 1] = y; sp.pos[i * 3 + 2] = z;
    sp.vel[i * 3] = vx; sp.vel[i * 3 + 1] = vy; sp.vel[i * 3 + 2] = vz;
    sp.base[i * 3] = r; sp.base[i * 3 + 1] = g; sp.base[i * 3 + 2] = b;
    sp.life[i] = life; sp.max[i] = life; sp.bsize[i] = size; sp.drag[i] = drag; sp.grav[i] = grav; sp.twinkle[i] = twinkle;
  }
  function updateSparks(dt, t) {
    for (let i = 0; i < MAX; i++) {
      if (sp.life[i] <= 0) { if (sp.size[i] !== 0) sp.size[i] = 0; continue; }
      sp.life[i] -= dt;
      const k = Math.max(0, 1 - sp.drag[i] * dt);
      const j = i * 3;
      sp.vel[j] *= k; sp.vel[j + 1] = sp.vel[j + 1] * k - sp.grav[i] * dt; sp.vel[j + 2] *= k;
      sp.pos[j] += sp.vel[j] * dt; sp.pos[j + 1] += sp.vel[j + 1] * dt; sp.pos[j + 2] += sp.vel[j + 2] * dt;
      const f = Math.max(0, sp.life[i] / sp.max[i]);
      let a = f * f * (3 - 2 * f);
      if (sp.twinkle[i] > 0) a *= 0.35 + 0.65 * Math.abs(Math.sin(t * 38 * sp.twinkle[i] + i));
      sp.col[j] = sp.base[j] * a; sp.col[j + 1] = sp.base[j + 1] * a; sp.col[j + 2] = sp.base[j + 2] * a;
      sp.size[i] = sp.life[i] > 0 ? sp.bsize[i] * (0.45 + 0.55 * f) : 0;
    }
    spGeo.attributes.position.needsUpdate = true;
    spGeo.attributes.aColor.needsUpdate = true;
    spGeo.attributes.aSize.needsUpdate = true;
  }

  function sphereBurst(x, y, z, color, { n = 40, speed = 2, life = 0.5, size = 0.05, drag = 2.5, grav = 3, glow = 4, twinkle = 0.2, up = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.8);
      spark(x, y, z, Math.sin(th) * Math.cos(ph) * s, Math.cos(th) * s + up, Math.sin(th) * Math.sin(ph) * s,
        color[0] * glow, color[1] * glow, color[2] * glow, life * (0.6 + Math.random() * 0.8), size * (0.6 + Math.random() * 0.8), drag, grav, Math.random() < twinkle ? 1 : 0);
    }
  }

  // Fireworks over the garden.
  const shells = [];
  const FW_COLORS = [[1.0, 0.78, 0.3], [1.0, 0.35, 0.3], [0.45, 0.8, 1.0], [0.75, 1.0, 0.45], [1.0, 0.55, 0.85], [1.0, 1.0, 0.92]];
  const api = { onFireworkBurst: null };
  function fireworkBurst(x, y, z, color) {
    const n = 150;
    const speed = 5.5 + Math.random() * 3;
    for (let i = 0; i < n; i++) {
      const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
      const s = speed * (0.82 + Math.random() * 0.3);
      const c = Math.random() < 0.18 ? [1, 1, 1] : color;
      spark(x, y, z, Math.sin(th) * Math.cos(ph) * s, Math.cos(th) * s, Math.sin(th) * Math.sin(ph) * s,
        c[0] * 5, c[1] * 5, c[2] * 5, 1.5 + Math.random() * 1.1, 0.5, 1.3, 1.6, Math.random() < 0.3 ? 1 : 0);
    }
    for (let i = 0; i < 24; i++) {
      const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
      const s = speed * 0.4 * Math.random();
      spark(x, y, z, Math.sin(th) * Math.cos(ph) * s, Math.cos(th) * s, Math.sin(th) * Math.sin(ph) * s, 6, 5.5, 4.5, 2.2 + Math.random(), 0.36, 0.8, 1.2, 1);
    }
    if (api.onFireworkBurst) api.onFireworkBurst(x, y, z);
  }
  function updateShells(dt) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.vy -= 6 * dt; s.y += s.vy * dt; s.x += s.vx * dt;
      spark(s.x, s.y, s.z, (Math.random() - 0.5) * 0.5, -0.8, (Math.random() - 0.5) * 0.5, 3.5, 2.6, 1.4, 0.45, 0.28, 1, 1);
      if (s.vy < 1.2) { fireworkBurst(s.x, s.y, s.z, s.color); shells.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- confetti (paper squares, lit by the room)
  const CN = 520;
  const confetti = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.03, 0.045),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.55, metalness: 0.2 }),
    CN,
  );
  confetti.frustumCulled = false;
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const cf = {
    pos: new Float32Array(CN * 3), vel: new Float32Array(CN * 3), axis: new Float32Array(CN * 3),
    ang: new Float32Array(CN), spin: new Float32Array(CN), life: new Float32Array(CN), seed: new Float32Array(CN), floor: new Float32Array(CN), next: 0, live: 0,
  };
  const CF_COLORS = [0xf4c542, 0xfff4dd, 0xe2452c, 0x2f6fd0, 0xf2a7c0, 0x9ccb5a].map((c) => new THREE.Color(c));
  const dummy = new THREE.Object3D();
  const axisV = new THREE.Vector3();
  dummy.scale.setScalar(0); dummy.updateMatrix();
  for (let i = 0; i < CN; i++) { confetti.setMatrixAt(i, dummy.matrix); confetti.setColorAt(i, CF_COLORS[i % CF_COLORS.length]); }
  scene.add(confetti);
  function emitConfetti(x, y, z, n, { vx = 0, vy = 2.6, vz = 0, spread = 1.2, floor = 0.012 } = {}) {
    for (let k = 0; k < n; k++) {
      const i = cf.next; cf.next = (cf.next + 1) % CN;
      cf.pos[i * 3] = x + (Math.random() - 0.5) * 0.3; cf.pos[i * 3 + 1] = y + Math.random() * 0.2; cf.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
      cf.vel[i * 3] = vx + (Math.random() - 0.5) * spread * 2; cf.vel[i * 3 + 1] = vy * (0.5 + Math.random() * 0.8); cf.vel[i * 3 + 2] = vz + (Math.random() - 0.5) * spread * 2;
      axisV.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      cf.axis[i * 3] = axisV.x; cf.axis[i * 3 + 1] = axisV.y; cf.axis[i * 3 + 2] = axisV.z;
      cf.ang[i] = Math.random() * 6; cf.spin[i] = 4 + Math.random() * 12; cf.life[i] = 6 + Math.random() * 4; cf.seed[i] = Math.random() * 100; cf.floor[i] = floor;
    }
    cf.live = Math.max(cf.live, 11);
  }
  function updateConfetti(dt, t) {
    if (cf.live <= 0) return;
    cf.live -= dt;
    for (let i = 0; i < CN; i++) {
      if (cf.life[i] <= 0) continue;
      cf.life[i] -= dt;
      const j = i * 3;
      if (cf.pos[j + 1] > cf.floor[i]) {
        const k = Math.max(0, 1 - 1.8 * dt);
        cf.vel[j] = cf.vel[j] * k + Math.sin(t * 3.1 + cf.seed[i]) * 0.8 * dt;
        cf.vel[j + 1] = cf.vel[j + 1] * k - 2.4 * dt;
        cf.vel[j + 2] = cf.vel[j + 2] * k + Math.cos(t * 2.7 + cf.seed[i]) * 0.8 * dt;
        cf.pos[j] += cf.vel[j] * dt; cf.pos[j + 1] += cf.vel[j + 1] * dt; cf.pos[j + 2] += cf.vel[j + 2] * dt;
        cf.ang[i] += cf.spin[i] * dt;
        if (cf.pos[j + 1] <= cf.floor[i]) { cf.pos[j + 1] = cf.floor[i]; cf.axis[j] = 1; cf.axis[j + 1] = 0; cf.axis[j + 2] = 0; cf.ang[i] = Math.PI / 2; }
      }
      dummy.position.set(cf.pos[j], cf.pos[j + 1], cf.pos[j + 2]);
      axisV.set(cf.axis[j], cf.axis[j + 1], cf.axis[j + 2]);
      dummy.quaternion.setFromAxisAngle(axisV, cf.ang[i]);
      dummy.scale.setScalar(cf.life[i] > 0 ? Math.min(1, cf.life[i] * 2) : 0);
      dummy.updateMatrix();
      confetti.setMatrixAt(i, dummy.matrix);
    }
    confetti.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- soft sprites: steam and seasonal drift
  const updaters = [];
  const softVertex = /* glsl */`
    attribute float aSize; attribute float aAlpha; attribute float aRot; uniform float uScale;
    varying float vAlpha; varying float vRot;
    void main() {
      vAlpha = aAlpha; vRot = aRot;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uScale / -mv.z;
    }`;

  /** Slow rising mist over an elliptical pool: additive, so the lanterns seem to light it. */
  function createSteam({ x, y, z, rx, rz, count = 70, height = 2.4, color = [0.75, 0.82, 0.9], strength = 0.085 }) {
    const pos = new Float32Array(count * 3), size = new Float32Array(count), alpha = new Float32Array(count), rot = new Float32Array(count);
    const p = [];
    for (let i = 0; i < count; i++) p.push({ age: Math.random(), life: 5 + Math.random() * 5, ox: 0, oz: 0, sway: Math.random() * 6.28, s: 0.6 + Math.random() * 0.9 });
    const respawn = (q) => {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      q.ox = x + Math.cos(a) * r * rx; q.oz = z + Math.sin(a) * r * rz; q.age = 0;
    };
    p.forEach((q) => { respawn(q); q.age = Math.random(); });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: pointUniforms.uScale, uColor: { value: new THREE.Color(...color) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: softVertex,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor * a * a * vAlpha, 1.0);
        }`,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 4;
    scene.add(points);
    updaters.push((dt, t) => {
      for (let i = 0; i < count; i++) {
        const q = p[i];
        q.age += dt / q.life;
        if (q.age >= 1) respawn(q);
        const k = q.age;
        pos[i * 3] = q.ox + Math.sin(t * 0.35 + q.sway) * 0.25 * k + k * 0.35;
        pos[i * 3 + 1] = y + k * height * q.s;
        pos[i * 3 + 2] = q.oz + Math.cos(t * 0.28 + q.sway) * 0.2 * k;
        size[i] = (0.55 + k * 1.5) * q.s;
        alpha[i] = strength * Math.sin(Math.PI * Math.min(1, k * 1.15)) ** 1.5;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    });
    return points;
  }

  /**
   * Seasonal drift over the garden and the edge of the room.
   * kind: 'petal' (spring), 'firefly' (summer), 'maple' (autumn), 'snow' (winter)
   */
  function createDrift({ kind, count = 90, box }) {
    const pos = new Float32Array(count * 3), size = new Float32Array(count), alpha = new Float32Array(count), rot = new Float32Array(count), col = new Float32Array(count * 3);
    const palette = {
      petal: [[0.8, 0.55, 0.62], [0.82, 0.68, 0.72], [0.78, 0.45, 0.55]],
      maple: [[0.62, 0.13, 0.05], [0.7, 0.3, 0.06], [0.68, 0.5, 0.1], [0.45, 0.07, 0.04]],
      snow: [[0.7, 0.74, 0.8]],
      firefly: [[0.75, 1.0, 0.35]],
    }[kind];
    const p = [];
    for (let i = 0; i < count; i++) {
      const c = palette[i % palette.length];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      p.push({
        x: box.x0 + Math.random() * (box.x1 - box.x0), y: box.y0 + Math.random() * (box.y1 - box.y0), z: box.z0 + Math.random() * (box.z1 - box.z0),
        fall: kind === 'firefly' ? 0 : (kind === 'snow' ? 0.28 : 0.42) * (0.6 + Math.random() * 0.8),
        sway: Math.random() * 6.28, swayAmp: 0.25 + Math.random() * 0.5, spin: (Math.random() - 0.5) * 3,
        s: kind === 'snow' ? 0.035 + Math.random() * 0.03 : kind === 'firefly' ? 0.07 : 0.09 + Math.random() * 0.07,
      });
      rot[i] = Math.random() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const glow = kind === 'firefly';
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: pointUniforms.uScale, uKind: { value: { petal: 0, maple: 1, snow: 2, firefly: 3 }[kind] } },
      transparent: true, depthWrite: false, fog: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */`
        attribute float aSize; attribute float aAlpha; attribute float aRot; attribute vec3 aColor; uniform float uScale;
        varying float vAlpha; varying float vRot; varying vec3 vColor;
        void main() {
          vAlpha = aAlpha; vRot = aRot; vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(2.0, aSize * uScale / -mv.z);
        }`,
      fragmentShader: /* glsl */`
        uniform float uKind; varying float vAlpha; varying float vRot; varying vec3 vColor;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float c = cos(vRot), s = sin(vRot);
          q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
          float r = length(q), th = atan(q.y, q.x);
          float shape;
          if (uKind < 0.5) shape = smoothstep(0.02, 0.0, length(q * vec2(1.0, 1.75)) - 0.42);           // petal: an oval
          else if (uKind < 1.5) shape = smoothstep(0.03, 0.0, r - (0.14 + 0.34 * pow(abs(cos(th * 2.5 + 1.5708)), 2.4)) * (0.72 + 0.28 * sin(th)));  // maple: five pointed lobes, longest at the tip
          else shape = smoothstep(0.5, 0.05, r);                                                          // snow / firefly: soft dot
          if (shape < 0.02) discard;
          float shade = uKind < 1.5 ? 0.55 + 0.45 * smoothstep(-0.4, 0.4, q.y) : 1.0;
          gl_FragColor = vec4(vColor * shade * (uKind > 2.5 ? 3.0 * shape : 1.0), shape * vAlpha);
        }`,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 5;
    scene.add(points);
    for (let i = 0; i < count; i++) size[i] = p[i].s;
    updaters.push((dt, t) => {
      for (let i = 0; i < count; i++) {
        const q = p[i];
        if (kind === 'firefly') {
          q.x += Math.sin(t * 0.5 + q.sway) * 0.25 * dt; q.y += Math.cos(t * 0.7 + q.sway * 1.7) * 0.18 * dt; q.z += Math.cos(t * 0.4 + q.sway) * 0.25 * dt;
          alpha[i] = Math.max(0, Math.sin(t * 1.3 + q.sway * 3)) ** 3;
        } else {
          q.y -= q.fall * dt;
          q.x += Math.sin(t * 0.9 + q.sway) * q.swayAmp * dt + 0.12 * dt;
          q.z += Math.cos(t * 0.7 + q.sway) * q.swayAmp * 0.6 * dt;
          rot[i] += q.spin * dt;
          if (q.y < box.y0) { q.y = box.y1; q.x = box.x0 + Math.random() * (box.x1 - box.x0); q.z = box.z0 + Math.random() * (box.z1 - box.z0); }
          alpha[i] = Math.min(1, (q.y - box.y0) * 4) * Math.min(1, (box.y1 - q.y) * 2);
        }
        pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      if (kind !== 'firefly') geo.attributes.aRot.needsUpdate = true;
    });
    return points;
  }

  // ---------------------------------------------------------------- ball trail: a camera-facing ribbon
  const TN = 30;
  const trail = {
    pts: Array.from({ length: TN }, () => new THREE.Vector3()), count: 0,
    pos: new Float32Array(TN * 2 * 3), col: new Float32Array(TN * 2 * 3),
    heat: 0, width: 0.03, on: false,
  };
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trail.pos, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trail.col, 3).setUsage(THREE.DynamicDrawUsage));
  const trailIndex = [];
  for (let i = 0; i < TN - 1; i++) trailIndex.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  trailGeo.setIndex(trailIndex);
  const trailMesh = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  trailMesh.frustumCulled = false;
  trailMesh.renderOrder = 5;
  scene.add(trailMesh);
  const tv = new THREE.Vector3(), tdir = new THREE.Vector3(), tside = new THREE.Vector3();
  const COOL = [0.9, 0.82, 0.62], HOT = [2.6, 0.9, 0.25];
  /** Feed the ball position once per frame; heat 0..1 colours it from warm white to fire. */
  function updateTrail(position, visible, heat, width) {
    if (!visible) { trail.count = 0; trail.on = false; trailMesh.visible = false; return; }
    trail.heat += (heat - trail.heat) * 0.2;
    trail.width = width;
    if (!trail.on) { trail.count = 0; trail.on = true; }
    for (let i = Math.min(trail.count, TN - 1); i > 0; i--) trail.pts[i].copy(trail.pts[i - 1]);
    trail.pts[0].copy(position);
    trail.count = Math.min(TN, trail.count + 1);
    trailMesh.visible = trail.count > 2;
    const n = trail.count;
    for (let i = 0; i < TN; i++) {
      const k = Math.min(i, n - 1);
      const p = trail.pts[k];
      const prev = trail.pts[Math.max(0, k - 1)], next = trail.pts[Math.min(n - 1, k + 1)];
      tdir.subVectors(prev, next);
      tv.subVectors(camera.position, p);
      tside.crossVectors(tdir, tv);
      if (tside.lengthSq() < 1e-10) tside.set(0, 1, 0); else tside.normalize();
      const f = i < n ? 1 - i / (n - 1 || 1) : 0;
      const w = trail.width * (0.25 + 0.75 * f);
      const j = i * 6;
      trail.pos[j] = p.x + tside.x * w; trail.pos[j + 1] = p.y + tside.y * w; trail.pos[j + 2] = p.z + tside.z * w;
      trail.pos[j + 3] = p.x - tside.x * w; trail.pos[j + 4] = p.y - tside.y * w; trail.pos[j + 5] = p.z - tside.z * w;
      const a = f * f * (0.35 + 0.65 * trail.heat);
      for (let c = 0; c < 3; c++) {
        const v = (COOL[c] + (HOT[c] - COOL[c]) * trail.heat) * a;
        trail.col[j + c] = v; trail.col[j + 3 + c] = v;
      }
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  }

  Object.assign(api, {
    uniforms: U, bloom,
    setSize(w, h, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      U.uRes.value.set(w * pixelRatio, h * pixelRatio);
      pointUniforms.uScale.value = (h * pixelRatio) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    },
    /** dt may be slowed for slow motion; decays the one-shot uniforms too. */
    update(dt, realDt) {
      time += dt;
      updateShells(dt);
      updateSparks(dt, time);
      updateConfetti(dt, time);
      for (const fn of updaters) fn(dt, time);
      U.uTime.value = time;
      U.uFlash.value *= Math.exp(-realDt * 7);
      U.uPunch.value *= Math.exp(-realDt * 6);
      pointUniforms.uScale.value = (renderer.domElement.height) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    },
    render() { composer.render(); },
    spark, sphereBurst, createSteam, createDrift, updateTrail,
    confetti: emitConfetti,
    flash(v) { U.uFlash.value = Math.max(U.uFlash.value, v); },
    punch(v) { U.uPunch.value = Math.max(U.uPunch.value, v); },
    /** Sparks where a racket meets the ball; dir = +1 when the ball leaves towards +x. */
    hitBurst(x, y, z, color, dir, power) {
      const n = Math.round(14 + power * 40);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 1.6 * (0.6 + power);
        spark(x, y, z, dir * (0.5 + Math.random() * 2.2) * (0.5 + power), Math.sin(a) * r, Math.cos(a) * r,
          color[0] * 5, color[1] * 5, color[2] * 5, 0.22 + Math.random() * 0.3, 0.035 + Math.random() * 0.04, 3, 4, Math.random() < 0.3 ? 1 : 0);
      }
    },
    /** A flat puff of dust where the ball touches the table, a rail or the floor. */
    puff(x, y, z, strength = 1) {
      const n = Math.round(7 * strength + 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 0.25 + Math.random() * 0.5;
        spark(x, y, z, Math.cos(a) * s, 0.15 + Math.random() * 0.25, Math.sin(a) * s, 1.3, 1.15, 0.9, 0.18 + Math.random() * 0.18, 0.03, 4, 0.5, 0);
      }
    },
    /** A shell from behind the garden; with the default speed it bursts 3-6 m above y0. */
    firework(x, z, y0 = 2, vy = 6.2 + Math.random() * 2.4) {
      shells.push({ x, y: y0, z, vx: (Math.random() - 0.5) * 1.2, vy, color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)] });
    },
    reset() {
      shells.length = 0;
      sp.life.fill(0); cf.life.fill(0); cf.live = 0.1;
      for (let i = 0; i < CN; i++) { dummy.scale.setScalar(0); dummy.updateMatrix(); confetti.setMatrixAt(i, dummy.matrix); }
      confetti.instanceMatrix.needsUpdate = true;
      U.uFlash.value = 0; U.uPunch.value = 0;
    },
  });
  return api;
}
