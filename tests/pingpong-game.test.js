const assert = require('node:assert/strict');
const path = require('node:path');
const { loadExampleModule } = require('./helpers/load-example-module');

// GAME-SUPER-PINGPONG keeps its rules (game.js) and its sensor maths (input.js) free of
// DOM and three.js so they can be exercised here.
const dir = path.resolve(__dirname, '../examples/GAME-SUPER-PINGPONG');
const G = loadExampleModule(path.join(dir, 'game.js'));
const I = loadExampleModule(path.join(dir, 'input.js'));
const DT = 1 / 120;

function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

// ---------------------------------------------------------------- game.js
// the rails fold the predicted path back into the court
near(G.predictY(0, 0, 1, 0, 1, 0.8), 0, 1e-9, 'straight shot');
near(G.predictY(0, 0, 1, 1, 1, 0.8), 0.6, 1e-9, 'one bounce off the far rail');
near(G.predictY(0, 0, -1, -1, -2.4, 0.8), 0.8, 1e-9, 'two bounces');
assert.ok(G.ballSpeedFor(10) > G.ballSpeedFor(4) && G.ballSpeedFor(4) > G.ballSpeedFor(1));

// a CPU-vs-CPU match always ends, with a legal score, and the ball never leaves the rails
for (const seed of [1, 2, 3, 4, 5]) {
  const sim = new G.PongSim({ mode: 'vs', pointsToWin: 3, cpu: [0, 0], seed });
  sim.startMatch(0);
  let misses = 0, points = 0, over = null;
  for (let i = 0; i < 120 * 600 && !over; i++) {
    sim.step(DT);
    if (sim.ball.state === 'live') assert.ok(Math.abs(sim.ball.y) <= sim.wall + 1e-6, 'ball inside the rails');
    for (const ev of sim.drain()) {
      if (ev.type === 'miss') misses++;
      if (ev.type === 'point') { points++; assert.equal(ev.score[0] + ev.score[1], points); }
      if (ev.type === 'over') over = ev;
    }
  }
  assert.ok(over, `seed ${seed}: the match ends within ten minutes`);
  assert.equal(misses, points, 'every miss is exactly one point');
  assert.equal(Math.max(...over.score), 3);
  assert.ok(Math.min(...over.score) < 3);
  assert.equal(over.winner, over.score[0] === 3 ? 0 : 1);
  assert.equal(sim.phase, 'over');
}

// a human paddle on the ball's line returns it; the return speeds up with the rally
{
  const sim = new G.PongSim({ mode: 'vs', cpu: [null, null], items: false, seed: 7 });
  sim.startMatch(0);
  const hits = [];
  let ended = false;
  for (let i = 0; i < 120 * 60 && hits.length < 4 && !ended; i++) {
    for (const side of [0, 1]) {
      const b = sim.ball;
      const coming = b.state === 'live' && Math.sign(b.vx) === (side === 0 ? -1 : 1);
      const targetY = coming ? G.predictY(b.x, b.y, b.vx, b.vy, (side === 0 ? -1 : 1) * G.COURT.paddleX, sim.wall) : 0;
      sim.setInput(side, targetY / sim.travel(side));
    }
    sim.step(DT);
    for (const ev of sim.drain()) { if (ev.type === 'hit') hits.push(ev); if (ev.type === 'miss') ended = true; }
  }
  assert.equal(hits.length, 4, 'perfect tracking keeps the rally alive');
  assert.deepEqual(hits.map((h) => h.side), [1, 0, 1, 0], 'the receiver of the serve hits first, then they alternate');
  assert.deepEqual(hits.map((h) => h.rally), [1, 2, 3, 4]);
  assert.ok(hits.every((h) => Math.abs(h.offset) < 0.2 && Math.abs(h.rawOffset) < 0.2), 'tracked balls meet the paddle centre');
  // the default pace is the third of five steps
  const pace = G.RALLY_PACES[G.DEFAULT_RALLY_PACE];
  assert.equal(G.DEFAULT_RALLY_PACE, 2);
  near(hits[3].speed / hits[0].speed, (1 + pace.rate * 4) / (1 + pace.rate * 1), 0.02, 'rally acceleration at the default pace');
}

