const assert = require('node:assert/strict');
const path = require('node:path');
const { loadExampleModule } = require('./helpers/load-example-module');

// examples/GAME-SUPER-START: the sensor side (motion.js) and the start rules (start.js) are pure
// modules. The signals below are shaped like a hand-held ORPHE CORE: 200 Hz, gravity on one axis,
// a few hundredths of a G and a few deg/s of tremor while "still".
const dir = path.join(__dirname, '../examples/GAME-SUPER-START');
const { MotionTracker, SampleClock, MOTION_DEFAULTS } = loadExampleModule(path.join(dir, 'motion.js'));
const { StartProcedure, FALSE_START_MS, gradeReaction, formatReaction } = loadExampleModule(path.join(dir, 'start.js'));

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/** Feed `tracker` a 200 Hz signal from t0 to t1. shape(t) -> { a: [x,y,z] extra G, w: deg/s }. */
function feed(tracker, t0, t1, shape, rnd = lcg(1)) {
  for (let t = t0; t < t1; t += 5) {
    const s = shape(t) || {};
    const a = s.a || [0, 0, 0];
    const n = () => (rnd() - 0.5) * 0.04;                       // tremor: +-0.02 G
    tracker.push({ t, ax: a[0] + n(), ay: a[1] + n(), az: 1 + a[2] + n(), gx: (s.w || 0) + (rnd() - 0.5) * 8, gy: (rnd() - 0.5) * 8, gz: (rnd() - 0.5) * 8 });
  }
}

// ---------------------------------------------------------------- stillness
{
  const m = new MotionTracker();
  feed(m, 0, 1000, () => null);
  assert.ok(m.stillMs(1000) > 900, 'a trembling but resting hand is still');
  assert.equal(m.stillMs(1000 + MOTION_DEFAULTS.staleMs + 50), 0, 'no samples = not known to be still');
  feed(m, 1000, 1100, () => ({ a: [0.6, 0, 0] }));
  assert.equal(m.stillMs(1100), 0, 'a push ends the stillness');
  feed(m, 1100, 2000, () => null);
  const still = m.stillMs(2000);
  assert.ok(still > 700 && still < 900, `stillness restarts after the push (${still} ms)`);
}
// the pose does not matter: any resting orientation counts as still once gravity has settled
{
  const m = new MotionTracker();
  for (let t = 0; t < 1500; t += 5) m.push({ t, ax: 0.6, ay: -0.64, az: 0.48, gx: 0, gy: 0, gz: 0 });
  assert.ok(m.stillMs(1500) > 1400);
  // turning the sensor over slowly is movement while it turns, still again afterwards
  for (let t = 1500; t < 2000; t += 5) m.push({ t, ax: 0.6, ay: -0.64, az: 0.48, gx: 200, gy: 0, gz: 0 });
  assert.equal(m.stillMs(2000), 0);
  for (let t = 2000; t < 3500; t += 5) m.push({ t, ax: -0.8, ay: 0.6, az: 0, gx: 0, gy: 0, gz: 0 });
  assert.ok(m.stillMs(3500) > 500, 'gravity reference follows the new pose');
}

// ---------------------------------------------------------------- onset
{
  // movement starts at 2140 ms and ramps up: 0 -> 1.5 G over 60 ms
  const m = new MotionTracker();
  const move = (t) => (t >= 2140 ? { a: [Math.min(1.5, ((t - 2140) / 60) * 1.5), 0, 0] } : null);
  feed(m, 0, 2000, move);
  m.hold(true);
  assert.equal(m.findOnset(1000), null, 'nothing before the movement');
  feed(m, 2000, 2400, move);
  const on = m.findOnset(1000);
  assert.ok(on, 'movement found');
  assert.ok(on.trigger >= 2150 && on.trigger <= 2165, `trigger where it passes the move threshold (${on.trigger})`);
  assert.ok(on.t >= 2140 && on.t <= 2150, `onset is searched back to where it left the still band (${on.t})`);
  assert.ok(on.t <= on.trigger);
  // `since` is a hard floor: a movement already under way is not dated earlier than that
  const late = m.findOnset(2160);
  assert.ok(late.t >= 2160);
}
// a rotation alone (wrist flick, almost no linear acceleration) is a movement too
{
  const m = new MotionTracker();
  feed(m, 0, 1000, () => null);
  feed(m, 1000, 1200, (t) => ({ w: Math.min(600, (t - 1000) * 12) }));
  const on = m.findOnset(500);
  assert.ok(on && on.t >= 1000 && on.t <= 1015, `gyro onset (${on && on.t})`);
}
// tremor never triggers
{
  const m = new MotionTracker();
  feed(m, 0, 5000, () => null, lcg(7));
  assert.equal(m.findOnset(0), null);
}

