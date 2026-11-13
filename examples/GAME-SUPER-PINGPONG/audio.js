// audio.js — everything you hear, synthesised with Web Audio:
//   - foley: racket, table, bamboo rail, floor, wooden clappers, taiko, wind chime, deer scarer
//   - a generative Japanese ensemble (koto, bass koto, bamboo flute, taiko, hand gong) in a
//     pentatonic scale, whose arrangement thickens as the rally grows
//   - garden ambience (water, night insects or wind)
// The crowd cheer and the referee whistle reuse the example's original mp3 files, and the
// original BGM tracks stay available as the "classic" music option.

const SCALE = [0, 2, 4, 7, 9];          // yo scale (major pentatonic)
const ROOT = 62;                        // D4
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const degreeToMidi = (deg) => ROOT + 12 * Math.floor(deg / 5) + SCALE[((deg % 5) + 5) % 5];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// four-bar harmony: bass note (MIDI) and the scale degrees that sound settled over it
const HARMONY = [
  { bass: 50, tones: [0, 2, 3] },   // D
  { bass: 47, tones: [4, 0, 2] },   // B
  { bass: 52, tones: [1, 3, 4] },   // E
  { bass: 45, tones: [3, 1, 4] },   // A
];
const RHYTHM_CALM = [[0, 6, 8, 12], [0, 4, 8, 10, 12], [0, 3, 6, 8, 12], [0, 8, 12, 14], [0, 4, 6, 8, 14]];
const RHYTHM_LIVELY = [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 8, 11, 14], [0, 2, 3, 4, 8, 10, 11, 12], [0, 4, 6, 7, 8, 12, 14], [0, 2, 4, 7, 8, 10, 12, 15]];

