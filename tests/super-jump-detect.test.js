const assert = require('node:assert/strict');
const path = require('node:path');
const { loadExampleModule } = require('./helpers/load-example-module');

// examples/GAME-SUPER-JUMP/jumpdetect.js: take-off, landing and height of a real vertical jump
// from the acceleration [G] and the quaternion of a sensor on the foot (the method of
// ORPHE JUMP OVER). The signals here are synthetic: a foot at rest reads 1 G, a foot in free
// fall reads 0 G, and the push-off and the landing are short spikes.
const { JumpDetector, SerialClock, flightHeightCm, DETECT_DEFAULTS } =
  loadExampleModule(path.join(__dirname, '../examples/GAME-SUPER-JUMP/jumpdetect.js'));

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const DT = 0.005;
const ID = { w: 1, x: 0, y: 0, z: 0 };
// the sensor strapped on at an angle: 90° about X turns the sensor's Y axis into the world's up
const TILT = { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 };
const up = (g, q) => (q === TILT ? { x: 0, y: g, z: 0 } : { x: 0, y: 0, z: g });

/** Feed a jump: rest, a take-off spike, `flight` seconds of free fall, a landing spike, rest. */
function feed(det, { flight = 0.5, rest = 2.0, q = ID, t0 = 0, takeoffG = 7, landG = 12, air = 0 } = {}) {
  const events = [];
  let t = t0;
  const push = (g) => { const r = det.push(t, up(g, q), q); if (r) events.push(r); t += DT; };
  for (let i = 0; i < rest / DT; i++) push(1);
  push(takeoffG);
  for (let i = 1; i < flight / DT; i++) push(air);
  push(landG);
  for (let i = 0; i < 0.6 / DT; i++) push(1);
  return { events, t };
}

near(flightHeightCm(0.5), 30.65, 0.05, 'free fall: 0.5 s in the air is about 31 cm');
near(flightHeightCm(0.64), 50.2, 0.1, '0.64 s is about 50 cm');
assert.equal(flightHeightCm(0), 0);
assert.equal(flightHeightCm(-1), 0);

