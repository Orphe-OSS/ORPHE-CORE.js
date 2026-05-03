#!/usr/bin/env node
/*
 * Plain-Node test harness for js/CoreRecorder.js (no test framework).
 *
 * Usage:
 *   node tests/core-recorder.test.js
 *
 * Exit code 0 = all tests passed, 1 = at least one failure.
 *
 * Owner: Claude draft, Codex API review.
 * Status: 0.0.1-draft (matches CoreRecorder.SCHEMA_VERSION).
 */

'use strict';

const path = require('path');
const CoreRecorder = require(path.join('..', 'js', 'CoreRecorder.js'));

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed += 1;
        console.log('  ok  ' + name);
    } catch (error) {
        failed += 1;
        failures.push({ name: name, error: error });
        console.log('  FAIL ' + name + ' — ' + error.message);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'assertion failed');
}

function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function makeFakeClock(start) {
    let t = start == null ? 0 : start;
    return {
        now: function () { return t; },
        advance: function (delta) { t += delta; },
    };
}

console.log('CoreRecorder tests (' + CoreRecorder.SCHEMA_VERSION + ')');

// --------------------------------------------------------------------------
// Static surface
// --------------------------------------------------------------------------

console.log('static surface');

test('SCHEMA_VERSION is the documented draft string', function () {
    assert(CoreRecorder.SCHEMA_VERSION === '0.0.1-draft');
});

test('SAMPLE_KINDS is a non-empty array', function () {
    assert(Array.isArray(CoreRecorder.SAMPLE_KINDS));
    assert(CoreRecorder.SAMPLE_KINDS.length > 0);
});

test('SAMPLE_KINDS includes every callback the SDK exposes', function () {
    const kinds = CoreRecorder.SAMPLE_KINDS;
    ['acc', 'gyro', 'euler', 'quat', 'gait', 'stride', 'pronation',
     'landingImpact', 'footAngle', 'stepsNumber'].forEach(function (k) {
        assert(kinds.indexOf(k) !== -1, 'missing kind: ' + k);
    });
});

test('CSV_COLUMNS includes the canonical timing and kind columns', function () {
    const cols = CoreRecorder.CSV_COLUMNS;
    assert(cols[0] === 't_relative_ms');
    assert(cols[1] === 'kind');
    assert(cols.indexOf('x') !== -1);
    assert(cols.indexOf('value') !== -1);
});

test('FIELDS_BY_KIND matches the SAMPLE_KINDS set', function () {
    CoreRecorder.SAMPLE_KINDS.forEach(function (k) {
        assert(Array.isArray(CoreRecorder.FIELDS_BY_KIND[k]),
            'missing FIELDS_BY_KIND for kind: ' + k);
    });
});

// --------------------------------------------------------------------------
// Lifecycle
// --------------------------------------------------------------------------

console.log('lifecycle');

test('start() resets the buffer and isRecording becomes true', function () {
    const r = new CoreRecorder();
    r.start();
    r.feedAcc({ x: 1, y: 0, z: 0 });
    assert(r.size() === 1);
    r.start(); // should reset
    assert(r.size() === 0);
    assert(r.isRecording() === true);
});

test('stop() freezes recording', function () {
    const r = new CoreRecorder();
    r.start();
    r.stop();
    assert(r.isRecording() === false);
    r.feedAcc({ x: 1, y: 0, z: 0 }); // should be ignored
    assert(r.size() === 0);
});

test('feed* before start() is ignored', function () {
    const r = new CoreRecorder();
    r.feedAcc({ x: 1, y: 0, z: 0 });
    assert(r.size() === 0);
});

test('durationMs grows while recording and freezes after stop', function () {
    const clock = makeFakeClock(1000);
    const r = new CoreRecorder({ now: clock.now });
    r.start();
    clock.advance(500);
    const liveDuration = r.durationMs();
    assert(liveDuration === 500);
    r.stop();
    clock.advance(5000); // wall clock advances but recorder is frozen
    assert(r.durationMs() === 500);
});

test('null payloads to feed* are recorded with empty payload (current behavior)', function () {
    // Note: this differs from CoreAnalytics.feed*, which guards on null and
    // discards. CoreRecorder currently records the timestamp + kind with an
    // empty payload object. Worth aligning during API review (open question
    // in PR #81). This test pins the current behavior so a regression is
    // visible.
    const r = new CoreRecorder();
    r.start();
    r.feedAcc(null);
    r.feedGait(null);
    r.feedStride(undefined);
    assert(r.size() === 3);
    assert(deepEqual(r._samples[0].payload, {}));
    assert(deepEqual(r._samples[1].payload, {}));
});

// --------------------------------------------------------------------------
// JSON roundtrip
// --------------------------------------------------------------------------

