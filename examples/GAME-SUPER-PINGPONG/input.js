// input.js — turns ORPHE CORE orientation into one tilt angle and a paddle position.
//
// The sensor may sit on the instep (ankle dorsi/plantarflexion) or on the thigh
// (thigh raises), in any orientation. Instead of trusting one Euler axis, the tilt
// is measured from the direction of gravity in the sensor frame:
//
//   g  = gravity ("up") seen by the sensor, from the quaternion
//   g0 = g in the resting pose
//   a  = the axis g turns around when the player moves "up" (found by calibration)
//   tilt = signed angle from g0 to g around a
//
// g depends only on the sensor's inclination, so the gyro's slow yaw drift never
// moves the paddle. Before calibration a = -Y, which makes tilt equal to the SDK's
// euler.pitch (minus the resting pitch), i.e. the original game's control.
//
// No imports and no DOM: tests/pingpong-game.test.js loads this file in Node.

export const RAD2DEG = 180 / Math.PI;
export const DEFAULT_AXIS = [0, -1, 0];
/** Range (degrees) used until the player calibrates. */
export const DEFAULT_RANGE = { ankle: { up: 18, down: 18 }, thigh: { up: 25, down: 0 } };
/** The paddle never needs less than this many degrees end to end, however small the calibrated range. */
export const MIN_SPAN_DEG = 10;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

/**
 * Earth's up axis in sensor coordinates: the third row of the rotation matrix of q.
 * The SDK's euler.pitch / euler.roll are functions of this vector only
 * (pitch = -asin(g.x), roll = atan2(g.y, g.z)).
 */
export function gravityFromQuat(q) {
  const { w, x, y, z } = q;
  return [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}

/**
 * Signed angle (radians) from g0 to g around `axis`, both projected onto the plane
 * perpendicular to the axis. Returns null when either vector is almost parallel to
 * the axis (the movement is not a rotation about this axis).
 */
export function signedTilt(g, g0, axis) {
  const d = dot(g, axis), d0 = dot(g0, axis);
  const p = [g[0] - d * axis[0], g[1] - d * axis[1], g[2] - d * axis[2]];
  const p0 = [g0[0] - d0 * axis[0], g0[1] - d0 * axis[1], g0[2] - d0 * axis[2]];
  const n = norm(p), n0 = norm(p0);
  if (n < 0.2 || n0 < 0.2) return null;
  return Math.atan2(dot(cross(p0, p), axis) / (n * n0), dot(p0, p) / (n * n0));
}

/** Eigenvectors of a symmetric 3x3 matrix (cyclic Jacobi). Returns [{ value, vector }] sorted by value, largest first. */
export function eigenSym3(m) {
  const a = [m[0].slice(), m[1].slice(), m[2].slice()];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 12; sweep++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-14) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), sn = t * c;
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - sn * y; a[k][q] = sn * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - sn * y; a[q][k] = sn * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - sn * y; v[k][q] = sn * x + c * y; }
    }
  }
  return [0, 1, 2].map((i) => ({ value: a[i][i], vector: [v[0][i], v[1][i], v[2][i]] })).sort((x, y) => y.value - x.value);
}

/**
 * Learning the control from play, without a calibration step: gravity samples of the
 * last AUTO.windowSec seconds lie on an arc; the normal of the plane through them is
 * the axis of the movement, and the 4th..96th percentile of the tilt along it is the
 * range in use. Refitted twice a second, so the range follows a player who tires.
 */
export const AUTO = { windowSec: 45, sampleMs: 100, fitMs: 500, minSamples: 20, minSpreadDeg: 2.5, lockSpanDeg: 12 };

