const assert = require('node:assert/strict');
const path = require('node:path');
const { loadExampleModule } = require('./helpers/load-example-module');

// GAME-SUPER-PINGPONG turns the tilt log of a match into six 0-100 scores (range of
// motion, activity, smoothness, accuracy, reaction, endurance). These tests pin
// the signal processing behind each of them with synthetic movements.
const A = loadExampleModule(path.resolve(__dirname, '../examples/GAME-SUPER-PINGPONG/analysis.js'));
const FS = 50;

function sine({ seconds, hz, amp, offset = 0, noise = 0, decayTo = 1 }) {
  const n = Math.round(seconds * FS);
  const out = new Array(n);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
  for (let i = 0; i < n; i++) {
    const k = 1 + (decayTo - 1) * (i / (n - 1));
    out[i] = offset + amp * k * Math.sin((2 * Math.PI * hz * i) / FS) + noise * 2 * rnd();
  }
  return out;
}

/** Minimum-jerk reach from 0 to `amp` in `seconds`: the textbook smooth movement. */
function minimumJerk(amp, seconds) {
  const n = Math.round(seconds * FS);
  return Array.from({ length: n + 1 }, (_, i) => {
    const s = i / n;
    return amp * (10 * s ** 3 - 15 * s ** 4 + 6 * s ** 5);
  });
}

function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

// --- percentile -------------------------------------------------------------
near(A.percentile([1, 2, 3, 4, 5], 50), 3, 1e-9, 'median');
near(A.percentile([5, 1, 4, 2, 3], 0), 1, 1e-9, 'p0 sorts a copy');
near(A.percentile([0, 10], 25), 2.5, 1e-9, 'interpolated percentile');
assert.equal(A.percentile([], 50), 0, 'empty input is 0, not NaN');

// --- repetitions ------------------------------------------------------------
{
  const tenCycles = sine({ seconds: 20, hz: 0.5, amp: 15, noise: 0.3 });
  near(A.countReps(tenCycles, 6), 10, 1, 'ten ±15° cycles are ten repetitions');
  assert.equal(A.countReps(sine({ seconds: 20, hz: 2, amp: 0.8 }), 6), 0, 'tremor below the amplitude gate is not a repetition');
  assert.equal(A.countReps([], 6), 0, 'empty log has no repetitions');
}

// --- angular travel ---------------------------------------------------------
{
  // one ±15° cycle travels 60°, so ten cycles travel 600°
  near(A.angularTravel(sine({ seconds: 20, hz: 0.5, amp: 15 })), 600, 40, 'travel of ten ±15° cycles');
  assert.ok(A.angularTravel(sine({ seconds: 20, hz: 0.5, amp: 0, noise: 0.2 })) < 5, 'sensor noise alone adds almost no travel');
}

// --- smoothness (SPARC) -----------------------------------------------------
{
  const reach = minimumJerk(25, 1.2);
  const smooth = A.sparc(A.speedOf(reach, FS), FS);
  assert.ok(smooth > -1.9 && smooth < -1.2, `a minimum-jerk reach has SPARC near -1.6, got ${smooth}`);
  const shaky = reach.map((v, i) => v + 1.6 * Math.sin((2 * Math.PI * 6 * i) / FS));
  const rough = A.sparc(A.speedOf(shaky, FS), FS);
  assert.ok(rough < smooth - 0.3, `a 6 Hz tremor makes SPARC clearly worse (${rough} vs ${smooth})`);
  assert.equal(A.sparc([], FS), null, 'no movement has no smoothness value');
}

