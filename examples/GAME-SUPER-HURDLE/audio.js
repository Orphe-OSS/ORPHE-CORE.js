// audio.js — fully procedural stadium sound: adaptive music, crowd, foley and UI.
//
// Everything is synthesised with Web Audio except the crowd cheer, which
// granulates the short sound/sound-audience.mp3 sample into a continuous bed.
// The engine takes any BaseAudioContext so it can also render offline in tests.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BPM = 150;
const BEAT = 60 / BPM;
const S16 = BEAT / 4;

// D minor "drive" for the race, relative major for the result screen.
const PROG_RACE = [
  { root: 38, tones: [62, 65, 69] },   // Dm
  { root: 34, tones: [58, 62, 65] },   // Bb
  { root: 41, tones: [57, 60, 65] },   // F
  { root: 36, tones: [55, 60, 64] },   // C
];
const PROG_RESULT = [
  { root: 41, tones: [57, 60, 65] },   // F
  { root: 36, tones: [55, 60, 64] },   // C
  { root: 38, tones: [57, 62, 65] },   // Dm
  { root: 34, tones: [58, 62, 65] },   // Bb
];
const ARP = [0, 2, 3, 2, 4, 3, 2, 3, 0, 2, 3, 2, 5, 4, 3, 2];
const STAB_STEPS = new Set([0, 3, 6, 10, 12]);
const CHIME_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const RACE_LEVEL = 0.7;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.85;
    this.muted = false;
    this.mode = 'off';
    this.intensity = 0;
    this.excite = 0.15;
    this.hush = 0;
    this.breath = 0;
    this.heartRate = 0;
    this.stepCount = 0;
    this.cheerBuf = null;
    try {
      const v = parseFloat(localStorage.getItem('hurdle.volume'));
      if (Number.isFinite(v)) this.volume = Math.min(1, Math.max(0, v));
      this.muted = localStorage.getItem('hurdle.muted') === '1';
    } catch { /* storage unavailable */ }
  }

  get ready() { return !!this.ctx; }

  /** Create the graph. Must be called from a user gesture for a live AudioContext. */
  init(context) {
    if (this.ctx) { if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = context || new Ctx({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.live = !context;
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    this.master = g(1);
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10; this.limiter.knee.value = 8; this.limiter.ratio.value = 14;
    this.limiter.attack.value = 0.003; this.limiter.release.value = 0.22;
    this.out = g(this.muted ? 0 : this.volume);
    this.master.connect(this.limiter).connect(this.out).connect(ctx.destination);

    // reverb: decaying noise with a few slap-back clusters = big concrete bowl
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.2);
    this.reverbIn = g(1);
    this.reverbOut = g(0.42);
    this.reverbIn.connect(this.reverb).connect(this.reverbOut).connect(this.master);

    this.sfxBus = g(0.9); this.sfxBus.connect(this.master);
    this.crowdBus = g(0.7); this.crowdBus.connect(this.master);

    // music: [voices] -> duck (sidechain) -> filter (opens with speed) -> bus
    this.musicBus = g(0.0);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 900; this.musicFilter.Q.value = 0.7;
    this.musicFilter.connect(this.musicBus).connect(this.master);
    this.duck = g(1); this.duck.connect(this.musicFilter);
    this.drumBus = g(1); this.drumBus.connect(this.musicFilter);
    this.musicSend = g(0.22); this.duck.connect(this.musicSend).connect(this.reverbIn);
    // dotted-eighth echo for the arpeggio
    this.arpBus = g(1); this.arpBus.connect(this.duck);
    const delay = ctx.createDelay(1.0); delay.delayTime.value = BEAT * 0.75;
    const fb = g(0.36); const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    const wet = g(0.3);
    this.arpBus.connect(delay); delay.connect(dlp).connect(fb).connect(delay); dlp.connect(wet).connect(this.duck);

    this.white = this._noise(2.0, false);
    this.pink = this._noise(4.0, true);

    this._initCrowd();
    this._initWind();
    this.nextStep = 0; this.step = 0;
    this.nextGrain = 0; this.nextHeart = 0;
    if (this.live) {
      fetch('sound/sound-audience.mp3').then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((buf) => { this.cheerBuf = buf; }).catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) ctx.suspend(); else ctx.resume();
      });
    }
  }

  // ------------------------------------------------------------ building blocks
  _noise(seconds, pink) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(2, Math.floor(seconds * ctx.sampleRate), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        if (!pink) { d[i] = w; continue; }
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  }
  _impulse(seconds) {
    const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(seconds * sr);
    const buf = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / seconds, 2.4) * Math.exp(-t * 0.9) * 0.6;
      }
      for (const [et, eg] of [[0.09 + ch * 0.013, 0.7], [0.21 - ch * 0.02, 0.45], [0.34 + ch * 0.03, 0.28]]) {
        const s = Math.floor(et * sr);
        for (let j = 0; j < 500 && s + j < n; j++) d[s + j] += (Math.random() * 2 - 1) * eg * (1 - j / 500);
      }
    }
    return buf;
  }
  _out(node, { dest, pan = 0, send = 0 }) {
    const ctx = this.ctx;
    let tail = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); tail.connect(p); tail = p; }
    tail.connect(dest || this.sfxBus);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; tail.connect(s).connect(this.reverbIn); }
  }
  /** Filtered noise burst with an attack/decay envelope. */
  noise(t, o) {
    const ctx = this.ctx;
    const { dur = 0.1, type = 'bandpass', freq = 1000, q = 1, gain = 0.3, attack = 0.003, sweep = 0, pink = false } = o;
    const src = ctx.createBufferSource();
    src.buffer = pink ? this.pink : this.white; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    this._out(g, o);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  /** Oscillator with pitch glide and an attack/decay envelope. */
  tone(t, o) {
    const ctx = this.ctx;
    const { dur = 0.2, type = 'sine', f0 = 440, f1 = 0, gain = 0.3, attack = 0.004, detune = 0 } = o;
    const osc = ctx.createOscillator();
    osc.type = type; osc.frequency.setValueAtTime(f0, t); osc.detune.value = detune;
    if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t + (o.glide || dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    this._out(g, o);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  /** A few detuned saws through an enveloped low-pass: plucks, stabs and pads. */
  synth(t, o) {
    const ctx = this.ctx;
    const { notes, dur = 0.2, gain = 0.2, attack = 0.005, cutoff = 2000, cutEnd = 0, q = 1, spread = 8, release = 0.08, type = 'sawtooth' } = o;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q;
    f.frequency.setValueAtTime(cutoff, t);
    if (cutEnd) f.frequency.exponentialRampToValueAtTime(cutEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    if (o.sustain) { g.gain.setValueAtTime(gain, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + release); } else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g);
    this._out(g, o);
    const end = t + dur + (o.sustain ? release : 0) + 0.05;
    for (const m of notes) {
      for (const d of [-spread, spread]) {
        const osc = ctx.createOscillator();
        osc.type = type; osc.frequency.value = mtof(m); osc.detune.value = d;
        osc.connect(f); osc.start(t); osc.stop(end);
      }
    }
  }

  // ------------------------------------------------------------ music
  setMusic(mode, fade = 0.6) {
    if (!this.ctx) { this.mode = mode; return; }
    const now = this.ctx.currentTime;
    if (mode !== this.mode) { this.mode = mode; this.step = 0; this.nextStep = now + 0.06; }
    const level = { off: 0, title: 0.46, race: RACE_LEVEL, result: 0.54 }[mode] ?? 0;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(level, now, fade / 3);
    if (mode === 'title') this._setCutoff(1500); else if (mode === 'result') this._setCutoff(6500);
  }
  _setCutoff(hz, tc = 0.25) { this.musicFilter.frequency.setTargetAtTime(hz, this.ctx.currentTime, tc); }
  _kick(t, v) {
    this.tone(t, { f0: 168, f1: 46, glide: 0.11, dur: 0.34, gain: v, attack: 0.002, dest: this.drumBus });
    this.noise(t, { dur: 0.012, type: 'highpass', freq: 2500, gain: v * 0.22, attack: 0.001, dest: this.drumBus });
    const d = this.duck.gain;
    d.cancelScheduledValues(t); d.setValueAtTime(0.42, t); d.linearRampToValueAtTime(1, t + BEAT * 0.62);
  }
  _clap(t, v) {
    for (const [dt, a] of [[0, 0.7], [0.011, 0.8], [0.024, 1]]) this.noise(t + dt, { dur: dt === 0.024 ? 0.16 : 0.02, freq: 1500, q: 1.1, gain: v * a, attack: 0.001, dest: this.drumBus, send: 0.35 });
  }
  _hat(t, v, open) { this.noise(t, { dur: open ? 0.2 : 0.04, type: 'highpass', freq: 8200, gain: v, attack: 0.001, dest: this.drumBus }); }
  _bass(t, m, dur, v) {
    this.synth(t, { notes: [m], dur, gain: v, cutoff: 950, cutEnd: 220, q: 4, spread: 5, dest: this.duck });
    this.tone(t, { f0: mtof(m - 12 < 28 ? m : m - 12), dur, gain: v * 0.9, attack: 0.006, dest: this.duck });
  }
  _playStep(step, t) {
    const bar = step >> 4, s = step & 15;
    const I = this.intensity;
    if (this.mode === 'race') {
      const ch = PROG_RACE[bar];
      if (s % 4 === 0) this._kick(t, 0.95);
      if (s === 4 || s === 12) this._clap(t, 0.3 + 0.25 * I);
      if (s % 4 === 2) this._hat(t, 0.13 + 0.13 * I, I > 0.7 && s === 14);
      else if (I > 0.5 && s % 2 === 1) this._hat(t, 0.07 + 0.06 * I, false);
      if (s % 2 === 0) this._bass(t, ch.root + (s % 4 === 2 ? 12 : 0), S16 * 1.7, 0.34);
      if (s === 0) this.synth(t, { notes: ch.tones, dur: BEAT * 4 - 0.1, gain: 0.05 + 0.04 * I, attack: 0.25, cutoff: 1200 + 1400 * I, spread: 11, sustain: true, release: 0.3, dest: this.duck, send: 0.3 });
      if (I > 0.3) {
        const tones = [...ch.tones, ...ch.tones.map((n) => n + 12)];
        this.synth(t, { notes: [tones[ARP[s]] + 12], dur: 0.17, gain: 0.1 + 0.07 * I, cutoff: 1800 + 4200 * I, cutEnd: 700, q: 3, spread: 7, dest: this.arpBus });
      }
      if (I > 0.72 && STAB_STEPS.has(s)) this.synth(t, { notes: [...ch.tones, ch.tones[0] + 12], dur: 0.24, gain: 0.11, cutoff: 5200, cutEnd: 1400, spread: 14, dest: this.duck, send: 0.4 });
    } else if (this.mode === 'title') {
      const ch = PROG_RACE[bar];
      if (s === 0) this.synth(t, { notes: ch.tones, dur: BEAT * 4 - 0.1, gain: 0.085, attack: 0.9, cutoff: 1100, spread: 12, sustain: true, release: 0.8, dest: this.duck, send: 0.6 });
      if (s === 0 || s === 3) this.tone(t, { f0: 92, f1: 44, glide: 0.14, dur: 0.4, gain: s === 0 ? 0.55 : 0.32, dest: this.drumBus });   // heartbeat pulse
      if (s === 0) this.tone(t, { f0: mtof(ch.root), dur: BEAT * 3.6, gain: 0.3, attack: 0.05, dest: this.duck });
      if (s % 2 === 0) {
        const tones = [...ch.tones, ...ch.tones.map((n) => n + 12)];
        this.synth(t, { notes: [tones[ARP[s]] + 12], dur: 0.3, gain: 0.05, cutoff: 2400, cutEnd: 600, q: 2, spread: 6, dest: this.arpBus, send: 0.3 });
      }
    } else if (this.mode === 'result') {
      const ch = PROG_RESULT[bar];
      if (s % 4 === 0) this._kick(t, 0.6);
      if (s === 4 || s === 12) this._clap(t, 0.26);
      if (s % 4 === 2) this._hat(t, 0.09, false);
      if (s % 2 === 0) this._bass(t, ch.root + (s % 4 === 2 ? 12 : 0), S16 * 1.7, 0.26);
      if (s === 0) this.synth(t, { notes: ch.tones, dur: BEAT * 4 - 0.1, gain: 0.09, attack: 0.3, cutoff: 2600, spread: 11, sustain: true, release: 0.4, dest: this.duck, send: 0.45 });
      const tones = [...ch.tones, ...ch.tones.map((n) => n + 12)];
      this.synth(t, { notes: [tones[ARP[s]] + 12], dur: 0.2, gain: 0.085, cutoff: 5200, cutEnd: 900, q: 2.5, spread: 7, dest: this.arpBus });
    }
  }

  // ------------------------------------------------------------ crowd + ambience
  _initCrowd() {
    const ctx = this.ctx;
    const loop = (buf, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 2); return s; };
    const bp = (f, q) => { const n = ctx.createBiquadFilter(); n.type = 'bandpass'; n.frequency.value = f; n.Q.value = q; return n; };
    // distant murmur
    this.murmur = ctx.createGain(); this.murmur.gain.value = 0;
    const mf = bp(620, 0.55);
    const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 1700;
    loop(this.pink, 0.9).connect(mf).connect(mlp).connect(this.murmur).connect(this.crowdBus);
    // roar: brighter band that swells with excitement
    this.roar = ctx.createGain(); this.roar.gain.value = 0;
    const rf = bp(1250, 0.6);
    const rf2 = bp(2500, 1.2); const rf2g = ctx.createGain(); rf2g.gain.value = 0.5;
    const rsrc = loop(this.pink, 1.15);
    rsrc.connect(rf).connect(this.roar); rsrc.connect(rf2).connect(rf2g).connect(this.roar);
    this.roar.connect(this.crowdBus);
    const rsend = ctx.createGain(); rsend.gain.value = 0.25; this.roar.connect(rsend).connect(this.reverbIn);
    // slow wander so the crowd breathes instead of hissing
    for (const [hz, depth, target] of [[0.13, 130, mf.frequency], [0.21, 260, rf.frequency], [0.07, 0.03, this.murmur.gain]]) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = hz;
      const lg = ctx.createGain(); lg.gain.value = depth;
      lfo.connect(lg).connect(target); lfo.start();
    }
    this.cheer = ctx.createGain(); this.cheer.gain.value = 0; this.cheer.connect(this.crowdBus);
  }
  _initWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.pink; src.loop = true; src.playbackRate.value = 1.4;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 400; this.windFilter.Q.value = 0.5;
    this.wind = ctx.createGain(); this.wind.gain.value = 0;
    src.connect(this.windFilter).connect(this.wind).connect(this.sfxBus);
    src.start();
  }
  /** Crowd excitement 0..1; hush 0..1 pulls everything down (the "set" silence). */
  setCrowd(excite, hush = 0) { this.excite = excite; this.hush = hush; }
  _grain(t) {
    if (!this.cheerBuf) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.cheerBuf; src.playbackRate.value = 0.86 + Math.random() * 0.3;
    const g = ctx.createGain();
    const len = 1.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.5);
    g.gain.setValueAtTime(0.5, t + len - 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(g);
    this._out(g, { dest: this.cheer, pan: (Math.random() * 2 - 1) * 0.75 });
    src.start(t, 0.08 + Math.random() * 0.75, len + 0.1);
  }
  crowdCheer(gain = 0.8) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.cheerBuf) {
      for (const [dt, rate, pan] of [[0, 1, -0.3], [0.35, 0.92, 0.4], [1.1, 1.06, 0]]) {
        const src = this.ctx.createBufferSource(); src.buffer = this.cheerBuf; src.playbackRate.value = rate;
        const g = this.ctx.createGain(); g.gain.value = gain * 0.6;
        src.connect(g); this._out(g, { dest: this.crowdBus, pan, send: 0.3 });
        src.start(t + dt);
      }
    }
    this.noise(t, { dur: 2.6, freq: 1500, q: 0.5, gain: gain * 0.5, attack: 0.25, pink: true, dest: this.crowdBus, send: 0.3 });
  }
  crowdGasp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.05;
    this.noise(t, { dur: 0.85, freq: 760, sweep: 430, q: 2.2, gain: 0.5, attack: 0.09, pink: true, dest: this.crowdBus, send: 0.3 });
    this.noise(t, { dur: 0.7, freq: 1250, sweep: 800, q: 2.6, gain: 0.22, attack: 0.09, pink: true, dest: this.crowdBus });
  }

  // ------------------------------------------------------------ per-frame control
  /** speed 0..1, stamina 0..1 */
  setRace(speed, stamina, exhausted) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.intensity += (speed - this.intensity) * 0.08;
    if (this.mode === 'race') this.musicFilter.frequency.setTargetAtTime(420 * Math.pow(42, Math.min(1, this.intensity * 1.08)), now, 0.07);
    this.wind.gain.setTargetAtTime(speed * speed * 0.2, now, 0.08);
    this.windFilter.frequency.setTargetAtTime(280 + 1000 * speed, now, 0.1);
    this.breath = Math.max(0, Math.min(1, (1 - stamina) * 1.15));
    this.heartRate = exhausted ? 2.7 : 0;
  }
  stopRace() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.wind.gain.setTargetAtTime(0, now, 0.15);
    this.breath = 0; this.heartRate = 0;
  }
  /** Call every frame; `until` lets an offline render schedule a whole range at once. */
  tick(until) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const ahead = until ?? now + 0.14;
    if (this.mode !== 'off') {
      if (this.nextStep < now - 0.2) this.nextStep = now + 0.05;
      while (this.nextStep < ahead) {
        this._playStep(this.step, this.nextStep);
        this.nextStep += S16;
        this.step = (this.step + 1) % 64;
      }
    }
    const e = this.excite, h = 1 - this.hush;
    this.murmur.gain.setTargetAtTime((0.15 + 0.13 * e) * (0.25 + 0.75 * h), now, 0.25);
    this.roar.gain.setTargetAtTime((0.015 + 0.5 * e * e) * h, now, 0.3);
    this.cheer.gain.setTargetAtTime((0.04 + 0.75 * Math.pow(e, 1.5)) * h, now, 0.3);
    if (this.nextGrain < now - 1) this.nextGrain = now;
    while (this.nextGrain < ahead + 0.2) { this._grain(this.nextGrain); this.nextGrain += 0.42 + Math.random() * 0.2; }
    if (this.heartRate > 0) {
      if (this.nextHeart < now) this.nextHeart = now + 0.02;
      while (this.nextHeart < ahead) { this.heartbeat(this.nextHeart, 0.55); this.nextHeart += 1 / this.heartRate; }
    }
  }

  // ------------------------------------------------------------ one-shots
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  footstep(pan = 0, power = 1, t = this.now) {
    if (!this.ctx) return;
    this.tone(t, { f0: 118, f1: 52, glide: 0.06, dur: 0.1, gain: 0.4 * power, attack: 0.002, pan: pan * 0.35 });
    this.noise(t, { dur: 0.07, freq: 1700 + Math.random() * 900, q: 0.9, gain: 0.26 * power, attack: 0.002, pan: pan * 0.5 });
    // breathing rides on the step rhythm: two steps in, two steps out
    this.stepCount++;
    if (this.breath > 0.06 && this.stepCount % 2 === 0) {
      const inhale = (this.stepCount / 2) % 2 === 0;
      this.noise(t + 0.02, { dur: 0.26, freq: inhale ? 1650 : 980, q: 1.3, gain: this.breath * (inhale ? 0.1 : 0.16), attack: 0.07 });
    }
  }
  rivalStep(pan, dist) {
    if (!this.ctx) return;
    const a = 0.34 / (1 + dist * dist * 0.14);
    if (a < 0.012) return;
    const t = this.now;
    this.tone(t, { f0: 105, f1: 55, glide: 0.05, dur: 0.08, gain: a, pan });
    this.noise(t, { dur: 0.05, freq: 2100, q: 0.9, gain: a * 0.7, pan });
  }
  jump() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise(t, { dur: 0.3, freq: 420, sweep: 1900, q: 0.8, gain: 0.34, attack: 0.05 });
    this.noise(t, { dur: 0.12, freq: 900, q: 3, gain: 0.12, attack: 0.02 });
  }
  land(power = 1) {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(t, { f0: 95, f1: 38, glide: 0.1, dur: 0.18, gain: 0.6 * power, attack: 0.002 });
    this.noise(t, { dur: 0.1, freq: 1400, q: 0.7, gain: 0.3 * power, attack: 0.002 });
  }
  hurdlePass() {
    if (!this.ctx) return;
    const t = this.now;
    for (const pan of [-0.8, 0.8]) this.noise(t, { dur: 0.16, freq: 2600, sweep: 1300, q: 1.4, gain: 0.1, attack: 0.03, pan });
  }
  hurdleClear(combo) {
    if (!this.ctx) return;
    const t = this.now;
    const f = mtof(74 + CHIME_SCALE[Math.min(CHIME_SCALE.length - 1, Math.max(0, combo - 1))]);
    this.tone(t, { f0: f, dur: 0.55, gain: 0.17, attack: 0.003, send: 0.5 });
    this.tone(t, { f0: f * 2, dur: 0.3, gain: 0.07, attack: 0.003, send: 0.5 });
    this.tone(t + 0.07, { f0: f * 1.5, dur: 0.4, gain: 0.09, type: 'triangle', attack: 0.003, send: 0.5 });
  }
  hurdleHit() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(t, { f0: 150, f1: 42, glide: 0.2, dur: 0.32, gain: 0.95, attack: 0.002, send: 0.25 });
    this.noise(t, { dur: 0.09, type: 'lowpass', freq: 2200, gain: 0.6, attack: 0.001, send: 0.3 });
    let at = t + 0.02;
    for (let i = 0; i < 6; i++) {
      const v = 0.5 * Math.pow(0.72, i);
      const pan = (Math.random() * 2 - 1) * 0.5;
      this.noise(at, { dur: 0.05, freq: 800 + Math.random() * 1700, q: 7, gain: v, attack: 0.001, pan, send: 0.3 });
      this.tone(at, { f0: 900 + Math.random() * 1400, dur: 0.09, gain: v * 0.35, type: 'triangle', attack: 0.001, pan, send: 0.3 });
      at += 0.05 + Math.random() * 0.09;
    }
    const m = this.musicBus.gain;
    m.cancelScheduledValues(t); m.setValueAtTime(m.value, t); m.linearRampToValueAtTime(0.24, t + 0.04); m.linearRampToValueAtTime(RACE_LEVEL, t + 0.9);
  }
  countBeep(final = false) {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(t, { f0: final ? 990 : 660, dur: final ? 0.5 : 0.22, gain: 0.3, attack: 0.008, send: 0.9 });
    this.tone(t, { f0: final ? 1980 : 1320, dur: 0.12, gain: 0.07, attack: 0.008, send: 0.9 });
  }
  heartbeat(t = this.now, v = 0.6) {
    if (!this.ctx) return;
    this.tone(t, { f0: 70, f1: 42, glide: 0.07, dur: 0.14, gain: v, attack: 0.004 });
    this.tone(t + 0.15, { f0: 62, f1: 40, glide: 0.07, dur: 0.16, gain: v * 0.7, attack: 0.004 });
  }
  riser(dur) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.now;
    // rising noise sweep + rising saw: tension that resolves on the gun
    const src = ctx.createBufferSource(); src.buffer = this.white; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    src.connect(f).connect(g).connect(this.sfxBus);
    const send = ctx.createGain(); send.gain.value = 0.4; g.connect(send).connect(this.reverbIn);
    src.start(t); src.stop(t + dur + 0.1);
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, t); osc.frequency.exponentialRampToValueAtTime(220, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.11, t + dur); og.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    osc.connect(lp).connect(og).connect(this.sfxBus);
    osc.start(t); osc.stop(t + dur + 0.1);
  }
  gun() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise(t, { dur: 0.016, type: 'highpass', freq: 1200, gain: 1.0, attack: 0.0005, send: 1 });
    this.noise(t, { dur: 0.22, type: 'lowpass', freq: 5200, sweep: 500, gain: 0.9, attack: 0.001, send: 1 });
    this.tone(t, { f0: 130, f1: 38, glide: 0.16, dur: 0.42, gain: 0.95, attack: 0.001, send: 0.5 });
    // slap-back off the far stand
    this.noise(t + 0.31, { dur: 0.3, type: 'lowpass', freq: 1800, sweep: 400, gain: 0.3, attack: 0.004, pan: -0.5, send: 0.6 });
    this.noise(t + 0.52, { dur: 0.35, type: 'lowpass', freq: 1200, sweep: 300, gain: 0.16, attack: 0.006, pan: 0.6, send: 0.6 });
    // downbeat impact for the music
    this.noise(t, { dur: 1.6, type: 'highpass', freq: 3500, gain: 0.2, attack: 0.002, send: 0.5 });
    this.tone(t, { f0: 62, f1: 30, glide: 0.5, dur: 1.0, gain: 0.7, attack: 0.003 });
  }
  gateShatter() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise(t, { dur: 0.5, type: 'highpass', freq: 4200, gain: 0.3, attack: 0.002, send: 0.6 });
    for (let i = 0; i < 9; i++) {
      this.tone(t + Math.random() * 0.25, { f0: 1800 + Math.random() * 3600, dur: 0.25 + Math.random() * 0.4, gain: 0.05, attack: 0.002, pan: Math.random() * 2 - 1, send: 0.8 });
    }
    this.tone(t, { f0: 80, f1: 32, glide: 0.5, dur: 1.2, gain: 0.85, attack: 0.003 });
  }
  fanfare(grade = 1) {
    if (!this.ctx) return;
    const t = this.now + 0.12;
    const seq = [65, 69, 72, 77];
    seq.forEach((m, i) => this.synth(t + i * 0.11, { notes: [m, m - 12], dur: 0.36, gain: 0.13, cutoff: 3600, cutEnd: 1200, q: 1.5, spread: 10, send: 0.6 }));
    const chord = grade > 0 ? [65, 69, 72, 77, 81] : [65, 69, 72];
    this.synth(t + 0.46, { notes: chord, dur: 1.3, gain: 0.1, attack: 0.02, cutoff: 4200, cutEnd: 1500, spread: 12, sustain: true, release: 0.9, send: 0.7 });
    this.tone(t + 0.46, { f0: mtof(41), dur: 1.8, gain: 0.5, attack: 0.01 });
  }
  firework(delay = 0.3, pan = 0) {
    if (!this.ctx) return;
    const t = this.now + delay;
    this.tone(t, { f0: 78, f1: 34, glide: 0.4, dur: 0.75, gain: 0.5, attack: 0.004, pan, send: 0.7 });
    this.noise(t, { dur: 0.5, type: 'lowpass', freq: 900, sweep: 200, gain: 0.3, attack: 0.004, pan, send: 0.7 });
    for (let i = 0; i < 14; i++) {
      this.noise(t + 0.15 + Math.random() * 0.9, { dur: 0.03, type: 'highpass', freq: 3000 + Math.random() * 3000, gain: 0.05 + Math.random() * 0.08, attack: 0.001, pan: pan + (Math.random() - 0.5) * 0.8, send: 0.4 });
    }
  }
  fountain(seconds) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.now;
    const src = ctx.createBufferSource(); src.buffer = this.white; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4800;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13, t + 0.15); g.gain.setValueAtTime(0.13, t + seconds - 0.4); g.gain.linearRampToValueAtTime(0.0001, t + seconds);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t); src.stop(t + seconds + 0.1);
  }
  ui(kind = 'click') {
    if (!this.ctx) return;
    const t = this.now;
    if (kind === 'hover') this.tone(t, { f0: 1500, dur: 0.035, gain: 0.03, attack: 0.002 });
    else if (kind === 'start') { this.tone(t, { f0: 440, f1: 880, glide: 0.12, dur: 0.3, gain: 0.16, send: 0.5 }); this.tone(t + 0.09, { f0: 1320, dur: 0.35, gain: 0.08, send: 0.5 }); }
    else { this.tone(t, { f0: 900, dur: 0.06, gain: 0.09, attack: 0.002 }); this.tone(t + 0.04, { f0: 1350, dur: 0.09, gain: 0.07, attack: 0.002 }); }
  }

  // ------------------------------------------------------------ volume
  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    try { localStorage.setItem('hurdle.volume', String(this.volume)); } catch { /* ignore */ }
    this._applyVolume();
  }
  setMuted(m) {
    this.muted = !!m;
    try { localStorage.setItem('hurdle.muted', this.muted ? '1' : '0'); } catch { /* ignore */ }
    this._applyVolume();
  }
  _applyVolume() {
    if (this.ctx) this.out.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
  }
}