// the rally pace is a setting: off, the original gentle pace, and three faster ones, each with a ceiling
{
  assert.equal(G.RALLY_PACES.length, 5);
  assert.deepEqual({ ...G.rallyPaceFor(0) }, { accelRate: 0, accelMax: 1 });
  near(G.rallyPaceFor(1).accelRate, 0.045, 1e-9, 'step 1 is the original pace');
  for (let i = 1; i < G.RALLY_PACES.length; i++) {
    assert.ok(G.RALLY_PACES[i].rate > G.RALLY_PACES[i - 1].rate && G.RALLY_PACES[i].max > G.RALLY_PACES[i - 1].max, 'each step is faster than the one before');
  }
  assert.ok(G.RALLY_PACES[G.DEFAULT_RALLY_PACE].rate > 0.045, 'the default speeds up faster than the original');
  assert.deepEqual({ ...G.rallyPaceFor(99) }, { ...G.rallyPaceFor(4) }, 'out-of-range settings are clamped');

  // a perfectly tracked rally: the ball speeds up per return and stops at the ceiling of its pace
  const rallySpeeds = (setting, returns) => {
    const sim = new G.PongSim({ mode: 'vs', cpu: [null, null], items: false, seed: 7, pointsToWin: 99, ...G.rallyPaceFor(setting) });
    sim.startMatch(0);
    const speeds = [];
    for (let i = 0; i < 120 * 400 && speeds.length < returns; i++) {
      for (const side of [0, 1]) {
        const b = sim.ball;
        const coming = b.state === 'live' && Math.sign(b.vx) === (side === 0 ? -1 : 1);
        sim.setInput(side, coming ? G.predictY(b.x, b.y, b.vx, b.vy, (side === 0 ? -1 : 1) * G.COURT.paddleX, sim.wall) / sim.travel(side) : 0);
      }
      sim.step(DT);
      for (const ev of sim.drain()) if (ev.type === 'hit') speeds.push(ev.speed / sim.cfg.ballSpeed / (ev.smash ? 1.3 : 1));
    }
    return speeds;
  };
  const off = rallySpeeds(0, 12);
  assert.ok(off.every((v) => Math.abs(v - 1) < 1e-9), 'pace 0 never speeds up');
  const fast = rallySpeeds(3, 30);
  assert.equal(fast.length, 30);
  near(fast[4] / fast[0], (1 + G.RALLY_PACES[3].rate * 5) / (1 + G.RALLY_PACES[3].rate * 1), 0.02, 'pace 3 per-return gain');
  near(Math.max(...fast), G.RALLY_PACES[3].max, 1e-6, 'pace 3 stops at its ceiling');
  near(fast[29], G.RALLY_PACES[3].max, 1e-6, 'and stays there');
}

// an unattended paddle loses the point, and the player who missed serves next
{
  const sim = new G.PongSim({ mode: 'vs', pointsToWin: 2, cpu: [null, null], items: false, seed: 3 });
  sim.startMatch(0);
  sim.setInput(1, -1);   // player 1 parks in the corner and (almost always) misses
  const events = [];
  for (let i = 0; i < 120 * 40 && sim.phase !== 'over'; i++) {
    const b = sim.ball;
    sim.setInput(0, b.state === 'live' ? b.y / sim.travel(0) : 0);
    sim.step(DT);
    events.push(...sim.drain());
  }
  const points = events.filter((e) => e.type === 'point');
  assert.ok(points.length >= 2);
  assert.equal(points[0].loser, 1);
  assert.equal(events.find((e) => e.type === 'serve-ready' && e.t > points[0].t).server, 1, 'the player who missed serves');
  assert.deepEqual(points[points.length - 1].final, true);
  assert.equal(sim.winner, 0);
  assert.ok(events.some((e) => e.type === 'incoming' && e.side === 1 && Math.abs(e.target) <= 1), 'each shot announces where it will arrive');
}

