// audio.js — everything you hear, synthesised with Web Audio (no sound files).
//
// The music is driven by the race clock, not by wall time: main.js calls
// tick(simTime) every frame and the 16th notes that fall inside the next 0.14 s
// are scheduled. The hammers and blink bridges keep the same clock (RULES.BEAT),
// so a hammer always lands on a beat, even after a pause or a hit-stop.
// The sound is that of an old game console: square waves for the tune and the
// harmony, a triangle wave for the bass, noise for the drums. The tune is this
// game's own. Each zone adds a voice; collecting coins plays a rising scale.

const BEAT = 0.5, STEP = BEAT / 4;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// two bars each: C, Am, F, G
const CHORDS = [
  { bass: 36, arp: [60, 64, 67, 72] },
  { bass: 33, arp: [57, 60, 64, 69] },
  { bass: 29, arp: [53, 57, 60, 65] },
  { bass: 31, arp: [55, 59, 62, 67] },
];
// a bouncing bass: root, octave, fifth
const BASS_STEPS = { 0: 0, 2: 12, 4: 0, 6: 12, 8: 7, 10: 12, 12: 0, 14: 12 };
const ARP_ORDER = [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3];
// the tune of the stage, eight bars (0 = rest)
const LEAD = [
  [67, 0, 72, 0, 76, 0, 79, 0, 76, 0, 0, 72, 74, 0, 76, 0],
  [72, 0, 0, 0, 67, 0, 0, 0, 0, 0, 64, 0, 67, 0, 72, 0],
  [69, 0, 72, 0, 76, 0, 81, 0, 79, 0, 0, 76, 72, 0, 69, 0],
  [72, 0, 0, 0, 0, 0, 69, 0, 72, 0, 74, 0, 76, 0, 0, 0],
  [77, 0, 0, 76, 77, 0, 81, 0, 84, 0, 0, 81, 77, 0, 0, 0],
  [72, 0, 77, 0, 81, 0, 0, 0, 79, 0, 77, 0, 76, 0, 72, 0],
  [74, 0, 0, 71, 74, 0, 79, 0, 83, 0, 0, 79, 74, 0, 71, 0],
  [74, 0, 79, 0, 83, 0, 86, 0, 83, 0, 79, 0, 74, 0, 79, 0],
];
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98];

