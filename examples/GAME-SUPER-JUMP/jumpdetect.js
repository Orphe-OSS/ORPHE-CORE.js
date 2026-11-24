// jumpdetect.js — how high did the player really jump? From the acceleration and the
// quaternion of one sensor on the foot.
//
// The method is the one of ORPHE JUMP OVER by hyuga saka (docs/jump.js of
// https://github.com/shiratsumu/orphe-jump-over), ported to an ES module for this game:
//
//   1. take-off  the first sample with |acceleration| above TO_G
//   2. landing   the first sample with |acceleration| above LD_G, at least MIN_FLIGHT after the
//                take-off (a swinging foot reaches about 6 G in the air, so the landing is the
//                10 G impact)
//   3. height    the acceleration is turned into world coordinates with the quaternion, projected
//                on the direction of gravity measured before the take-off, and integrated twice;
//                the drift is removed by the constraint that the foot is on the floor at both ends
//   4. cm = CAL_A × raw + CAL_B, fitted to video of the sole of the shoe (9 jumps, MAE 2.5 cm)
//
// What the game adds:
//   enabled      while false the samples are only buffered (they are the gravity reference of
//                the next jump) and no take-off is reported: the stamping of the run-up would
//                otherwise count as jumps
//   soft landing a low hop comes down with less than LD_G, and BLE drops samples (the one sample
//                of the impact among them). When the foot is at rest again after a take-off,
//                the jump is over: it is reported as { type: 'soft', flight } and the game takes
//                the height of a free fall of that duration (first played on 2026-11-23: the
//                third jump of a triple jump waited a second for an impact that never came)
//   flightHeightCm()   the height a flight of T seconds has by free fall alone, for the live
//                gauge while the player is in the air and as a fallback when step 3 is rejected
//
// No DOM: tests/super-jump-detect.test.js runs it in Node.

const G = 9.80665;

export const DETECT_DEFAULTS = {
  TO_G: 6.0,          // take-off [G]
  LD_G: 10.0,         // landing [G]
  MIN_FLIGHT: 0.25,   // [s]
  MAX_FLIGHT: 1.0,    // [s]
  REF_FROM: 1.5,      // gravity reference: from 1.5 s before the take-off
  REF_TO: 0.5,        //                    to 0.5 s before it
  SOFT_G: 4.0,        // a landing softer than LD_G: the largest impact above this ...
  SOFT_STILL: 0.15,   // ... once the foot has then been at rest (|a| about 1 G) for this long [s]
  REFRACTORY: 0.3,    // [s] after a landing (the triple jump asks for the next jump soon)
  CAL_A: 0.8628,      // linear correction against the video (analysis/jump_model.py of the original)
  CAL_B: 5.0192,
  BUFFER_SEC: 4.0,
};

/** Height [cm] reached in a flight of T seconds by free fall alone: g T² / 8. */
export function flightHeightCm(T) {
  return T > 0 ? (G * T * T / 8) * 100 : 0;
}

function rotate(q, v) {
  // v' = v + 2 u × (u × v + w v)
  const ux = q.x, uy = q.y, uz = q.z, w = q.w;
  const cx = uy * v[2] - uz * v[1] + w * v[0];
  const cy = uz * v[0] - ux * v[2] + w * v[1];
  const cz = ux * v[1] - uy * v[0] + w * v[2];
  return [
    v[0] + 2 * (uy * cz - uz * cy),
    v[1] + 2 * (uz * cx - ux * cz),
    v[2] + 2 * (ux * cy - uy * cx),
  ];
}

export class JumpDetector {
  constructor(opts = {}) {
    this.p = { ...DETECT_DEFAULTS, ...opts };
    this.enabled = true;
    this.reset();
  }

  reset() {
    this.buf = [];             // { t, w: [x, y, z] world acceleration, an: |a| }
    this.state = 'ground';
    this.takeoff = null;       // buffer entry
    this.refractoryUntil = -Infinity;
    this.peak = null; this.stillFrom = null; this.stillN = 0; this.lastFall = null;
  }

  /** Forget a take-off in progress (the buffer stays: it is the gravity reference). */
  disarm() {
    this.state = 'ground';
    this.takeoff = null;
    this.refractoryUntil = -Infinity;
  }