// a CPU that misjudges a ball misses it wherever the ball goes, also along the rails
{
  const sim = new G.PongSim({ mode: 'vs', pointsToWin: 99, cpu: [null, 0], items: false, ...G.rallyPaceFor(0), ballSpeed: G.ballSpeedFor(9), seed: 21 });
  sim.paddles[1].cpu.level = { ...sim.paddles[1].cpu.level, miss: 10, speed: 6, react: 0.05 };   // always misjudges, always gets where it aims
  sim.startMatch(0);
  let cpuHits = 0, cpuMisses = 0, edge = 1;
  for (let i = 0; i < 120 * 400 && cpuMisses + cpuHits < 40; i++) {
    const b = sim.ball;
    // the human returns everything off the edge of the paddle, so the shots run along the rails
    const reach = sim.paddles[0].half + b.r * 0.85;
    const y = b.state === 'live' && b.vx < 0 ? G.predictY(b.x, b.y, b.vx, b.vy, -G.COURT.paddleX, sim.wall) : b.y;
    sim.setInput(0, (y - edge * 0.85 * reach) / sim.travel(0));
    sim.step(DT);
    for (const ev of sim.drain()) {
      if (ev.type === 'hit' && ev.side === 1) cpuHits++;
      if (ev.type === 'hit' && ev.side === 0) edge = -edge;
      if (ev.type === 'miss' && ev.side === 1) cpuMisses++;
    }
  }
  assert.ok(cpuMisses + cpuHits >= 40, `the rally reaches the CPU often enough (${cpuMisses + cpuHits})`);
  assert.equal(cpuHits, 0, 'a misjudged ball is never returned by accident');
}

// co-op: three misses end the match, the rally total is the score
{
  const sim = new G.PongSim({ mode: 'coop', pointsToWin: 3, cpu: [null, null], items: false, seed: 11 });
  sim.startMatch(0);
  sim.setInput(0, 1); sim.setInput(1, 1);   // nobody plays
  let over = null;
  for (let i = 0; i < 120 * 120 && !over; i++) { sim.step(DT); over = sim.drain().find((e) => e.type === 'over') || null; }
  assert.ok(over);
  assert.equal(sim.lives, 0);
  assert.deepEqual(Array.from(sim.score), [0, 0]);   // Array.from: sim arrays come from the vm realm
  assert.equal(over.winner, null);
  assert.equal(sim.coopGoal, 18);
}

// items: a collected mikan widens the collector's paddle, then wears off
{
  const sim = new G.PongSim({ mode: 'vs', cpu: [1, 1], items: true, seed: 5, pointsToWin: 99 });
  sim.startMatch(0);
  const seen = new Set();
  for (let i = 0; i < 120 * 900 && !(seen.has('item-get') && seen.has('item-end')); i++) {
    sim.step(DT);
    for (const ev of sim.drain()) {
      seen.add(ev.type);
      if (ev.type === 'item-get' && ev.item.type === 'mikan') assert.ok(sim.paddles[ev.side].half > sim.paddles[ev.side].baseHalf, 'a mikan widens the paddle');
    }
  }
  assert.ok(seen.has('item-spawn') && seen.has('item-get'), 'items appear and get collected');
  assert.ok(seen.has('item-end'), 'timed effects wear off');
  assert.ok(sim.paddles.every((p) => p.half === p.baseHalf || p.bigUntil > sim.t));
}

// ---------------------------------------------------------------- input.js
const quat = (axis, deg) => {
  const h = (deg * Math.PI) / 360, s = Math.sin(h), n = Math.hypot(...axis);
  return { w: Math.cos(h), x: (axis[0] / n) * s, y: (axis[1] / n) * s, z: (axis[2] / n) * s };
};
const mul = (a, b) => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});
const eulerPitch = (q) => Math.asin(Math.max(-1, Math.min(1, 2 * (q.w * q.y - q.z * q.x))));

assert.deepEqual(Array.from(I.gravityFromQuat({ w: 1, x: 0, y: 0, z: 0 })), [0, 0, 1]);

// before calibration the tilt is the SDK's euler.pitch, and yaw (heading drift) does not move it
{
  const input = new I.TiltInput(0);
  let now = 0;
  const feed = (q, n = 60) => { for (let i = 0; i < n; i++) { now += 10; input.feedQuat(q, now); } };
  feed(quat([0, 1, 0], 0));
  near(input.deg, 0, 1e-6, 'resting pose is zero');
  const pitched = quat([0, 1, 0], 14);
  feed(pitched, 200);
  near(input.deg, eulerPitch(pitched) * I.RAD2DEG, 0.2, 'tilt equals euler.pitch');
  near(input.deg, 14, 0.2, 'tilt in degrees');
  feed(mul(quat([0, 0, 1], 70), pitched), 200);
  near(input.deg, 14, 0.2, 'yaw does not change the tilt');
  assert.equal(input.source(now), 'core');
  assert.equal(input.source(now + 5000), 'keys', 'a silent CORE hands control back to the keyboard');
  near(input.hz, 100, 3, 'measured sample rate');
}

