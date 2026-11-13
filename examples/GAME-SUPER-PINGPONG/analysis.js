// analysis.js — turns the tilt log of one player into rehabilitation-oriented scores.
//
// Pure functions, no DOM and no imports, so tests/pingpong-analysis.test.js can load
// this file in Node. Angles are in degrees relative to the resting pose, positive =
// "up" (toes up for the ankle exercise, thigh raised for the thigh exercise).
//
// These are wellness indicators for motivation and self-comparison, not clinical
// measurements: the thresholds below are documented starting points, not validated norms.

export const METRIC_KEYS = ['rom', 'activity', 'smooth', 'accuracy', 'reaction', 'endurance'];

/** Share of each metric in the total. Metrics that could not be rated are left out and the rest re-normalised. */
export const METRIC_WEIGHTS = { rom: 0.22, activity: 0.22, smooth: 0.14, accuracy: 0.16, reaction: 0.12, endurance: 0.14 };

export const METRIC_INFO = {
  rom: { label: '可動域', en: 'Range', hint: 'どれだけ大きく動かせたか' },
  activity: { label: '運動量', en: 'Activity', hint: '上げ下げの回数と動かした量' },
  smooth: { label: 'なめらかさ', en: 'Smoothness', hint: 'ぎくしゃくせずに動かせたか' },
  accuracy: { label: '正確さ', en: 'Accuracy', hint: 'ねらった位置に合わせられたか' },
  reaction: { label: '反応', en: 'Reaction', hint: '球を見てから動き出すまでの速さ' },
  endurance: { label: '持久力', en: 'Endurance', hint: '最後まで動きを保てたか' },
};

/**
 * Exercise presets. targetRom is the active range (degrees) that earns the full
 * reference part of the range score: a comfortable seated range, deliberately below
 * the textbook joint limits (ankle: 20° dorsiflexion + 45° plantarflexion).
 */
export const EXERCISES = {
  ankle: { key: 'ankle', label: '足首の曲げ伸ばし', short: '足首', place: '足の甲', targetRom: 40, maxRom: 70, up: '背屈', down: '底屈', upHint: 'つま先を上げる', downHint: 'つま先を下げる' },
  thigh: { key: 'thigh', label: '太もも上げ', short: '太もも', place: '太もも', targetRom: 30, maxRom: 85, up: '上げ', down: '下げ', upHint: '太ももを上げる', downHint: '太ももを下ろす' },
};

/**
 * Full marks for activity: this many repetitions per minute, each across the exercise's
 * target range. At the default ball speed a player gets a ball every 6-9 seconds, so one
 * full raise per ball is about 7 a minute; 6 keeps full marks within reach of steady play.
 */
export const TARGET_REPS_PER_MIN = 6;

export const RANKS = [
  { key: 'yokozuna', min: 90, label: '横綱', note: '文句なしの足さばき' },
  { key: 'ozeki', min: 80, label: '大関', note: 'たいへんよく動けています' },
  { key: 'sekiwake', min: 70, label: '関脇', note: 'しっかり動けています' },
  { key: 'komusubi', min: 60, label: '小結', note: 'いい調子です' },
  { key: 'maegashira', min: 45, label: '前頭', note: 'この調子で続けましょう' },
  { key: 'juryo', min: 30, label: '十両', note: '少しずつ伸ばしていきましょう' },
  { key: 'jonokuchi', min: 0, label: '序ノ口', note: 'これからが楽しみです' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

/** Linear-interpolated percentile (p in 0..100) of an unsorted array; 0 for an empty one. */
export function percentile(values, p) {
  const n = values.length;
  if (!n) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const idx = clamp(p / 100, 0, 1) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Centred moving average (window = 2 * half + 1 samples, shrinking at the ends). */
export function smoothSeries(values, half = 1) {
  const n = values.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) { sum += values[j]; count++; }
    out[i] = sum / count;
  }
  return out;
}

/** Signed angular velocity (units/s) from a lightly smoothed series, central differences. */
export function speedOf(values, fs) {
  const s = smoothSeries(values, 1);
  const n = s.length;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)];
    const b = s[Math.min(n - 1, i + 1)];
    const span = Math.min(n - 1, i + 1) - Math.max(0, i - 1);
    out[i] = span > 0 ? ((b - a) * fs) / span : 0;
  }
  return out;
}

/**
 * Number of raises: upward strokes of at least `minAmp` degrees, counted with a
 * zig-zag (turning point) follower so tremor and sensor noise do not add repetitions.
 */
