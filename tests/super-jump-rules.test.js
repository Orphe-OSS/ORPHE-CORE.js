const assert = require('node:assert/strict');
const path = require('node:path');
const { loadExampleModule } = require('./helpers/load-example-module');

// examples/GAME-SUPER-JUMP/rules.js: the rules of the long jump and the triple jump.
// The game feeds it two inputs (stamping = run, a real jump = take-off + its height); these tests
// play it the same way.
const { RULES, EVENTS, createAttempt, simulate, gradeOf, liftScale, createWind, createField, standings, technique } =
  loadExampleModule(path.join(__dirname, '../examples/GAME-SUPER-JUMP/rules.js'));

const H = 1 / 240;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

/**
 * Play one attempt the way a player does. plan: { pause: seconds not stamping in mid run,
 * loss: metres before the line to take off (negative = over it; null = never),
 * errors: timing error of each contact in game seconds (null = no jump),
 * cms: height of the real jump behind each phase (default: the reference height),
 * air: game seconds between a take-off and the moment its height is known, wind }.
 */
function play(eventKey, { pause = 0, loss = 0.05, errors = [], cms = [], air = 0, wind = 0, refCm } = {}) {
  const sim = createAttempt(eventKey, { wind, refCm });
  const events = [];
  const push = (list) => { if (list) for (const e of list) events.push(e); };
  const done = new Set();
  let jumps = 0, pending = null;           // pending: { cm, left } — the real jump that is in the air
  const takeoff = (ahead) => {
    const ev = sim.takeoff(ahead);
    if (!ev) return;
    push(ev);
    pending = { cm: cms[jumps] == null ? sim.refCm : cms[jumps], left: air };
    jumps++;
  };
  for (let i = 0; i < 240 * 90 && sim.phase !== 'landed' && sim.phase !== 'through'; i++) {
    const stamping = !(pause > 0 && sim.s > -25 && sim.pauses < pause);
    if (pending) { pending.left -= H; if (pending.left <= 0) { push(sim.launch(pending.cm)); pending = null; } }
    if (sim.phase === 'run' && loss != null && sim.inZone && sim.s + sim.v * H >= -loss) takeoff(Math.max(0, (-loss - sim.s) / sim.v));
    const f = sim.flight;
    if (sim.phase === 'air' && f && f.input == null && !pending) {
      const e = errors[f.i];
      if (e != null && e <= 0 && sim.t + H - f.t0 >= f.T + e) takeoff(Math.max(0, f.t0 + f.T + e - sim.t));
    }
    const st = sim.stance;
    if (sim.phase === 'stance' && st && st.input == null && !done.has(st.i) && !pending) {
      const e = errors[st.i];
      if (e != null && e > 0 && sim.t - st.t0 >= e) { done.add(st.i); takeoff(0); }
    }
    push(sim.step(H, stamping));
  }
  return { sim, events, result: sim.result };
}
const of = (events, type) => events.filter((e) => e.type === type);
// (rules.js runs in its own vm realm: its arrays are copied before deepEqual compares prototypes)
const grades = (result) => Array.from(result.contacts, (c) => c.grade);

// ---------------------------------------------------------------- the run-up
{
  const { sim, events, result } = play('long', { loss: 0.05, errors: [0] });
  assert.equal(of(events, 'start').length, 1, 'the run starts with the first stamp');
  assert.equal(of(events, 'zone').length, 1, 'the take-off zone is announced once');
  assert.ok(of(events, 'zone')[0].armed, 'at full speed the jump is armed');
  near(result.speed, 9.83, 0.08, 'stamping all the way reaches about 9.8 m/s at the board');
  assert.equal(sim.phase, 'landed');
  assert.equal(result.foul, false);
}
{
  // a pause in the run-up costs speed, and speed costs distance
  const full = play('long', { loss: 0.05, errors: [0] }).result;
  const paused = play('long', { loss: 0.05, errors: [0], pause: 0.8 }).result;
  assert.ok(paused.speed < full.speed - 0.5, `a 0.8 s pause loses speed (${paused.speed.toFixed(2)} vs ${full.speed.toFixed(2)})`);
  assert.ok(paused.mark < full.mark - 0.6, `and with it distance (${paused.mark} vs ${full.mark})`);
}
{
  // standing on the runway does nothing: the attempt starts with the first stamp
  const sim = createAttempt('long');
  for (let i = 0; i < 500; i++) sim.step(H, false);
  assert.equal(sim.phase, 'ready');
  assert.equal(sim.t, 0);
  assert.equal(sim.takeoff(0), null, 'a jump before the run means nothing');
  assert.equal(sim.launch(40), null, 'and neither does its height');
}
{
  // a jump on the runway before the zone is not a take-off
  const sim = createAttempt('long');
  for (let i = 0; i < 240 * 2; i++) sim.step(H, true);
  assert.ok(sim.s < -RULES.ZONE && sim.phase === 'run');
  assert.equal(sim.takeoff(0), null);
  assert.equal(sim.phase, 'run');
}

