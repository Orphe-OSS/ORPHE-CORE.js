// relay.js — the rules of a 4 x 100 m relay played with one sensor that is passed from hand to hand.
//
// The sensor is the baton. Two opposite things are asked of it:
//   on the track        shake it: the harder, the faster the runner
//   in a takeover zone  hold it still while it changes hands: a gauge fills, and when it is full
//                       the next runner has the baton and may run
// The exchange is a precision task, not a pause. Every movement of the sensor bleeds baton speed,
// the more the rougher (quadratically), and slows the gauge; past the "calm" limit the gauge runs
// backwards. What is left of the speed when the gauge fills is what the next runner starts with.
// The host plays the exchange in slow motion: the hands get real seconds (handDt) while the race
// clock and the 30 m of the zone advance by the slowed dt.
// What makes a real exchange hard falls out of that:
//   - stop shaking too early and the runner coasts down before the zone
//   - a rough exchange costs speed and time; a dropped baton nearly stops the runner
//   - not finished by the end of the zone: disqualified (or a time penalty in the party rule)
// Pure: no DOM, no timers. Distances in metres along the race (0..400), time in seconds from the gun.

export const RELAY_DEFAULTS = {
  legs: 4,
  legM: 100,
  zoneBefore: 20,      // the takeover zone starts this far before each 100 m mark ...
  zoneAfter: 10,       // ... and ends this far after it (30 m, as since 2018)
  vmax: 11.4,          // m/s at full effort (a flawless race takes just over 37 s; the real record is 36.84)
  effortCurve: 0.7,    // speed target = vmax * effort^curve: half effort is still 62 % speed
  tauUp: 1.3,          // s: approach to the target speed when speeding up
  tauCoast: 2.5,       // s: decay when the shaking stops on the open track
  tauPass: 8.0,        // s (hand time): decay of the baton speed in perfectly still hands
  bleed: 0.22,         // extra decay per second (hand time) at roughness 1, growing with its square (capped at roughness 2)
  graceSec: 0.35,      // hand time after entering the zone during which roughness is forgiven: nobody stops a shake instantly
  creep: 2.0,          // m/s: the incoming runner never quite stops inside the zone, so a zone always ends
  passSec: 1.4,        // s (hand time) of perfectly still hands for the baton to change hands
  gaugeSlow: 0.5,      // the gauge fills this much slower at roughness 1 than at 0
  drain: 1.0,          // gauge lost per second (hand time) per unit of roughness past the limit
  rule: 'penalty',     // 'penalty' (party) or 'dq' (as in the rule book) when the zone runs out
  penaltySec: 3,
  dropSpeed: 0.3,      // speed kept when the baton is dropped
  dropLockSec: 1.2,    // time (hand time) to pick it up
};

export class RelayRace {
  constructor(options = {}) {
    this.o = { ...RELAY_DEFAULTS, ...options };
    this.reset();
  }
  reset() {
    this.t = 0; this.s = 0; this.v = 0;
    this.leg = 0;              // who has the baton: 0..legs-1
    this.gauge = 0;            // 0..1, the exchange in progress
    this.zone = null;          // the zone the baton is in (see step())
    this.passes = [];          // one entry per zone, written when the baton leaves it
    this.splits = [];          // time at each 100 m mark
    this.penalty = 0;
    this.lock = 0;
    this.drops = 0;
    this.topSpeed = 0;
    this.finished = false; this.dq = false; this.time = null;
  }
  get total() { return this.o.legs * this.o.legM; }
  /** The k-th takeover zone (k = 0 is between the first and second runner). */
  zoneOf(k) { const m = (k + 1) * this.o.legM; return { start: m - this.o.zoneBefore, end: m + this.o.zoneAfter }; }
  /** In a zone with the baton still in the incoming runner's hand. */
  get awaiting() { return !!this.zone && this.zone.passAt == null; }
  /** The next zone ahead of the baton, or null on the last leg. */
  get nextZone() { return !this.zone && this.leg < this.o.legs - 1 ? { k: this.leg, ...this.zoneOf(this.leg) } : null; }
  /** Seconds the zone would take at full speed: the yardstick for an exchange. */
  get zoneIdealSec() { return (this.o.zoneBefore + this.o.zoneAfter) / this.o.vmax; }