export function countReps(angle, minAmp) {
  if (!angle.length) return 0;
  let dir = 0, hi = angle[0], lo = angle[0], ups = 0;
  for (let i = 1; i < angle.length; i++) {
    const x = angle[i];
    if (dir <= 0) {
      if (x < lo) lo = x;
      if (x - lo >= minAmp) { dir = 1; hi = x; ups++; continue; }
    }
    if (dir >= 0) {
      if (x > hi) hi = x;
      if (hi - x >= minAmp) { dir = -1; lo = x; }
    }
  }
  return ups;
}

/**
 * Total angle travelled (degrees), measured through a backlash of `deadband` degrees
 * so jitter inside the band adds nothing.
 */
export function angularTravel(angle, deadband = 0.5) {
  if (!angle.length) return 0;
  let follower = angle[0], path = 0;
  for (let i = 1; i < angle.length; i++) {
    const gap = angle[i] - follower;
    if (gap > deadband) { path += gap - deadband; follower = angle[i] - deadband; }
    else if (gap < -deadband) { path += -gap - deadband; follower = angle[i] + deadband; }
  }
  return path;
}

/**
 * SPARC, the spectral arc length of a speed profile (Balasubramanian et al. 2015):
 * about -1.6 for one smooth bell-shaped movement, more negative the more the
 * movement is broken up. Returns null for an empty or motionless profile.
 */
export function sparc(speed, fs, { fc = 10, ampThreshold = 0.05, padLevel = 4 } = {}) {
  const n = speed.length;
  if (n < 4) return null;
  const nfft = 2 ** (Math.ceil(Math.log2(n)) + padLevel);
  const bins = Math.min(Math.floor((fc * nfft) / fs), nfft / 2);
  const mag = new Array(bins + 1);
  let peak = 0;
  for (let k = 0; k <= bins; k++) {
    const w = (-2 * Math.PI * k) / nfft;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { re += speed[i] * Math.cos(w * i); im += speed[i] * Math.sin(w * i); }
    mag[k] = Math.hypot(re, im);
    if (mag[k] > peak) peak = mag[k];
  }
  if (!(peak > 1e-9)) return null;
  let first = -1, last = -1;
  for (let k = 0; k <= bins; k++) {
    if (mag[k] / peak >= ampThreshold) { if (first < 0) first = k; last = k; }
  }
  if (last <= first) return null;
  const df = 1 / (last - first);
  let arc = 0;
  for (let k = first + 1; k <= last; k++) arc += Math.hypot(df, (mag[k] - mag[k - 1]) / peak);
  return -arc;
}

/**
 * One-directional movements: runs where the speed stays above `minSpeed` with the
 * same sign for at least `minDuration` seconds and cover at least `minAmp` degrees.
 * Each run is padded by `pad` seconds so the acceleration and deceleration tails
 * are part of the profile that SPARC rates.
 */
export function movementSegments(angle, fs, { minSpeed = 8, minDuration = 0.16, minAmp = 4, pad = 0.1 } = {}) {
  const v = speedOf(angle, fs);
  const n = v.length;
  const segments = [];
  const padN = Math.round(pad * fs);
  let i = 0;
  while (i < n) {
    if (Math.abs(v[i]) < minSpeed) { i++; continue; }
    const sign = Math.sign(v[i]);
    let j = i;
    while (j < n && Math.abs(v[j]) >= minSpeed && Math.sign(v[j]) === sign) j++;
    if ((j - i) / fs >= minDuration && Math.abs(angle[Math.min(n - 1, j)] - angle[i]) >= minAmp) {
      const i0 = Math.max(0, i - padN), i1 = Math.min(n, j + padN);
      segments.push({ i0, i1, speed: v.slice(i0, i1).map((x) => Math.max(0, x * sign)) });
    }
    i = j;
  }
  return segments;
}

/**
 * Reaction times in milliseconds. `incomings` lists the moments the ball was sent
 * towards this player ({ t: seconds, target: where the paddle has to go, -1..1 }).
 * A trial counts when the paddle had to travel at least `minDist`, and the reaction
 * is the first sustained movement towards the target after `minDelay`. A paddle that
 * is already on its way when the ball is hit was anticipating, not reacting: no trial.
 */
export function reactionTimes(pos, fs, incomings, { minDist = 0.3, onset = 0.35, creep = 0.1, minDelay = 0.15, maxRt = 2.0, hold = 0.08 } = {}) {
  const v = speedOf(pos, fs);
  const n = pos.length;
  const holdN = Math.max(1, Math.round(hold * fs));
  const out = [];
  for (const { t, target } of incomings) {
    const i0 = Math.round(t * fs);
    if (i0 < 0 || i0 >= n) continue;
    const need = target - pos[i0];
    if (Math.abs(need) < minDist) continue;
    const dir = Math.sign(need);
    const from = i0 + Math.round(minDelay * fs);
    const to = Math.min(n - holdN, i0 + Math.round(maxRt * fs));
    if (v[i0] * dir >= onset && v[Math.min(n - 1, from)] * dir >= onset) continue;
    for (let i = from; i < to; i++) {
      let sustained = true;
      for (let k = 0; k < holdN; k++) if (v[i + k] * dir < onset) { sustained = false; break; }
      if (!sustained) continue;
      // walk back to where the movement actually left rest
      let start = i;
      while (start > from && v[start - 1] * dir >= creep) start--;
      out.push(((start - i0) / fs) * 1000);
      break;
    }
  }
  return out;
}

