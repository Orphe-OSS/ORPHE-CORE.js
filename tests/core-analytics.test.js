#!/usr/bin/env node
/*
 * Plain-Node test harness for js/CoreAnalytics.js (no test framework).
 *
 * Usage:
 *   node tests/core-analytics.test.js
 *
 * Exit code 0 = all tests passed, 1 = at least one failure.
 *
 * Owner: Claude draft, Codex API review.
 * Status: 0.0.1-draft (matches CoreAnalytics.SCHEMA_VERSION).
 */

'use strict';

const path = require('path');
const CoreAnalytics = require(path.join('..', 'js', 'CoreAnalytics.js'));

let passed = 0;
let failed = 0;
const failures = [];

function approx(actual, expected, tolerance) {
    const tol = tolerance == null ? 1e-6 : tolerance;
    return Math.abs(actual - expected) <= tol;
}

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

function makeFakeClock() {
    let t = 0;
    return {
        now: function () { return t; },
        advance: function (delta) { t += delta; },
        set: function (value) { t = value; },
    };
}

console.log('CoreAnalytics tests (' + CoreAnalytics.SCHEMA_VERSION + ')');

// --------------------------------------------------------------------------
// Static helpers
// --------------------------------------------------------------------------

console.log('static helpers');

test('symmetryIndex(50, 55) ≈ 9.52', function () {
    assert(approx(CoreAnalytics.symmetryIndex(50, 55), 9.523809, 1e-3));
});

test('symmetryIndex(0, 0) is NaN', function () {
    assert(isNaN(CoreAnalytics.symmetryIndex(0, 0)));
});

test('symmetryIndex(NaN, 5) is NaN', function () {
    assert(isNaN(CoreAnalytics.symmetryIndex(NaN, 5)));
});

test('jumpHeightFromFlightTime(0.4) ≈ 0.196 m', function () {
    assert(approx(CoreAnalytics.jumpHeightFromFlightTime(0.4), 0.1962, 1e-3));
});

test('jumpHeightFromFlightTime(0) is NaN', function () {
    assert(isNaN(CoreAnalytics.jumpHeightFromFlightTime(0)));
});

test('jumpHeightFromFlightTime accepts a custom gravity', function () {
    const moonG = 1.62;
    const expected = (moonG * 0.4 * 0.4) / 8;
    assert(approx(CoreAnalytics.jumpHeightFromFlightTime(0.4, moonG), expected, 1e-6));
});

test('vectorMagnitude({0,0,0}) === 0', function () {
    assert(CoreAnalytics.vectorMagnitude({ x: 0, y: 0, z: 0 }) === 0);
});

test('vectorMagnitude({1,2,2}) === 3', function () {
    assert(CoreAnalytics.vectorMagnitude({ x: 1, y: 2, z: 2 }) === 3);
});

test('SCHEMA_VERSION is the documented draft string', function () {
    assert(CoreAnalytics.SCHEMA_VERSION === '0.0.1-draft');
});

// --------------------------------------------------------------------------
// Lifecycle and feed*
// --------------------------------------------------------------------------

console.log('lifecycle');

test('startSession returns a snapshot, endSession returns a summary', function () {
    const clock = makeFakeClock();
    const a = new CoreAnalytics({ now: clock.now });
    const handle = a.startSession('warm-up');
    assert(handle.label === 'warm-up');
    clock.advance(2000);
    const summary = a.endSession();
    assert(summary != null);
    assert(summary.label === 'warm-up');
    assert(summary.durationSec === 2);
    assert(summary.steps === 0);
});

test('endSession returns null when no session is active', function () {
    const a = new CoreAnalytics();
    assert(a.endSession() === null);
});

test('reset() clears buffered samples', function () {
    const a = new CoreAnalytics();
    a.startSession();
    a.feedAcc({ x: 1, y: 0, z: 0 });
    a.feedGait({ steps: 1 });
    a.reset();
    assert(a.getStepsAccumulated().steps === 0);
    assert(a.getSessionSummary() === null);
});

