// motion.js — what a hand-held (or foot-worn) ORPHE CORE is doing, from acceleration + gyro only.
//
// The start game and the relay game ask the same three questions of one sensor:
//   "is it still?"            -> the SET position, the baton exchange
//   "when did it start moving?" -> the reaction to the gun
//   "how hard is it shaken?"  -> running
// Everything here is pure (no DOM, no timers, no imports) so it runs in the Node tests as well.
// Times are milliseconds on the page clock (performance.now()); acceleration is in G, gyro in deg/s.

export const MOTION_DEFAULTS = {
  stillAcc: 0.12,     // G     below this (and stillGyro) the sensor counts as still
  stillGyro: 40,      // deg/s a hand that is "not moving" still trembles by a few deg/s
  moveAcc: 0.35,      // G     above this (or moveGyro) the movement is deliberate
  moveGyro: 120,      // deg/s
  backtrackMs: 150,   // how far before the trigger the start of the movement is searched
  gravityTau: 250,    // ms    low-pass of the resting acceleration (gravity as the sensor sees it)
  bufferMs: 3000,     // history kept for onset search
  staleMs: 300,       // no sample for this long = not known to be still
  shakeAccFull: 2.5,  // G     a shake this strong counts as full effort
  shakeGyroFull: 700, // deg/s
  energyTau: 280,     // ms    smoothing of the shake effort
  swingTau: 350,      // ms    smoothing of the mean angular speed / mean acceleration (swing, shakeG)
  strokeLevel: 0.3,   // effort (0..1) a swing has to reach to count as one stroke
  strokeGapMs: 90,    // two strokes cannot be closer than this
  fallAcc: 0.3,       // G     total acceleration below this = falling (see fallMs)
  linTau: 400,        // ms    high-pass that removes gravity from the per-axis acceleration (lin)
};

/**
 * Maps the sensor's own sample timestamps onto the page clock.
 *
 * BLE delivers packets late and unevenly, so the arrival time of a sample is a poor estimate of
 * when it was measured. The sensor stamps every sample with its own clock; the smallest
 * (arrival - stamp) seen recently is the fastest delivery, and stamp + that offset puts every
 * sample on the page clock without the delivery jitter. What remains is the fastest delivery
 * itself (a constant of the order of 10-30 ms), which this cannot know.
 */
export class SampleClock {
  constructor({ windowMs = 3000, maxSpreadMs = 250 } = {}) {
    this.windowMs = windowMs;
    this.maxSpreadMs = maxSpreadMs;
    this.reset();
  }
  reset() { this.offsets = []; this.usable = true; }
  /** stamp: sensor time in ms (any epoch). arrival: performance.now() when the sample was delivered. */
  map(stamp, arrival) {
    if (!Number.isFinite(stamp)) return arrival;
    const off = arrival - stamp;
    const list = this.offsets;
    // a reconnect, a clock reset or midnight on the sensor's clock: start over
    if (list.length && Math.abs(off - list[list.length - 1].off) > 1000) list.length = 0;
    list.push({ at: arrival, off });
    while (list.length > 1 && arrival - list[0].at > this.windowMs) list.shift();
    // A late packet only raises its own offset, so the minimum ignores it. A clock that wanders
    // against the page clock moves the minimum itself: compare the older and the newer half of
    // the window, and fall back to the arrival time when they disagree.
    const mid = (list[0].at + arrival) / 2;
    let min = Infinity, minOld = Infinity, minNew = Infinity;
    for (const o of list) {
      if (o.off < min) min = o.off;
      if (o.at < mid) { if (o.off < minOld) minOld = o.off; } else if (o.off < minNew) minNew = o.off;
    }
    this.usable = !(Number.isFinite(minOld) && Number.isFinite(minNew)) || Math.abs(minNew - minOld) <= this.maxSpreadMs;
    if (!this.usable) return arrival;
    return Math.min(arrival, stamp + min);
  }
}

