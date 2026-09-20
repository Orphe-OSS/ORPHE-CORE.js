/*!
 * CoreRecorder.js — recording / replay helpers for ORPHE CORE.js
 *
 * Status: 0.0.1-draft (Claude proposal). API and schema are unstable.
 * Owner: Claude draft, Codex API review (see docs/agents.md).
 *
 * This module is intentionally separate from `js/ORPHE-CORE.js` and from the
 * existing `examples/SENSOR-CALIBRATION/recorder.js`. It does not modify the
 * SENSOR-CALIBRATION recorder; instead it proposes a small, opt-in helper
 * that any new example can adopt.
 *
 * Design goals
 *   1. Users wire it explicitly via `feed*` methods called from their own
 *      `gotAcc` / `gotConvertedAcc` / `gotGyro` / `gotEuler` / `gotGait` /
 *      `gotStride` / `gotPronation` / `gotStepsNumber` / `gotLandingImpact` /
 *      `gotFootAngle` handlers. CoreRecorder never overwrites a callback.
 *   2. CSV and JSON share the same in-memory sample shape. JSON is the
 *      authoritative format; CSV is a flat projection for spreadsheets.
 *   3. `fromJSON()` round-trips: `CoreRecorder.fromJSON(rec.toJSON())` yields a
 *      recorder whose `replay()` callback shapes are byte-for-byte equal.
 *   4. Replay is a deterministic loop over recorded samples. The wall clock is
 *      injectable so tests don't sleep.
 *
 * Browser usage (no bundler):
 *   <script src="../../js/CoreRecorder.js"></script>
 *   const rec = new CoreRecorder({ session: 'lesson-04' });
 *   rec.start();
 *   bles[0].gotConvertedAcc = function (acc) { rec.feedAcc(acc); };
 *   bles[0].gotGait         = function (gait) { rec.feedGait(gait); };
 *   // ...
 *   rec.stop();
 *   const json = rec.toJSON();
 *   const csv  = rec.toCSV();
 *
 * Node / test usage:
 *   const CoreRecorder = require('./js/CoreRecorder.js');
 *   const r = new CoreRecorder({ now: () => Date.now() });
 */