test('feedGait with steps increments cumulative count', function () {
    const a = new CoreAnalytics();
    a.startSession();
    a.feedGait({ steps: 1 });
    a.feedGait({ steps: 1 });
    a.feedGait({ steps: 1 });
    assert(a.getStepsAccumulated().steps === 3);
});

test('feedGait without steps treats event as one step', function () {
    const a = new CoreAnalytics();
    a.startSession();
    a.feedGait({ swing_phase_duration: 0.45 });
    a.feedGait({ swing_phase_duration: 0.46 });
    assert(a.getStepsAccumulated().steps === 2);
});

test('feedStepsNumber overrides cumulative count', function () {
    const a = new CoreAnalytics();
    a.startSession();
    a.feedGait({ steps: 1 });
    a.feedGait({ steps: 1 });
    a.feedStepsNumber({ value: 50 });
    assert(a.getStepsAccumulated().steps === 50);
});

test('null payloads to feed* are ignored', function () {
    const a = new CoreAnalytics();
    a.startSession();
    a.feedAcc(null);
    a.feedGait(null);
    a.feedStride(undefined);
    a.feedPronation(null);
    a.feedStepsNumber(null);
    assert(a.getStepsAccumulated().steps === 0);
});

// --------------------------------------------------------------------------
// Session summary
// --------------------------------------------------------------------------

console.log('session summary');

test('summary.cadenceStepsPerMin reflects steps per duration', function () {
    const clock = makeFakeClock();
    const a = new CoreAnalytics({ now: clock.now });
    a.startSession();
    for (let i = 0; i < 10; i++) {
        clock.advance(500);
        a.feedGait({ steps: 1 });
    }
    const summary = a.endSession();
    // 10 steps over 5000 ms = 5 s; cadence = 120 steps/min.
    assert(summary.steps === 10);
    assert(approx(summary.durationSec, 5, 1e-3));
    assert(approx(summary.cadenceStepsPerMin, 120, 1e-3));
});

test('summary.stride includes mean and std', function () {
    const a = new CoreAnalytics();
    a.startSession();
    a.feedStride({ x: 0.7, y: 0, z: 0 });
    a.feedStride({ x: 0.8, y: 0, z: 0 });
    a.feedStride({ x: 0.9, y: 0, z: 0 });
    const summary = a.endSession();
    assert(summary.stride.samples === 3);
    assert(approx(summary.stride.meanMeters, 0.8, 1e-6));
});

test('summary.acc records mean and max magnitude', function () {
    const a = new CoreAnalytics();
    a.startSession();
    a.feedAcc({ x: 0, y: 0, z: 1 });
    a.feedAcc({ x: 3, y: 4, z: 0 });   // magnitude 5
    a.feedAcc({ x: 0, y: 0, z: 2 });
    const summary = a.endSession();
    assert(summary.acc.samples === 3);
    assert(approx(summary.acc.maxG, 5, 1e-6));
});

// --------------------------------------------------------------------------
// Baseline workflow
// --------------------------------------------------------------------------

console.log('baseline');

test('captureBaseline persists the current summary', function () {
    const a = new CoreAnalytics();
    a.startSession('baseline');
    a.feedGait({ steps: 1 });
    const baseline = a.captureBaseline();
    assert(baseline != null);
    assert(baseline.steps === 1);
    assert(a.getBaseline() === baseline);
});

test('compareToBaseline returns null when no baseline', function () {
    const a = new CoreAnalytics();
    a.startSession();
    a.feedGait({ steps: 1 });
    assert(a.compareToBaseline() === null);
});

test('compareToBaseline returns deltas across baseline and current', function () {
    const clock = makeFakeClock();
    const a = new CoreAnalytics({ now: clock.now });
    a.startSession('baseline');
    clock.advance(60000);
    a.feedGait({ steps: 60 });
    a.captureBaseline();
    a.endSession();
    a.startSession('current');
    clock.advance(60000);
    a.feedGait({ steps: 90 });
    const compare = a.compareToBaseline();
    assert(compare != null);
    assert(compare.delta.steps === 30);
});

// --------------------------------------------------------------------------
// Symmetry
// --------------------------------------------------------------------------

console.log('symmetry');