// ---------------------------------------------------------------- the board
{
  const a = play('long', { loss: 0.02, errors: [0] }).result;
  const b = play('long', { loss: 0.3, errors: [0] }).result;
  assert.ok(a.just && !b.just, 'within 5 cm of the line is JUST');
  near(a.mark - b.mark, 0.28, 0.02, 'centimetres given away at the board are centimetres off the mark');
  near(a.loss, 0.02, 0.005, 'the loss is reported');
}
{
  // a toe over the line is a foul, however far the jump goes
  const { result, events } = play('long', { loss: -0.04, errors: [0] });
  assert.equal(result.foul, true);
  assert.equal(result.reason, 'line');
  assert.equal(result.mark, null);
  assert.ok(of(events, 'takeoff')[0].foul);
  assert.ok(result.raw > 8, 'the jump itself still happens');
}
{
  // never jumping: ran through
  const { sim, result } = play('long', { loss: null });
  assert.equal(sim.phase, 'through');
  assert.equal(result.reason, 'through');
  assert.equal(result.foul, true);
}
{
  // a take-off between two frames lands on the right centimetre
  const sim = createAttempt('long');
  while (!sim.inZone || sim.s < -1) sim.step(1 / 60, true);
  const s0 = sim.s, v = sim.v;
  const ev = sim.takeoff(0.004);
  near(ev[0].toe, s0 + v * 0.004, 1e-9, 'the toe position includes the time since the last step');
}
{
  // too slow at the board: nothing is armed and the jump is ignored
  const sim = createAttempt('long');
  let zone = null;
  for (let i = 0; i < 240 * 200 && !zone; i++) { const stamp = sim.v < 2.2; for (const e of sim.step(H, stamp)) if (e.type === 'zone') zone = e; }
  assert.ok(zone && !zone.armed, 'walking into the zone does not arm the jump');
  assert.equal(sim.takeoff(0), null);
}