export class MotionTracker {
  constructor(options = {}) {
    this.o = { ...MOTION_DEFAULTS, ...options };
    this.reset();
  }
  set(options) { Object.assign(this.o, options); }
  reset() {
    this.buf = [];
    this.g = null;            // resting acceleration vector
    this.lp = null;           // low-passed acceleration (gravity) for the per-axis high-pass
    this.held = false;
    this.stillSince = null;
    this.fallSince = null;
    this.last = null;
    this.energy = 0;
    this.swing = 0;           // deg/s, mean angular speed (see push)
    this.shakeG = 0;          // G, mean acceleration without gravity
    this.strokes = 0;
    this.strokeTimes = [];
    this._strokeArmed = true;
    this._lastStrokeAt = -Infinity;
  }
  /** Freeze the gravity reference (during the SET hold, so the first push is measured against it). */
  hold(on) { this.held = !!on; }

  /** One sample: { t, ax, ay, az, gx, gy, gz }. Returns the derived features for that sample. */
  push(s) {
    const o = this.o;
    const ax = +s.ax || 0, ay = +s.ay || 0, az = +s.az || 0;
    const rot = Math.hypot(+s.gx || 0, +s.gy || 0, +s.gz || 0);
    const norm = Math.hypot(ax, ay, az);
    const mag = Math.abs(norm - 1);                       // rotation-invariant: 0 at rest in any pose
    // free fall: the accelerometer reads almost nothing while the sensor is dropped
    if (norm < o.fallAcc) { if (this.fallSince == null) this.fallSince = s.t; } else this.fallSince = null;
    const prev = this.last;
    const gap = prev ? s.t - prev.t : 5;
    // samples of one BLE packet can share a time when the sensor's stamps are not usable: count
    // each as one nominal 5 ms sample so the filters keep their time constants
    const dt = gap < 1 ? 5 : Math.min(50, gap);
    // nothing was seen during a gap in the stream: stillness (and a fall) cannot span it
    if (gap > o.staleMs) { this.stillSince = null; this.fallSince = null; }
    if (!this.g) this.g = { x: ax, y: ay, z: az };
    // gravity follows the sensor only while it is calm, so a movement is measured against the pose before it
    if (!this.held && mag < o.stillAcc * 1.5 && rot < o.stillGyro * 1.5) {
      const a = 1 - Math.exp(-dt / o.gravityTau);
      this.g.x += (ax - this.g.x) * a; this.g.y += (ay - this.g.y) * a; this.g.z += (az - this.g.z) * a;
    }
    const dyn = Math.hypot(ax - this.g.x, ay - this.g.y, az - this.g.z);
    // per-axis acceleration with gravity taken out by a plain high-pass (it always follows, so a
    // slow turn of the sensor does not read as a lasting push): what the raw traces show
    if (!this.lp) this.lp = { x: ax, y: ay, z: az };
    const b = 1 - Math.exp(-dt / o.linTau);
    this.lp.x += (ax - this.lp.x) * b; this.lp.y += (ay - this.lp.y) * b; this.lp.z += (az - this.lp.z) * b;
    const lin = [ax - this.lp.x, ay - this.lp.y, az - this.lp.z];
    const gyro = [+s.gx || 0, +s.gy || 0, +s.gz || 0];
    const quiet = dyn < o.stillAcc && rot < o.stillGyro;
    const level = Math.max(dyn / o.moveAcc, rot / o.moveGyro);
    if (quiet) { if (this.stillSince == null) this.stillSince = s.t; } else this.stillSince = null;

    // shaking: effort 0..1 per sample, smoothed; strokes are counted on the way up
    const effort = Math.min(1, Math.max(mag / o.shakeAccFull, rot / o.shakeGyroFull));
    this.energy += (effort - this.energy) * (1 - Math.exp(-dt / o.energyTau));
    // The same in physical units, with no ceiling. swing is the mean angular speed in deg/s: for a
    // swing of amplitude A at frequency f it is 4 * A * f, the angle swept per second (what
    // stride length x cadence is to a runner). shakeG is the mean acceleration without gravity.
    const c = 1 - Math.exp(-dt / o.swingTau);
    this.swing += (rot - this.swing) * c;
    this.shakeG += (Math.hypot(lin[0], lin[1], lin[2]) - this.shakeG) * c;
    if (effort >= o.strokeLevel && this._strokeArmed && s.t - this._lastStrokeAt >= o.strokeGapMs) {
      this.strokes++; this._strokeArmed = false; this._lastStrokeAt = s.t;
      this.strokeTimes.push(s.t);
      if (this.strokeTimes.length > 64) this.strokeTimes.shift();
    } else if (effort < o.strokeLevel * 0.6) {
      this._strokeArmed = true;
    }

    const f = { t: s.t, mag, dyn, rot, quiet, level, effort, lin, gyro, fallMs: this.fallSince == null ? 0 : s.t - this.fallSince };
    this.buf.push(f);
    while (this.buf.length > 1 && s.t - this.buf[0].t > o.bufferMs) this.buf.shift();
    this.last = f;
    return f;
  }