test('getSymmetryReport requires another CoreAnalytics with a session', function () {
    const a = new CoreAnalytics();
    a.startSession('left');
    assert(a.getSymmetryReport(null) === null);
});

test('getSymmetryReport surfaces SI for cadence and stride', function () {
    const clock = makeFakeClock();
    const left = new CoreAnalytics({ now: clock.now });
    const right = new CoreAnalytics({ now: clock.now });
    left.startSession('left');
    right.startSession('right');
    for (let i = 0; i < 10; i++) {
        clock.advance(500);
        left.feedGait({ steps: 1 });
        right.feedGait({ steps: 1 });
    }
    left.feedStride({ x: 0.7, y: 0, z: 0 });
    right.feedStride({ x: 0.74, y: 0, z: 0 });
    const report = left.getSymmetryReport(right);
    assert(report != null);
    assert(report.symmetryIndex.cadenceStepsPerMin === 0); // identical cadence
    const expectedStrideSI = (2 * Math.abs(0.74 - 0.7)) / (0.74 + 0.7) * 100;
    assert(approx(report.symmetryIndex.strideMeanMeters, expectedStrideSI, 1e-6));
});

// --------------------------------------------------------------------------
// CMJ
// --------------------------------------------------------------------------

console.log('cmj');

test('feedAcc detects an unweighting → landing CMJ event', function () {
    const clock = makeFakeClock();
    const a = new CoreAnalytics({ now: clock.now });
    a.startSession();
    // Stand still
    a.feedAcc({ x: 0, y: 0, z: 1 });
    clock.advance(100);
    // Unweighting (magnitude < 0.6 G)
    a.feedAcc({ x: 0, y: 0, z: 0.3 });
    clock.advance(400); // 400 ms flight
    // Landing peak (magnitude > 4 G)
    a.feedAcc({ x: 0, y: 0, z: 5 });
    const cmj = a.getLastCMJ();
    assert(cmj != null);
    assert(approx(cmj.flightSec, 0.4, 1e-3));
    assert(approx(cmj.heightMeters, 0.1962, 1e-3));
});

test('CMJ thresholds are configurable via constructor options', function () {
    const clock = makeFakeClock();
    const a = new CoreAnalytics({ now: clock.now, cmjLowG: 0.2, cmjHighG: 6 });
    a.startSession();
    a.feedAcc({ x: 0, y: 0, z: 1 });
    clock.advance(100);
    a.feedAcc({ x: 0, y: 0, z: 0.3 }); // not low enough under tighter threshold
    clock.advance(200);
    a.feedAcc({ x: 0, y: 0, z: 5 });   // not high enough under tighter threshold
    assert(a.getLastCMJ() == null);
});

// --------------------------------------------------------------------------
// Rolling cadence and stride stats
// --------------------------------------------------------------------------

console.log('rolling queries');

test('getRollingCadence returns 0 when there are not enough samples', function () {
    const a = new CoreAnalytics();
    a.startSession();
    assert(a.getRollingCadence(10) === 0);
});

test('getRollingCadence over a steady stream', function () {
    const clock = makeFakeClock();
    const a = new CoreAnalytics({ now: clock.now });
    a.startSession();
    for (let i = 0; i < 6; i++) {
        clock.advance(500);
        a.feedGait({ steps: 1 });
    }
    // 5 intervals of 500 ms = 2.5 s; (6-1) steps / 2.5 s * 60 = 120 steps/min.
    assert(approx(a.getRollingCadence(60), 120, 1e-3));
});

test('getStrideStats returns null with no samples', function () {
    const a = new CoreAnalytics();
    a.startSession();
    assert(a.getStrideStats(10) === null);
});

test('getStrideStats reports recent magnitudes', function () {
    const a = new CoreAnalytics();
    a.startSession();
    a.feedStride({ x: 0.6, y: 0, z: 0 });
    a.feedStride({ x: 0.7, y: 0, z: 0 });
    a.feedStride({ x: 0.8, y: 0, z: 0 });
    const stats = a.getStrideStats(5);
    assert(stats.samples === 3);
    assert(approx(stats.meanMeters, 0.7, 1e-6));
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