/** Weighted mean of the rated metrics as an integer 0..100 (0 when nothing could be rated). */
export function totalScore(scores) {
  let sum = 0, weight = 0;
  for (const key of METRIC_KEYS) {
    const s = scores[key];
    if (s === null || s === undefined || !Number.isFinite(s)) continue;
    sum += s * METRIC_WEIGHTS[key];
    weight += METRIC_WEIGHTS[key];
  }
  return weight > 0 ? Math.round(sum / weight) : 0;
}

export function rankFor(total) {
  return RANKS.find((r) => total >= r.min) || RANKS[RANKS.length - 1];
}

/**
 * Analyse one player's match log.
 * @param {object} log
 * @param {number} log.fs - sample rate of `angle` and `pos` (Hz)
 * @param {'ankle'|'thigh'} log.exercise
 * @param {{up:number, down:number}|null} log.calib - calibrated range in degrees, or null
 * @param {number[]} log.angle - tilt in degrees, + = up
 * @param {number[]} log.pos - the player's own paddle command, -1..1 (before any assist)
 * @param {{t:number, offset:number}[]} log.hits - returns; offset -1..1 = where on the paddle
 * @param {{t:number}[]} log.misses
 * @param {{t:number, target:number}[]} log.incomings - see reactionTimes()
 */
export function analyzeSession(log) {
  const fs = log.fs || 50;
  const angle = Array.from(log.angle || []);
  const pos = Array.from(log.pos || []);
  const exercise = EXERCISES[log.exercise] || EXERCISES.ankle;
  const n = angle.length;
  const durationSec = n / fs;
  const minutes = durationSec / 60;
  const rated = n >= fs;  // under a second of data nothing is rated
  const calibTotal = log.calib ? Math.max(0, (log.calib.up || 0) + (log.calib.down || 0)) : 0;
  const scores = { rom: null, activity: null, smooth: null, accuracy: null, reaction: null, endurance: null };

  // --- range of motion: robust extremes, so one spike does not set the range
  const usedUp = Math.max(0, percentile(angle, 98));
  const usedDown = Math.max(0, -percentile(angle, 2));
  const usedTotal = usedUp + usedDown;
  // a loop, not Math.max(...angle): a long session has more samples than a call can take arguments
  let peakUp = 0, peakDown = 0;
  for (let i = 0; i < n; i++) { if (angle[i] > peakUp) peakUp = angle[i]; if (-angle[i] > peakDown) peakDown = -angle[i]; }
  const rom = { usedUp, usedDown, usedTotal, calibTotal, target: exercise.targetRom, peakUp, peakDown };
  // A range no joint can do means the sensor slipped or the axis was misread: such a log
  // says nothing about range or amount of movement, so neither is rated.
  const flags = { implausibleRange: usedTotal > exercise.maxRom };
  if (rated && !flags.implausibleRange) {
    const vsTarget = clamp01(usedTotal / exercise.targetRom);
    const vsOwn = calibTotal > 0 ? clamp01(usedTotal / calibTotal) : vsTarget;
    scores.rom = Math.round(100 * (0.6 * vsTarget + 0.4 * vsOwn));
  }

  // --- activity: repetitions and total travel per minute
  const repGate = clamp(0.2 * (calibTotal || usedTotal || exercise.targetRom), 3, 10);
  const reps = countReps(angle, repGate);
  const travelDeg = angularTravel(angle);
  const activity = {
    reps, travelDeg,
    repsPerMin: minutes > 0 ? reps / minutes : 0,
    travelPerMin: minutes > 0 ? travelDeg / minutes : 0,
  };
  if (rated && !flags.implausibleRange) {
    const targetTravel = TARGET_REPS_PER_MIN * exercise.targetRom;
    scores.activity = Math.round(100 * (0.5 * clamp01(activity.repsPerMin / TARGET_REPS_PER_MIN) + 0.5 * clamp01(activity.travelPerMin / targetTravel)));
  }

  // --- smoothness: duration-weighted SPARC of every one-directional movement
  const segments = movementSegments(angle, fs);
  let sparcSum = 0, sparcWeight = 0;
  for (const seg of segments) {
    const value = sparc(seg.speed, fs);
    if (value === null) continue;
    sparcSum += value * seg.speed.length;
    sparcWeight += seg.speed.length;
  }
  const smooth = { sparc: sparcWeight ? sparcSum / sparcWeight : null, movements: segments.length };
  if (smooth.sparc !== null && segments.length >= 3) scores.smooth = Math.round(100 * clamp01((smooth.sparc + 3.6) / 2.0));

  // --- accuracy: share of balls returned, and how close to the paddle centre
  const hits = log.hits || [], misses = log.misses || [];
  const trials = hits.length + misses.length;
  const accuracy = {
    hits: hits.length, misses: misses.length,
    hitRate: trials ? hits.length / trials : 0,
    centering: hits.length ? mean(hits.map((h) => 1 - Math.min(1, Math.abs(h.offset)))) : 0,
  };
  if (trials > 0) scores.accuracy = Math.round(100 * (0.75 * accuracy.hitRate + 0.25 * accuracy.centering));

  // --- reaction: median time from the opponent's shot to the first move towards the ball
  const rts = reactionTimes(pos, fs, log.incomings || []);
  const reaction = { trials: rts.length, medianMs: rts.length ? percentile(rts, 50) : null, meanMs: rts.length ? mean(rts) : null };
  if (rts.length >= 3) scores.reaction = Math.round(100 * clamp01((1600 - reaction.medianMs) / (1600 - 400)));

  // --- endurance: effort in the second half of the session against the first half.
  // Where the ball goes is partly luck, so short sessions are not rated and a ratio
  // of 0.9 already earns full marks.
  const endurance = { ratio: null };
  if (durationSec >= 60) {
    const half = Math.floor(n / 2);
    const first = angle.slice(0, half), last = angle.slice(n - half);
    const spread = (a) => percentile(a, 95) - percentile(a, 5);
    const travelFirst = angularTravel(first), spreadFirst = spread(first);
    if (travelFirst >= 8 && spreadFirst >= 2) {
      endurance.ratio = 0.5 * Math.min(1.25, angularTravel(last) / travelFirst) + 0.5 * Math.min(1.25, spread(last) / spreadFirst);
      scores.endurance = Math.round(100 * clamp01((endurance.ratio - 0.3) / 0.6));
    }
  }

  // Movement only counts in full when it is aimed at the ball: with three or more balls
  // played, the total is scaled between 50% (none returned) and 100% (all returned).
  const engagement = trials >= 3 ? 0.5 + 0.5 * accuracy.hitRate : 1;
  const total = Math.round(totalScore(scores) * engagement);
  return { flags, engagement, durationSec, exercise: exercise.key, rom, activity, smooth, accuracy, reaction, endurance, scores, total, rank: rankFor(total) };
}