/** 1€ filter (Casiez et al. 2012): heavy smoothing at rest, little lag in fast movements. */
export class OneEuro {
  constructor(minCutoff = 2, beta = 0.04, dCutoff = 1.5) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.reset();
  }
  reset() { this.x = null; this.dx = 0; }
  filter(value, dt) {
    if (this.x === null || !(dt > 0)) { this.x = value; this.dx = 0; return value; }
    const alpha = (cutoff) => { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); };
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff) * (rawDx - this.dx);
    this.x += alpha(this.minCutoff + this.beta * Math.abs(this.dx)) * (value - this.x);
    return this.x;
  }
}

/** `smooth` 0..1 (settings slider) -> minimum cutoff of the 1€ filter, 9 Hz .. 0.8 Hz. */
export function cutoffForSmooth(smooth) {
  return 9 * (0.8 / 9) ** clamp(smooth, 0, 1);
}

/** One player's control: fed by quaternions from a CORE, or by keys / pointer when no CORE is streaming. */
export class TiltInput {
  constructor(id) {
    this.id = id;
    this.exercise = 'ankle';
    this.settings = { gain: 1.25, invert: false, smooth: 0.4 };
    this.axis = DEFAULT_AXIS.slice();
    this.range = { ...DEFAULT_RANGE.ankle };
    this.calibrated = false;
    this.g = null;            // latest gravity direction
    this.g0 = null;           // resting gravity direction
    this.rawDeg = 0;          // unfiltered tilt
    this.deg = 0;             // filtered tilt, degrees, + = up
    this.vel = 0;             // deg/s
    this.hz = 100;            // measured sample rate
    this.lastSampleAt = -1e9;
    this.samples = 0;
    this.filter = new OneEuro(cutoffForSmooth(this.settings.smooth));
    this._zero = { sum: [0, 0, 0], n: 0 };
    this._rate = { count: 0, since: null };
    this._virtualAt = -1e9;
    /** True once the axis and range have been learned from the player's own movement (see AUTO). */
    this.autoFitted = false;
    this._auto = { buf: [], lastPush: -1e9, lastFit: -1e9, rest: null, signLocked: false };
    /** Set when a stored calibration had to be dropped because it does not fit today's mounting. */
    this.staleCalibration = false;
  }

  /**
   * The tilt cannot be measured around an axis that gravity lies along (the projected
   * vectors vanish). Called whenever the resting pose changes: drop a calibration that
   * no longer fits and fall back to whichever sensor axis is usable.
   */
  _fixAxis() {
    if (!this.g0 || Math.abs(dot(this.g0, this.axis)) <= 0.94) return;
    if (this.calibrated) {
      this.calibrated = false;
      this.range = { ...DEFAULT_RANGE[this.exercise] };
      this.staleCalibration = true;
    }
    this.axis = Math.abs(dot(this.g0, DEFAULT_AXIS)) <= 0.94 ? DEFAULT_AXIS.slice() : [1, 0, 0];
  }

  /** True while a CORE has delivered a sample in the last 1.2 s. */
  isLive(now) { return now - this.lastSampleAt < 1200; }
  /** 'core' | 'keys' — what currently drives this player. */
  source(now) { return this.isLive(now) ? 'core' : 'keys'; }

  setExercise(exercise) {
    this.exercise = exercise === 'thigh' ? 'thigh' : 'ankle';
    if (!this.calibrated) this.range = { ...DEFAULT_RANGE[this.exercise] };
  }

  setSmooth(smooth) {
    this.settings.smooth = clamp(smooth, 0, 1);
    this.filter.minCutoff = cutoffForSmooth(this.settings.smooth);
  }

  /** Forget the sensor state (CORE disconnected or re-mounted). The calibrated range is kept. */
  resetStream() {
    this.g = null; this.g0 = null;
    this._zero = { sum: [0, 0, 0], n: 0 };
    this._rate = { count: 0, since: null };
    this.lastSampleAt = -1e9;
    this.filter.reset();
    this.rawDeg = 0; this.deg = 0; this.vel = 0;
    this._resetAuto();
  }

