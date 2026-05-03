/*!
 * CoreAnalytics.js — analytics helpers for ORPHE CORE.js
 *
 * Status: 0.0.1-draft (Claude proposal). API is unstable.
 * Owner: Claude draft, Codex API review (see docs/agents.md).
 *
 * This module is intentionally separate from `js/ORPHE-CORE.js`. It does not
 * touch the BLE layer, does not subscribe to characteristics, and does not
 * replace the existing callback model. Users wire it up by calling the
 * `feed*` methods from their existing `gotAcc` / `gotConvertedAcc` /
 * `gotGyro` / `gotEuler` / `gotGait` / `gotStride` / `gotPronation` /
 * `gotStepsNumber` / `gotLandingImpact` / `gotFootAngle` handlers.
 *
 * Why opt-in feeds rather than auto-attach: keeping the wiring explicit means
 *   1. user code remains the single source of truth for callback ownership,
 *   2. existing examples that already define `gotX` handlers are not silently
 *      overwritten,
 *   3. analytics can be unit-tested by feeding synthetic samples without a
 *      device.
 *
 * Browser usage (no bundler):
 *   <script src="../../js/CoreAnalytics.js"></script>
 *   const analytics = new CoreAnalytics();
 *   analytics.startSession('warm-up');
 *   bles[0].gotConvertedAcc = function (acc) { analytics.feedAcc(acc); };
 *   bles[0].gotGait         = function (gait) { analytics.feedGait(gait); };
 *   // ...
 *   const summary = analytics.endSession();
 *
 * Node / test usage:
 *   const CoreAnalytics = require('./js/CoreAnalytics.js');
 *   const a = new CoreAnalytics({ now: () => 0 });
 *   a.feedGait({ steps: 1, swing_phase_duration: 0.45, standing_phase_duration: 0.55 });
 */