(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CoreRecorder = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /** Schema identifier emitted in toJSON(). Bump when the JSON shape changes. */
    var RECORDING_SCHEMA_VERSION = '0.0.1-draft';

    /**
     * The set of sample kinds the recorder knows about. Each kind corresponds
     * to one ORPHE-CORE.js callback. Adding a new kind here also requires
     * adding it to CSV_COLUMNS and replay() below.
     */
    var SAMPLE_KINDS = [
        'acc',           // gotConvertedAcc (G) — also accepts gotAcc (normalized)
        'gyro',          // gotConvertedGyro (deg/s) — also accepts gotGyro (normalized)
        'euler',         // gotEuler (radians)
        'quat',          // gotQuat
        'gait',          // gotGait
        'stride',        // gotStride
        'pronation',     // gotPronation
        'landingImpact', // gotLandingImpact
        'footAngle',     // gotFootAngle
        'stepsNumber',   // gotStepsNumber
    ];

    /**
     * Flat CSV columns. Every sample becomes one row; columns it doesn't
     * populate are left blank. Order is stable so spreadsheet workflows can
     * pin column references.
     */
    var CSV_COLUMNS = [
        't_relative_ms', 'kind',
        'x', 'y', 'z', 'w',
        'pitch', 'roll', 'yaw',
        'steps', 'direction', 'distance', 'calorie',
        'standing_phase_duration', 'swing_phase_duration',
        'steps_number', 'value',
    ];

    function nowMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    function isFiniteNumber(value) {
        return typeof value === 'number' && isFinite(value);
    }

    function escapeCsvCell(value) {
        if (value == null) return '';
        var str = String(value);
        if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
        return str;
    }

    function unescapeCsvCell(cell) {
        if (cell == null || cell === '') return '';
        if (cell.charAt(0) === '"' && cell.charAt(cell.length - 1) === '"') {
            return cell.slice(1, -1).replace(/""/g, '"');
        }
        return cell;
    }

    function parseCsvLine(line) {
        var cells = [];
        var current = '';
        var inQuotes = false;
        for (var i = 0; i < line.length; i++) {
            var ch = line.charAt(i);
            if (inQuotes) {
                if (ch === '"' && line.charAt(i + 1) === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                cells.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        cells.push(current);
        return cells;
    }

    /**
     * @typedef {Object} CoreRecorderOptions
     * @property {string} [session]           Free-form label saved into JSON metadata.
     * @property {() => number} [now]         Clock function returning ms (test seam).
     * @property {Object} [meta]              Arbitrary metadata persisted in JSON header.
     */

    /**
     * @class CoreRecorder
     */
    function CoreRecorder(options) {
        if (!(this instanceof CoreRecorder)) {
            return new CoreRecorder(options);
        }
        var opts = options || {};
        this._now = typeof opts.now === 'function' ? opts.now : nowMs;
        this._sessionLabel = opts.session || 'session';
        this._meta = Object.assign({}, opts.meta || {});
        this._samples = [];
        this._startMs = null;
        this._endMs = null;
        this._isRecording = false;
    }

    /**
     * Start a new recording. Discards any previously buffered samples.
     */
    CoreRecorder.prototype.start = function () {
        this._samples = [];
        this._startMs = this._now();
        this._endMs = null;
        this._isRecording = true;
        return this;
    };

    /**
     * Stop the recording. Subsequent feed* calls are ignored until start().
     */
    CoreRecorder.prototype.stop = function () {
        if (!this._isRecording) return this;
        this._endMs = this._now();
        this._isRecording = false;
        return this;
    };

    /** @returns {boolean} */
    CoreRecorder.prototype.isRecording = function () { return this._isRecording; };

    /** @returns {number} samples recorded so far */
    CoreRecorder.prototype.size = function () { return this._samples.length; };

    /** @returns {number} duration in ms (live or final) */
    CoreRecorder.prototype.durationMs = function () {
        if (this._startMs == null) return 0;
        var end = this._endMs == null ? this._now() : this._endMs;
        return Math.max(0, end - this._startMs);
    };

    function pickFields(payload, fields) {
        var result = {};
        for (var i = 0; i < fields.length; i++) {
            var key = fields[i];
            if (payload && Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined) {
                result[key] = payload[key];
            }
        }
        return result;
    }

    var FIELDS_BY_KIND = {
        acc: ['x', 'y', 'z'],
        gyro: ['x', 'y', 'z'],
        euler: ['pitch', 'roll', 'yaw'],
        quat: ['w', 'x', 'y', 'z'],
        gait: ['steps', 'direction', 'distance', 'calorie',
            'standing_phase_duration', 'swing_phase_duration', 'type'],
        stride: ['x', 'y', 'z', 'steps_number'],
        pronation: ['x', 'y', 'z'],
        landingImpact: ['value'],
        footAngle: ['value'],
        stepsNumber: ['value'],
    };

    CoreRecorder.prototype._record = function (kind, payload) {
        if (!this._isRecording) return;
        if (SAMPLE_KINDS.indexOf(kind) === -1) return;
        var t = this._now();
        var fields = FIELDS_BY_KIND[kind] || [];
        this._samples.push({
            t_relative_ms: t - this._startMs,
            kind: kind,
            payload: pickFields(payload, fields),
        });
    };

    // Opt-in feeds — call from your own callback handlers.
    CoreRecorder.prototype.feedAcc = function (acc) { this._record('acc', acc); };
    CoreRecorder.prototype.feedGyro = function (gyro) { this._record('gyro', gyro); };
    CoreRecorder.prototype.feedEuler = function (euler) { this._record('euler', euler); };
    CoreRecorder.prototype.feedQuat = function (quat) { this._record('quat', quat); };
    CoreRecorder.prototype.feedGait = function (gait) { this._record('gait', gait); };
    CoreRecorder.prototype.feedStride = function (stride) { this._record('stride', stride); };
    CoreRecorder.prototype.feedPronation = function (pronation) { this._record('pronation', pronation); };
    CoreRecorder.prototype.feedLandingImpact = function (impact) { this._record('landingImpact', impact); };
    CoreRecorder.prototype.feedFootAngle = function (footAngle) { this._record('footAngle', footAngle); };
    CoreRecorder.prototype.feedStepsNumber = function (steps) { this._record('stepsNumber', steps); };

    /**
     * @returns {Object} JSON-serializable recording.
     */
    CoreRecorder.prototype.toJSON = function () {
        return {
            schema: RECORDING_SCHEMA_VERSION,
            session: this._sessionLabel,
            startMs: this._startMs,
            endMs: this._endMs,
            durationMs: this.durationMs(),
            sampleCount: this._samples.length,
            meta: Object.assign({}, this._meta),
            samples: this._samples.map(function (s) {
                return {
                    t_relative_ms: s.t_relative_ms,
                    kind: s.kind,
                    payload: Object.assign({}, s.payload),
                };
            }),
        };
    };

    /**
     * @returns {string} CSV with header row.
     */
    CoreRecorder.prototype.toCSV = function () {
        var lines = [CSV_COLUMNS.join(',')];
        for (var i = 0; i < this._samples.length; i++) {
            var sample = this._samples[i];
            var row = [];
            for (var c = 0; c < CSV_COLUMNS.length; c++) {
                var col = CSV_COLUMNS[c];
                var value;
                if (col === 't_relative_ms') value = sample.t_relative_ms;
                else if (col === 'kind') value = sample.kind;
                else if (sample.payload && Object.prototype.hasOwnProperty.call(sample.payload, col)) value = sample.payload[col];
                else value = '';
                row.push(escapeCsvCell(value));
            }
            lines.push(row.join(','));
        }
        return lines.join('\n');
    };

    /**
     * Reconstruct a recorder from a JSON object produced by toJSON().
     * The result is a stopped recorder ready for replay() / toCSV() / toJSON().
     *
     * @param {Object} json
     * @returns {CoreRecorder}
     */
    CoreRecorder.fromJSON = function (json) {
        if (!json || typeof json !== 'object') {
            throw new Error('CoreRecorder.fromJSON: expected an object');
        }
        if (json.schema && json.schema !== RECORDING_SCHEMA_VERSION) {
            // Forward-compatible: warn instead of throw so old recordings can still load.
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('CoreRecorder.fromJSON: schema mismatch ' + json.schema + ' vs ' + RECORDING_SCHEMA_VERSION);
            }
        }
        var rec = new CoreRecorder({ session: json.session, meta: json.meta });
        rec._startMs = isFiniteNumber(json.startMs) ? json.startMs : 0;
        rec._endMs = isFiniteNumber(json.endMs) ? json.endMs : (rec._startMs + (json.durationMs || 0));
        rec._isRecording = false;
        var samples = Array.isArray(json.samples) ? json.samples : [];
        rec._samples = samples.map(function (s) {
            return {
                t_relative_ms: isFiniteNumber(s.t_relative_ms) ? s.t_relative_ms : 0,
                kind: s.kind,
                payload: Object.assign({}, s.payload || {}),
            };
        });
        return rec;
    };

    /**
     * Reconstruct a recorder from a CSV string produced by toCSV().
     *
     * @param {string} csv
     * @param {Object} [options]
     * @param {string} [options.session]
     * @param {Object} [options.meta]
     * @returns {CoreRecorder}
     */
    CoreRecorder.fromCSV = function (csv, options) {
        if (typeof csv !== 'string') throw new Error('CoreRecorder.fromCSV: expected a string');
        var opts = options || {};
        var rec = new CoreRecorder({ session: opts.session, meta: opts.meta });
        var lines = csv.split(/\r?\n/);
        if (lines.length === 0) return rec;
        var header = parseCsvLine(lines[0]);
        var indexOf = {};
        for (var h = 0; h < header.length; h++) indexOf[header[h]] = h;
        var startSet = false;
        for (var i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            var cells = parseCsvLine(lines[i]);
            var kind = unescapeCsvCell(cells[indexOf.kind]);
            if (SAMPLE_KINDS.indexOf(kind) === -1) continue;
            var t = parseFloat(unescapeCsvCell(cells[indexOf.t_relative_ms]));
            if (!startSet) {
                rec._startMs = 0;
                startSet = true;
            }
            var fields = FIELDS_BY_KIND[kind] || [];
            var payload = {};
            for (var f = 0; f < fields.length; f++) {
                var col = fields[f];
                if (indexOf[col] == null) continue;
                var raw = unescapeCsvCell(cells[indexOf[col]]);
                if (raw === '') continue;
                var num = Number(raw);
                payload[col] = isFinite(num) && raw !== '' ? num : raw;
            }
            rec._samples.push({ t_relative_ms: t, kind: kind, payload: payload });
        }
        if (rec._samples.length > 0) {
            rec._endMs = rec._samples[rec._samples.length - 1].t_relative_ms;
        }
        rec._isRecording = false;
        return rec;
    };

    /**
     * @typedef {Object} ReplayHandlers
     * @property {(payload:Object)=>void} [acc]
     * @property {(payload:Object)=>void} [gyro]
     * @property {(payload:Object)=>void} [euler]
     * @property {(payload:Object)=>void} [quat]
     * @property {(payload:Object)=>void} [gait]
     * @property {(payload:Object)=>void} [stride]
     * @property {(payload:Object)=>void} [pronation]
     * @property {(payload:Object)=>void} [landingImpact]
     * @property {(payload:Object)=>void} [footAngle]
     * @property {(payload:Object)=>void} [stepsNumber]
     */

    /**
     * @typedef {Object} ReplayOptions
     * @property {ReplayHandlers} handlers
     * @property {number} [speed=1]   Playback speed multiplier; 0 means "fire all immediately".
     * @property {(cb:Function, ms:number)=>any} [scheduler] Defaults to setTimeout.
     * @property {(handle:any)=>void} [cancel]               Defaults to clearTimeout.
     */

    /**
     * Replay the recording, firing the matching handler for each sample at
     * the right relative time.
     *
     * @param {ReplayOptions} options
     * @returns {{stop:()=>void, durationMs:number, sampleCount:number}}
     */
    CoreRecorder.prototype.replay = function (options) {
        var opts = options || {};
        var handlers = opts.handlers || {};
        var speed = isFiniteNumber(opts.speed) ? opts.speed : 1;
        var scheduler = typeof opts.scheduler === 'function' ? opts.scheduler : function (fn, ms) { return setTimeout(fn, ms); };
        var cancel = typeof opts.cancel === 'function' ? opts.cancel : function (handle) { clearTimeout(handle); };

        var pending = [];
        var samples = this._samples;
        for (var i = 0; i < samples.length; i++) {
            (function (sample) {
                var handler = handlers[sample.kind];
                if (typeof handler !== 'function') return;
                var delay = speed > 0 ? (sample.t_relative_ms / speed) : 0;
                var handle = scheduler(function () { handler(Object.assign({}, sample.payload)); }, delay);
                pending.push(handle);
            }(samples[i]));
        }

        return {
            stop: function () {
                for (var p = 0; p < pending.length; p++) cancel(pending[p]);
                pending = [];
            },
            durationMs: this.durationMs(),
            sampleCount: samples.length,
        };
    };

    // Static surface for direct use without instantiating a recording.
    CoreRecorder.SCHEMA_VERSION = RECORDING_SCHEMA_VERSION;
    CoreRecorder.SAMPLE_KINDS = SAMPLE_KINDS.slice();
    CoreRecorder.CSV_COLUMNS = CSV_COLUMNS.slice();
    CoreRecorder.FIELDS_BY_KIND = JSON.parse(JSON.stringify(FIELDS_BY_KIND));

    return CoreRecorder;
}));