  /**
   * Advance by dt seconds of race time. input: { effort, rough, drop, handDt } (or the older { calm })
   *   effort  0..1  how hard the sensor is shaken
   *   rough   >= 0  how much the sensor moves, in units of the calm limit (0 = still, 1 = at the limit)
   *   drop    bool  the sensor is in free fall
   *   handDt  s     real time that passed for the hands (defaults to dt; larger than dt in slow motion)
   * Returns the events of this step, in order.
   */
  step(dt, input = {}) {
    const o = this.o, ev = [];
    if (this.finished) return ev;
    const effort = Math.min(1, Math.max(0, +input.effort || 0));
    const rough = input.rough != null ? Math.max(0, +input.rough || 0) : input.calm ? 0 : 2;
    const hdt = Number.isFinite(input.handDt) ? input.handDt : dt;
    this.t += dt;

    if (input.drop && this.lock <= 0) {
      this.lock = o.dropLockSec; this.v *= o.dropSpeed; this.gauge = 0; this.drops++;
      if (this.zone) this.zone.dropped = true;
      ev.push({ type: 'drop', s: this.s });
    } else if (this.lock > 0) {
      this.lock = Math.max(0, this.lock - hdt);
    }

    const awaiting = this.awaiting;
    if (awaiting) {
      // the exchange: nobody drives the baton, and every movement of it costs speed
      const z = this.zone;
      const r = z.handSec < o.graceSec ? 0 : Math.min(2, rough);
      this.v = Math.max(o.creep, this.v * Math.exp(-hdt * (1 / o.tauPass + o.bleed * r * r)));
      z.handSec += hdt;
      z.roughSum += r * hdt;
      if (this.lock <= 0) {
        if (rough < 1) this.gauge = Math.min(1, this.gauge + (hdt / o.passSec) * (1 - o.gaugeSlow * rough));
        else { this.gauge = Math.max(0, this.gauge - o.drain * Math.min(2, rough - 0.5) * hdt); z.fumbleSec += hdt; }
        if (this.gauge >= 1) {
          z.passAt = this.t; z.passS = this.s; z.passV = this.v;
          z.keep = z.enterV > 0 ? this.v / z.enterV : 1;
          this.leg++; this.gauge = 0;
          ev.push({ type: 'pass', k: z.k, s: this.s, v: this.v, sec: this.t - z.enterT, handSec: z.handSec, keep: z.keep });
        }
      }
    } else {
      // only a runner who holds the baton outside an unfinished exchange can drive it
      const target = this.lock <= 0 ? o.vmax * Math.pow(effort, o.effortCurve) : 0;
      const tau = target > this.v ? o.tauUp : o.tauCoast;
      this.v += (target - this.v) * (1 - Math.exp(-dt / tau));
    }
    this.topSpeed = Math.max(this.topSpeed, this.v);

    // move, then everything that was crossed on the way
    const s0 = this.s;
    this.s += this.v * dt;
    const at = (m) => this.t - (this.v > 1e-6 ? (this.s - m) / this.v : 0);
    for (let m = (Math.floor(s0 / o.legM) + 1) * o.legM; m <= this.s && m < this.total; m += o.legM) {
      this.splits.push(at(m));
      ev.push({ type: 'split', mark: m, t: at(m) });
    }
    if (!this.zone && this.leg < o.legs - 1 && this.s >= this.zoneOf(this.leg).start) {
      const k = this.leg;
      this.zone = { k, enterT: at(this.zoneOf(k).start), enterV: this.v, passAt: null, passS: null, passV: null, keep: null, handSec: 0, roughSum: 0, fumbleSec: 0, over: false, dropped: false };
      ev.push({ type: 'zone-enter', k });
    }
    if (this.zone && this.s >= this.zoneOf(this.zone.k).end) {
      const z = this.zone, end = this.zoneOf(z.k).end;
      if (z.passAt == null) {
        z.over = true;
        if (o.rule === 'dq') {
          this.dq = true; this.finished = true;
          ev.push({ type: 'zone-over', k: z.k, dq: true });
        } else {
          this.penalty += o.penaltySec; this.leg++; this.gauge = 0;
          ev.push({ type: 'zone-over', k: z.k, dq: false, penalty: o.penaltySec });
        }
      }
      const sec = at(end) - z.enterT;
      const pass = {
        k: z.k, sec, loss: sec - this.zoneIdealSec, over: z.over, dropped: z.dropped,
        keep: z.keep,                                         // share of the baton speed that survived the hands
        handSec: z.passAt == null ? null : z.handSec,         // real seconds the exchange took
        handAt: z.passS == null ? null : z.passS - this.zoneOf(z.k).start,
        roughAvg: z.handSec > 0 ? z.roughSum / z.handSec : 0,
        fumbleSec: z.fumbleSec, enterV: z.enterV, passV: z.passV, exitV: this.v,
      };
      this.passes.push(pass);
      this.zone = null;
      if (!this.dq) ev.push({ type: 'zone-exit', ...pass });
    }
    if (!this.finished && this.s >= this.total) {
      this.finished = true;
      this.splits.push(at(this.total));
      this.time = at(this.total) + this.penalty;
      ev.push({ type: 'finish', time: this.time, raw: at(this.total), penalty: this.penalty });
    }
    return ev;
  }
}