// the 1€ filter settles on a constant and smooths noise
{
  const f = new I.OneEuro(1.5, 0.02);
  let out = 0, lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 400; i++) { out = f.filter(10 + (i % 2 ? 0.5 : -0.5), 0.01); if (i > 200) { lo = Math.min(lo, out); hi = Math.max(hi, out); } }
  near(out, 10, 0.2, 'filter converges');
  assert.ok(hi - lo < 0.25, 'filter removes most of a ±0.5 jitter');
}

// calibration finds the movement axis however the sensor is mounted
{
  const mount = quat([0.3, 0.2, 1], 115);            // arbitrary orientation of the sensor on the body
  const pose = (deg) => mul(quat([1, 0.25, 0], deg), mount);   // the joint turns about a tilted horizontal axis
  const input = new I.TiltInput(1);
  const cal = new I.Calibrator(input);
  let now = 0;
  const run = (seconds, degAt) => {
    const steps = Math.round(seconds * 100);
    for (let i = 0; i < steps; i++) { now += 10; input.feedQuat(pose(degAt(i / steps)), now); cal.update(0.01, now); }
  };
  run(0.5, () => 0);
  cal.start(now);
  assert.equal(cal.phase, 'rest');
  run(I.CALIB_SECONDS.rest + 0.05, () => 0);
  assert.equal(cal.phase, 'up');
  run(I.CALIB_SECONDS.up + 0.05, (s) => 21 * Math.sin(Math.PI * Math.min(1, s * 1.4)));
  assert.equal(cal.phase, 'down');
  run(I.CALIB_SECONDS.down + 0.05, (s) => -32 * Math.sin(Math.PI * Math.min(1, s * 1.4)));
  assert.equal(cal.phase, 'done');
  near(cal.result.up, 21, 1.2, 'measured upward range');
  near(cal.result.down, 32, 1.2, 'measured downward range');
  assert.ok(input.calibrated);

  input.settings.gain = 1;
  run(2, () => 21);
  near(input.deg, 21, 0.6, 'tilt follows the calibrated axis');
  near(input.position(), 1, 0.05, 'top of the range is the far end of the paddle travel');
  run(2, () => -32);
  near(input.position(), -1, 0.05, 'bottom of the range is the near end');
  run(2, () => -5.5);
  near(input.position(), 0, 0.05, 'the middle of the range is the middle of the table');
  input.settings.invert = true;
  run(1, () => 21);
  near(input.position(), -1, 0.05, 'invert flips the direction');

  const saved = input.exportCalibration();
  const again = new I.TiltInput(1);
  assert.ok(again.importCalibration(saved));
  near(again.range.up + again.range.down, saved.up + saved.down, 1e-9, 'a stored calibration restores the range');
  assert.equal(new I.TiltInput(0).importCalibration(null), false);
}

// the tilt cannot be measured around an axis that gravity lies along: the control must not freeze
{
  const input = new I.TiltInput(0);
  let now = 0;
  const feed = (q, n = 80) => { for (let i = 0; i < n; i++) { now += 10; input.feedQuat(q, now); } };
  feed(quat([1, 0, 0], 0));
  feed(quat([1, 0, 0], 90));          // rolled on its side: gravity now lies along the sensor's Y axis
  input.setZero();                    // "make this pose the middle"
  feed(quat([1, 0, 0], 105), 200);
  near(Math.abs(input.deg), 15, 0.5, 'zeroing in a pose along the default axis switches to a usable axis');

  // a stored calibration whose axis does not fit the way the sensor is mounted today is dropped, and flagged
  const remounted = new I.TiltInput(1);
  assert.ok(remounted.importCalibration({ axis: [0, 1, 0], up: 20, down: 20, exercise: 'ankle' }));
  now = 0;
  for (let i = 0; i < 80; i++) { now += 10; remounted.feedQuat(quat([1, 0, 0], 90), now); }
  assert.equal(remounted.calibrated, false);
  assert.equal(remounted.staleCalibration, true);
  for (let i = 0; i < 200; i++) { now += 10; remounted.feedQuat(quat([1, 0, 0], 100), now); }
  near(Math.abs(remounted.deg), 10, 0.5, 'the remounted sensor still controls the paddle');
}