const TIPS = {
  rom: {
    ankle: 'つま先を上げきる・下げきるところまで、ゆっくり大きく動かしてみましょう。感度を下げると、より大きな動きが必要になります。',
    thigh: '太ももをもうひと息高く上げてみましょう。感度を下げると、より大きな動きが必要になります。',
  },
  activity: { any: 'ラリーを長く続けるほど運動量が増えます。球を待つあいだも、こまめに位置を合わせてみましょう。' },
  smooth: { any: '力を抜いて、一定の速さで「すーっ」と動かすのがコツです。なめらか補正を少し強くすると合わせやすくなります。' },
  accuracy: { any: '球の影を見て、早めにラケットを合わせましょう。ラケットを大きくする・球をゆっくりにすると合わせやすくなります。' },
  reaction: { any: '相手が打った瞬間の球の向きに注目しましょう。球が台ではずむ前に動き出せると余裕ができます。' },
  endurance: { any: '後半に動きが小さくなっています。無理をせず、点数を少なめにして回数を分けるのがおすすめです。' },
};

const PRAISE = {
  rom: '大きく動かせています。',
  activity: 'たくさん動かせました。',
  smooth: '動きがとてもなめらかです。',
  accuracy: 'ねらいが正確です。',
  reaction: '反応がすばやいです。',
  endurance: '最後まで動きが落ちませんでした。',
};

/** Pick the metric to praise (highest) and the one to work on (lowest) with a concrete tip. */
export function adviceFor(result) {
  const rated = METRIC_KEYS.filter((k) => Number.isFinite(result.scores[k]));
  if (!rated.length) return { focus: null, best: null, tip: 'もう少し長く遊ぶと、動きの分析ができます。', praise: 'おつかれさまでした。' };
  const byScore = [...rated].sort((a, b) => result.scores[a] - result.scores[b]);
  const focus = byScore[0];
  const best = byScore[byScore.length - 1];
  const tips = TIPS[focus];
  return {
    focus, best,
    tip: tips[result.exercise] || tips.any,
    praise: result.scores[best] >= 50 ? PRAISE[best] : 'おつかれさまでした。',
  };
}