  _resetAuto() {
    this.autoFitted = false;
    this._auto = { buf: [], lastPush: -1e9, lastFit: -1e9, rest: null, signLocked: false };
  }

  /** Collect gravity samples and refit axis and range (only while no measured calibration is in use). */
  _autoFeed(now) {
    const A = this._auto;
    if (!A.rest) A.rest = this.g0.slice();   // the pose the player sat in when the stream started
    if (now - A.lastPush < AUTO.sampleMs) return;
    A.lastPush = now;
    A.buf.push(this.g);
    const cap = Math.round((AUTO.windowSec * 1000) / AUTO.sampleMs);
    if (A.buf.length > cap) A.buf.shift();
    if (A.buf.length < AUTO.minSamples || now - A.lastFit < AUTO.fitMs) return;
    A.lastFit = now;
    const n = A.buf.length;
    const m = [0, 0, 0];
    for (const g of A.buf) { m[0] += g[0] / n; m[1] += g[1] / n; m[2] += g[2] / n; }
    const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const g of A.buf) { const d = [g[0] - m[0], g[1] - m[1], g[2] - m[2]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i][j] += (d[i] * d[j]) / n; }
    const eig = eigenSym3(c);
    if (Math.sqrt(Math.max(0, eig[0].value)) * RAD2DEG < AUTO.minSpreadDeg) return;   // not moving (yet)
    let axis = unit(eig[2].vector);
    if (dot(axis, this.axis) < 0) axis = [-axis[0], -axis[1], -axis[2]];
    const rest = signedTilt(A.rest, A.rest, axis) === null ? unit(m) : A.rest;
    const tilts = [];
    for (const g of A.buf) { const t = signedTilt(g, rest, axis); if (t !== null) tilts.push(t * RAD2DEG); }
    if (tilts.length < AUTO.minSamples) return;
    tilts.sort((x, y) => x - y);
    const pick = (f) => tilts[Math.round(f * (tilts.length - 1))];
    let lo = pick(0.04), hi = pick(0.96);
    // which way is "up"? Seated, the resting foot or thigh is at the bottom of its travel,
    // so the larger excursion from the resting pose is the raise. Decided once, then kept.
    if (!A.signLocked && hi - lo >= AUTO.lockSpanDeg) {
      if (-lo > hi) { axis = [-axis[0], -axis[1], -axis[2]]; [lo, hi] = [-hi, -lo]; }
      A.signLocked = true;
    }
    const k = this.autoFitted ? 0.5 : 1;
    const grow = (cur, next) => cur + (next > cur ? 0.5 : 0.08) * (next - cur);   // widen quickly, narrow slowly
    this.axis = unit([this.axis[0] + k * (axis[0] - this.axis[0]), this.axis[1] + k * (axis[1] - this.axis[1]), this.axis[2] + k * (axis[2] - this.axis[2])]);
    this.g0 = rest.slice();
    this.range = this.autoFitted ? { up: grow(this.range.up, hi), down: grow(this.range.down, -lo) } : { up: hi, down: -lo };
    this.autoFitted = true;
  }

  /** Make the current pose the resting pose. */
  setZero() {
    if (this.g) this.g0 = this.g.slice();
    this._resetAuto();
    this._fixAxis();
    this.filter.reset();
    this.rawDeg = 0; this.deg = 0; this.vel = 0;
  }

  /** One orientation sample from the CORE. `now` is performance.now() in ms. */
  feedQuat(q, now) {
    if (!q || !Number.isFinite(q.w)) return;
    const g = gravityFromQuat(q);
    if (!(norm(g) > 0.5)) return;   // not a unit quaternion yet (all zero right after connecting)
    this.g = unit(g);
    this.lastSampleAt = now;
    this.samples++;

    // sample rate: packets carry several samples, so arrival times cannot be used per sample
    const rate = this._rate;
    if (rate.since === null) rate.since = now;
    rate.count++;
    if (now - rate.since >= 1000) {
      const measured = (rate.count * 1000) / (now - rate.since);
      if (measured > 10 && measured < 500) this.hz += 0.5 * (measured - this.hz);
      rate.count = 0; rate.since = now;
    }

    // the first quarter of a second defines the resting pose until the player calibrates
    if (!this.g0) {
      const z = this._zero;
      z.sum[0] += this.g[0]; z.sum[1] += this.g[1]; z.sum[2] += this.g[2];
      if (++z.n < 25) return;
      this.g0 = unit(z.sum);
      this._fixAxis();
    }

    if (!this.calibrated) this._autoFeed(now);
    const tilt = signedTilt(this.g, this.g0, this.axis);
    if (tilt === null) return;
    this.rawDeg = tilt * RAD2DEG;
    this.deg = this.filter.filter(this.rawDeg, 1 / this.hz);
    this.vel = this.filter.dx;
  }

  /** Keyboard control: dir = +1 (up key), -1 (down key) or 0, called once per frame. */
  stepVirtual(dir, dt, now) {
    if (this.isLive(now)) return;
    const lo = -this.range.down - 2, hi = this.range.up + 2;
    const speed = (hi - lo) * 1.15;   // end to end in a bit under a second
    const next = clamp(this.deg + dir * speed * dt, lo, hi);
    this.vel = dt > 0 ? (next - this.deg) / dt : 0;
    this.deg = next; this.rawDeg = next;
    if (dir) this._virtualAt = now;
  }

  /** Pointer / touch control: p = paddle position -1..1. */
  setVirtualPosition(p, dt, now) {
    if (this.isLive(now)) return;
    const lo = -this.range.down, hi = this.range.up;
    const span = Math.max(MIN_SPAN_DEG, hi - lo);
    const want = clamp(p, -1, 1) * (this.settings.invert ? -1 : 1) / this.settings.gain;
    const next = (lo + hi) / 2 + (want * span) / 2;
    this.vel = dt > 0 ? (next - this.deg) / dt : 0;
    this.deg = next; this.rawDeg = next;
    this._virtualAt = now;
  }

  /** Paddle position, -1 (near / down) .. +1 (far / up). */
  position() {
    const lo = -this.range.down, hi = this.range.up;
    const span = Math.max(MIN_SPAN_DEG, hi - lo);
    let p = ((this.deg - (lo + hi) / 2) / (span / 2)) * this.settings.gain;
    if (this.settings.invert) p = -p;
    return clamp(p, -1, 1);
  }

  /** What to store so the next session can reuse this calibration. */
  exportCalibration() {
    return this.calibrated ? { axis: this.axis.slice(), up: this.range.up, down: this.range.down, exercise: this.exercise } : null;
  }

  /** Reuse a stored calibration: same axis and range, resting pose taken from the current pose. */
  importCalibration(saved) {
    if (!saved || !Array.isArray(saved.axis) || !(saved.up + saved.down > 0)) return false;
    this.axis = unit(saved.axis);
    this.range = { up: saved.up, down: saved.down };
    this.calibrated = true;
    return true;
  }

  clearCalibration() {
    this.calibrated = false;
    this.axis = DEFAULT_AXIS.slice();
    this.range = { ...DEFAULT_RANGE[this.exercise] };
    this._resetAuto();
    this._fixAxis();
  }
}