// --- reaction time ----------------------------------------------------------
{
  // the paddle rests at -0.6, the ball is hit at t = 1.0 s towards +0.5 and the player starts moving 450 ms later
  const pos = new Array(4 * FS).fill(-0.6);
  const start = Math.round(1.45 * FS);
  const move = minimumJerk(1.1, 0.7);
  for (let i = 0; i < move.length; i++) pos[start + i] = -0.6 + move[i];
  for (let i = start + move.length; i < pos.length; i++) pos[i] = 0.5;
  const rts = A.reactionTimes(pos, FS, [{ t: 1.0, target: 0.5 }]);
  assert.equal(rts.length, 1);
  near(rts[0], 450, 90, 'movement onset 450 ms after the stimulus');
  assert.equal(A.reactionTimes(pos, FS, [{ t: 3.2, target: 0.5 }]).length, 0, 'no reaction is measured when the paddle is already there');
  assert.equal(A.reactionTimes(new Array(200).fill(0), FS, [{ t: 1.0, target: 0.8 }]).length, 0, 'a player who never moves has no reaction time');
  // already sweeping towards the far end when the ball is hit: anticipation, not a reaction
  const sweeping = Array.from({ length: 4 * FS }, (_, i) => Math.min(0.9, -0.9 + i / FS));
  assert.equal(A.reactionTimes(sweeping, FS, [{ t: 0.5, target: 0.8 }]).length, 0, 'a paddle already on its way is not timed');
}

// --- whole session ----------------------------------------------------------
function session(overrides = {}) {
  const angle = overrides.angle || sine({ seconds: 90, hz: 0.35, amp: 20, noise: 0.15 });
  return {
    fs: FS,
    exercise: 'ankle',
    calib: { up: 20, down: 20 },
    angle,
    pos: angle.map((a) => Math.max(-1, Math.min(1, a / 20))),
    hits: Array.from({ length: 12 }, (_, i) => ({ t: 5 + i * 6, offset: 0.2 })),
    misses: [{ t: 80 }],
    incomings: [],
    ...overrides,
  };
}
{
  const active = A.analyzeSession(session());
  const idle = A.analyzeSession(session({ angle: sine({ seconds: 90, hz: 0.35, amp: 0, noise: 0.15 }), hits: [], misses: [{ t: 10 }, { t: 30 }] }));

  for (const key of A.METRIC_KEYS) {
    const score = active.scores[key];
    assert.ok(score === null || (Number.isFinite(score) && score >= 0 && score <= 100), `${key} is a 0-100 score or null, got ${score}`);
  }
  assert.ok(active.total > 60, `an active, accurate session scores well, got ${active.total}`);
  assert.ok(idle.total < 25, `a session without movement scores low, got ${idle.total}`);
  assert.ok(active.total > idle.total + 35);

  near(active.rom.usedUp, 20, 1.5, 'used dorsiflexion');
  near(active.rom.usedDown, 20, 1.5, 'used plantarflexion');
  assert.ok(active.scores.rom >= 95, 'using the whole calibrated range and the reference range is a full range score');
  near(active.activity.reps, 31, 2, 'repetitions in 90 s at 0.35 Hz');
  near(active.scores.accuracy, 100 * (0.75 * (12 / 13) + 0.25 * 0.8), 0.6, 'accuracy mixes return rate and centring');
  assert.equal(active.scores.reaction, null, 'reaction needs at least three measured trials');
  assert.equal(idle.scores.smooth, null, 'smoothness is not rated without movements');
  assert.equal(idle.scores.accuracy, 0);
  assert.ok(Number.isInteger(active.total) && active.durationSec === 90);

  // a short session cannot rate endurance
  assert.equal(A.analyzeSession(session({ angle: sine({ seconds: 50, hz: 0.35, amp: 20 }) })).scores.endurance, null);
  // fading to a third of the amplitude costs endurance (second half against first half)
  const fading = A.analyzeSession(session({ angle: sine({ seconds: 90, hz: 0.35, amp: 20, decayTo: 0.3 }) }));
  assert.ok(active.scores.endurance >= 95, `steady effort keeps endurance, got ${active.scores.endurance}`);
  assert.ok(fading.scores.endurance < 60, `fading effort lowers endurance, got ${fading.scores.endurance}`);

  // thigh raises only go up from the resting position
  const thigh = A.analyzeSession(session({
    exercise: 'thigh', calib: { up: 30, down: 0 },
    angle: sine({ seconds: 90, hz: 0.3, amp: 15, offset: 15 }),
  }));
  near(thigh.rom.usedUp, 30, 2, 'thigh raise height');
  assert.ok(thigh.rom.usedDown < 1.5);
  assert.ok(thigh.scores.rom > 85);

  // an empty log must not throw or produce NaN
  const empty = A.analyzeSession({ fs: FS, exercise: 'ankle', calib: null, angle: [], pos: [], hits: [], misses: [], incomings: [] });
  assert.equal(empty.total, 0);
  assert.ok(Object.values(empty.scores).every((v) => v === null || Number.isFinite(v)));
}