const SCENES = {
  title: { bpm: 80, gain: 1.15, lively: false, flute: 'long', drums: 0 },
  calib: { bpm: 76, gain: 0.7, lively: false, flute: 'none', drums: 0 },
  play: { bpm: 104, gain: 0.8, lively: true, flute: 'festival', drums: 1 },
  result: { bpm: 92, gain: 1.0, lively: false, flute: 'long', drums: 0.4 },
  off: { bpm: 90, gain: 0, lively: false, flute: 'none', drums: 0 },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmVolume = 0.7;
    this.sfxVolume = 0.8;
    this.bgmMode = 'wafu';       // wafu | classic | off
    this.scene = 'title';
    this.intensity = 0;          // 0..1, follows the rally
    this.season = 'autumn';
    this.step = 0;
    this.bar = 0;
    this.nextStep = 0;
    this.rand = mulberry32(20261112);
    this.motif = [];
    this.degree = 5;
    this.buffers = {};
    this.koto = new Map();
    this.legacy = null;
    this._timer = null;
    this._fakeNow = null;
  }

  get ready() { return !!this.ctx; }
  get now() { return this._fakeNow !== null ? this._fakeNow : this.ctx.currentTime; }

  /** Build the graph on `ctx` (an AudioContext, or an OfflineAudioContext for analysis). */
  init(ctx, { assets = true } = {}) {
    this.ctx = ctx;
    const master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    // a fast, steep second stage keeps stacked hits (match point, the win fanfare) under full scale
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -5; limiter.knee.value = 2; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.12;
    master.connect(comp).connect(limiter).connect(ctx.destination);
    this.master = master;
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.sfxBus.connect(master); this.musicBus.connect(master); this.ambBus.connect(master);
    // a wooden room: short, dark reverb shared by music and foley
    const reverb = ctx.createConvolver();
    reverb.buffer = this._impulse(1.5);
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    reverb.connect(wet).connect(master);
    const musicSend = ctx.createGain(); musicSend.gain.value = 0.42; this.musicBus.connect(musicSend).connect(reverb);
    const sfxSend = ctx.createGain(); sfxSend.gain.value = 0.2; this.sfxBus.connect(sfxSend).connect(reverb);
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 5.3; this.lfo.start();
    this._buildFoley();
    this._buildAmbience();
    this._applyVolumes();
    if (assets) this._loadAssets();
    this.nextStep = this.now + 0.1;
  }

  /** Create and start the real AudioContext; must be called from a user gesture. */
  async unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.init(new Ctx({ latencyHint: 'interactive' }));
      this._timer = setInterval(() => this.tick(), 25);
    }
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch { /* stays silent */ } }
    return true;
  }

  // ------------------------------------------------------------------ settings
  setVolumes({ bgm = this.bgmVolume, sfx = this.sfxVolume } = {}) { this.bgmVolume = bgm; this.sfxVolume = sfx; this._applyVolumes(); }
  setMuted(muted) { this.muted = muted; this._applyVolumes(); }
  setBgmMode(mode) { this.bgmMode = mode; this._applyVolumes(); this._syncLegacy(); }
  setScene(scene) {
    if (this.scene === scene) return;
    this.scene = scene;
    this.motif = [];
    this._applyVolumes();
    this._syncLegacy();
  }

  _applyVolumes() {
    // the plain <audio> tracks do not need an AudioContext, so set them first
    if (this.legacy) for (const el of Object.values(this.legacy)) el.volume = this.muted ? 0 : 0.16 * this.bgmVolume;
    if (!this.ctx) return;
    const t = this.now;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.sfxVolume * 0.8, t, 0.3);
    const scene = SCENES[this.scene] || SCENES.off;
    this.musicBus.gain.setTargetAtTime(this.bgmMode === 'wafu' ? scene.gain * this.bgmVolume : 0, t, 0.4);
  }

  /** The example's original BGM files, played as plain looping tracks. */
  _syncLegacy() {
    if (typeof Audio === 'undefined' || this._fakeNow !== null) return;
    const want = this.bgmMode === 'classic' ? (this.scene === 'play' ? 'a' : this.scene === 'result' ? 'b' : null) : null;
    if (want && !this.legacy) {
      this.legacy = { a: new Audio('BGMA.mp3'), b: new Audio('BGMB.mp3') };
      for (const el of Object.values(this.legacy)) { el.loop = true; el.preload = 'auto'; }
      this._applyVolumes();
    }
    if (!this.legacy) return;
    for (const [key, el] of Object.entries(this.legacy)) {
      if (key === want) { if (el.paused) el.play().catch(() => {}); } else if (!el.paused) { el.pause(); el.currentTime = 0; }
    }
  }

  async _loadAssets() {
    const load = async (name, file) => {
      try { this.buffers[name] = await this.ctx.decodeAudioData(await (await fetch(file)).arrayBuffer()); } catch { /* optional */ }
    };
    await Promise.all([load('cheer', 'sound-audience.mp3'), load('whistle', 'sound-whistle.mp3')]);
  }

  // ------------------------------------------------------------------ building blocks
  _impulse(seconds) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, n, sr);
    const r = mulberry32(77);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        lp += (0.22 + 0.5 * (1 - k)) * ((r() * 2 - 1) - lp);
        d[i] = lp * (1 - k) ** 2.6 * (i < 400 ? i / 400 : 1);
      }
    }
    return buf;
  }

  _noiseBuffer(seconds, color = 'white') {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const r = mulberry32(seconds * 1000 + (color === 'white' ? 1 : 2));
    let b = 0;
    for (let i = 0; i < n; i++) { const w = r() * 2 - 1; if (color === 'white') d[i] = w; else { b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5; } }
    return buf;
  }

  /**
   * A struck / knocked sound as a buffer: decaying sine partials plus a filtered noise click.
   * partials: [frequency, gain, decaySeconds, sweepTo?]
   */
  _struck(partials, { length = 0.4, click = 0.3, clickMs = 4, clickTone = 0.5 } = {}) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * length);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const r = mulberry32(Math.round(partials[0][0] * 7 + length * 1000));
    for (const [f, g, decay, sweepTo] of partials) {
      let phase = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const freq = sweepTo ? sweepTo + (f - sweepTo) * Math.exp(-t / (decay * 0.35)) : f;
        phase += (2 * Math.PI * freq) / sr;
        d[i] += Math.sin(phase) * g * Math.exp(-t / decay);
      }
    }
    const cn = Math.floor((sr * clickMs) / 1000);
    let lp = 0;
    for (let i = 0; i < cn * 4 && i < n; i++) { lp += clickTone * ((r() * 2 - 1) - lp); d[i] += lp * click * Math.exp(-i / cn); }
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0) for (let i = 0; i < n; i++) d[i] = (d[i] / peak) * (i > n - 200 ? (n - i) / 200 : 1);
    return buf;
  }

  /** Karplus-Strong plucked string, one buffer per pitch. */
  _pluck(midi, { duration = 2.6, damping = 0.9965, brightness = 0.62 } = {}) {
    const key = `${midi}:${duration}:${damping}:${brightness}`;
    if (this.koto.has(key)) return this.koto.get(key);
    const sr = this.ctx.sampleRate, n = Math.floor(sr * duration);
    const period = Math.max(2, Math.round(sr / hz(midi)));
    const line = new Float32Array(period);
    const r = mulberry32(midi * 13 + 5);
    let lp = 0;
    for (let i = 0; i < period; i++) { lp += brightness * ((r() * 2 - 1) - lp); line[i] = lp; }
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    let idx = 0, peak = 0;
    for (let i = 0; i < n; i++) {
      const next = (idx + 1) % period;
      d[i] = line[idx];
      line[idx] = damping * 0.5 * (line[idx] + line[next]);
      idx = next;
      if (Math.abs(d[i]) > peak) peak = Math.abs(d[i]);
    }
    for (let i = 0; i < n; i++) d[i] = (d[i] / (peak || 1)) * Math.min(1, i / 60) * (i > n - 2000 ? (n - i) / 2000 : 1);
    const entry = { buf, rate: hz(midi) / (sr / period) };   // playbackRate that corrects the rounded period
    this.koto.set(key, entry);
    return entry;
  }

  _play(buffer, { when = this.now, gain = 1, rate = 1, pan = 0, bus = this.sfxBus, lowpass = 0 } = {}) {
    if (!buffer) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    let node = src;
    if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; node.connect(f); node = f; }
    node.connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p).connect(bus); } else g.connect(bus);
    src.start(Math.max(when, ctx.currentTime));
    return src;
  }

  _noiseBurst({ when = this.now, duration = 0.2, gain = 0.2, from = 800, to = 2400, q = 1.2, pan = 0, type = 'bandpass', bus = this.sfxBus } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.buffers.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, when); f.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(gain, when + duration * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    src.connect(f).connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p).connect(bus); } else g.connect(bus);
    src.start(when, (when * 0.37) % 1.5); src.stop(when + duration + 0.05);
  }

  _kotoNote(midi, when, gain = 0.2, pan = 0, opts = {}) {
    const p = this._pluck(midi, opts);
    this._play(p.buf, { when, gain, rate: p.rate, pan, bus: opts.bus || this.musicBus });
  }

  /** Bamboo flute: sine + octave + breath noise, with a scoop into the note and vibrato. */
  _flute(midi, when, duration, gain = 0.1, pan = 0) {
    const ctx = this.ctx, f = hz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.06);
    g.gain.setTargetAtTime(gain * 0.75, when + 0.1, 0.2);
    g.gain.setTargetAtTime(0.0001, when + duration, 0.05);
    const o1 = ctx.createOscillator(); o1.type = 'sine';
    o1.frequency.setValueAtTime(f * 0.955, when); o1.frequency.exponentialRampToValueAtTime(f, when + 0.07);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, when);
    const g2 = ctx.createGain(); g2.gain.value = 0.22;
    const vib = ctx.createGain(); vib.gain.setValueAtTime(0, when); vib.gain.linearRampToValueAtTime(f * 0.012, when + Math.min(0.5, duration));
    this.lfo.connect(vib); vib.connect(o1.frequency);
    const breath = ctx.createBufferSource(); breath.buffer = this.buffers.noise; breath.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f * 2.1; bf.Q.value = 1.6;
    const bg = ctx.createGain(); bg.gain.value = 0.16;
    o1.connect(g); o2.connect(g2).connect(g); breath.connect(bf).connect(bg).connect(g);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p).connect(this.musicBus); } else g.connect(this.musicBus);
    const end = when + duration + 0.4;
    o1.start(when); o2.start(when); breath.start(when, (when * 0.61) % 1.5);
    o1.stop(end); o2.stop(end); breath.stop(end);
    o1.onended = () => { try { this.lfo.disconnect(vib); } catch { /* already gone */ } };
  }

  _buildFoley() {
    const B = this.buffers;
    B.noise = this._noiseBuffer(2, 'white');
    B.brown = this._noiseBuffer(4, 'brown');
    B.racketA = this._struck([[640, 1, 0.05], [1290, 0.5, 0.035], [2350, 0.2, 0.02]], { length: 0.25, click: 0.55, clickMs: 3, clickTone: 0.7 });
    B.racketB = this._struck([[760, 1, 0.05], [1530, 0.5, 0.035], [2700, 0.2, 0.02]], { length: 0.25, click: 0.55, clickMs: 3, clickTone: 0.7 });
    B.table = this._struck([[1950, 1, 0.024], [3150, 0.6, 0.018], [430, 0.35, 0.06]], { length: 0.2, click: 0.5, clickMs: 2, clickTone: 0.9 });
    B.rail = this._struck([[520, 1, 0.1], [1050, 0.55, 0.07], [1580, 0.28, 0.05]], { length: 0.4, click: 0.35, clickMs: 5, clickTone: 0.4 });
    B.floor = this._struck([[300, 1, 0.07], [940, 0.4, 0.04]], { length: 0.3, click: 0.4, clickMs: 6, clickTone: 0.3 });
    B.clack = this._struck([[1250, 1, 0.07], [2480, 0.7, 0.05], [3900, 0.35, 0.03]], { length: 0.3, click: 0.8, clickMs: 2, clickTone: 0.95 });
    B.don = this._struck([[150, 1, 0.34, 56], [300, 0.2, 0.08]], { length: 0.9, click: 0.45, clickMs: 12, clickTone: 0.12 });
    B.ka = this._struck([[820, 1, 0.035], [1720, 0.6, 0.03]], { length: 0.15, click: 0.7, clickMs: 2, clickTone: 0.9 });
    B.kane = this._struck([[2100, 1, 0.16], [3140, 0.7, 0.13], [4720, 0.5, 0.1], [5560, 0.3, 0.08]], { length: 0.5, click: 0.2, clickMs: 1, clickTone: 1 });
    B.chime = this._struck([[2637, 1, 1.1], [3540, 0.5, 0.8], [5290, 0.35, 0.5], [7100, 0.15, 0.3]], { length: 2.4, click: 0.12, clickMs: 1, clickTone: 1 });
    B.shishi = this._struck([[430, 1, 0.2], [870, 0.5, 0.14], [1320, 0.25, 0.09], [150, 0.6, 0.1]], { length: 0.8, click: 0.5, clickMs: 6, clickTone: 0.35 });
    B.boom = this._struck([[90, 1, 0.5, 38]], { length: 1.4, click: 0.9, clickMs: 40, clickTone: 0.06 });
  }

  _buildAmbience() {
    const ctx = this.ctx;
    // the bath's water inlet
    const water = ctx.createBufferSource(); water.buffer = this.buffers.brown; water.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 1300; wf.Q.value = 0.5;
    const wg = ctx.createGain(); wg.gain.value = 0.16;
    water.connect(wf).connect(wg).connect(this.ambBus); water.start();
    const wl = ctx.createOscillator(); wl.frequency.value = 0.21; const wlg = ctx.createGain(); wlg.gain.value = 0.05;
    wl.connect(wlg).connect(wg.gain); wl.start();
    this._insectsGain = ctx.createGain(); this._insectsGain.gain.value = 0.0;
    this._insectsGain.connect(this.ambBus);
    // bell crickets: a 4.1 kHz tone chopped at about 50 Hz, in phrases
    const sr = ctx.sampleRate, n = sr * 6;
    const buf = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      const f = ch === 0 ? 4100 : 3650;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const phrase = Math.max(0, Math.sin(2 * Math.PI * (t / (ch === 0 ? 2 : 3)) + ch)) ** 2;
        d[i] = Math.sin(2 * Math.PI * f * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (ch === 0 ? 52 : 37) * t)) * phrase * 0.5;
      }
    }
    const insects = ctx.createBufferSource(); insects.buffer = buf; insects.loop = true;
    insects.connect(this._insectsGain); insects.start();
    this.setSeason(this.season);
  }

  setSeason(season) {
    this.season = season;
    if (this._insectsGain) this._insectsGain.gain.value = season === 'autumn' ? 0.05 : season === 'summer' ? 0.035 : 0;
  }

  // ------------------------------------------------------------------ foley API
  /** Racket meets ball. pan -1..1, power 0..1. */
  hit(side, power = 0.5, smash = false, pan = 0) {
    if (!this.ctx) return;
    const t = this.now;
    this._play(side === 0 ? this.buffers.racketA : this.buffers.racketB, { when: t, gain: 0.55 + power * 0.4, rate: 0.97 + this.rand() * 0.06 + power * 0.05, pan });
    if (smash) {
      this._play(this.buffers.don, { when: t, gain: 0.8, rate: 1.25, pan });
      this._noiseBurst({ when: t, duration: 0.22, gain: 0.22, from: 500, to: 3200, pan });
      this._play(this.buffers.clack, { when: t, gain: 0.45, rate: 0.9, pan });
    }
  }
  bounce(pan = 0, speed = 1) { if (this.ctx) this._play(this.buffers.table, { gain: clamp(0.3 + speed * 0.12, 0.3, 0.7), rate: 0.96 + this.rand() * 0.08, pan }); }
  rail(pan = 0) { if (this.ctx) this._play(this.buffers.rail, { gain: 0.5, rate: 0.95 + this.rand() * 0.1, pan }); }
  floor(pan = 0, strength = 1) { if (this.ctx) this._play(this.buffers.floor, { gain: clamp(0.15 + strength * 0.14, 0.12, 0.5), rate: 0.9 + this.rand() * 0.2, pan }); }
  guard(pan = 0) { if (!this.ctx) return; this._play(this.buffers.shishi, { gain: 0.7, rate: 1.3, pan }); this._play(this.buffers.rail, { gain: 0.5, rate: 0.8, pan }); }
  serve() { if (this.ctx) this._play(this.buffers.ka, { gain: 0.35 }); }

  /** Countdown clack (3, 2, 1) and the double clack + drum that starts the rally. */
  count() { if (this.ctx) this._play(this.buffers.clack, { gain: 0.5 }); }
  go() {
    if (!this.ctx) return;
    const t = this.now;
    this._play(this.buffers.clack, { when: t, gain: 0.55 });
    this._play(this.buffers.clack, { when: t + 0.11, gain: 0.55, rate: 1.06 });
    this._play(this.buffers.don, { when: t + 0.11, gain: 0.7 });
  }

  /** A point is decided: wind chime, a koto phrase rising for the scorer, the crowd. */
  point(scorerPan = 0, big = false) {
    if (!this.ctx) return;
    const t = this.now;
    this._play(this.buffers.chime, { when: t, gain: 0.3, pan: scorerPan });
    [5, 7, 8, 10].forEach((deg, i) => this._kotoNote(degreeToMidi(deg), t + 0.05 + i * 0.075, 0.2, scorerPan * 0.6, { bus: this.sfxBus }));
    this._play(this.buffers.don, { when: t + 0.02, gain: 0.45 });
    this.cheer(big ? 0.5 : 0.36);
  }
  cheer(gain = 0.5) { if (this.ctx && this.buffers.cheer) this._play(this.buffers.cheer, { gain, rate: 0.96 + this.rand() * 0.08 }); }
  milestone(rally) {
    if (!this.ctx) return;
    const t = this.now;
    const n = clamp(3 + Math.floor(rally / 10), 3, 6);
    for (let i = 0; i < n; i++) this._kotoNote(degreeToMidi(5 + i * 2), t + i * 0.06, 0.2, 0, { bus: this.sfxBus });
    this._play(this.buffers.kane, { when: t, gain: 0.25 });
    this._play(this.buffers.don, { when: t, gain: 0.7 });
    if (rally >= 10) this.cheer(0.35);
  }
  matchPoint() {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < 7; i++) this._play(this.buffers.don, { when: t + i * (0.2 - i * 0.02), gain: 0.35 + i * 0.07, rate: 1.1 });
  }
  item(kind, pan = 0) {
    if (!this.ctx) return;
    const t = this.now;
    if (kind === 'spawn') { this._kotoNote(degreeToMidi(12), t, 0.18, pan, { bus: this.sfxBus }); this._play(this.buffers.kane, { when: t, gain: 0.1, rate: 1.3, pan }); }
    else if (kind === 'get') { [7, 9, 10, 12].forEach((deg, i) => this._kotoNote(degreeToMidi(deg), t + i * 0.055, 0.22, pan, { bus: this.sfxBus })); this._play(this.buffers.chime, { when: t + 0.1, gain: 0.22, rate: 1.2, pan }); }
    else this._kotoNote(degreeToMidi(3), t, 0.12, pan, { bus: this.sfxBus });
  }
  /** Match over: whistle, drum roll, koto run up the scale, crowd. */
  win() {
    if (!this.ctx) return;
    const t = this.now;
    if (this.buffers.whistle) this._play(this.buffers.whistle, { when: t, gain: 0.22 });
    for (let i = 0; i < 12; i++) this._kotoNote(degreeToMidi(i), t + 0.25 + i * 0.045, 0.15, (i / 11) * 1.2 - 0.6, { bus: this.sfxBus });
    for (let i = 0; i < 10; i++) this._play(this.buffers.don, { when: t + 0.25 + i * 0.07, gain: 0.16 + i * 0.035, rate: 1.15 });
    this._play(this.buffers.don, { when: t + 1.0, gain: 0.7 });
    this._play(this.buffers.kane, { when: t + 1.0, gain: 0.22 });
    this.cheer(0.5);
  }
  /** Brush on the daruma's eye. */
  eyePaint() { if (this.ctx) this._noiseBurst({ duration: 0.7, gain: 0.12, from: 900, to: 2600, q: 0.8 }); }
  shishi(pan = -0.4) {
    if (!this.ctx) return;
    const t = this.now;
    this._play(this.buffers.shishi, { when: t, gain: 0.3, pan, bus: this.ambBus, lowpass: 2600 });
  }
  firework(pan = 0) {
    if (!this.ctx) return;
    const t = this.now;
    this._play(this.buffers.boom, { when: t, gain: 0.55, pan, lowpass: 900 });
    for (let i = 0; i < 9; i++) this._play(this.buffers.ka, { when: t + 0.12 + this.rand() * 0.7, gain: 0.05 + this.rand() * 0.07, rate: 1.4 + this.rand(), pan });
  }
  ui(kind = 'tap') {
    if (!this.ctx) return;
    if (kind === 'tap') this._play(this.buffers.ka, { gain: 0.22, rate: 1.2 });
    else if (kind === 'select') this._kotoNote(degreeToMidi(7), this.now, 0.18, 0, { bus: this.sfxBus });
    else if (kind === 'start') { const t = this.now; [5, 7, 10].forEach((deg, i) => this._kotoNote(degreeToMidi(deg), t + i * 0.07, 0.22, 0, { bus: this.sfxBus })); this._play(this.buffers.clack, { when: t, gain: 0.4 }); }
    else if (kind === 'done') { const t = this.now; [3, 5, 7, 8, 10].forEach((deg, i) => this._kotoNote(degreeToMidi(deg), t + i * 0.06, 0.2, 0, { bus: this.sfxBus })); }
    else if (kind === 'tick') this._play(this.buffers.table, { gain: 0.15, rate: 0.7 });
  }

  // ------------------------------------------------------------------ music
  /**
   * Schedule music up to `until`; called on a 25 ms timer. The look-ahead is long enough
   * to ride out a stalled frame (shader compile, GC) without bunching notes together.
   */
  tick(until = this.now + 0.3) {
    if (!this.ctx) return;
    if (this.nextStep < this.now - 0.5) this.nextStep = this.now + 0.05;   // tab was asleep: do not replay the gap
    while (this.nextStep < until) {
      const scene = SCENES[this.scene] || SCENES.off;
      const bpm = scene.bpm + (this.scene === 'play' ? 14 * this.intensity : 0);
      if (this.bgmMode === 'wafu' && scene.gain > 0) this._playStep(this.step, this.nextStep, scene);
      this.nextStep += 60 / bpm / 4;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }

  /** One bar of melody for the koto: [{ step, deg }] following a motif (A A' B A). */
  _barNotes(bar, scene) {
    const slot = bar % 8;
    if (slot === 0 && bar % 16 === 0) this.motif = [];
    const source = slot === 2 || slot === 6 ? 0 : slot === 3 || slot === 7 ? 1 : slot;
    if (this.motif[source] && source !== slot) {
      const copy = this.motif[source].map((n) => ({ ...n }));
      if (copy.length) copy[copy.length - 1].deg = slot === 7 ? 5 : copy[copy.length - 1].deg + (this.rand() < 0.5 ? 1 : -1);
      return copy;
    }
    const harmony = HARMONY[bar % 4];
    const lively = scene.lively && this.intensity > 0.3;
    const rhythms = lively ? RHYTHM_LIVELY : RHYTHM_CALM;
    const rhythm = rhythms[Math.floor(this.rand() * rhythms.length)];
    const notes = rhythm.map((step, i) => {
      if (i === 0) {
        // start the bar on the nearest settled tone
        const options = harmony.tones.flatMap((tone) => [tone, tone + 5, tone + 10]);
        this.degree = options.reduce((best, d) => (Math.abs(d - this.degree) < Math.abs(best - this.degree) ? d : best), options[0]);
      } else {
        this.degree = clamp(this.degree + [-2, -1, -1, 1, 1, 2, 0][Math.floor(this.rand() * 7)], 2, 12);
      }
      return { step, deg: this.degree };
    });
    this.motif[slot] = notes;
    return notes;
  }

  _playStep(step, when, scene = SCENES[this.scene]) {
    const I = this.intensity;
    const bar = this.bar;
    const harmony = HARMONY[bar % 4];
    if (step === 0) this._bar = this._barNotes(bar, scene);
    const notes = this._bar || [];
    // koto melody, humanised a little
    for (const n of notes) {
      if (n.step !== step) continue;
      const midi = degreeToMidi(n.deg);
      this._kotoNote(midi, when + this.rand() * 0.008, 0.17 + 0.05 * this.rand(), -0.25);
      if (scene.lively && I > 0.6 && step % 4 === 0) this._kotoNote(midi + 12, when + 0.012, 0.07, 0.3);
    }
    // bass koto on the beats
    if (step === 0 || (step === 8 && (scene.lively || bar % 2 === 1))) this._kotoNote(harmony.bass, when, 0.3, 0.1, { duration: 3, damping: 0.998, brightness: 0.35 });
    if (scene.lively && I > 0.45 && (step === 6 || step === 14)) this._kotoNote(harmony.bass + 7, when, 0.16, 0.1, { duration: 3, damping: 0.998, brightness: 0.35 });
    // flute
    const stepSec = 60 / (scene.bpm + (this.scene === 'play' ? 14 * I : 0)) / 4;
    if (scene.flute === 'long' && step === 0 && bar % 2 === 0) {
      const tone = harmony.tones[Math.floor(this.rand() * harmony.tones.length)] + 5;
      this._flute(degreeToMidi(tone), when, stepSec * 12, 0.07, 0.3);
    } else if (scene.flute === 'festival' && I > 0.5) {
      for (const n of notes) if (n.step === step && step % 2 === 0) this._flute(degreeToMidi(n.deg + 5), when, stepSec * 1.7, 0.05 + 0.03 * I, 0.35);
    }
    // percussion grows with the rally
    const drums = scene.drums * (scene.lively ? clamp(I * 1.3, 0, 1) : 1);
    if (drums > 0.12) {
      if (step === 0) this._play(this.buffers.don, { when, gain: 0.42 * drums + 0.1, bus: this.musicBus });
      if (step === 8 && drums > 0.3) this._play(this.buffers.don, { when, gain: 0.34 * drums, rate: 1.12, bus: this.musicBus });
      if ((step === 4 || step === 12) && drums > 0.2) this._play(this.buffers.ka, { when, gain: 0.16 * drums, bus: this.musicBus });
      if (drums > 0.6 && (step === 10 || step === 11)) this._play(this.buffers.don, { when, gain: 0.22 * drums, rate: 1.3, bus: this.musicBus });
      if (drums > 0.75 && step % 4 === 2) this._play(this.buffers.kane, { when, gain: 0.07 * drums, pan: 0.4, bus: this.musicBus });
      if (drums > 0.9 && bar % 4 === 3 && step >= 12) this._play(this.buffers.don, { when, gain: 0.2 + 0.06 * (step - 12), rate: 1.2, bus: this.musicBus });
    }
  }
}