{
  // one jump: take-off at the spike, the result at the landing
  const det = new JumpDetector();
  const { events } = feed(det, { flight: 0.5 });
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'jump']);
  const j = events[1];
  near(j.flight, 0.5, 0.006, 'the flight is the time between the two impacts');
  // (the spike samples are part of the integral, so the raw height sits a little off g T² / 8)
  near(j.raw, flightHeightCm(0.5), 2.5, 'integrating the acceleration gives the free-fall height');
  near(j.cm, DETECT_DEFAULTS.CAL_A * j.raw + DETECT_DEFAULTS.CAL_B, 1e-9, 'the calibration against the video is applied');
  assert.equal(j.still, true, 'the reference before the take-off was at rest');
  near(j.apexT, 0.25, 0.02, 'the top is in the middle');
}
{
  // a longer flight is a higher jump
  const cm = [0.35, 0.45, 0.55, 0.65].map((flight) => feed(new JumpDetector(), { flight }).events[1].cm);
  for (let i = 1; i < cm.length; i++) assert.ok(cm[i] > cm[i - 1] + 5, `higher with every 0.1 s (${cm.map((v) => v.toFixed(1)).join(', ')})`);
}
{
  // the sensor can be strapped on at any angle: the quaternion turns the acceleration into world coordinates
  const a = feed(new JumpDetector(), { flight: 0.5 }).events[1];
  const b = feed(new JumpDetector(), { flight: 0.5, q: TILT }).events[1];
  near(a.cm, b.cm, 0.01, 'the same jump with the sensor turned 90°');
  // and a quaternion that is not normalised is normalised
  const det = new JumpDetector();
  const big = { w: 2, x: 0, y: 0, z: 0 };
  const events = [];
  let t = 0;
  const push = (g) => { const r = det.push(t, { x: 0, y: 0, z: g }, big); if (r) events.push(r); t += DT; };
  for (let i = 0; i < 400; i++) push(1);
  push(7); for (let i = 1; i < 100; i++) push(0); push(12);
  near(events[1].cm, a.cm, 0.01, 'a quaternion of length 2');
}
{
  // a swinging foot reaches 6 G in the air: only a 10 G impact is the landing
  const det = new JumpDetector();
  const events = [];
  let t = 0;
  const push = (g) => { const r = det.push(t, { x: 0, y: 0, z: g }, ID); if (r) events.push(r); t += DT; };
  for (let i = 0; i < 400; i++) push(1);
  push(7);
  for (let i = 1; i < 60; i++) push(0);
  push(8);                                     // 0.3 s after the take-off, above TO_G but below LD_G
  for (let i = 0; i < 39; i++) push(0);
  push(12);
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'jump']);
  near(events[1].flight, 0.5, 0.006, 'the 8 G in mid air did not end the jump');
}
{
  // an impact sooner than MIN_FLIGHT after the take-off is not the landing (the push-off itself rings)
  const det = new JumpDetector();
  const events = [];
  let t = 0;
  const push = (g) => { const r = det.push(t, { x: 0, y: 0, z: g }, ID); if (r) events.push(r); t += DT; };
  for (let i = 0; i < 400; i++) push(1);
  push(7); push(13); push(11);
  for (let i = 3; i < 100; i++) push(0);
  push(12);
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'jump']);
  near(events[1].flight, 0.5, 0.006, 'the flight still starts at the first spike');
}
{
  // a take-off without a landing is cancelled after MAX_FLIGHT, and the next jump is found again
  const det = new JumpDetector();
  const events = [];
  let t = 0;
  const push = (g) => { const r = det.push(t, { x: 0, y: 0, z: g }, ID); if (r) events.push(r); t += DT; };
  for (let i = 0; i < 400; i++) push(1);
  push(7);
  for (let i = 0; i < 1.1 / DT; i++) push(2);     // never an impact, never at rest
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'cancel']);
  const again = feed(det, { flight: 0.4, t0: t });
  assert.deepEqual(again.events.map((e) => e.type), ['takeoff', 'jump']);
}
{
  // a low hop lands with less than LD_G: once the foot is at rest again it is a jump of the
  // duration up to the largest impact (the third jump of a real triple jump, 2026-11-23)
  const det = new JumpDetector();
  const events = [];
  let t = 0;
  const push = (g) => { const r = det.push(t, { x: 0, y: 0, z: g }, ID); if (r) events.push(r); t += DT; };
  for (let i = 0; i < 400; i++) push(1);
  push(7);
  for (let i = 1; i < 0.28 / DT; i++) push(0.3);
  push(7.6);
  const landedAt = t;
  for (let i = 0; i < 0.3 / DT && events.length < 2; i++) push(1);
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'soft']);
  near(events[1].flight, 0.28, 0.006, 'the flight ends at the impact');
  near(events[1].impact, 7.6, 1e-9);
  assert.ok(t - landedAt < 0.2, 'and it is reported as soon as the foot has been at rest for SOFT_STILL, not after MAX_FLIGHT');
  // the next jump is found right away
  assert.deepEqual(feed(det, { flight: 0.4, t0: t }).events.map((e) => e.type), ['takeoff', 'jump']);
}
{
  // the impact itself was lost (BLE): only the part of the flight that was seen falling counts
  const det = new JumpDetector();
  const events = [];
  let t = 0;
  const push = (g) => { const r = det.push(t, { x: 0, y: 0, z: g }, ID); if (r) events.push(r); t += DT; };
  for (let i = 0; i < 400; i++) push(1);
  push(7);
  for (let i = 1; i < 0.15 / DT; i++) push(0.3);
  t += 0.3;                                         // a hole in the data
  for (let i = 0; i < 0.3 / DT && events.length < 2; i++) push(1);
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'soft']);
  assert.equal(events[1].impact, null);
  assert.ok(events[1].flight < 0.16, `the hole is not counted as flight (${events[1].flight})`);
}
{
  // a stamp taken for a take-off (the foot never left the floor) is over quickly, with no height
  const det = new JumpDetector();
  const events = [];
  let t = 0;
  const push = (g) => { const r = det.push(t, { x: 0, y: 0, z: g }, ID); if (r) events.push(r); t += DT; };
  for (let i = 0; i < 400; i++) push(1);
  push(7);
  for (let i = 0; i < 0.5 / DT && events.length < 2; i++) push(1);
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'soft']);
  assert.equal(events[1].flight, 0);
  assert.ok(events[1].t < 400 * DT + 0.3, 'at MIN_FLIGHT');
}
{
  // no data before the take-off: the height cannot be integrated, but the flight time is reported
  const det = new JumpDetector();
  const { events } = feed(det, { flight: 0.5, rest: 0.3 });
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'rejected']);
  assert.equal(events[1].reason, 'no-reference');
  near(events[1].flight, 0.5, 0.006, 'so that the game can fall back on g T² / 8');
}
{
  // a "jump" that integrates to nothing (the foot never left: about 1 G all the way) is rejected
  const det = new JumpDetector();
  const { events } = feed(det, { flight: 0.4, air: 1.2 });
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'rejected']);
  assert.equal(events[1].reason, 'out-of-range');
}
{
  // enabled = false: the samples are only the gravity reference of the next jump
  const det = new JumpDetector();
  det.enabled = false;
  let t = 0;
  const events = [];
  const push = (g) => { const r = det.push(t, { x: 0, y: 0, z: g }, ID); if (r) events.push(r); t += DT; };
  for (let k = 0; k < 6; k++) { for (let i = 0; i < 60; i++) push(1); push(9); push(14); }   // stamping
  assert.equal(events.length, 0, 'stamping while not listening is not a jump');
  assert.equal(det.state, 'ground');
  det.enabled = true;
  for (let i = 0; i < 60; i++) push(1);
  push(7); for (let i = 1; i < 100; i++) push(0); push(12);
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'jump'], 'the first jump after listening starts is measured');
  assert.ok(events[1].cm > 20 && events[1].cm < 45, `with the stamping as its reference (${events[1].cm.toFixed(1)} cm)`);
}
{
  // switched off in mid air: the take-off is forgotten, and the landing is not taken as a take-off result
  const det = new JumpDetector();
  let t = 0;
  const events = [];
  const push = (g) => { const r = det.push(t, { x: 0, y: 0, z: g }, ID); if (r) events.push(r); t += DT; };
  for (let i = 0; i < 400; i++) push(1);
  push(7);
  det.enabled = false;
  for (let i = 1; i < 100; i++) push(0);
  push(12);
  assert.deepEqual(events.map((e) => e.type), ['takeoff']);
  assert.equal(det.state, 'ground');
}
{
  // the refractory time after a landing: the ringing of the impact is not the next take-off,
  // but a second jump soon after (the triple jump) is
  const events = [];
  const det2 = new JumpDetector();
  let u = 0;
  const push = (g) => { const r = det2.push(u, { x: 0, y: 0, z: g }, ID); if (r) events.push(r); u += DT; };
  for (let i = 0; i < 400; i++) push(1);
  push(7); for (let i = 1; i < 90; i++) push(0); push(12);
  push(9); push(8);                           // the impact rings
  for (let i = 0; i < 0.45 / DT; i++) push(1);
  push(7); for (let i = 1; i < 90; i++) push(0); push(12);
  assert.deepEqual(events.map((e) => e.type), ['takeoff', 'jump', 'takeoff', 'jump'], 'two jumps half a second apart');
  // the gravity reference of the second jump contains the free fall of the first: its mean is
  // well below 1 G, and must not shrink the second jump
  assert.equal(events[1].still, true);
  assert.equal(events[3].still, false, 'the foot was not at rest before the second take-off');
  near(events[3].cm, events[1].cm, 0.5, 'the same jump twice in a row measures the same');
}
{
  // samples that repeat or step back in time, and broken samples, are dropped
  const det = new JumpDetector();
  assert.equal(det.push(1, { x: 0, y: 0, z: 1 }, ID), null);
  assert.equal(det.push(1, { x: 0, y: 0, z: 20 }, ID), null, 'the same time again');
  assert.equal(det.push(0.5, { x: 0, y: 0, z: 20 }, ID), null, 'a step back');
  assert.equal(det.push(1.1, { x: NaN, y: 0, z: 1 }, ID), null, 'NaN');
  assert.equal(det.push(1.2, { x: 0, y: 0, z: 20 }, null), null, 'no quaternion');
  assert.equal(det.buf.length, 1);
  assert.equal(det.state, 'ground');
  // the buffer keeps BUFFER_SEC seconds
  for (let i = 0; i < 2000; i++) det.push(2 + i * DT, { x: 0, y: 0, z: 1 }, ID);
  assert.ok(det.buf.length <= DETECT_DEFAULTS.BUFFER_SEC / DT + 2);
}
{
  // SerialClock: uint16 serial numbers wrap; time keeps going
  const c = new SerialClock();
  assert.equal(c.time(65534, 0), 0);
  near(c.time(65534, 3), 0.015, 1e-9, 'four samples per packet, 5 ms apart');
  near(c.time(65535, 0), 0.02, 1e-9, '20 ms per packet');
  near(c.time(0, 0), 0.04, 1e-9, 'across the wrap');
  near(c.time(1, 2), 0.07, 1e-9, 'and on');
  // without serial numbers: the count of samples, pulled forward when samples are missing
  const a = new SerialClock();
  assert.equal(a.arrival(1000), 0);
  near(a.arrival(1003), 0.02, 1e-9, 'a burst is spread out again');
  near(a.arrival(1004), 0.04, 1e-9, 'sample by sample');
  near(a.arrival(1500), 0.5, 1e-9, 'a gap moves the clock');
  const b = new SerialClock();
  b.arrival(0, 0.01);
  near(b.arrival(1, 0.01), 0.01, 1e-9, 'the step can be 10 ms (100 Hz)');
}

console.log('super-jump-detect: ok');