/**
 * How much the sensor is moving, in units of the calm limit: 0 = still, 1 = at the limit.
 * f is a MotionTracker feature; the largest single axis decides, so one twitch of one axis shows.
 *   gyro[3]  deg/s per axis
 *   lin[3]   G per axis with gravity removed
 */
export const CALM_DEFAULTS = { calmAcc: 0.2, calmGyro: 90 };
export function roughness(f, tune = CALM_DEFAULTS) {
  if (!f) return 0;
  const g = f.gyro ? Math.max(Math.abs(f.gyro[0]), Math.abs(f.gyro[1]), Math.abs(f.gyro[2])) : f.rot || 0;
  const a = f.lin ? Math.max(Math.abs(f.lin[0]), Math.abs(f.lin[1]), Math.abs(f.lin[2])) : f.mag || 0;
  return Math.max(g / tune.calmGyro, a / tune.calmAcc);
}
export function isCalm(f, tune = CALM_DEFAULTS) { return !!f && roughness(f, tune) < 1; }

// ---------------------------------------------------------------- the other seven teams
/**
 * A rival team as a speed profile: out of the blocks like a sprinter, then a dip in each zone.
 * Returns an object with step(dt) -> distance, calibrated so that the team finishes in `targetTime`.
 */
export function makeRivalTeam(targetTime, reaction = 0.16, options = {}) {
  const o = { ...RELAY_DEFAULTS, ...options };
  const total = o.legs * o.legM;
  const dips = [];
  for (let k = 0; k < o.legs - 1; k++) dips.push((k + 1) * o.legM - 5);   // deepest a little before the mark
  const speedAt = (vmax, t, s) => {
    if (t <= reaction) return 0;
    let v = vmax * (1 - Math.exp(-(t - reaction) / 1.25));
    for (const c of dips) { const d = (s - c) / 9; v *= 1 - 0.16 * Math.exp(-d * d); }
    return v;
  };
  const run = (vmax) => { let t = 0, s = 0; while (s < total && t < 200) { s += speedAt(vmax, t, s) * 0.01; t += 0.01; } return t; };
  let lo = 6, hi = 16;
  for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (run(mid) > targetTime) lo = mid; else hi = mid; }
  const vmax = (lo + hi) / 2;
  const team = {
    targetTime, reaction, vmax, t: 0, s: 0, v: 0, finished: false, time: null,
    reset() { team.t = 0; team.s = 0; team.v = 0; team.finished = false; team.time = null; },
    step(dt) {
      team.t += dt;
      if (team.finished) { team.v = Math.max(0, team.v - (team.v * 0.5 + 0.6) * dt); team.s += team.v * dt; return team.s; }
      team.v = speedAt(vmax, team.t, team.s);
      team.s += team.v * dt;
      if (team.s >= total) { team.finished = true; team.time = team.t - (team.s - total) / Math.max(0.01, team.v); }
      return team.s;
    },
  };
  return team;
}

/** 38.412 -> "38.41" */
export function formatTime(sec) {
  if (!Number.isFinite(sec)) return '--.--';
  return (Math.floor(sec * 100) / 100).toFixed(2);
}

/** Grade of one exchange from the share of baton speed it kept, for the result table. */
export function gradePass(pass) {
  if (pass.over) return { grade: '×', ja: 'ゾーンオーバー' };
  if (pass.dropped) return { grade: 'D', ja: 'バトン落下' };
  const keep = pass.keep ?? 0;
  if (keep >= 0.8) return { grade: 'S', ja: '流れるようなパス' };
  if (keep >= 0.7) return { grade: 'A', ja: 'なめらか' };
  if (keep >= 0.58) return { grade: 'B', ja: 'まずまず' };
  if (keep >= 0.42) return { grade: 'C', ja: 'もたついた' };
  return { grade: 'D', ja: '詰まった' };
}