// a hand that sags while the gravity reference is frozen reads a constant offset. That offset is
// not the start of the movement: the onset must stay at the real push, not 150 ms before it
{
  const m = new MotionTracker();
  feed(m, 0, 1000, () => null);
  m.hold(true);
  // 0.2 G of tilt from 1200 ms on (below the move threshold), the push starts at 2600 ms
  const shape = (t) => {
    const tilt = t >= 1200 ? 0.2 : 0;
    const push = t >= 2600 ? Math.min(1.5, ((t - 2600) / 60) * 1.5) : 0;
    return { a: [tilt + push, 0, 0] };
  };
  feed(m, 1000, 3000, shape);
  const on = m.findOnset(1000);
  assert.ok(on, 'movement found despite the offset');
  assert.ok(on.t >= 2595 && on.t <= 2620, `onset at the push, not the full backtrack window earlier (${on.t})`);
}
// a gap in the stream: stillness is not credited for the time nothing was seen
{
  const m = new MotionTracker();
  feed(m, 0, 1000, () => null);
  feed(m, 3000, 3200, () => null);
  const still = m.stillMs(3200);
  assert.ok(still <= 200, `stillness restarts after a 2 s gap (${still} ms)`);
  assert.equal(m.inUse(3200), true);
  assert.equal(m.inUse(3200 + 6000), false, 'a sensor silent for a while is no longer "in use"');
  assert.equal(new MotionTracker().inUse(0), false, 'no sample ever: keyboard play');
}
// samples that share one time (arrival-time fallback, 4 per packet) still count 5 ms each
{
  const a = new MotionTracker(), b = new MotionTracker();
  for (let t = 0; t < 2000; t += 5) {
    const p = Math.sin((2 * Math.PI * 4 * t) / 1000);
    const s = { ax: 3 * p, ay: 0, az: 1, gx: 800 * p, gy: 0, gz: 0 };
    a.push({ t, ...s });
    b.push({ t: Math.floor(t / 20) * 20, ...s });      // delivered in bursts of four with one stamp
  }
  assert.ok(Math.abs(a.energy - b.energy) < 0.12, `effort is the same either way (${a.energy.toFixed(2)} vs ${b.energy.toFixed(2)})`);
}

// ---------------------------------------------------------------- shaking
{
  const m = new MotionTracker();
  // 4 Hz shake, +-3 G, +-800 deg/s
  feed(m, 0, 3000, (t) => { const p = Math.sin((2 * Math.PI * 4 * t) / 1000); return { a: [3 * p, 0, 0], w: 800 * p }; });
  assert.ok(m.energy > 0.5, `hard shaking reads as high effort (${m.energy.toFixed(2)})`);
  const c = m.cadence(3000);
  assert.ok(c >= 7 && c <= 9, `two strokes per cycle at 4 Hz (${c})`);
  feed(m, 3000, 4500, () => null);
  assert.ok(m.energy < 0.05, `effort falls when the shaking stops (${m.energy.toFixed(3)})`);
  assert.equal(m.cadence(4500), 0);
  // gentle waving is little effort
  const g = new MotionTracker();
  feed(g, 0, 3000, (t) => { const p = Math.sin((2 * Math.PI * 1.5 * t) / 1000); return { a: [0.3 * p, 0, 0], w: 80 * p }; });
  assert.ok(g.energy < 0.2, `gentle waving (${g.energy.toFixed(2)})`);
}