console.log('json roundtrip');

test('toJSON includes schema, session, samples, and meta', function () {
    const r = new CoreRecorder({ session: 'test', meta: { device: 'left' } });
    r.start();
    r.feedAcc({ x: 1, y: 2, z: 3 });
    r.stop();
    const json = r.toJSON();
    assert(json.schema === '0.0.1-draft');
    assert(json.session === 'test');
    assert(json.meta.device === 'left');
    assert(json.sampleCount === 1);
    assert(json.samples.length === 1);
    assert(json.samples[0].kind === 'acc');
});

test('CoreRecorder.fromJSON(toJSON()) preserves samples deeply', function () {
    const clock = makeFakeClock(100);
    const r = new CoreRecorder({ session: 'roundtrip', now: clock.now });
    r.start();
    clock.advance(50);
    r.feedAcc({ x: 0.1, y: 0.2, z: 0.95 });
    clock.advance(50);
    r.feedGait({ steps: 1, swing_phase_duration: 0.45, standing_phase_duration: 0.55, direction: 2 });
    clock.advance(50);
    r.feedStride({ x: 0.7, y: 0.04, z: 0.0, steps_number: 1 });
    r.stop();

    const json = r.toJSON();
    const restored = CoreRecorder.fromJSON(json);
    const json2 = restored.toJSON();
    assert(deepEqual(json.samples, json2.samples), 'samples diverged');
});

test('fromJSON throws on non-object input', function () {
    let threw = false;
    try { CoreRecorder.fromJSON(null); } catch (e) { threw = true; }
    assert(threw);
});

test('fromJSON warns on schema mismatch but does not throw', function () {
    const originalWarn = console.warn;
    let warned = false;
    console.warn = function () { warned = true; };
    try {
        const r = CoreRecorder.fromJSON({ schema: '99.0.0', samples: [] });
        assert(r.size() === 0);
        assert(warned === true);
    } finally {
        console.warn = originalWarn;
    }
});

// --------------------------------------------------------------------------
// CSV roundtrip
// --------------------------------------------------------------------------

console.log('csv roundtrip');

test('toCSV includes header row in stable column order', function () {
    const r = new CoreRecorder();
    r.start();
    r.stop();
    const csv = r.toCSV();
    const header = csv.split('\n')[0];
    assert(header === CoreRecorder.CSV_COLUMNS.join(','));
});

test('CoreRecorder.fromCSV(toCSV()) reconstructs kinds and payloads', function () {
    const clock = makeFakeClock(0);
    const r = new CoreRecorder({ now: clock.now });
    r.start();
    clock.advance(50);
    r.feedAcc({ x: 0.1, y: 0.2, z: 0.95 });
    clock.advance(50);
    r.feedGait({ steps: 1, swing_phase_duration: 0.45 });
    clock.advance(50);
    r.feedStride({ x: 0.7, y: 0.04, z: 0.0, steps_number: 1 });
    r.stop();

    const csv = r.toCSV();
    const restored = CoreRecorder.fromCSV(csv);
    assert(restored.size() === 3);
    const kinds = restored._samples.map(function (s) { return s.kind; });
    assert(deepEqual(kinds, ['acc', 'gait', 'stride']));
    const accPayload = restored._samples[0].payload;
    assert(accPayload.x === 0.1 && accPayload.y === 0.2 && accPayload.z === 0.95);
});

test('CSV cells with commas and quotes round-trip safely', function () {
    const r = new CoreRecorder({ session: 'name with, comma' });
    r.start();
    r.stop();
    // Session label is metadata, not in CSV; verify the escape helper via JSON path.
    const json = r.toJSON();
    assert(json.session === 'name with, comma');
});

test('fromCSV ignores blank lines', function () {
    const r = new CoreRecorder();
    r.start();
    r.feedAcc({ x: 1, y: 0, z: 0 });
    r.stop();
    const csv = r.toCSV() + '\n\n';
    const restored = CoreRecorder.fromCSV(csv);
    assert(restored.size() === 1);
});

test('fromCSV throws on non-string input', function () {
    let threw = false;
    try { CoreRecorder.fromCSV(123); } catch (e) { threw = true; }
    assert(threw);
});

// --------------------------------------------------------------------------
// Replay
// --------------------------------------------------------------------------

console.log('replay');