export const CALIB_SECONDS = { rest: 2.5, up: 4, down: 4 };
/** Below this many degrees of "up" movement the calibration is rejected. */
export const CALIB_MIN_UP_DEG = 5;

/**
 * Three-step range measurement for one player:
 *   rest (hold still) -> up (move up as far as comfortable) -> down (the other way)
 * Call update(dt) every frame; read phase / progress / liveDeg for the UI.
 * With no CORE streaming there is nothing to measure and it finishes at once.
 */
export class Calibrator {
  constructor(input) {
    this.input = input;
    this.phase = 'idle';      // idle | rest | up | down | done | failed
    this.t = 0;
    this.liveDeg = 0;         // what the gauge shows
    this.result = null;       // { up, down } in degrees
    this.reason = '';
  }

  get progress() {
    const total = CALIB_SECONDS[this.phase];
    return total ? clamp(this.t / total, 0, 1) : this.phase === 'done' ? 1 : 0;
  }

  start(now) {
    this.t = 0; this.liveDeg = 0; this.result = null; this.reason = '';
    this._g0Sum = [0, 0, 0]; this._restN = 0; this._restRetries = 0;
    this._gs = null; this._best = { deg: 0, g: null }; this._min = 0; this._max = 0;
    if (!this.input.isLive(now) || !this.input.g) {
      this.phase = 'done';
      this.result = { ...this.input.range };
      this.reason = 'no-sensor';
      return;
    }
    this.phase = 'rest';
  }

