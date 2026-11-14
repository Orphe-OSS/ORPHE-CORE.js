const assert = require('node:assert/strict');
const path = require('node:path');
const { loadExampleModule } = require('./helpers/load-example-module');

// The post-race analysis of examples/GAME-SUPER-HURDLE is a pure module. The cases below are
// shaped like races recorded with real sensors (interval times, speeds, hits).
const { analyzeRun, AXES } = loadExampleModule(path.join(__dirname, '../examples/GAME-SUPER-HURDLE/analysis.js'));

/** A run from hurdle interval times; `hits` lists the hurdle indexes that were clipped. */
function makeRun({ first = 1.6, splits, hits = [], speedAt = () => 11.5, time, extra = {} }) {
  const hurdles = [];
  let t = first;
  for (let i = 0; i < splits.length + 1; i++) {
    if (i > 0) t += splits[i - 1];
    hurdles.push({ i, t, hit: hits.includes(i), speed: 11.5, tth: 0.3, gap: 3.4 });
  }
  const total = time ?? t + 1.4;
  const samples = [];
  for (let k = 0; k * 0.05 < total; k++) {
    const tt = k * 0.05;
    const dist = Math.min(110, (110 * tt) / total);
    samples.push([tt, dist, speedAt(dist), 1 - dist / 110, 1 - dist / 110]);
  }
  return {
    time: total, dnf: false, hits: hits.length, cleared: hurdles.length - hits.length, hurdles: hurdles.length,
    topSpeed: 12, staminaLeft: 0.05, exhaustCount: 0, paceRule: true, courseLen: 110, maxSpeed: 12,
    trace: { firstAccel: 0.18, hurdles, samples, blockedTime: 0 },
    sensor: null,
    ...extra,
  };
}
const axis = (analysis, key) => analysis.axes.find((a) => a.key === key).score;
const stat = (analysis, label) => analysis.stats.find((s) => s.label === label);

// ---- rhythm
{
  // an even run: every interval within a few hundredths
  const even = analyzeRun(makeRun({ splits: [0.82, 0.82, 0.8, 0.82, 0.82, 0.82, 0.85, 0.83, 0.84] }));
  assert.equal(even.metrics.brokenSplits, 0);
  assert.ok(axis(even, 'rhythm') >= 90, `even intervals score high, got ${axis(even, 'rhythm')}`);

  // one clipped hurdle: the interval after it is 2.5x longer. It used to zero the axis.
  const oneHit = analyzeRun(makeRun({ splits: [0.83, 0.85, 0.9, 2.03, 0.82, 0.83, 0.83, 0.82, 0.8], hits: [3] }));
  assert.equal(oneHit.metrics.brokenSplits, 1);
  assert.ok(axis(oneHit, 'rhythm') >= 60 && axis(oneHit, 'rhythm') < axis(even, 'rhythm'),
    `one broken interval costs points but does not zero the axis, got ${axis(oneHit, 'rhythm')}`);
  assert.match(stat(oneHit, 'リズムのばらつき').value, /乱れ 1 区間/);

  // two clipped hurdles cost more than one
  const twoHits = analyzeRun(makeRun({ splits: [0.82, 0.82, 0.82, 1.98, 0.82, 0.8, 0.82, 3.23, 1.0], hits: [3, 7] }));
  assert.equal(twoHits.metrics.brokenSplits, 2);
  assert.ok(axis(twoHits, 'rhythm') < axis(oneHit, 'rhythm'));

  // genuinely uneven intervals (no outlier to blame) still score low
  const uneven = analyzeRun(makeRun({ splits: [0.8, 1.1, 0.9, 1.25, 0.85, 1.15, 0.95, 1.3, 0.82] }));
  assert.ok(axis(uneven, 'rhythm') <= 40, `uneven intervals score low, got ${axis(uneven, 'rhythm')}`);

  // too few hurdles to talk about rhythm
  const short = analyzeRun(makeRun({ splits: [0.9, 0.9] }));
  assert.equal(short.metrics.cv, null);
  assert.equal(axis(short, 'rhythm'), 0);
}

// ---- finish: last 30 m against the usual mid-race speed
{
  // steady 11.5 m/s all the way, but two seconds near zero in the middle (a hit at 45 m)
  const dipped = analyzeRun(makeRun({
    splits: Array(9).fill(0.85), time: 13,
    speedAt: (d) => (d >= 45 && d < 60 ? 1.0 : 11.5),
  }));
  assert.ok(Math.abs(dipped.metrics.finishRatio - 1) < 0.02,
    `a mid-race dip must not inflate the finish ratio, got ${dipped.metrics.finishRatio}`);

  // fading from 11.5 to 7 m/s over the last 30 m
  const fading = analyzeRun(makeRun({ splits: Array(9).fill(0.85), speedAt: (d) => (d >= 80 ? 7 : 11.5) }));
  assert.ok(fading.metrics.finishRatio < 0.65);
  assert.ok(axis(fading, 'finish') < 15);
}

// ---- optional stat rows
{
  const plain = analyzeRun(makeRun({ splits: Array(9).fill(0.85) }));
  assert.equal(stat(plain, '誤ジャンプ防止'), undefined);
  assert.equal(stat(plain, '接地時間'), undefined);

  const guarded = analyzeRun(makeRun({ splits: Array(9).fill(0.85), extra: { ignoredJumps: 3 } }));
  assert.match(stat(guarded, '誤ジャンプ防止').value, /^3 回/);

  const sensor = { steps: 44, cadence: 220, oneFoot: false, balance: 0.5, meanPeakG: 5, maxG: 16, toeUpDeg: 20, contactMs: 262, sampleHz: 100, packets: 1500, lost: 0 };
  const insole = analyzeRun(makeRun({ splits: Array(9).fill(0.85), extra: { sensor } }));
  assert.match(stat(insole, '接地時間').value, /262 ms/);
  const core = analyzeRun(makeRun({ splits: Array(9).fill(0.85), extra: { sensor: { ...sensor, contactMs: null } } }));
  assert.equal(stat(core, '接地時間'), undefined);
}

// ---- shape
{
  const a = analyzeRun(makeRun({ splits: Array(9).fill(0.85) }));
  assert.equal(a.axes.length, AXES.length);
  assert.ok(Math.abs(AXES.reduce((sum, x) => sum + x.weight, 0) - 1) < 1e-9, 'axis weights add up to 1');
  for (const x of a.axes) assert.ok(Number.isInteger(x.score) && x.score >= 0 && x.score <= 100, `${x.key} is 0-100`);
  assert.ok(['S', 'A', 'B', 'C', 'D'].includes(a.grade));
  assert.equal(a.splits.length, 10);
}

console.log('super-hurdle-analysis.test.js passed');