// ---------------------------------------------------------------- the real jump: its height is the lift
{
  // the flight waits for the height: between take-off and launch nothing moves
  const sim = createAttempt('long');
  while (!sim.inZone || sim.s < -0.1) sim.step(H, true);
  const ev = sim.takeoff(0);
  assert.deepEqual(Array.from(ev, (e) => e.type), ['takeoff', 'charge']);
  assert.equal(sim.phase, 'charge');
  const s0 = sim.s, t0 = sim.t;
  for (let i = 0; i < 200; i++) assert.equal(sim.step(H, false).length, 0);
  assert.equal(sim.s, s0, 'the jumper stays on the board');
  assert.equal(sim.t, t0, 'and the clock of the attempt stands still');
  assert.equal(sim.takeoff(0), null, 'a second take-off while waiting means nothing');
  const up = sim.launch(40);
  assert.deepEqual(Array.from(up, (e) => e.type), ['height', 'phase']);
  assert.equal(sim.phase, 'air');
  assert.equal(sim.flight.t0, t0);
  assert.equal(sim.launch(60), null, 'one height per jump');
  sim.step(H, false);
  assert.equal(sim.takeoff(0), null, 'the last flight ends in the sand: nothing to jump for');
}
{
  // a higher jump is a longer jump
  const marks = [10, 20, 30, 40, 50, 60].map((cm) => play('long', { cms: [cm] }).result.mark);
  for (let i = 1; i < marks.length; i++) assert.ok(marks[i] > marks[i - 1] + 0.3, `every 10 cm is worth more than 30 cm of sand (${marks.join(', ')})`);
  near(play('long', { cms: [90] }).result.mark, marks[5], 0.011, 'above 1.5 × the reference there is no more to gain');
  assert.equal(play('long', { cms: [33] }).result.heights[0], 33, 'the height is reported with the result');
  near(play('long', { cms: [40], air: 0.3 }).result.mark, marks[3], 0.011, 'how long the real jump lasts does not change the mark');
}
{
  near(liftScale(0), RULES.JUMP_MIN_SCALE, 1e-9, 'no height at all still leaves the board');
  near(liftScale(RULES.JUMP_REF_CM), 1, 1e-9, 'the reference height is the full lift');
  near(liftScale(RULES.JUMP_REF_CM * 1.5), 1 + RULES.JUMP_BONUS, 1e-9, 'the bonus is reached at 1.5 ×');
  near(liftScale(500), 1 + RULES.JUMP_BONUS, 1e-9, 'and capped there');
  near(liftScale(-5), RULES.JUMP_MIN_SCALE, 1e-9, 'a negative height is no height');
  near(liftScale(NaN), RULES.JUMP_MIN_SCALE, 1e-9, 'nor is a broken one');
  near(liftScale(25, 25), 1, 1e-9, 'the reference can be lowered (children)');
  // the same real jump is worth more for a player whose reference is lower
  assert.ok(play('long', { cms: [25], refCm: 25 }).result.mark > play('long', { cms: [25] }).result.mark + 0.8);
}
assert.equal(gradeOf(0.02).key, 'perfect');
assert.equal(gradeOf(0.03).key, 'great', 'the windows were tightened after the first real play (2026-11-23)');
assert.equal(gradeOf(-0.05).key, 'great');
assert.equal(gradeOf(0.08).key, 'good');
assert.equal(gradeOf(-0.1).key, 'miss');
// a low jump costs more in the triple jump than in the long jump
assert.ok(liftScale(10, 40, RULES.TRIPLE.minScale) < liftScale(10, 40) - 0.04);
near(liftScale(40, 40, RULES.TRIPLE.minScale), 1, 1e-9, 'the reference height is the full lift there too');
assert.equal(gradeOf(null).key, 'miss');

// ---------------------------------------------------------------- how far: the scale of the marks
{
  const best = simulate('long', { speed: 9.83 });
  assert.ok(best.mark > 8.6 && best.mark < 8.95, `a long jump at the reference height is world class but short of the record (${best.mark})`);
  assert.ok(simulate('long', { speed: 9.83, cms: [50] }).mark > 8.95, 'a higher real jump beats it');
  const windy = simulate('long', { speed: 9.83, wind: 2 });
  assert.ok(windy.mark >= 8.9, `with a legal tail wind it reaches the record's neighbourhood (${windy.mark})`);
  assert.equal(windy.windAided, false, '+2.0 is still legal');
  assert.equal(simulate('long', { speed: 9.83, wind: 2.1 }).windAided, true);
  const slow = simulate('long', { speed: 8 });
  assert.ok(slow.mark > 5.5 && slow.mark < 6.6, `8 m/s is a school-yard jump (${slow.mark})`);
}
{
  const best = simulate('triple', { speed: 9.83, errors: [0, 0] });
  assert.ok(best.mark > 17.8 && best.mark < 18.29, `a triple jump at the reference height is just short of the record (${best.mark})`);
  assert.ok(simulate('triple', { speed: 9.83, errors: [0, 0], wind: 2 }).mark > 18.29, 'and beats it with a tail wind');
  const [hop, step, jump] = best.phases;
  assert.ok(hop > step && jump > step, 'the step is the shortest phase');
  const share = step / (hop + step + jump);
  assert.ok(share > 0.26 && share < 0.33, `the step is about 30% of the jump (${(share * 100).toFixed(1)}%)`);
}