// no calibration step: the axis and the range are learned from the movement itself while playing
for (const [label, mountAxis, mountDeg, jointAxis] of [['mount A', [0.3, 0.2, 1], 115, [1, 0.25, 0]], ['mount B', [1, 0.4, 0.2], 250, [-0.2, 1, 0.1]], ['mount C', [0, 0, 1], 0, [0, -1, 0]]]) {
  const mount = quat(mountAxis, mountDeg);
  const pose = (deg) => mul(quat(jointAxis, deg), mount);
  const input = new I.TiltInput(0);
  input.settings.gain = 1;
  let now = 0;
  const run = (seconds, degAt) => { const n = Math.round(seconds * 100); for (let i = 0; i < n; i++) { now += 10; input.feedQuat(pose(degAt(i / 100)), now); } };
  run(1, () => 0);                                             // sitting still: the resting pose
  assert.equal(input.autoFitted, false, `${label}: nothing is learned from standing still`);
  run(20, (t) => 13 * (1 - Math.cos(2 * Math.PI * 0.4 * t)));   // raising 0..26 deg and back, like toe raises
  assert.equal(input.autoFitted, true, `${label}: the movement was picked up`);
  near(input.range.up + input.range.down, 26, 4, `${label}: learned range`);
  run(1.5, () => 26);
  assert.ok(input.position() > 0.85, `${label}: raising moves the paddle to the far end (${input.position()})`);
  run(1.5, () => 0);
  assert.ok(input.position() < -0.85, `${label}: the resting pose is the near end (${input.position()})`);
  run(1.5, () => 13);
  near(input.position(), 0, 0.2, `${label}: half way is the middle`);
  // the range follows the player: smaller movements later on are stretched over the table again
  run(60, (t) => 7 * (1 - Math.cos(2 * Math.PI * 0.4 * t)));
  near(input.range.up + input.range.down, 14, 4, `${label}: the range shrinks to what the player uses`);
}
// a measured calibration is not overridden by the automatic one
{
  const input = new I.TiltInput(0);
  assert.ok(input.importCalibration({ axis: [0, -1, 0], up: 20, down: 20, exercise: 'ankle' }));
  let now = 0;
  for (let i = 0; i < 2000; i++) { now += 10; input.feedQuat(quat([0, 1, 0], 8 * Math.sin(i / 40)), now); }
  assert.equal(input.autoFitted, false);
  assert.deepEqual({ ...input.range }, { up: 20, down: 20 });
}

// too small a movement is rejected instead of producing a twitchy paddle
{
  const input = new I.TiltInput(0);
  const cal = new I.Calibrator(input);
  let now = 0;
  const run = (seconds, deg) => { for (let i = 0; i < seconds * 100; i++) { now += 10; input.feedQuat(quat([0, 1, 0], deg), now); cal.update(0.01, now); } };
  run(0.5, 0); cal.start(now);
  run(I.CALIB_SECONDS.rest + 0.05, 0);
  run(I.CALIB_SECONDS.up + 0.05, 2);
  assert.equal(cal.phase, 'failed');
  assert.equal(cal.reason, 'small');
  assert.equal(input.calibrated, false);
}

// without a CORE there is nothing to measure: keyboard control uses the default range
{
  const input = new I.TiltInput(0);
  const cal = new I.Calibrator(input);
  cal.start(1000);
  assert.equal(cal.phase, 'done');
  assert.equal(cal.reason, 'no-sensor');
  for (let i = 0; i < 200; i++) input.stepVirtual(1, 1 / 60, 1000 + i * 16);
  near(input.position(), 1, 1e-9, 'holding the up key reaches the far end');
  input.setVirtualPosition(-0.5, 1 / 60, 5000);
  near(input.position(), -0.5, 1e-9, 'pointer control sets the paddle directly');
  input.setExercise('thigh');
  assert.deepEqual({ ...input.range }, { ...I.DEFAULT_RANGE.thigh });
}

console.log('pingpong-game.test.js passed');
