// fx.js — HDR post-processing chain and particle systems (confetti, sparks, speed lines, motes).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 }, uSpeed: { value: 0 }, uHit: { value: 0 }, uFlash: { value: 0 },
    uExhaust: { value: 0 }, uFade: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uSpeed, uHit, uFlash, uExhaust, uFade;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(uRes.x / uRes.y, 1.0));
      // radial motion blur: the vanishing point stays sharp, the periphery streaks
      float blur = (uSpeed * uSpeed * 0.055 + uHit * 0.04) * smoothstep(0.1, 0.85, r);
      vec3 col = vec3(0.0); float tot = 0.0;
      for (int i = 0; i < 7; i++) {
        float t = float(i) / 6.0;
        float w = 1.0 - t * 0.55;
        col += texture2D(tDiffuse, 0.5 + c * (1.0 - blur * t)).rgb * w;
        tot += w;
      }
      col /= tot;
      float ab = (0.0008 + uSpeed * 0.0011 + uHit * 0.012) * r;
      col.r = mix(col.r, texture2D(tDiffuse, 0.5 + c * (1.0 + ab)).r, 0.6);
      col.b = mix(col.b, texture2D(tDiffuse, 0.5 + c * (1.0 - ab)).b, 0.6);
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, 1.1);
      col *= mix(vec3(0.94, 0.98, 1.08), vec3(1.05, 1.0, 0.95), smoothstep(0.0, 0.6, lum));
      col = mix(col, vec3(lum) * vec3(0.9, 0.95, 1.1), uExhaust * 0.55);
      float vig = 1.0 - smoothstep(0.3, 1.05, r);
      col *= mix(1.0, vig, min(1.0, 0.5 + uExhaust * 0.35 + uSpeed * 0.15));
      col += vec3(0.9, 0.05, 0.1) * uHit * smoothstep(0.38, 1.0, r) * 0.7;
      col += vec3(uFlash);
      col *= 1.0 - uFade;
      col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.02 * (0.4 + lum);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export function createFx({ renderer, scene }) {
  // One NaN or runaway-bright pixel would be smeared across the whole frame by the
  // bloom blur, so scrub the HDR buffer before it gets there.
  const SanitizeShader = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        if (!(c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0)) c = vec3(0.0);
        gl_FragColor = vec4(min(c, vec3(48.0)), 1.0);
      }`,
  };
  let time = 0;

  /** A full post-processing chain + speed lines for one camera (solo: one view, VS: two side by side). */
  function createView(camera) {
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ShaderPass(SanitizeShader));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(4, 4), 0.5, 0.6, 1.05));
    const finalPass = new ShaderPass(FinalShader);
    composer.addPass(finalPass);
    composer.addPass(new OutputPass());
    const U = finalPass.uniforms;
    return {
      camera, composer, uniforms: U, lines: makeLines(),
      setSize(w, h, pixelRatio) {
        composer.setPixelRatio(pixelRatio);
        composer.setSize(w, h);
        U.uRes.value.set(w * pixelRatio, h * pixelRatio);
      },
      /** Render into the canvas region starting at x (CSS px), w x h. */
      render(x, w, h) {
        U.uTime.value = time;
        pointUniforms.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
        renderer.setViewport(x, 0, w, h);
        renderer.setScissor(x, 0, w, h);
        composer.render();
      },
    };
  }

  // ---------------------------------------------------------------- sparks (fireworks, fountains, gate burst)
  const MAX = 5000;
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
  const pointUniforms = { uScale: { value: 500 } };
  const pointShader = {
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
  };
  const sparks = new THREE.Points(spGeo, new THREE.ShaderMaterial(pointShader));
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

  // Fireworks: shells rise from behind the far stand and burst.
  const shells = [];
  const fountains = [];
  const FW_COLORS = [[1.0, 0.82, 0.3], [0.2, 0.9, 1.0], [1.0, 0.25, 0.45], [0.7, 1.0, 0.25], [0.75, 0.45, 1.0], [1.0, 1.0, 1.0]];
  const api = { onFireworkBurst: null };
  function burst(x, y, z, color) {
    const n = 170;
    const speed = 15 + Math.random() * 9;
    for (let i = 0; i < n; i++) {
      const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
      const s = speed * (0.82 + Math.random() * 0.3);
      const white = Math.random() < 0.18;
      const c = white ? [1, 1, 1] : color;
      spark(x, y, z, Math.sin(th) * Math.cos(ph) * s, Math.cos(th) * s, Math.sin(th) * Math.sin(ph) * s,
        c[0] * 5, c[1] * 5, c[2] * 5, 1.5 + Math.random() * 1.1, 1.5, 1.25, 3.2, Math.random() < 0.3 ? 1 : 0);
    }
    for (let i = 0; i < 26; i++) {
      const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2;
      const s = speed * 0.4 * Math.random();
      spark(x, y, z, Math.sin(th) * Math.cos(ph) * s, Math.cos(th) * s, Math.sin(th) * Math.sin(ph) * s, 6, 5.5, 4.5, 2.4 + Math.random(), 1.0, 0.8, 2.2, 1);
    }
    if (api.onFireworkBurst) api.onFireworkBurst(x, y, z);
  }
  function updatePyro(dt) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.vy -= 11 * dt; s.y += s.vy * dt; s.x += s.vx * dt;
      spark(s.x, s.y, s.z, (Math.random() - 0.5) * 1.5, -2, (Math.random() - 0.5) * 1.5, 3.5, 2.6, 1.4, 0.5, 0.8, 1, 2);
      if (s.vy < 3) { burst(s.x, s.y, s.z, s.color); shells.splice(i, 1); }
    }
    for (let i = fountains.length - 1; i >= 0; i--) {
      const f = fountains[i];
      f.t -= dt;
      for (let n = 0; n < 9; n++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.14;
        const v = 9 + Math.random() * 6;
        spark(f.x, 0.3, f.z, Math.cos(a) * r * v, v, Math.sin(a) * r * v, 6, 4.2, 1.8, 0.7 + Math.random() * 0.6, 0.11, 0.4, 13, Math.random() < 0.4 ? 1 : 0);
      }
      if (f.t <= 0) fountains.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- confetti
  const CN = 900;
  const confetti = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.075, 0.13),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, metalness: 0.15, emissive: 0xffffff, emissiveIntensity: 0.0 }),
    CN,
  );
  confetti.frustumCulled = false;
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const cf = {
    pos: new Float32Array(CN * 3), vel: new Float32Array(CN * 3), axis: new Float32Array(CN * 3),
    ang: new Float32Array(CN), spin: new Float32Array(CN), life: new Float32Array(CN), seed: new Float32Array(CN), next: 0, live: 0,
  };
  const CF_COLORS = [0xffd34d, 0xffffff, 0x22e3ff, 0xb6ff3c, 0xff3d6e, 0xffa01e].map((c) => new THREE.Color(c));
  const dummy = new THREE.Object3D();
  const axisV = new THREE.Vector3();
  dummy.scale.setScalar(0); dummy.updateMatrix();
  for (let i = 0; i < CN; i++) { confetti.setMatrixAt(i, dummy.matrix); confetti.setColorAt(i, CF_COLORS[i % CF_COLORS.length]); }
  scene.add(confetti);
  function emitConfetti(x, y, z, n, { vx = 0, vy = 7, vz = 0, spread = 3.5 } = {}) {
    for (let k = 0; k < n; k++) {
      const i = cf.next; cf.next = (cf.next + 1) % CN;
      cf.pos[i * 3] = x + (Math.random() - 0.5) * 0.6; cf.pos[i * 3 + 1] = y + Math.random() * 0.5; cf.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
      cf.vel[i * 3] = vx + (Math.random() - 0.5) * spread * 2; cf.vel[i * 3 + 1] = vy * (0.5 + Math.random() * 0.8); cf.vel[i * 3 + 2] = vz + (Math.random() - 0.5) * spread * 2;
      axisV.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      cf.axis[i * 3] = axisV.x; cf.axis[i * 3 + 1] = axisV.y; cf.axis[i * 3 + 2] = axisV.z;
      cf.ang[i] = Math.random() * 6; cf.spin[i] = 4 + Math.random() * 12; cf.life[i] = 7 + Math.random() * 5; cf.seed[i] = Math.random() * 100;
    }
    cf.live = Math.max(cf.live, 12);
  }
  function updateConfetti(dt, t) {
    if (cf.live <= 0) return;
    cf.live -= dt;
    for (let i = 0; i < CN; i++) {
      if (cf.life[i] <= 0) continue;
      cf.life[i] -= dt;
      const j = i * 3;
      if (cf.pos[j + 1] > 0.015) {
        const k = Math.max(0, 1 - 1.6 * dt);
        cf.vel[j] = cf.vel[j] * k + Math.sin(t * 3.1 + cf.seed[i]) * 2.2 * dt;
        cf.vel[j + 1] = cf.vel[j + 1] * k - 5.2 * dt;
        cf.vel[j + 2] = cf.vel[j + 2] * k + Math.cos(t * 2.7 + cf.seed[i]) * 2.2 * dt;
        cf.pos[j] += cf.vel[j] * dt; cf.pos[j + 1] += cf.vel[j + 1] * dt; cf.pos[j + 2] += cf.vel[j + 2] * dt;
        cf.ang[i] += cf.spin[i] * dt;
        if (cf.pos[j + 1] <= 0.015) { cf.pos[j + 1] = 0.012; cf.axis[j] = 1; cf.axis[j + 1] = 0; cf.axis[j + 2] = 0; cf.ang[i] = Math.PI / 2; }
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

  // ---------------------------------------------------------------- speed lines + floating motes
  const LN = 150;
  /** Speed streaks around one runner; each view owns a set and shows it only in its own pass. */
  function makeLines() {
    const pos = new Float32Array(LN * 6);
    const seeds = [];
    for (let i = 0; i < LN; i++) {
      const a = Math.random() * Math.PI * 2, r = 2.3 + Math.random() * 6.5;
      seeds.push({ x: Math.cos(a) * r, y: Math.max(0.15, 1.7 + Math.sin(a) * r * 0.75), z: -Math.random() * 60 + 6 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.75, 0.9, 1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const mesh = new THREE.LineSegments(geo, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    return {
      mesh, on: false,
      update(dt, x, rigZ, speed) {
        const target = Math.pow(Math.min(1, Math.max(0, (speed - 4.5) / 7.5)), 1.4) * 0.6;
        mat.opacity += (target - mat.opacity) * Math.min(1, dt * 6);
        this.on = mat.opacity > 0.01;
        if (!this.on) return;
        const len = 0.2 + speed * 0.13;
        for (let i = 0; i < LN; i++) {
          const s = seeds[i];
          s.z += speed * dt;
          if (s.z > 6) s.z -= 60;
          const j = i * 6;
          pos[j] = s.x; pos[j + 1] = s.y; pos[j + 2] = s.z;
          pos[j + 3] = s.x; pos[j + 4] = s.y; pos[j + 5] = s.z - len;
        }
        geo.attributes.position.needsUpdate = true;
        mesh.position.set(x, 0, rigZ);
      },
    };
  }
  {
    const MN = 700;
    const mp = new Float32Array(MN * 3), mc = new Float32Array(MN * 3), ms = new Float32Array(MN);
    for (let i = 0; i < MN; i++) {
      mp[i * 3] = (Math.random() - 0.5) * 30; mp[i * 3 + 1] = 0.3 + Math.random() * 8; mp[i * 3 + 2] = 12 - Math.random() * 150;
      const b = 0.25 + Math.random() * 0.5;
      mc[i * 3] = b * 0.85; mc[i * 3 + 1] = b * 0.92; mc[i * 3 + 2] = b * 1.1;
      ms[i] = 0.02 + Math.random() * 0.035;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(mc, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(ms, 1));
    const motes = new THREE.Points(g, new THREE.ShaderMaterial(pointShader));
    motes.frustumCulled = false;
    scene.add(motes);
  }

  Object.assign(api, {
    createView,
    setCanvasSize(w, h, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
    },
    /** Particles, once per frame. fxDt may be slowed down for slow-motion. */
    update(fxDt) {
      time += fxDt;
      updatePyro(fxDt);
      updateSparks(fxDt, time);
      updateConfetti(fxDt, time);
    },
    confetti: emitConfetti,
    firework(x, z, y0 = 26) {
      shells.push({ x, y: y0, z, vx: (Math.random() - 0.5) * 5, vy: 30 + Math.random() * 9, color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)] });
    },
    fountain(x, z, seconds = 2.4) { fountains.push({ x, z, t: seconds }); },
    gateShatter(z, halfWidth) {
      for (let i = 0; i < 260; i++) {
        const x = (Math.random() * 2 - 1) * halfWidth, y = Math.random() * 3.2;
        const near = Math.exp(-Math.abs(x) * 0.6);
        spark(x, y, z, (Math.random() - 0.5) * 6 + x * 0.8, 1 + Math.random() * 5, -(6 + Math.random() * 16) * (0.4 + near),
          0.5 * 4, 2.6 * (0.6 + Math.random()), 4.2, 0.5 + Math.random() * 0.8, 0.09, 1.6, 5, Math.random() < 0.3 ? 1 : 0);
      }
    },
    hitSparks(x, y, z) {
      for (let i = 0; i < 40; i++) {
        spark(x + (Math.random() - 0.5) * 1.1, y + (Math.random() - 0.5) * 0.2, z, (Math.random() - 0.5) * 7, Math.random() * 5, -(3 + Math.random() * 9),
          5, 3.2 * Math.random() + 1, 0.6, 0.25 + Math.random() * 0.4, 0.05, 1.2, 12, 0);
      }
    },
    reset() {
      shells.length = 0; fountains.length = 0;
      sp.life.fill(0); cf.life.fill(0); cf.live = 0.1;
      for (let i = 0; i < CN; i++) { dummy.scale.setScalar(0); dummy.updateMatrix(); confetti.setMatrixAt(i, dummy.matrix); }
      confetti.instanceMatrix.needsUpdate = true;
    },
  });
  return api;
}