// ---------------------------------------------------------------- sample clock
{
  const c = new SampleClock();
  // sensor clock = page clock - 1000 ms; delivery takes 20 ms at best, with jitter up to +60 ms
  const rnd = lcg(3);
  let worst = 0;
  for (let stamp = 5000; stamp < 9000; stamp += 5) {
    const arrival = stamp + 1000 + 20 + Math.floor(rnd() * 60);
    const t = c.map(stamp, arrival);
    if (stamp > 5500) worst = Math.max(worst, Math.abs(t - (stamp + 1020)));
    assert.ok(t <= arrival, 'never later than the arrival');
  }
  assert.ok(worst <= 3, `jitter removed down to the fastest delivery (worst ${worst} ms)`);
  assert.equal(c.map(NaN, 1234), 1234, 'no stamp: arrival time');
  // one packet that arrives 400 ms late is exactly what the mapping is for: it must not switch it off
  const lateT = c.map(9000, 9000 + 1000 + 420);
  assert.equal(c.usable, true, 'a single late packet does not disable the stamps');
  assert.ok(Math.abs(lateT - (9000 + 1020)) <= 3, `the late packet is dated when it was measured (${lateT})`);
  // a stamp that jumps (reconnect / sensor clock reset) starts a new mapping instead of poisoning the old one
  const t = c.map(100, 20000);
  assert.equal(t, 20000);
  // stamps that drift against the page clock by more than the allowed spread are not used
  const d = new SampleClock({ maxSpreadMs: 100 });
  let last = 0;
  for (let i = 0; i < 400; i++) last = d.map(i * 5, 1000 + i * 6);
  assert.equal(d.usable, false);
  assert.equal(last, 1000 + 399 * 6);
}

// ---------------------------------------------------------------- start procedure
const OPT = { marksMs: 1000, steadyMs: 500, holdMinMs: 1000, holdMaxMs: 2000, setLimitMs: 4000, noStartMs: 2000 };
/** Run the procedure on a 10 ms tick. script(now, proc) -> input. Returns all events with their time. */
function run(proc, script, until = 12000) {
  const out = [];
  proc.begin(0);
  for (let now = 0; now <= until && proc.phase !== 'done'; now += 10) {
    for (const e of proc.step(now, script(now, proc))) {
      out.push({ ...e, at: now });
      if (e.type === 'fire') proc.fired(now + 30);   // the gun is heard 30 ms after it is triggered
    }
  }
  return out;
}
const types = (ev) => ev.map((e) => e.type).join(' ');