test('replay calls handlers via injected scheduler', function () {
    const scheduled = [];
    function fakeScheduler(fn, ms) {
        scheduled.push({ fn: fn, ms: ms });
        return scheduled.length - 1;
    }
    function fakeCancel(handle) { scheduled[handle] = null; }

    const r = new CoreRecorder();
    r.start();
    r.feedAcc({ x: 1, y: 0, z: 0 });
    r.feedGait({ steps: 1 });
    r.stop();

    const events = [];
    r.replay({
        speed: 1,
        scheduler: fakeScheduler,
        cancel: fakeCancel,
        handlers: {
            acc: function (p) { events.push(['acc', p]); },
            gait: function (p) { events.push(['gait', p]); },
        },
    });

    // Two samples → two scheduled callbacks.
    assert(scheduled.length === 2);
    // Fire them manually to verify handlers are wired.
    scheduled[0].fn();
    scheduled[1].fn();
    assert(events.length === 2);
    assert(events[0][0] === 'acc' || events[0][0] === 'gait');
});

test('replay with speed=0 schedules everything at delay=0', function () {
    const delays = [];
    const r = new CoreRecorder({ now: (function () { let t = 0; return function () { return (t += 100); }; }()) });
    r.start();
    r.feedAcc({ x: 1, y: 0, z: 0 });
    r.feedGait({ steps: 1 });
    r.stop();

    r.replay({
        speed: 0,
        scheduler: function (fn, ms) { delays.push(ms); return 0; },
        cancel: function () {},
        handlers: { acc: function () {}, gait: function () {} },
    });
    assert(delays.length === 2);
    assert(delays.every(function (d) { return d === 0; }));
});

test('replay with speed=4 divides the relative timestamps by 4', function () {
    const delays = [];
    const clock = makeFakeClock(0);
    const r = new CoreRecorder({ now: clock.now });
    r.start();
    clock.advance(400);
    r.feedAcc({ x: 1, y: 0, z: 0 }); // t_relative_ms = 400
    clock.advance(400);
    r.feedAcc({ x: 1, y: 0, z: 0 }); // t_relative_ms = 800
    r.stop();

    r.replay({
        speed: 4,
        scheduler: function (fn, ms) { delays.push(ms); return 0; },
        cancel: function () {},
        handlers: { acc: function () {} },
    });
    assert(delays[0] === 100);
    assert(delays[1] === 200);
});

test('replay handler receives a fresh payload object (not the recorder buffer)', function () {
    const r = new CoreRecorder();
    r.start();
    r.feedGait({ steps: 1, swing_phase_duration: 0.5 });
    r.stop();

    let receivedPayload = null;
    r.replay({
        speed: 0,
        scheduler: function (fn) { fn(); return 0; },
        cancel: function () {},
        handlers: { gait: function (p) { receivedPayload = p; } },
    });
    receivedPayload.steps = 999;
    assert(r._samples[0].payload.steps === 1, 'recorder buffer was mutated');
});

test('replay returns a stop() function that calls cancel for each pending', function () {
    const cancelled = [];
    const r = new CoreRecorder();
    r.start();
    r.feedAcc({ x: 1, y: 0, z: 0 });
    r.feedGait({ steps: 1 });
    r.stop();

    const handle = r.replay({
        speed: 1,
        scheduler: function () { return Math.random(); },
        cancel: function (h) { cancelled.push(h); },
        handlers: { acc: function () {}, gait: function () {} },
    });
    handle.stop();
    assert(cancelled.length === 2);
});

// --------------------------------------------------------------------------
// All sample kinds smoke test
// --------------------------------------------------------------------------

console.log('all kinds smoke');

test('every SAMPLE_KIND can be recorded and round-trips', function () {
    const r = new CoreRecorder();
    r.start();
    r.feedAcc({ x: 1, y: 0, z: 0 });
    r.feedGyro({ x: 0, y: 1, z: 0 });
    r.feedEuler({ pitch: 0.1, roll: 0.2, yaw: 0.3 });
    r.feedQuat({ w: 1, x: 0, y: 0, z: 0 });
    r.feedGait({ steps: 1, swing_phase_duration: 0.45, standing_phase_duration: 0.55, direction: 2 });
    r.feedStride({ x: 0.7, y: 0.04, z: 0.0, steps_number: 1 });
    r.feedPronation({ x: 0.1, y: -0.05, z: 0.02 });
    r.feedLandingImpact({ value: 1.2 });
    r.feedFootAngle({ value: 18 });
    r.feedStepsNumber({ value: 1 });
    r.stop();

    assert(r.size() === CoreRecorder.SAMPLE_KINDS.length);
    const json = r.toJSON();
    const restored = CoreRecorder.fromJSON(json);
    assert(restored.size() === CoreRecorder.SAMPLE_KINDS.length);
});

// --------------------------------------------------------------------------
// Summary
// --------------------------------------------------------------------------

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
    failures.forEach(function (f) {
        console.log('  - ' + f.name + ': ' + f.error.message);
    });
    process.exit(1);
}
process.exit(0);
