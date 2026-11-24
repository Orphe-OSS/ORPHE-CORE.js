// audio.js — the sounds of the jumps, on top of the stadium sound engine of GAME-SUPER-HURDLE
// (through StageAudio of GAME-SUPER-START, which adds the slow-motion "time warp").
//
// The sound of a field event is the crowd's hands: the jumper claps overhead, the stand picks
// the rhythm up, it gets faster with the run, breaks at the board into one long "oooh" and
// lands as a roar. Everything here is synthesised.
import { StageAudio } from '../GAME-SUPER-START/stage.js';

const PENTA = [0, 4, 7, 12, 16];

export class JumpAudio extends StageAudio {
  /** One clap of the whole stand. size 0..1 = how many hands. */
  clap(size = 1, t = this.now) {
    if (!this.ctx) return;
    const n = 3 + Math.round(5 * size);
    for (let i = 0; i < n; i++) {
      const at = t + (i === 0 ? 0 : Math.random() * 0.035);
      const pan = (Math.random() * 2 - 1) * 0.9;
      this.noise(at, { dur: 0.045, freq: 1100 + Math.random() * 1500, q: 1.1, gain: (0.1 + 0.16 * size) * (i === 0 ? 1 : 0.55), attack: 0.001, pan, send: 0.55, dest: this.crowdBus });
    }
    this.tone(t, { f0: 190, f1: 120, glide: 0.04, dur: 0.06, gain: 0.05 * size, attack: 0.001, send: 0.4 });
  }
  /** The jumper's own hands, close. */
  handClap(t = this.now) {
    if (!this.ctx) return;
    this.noise(t, { dur: 0.03, freq: 1900, q: 1.4, gain: 0.3, attack: 0.001, send: 0.35 });
    this.noise(t + 0.004, { dur: 0.05, freq: 1150, q: 0.9, gain: 0.2, attack: 0.001, send: 0.35 });
  }
  /** The crowd's voice rising for as long as the jumper is in the air. */
  crowdRise(dur = 1.6) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.now;
    const src = ctx.createBufferSource(); src.buffer = this.white; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.4;
    f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(1500, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
    src.connect(f).connect(g).connect(this.uiBus || this.sfxBus);
    src.start(t); src.stop(t + dur + 0.4);
  }
  /** The foot on the board: wood, and how well it was hit (just = right on the line). */
  board(just = false, foul = false) {
    if (!this.ctx) return;
    const t = this.now, d = this.uiBus || this.sfxBus;
    this.tone(t, { f0: 230, f1: 95, glide: 0.07, dur: 0.16, gain: 0.8, attack: 0.001, dest: d });
    this.noise(t, { dur: 0.035, type: 'highpass', freq: 2400, gain: 0.5, attack: 0.0005, dest: d });
    this.noise(t, { dur: 0.3, freq: 500, sweep: 2600, q: 0.8, gain: 0.3, attack: 0.03, dest: d });      // the leap
    if (foul) return;
    const f = just ? 1318.5 : 987.8;
    this.tone(t + 0.02, { f0: f, dur: 0.5, gain: 0.16, attack: 0.003, dest: d });
    if (just) { this.tone(t + 0.09, { f0: f * 1.5, dur: 0.6, gain: 0.14, attack: 0.003, dest: d }); this.tone(t + 0.16, { f0: f * 2, dur: 0.7, gain: 0.1, attack: 0.003, dest: d }); }
  }
  /**
   * A contact of the triple jump (i = 0 hop→step, 1 step→jump): a drum that climbs with each
   * phase, and a note on top whose brightness is the quality (0..1).
   */
  contact(i, q) {
    if (!this.ctx) return;
    const t = this.now, d = this.uiBus || this.sfxBus;
    const f = 150 * Math.pow(2, i * 4 / 12);
    this.tone(t, { f0: f * 1.6, f1: f * 0.55, glide: 0.09, dur: 0.24, gain: 0.85, attack: 0.001, dest: d });
    this.noise(t, { dur: 0.05, type: 'highpass', freq: 1800, gain: 0.4, attack: 0.0005, dest: d });
    if (q <= 0) { this.tone(t + 0.02, { f0: 150, f1: 90, glide: 0.2, dur: 0.3, gain: 0.25, type: 'sawtooth', attack: 0.004, dest: d }); return; }
    const note = 659.25 * Math.pow(2, PENTA[i + 1] / 12);
    this.tone(t + 0.015, { f0: note, dur: 0.45, gain: 0.08 + 0.1 * q, attack: 0.003, dest: d });
    if (q >= 0.75) this.tone(t + 0.015, { f0: note * 2, dur: 0.35, gain: 0.07 * q, attack: 0.003, dest: d });
    if (q >= 1) this.tone(t + 0.08, { f0: note * 1.5, dur: 0.5, gain: 0.09, attack: 0.003, dest: d });
  }
  /** Into the sand. power 0..1; clean = heels in and through (bright hiss), not clean = a thud. */
  sand(power = 1, clean = true) {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(t, { f0: 120, f1: 36, glide: 0.16, dur: 0.4, gain: 0.95 * (0.6 + 0.4 * power), attack: 0.002, send: 0.3 });
    this.noise(t, { dur: 0.16, type: 'lowpass', freq: 900, gain: 0.7, attack: 0.002, send: 0.25 });
    this.noise(t + 0.01, { dur: clean ? 0.75 : 0.4, type: 'highpass', freq: clean ? 2600 : 1500, gain: clean ? 0.42 : 0.3, attack: 0.02, send: 0.3 });
    this.noise(t + 0.12, { dur: 0.6, freq: 3400, sweep: 1400, q: 0.7, gain: 0.16, attack: 0.08, send: 0.3 });
  }
  /** The flag going up: cloth, then a bell for the white one. (The red one is followed by foul().) */
  flag(valid) {
    if (!this.ctx) return;
    const t = this.now;
    this.noise(t, { dur: 0.22, freq: 900, sweep: 3200, q: 1.0, gain: 0.3, attack: 0.04 });
    if (valid) {
      this.tone(t + 0.12, { f0: 1568, dur: 0.9, gain: 0.14, attack: 0.003, send: 0.6 });
      this.tone(t + 0.12, { f0: 2349, dur: 0.7, gain: 0.07, attack: 0.003, send: 0.6 });
    }
  }
  /** The mark is read out: a roll that ends on a hit. grade 0 ordinary, 1 a best, 2 the lead. */
  mark(grade = 0) {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(t, { f0: 98, f1: 49, glide: 0.3, dur: 0.7, gain: 0.7, attack: 0.002, send: 0.4 });
    this.noise(t, { dur: 0.5, type: 'highpass', freq: 4200, gain: 0.22, attack: 0.002, send: 0.5 });
    const chord = grade >= 2 ? [0, 4, 7, 12, 16] : grade >= 1 ? [0, 4, 7, 12] : [0, 7];
    chord.forEach((semi, i) => {
      const f = 523.25 * Math.pow(2, semi / 12);
      this.tone(t + 0.02 + i * 0.045, { f0: f, dur: 0.9, gain: 0.11, attack: 0.004, send: 0.6 });
    });
  }
  /** One tick of the runway clock's last seconds. */
  clockTick(last = false) {
    if (!this.ctx) return;
    this.tone(this.now, { f0: last ? 1320 : 880, dur: last ? 0.3 : 0.07, gain: 0.12, attack: 0.002, dest: this.uiBus || this.sfxBus });
  }
  /** The height of the real jump is in: a rising sweep and a chord, brighter the higher the jump (scale = its lift, about 0.55..1.12). */
  power(scale = 1) {
    if (!this.ctx) return;
    const t = this.now, d = this.uiBus || this.sfxBus;
    const k = Math.min(1, Math.max(0, (scale - 0.55) / 0.5));
    this.noise(t, { dur: 0.45, freq: 500, sweep: 2400 + 3200 * k, q: 1.1, gain: 0.3 + 0.25 * k, attack: 0.02, dest: d });
    const f = 392 * Math.pow(2, Math.round(k * 7) / 12);
    this.tone(t, { f0: f * 0.5, f1: f, glide: 0.12, dur: 0.5, gain: 0.3, attack: 0.004, dest: d });
    this.tone(t + 0.05, { f0: f * 1.5, dur: 0.45, gain: 0.12 + 0.1 * k, attack: 0.004, dest: d });
    if (scale >= 1) { this.tone(t + 0.1, { f0: f * 2, dur: 0.7, gain: 0.14, attack: 0.004, dest: d }); this.tone(t + 0.17, { f0: f * 3, dur: 0.8, gain: 0.08, attack: 0.004, dest: d }); }
  }
}