// --- a very long session ------------------------------------------------------
{
  // an hour at 50 Hz is 180,000 samples: more than can be spread into Math.max()
  const long = A.analyzeSession(session({ angle: sine({ seconds: 3600, hz: 0.3, amp: 18 }) }));
  near(long.rom.peakUp, 18, 0.3, 'peak of an hour-long log');
  near(long.rom.peakDown, 18, 0.3, 'trough of an hour-long log');
  assert.equal(long.durationSec, 3600);
}

// --- implausible angles and aimless movement ---------------------------------
{
  // 90 degrees of "ankle" movement is not an ankle: the sensor is loose or the axis is wrong
  const wild = A.analyzeSession(session({ angle: sine({ seconds: 90, hz: 0.35, amp: 45 }) }));
  assert.equal(wild.flags.implausibleRange, true);
  assert.equal(wild.scores.rom, null, 'an impossible range is not rated');
  assert.equal(wild.scores.activity, null, 'nor is the activity measured with it');
  assert.equal(A.analyzeSession(session()).flags.implausibleRange, false);

  // moving a lot without returning a single ball must not look like a good session
  const hitting = A.analyzeSession(session());
  const flailing = A.analyzeSession(session({ hits: [], misses: [{ t: 10 }, { t: 30 }, { t: 50 }] }));
  assert.ok(flailing.total <= 45, `no returns keeps the total low, got ${flailing.total}`);
  assert.ok(flailing.total < hitting.total * 0.6);
  near(flailing.engagement, 0.5, 1e-9, 'engagement factor with no returns');
  near(hitting.engagement, 0.5 + 0.5 * (12 / 13), 1e-9, 'engagement factor follows the return rate');
  // too few balls to judge: the factor stays out of it
  assert.equal(A.analyzeSession(session({ hits: [], misses: [{ t: 10 }] })).engagement, 1);
}

// --- total and rank ---------------------------------------------------------
{
  assert.equal(A.totalScore({ rom: 80, activity: 80, smooth: 80, accuracy: 80, reaction: 80, endurance: 80 }), 80);
  assert.equal(A.totalScore({ rom: 50, activity: 50, smooth: null, accuracy: null, reaction: null, endurance: null }), 50, 'missing metrics are left out, not counted as zero');
  assert.equal(A.totalScore({ rom: null, activity: null, smooth: null, accuracy: null, reaction: null, endurance: null }), 0);
  assert.equal(A.rankFor(95).key, 'yokozuna');
  assert.equal(A.rankFor(90).key, 'yokozuna');
  assert.equal(A.rankFor(89).key, 'ozeki');
  assert.equal(A.rankFor(0).key, 'jonokuchi');
  const ranks = [100, 85, 75, 65, 50, 35, 10].map((s) => A.rankFor(s).key);
  assert.equal(new Set(ranks).size, 7, 'seven distinct ranks');
}

// --- advice -----------------------------------------------------------------
{
  const result = A.analyzeSession(session({ angle: sine({ seconds: 90, hz: 0.35, amp: 5, noise: 0.1 }) }));
  const advice = A.adviceFor(result);
  assert.equal(advice.focus, 'rom', 'the weakest metric is the one to work on');
  assert.ok(advice.tip.length > 0 && advice.praise.length > 0);
}

console.log('pingpong-analysis.test.js passed');