  update(dt, now) {
    const input = this.input;
    if (this.phase === 'idle' || this.phase === 'done' || this.phase === 'failed') return;
    if (!input.isLive(now) || !input.g) { this.phase = 'failed'; this.reason = 'lost'; return; }
    this.t += dt;
    // short exponential average, so a single noisy sample cannot set the range
    const k = clamp(dt / 0.12, 0, 1);
    this._gs = this._gs ? unit([this._gs[0] + k * (input.g[0] - this._gs[0]), this._gs[1] + k * (input.g[1] - this._gs[1]), this._gs[2] + k * (input.g[2] - this._gs[2])]) : input.g.slice();
    const g = this._gs;

    if (this.phase === 'rest') {
      this._g0Sum[0] += g[0]; this._g0Sum[1] += g[1]; this._g0Sum[2] += g[2]; this._restN++;
      const meanG = unit(this._g0Sum);
      const drift = Math.acos(clamp(dot(meanG, g), -1, 1)) * RAD2DEG;
      this.liveDeg = 0;
      if (drift > 4 && this._restRetries < 3) {   // moved: measure the rest again
        this._g0Sum = [0, 0, 0]; this._restN = 0; this.t = 0; this._restRetries++;
        return;
      }
      if (this.t >= CALIB_SECONDS.rest) { this._g0 = meanG; this._next('up'); }
    } else if (this.phase === 'up') {
      const deg = Math.acos(clamp(dot(this._g0, g), -1, 1)) * RAD2DEG;
      this.liveDeg = deg;
      if (deg > this._best.deg) this._best = { deg, g: g.slice() };
      if (this.t >= CALIB_SECONDS.up) {
        if (this._best.deg < CALIB_MIN_UP_DEG) { this.phase = 'failed'; this.reason = 'small'; return; }
        this._axis = unit(cross(this._g0, this._best.g));
        this._max = this._best.deg;
        this._next('down');
      }
    } else if (this.phase === 'down') {
      const tilt = signedTilt(g, this._g0, this._axis);
      if (tilt !== null) {
        this.liveDeg = tilt * RAD2DEG;
        this._min = Math.min(this._min, this.liveDeg);
        this._max = Math.max(this._max, this.liveDeg);
      }
      if (this.t >= CALIB_SECONDS.down) this._finish();
    }
  }

  _next(phase) { this.phase = phase; this.t = 0; }

  _finish() {
    const input = this.input;
    let up = this._max, down = Math.max(0, -this._min);
    if (down < 2) down = 0;   // a one-sided movement (thigh raise): rest is the bottom
    const span = up + down;
    if (span < MIN_SPAN_DEG) { const s = MIN_SPAN_DEG / span; up *= s; down *= s; }
    input.g0 = this._g0.slice();
    input.axis = this._axis.slice();
    input.range = { up, down };
    input.calibrated = true;
    input.filter.reset();
    this.result = { up: this._max, down: Math.max(0, -this._min) };
    this.phase = 'done';
  }
}