// a clean start: steady in SET, gun after the random hold, reaction 0.150 s after the gun is heard
{
  const p = new StartProcedure(OPT, () => 0.5);
  const ev = run(p, (now, proc) => ({ stillMs: now >= 1000 ? now - 1000 : 0, onsetAt: proc.gunAt != null && now >= proc.gunAt + 150 ? proc.gunAt + 150 : null }));
  assert.equal(types(ev), 'set steady fire reaction');
  const [set, steady, fire, reaction] = ev;
  assert.equal(set.at, 1000);
  assert.equal(steady.at, 1500, 'steady needs steadyMs of stillness');
  assert.equal(fire.at, 3000, 'hold = min + rng * (max - min)');
  assert.equal(reaction.ms, 150, 'measured from when the gun is heard, not from when it was triggered');
}
// the hold really is random between the two limits
{
  for (const [r, at] of [[0, 2500], [0.999, 3500]]) {
    const ev = run(new StartProcedure(OPT, () => r), (now) => ({ stillMs: now >= 1000 ? now - 1000 : 0 }));
    assert.ok(Math.abs(ev.find((e) => e.type === 'fire').at - at) <= 10);
    assert.equal(ev[ev.length - 1].type, 'no-start', 'no reaction within noStartMs');
  }
}
// moving after "set" is fine until the starter is satisfied; it only delays the gun
{
  const p = new StartProcedure(OPT, () => 0);
  const ev = run(p, (now) => ({ stillMs: now >= 2000 ? now - 2000 : 0 }));
  assert.equal(ev[1].type, 'steady');
  assert.equal(ev[1].at, 2500);
}
// moving after everyone is steady and before the gun: false start
{
  const p = new StartProcedure(OPT, () => 0.5);
  const ev = run(p, (now) => ({ stillMs: now >= 1000 && now < 2200 ? now - 1000 : 0, onsetAt: now >= 2200 ? 2200 : null }));
  assert.equal(types(ev), 'set steady false-start');
  assert.equal(ev[2].reason, 'before-gun');
}
// the 0.100 s rule: 0.099 is a false start, 0.100 is legal
{
  for (const [rt, expected] of [[99, 'false-start'], [100, 'reaction'], [60, 'false-start']]) {
    const p = new StartProcedure(OPT, () => 0.5);
    const ev = run(p, (now, proc) => ({ stillMs: now >= 1000 ? now - 1000 : 0, onsetAt: proc.gunAt != null && now >= proc.gunAt + rt ? proc.gunAt + rt : null }));
    const last = ev[ev.length - 1];
    assert.equal(last.type, expected, `${rt} ms`);
    if (expected === 'false-start') { assert.equal(last.reason, 'too-fast'); assert.equal(last.ms, rt); }
  }
  assert.equal(FALSE_START_MS, 100);
}
// a movement that began between the trigger and the sound of the gun is before the gun
{
  const p = new StartProcedure(OPT, () => 0.5);
  const ev = run(p, (now) => ({ stillMs: now >= 1000 ? now - 1000 : 0, onsetAt: now >= 3010 ? 3010 : null }));
  const last = ev[ev.length - 1];
  assert.equal(last.type, 'false-start');
  assert.equal(last.reason, 'before-gun');
}
// a field that never settles is stood up and the procedure starts over, without a penalty
{
  const p = new StartProcedure(OPT, () => 0.5);
  const ev = run(p, (now) => ({ stillMs: now >= 6500 ? now - 6500 : 0 }));
  assert.equal(types(ev).startsWith('set unsteady set steady fire'), true, types(ev));
  assert.equal(ev[1].at, 5000);
}
// keyboard: a key during SET or the hold is a false start, a key after the gun is the reaction
{
  let p = new StartProcedure(OPT, () => 0.5);
  let ev = run(p, (now) => ({ stillMs: Infinity, keyAt: now >= 1200 ? 1200 : null }));
  assert.equal(types(ev), 'set false-start');
  p = new StartProcedure(OPT, () => 0.5);
  ev = run(p, (now, proc) => ({ stillMs: Infinity, keyAt: proc.gunAt != null && now >= proc.gunAt + 210 ? proc.gunAt + 210 : null }));
  assert.equal(types(ev), 'set steady fire reaction');
  assert.equal(ev[3].ms, 210);
  // a key pressed back on "on your marks" is not held against the runner
  p = new StartProcedure(OPT, () => 0.5);
  ev = run(p, (now, proc) => ({ stillMs: Infinity, keyAt: now < 1000 ? 500 : (proc.gunAt != null && now >= proc.gunAt + 180 ? proc.gunAt + 180 : null) }));
  assert.equal(types(ev), 'set steady fire reaction');
}

// ---------------------------------------------------------------- grades and formatting
assert.equal(gradeReaction(99), null);
assert.equal(gradeReaction(129.9).grade, 'S');
assert.equal(gradeReaction(130).grade, 'A');
assert.equal(gradeReaction(199).grade, 'B');
assert.equal(gradeReaction(1200).grade, 'E');
assert.equal(gradeReaction(NaN), null);
assert.equal(formatReaction(142.9), '0.142', 'truncated, not rounded');
assert.equal(formatReaction(1003), '1.003');
assert.equal(formatReaction(NaN), '-.---');

console.log('super-start-motion.test.js passed');