  /** True when no sample has arrived recently (disconnected, or not connected yet). */
  stale(now) { return !this.last || now - this.last.t > this.o.staleMs; }
  /**
   * A sensor is (or was a moment ago) in use. While this is true a stale stream means "lost",
   * not "keyboard only": the games must not read it as still or calm.
   */
  inUse(now, withinMs = 5000) { return !!this.last && now - this.last.t <= withinMs; }
  /** How long the sensor has been continuously still, in ms (0 when moving or stale). */
  stillMs(now) {
    if (this.stillSince == null || this.stale(now)) return 0;
    return Math.max(0, this.last.t - this.stillSince);
  }
  /** Strokes per second over the last `windowMs`. */
  cadence(now, windowMs = 1000) {
    let n = 0;
    for (let i = this.strokeTimes.length - 1; i >= 0 && now - this.strokeTimes[i] <= windowMs; i--) n++;
    return (n * 1000) / windowMs;
  }
  /** Let the smoothed effort fall when samples stop coming (so a dropped connection is not "running"). */
  decay(now) { if (this.stale(now)) { this.energy *= 0.9; this.swing *= 0.9; this.shakeG *= 0.9; } }

  /**
   * The first deliberate movement at or after `since`.
   * The trigger is the first sample past the move thresholds; the onset is where that movement
   * began to rise from the resting level, searched back from the trigger (never before `since`).
   * Returns { t, trigger, peak } or null.
   */
  findOnset(since) {
    const buf = this.buf, o = this.o;
    let i = -1;
    for (let k = 0; k < buf.length; k++) {
      if (buf[k].t >= since && buf[k].level >= 1) { i = k; break; }
    }
    if (i < 0) return null;
    // The level the sensor sat at before this movement. With the gravity reference frozen, a hand
    // that has slowly sagged reads a constant offset; searching back to "quiet" would then run the
    // full backtrack window and date the movement far too early. So the start of the movement is
    // where the level rose 30 % of the way from that resting level to the trigger level.
    const rest = [];
    for (let k = i - 1; k >= 0 && buf[i].t - buf[k].t <= o.backtrackMs + 300; k--) {
      if (buf[i].t - buf[k].t > o.backtrackMs) rest.push(buf[k].level);
    }
    rest.sort((a, b) => a - b);
    const base = rest.length ? Math.min(1, rest[rest.length >> 1]) : 0;
    const rise = base + 0.3 * (1 - base);
    let j = i;
    while (j > 0 && buf[j - 1].t >= since && buf[i].t - buf[j - 1].t <= o.backtrackMs && buf[j - 1].level >= rise) j--;
    let peak = 0;
    for (let k = i; k < buf.length && buf[k].t - buf[i].t <= 200; k++) peak = Math.max(peak, buf[k].level);
    return { t: buf[j].t, trigger: buf[i].t, peak };
  }
}