(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CoreAnalytics = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /** Schema identifier for session summaries this module emits. */
    var SESSION_SCHEMA_VERSION = '0.0.1-draft';

    /** Default ring-buffer length for sample retention. */
    var DEFAULT_BUFFER_SIZE = 2048;

    /** Default acceleration thresholds for CMJ event detection (in G). */
    var DEFAULT_CMJ_LOW_G = 0.6;
    var DEFAULT_CMJ_HIGH_G = 4.0;

    function nowMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    function isFiniteNumber(value) {
        return typeof value === 'number' && isFinite(value);
    }

    function vectorMagnitude(v) {
        if (!v) return 0;
        var x = isFiniteNumber(v.x) ? v.x : 0;
        var y = isFiniteNumber(v.y) ? v.y : 0;
        var z = isFiniteNumber(v.z) ? v.z : 0;
        return Math.sqrt(x * x + y * y + z * z);
    }

    function pushBounded(array, value, maxLength) {
        array.push(value);
        if (array.length > maxLength) {
            array.splice(0, array.length - maxLength);
        }
    }

    function mean(values) {
        if (!values || values.length === 0) return 0;
        var sum = 0;
        for (var i = 0; i < values.length; i++) sum += values[i];
        return sum / values.length;
    }

    function stddev(values) {
        if (!values || values.length === 0) return 0;
        var m = mean(values);
        var sq = 0;
        for (var i = 0; i < values.length; i++) {
            var d = values[i] - m;
            sq += d * d;
        }
        return Math.sqrt(sq / values.length);
    }

    /**
     * Robinson-style symmetry index, expressed as a percent.
     * SI = 2 * |right - left| / (right + left) * 100
     *
     * @param {number} left
     * @param {number} right
     * @returns {number} symmetry index (0 = identical, larger = more asymmetric)
     */
    function symmetryIndex(left, right) {
        if (!isFiniteNumber(left) || !isFiniteNumber(right)) return NaN;
        var sum = right + left;
        if (sum === 0) return NaN;
        return (2 * Math.abs(right - left) / sum) * 100;
    }

    /**
     * Estimate jump height from flight time, assuming take-off and landing
     * positions are the same: h = g * t^2 / 8.
     *
     * @param {number} flightSec
     * @param {number} [gravity=9.81]
     * @returns {number} height in meters (NaN if flightSec is invalid)
     */
    function jumpHeightFromFlightTime(flightSec, gravity) {
        if (!isFiniteNumber(flightSec) || flightSec <= 0) return NaN;
        var g = isFiniteNumber(gravity) ? gravity : 9.81;
        return (g * flightSec * flightSec) / 8;
    }

    /**
     * @typedef {Object} CoreAnalyticsOptions
     * @property {number} [bufferSize=2048]   Maximum samples to retain per stream.
     * @property {() => number} [now]         Clock function returning ms (test seam).
     * @property {number} [cmjLowG=0.6]       Acceleration magnitude (G) below which
     *                                        the wearer is considered unweighted.
     * @property {number} [cmjHighG=4.0]      Acceleration magnitude (G) above which
     *                                        a landing peak is recorded.
     * @property {number} [gravity=9.81]      m/s^2 used by jump-height helpers.
     */

    /**
     * @typedef {Object} SessionSummary
     * @property {string}  schema           Always SESSION_SCHEMA_VERSION.
     * @property {string}  label            Caller-supplied label.
     * @property {number}  startMs          Session start time (ms, from `now`).
     * @property {number}  endMs            Session end time (ms, from `now`).
     * @property {number}  durationSec      End - start, seconds.
     * @property {number}  steps            Total steps accumulated.
     * @property {number}  cadenceStepsPerMin Steps / duration in minutes.
     * @property {Object|null} stride       Mean stride magnitude in meters and sample count.
     * @property {Object|null} pronation    Mean pronation magnitude and sample count.
     * @property {Object|null} acc          Mean / max accel magnitude in G.
     * @property {Object|null} cmj          Last CMJ summary (flight time + height) or null.
     */

    /**
     * @class CoreAnalytics
     */
    function CoreAnalytics(options) {
        if (!(this instanceof CoreAnalytics)) {
            return new CoreAnalytics(options);
        }
        var opts = options || {};
        this._bufferSize = isFiniteNumber(opts.bufferSize) ? opts.bufferSize : DEFAULT_BUFFER_SIZE;
        this._now = typeof opts.now === 'function' ? opts.now : nowMs;
        this._cmjLowG = isFiniteNumber(opts.cmjLowG) ? opts.cmjLowG : DEFAULT_CMJ_LOW_G;
        this._cmjHighG = isFiniteNumber(opts.cmjHighG) ? opts.cmjHighG : DEFAULT_CMJ_HIGH_G;
        this._gravity = isFiniteNumber(opts.gravity) ? opts.gravity : 9.81;

        this.reset();
    }

    /** Wipe all buffered state. Does not change configuration. */
    CoreAnalytics.prototype.reset = function () {
        this._session = null;
        this._baseline = null;
        this._buffers = {
            acc: [],
            gyro: [],
            euler: [],
            gait: [],
            stride: [],
            pronation: [],
            landingImpact: [],
            footAngle: [],
            stepsNumber: [],
        };
        this._stepsAccumulated = 0;
        this._cmjState = { phase: 'idle', takeoffTimeMs: null, lastResult: null };
    };

    /**
     * Start a new analytics session. If a session was already running, end it
     * first and discard the auto-generated summary.
     *
     * @param {string} [label]
     * @returns {Object} session handle (read-only snapshot of metadata)
     */
    CoreAnalytics.prototype.startSession = function (label) {
        if (this._session) this._session = null;
        var startMs = this._now();
        this._session = {
            label: label || 'session',
            startMs: startMs,
            endMs: null,
        };
        this._stepsAccumulated = 0;
        this._cmjState = { phase: 'idle', takeoffTimeMs: null, lastResult: null };
        return Object.assign({}, this._session);
    };

    /**
     * End the current session and return a SessionSummary.
     * Returns null if no session is active.
     *
     * @returns {SessionSummary|null}
     */
    CoreAnalytics.prototype.endSession = function () {
        if (!this._session) return null;
        this._session.endMs = this._now();
        var summary = this.getSessionSummary();
        this._session = null;
        return summary;
    };

    /**
     * Build a snapshot summary for the in-flight (or just-ended) session.
     *
     * @returns {SessionSummary|null}
     */
    CoreAnalytics.prototype.getSessionSummary = function () {
        if (!this._session) return null;
        var endMs = this._session.endMs == null ? this._now() : this._session.endMs;
        var durationSec = Math.max(0, (endMs - this._session.startMs) / 1000);
        var cadence = durationSec > 0 ? (this._stepsAccumulated / durationSec) * 60 : 0;

        var strideMagnitudes = this._buffers.stride.map(function (s) { return s.magnitude; });
        var pronationMagnitudes = this._buffers.pronation.map(function (p) { return p.magnitude; });
        var accMagnitudes = this._buffers.acc.map(function (a) { return a.magnitude; });

        return {
            schema: SESSION_SCHEMA_VERSION,
            label: this._session.label,
            startMs: this._session.startMs,
            endMs: endMs,
            durationSec: durationSec,
            steps: this._stepsAccumulated,
            cadenceStepsPerMin: cadence,
            stride: strideMagnitudes.length ? {
                samples: strideMagnitudes.length,
                meanMeters: mean(strideMagnitudes),
                stdMeters: stddev(strideMagnitudes),
            } : null,
            pronation: pronationMagnitudes.length ? {
                samples: pronationMagnitudes.length,
                meanMagnitude: mean(pronationMagnitudes),
            } : null,
            acc: accMagnitudes.length ? {
                samples: accMagnitudes.length,
                meanG: mean(accMagnitudes),
                maxG: accMagnitudes.reduce(function (m, v) { return v > m ? v : m; }, 0),
            } : null,
            cmj: this._cmjState.lastResult ? Object.assign({}, this._cmjState.lastResult) : null,
        };
    };

    /**
     * Capture the current session summary as a baseline that future sessions
     * can be compared against. Returns the stored baseline.
     *
     * @returns {SessionSummary|null}
     */
    CoreAnalytics.prototype.captureBaseline = function () {
        var summary = this.getSessionSummary();
        if (summary) this._baseline = summary;
        return this._baseline;
    };

    /**
     * Manually set the baseline (e.g. loaded from disk).
     * @param {SessionSummary} summary
     */
    CoreAnalytics.prototype.setBaseline = function (summary) {
        this._baseline = summary || null;
        return this._baseline;
    };

    /** @returns {SessionSummary|null} */
    CoreAnalytics.prototype.getBaseline = function () {
        return this._baseline;
    };

    /**
     * Compare a session summary (defaults to current) against the baseline
     * and return per-metric deltas. Useful for "today vs last warm-up" panels.
     *
     * @param {SessionSummary} [current]
     * @returns {Object|null} `{ baseline, current, delta }` or null if either is missing.
     */
    CoreAnalytics.prototype.compareToBaseline = function (current) {
        var baseline = this._baseline;
        var summary = current || this.getSessionSummary();
        if (!baseline || !summary) return null;
        function delta(curr, base) {
            if (!isFiniteNumber(curr) || !isFiniteNumber(base)) return null;
            return curr - base;
        }
        return {
            baseline: baseline,
            current: summary,
            delta: {
                steps: delta(summary.steps, baseline.steps),
                cadenceStepsPerMin: delta(summary.cadenceStepsPerMin, baseline.cadenceStepsPerMin),
                strideMeanMeters: delta(
                    summary.stride && summary.stride.meanMeters,
                    baseline.stride && baseline.stride.meanMeters
                ),
                accMeanG: delta(
                    summary.acc && summary.acc.meanG,
                    baseline.acc && baseline.acc.meanG
                ),
                accMaxG: delta(
                    summary.acc && summary.acc.maxG,
                    baseline.acc && baseline.acc.maxG
                ),
            },
        };
    };

    /**
     * Compute a Robinson symmetry index report comparing this analytics
     * instance (treated as one foot) against another instance (the other
     * foot). Both instances must be running sessions.
     *
     * @param {CoreAnalytics} other
     * @param {Object} [options]
     * @param {string} [options.leftLabel='left']
     * @param {string} [options.rightLabel='right']
     * @returns {Object|null}
     */
    CoreAnalytics.prototype.getSymmetryReport = function (other, options) {
        if (!other || typeof other.getSessionSummary !== 'function') return null;
        var left = this.getSessionSummary();
        var right = other.getSessionSummary();
        if (!left || !right) return null;
        var opts = options || {};
        return {
            schema: SESSION_SCHEMA_VERSION,
            leftLabel: opts.leftLabel || 'left',
            rightLabel: opts.rightLabel || 'right',
            left: left,
            right: right,
            symmetryIndex: {
                cadenceStepsPerMin: symmetryIndex(left.cadenceStepsPerMin, right.cadenceStepsPerMin),
                strideMeanMeters: symmetryIndex(
                    left.stride && left.stride.meanMeters,
                    right.stride && right.stride.meanMeters
                ),
                accMaxG: symmetryIndex(
                    left.acc && left.acc.maxG,
                    right.acc && right.acc.maxG
                ),
            },
        };
    };

    /**
     * @returns {Object|null} `{ flightSec, heightMeters, takeoffMs, landingMs }` for the most recent CMJ, if any.
     */
    CoreAnalytics.prototype.getLastCMJ = function () {
        return this._cmjState.lastResult ? Object.assign({}, this._cmjState.lastResult) : null;
    };

    // ---------------------------------------------------------------------
    // Opt-in feeds. Users call these from their existing callback handlers.
    // ---------------------------------------------------------------------

    /**
     * Feed an acceleration sample. Prefer values in G (i.e. `gotConvertedAcc`).
     * Raw normalized values from `gotAcc` will compute, but the CMJ thresholds
     * assume G units.
     *
     * @param {{x:number,y:number,z:number}} acc
     */
    CoreAnalytics.prototype.feedAcc = function (acc) {
        if (!acc) return;
        var sample = { t: this._now(), x: acc.x, y: acc.y, z: acc.z, magnitude: vectorMagnitude(acc) };
        pushBounded(this._buffers.acc, sample, this._bufferSize);
        this._updateCMJ(sample);
    };

    /** @param {{x:number,y:number,z:number}} gyro */
    CoreAnalytics.prototype.feedGyro = function (gyro) {
        if (!gyro) return;
        pushBounded(this._buffers.gyro, { t: this._now(), x: gyro.x, y: gyro.y, z: gyro.z }, this._bufferSize);
    };

    /** @param {{pitch:number,roll:number,yaw:number}} euler */
    CoreAnalytics.prototype.feedEuler = function (euler) {
        if (!euler) return;
        pushBounded(this._buffers.euler, { t: this._now(), pitch: euler.pitch, roll: euler.roll, yaw: euler.yaw }, this._bufferSize);
    };

    /**
     * Feed a `gait` payload (`gotGait`). Also increments the running step
     * counter using `gait.steps` if present, otherwise treats the event as a
     * single step.
     *
     * @param {Object} gait
     */
    CoreAnalytics.prototype.feedGait = function (gait) {
        if (!gait) return;
        var t = this._now();
        var increment = isFiniteNumber(gait.steps) ? gait.steps : 1;
        this._stepsAccumulated += Math.max(0, increment);
        pushBounded(this._buffers.gait, {
            t: t,
            steps: gait.steps,
            direction: gait.direction,
            type: gait.type,
            distance: gait.distance,
            calorie: gait.calorie,
            standing_phase_duration: gait.standing_phase_duration,
            swing_phase_duration: gait.swing_phase_duration,
        }, this._bufferSize);
    };

    /** @param {{x:number,y:number,z:number,steps_number?:number}} stride */
    CoreAnalytics.prototype.feedStride = function (stride) {
        if (!stride) return;
        pushBounded(this._buffers.stride, {
            t: this._now(),
            x: stride.x,
            y: stride.y,
            z: stride.z,
            steps_number: stride.steps_number,
            magnitude: vectorMagnitude(stride),
        }, this._bufferSize);
    };

    /** @param {{x:number,y:number,z:number}} pronation */
    CoreAnalytics.prototype.feedPronation = function (pronation) {
        if (!pronation) return;
        pushBounded(this._buffers.pronation, {
            t: this._now(),
            x: pronation.x,
            y: pronation.y,
            z: pronation.z,
            magnitude: vectorMagnitude(pronation),
        }, this._bufferSize);
    };

    /** @param {{value:number}} impact */
    CoreAnalytics.prototype.feedLandingImpact = function (impact) {
        if (!impact) return;
        pushBounded(this._buffers.landingImpact, { t: this._now(), value: impact.value }, this._bufferSize);
    };

    /** @param {{value:number}} footAngle */
    CoreAnalytics.prototype.feedFootAngle = function (footAngle) {
        if (!footAngle) return;
        pushBounded(this._buffers.footAngle, { t: this._now(), value: footAngle.value }, this._bufferSize);
    };

    /**
     * Feed a `gotStepsNumber` payload. If a session is active, this overrides
     * the cumulative step count from `feedGait` because `gotStepsNumber`
     * reports total steps, not increments.
     *
     * @param {{value:number}} steps
     */
    CoreAnalytics.prototype.feedStepsNumber = function (steps) {
        if (!steps) return;
        var t = this._now();
        pushBounded(this._buffers.stepsNumber, { t: t, value: steps.value }, this._bufferSize);
        if (isFiniteNumber(steps.value)) {
            this._stepsAccumulated = steps.value;
        }
    };

    /**
     * Compute rolling cadence in steps/min from the most recent gait events.
     *
     * @param {number} [windowSec=10]
     * @returns {number} cadence in steps/min, 0 if not enough samples.
     */
    CoreAnalytics.prototype.getRollingCadence = function (windowSec) {
        var window = isFiniteNumber(windowSec) ? windowSec : 10;
        var cutoff = this._now() - window * 1000;
        var recent = this._buffers.gait.filter(function (g) { return g.t >= cutoff; });
        if (recent.length < 2) return 0;
        var elapsed = (recent[recent.length - 1].t - recent[0].t) / 1000;
        if (elapsed <= 0) return 0;
        return ((recent.length - 1) / elapsed) * 60;
    };

    /**
     * Compute mean / std of stride magnitudes over the most recent samples.
     *
     * @param {number} [count=20] How many recent stride events to use.
     * @returns {{samples:number,meanMeters:number,stdMeters:number}|null}
     */
    CoreAnalytics.prototype.getStrideStats = function (count) {
        var n = isFiniteNumber(count) ? count : 20;
        var recent = this._buffers.stride.slice(-n);
        if (recent.length === 0) return null;
        var magnitudes = recent.map(function (s) { return s.magnitude; });
        return {
            samples: recent.length,
            meanMeters: mean(magnitudes),
            stdMeters: stddev(magnitudes),
        };
    };

    /**
     * @returns {{steps:number}}
     */
    CoreAnalytics.prototype.getStepsAccumulated = function () {
        return { steps: this._stepsAccumulated };
    };

    // ---------------------------------------------------------------------
    // CMJ event detection. Fed via feedAcc().
    // ---------------------------------------------------------------------

    CoreAnalytics.prototype._updateCMJ = function (accSample) {
        if (!accSample || !isFiniteNumber(accSample.magnitude)) return;
        var magnitude = accSample.magnitude;
        var state = this._cmjState;
        if (state.phase === 'idle' && magnitude < this._cmjLowG) {
            state.phase = 'unweighting';
            state.takeoffTimeMs = accSample.t;
        } else if (state.phase === 'unweighting' && magnitude > this._cmjHighG) {
            var landing = accSample.t;
            var flightSec = state.takeoffTimeMs != null ? (landing - state.takeoffTimeMs) / 1000 : NaN;
            state.lastResult = {
                takeoffMs: state.takeoffTimeMs,
                landingMs: landing,
                flightSec: flightSec,
                heightMeters: jumpHeightFromFlightTime(flightSec, this._gravity),
            };
            state.phase = 'idle';
            state.takeoffTimeMs = null;
        }
    };

    // ---------------------------------------------------------------------
    // Static helpers exposed for unit tests and direct use without a session.
    // ---------------------------------------------------------------------

    CoreAnalytics.SCHEMA_VERSION = SESSION_SCHEMA_VERSION;
    CoreAnalytics.symmetryIndex = symmetryIndex;
    CoreAnalytics.jumpHeightFromFlightTime = jumpHeightFromFlightTime;
    CoreAnalytics.vectorMagnitude = vectorMagnitude;

    return CoreAnalytics;
}));