// ---------------------------------------------------------------- the triple jump: contacts
{
  const { events, result } = play('triple', { loss: 0.05, errors: [0, 0] });
  assert.deepEqual(of(events, 'phase').map((e) => e.name), ['HOP', 'STEP', 'JUMP']);
  assert.equal(of(events, 'touch').length, 2);
  assert.deepEqual(grades(result), ['perfect', 'perfect']);
  assert.equal(result.phases.length, 3);
  assert.deepEqual(Array.from(result.heights), [40, 40, 40], 'three real jumps, one per phase');
  near(result.phases.reduce((a, b) => a + b, 0), result.raw + 0.05, 0.02, 'the phases add up to the jump, measured from the toe');
}
{
  // early (before the touch) and late (during the stance) jumps are both judged by their distance from the touch
  const early = play('triple', { errors: [-0.04, -0.04] }).result;
  const late = play('triple', { errors: [0.04, 0.04] }).result;
  assert.deepEqual(grades(early), ['great', 'great']);
  assert.deepEqual(grades(late), ['great', 'great']);
  near(early.mark, late.mark, 0.03, 'the same error early or late is worth the same');
}
{
  // an active contact keeps the speed; a missing one collapses, and the loss carries into the next phase
  const perfect = play('triple', { errors: [0, 0] }).result;
  const great = play('triple', { errors: [-0.06, 0.06] }).result;
  const collapsed = play('triple', { errors: [null, null] }).result;
  assert.ok(perfect.mark > great.mark + 0.5, `perfect contacts beat great ones clearly (${perfect.mark} vs ${great.mark})`);
  assert.ok(great.mark > collapsed.mark + 1.5, `and no contacts at all is a different jump (${collapsed.mark})`);
  assert.deepEqual(grades(collapsed), ['miss', 'miss']);
  assert.ok(collapsed.contacts[1].vhOut < perfect.contacts[1].vhOut * 0.9, 'the speed is gone by the jump');
  assert.equal(collapsed.foul, false, 'at full speed even a collapsed jump reaches the sand');
  assert.ok(collapsed.raw > EVENTS.triple.pitNear);
}
{
  // too slow to reach the pit: no mark
  const r = simulate('triple', { speed: 7.5, errors: [null, null] });
  assert.equal(r.foul, true);
  assert.equal(r.reason, 'short');
}
{
  // one jump per contact
  const sim = createAttempt('triple');
  while (!sim.inZone || sim.s < -0.1) sim.step(H, true);
  sim.takeoff(0); sim.launch(40);
  sim.step(H, false);
  assert.equal(sim.takeoff(0), null, 'right after the take-off the next jump is not taken yet');
  while (sim.t - sim.flight.t0 < sim.flight.T * 0.8) sim.step(H, false);
  const c = sim.nextContact;
  assert.ok(c && c.in > 0 && !c.final, 'the next contact is predicted while in the air');
  assert.ok(sim.takeoff(0), 'the jump for the contact is taken');
  assert.equal(sim.takeoff(0), null, 'a second one is not');
}
{
  // the height of a contact's jump: known before the foot leaves (no wait), or after it (the step waits)
  const early = play('triple', { errors: [-0.1, -0.1], cms: [40, 30, 50], air: 0.02 });
  assert.equal(of(early.events, 'charge').length, 1, 'only the board waits when the heights are in before the foot leaves');
  assert.deepEqual(Array.from(early.result.heights), [40, 30, 50]);
  const late = play('triple', { errors: [0.015, 0.015], cms: [40, 30, 50], air: 0.3 });
  assert.equal(of(late.events, 'charge').length, 3, 'every phase waits for its height when the jump is still in the air');
  assert.deepEqual(Array.from(late.result.heights), [40, 30, 50]);
  assert.deepEqual(grades(late.result), ['perfect', 'perfect'], 'the wait does not change the timing of the contact');
  // each phase has its own lift
  const low = play('triple', { errors: [0, 0], cms: [40, 15, 40] }).result, ref = play('triple', { errors: [0, 0] }).result;
  near(low.phases[0], ref.phases[0], 0.02, 'the hop is the same');
  assert.ok(low.phases[1] < ref.phases[1] - 1.0, `a low second jump is a short step (${low.phases[1].toFixed(2)} vs ${ref.phases[1].toFixed(2)})`);
  // a contact that was not jumped gets the height of a missed jump
  const none = play('triple', { errors: [null, null] }).result;
  assert.deepEqual(Array.from(none.heights), [40, RULES.MISS_CM, RULES.MISS_CM]);
}