  /**
   * Add one sample.
   * @param {number} t seconds
   * @param {{x,y,z}} acc acceleration [G]
   * @param {{w,x,y,z}} quat quaternion (need not be normalised)
   * @returns {null | {type:'takeoff'|'cancel'|'jump'|'soft'|'rejected', ...}}
   */
  push(t, acc, quat) {
    const p = this.p;
    const last = this.buf[this.buf.length - 1];
    if (last && t <= last.t) return null;  // duplicates and steps back in time are dropped
    if (!acc || !quat || !Number.isFinite(acc.x + acc.y + acc.z) || !Number.isFinite(quat.w + quat.x + quat.y + quat.z)) return null;

    const n = Math.hypot(quat.w, quat.x, quat.y, quat.z) || 1;
    const q = { w: quat.w / n, x: quat.x / n, y: quat.y / n, z: quat.z / n };
    const a = [acc.x, acc.y, acc.z];
    const s = { t, w: rotate(q, a), an: Math.hypot(a[0], a[1], a[2]) };
    this.buf.push(s);
    while (this.buf.length && this.buf[0].t < t - p.BUFFER_SEC) this.buf.shift();

    if (!this.enabled) {
      if (this.state !== 'ground') this.disarm();
      return null;
    }

    if (this.state === 'ground') {
      if (s.an > p.TO_G && t >= this.refractoryUntil) {
        this.state = 'air';
        this.takeoff = s;
        this.peak = null; this.stillFrom = null; this.stillN = 0; this.lastFall = null;
        return { type: 'takeoff', t };
      }
      return null;
    }

    // state === 'air'
    const dt = t - this.takeoff.t;
    if (dt > p.MAX_FLIGHT) {
      this.state = 'ground';
      this.takeoff = null;
      return { type: 'cancel', t };
    }
    if (dt >= p.MIN_FLIGHT && s.an > p.LD_G) {
      const res = this._estimate(this.takeoff, s);
      this.state = 'ground';
      this.takeoff = null;
      this.refractoryUntil = t + p.REFRACTORY;
      return res;
    }
    // a soft landing: at rest again
    if (dt >= 0.12 && s.an >= p.SOFT_G && (!this.peak || s.an > this.peak.an)) this.peak = s;
    if (s.an < 0.6) this.lastFall = s;      // falling freely: still in the air here
    if (s.an > 0.85 && s.an < 1.15) { if (!this.stillFrom) { this.stillFrom = s; this.stillN = 0; } this.stillN++; } else this.stillFrom = null;
    if (dt >= p.MIN_FLIGHT && this.stillFrom && this.stillN >= 8 && t - this.stillFrom.t >= p.SOFT_STILL) {
      const peak = this.peak && this.peak.t <= this.stillFrom.t ? this.peak : null;
      // no impact seen (lost samples): only the part of the flight that was seen falling counts
      const end = peak || (this.lastFall && this.lastFall.t <= this.stillFrom.t ? this.lastFall : null);
      const flight = end ? end.t - this.takeoff.t : 0;
      this.state = 'ground';
      this.takeoff = null;
      this.refractoryUntil = t;
      return { type: 'soft', t, flight: Math.max(0, flight), impact: peak ? peak.an : null };
    }
    return null;
  }

  _estimate(to, ld) {
    const p = this.p;
    const t0 = to.t, t1 = ld.t, T = t1 - t0;

    // gravity in world coordinates: the mean over a stretch before the take-off
    let gx = 0, gy = 0, gz = 0, nRef = 0;
    for (const s of this.buf) {
      if (s.t > t0 - p.REF_FROM && s.t < t0 - p.REF_TO) {
        gx += s.w[0]; gy += s.w[1]; gz += s.w[2]; nRef++;
      }
    }
    if (nRef < 20) return { type: 'rejected', reason: 'no-reference', t: t1, flight: T };
    gx /= nRef; gy /= nRef; gz /= nRef;
    const gm = Math.hypot(gx, gy, gz);
    if (!(gm > 0.3)) return { type: 'rejected', reason: 'no-gravity', t: t1, flight: T };
    const up = [gx / gm, gy / gm, gz / gm];
    // At rest the measured magnitude is used (it cancels a scale error of the accelerometer).
    // When the foot was not at rest before the take-off (the stamping of the run-up, or the
    // previous jump of a triple jump, whose free fall pulls the mean down) the direction is
    // still good, but the magnitude is not: gravity is 1 G.
    const still = Math.abs(gm - 1) < 0.15;
    const g0 = still ? gm : 1;

    // integrate twice from the take-off to the landing
    const seg = this.buf.filter((s) => s.t >= t0 && s.t <= t1);
    const tt = [], z = [];
    let v = 0, zz = 0, prevA = null, prevV = 0;
    for (let i = 0; i < seg.length; i++) {
      const s = seg[i];
      const av = (s.w[0] * up[0] + s.w[1] * up[1] + s.w[2] * up[2] - g0) * G;
      const ti = s.t - t0;
      if (i > 0) {
        const h = ti - tt[i - 1];
        v += (av + prevA) / 2 * h;
        zz += (v + prevV) / 2 * h;
      }
      tt.push(ti); z.push(zz);
      prevA = av; prevV = v;
    }
    const zEnd = z[z.length - 1];
    const traj = z.map((zi, i) => zi - zEnd * tt[i] / T);  // z(T) = 0: corrects the unknown speed at take-off
    let apex = 0, apexT = 0;
    traj.forEach((zi, i) => { if (zi > apex) { apex = zi; apexT = tt[i]; } });

    const raw = apex * 100;
    const cm = p.CAL_A * raw + p.CAL_B;
    if (!(raw >= 3 && raw <= 200)) return { type: 'rejected', reason: 'out-of-range', raw, t: t1, flight: T };
    return { type: 'jump', t: t1, takeoffT: t0, landingT: t1, flight: T, raw, cm, apexT, still, samples: seg.length };
  }
}

/** A continuous time [s] from the serial number (uint16, 20 ms per packet) and the number inside the packet (0..3, 5 ms). */
export class SerialClock {
  constructor() { this.reset(); }
  reset() { this.base = null; this.prev = null; this.wraps = 0; this.aStart = null; this.aT = 0; }
  /**
   * For sensors without serial numbers (about 50 Hz, one sample per notification): count × 20 ms
   * (BLE delivers in bursts, so the arrival time itself is not used); when more than 100 ms are
   * missing, the clock is moved forward by that much.
   */
  arrival(nowMs, stepSec = 0.02) {
    if (this.aStart == null) { this.aStart = nowMs; this.aT = -stepSec; }
    this.aT += stepSec;
    const lag = (nowMs - this.aStart) / 1000 - this.aT;
    if (lag > 0.1) this.aT += lag;
    return this.aT;
  }
  time(serial, packet) {
    if (this.prev !== null && serial < this.prev && this.prev - serial > 32768) this.wraps++;
    this.prev = serial;
    const u = serial + this.wraps * 65536;
    if (this.base === null) this.base = u;
    return (u - this.base) * 0.02 + packet * 0.005;
  }
}