export function createAudio() {
  let ctx = null, master = null, musicBus = null, sfxBus = null, echo = null, noise = null;
  let volume = 0.85, muted = false;
  const music = { on: false, next: 0, last: 0, zone: 0, fever: false, level: 1 };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp).connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    // a dotted-eighth echo for the arpeggio and the tune
    echo = ctx.createDelay(1); echo.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    echo.connect(fb).connect(echo); echo.connect(wet).connect(musicBus);
    const len = ctx.sampleRate;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    applyVolume();
    return ctx;
  }
  function applyVolume() { if (master) master.gain.value = muted ? 0 : volume; }

  // ---------------------------------------------------------------- building blocks
  /** One oscillator with an attack/decay envelope. Returns the gain node (already connected). */
  function tone(when, { f, f2 = null, type = 'sine', gain = 0.2, attack = 0.004, dur = 0.2, bus = sfxBus, slide = null, cutoff = null, q = 1, detune = 0 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, when); o.detune.value = detune;
    if (f2 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), when + (slide || dur));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    let node = o;
    if (cutoff) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = q; o.connect(lp); node = lp; }
    node.connect(g).connect(bus);
    o.start(when); o.stop(when + dur + 0.03);
    return g;
  }
  function hiss(when, { type = 'highpass', freq = 6000, q = 0.8, gain = 0.2, dur = 0.05, bus = sfxBus, freq2 = null }) {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, when); fl.Q.value = q;
    if (freq2 != null) fl.frequency.exponentialRampToValueAtTime(freq2, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(fl).connect(g).connect(bus);
    src.start(when, Math.random() * 0.9); src.stop(when + dur + 0.03);
  }
  const now = () => ctx.currentTime + 0.005;

  // ---------------------------------------------------------------- music
  function playStep(n, when) {
    const bar = Math.floor(n / 16) % 8, st = n % 16;
    const chord = CHORDS[Math.floor(bar / 2)];
    const z = music.zone, fever = music.fever, k = music.level;
    const stone = z === 2 && !fever;          // the stone gate: lower, heavier, no tune
    // drums: noise, as on an old console
    if (st % 4 === 0) { tone(when, { f: 160, f2: 50, type: 'triangle', gain: 0.7 * k, dur: 0.16, slide: 0.1, bus: musicBus }); }
    if (st === 4 || st === 12) hiss(when, { type: 'bandpass', freq: stone ? 1100 : 2400, q: 0.6, gain: 0.3 * k, dur: 0.11, bus: musicBus });
    if (st % 2 === 0 ? st % 4 === 2 : fever || z === 3) hiss(when, { freq: 8000, gain: (st % 4 === 2 ? 0.1 : 0.05) * k, dur: 0.03, bus: musicBus });
    if (stone && (st === 6 || st === 14)) tone(when, { f: 110, f2: 60, type: 'triangle', gain: 0.4 * k, dur: 0.16, bus: musicBus });
    // bass: a triangle wave that bounces
    if (st in BASS_STEPS) tone(when, { f: mtof(chord.bass + BASS_STEPS[st] - (stone ? 0 : 0)), type: 'triangle', gain: 0.5 * k, dur: stone ? 0.2 : 0.11, bus: musicBus });
    // harmony: a quiet square wave running up the chord
    if (z >= 1 || fever ? true : st % 2 === 0) {
      const m = chord.arp[ARP_ORDER[st]] + (fever ? 12 : 0) - (stone ? 12 : 0);
      tone(when, { f: mtof(m), type: 'square', gain: (z >= 1 || fever ? 0.045 : 0.03) * k, dur: 0.07, cutoff: 3500, bus: musicBus });
    }
    // the tune: from the start, an octave up in the last zone and in fever
    if (!stone && LEAD[bar][st]) {
      const f = mtof(LEAD[bar][st] + (fever ? 12 : 0));
      let len = 1;
      while (st + len < 16 && !LEAD[bar][st + len] && len < 4) len++;
      const g = tone(when, { f, type: 'square', gain: (music.tune || z === 3 || fever ? 0.085 : 0.06) * k, attack: 0.006, dur: STEP * len * 0.9 + 0.03, cutoff: 5000, bus: musicBus });
      if (z >= 1) g.connect(echo);
      if (z === 3 || fever) tone(when, { f: f * 2, type: 'square', gain: 0.02 * k, dur: STEP * len * 0.6, cutoff: 6000, bus: musicBus });
    }
  }
  /** Schedule the music up to a little past `clock` (seconds; the race clock while racing). */
  function tick(clock) {
    if (!ctx || !music.on || ctx.state !== 'running') return;
    if (clock < music.last - 0.3 || music.next * STEP < clock - 0.4) music.next = Math.ceil(clock / STEP);   // the clock was reset, or we fell behind
    music.last = clock;
    let guard = 0;
    while (music.next * STEP <= clock + 0.14 && guard++ < 12) {
      playStep(music.next, ctx.currentTime + Math.max(0.005, music.next * STEP - clock));
      music.next++;
    }
  }

  // ---------------------------------------------------------------- sound effects
  let streak = 0, lastNote = -9;
  const sfx = {
    jump() { const t = now(); tone(t, { f: 262, f2: 880, type: 'square', gain: 0.1, dur: 0.17, slide: 0.15, cutoff: 4500 }); },
    land(impact = 5) { const t = now(); const k = Math.min(1, impact / 12); tone(t, { f: 110, f2: 55, type: 'sine', gain: 0.25 + 0.3 * k, dur: 0.12 }); hiss(t, { type: 'lowpass', freq: 700, gain: 0.12 + 0.12 * k, dur: 0.08 }); },
    step(side, dash = false) { const t = now(); hiss(t, { type: 'bandpass', freq: (side ? 1500 : 1250) * (dash ? 1.5 : 1), q: 1.2, gain: dash ? 0.11 : 0.07, dur: 0.035 }); },
    /** Top gear: a rising whoosh. */
    dash() { const t = now(); hiss(t, { type: 'bandpass', freq: 600, freq2: 5200, q: 1.4, gain: 0.3, dur: 0.38 }); [79, 84, 88].forEach((m, i) => tone(t + i * 0.05, { f: mtof(m), type: 'square', gain: 0.09, dur: 0.1, cutoff: 5000 })); },
    /** Coins climb a scale while they keep coming. */
    note() {
      const t = now();
      streak = ctx.currentTime - lastNote < 0.9 ? Math.min(PENTA.length - 1, streak + 1) : 0;
      lastNote = ctx.currentTime;
      const f = mtof(PENTA[streak]);
      tone(t, { f, type: 'square', gain: 0.1, dur: 0.07, cutoff: 6000 });
      tone(t + 0.06, { f: f * 1.5, type: 'square', gain: 0.1, dur: 0.2, cutoff: 6000 });
    },
    /** A block breaks: a crunch, then its coins. */
    bell(fever = false) {
      const t = now();
      hiss(t, { type: 'bandpass', freq: 900, freq2: 300, q: 0.8, gain: 0.35, dur: 0.12 });
      tone(t, { f: 220, f2: 90, type: 'square', gain: 0.16, dur: 0.1, cutoff: 1500 });
      const seq = fever ? [72, 76, 79, 84, 88, 91] : [79, 84, 88];
      seq.forEach((m, i) => tone(t + 0.07 + i * 0.06, { f: mtof(m), type: 'square', gain: 0.1, dur: 0.14, cutoff: 6000 }));
    },
    stomp(combo = 1) {
      const t = now();
      tone(t, { f: 420, f2: 110, type: 'square', gain: 0.2, dur: 0.14, cutoff: 1800 });
      hiss(t, { type: 'bandpass', freq: 1500, gain: 0.2, dur: 0.07 });
      const f = mtof(72 + Math.min(12, (combo - 1) * 4));
      tone(t + 0.05, { f, f2: f * 1.5, type: 'triangle', gain: 0.22, dur: 0.22, slide: 0.18 });
    },
    blast() { const t = now(); hiss(t, { type: 'bandpass', freq: 500, freq2: 4000, gain: 0.25, dur: 0.22 }); tone(t, { f: 200, f2: 900, type: 'sawtooth', gain: 0.12, dur: 0.2, cutoff: 3000 }); },
    hurt() { const t = now(); tone(t, { f: 330, f2: 70, type: 'sawtooth', gain: 0.3, dur: 0.38, cutoff: 1500 }); tone(t, { f: 311, f2: 66, type: 'square', gain: 0.14, dur: 0.38, cutoff: 1200 }); hiss(t, { type: 'lowpass', freq: 1200, gain: 0.2, dur: 0.12 }); },
    /** The fall has begun and cannot be stopped: a long cry going down, the air rushing past. */
    falling() {
      const t = now();
      tone(t, { f: 1150, f2: 150, type: 'triangle', gain: 0.24, dur: 1.15, slide: 1.1 });
      tone(t, { f: 1190, f2: 142, type: 'triangle', gain: 0.16, dur: 1.15, slide: 1.1 });       // a second voice, slightly off: it wavers
      tone(t, { f: 575, f2: 75, type: 'sawtooth', gain: 0.07, dur: 1.15, slide: 1.1, cutoff: 1400 });
      hiss(t, { type: 'bandpass', freq: 500, freq2: 3200, q: 1.2, gain: 0.22, dur: 1.1 });
    },
    /** The splash at the bottom, and then the sorry little tune everybody knows the meaning of. */
    fall() {
      const t = now();
      hiss(t, { type: 'lowpass', freq: 2600, freq2: 250, gain: 0.6, dur: 0.6 });
      tone(t, { f: 120, f2: 32, type: 'sine', gain: 0.85, dur: 0.5 });
      tone(t + 0.03, { f: 61, f2: 30, type: 'triangle', gain: 0.5, dur: 0.7 });
      // four notes sliding down, the last one long and sagging
      [[58, 0.34], [57, 0.34], [56, 0.34], [55, 1.2]].forEach(([m, len], i) => {
        const at = t + 0.5 + i * 0.36, f = mtof(m);
        tone(at, { f, f2: f * (i === 3 ? 0.84 : 0.97), type: 'sawtooth', gain: 0.2, attack: 0.03, dur: len, slide: len, cutoff: 900, q: 3 });
        tone(at, { f: f / 2, f2: f / 2 * (i === 3 ? 0.84 : 0.97), type: 'square', gain: 0.09, attack: 0.03, dur: len, slide: len, cutoff: 500 });
      });
    },
    /** Faster than can be handled: a nagging two-note alarm. */
    overspeed() { const t = now(); tone(t, { f: 1568, type: 'square', gain: 0.06, dur: 0.06, cutoff: 5000 }); tone(t + 0.09, { f: 1245, type: 'square', gain: 0.06, dur: 0.06, cutoff: 5000 }); },
    down() { const t = now(); [64, 60, 57, 52].forEach((m, i) => tone(t + i * 0.16, { f: mtof(m), type: 'triangle', gain: 0.24, dur: 0.3 })); },
    spring() { const t = now(); tone(t, { f: 90, f2: 60, type: 'sine', gain: 0.7, dur: 0.3 }); hiss(t, { type: 'bandpass', freq: 1800, gain: 0.3, dur: 0.12 }); tone(t + 0.02, { f: 180, f2: 1100, type: 'sine', gain: 0.22, dur: 0.6, slide: 0.55 }); },
    hammer(distance = 0) {
      const k = Math.max(0, 1 - distance / 45);
      if (k <= 0) return;
      const t = now();
      tone(t, { f: 70, f2: 30, type: 'sine', gain: 0.75 * k, dur: 0.35 });
      hiss(t, { type: 'lowpass', freq: 500, gain: 0.5 * k, dur: 0.2 });
      for (const f of [523, 784, 1245]) tone(t, { f, type: 'sine', gain: 0.035 * k, dur: 0.9 });
    },
    bump() { const t = now(); tone(t, { f: 130, f2: 80, type: 'square', gain: 0.14, dur: 0.09, cutoff: 600 }); },
    checkpoint() { const t = now(); [72, 79, 84].forEach((m, i) => tone(t + i * 0.09, { f: mtof(m), type: 'triangle', gain: 0.22, dur: 0.4 })); },
    fever() { const t = now(); [60, 64, 67, 72, 76, 79, 84, 88].forEach((m, i) => tone(t + i * 0.045, { f: mtof(m), type: 'square', gain: 0.13, dur: 0.2, cutoff: 3500 })); },
    feverEnd() { const t = now(); tone(t, { f: 700, f2: 180, type: 'triangle', gain: 0.14, dur: 0.35 }); },
    assist() { const t = now(); [67, 71, 74, 79, 83].forEach((m, i) => tone(t + i * 0.07, { f: mtof(m), type: 'sine', gain: 0.2, dur: 0.6 })); },
    cue(kind) {
      const t = now();
      if (kind === 'stop') { tone(t, { f: 440, type: 'square', gain: 0.12, dur: 0.09, cutoff: 1500 }); tone(t + 0.12, { f: 440, type: 'square', gain: 0.12, dur: 0.09, cutoff: 1500 }); }
      else if (kind === 'go') tone(t, { f: 660, f2: 990, type: 'triangle', gain: 0.18, dur: 0.18 });
      else if (kind === 'jump') tone(t, { f: 1320, type: 'sine', gain: 0.07, dur: 0.06 });
      else if (kind === 'dash') { tone(t, { f: 523, type: 'square', gain: 0.07, dur: 0.06, cutoff: 4000 }); tone(t + 0.08, { f: 784, type: 'square', gain: 0.07, dur: 0.09, cutoff: 4000 }); }      // up: faster
      else if (kind === 'slow') { tone(t, { f: 784, type: 'square', gain: 0.09, dur: 0.08, cutoff: 4000 }); tone(t + 0.1, { f: 523, type: 'square', gain: 0.09, dur: 0.14, cutoff: 4000 }); }    // down: slower
      else if (kind === 'ok') tone(t, { f: 1047, f2: 1568, type: 'triangle', gain: 0.1, dur: 0.12 });
    },
    count(final = false) { const t = now(); tone(t, { f: final ? 880 : 440, type: 'triangle', gain: 0.28, dur: final ? 0.6 : 0.16 }); },
    finale(dist = 3) {
      const t = now();
      hiss(t, { type: 'lowpass', freq: 900, gain: 0.35, dur: 0.25 });
      const n = Math.min(8, Math.max(2, Math.round(dist)));
      for (let i = 0; i < n; i++) tone(t + 0.1 + i * 0.07, { f: mtof(72 + [0, 2, 4, 7, 9, 12, 14, 16][i]), type: 'triangle', gain: 0.2, dur: 0.25 });
    },
    gong() { const t = now(); for (const [f, g, d] of [[98, 0.5, 3.5], [147, 0.3, 3], [196.5, 0.22, 2.5], [311, 0.12, 2], [466, 0.07, 1.5]]) tone(t, { f, f2: f * 0.985, type: 'sine', gain: g, dur: d, slide: d }); hiss(t, { type: 'bandpass', freq: 2500, q: 0.4, gain: 0.25, dur: 0.6 }); },
    fanfare() {
      const t = now() + 0.25;
      const seq = [[72, 0], [76, 0.14], [79, 0.28], [84, 0.42], [79, 0.63], [84, 0.77]];
      for (const [m, at] of seq) { tone(t + at, { f: mtof(m), type: 'sawtooth', gain: 0.16, dur: m === 84 && at > 0.7 ? 1.1 : 0.2, cutoff: 3000 }); tone(t + at, { f: mtof(m - 12), type: 'triangle', gain: 0.14, dur: 0.22 }); }
      for (const m of [60, 64, 67]) tone(t + 0.77, { f: mtof(m), type: 'sawtooth', gain: 0.08, dur: 1.2, cutoff: 1800 });
    },
  };
  // every effect is a no-op until the context exists and is running
  for (const key of Object.keys(sfx)) {
    const fn = sfx[key];
    sfx[key] = (...args) => { if (ctx && ctx.state === 'running' && !muted) { try { fn(...args); } catch { /* a failed sound never stops the game */ } } };
  }

  return {
    sfx, tick,
    /** Call from a user gesture (click / key): browsers only start audio then. */
    unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    startMusic({ zone = 0, level = 1, tune = false } = {}) { music.on = true; music.zone = zone; music.level = level; music.tune = tune; music.fever = false; music.last = 1e9; },
    stopMusic() { music.on = false; },
    setZone(z) { music.zone = z; },
    setFever(on) { music.fever = on; },
    setLevel(k) { music.level = k; },
    setVolume(v) { volume = v; applyVolume(); },
    setMuted(m) { muted = m; applyVolume(); },
    get muted() { return muted; },
  };
}