// ---------------------------------------------------------------- wind
{
  const tail = simulate('long', { speed: 9.5, wind: 1.5 }).mark, calm = simulate('long', { speed: 9.5 }).mark, head = simulate('long', { speed: 9.5, wind: -1.5 }).mark;
  assert.ok(tail > calm && calm > head, 'a tail wind helps, a head wind hurts');
  near(tail - calm, 0.12, 0.05, '1.5 m/s is worth about ten centimetres, not metres');
  const w = createWind(7);
  let min = 9, max = -9, changes = 0, prev = null;
  for (let t = 0; t < 120; t += 0.1) { const v = w(t); min = Math.min(min, v); max = Math.max(max, v); if (prev != null && v !== prev) changes++; prev = v; }
  assert.ok(min < 0.2 && max > 1.0 && max < 3.6 && min > -3.2, `the wind swings between head and tail (${min}..${max})`);
  assert.ok(changes > 50, 'and keeps changing while the athlete waits');
  assert.equal(w(3.3), createWind(7)(3.3), 'the same seed gives the same wind');
}

// ---------------------------------------------------------------- the competition
for (const key of ['long', 'triple']) {
  const ev = EVENTS[key];
  const winners = [];
  for (let seed = 1; seed <= 200; seed++) {
    const field = createField(key, 3, seed);
    assert.equal(field.length, 7);
    for (const r of field) {
      assert.equal(r.marks.length, 3);
      assert.ok(r.marks.some((m) => m != null), 'every rival gets at least one mark');
      for (const m of r.marks) if (m != null) assert.ok(m > ev.wr * 0.8 && m < ev.wr, `${key}: rival marks are plausible (${m})`);
    }
    winners.push(standings(field, { marks: [] }, 3)[0].best);
  }
  winners.sort((a, b) => a - b);
  const median = winners[100];
  const flawless = simulate(key, { speed: 9.83, errors: [0, 0] }).mark;
  const decent = simulate(key, { speed: 9.83, loss: 0.2, errors: [-0.07, 0.07], cms: [36, 36, 36] }).mark;
  assert.ok(median < flawless - 0.15, `${key}: a flawless jump wins most finals (winner ${median}, flawless ${flawless})`);
  assert.ok(median > decent - 0.1, `${key}: a decent jump does not walk away with it (winner ${median}, decent ${decent})`);
  assert.equal(JSON.stringify(createField(key, 3, 42)), JSON.stringify(createField(key, 3, 42)), 'a field is fixed by its seed');
}
{
  const field = createField('long', 3, 5);
  const before = standings(field, { name: 'ME', marks: [] }, 1);
  assert.equal(before[before.length - 1].you, true, 'no mark yet: last');
  assert.equal(before.filter((r) => r.marks.length === 1).length, 7, 'only the rounds that were jumped are known');
  const after = standings(field, { name: 'ME', marks: [null, 9.5] }, 2);
  assert.equal(after[0].you, true);
  assert.equal(after[0].place, 1);
  assert.equal(after[0].best, 9.5);
  const allFouls = standings(field, { name: 'ME', marks: [null, null, null] }, 3);
  assert.equal(allFouls[7].you, true);
  assert.equal(allFouls[7].best, null);
}

// ---------------------------------------------------------------- technique: what the result card shows
{
  const t = technique(play('triple', { loss: 0.02, errors: [0, 0] }).result, 'triple');
  assert.ok(t.speed > 85 && t.board > 90 && t.rhythm === 100 && t.height === 100 && t.total > 90);
  assert.equal(technique(play('long', { cms: [20] }).result, 'long').height, 50, 'half the reference height is half the score');
  assert.equal(technique(play('long', { cms: [70] }).result, 'long').height, 100, 'and it does not go above 100');
  const foul = technique(play('long', { loss: -0.05, errors: [0] }).result, 'long');
  assert.equal(foul.board, 0);
  assert.equal(foul.rhythm, undefined, 'the long jump has no rhythm score');
  assert.equal(technique(null, 'long'), null);
}

console.log('super-jump-rules: ok');
