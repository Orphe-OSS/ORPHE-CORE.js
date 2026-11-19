const assert = require('node:assert/strict');
const path = require('node:path');
const { loadExampleModule } = require('./helpers/load-example-module');

// examples/GAME-SUPER-ADVENTURE: rules.js (the platformer rules) and level.js (the course).
// The players below are built from advise(), the same look-ahead the game uses for its
// JUMP / STOP / GO cues and for the sensors' jump assist. If they can finish the course
// without getting hurt, the cues are right and the course can be finished.
const dir = path.join(__dirname, '../examples/GAME-SUPER-ADVENTURE');
const { RULES, createSim, step, advise, botInput, enemyS, hammerState, bridgeState, gradeOf, prepareLevel, runUp, brakeDist } = loadExampleModule(path.join(dir, 'rules.js'));
const { buildLevel } = loadExampleModule(path.join(dir, 'level.js'));

const of = (events, type) => events.filter((e) => e.type === type);
/** Play the course with a player made of advise(). Returns { sim, events }. */
function play(options = {}, maxSec = 400) {
  const sim = createSim(buildLevel());
  const events = [], memo = {};
  let advice = advise(sim, memo);
  for (let i = 0; i < maxSec * 120 && !sim.p.finished; i++) {
    if (i % 2 === 0) advice = advise(sim, memo);
    const input = botInput(sim, advice, options);
    step(sim, input);
    if (input.jump) advice = { ...advice, jump: null };
    for (const e of sim.events) events.push(e);
    sim.events.length = 0;
  }
  return { sim, events };
}
/** A tiny hand-made level for one-rule tests. */
function tiny(extra = {}) {
  const ground = (a, b, h, more = {}) => ({ a, b, h, thick: 60, belt: 0, safe: true, kind: 'ground', ...more });
  return {
    start: { s: 1, y: 0 }, platforms: [ground(0, 40, 0)], bridges: [], enemies: [], notes: [], bells: [], springs: [], hammers: [],
    checkpoints: [], signs: [], zones: [], slowZones: [], finale: null, goal: 39, length: 40, ...extra, ground,
  };
}
function run(sim, input, seconds) {
  const events = [];
  for (let i = 0; i < seconds * 120; i++) { step(sim, typeof input === 'function' ? input(sim, i) : input); for (const e of sim.events) events.push(e); sim.events.length = 0; }
  return events;
}
const RUN = { accel: true, jump: false }, IDLE = { accel: false, jump: false };

// ---------------------------------------------------------------- the level is well formed
{
  const L = prepareLevel(buildLevel());
  assert.ok(L.platforms.length > 15 && L.notes.length > 100, 'a real course');
  for (const p of L.platforms) assert.ok(p.b > p.a, 'platforms have length');
  for (const list of [L.notes, L.bells, L.enemies, L.hammers, L.bridges, L.springs]) {
    const ids = list.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  }
  assert.ok(L.goal < L.length && L.finale.board < L.goal);
  assert.equal(L.checkpoints.length, 6);
  // every hole can be jumped at some speed, with a range wide enough to hit
  const wide = L.gaps.filter((g) => g.dash), small = L.gaps.filter((g) => g.slow);
  assert.ok(wide.length >= 3, 'wide holes that need a dash');
  assert.ok(small.length >= 2, 'small footholds that need a slower jump');
  for (const g of L.gaps) {
    assert.ok(g.vmin <= RULES.MAX_SPEED - 1, `the hole at ${g.a} m can be jumped below top speed (needs ${g.vmin} m/s)`);
    assert.ok(g.vmax - g.vmin >= 1.2, `the hole at ${g.a} m: ${g.vmin}..${g.vmax} m/s is a range that can be hit`);
    if (!g.dash) assert.ok(g.vmin <= RULES.JUMP_MIN_SPEED, `the hole at ${g.a} m (${(g.b - g.a).toFixed(1)} m) can be hopped at a walk`);
  }
  for (const g of wide) {
    // the runway is one piece of ground, long enough for the run-up, and it starts at a checkpoint
    const runway = g.from.b - g.from.a;
    assert.ok(runway >= g.runup + 4, `the runway before ${g.a} m is ${runway.toFixed(1)} m; the run-up takes ${g.runup.toFixed(1)} m`);
    assert.ok(L.checkpoints.some((cp) => cp.s >= g.from.a && cp.s < g.a - g.runup - 2), `a checkpoint at the start of the runway before ${g.a} m`);
    for (const en of L.enemies) assert.ok(en.b < g.a - g.runup - 6 || en.a > g.b + 6 || Math.abs(en.h - g.h) > 2, `nothing in the way of the run-up before ${g.a} m`);
    // room to stop after it
    for (const hm of L.hammers) assert.ok(hm.a < g.a || hm.a - g.b >= 14, `the hammer at ${hm.a} m is far enough after the wide hole at ${g.a} m`);
  }
  // things that need a stop have room to stop in front of them, even from a dash
  const gates = [...L.hammers, ...L.bridges].sort((a, b) => a.a - b.a);
  for (let i = 1; i < gates.length; i++) assert.ok(gates[i].a - gates[i - 1].b >= 10, `room to stop between ${gates[i - 1].a} m and ${gates[i].a} m`);
  // creatures are far enough apart that a dash jump over one does not come down on the next
  const creatures = L.enemies.slice().sort((a, b) => a.a - b.a);
  for (let i = 1; i < creatures.length; i++) assert.ok(creatures[i].a - creatures[i - 1].b >= 9, `creatures at ${creatures[i - 1].b} m and ${creatures[i].a} m`);
  // slopes can be run up without a jump
  for (const p of L.platforms.filter((q) => q.stair)) {
    const before = L.platforms.find((q) => Math.abs(q.b - p.a) < 1e-9 && q.kind === 'ground');
    assert.ok(before && p.h - before.h <= RULES.STEP_UP, `the stair at ${p.a} m is low enough to run up`);
  }
}

// ---------------------------------------------------------------- clocks
{
  const en = { a: 10, b: 14, v: 2, phase: 0 };
  assert.equal(enemyS(en, 0), 10);
  assert.ok(Math.abs(enemyS(en, 1) - 12) < 1e-9);
  assert.ok(Math.abs(enemyS(en, 2) - 14) < 1e-9);
  assert.ok(Math.abs(enemyS(en, 3) - 12) < 1e-9, 'turns round at the end');
  for (let t = 0; t < 30; t += 0.07) { const s = enemyS(en, t); assert.ok(s >= 10 - 1e-9 && s <= 14 + 1e-9); }
  assert.equal(hammerState({ phase: 0 }, 1).state, 'up');
  assert.equal(hammerState({ phase: 0 }, 2.6).state, 'warn');
  assert.equal(hammerState({ phase: 0 }, 3.2).sole, 0, 'down on beat 6');
  assert.ok(RULES.HAMMER_UP > RULES.JUMP_V0 ** 2 / (2 * RULES.GRAVITY) + RULES.HEAD, 'a jump under a raised hammer does not touch it');
  assert.equal(hammerState({ phase: 0 }, 4 + 1).state, 'up', 'repeats every 8 beats');
  assert.equal(bridgeState({ phase: 0 }, 1).on, true);
  assert.equal(bridgeState({ phase: 0 }, 3).on, false);
  assert.equal(bridgeState({ phase: 2 }, 3).on, true, 'phase shifts the pattern');
}

// ---------------------------------------------------------------- running, dashing and stopping
{
  const long = tiny(); long.platforms = [long.ground(0, 200, 0)]; long.goal = 199; long.length = 200;
  const sim = createSim(long);
  run(sim, RUN, 0.5);
  assert.ok(sim.p.vs >= RULES.RUN_SPEED && sim.p.vs < RULES.RUN_SPEED + 1, 'a jog comes at once');
  assert.ok(sim.p.vs < RULES.DASH_SPEED, 'a dash does not');
  const events = run(sim, RUN, 1.3);
  assert.ok(sim.p.vs > 8 && sim.p.vs < RULES.OVER_SPEED, 'under two seconds of stamping: a dash');
  for (const e of run(sim, RUN, 2.2)) events.push(e);
  assert.ok(Math.abs(sim.p.vs - RULES.MAX_SPEED) < 1e-6, 'keep stamping and it goes on to a speed nobody can handle');
  assert.ok(RULES.MAX_SPEED > RULES.OVER_SPEED + 2);
  assert.equal(of(events, 'dash').length, 1, 'and says so once');
  assert.ok(Math.abs((sim.p.s - 1) - runUp(0, RULES.MAX_SPEED)) < 1.5 + RULES.MAX_SPEED * 0.6, 'runUp() is the distance it takes');
  // a short break in the stamping (a sensor's stamping flickers) costs almost nothing
  run(sim, IDLE, 0.15);
  assert.ok(sim.p.vs > RULES.MAX_SPEED - 0.3, 'coasting');
  run(sim, RUN, 0.3);
  const s0 = sim.p.s, v0 = sim.p.vs;
  run(sim, IDLE, 2.5);
  assert.equal(sim.p.vs, 0, 'stops when the feet stop');
  const stop = sim.p.s - s0;
  assert.ok(brakeDist(v0, 0) >= stop && brakeDist(v0, 0) - stop < 0.7, `brakeDist() is the distance it takes, rounded up (${stop.toFixed(1)} m, ${brakeDist(v0, 0).toFixed(1)} m)`);
  assert.ok(sim.p.s - s0 > 12 && sim.p.s - s0 < 16, 'stopping from top speed takes about 15 m');
  assert.ok(brakeDist(8, 0) > 5 && brakeDist(8, 0) < 7, 'and about 6 m from a dash that is under control');
  assert.ok(RULES.MAX_SPEED * 2 * RULES.JUMP_V0 / RULES.GRAVITY > 9.5, 'a jump at top speed flies nearly 10 m');
  // from a jog it is short
  const sim2 = createSim(tiny());
  run(sim2, RUN, 0.4);
  const s2 = sim2.p.s;
  run(sim2, IDLE, 2);
  assert.ok(sim2.p.s - s2 < 2.6, 'stopping from a jog takes about 2 m');
}

// ---------------------------------------------------------------- a jump keeps the speed it was taken at
{
  const dist = (v) => {
    const sim = createSim(tiny()); sim.p.vs = v; const s0 = sim.p.s;
    step(sim, { accel: false, jump: true });
    for (let i = 0; i < 300 && !sim.p.ground; i++) step(sim, IDLE);      // feet stopped in the air: makes no difference
    return sim.p.s - s0;
  };
  assert.ok(Math.abs(dist(9) - 9 * 2 * RULES.JUMP_V0 / RULES.GRAVITY) < 0.2, 'a dash jump is 6.9 m long');
  assert.ok(dist(9) > dist(6) + 2 && dist(6) > dist(4) + 1.2, 'the faster the run-up, the longer the jump');
  assert.ok(dist(2) > 2.2, 'a walking jump is a hop of at least 2.4 m');
}

// ---------------------------------------------------------------- a wide hole needs a run-up
{
  const L = tiny(); L.platforms = [L.ground(0, 22, 0), L.ground(27.2, 60, 0)]; L.goal = 59; L.length = 60;
  L.checkpoints = [{ s: 3, y: 0 }];
  const sim = createSim(L);
  const g = sim.level.gaps[0];
  assert.ok(g.dash && g.vmin >= 6.5 && g.vmin <= 7.25, `a 5.2 m hole needs about 7 m/s (${g.vmin})`);
  // the cue says DASH from the start of the runway, OK once fast enough; following it gets across
  assert.equal(advise(sim).pace.kind, 'dash');
  const kinds = new Set();
  const events = run(sim, (s) => { const a = advise(s); if (a.pace) kinds.add(a.pace.kind); return botInput(s, a); }, 8);
  assert.equal(of(events, 'fall').length, 0, 'a player who keeps stamping and jumps on the cue gets across');
  assert.ok(sim.p.s > 27.2 && kinds.has('ok'));
  // a player who only jogs falls in, comes back far enough from the edge to take the run-up again,
  // and gets a helper bridge after the second fall
  const sim2 = createSim(L);
  const ev2 = run(sim2, (s) => botInput(s, advise(s), { cruise: 4.5, dash: false }), 6);
  assert.equal(of(ev2, 'fall').length, 1);
  assert.ok(sim2.p.safeS <= 22 - g.runup - 1, `back to the start of the run-up (${sim2.p.safeS.toFixed(1)} m)`);
  const sim3 = createSim(L);
  sim3.p.s = 12;
  const ev3 = run(sim3, (s) => botInput(s, advise(s)), 6);
  assert.equal(of(ev3, 'fall').length, 0, 'from there the run-up is long enough');
  const ev4 = run(sim2, (s) => botInput(s, advise(s), { cruise: 4.5, dash: false }), 14);
  assert.equal(of(ev4, 'assist').length, 1, 'the second fall builds a helper bridge');
  assert.ok(sim2.p.s > 27.2, 'and the jogger walks across');
  assert.equal(advise(sim2).pace, null, 'no more DASH cue for a hole with a bridge over it');
}

// ---------------------------------------------------------------- pace cues in the air, and a hole nobody can jump
{
  const L = tiny(); L.platforms = [L.ground(0, 22, 0), L.ground(27.2, 60, 0)]; L.goal = 59; L.length = 60;
  const sim = createSim(L);
  sim.p.s = 19; sim.p.vs = 9;
  assert.equal(advise(sim).pace.kind, 'ok');
  step(sim, { accel: true, jump: true });
  run(sim, RUN, 0.1);
  assert.equal(sim.p.ground, false);
  assert.equal(advise(sim).pace, null, 'in the air over the hole: nothing more to ask');
  // too wide for any speed: a mistake in a course. No speed range, no frozen bot, no "Infinity m/s".
  const L2 = tiny(); L2.platforms = [L2.ground(0, 22, 0), L2.ground(31, 60, 1.5)];      // 9 m across and 1.5 m up L2.goal = 59; L2.length = 60;
  const sim2 = createSim(L2);
  const g = sim2.level.gaps[0];
  assert.equal(g.vmin, Infinity);
  assert.ok(!g.dash && !g.slow);
  assert.equal(advise(sim2).pace, null);
  run(sim2, (s) => botInput(s, advise(s)), 3);
  assert.ok(sim2.p.vs > 5 || sim2.p.falls > 0, 'the bot keeps running');
}

// ---------------------------------------------------------------- a small foothold needs a slower jump
{
  const L = tiny(); L.platforms = [L.ground(0, 30, 0), L.ground(31.8, 34.8, 0), L.ground(36.6, 70, 0)]; L.goal = 69; L.length = 70;
  const sim = createSim(L);
  const g = sim.level.gaps[0];
  assert.ok(g.slow && !g.dash && g.vmax >= 5 && g.vmax <= 6.5, `a 3 m foothold: no faster than about 6 m/s (${g.vmax})`);
  // flat out, the cue says SLOW in time, and easing off lands on the foothold
  const kinds = new Set();
  const events = run(sim, (s) => { const a = advise(s); if (a.pace && a.pace.kind) kinds.add(a.pace.kind); return botInput(s, a); }, 9);
  assert.ok(kinds.has('slow') && kinds.has('ok'));
  assert.equal(of(events, 'fall').length, 0, 'eases off and lands on it');
  assert.ok(sim.p.s > 36.6);
  // the course can also mark a stretch as slow
  const L2 = tiny(); L2.slowZones = [{ a: 20, b: 30, max: 5, h: 0 }];
  const sim2 = createSim(L2);
  let over = 0;
  run(sim2, (s) => { const inp = botInput(s, advise(s)); return inp; }, 2.2);
  for (let i = 0; i < 600 && sim2.p.s < 30; i++) { step(sim2, botInput(sim2, advise(sim2))); if (sim2.p.s > 20 && sim2.p.vs > 5.01) over++; }
  assert.equal(over, 0, 'the bot keeps to the speed of a slow stretch');
  assert.ok(sim2.p.s >= 30);
}

// ---------------------------------------------------------------- jumping
{
  const sim = createSim(tiny());
  let top = 0;
  const events = run(sim, (s, i) => { top = Math.max(top, s.p.y); return { accel: false, jump: i === 0 }; }, 1);
  assert.equal(of(events, 'jump').length, 1);
  assert.equal(of(events, 'land').length, 1);
  assert.ok(Math.abs(top - RULES.JUMP_V0 ** 2 / (2 * RULES.GRAVITY)) < 0.05, 'jump height');
  assert.equal(sim.p.s, 1, 'a standing jump without stamping goes straight up');
  // no second jump in the air
  const sim2 = createSim(tiny());
  const ev2 = run(sim2, (s, i) => ({ accel: true, jump: i === 0 || i === 30 }), 1);
  assert.equal(of(ev2, 'jump').length, 1);
}

// ---------------------------------------------------------------- a ledge: blocked on foot, reached with a jump
{
  const L = tiny(); L.platforms = [L.ground(0, 10, 0), L.ground(10, 40, 0.7)];
  const sim = createSim(L);
  run(sim, RUN, 3);
  assert.ok(sim.p.s < 10 && sim.p.y === 0, 'a 0.7 m wall stops a runner');
  assert.equal(advise(sim).jump, 'need', 'and the cue says jump');
  run(sim, (s, i) => ({ accel: true, jump: i === 0 }), 1.2);
  assert.ok(sim.p.s > 10 && Math.abs(sim.p.y - 0.7) < 1e-9, 'a standing jump with stamping gets onto it');
}

// ---------------------------------------------------------------- a ledge, jumped at from anywhere: never inside the block
{
  // Regression: a jump whose feet were just under the top when the body's front reached the face
  // used to slip into the block, walk "inside" it and fall out of the far end as if into a hole.
  const L = tiny(); L.platforms = [L.ground(0, 16, 0), L.ground(16, 22, 0.7), L.ground(22, 40, 0)];
  let runs = 0;
  for (const speed of [0, 1.2, 2, 3.5, 5, 7.5, 9]) for (let d = 0.31; d < 6; d += 0.05) for (const late of [0, 30, 58, 80]) {
    const sim = createSim(L);
    sim.p.s = 16 - d; sim.p.vs = speed; runs++;
    for (let i = 0; i < 360 && sim.p.s < 21; i++) {
      step(sim, { accel: i >= late, jump: i === 0 });
      const p = sim.p;
      assert.ok(!(p.s + RULES.RADIUS > 16 + 1e-6 && p.s < 22 && p.y < 0.7 - 1e-9 && p.ground), `speed ${speed}, ${d.toFixed(2)} m before the ledge, stamping from step ${late}: standing inside the block`);
      assert.equal(of(sim.events, 'fall').length, 0, `speed ${speed}, ${d.toFixed(2)} m before the ledge: fell where there is no hole`);
      sim.events.length = 0;
    }
  }
  assert.ok(runs > 2000);
}

// ---------------------------------------------------------------- the cue comes a moment early
{
  const L = tiny(); L.platforms = [L.ground(0, 20, 0), L.ground(22, 40, 0)];
  const sim = createSim(L);
  let soonAt = null, needAt = null;
  for (let i = 0; i < 600 && needAt == null; i++) {
    const a = advise(sim);
    if (a.soon && soonAt == null) soonAt = sim.t;
    if (a.jump === 'need') needAt = sim.t;
    else step(sim, RUN);
  }
  assert.ok(soonAt != null && needAt != null);
  assert.ok(needAt - soonAt > 0.2 && needAt - soonAt < 0.4, `"soon" leads "need" by about 0.3 s (${(needAt - soonAt).toFixed(2)} s)`);
  // nothing ahead: neither
  const flat = createSim(tiny());
  run(flat, RUN, 1);
  const a = advise(flat);
  assert.equal(a.soon, false); assert.equal(a.jump, null);
}

// ---------------------------------------------------------------- a hole: fall, lose a heart, come back before it
{
  const L = tiny(); L.platforms = [L.ground(0, 10, 0), L.ground(12, 40, 0)];
  const sim = createSim(L);
  const events = run(sim, RUN, 4);
  assert.equal(of(events, 'fall').length >= 1, true);
  assert.ok(sim.p.hearts < RULES.HEARTS);
  // jumping when the cue says so clears it
  const sim2 = createSim(L);
  let jumped = 0;
  const ev2 = run(sim2, (s) => { const j = advise(s).jump === 'need'; if (j) jumped++; return { accel: true, jump: j }; }, 4);
  assert.equal(of(ev2, 'fall').length, 0);
  assert.ok(jumped >= 1 && sim2.p.s > 12);
  // nobody is stuck for good: the second fall at the same hole builds a helper bridge over it
  const sim3 = createSim(L);
  const ev3 = run(sim3, RUN, 12);
  assert.equal(of(ev3, 'fall').length, 2);
  assert.equal(of(ev3, 'assist').length, 1);
  assert.equal(sim3.assists.length, 1);
  assert.ok(sim3.p.s > 12, 'and the runner walks across');
  assert.equal(sim3.p.hearts, RULES.HEARTS - 2);
  // a walking jump is a hop forward: even a slow walker clears a 2 m hole
  const sim4 = createSim(L);
  const ev4 = run(sim4, (s) => ({ accel: s.p.vs < 1.6, jump: advise(s).jump === 'need' }), 12);
  assert.equal(of(ev4, 'fall').length, 0, 'a 1.6 m/s walker gets over');
  assert.ok(sim4.p.s > 12);
}

// ---------------------------------------------------------------- out of hearts: back to the checkpoint
{
  // far enough apart that the moment of invulnerability after a hit has passed at the next one
  const L = tiny(); L.enemies = [8, 20, 32].map((s, i) => ({ id: `e${i}`, type: 'spike', a: s, b: s, v: 0, phase: 0, h: 0 }));
  L.checkpoints = [{ s: 4, y: 0 }];
  const sim = createSim(L);
  const events = run(sim, RUN, 14);
  assert.ok(of(events, 'checkpoint').length === 1);
  assert.ok(of(events, 'down').length >= 1, 'three hits and the hearts are gone');
  assert.ok(sim.p.downs >= 1);
  const down = events.findIndex((e) => e.type === 'down');
  assert.equal(of(events.slice(0, down), 'hurt').length, RULES.HEARTS);
}

// ---------------------------------------------------------------- creatures
{
  // run into a jelly: hurt and knocked back
  const L = tiny(); L.enemies = [{ id: 'e', type: 'jelly', a: 8, b: 8, v: 0, phase: 0, h: 0 }];
  const sim = createSim(L);
  const events = run(sim, RUN, 1.5);
  assert.equal(of(events, 'hurt').length, 1);
  assert.equal(sim.p.hearts, RULES.HEARTS - 1);
  // land on it: stomp, bounce, points
  const sim2 = createSim(L);
  const ev2 = run(sim2, (s) => ({ accel: true, jump: advise(s).jump != null }), 3);
  assert.equal(of(ev2, 'hurt').length, 0);
  assert.ok(sim2.p.s > 9, 'got past it');
  // a spike cannot be stomped: the bot never lands on it
  const L3 = tiny(); L3.enemies = [{ id: 'e', type: 'spike', a: 8, b: 8, v: 0, phase: 0, h: 0 }];
  const sim3 = createSim(L3);
  const ev3 = run(sim3, (s) => ({ accel: true, jump: advise(s).jump === 'need' }), 3);
  assert.equal(of(ev3, 'hurt').length, 0);
  assert.equal(of(ev3, 'stomp').length, 0);
  assert.ok(sim3.p.s > 9);
  // dropping onto a spike hurts
  const sim4 = createSim(L3);
  sim4.p.s = 8; sim4.p.y = 1.2; sim4.p.ground = false; sim4.p.vy = -2;
  const ev4 = run(sim4, IDLE, 0.5);
  assert.equal(of(ev4, 'hurt').length, 1);
}

// ---------------------------------------------------------------- stomp from a jump, with combo
{
  const L = tiny(); L.enemies = [{ id: 'e', type: 'jelly', a: 6, b: 6, v: 0, phase: 0, h: 0 }];
  const sim = createSim(L);
  sim.p.s = 6; sim.p.y = 1.2; sim.p.ground = false; sim.p.vy = -1;
  const events = run(sim, IDLE, 0.4);
  const stomp = of(events, 'stomp');
  assert.equal(stomp.length, 1);
  assert.equal(stomp[0].pts, 200);
  assert.ok(sim.p.vy > 0 || sim.p.y > 0.5, 'bounces');
}

// ---------------------------------------------------------------- notes, bells, fever
{
  const L = tiny();
  L.notes = [{ id: 'n1', s: 5, y: 1 }, { id: 'n2', s: 6, y: 1 }, { id: 'n3', s: 7, y: 4.5 }];
  L.bells = [{ id: 'b1', s: 12, y: 2.25, notes: 3, fever: true }];
  L.enemies = [{ id: 'e', type: 'spike', a: 18, b: 18, v: 0, phase: 0, h: 0 }];
  const sim = createSim(L);
  const events = run(sim, (s) => ({ accel: true, jump: advise(s).jump != null }), 4);
  assert.equal(of(events, 'note').length, 2, 'the note far overhead stays');
  assert.equal(of(events, 'bell').length, 1, 'the cue takes the player up to the bell');
  assert.equal(of(events, 'fever').length, 1);
  assert.equal(of(events, 'blast').length, 1, 'in fever even a spike is knocked away');
  assert.equal(of(events, 'hurt').length, 0);
  assert.equal(sim.p.notes, 5);
}

// ---------------------------------------------------------------- hammer: stop, wait, go
{
  const L = tiny(); L.hammers = [{ id: 'h', a: 12, b: 13.6, h: 0, phase: 0 }];
  // whenever the runner sets off, the gate cues get it through unhurt
  let stopped = 0, waved = 0;
  for (let offset = 0; offset < 4; offset += 0.25) {
    const sim = createSim(L);
    sim.t = offset;
    const seen = new Set(), memo = {};
    let flips = 0, last = null;
    const events = run(sim, (s) => { const a = advise(s, memo); if (a.gate) seen.add(a.gate); if (last === 'stop' && a.gate === 'go' && s.p.vs > 2) flips++; last = a.gate; return botInput(s, a); }, 12);
    assert.equal(flips, 0, `start at ${offset} s: STOP is not taken back while the runner is still moving`);
    assert.equal(of(events, 'bump').length, 0, `start at ${offset} s: never runs into the hammer`);
    assert.equal(of(events, 'hurt').length, 0, `start at ${offset} s: unhurt`);
    assert.ok(sim.p.s > 14 || sim.p.finished, `start at ${offset} s: through`);
    if (seen.has('stop') || seen.has('wait')) { stopped++; assert.ok(seen.has('go'), `start at ${offset} s: STOP is followed by GO`); }
    if (seen.has('go')) waved++;
  }
  assert.ok(stopped >= 3, `some starts have to stop for the hammer (${stopped})`);
  assert.ok(stopped <= 12, `and some run straight through (${16 - stopped})`);
  assert.ok(waved >= 12);
  // standing under it when it comes down hurts
  const sim2 = createSim(L);
  sim2.p.s = 12.8;
  const ev2 = run(sim2, IDLE, 3.2);
  assert.equal(of(ev2, 'hurt').length, 1);
  assert.ok(sim2.p.s < 12, 'and pushes the player out');
}

// ---------------------------------------------------------------- beat bridge
{
  const L = tiny(); L.platforms = [L.ground(0, 10, 0), L.ground(15, 40, 0)];
  L.bridges = [{ id: 'br', a: 10, b: 15, h: 0, thick: 0.3, belt: 0, safe: false, kind: 'bridge', phase: 0 }];
  for (const cruise of [Infinity, 4]) {
    const sim = createSim(L);
    sim.t = 2.2;   // arrive as it is about to go out
    const memo = {};
    const events = run(sim, (s) => botInput(s, advise(s, memo), { cruise }), 14);
    assert.equal(of(events, 'fall').length, 0, `cruise ${cruise}: waits for the bridge`);
    assert.ok(sim.p.s > 15 || sim.p.finished);
  }
}

// ---------------------------------------------------------------- drum
{
  const L = tiny(); L.springs = [{ id: 'sp', a: 6, b: 7.2, h: 0 }];
  L.platforms.push({ a: 10.4, b: 20, h: 4, thick: 0.4, belt: 0, safe: true, kind: 'float' });
  for (const cruise of [Infinity, 3]) {
    const sim = createSim(L);
    const events = run(sim, (s) => ({ accel: s.p.vs < cruise, jump: false }), 3);
    assert.equal(of(events, 'spring').length, 1);
    assert.ok(Math.abs(sim.p.y - 4) < 1e-9 || sim.p.s > 20, `cruise ${cruise}: the drum throws every player onto the upper road`);
  }
}

// ---------------------------------------------------------------- conveyor
{
  const L = tiny(); L.platforms = [L.ground(0, 5, 0), L.ground(5, 15, 0, { belt: -2, safe: false }), L.ground(15, 40, 0)];
  const sim = createSim(L);
  sim.p.s = 8;
  run(sim, IDLE, 1);
  assert.ok(sim.p.s < 6.5, 'standing still, the belt carries the player back');
  run(sim, RUN, 4);
  assert.ok(sim.p.s > 15, 'stamping beats it');
}

// ---------------------------------------------------------------- the whole course
// players who dash where the course asks for it: not a scratch
// (9 m/s is as fast as the course is built for. Faster than that is possible, and a gamble: see below.)
for (const [name, options] of [['fast (9 m/s)', { cruise: 9 }], ['fast (9 m/s), no bonus jumps', { cruise: 9, greedy: false }], ['steady 6 m/s, dashing for the wide holes', { cruise: 6 }], ['steady 5 m/s, dashing for the wide holes', { cruise: 5, greedy: false }]]) {
  const { sim, events } = play(options);
  const p = sim.p;
  assert.equal(p.finished, true, `${name}: reaches the goal (stopped at ${p.s.toFixed(1)} m)`);
  assert.equal(of(events, 'hurt').length, 0, `${name}: never hurt (${of(events, 'hurt').map((e) => `${e.kind}@${e.t.toFixed(1)}s`).join(', ')})`);
  assert.equal(of(events, 'fall').length, 0, `${name}: never falls`);
  assert.equal(of(events, 'checkpoint').length, 6);
  assert.equal(of(events, 'finale').length, 1, `${name}: lands the long jump`);
  assert.ok(p.finaleDist > 5, `${name}: long jump ${p.finaleDist.toFixed(2)} m`);
  assert.ok(p.time < 90, `${name}: ${p.time.toFixed(1)} s`);
  assert.ok(p.topSpeed >= 9 && p.dashSec > 8, `${name}: dashes`);
  console.log(`  ${name}: ${p.time.toFixed(1)} s, score ${p.score} (${gradeOf(sim.level, p.score)}), coins ${p.notes}/${sim.level.totals.notes}, stomps ${p.stomps}, blocks ${p.bells}/${sim.level.totals.bells}, dash ${p.dashSec.toFixed(1)} s, long jump ${p.finaleDist.toFixed(2)} m`);
}
// players who never dash: they fall into each wide hole twice, get a helper bridge, and still reach the goal
for (const [name, options] of [['a jog (4 m/s), never dashing', { cruise: 4, dash: false }], ['a walk (3 m/s), never dashing', { cruise: 3, dash: false }]]) {
  const { sim, events } = play(options);
  const p = sim.p, wide = sim.level.gaps.filter((g) => g.dash).length;
  assert.equal(p.finished, true, `${name}: reaches the goal (stopped at ${p.s.toFixed(1)} m)`);
  assert.equal(of(events, 'hurt').length, 0, `${name}: never hurt`);
  assert.equal(of(events, 'fall').length, wide * 2, `${name}: two falls at each wide hole, none anywhere else`);
  assert.equal(of(events, 'assist').length, wide, `${name}: a helper bridge over each wide hole`);
  assert.ok(p.time < 200, `${name}: ${p.time.toFixed(1)} s`);
  console.log(`  ${name}: ${p.time.toFixed(1)} s, score ${p.score} (${gradeOf(sim.level, p.score)}), falls ${p.falls}, helper bridges ${sim.assists.length}`);
}
{
  // the fast, greedy player is close to the best the course offers
  const { sim } = play({ cruise: 9 });
  assert.ok(['S', 'A'].includes(gradeOf(sim.level, sim.p.score)), `grade ${gradeOf(sim.level, sim.p.score)}`);
  assert.ok(sim.p.notes >= sim.level.totals.notes * 0.6);
  // someone who only stamps (never jumps) still gets somewhere but pays for it
  const sim2 = createSim(buildLevel());
  for (let i = 0; i < 60 * 120 && !sim2.p.finished; i++) { step(sim2, RUN); sim2.events.length = 0; }
  assert.equal(sim2.p.finished, false);
  assert.ok(sim2.p.s < 20, 'the first ledge needs a jump');
}

// ---------------------------------------------------------------- normal mode: a miss sends the runner back
{
  // run into the first creature: one heart gone, back at the start, the stage as it was
  const sim = createSim(buildLevel(), { mode: 'normal' });
  assert.equal(sim.cps.length, 1, 'one checkpoint, half way');
  assert.ok(sim.cps[0].s > sim.level.goal * 0.4 && sim.cps[0].s < sim.level.goal * 0.6);
  const events = [];
  for (let i = 0; i < 20 * 120 && !of(events, 'down').length; i++) {
    const a = advise(sim);
    step(sim, { accel: true, jump: a.jump === 'need' && sim.p.s < 24 });      // jumps the first ledge, then just runs
    for (const e of sim.events) events.push(e); sim.events.length = 0;
  }
  assert.equal(of(events, 'hurt').length, 1);
  assert.equal(of(events, 'down').length, 1, 'a hit sends the runner back at once');
  assert.equal(sim.p.hearts, RULES.HEARTS - 1);
  assert.ok(Math.abs(sim.p.s - sim.level.start.s) < 1e-9, 'to the start');
  assert.equal(sim.p.notes, 0, 'the coins are back on the road');
  assert.equal(sim.p.score, 0);
  assert.equal(sim.gone.size, 0);
  assert.equal(sim.p.over, false);
  // only running, never jumping past the first ledge: three misses and the game is over
  const sim2 = createSim(buildLevel(), { mode: 'normal' });
  const ev2 = [];
  for (let i = 0; i < 90 * 120 && !sim2.p.over; i++) {
    const a = advise(sim2);
    step(sim2, { accel: true, jump: a.jump === 'need' && sim2.p.s < 24 });
    for (const e of sim2.events) ev2.push(e); sim2.events.length = 0;
  }
  assert.equal(sim2.p.over, true);
  assert.equal(of(ev2, 'gameover').length, 1);
  assert.equal(of(ev2, 'hurt').length + of(ev2, 'fall').length, RULES.HEARTS);
  assert.equal(of(ev2, 'assist').length, 0, 'no helper bridges');
  const t = sim2.t, s = sim2.p.s;
  step(sim2, RUN);
  assert.ok(sim2.t === t && sim2.p.s === s, 'nothing moves after the game is over');
  assert.equal(advise(sim2).jump, null);
  // a fall is a miss too, and there is no second chance from the edge
  const L = tiny(); L.platforms = [L.ground(0, 10, 0), L.ground(12, 40, 0)];
  const sim3 = createSim(L, { mode: 'normal' });
  const ev3 = run(sim3, RUN, 3);
  assert.equal(of(ev3, 'fall').length, 1);
  assert.equal(of(ev3, 'down').length, 1);
  assert.ok(sim3.p.s < 9, 'back at the start, not at the edge');
  // past the checkpoint in the middle, a miss comes back to it, with what had been collected by then
  const L4 = tiny(); L4.platforms = [L4.ground(0, 60, 0)]; L4.goal = 59; L4.length = 60;
  L4.checkpoints = [{ s: 10, y: 0, mid: false }, { s: 20, y: 0, mid: true }];
  L4.notes = [{ id: 'n1', s: 5, y: 0.45 }, { id: 'n2', s: 25, y: 0.45 }];
  L4.enemies = [{ id: 'e', type: 'spike', a: 40, b: 40, v: 0, phase: 0, h: 0 }];
  const sim4 = createSim(L4, { mode: 'normal' });
  const ev4 = run(sim4, RUN, 6);
  assert.equal(of(ev4, 'checkpoint').length, 1, 'only the one in the middle counts');
  assert.equal(of(ev4, 'down').length >= 1, true);
  assert.ok(sim4.p.s >= 20, 'back to the middle');
  assert.ok(sim4.gone.has('n1') && sim4.p.notes >= 1, 'the coin from before the checkpoint is kept');
  // the players who know the course get through normal mode without a scratch, and fast
  for (const [name, options] of [['fast (9 m/s)', { cruise: 9 }], ['steady 6 m/s, dashing for the wide holes', { cruise: 6 }]]) {
    const sim5 = createSim(buildLevel(), { mode: 'normal' });
    const memo = {}, ev5 = [];
    let advice = advise(sim5, memo);
    for (let i = 0; i < 200 * 120 && !sim5.p.finished && !sim5.p.over; i++) {
      if (i % 2 === 0) advice = advise(sim5, memo);
      const input = botInput(sim5, advice, options);
      step(sim5, input);
      if (input.jump) advice = { ...advice, jump: null };
      for (const e of sim5.events) ev5.push(e); sim5.events.length = 0;
    }
    assert.equal(sim5.p.finished, true, `normal, ${name}: reaches the goal`);
    assert.equal(of(ev5, 'down').length, 0, `normal, ${name}: no miss`);
    assert.ok(sim5.p.time < 60, `normal, ${name}: under a minute (${sim5.p.time.toFixed(1)} s)`);
    assert.equal(sim5.p.hearts, RULES.HEARTS);
  }
  // the demo on the title screen (6.5 m/s) and ?autoplay=1 (9 m/s) get through normal mode too, however often they re-plan
  for (const cruise of [6.5, 9]) for (const every of [1, 2, 3, 4]) {
    const simD = createSim(buildLevel(), { mode: 'normal' });
    const memo = {};
    let advice = advise(simD, memo);
    for (let i = 0; i < 200 * 120 && !simD.p.finished && !simD.p.over; i++) {
      if (i % every === 0) advice = advise(simD, memo);
      const input = botInput(simD, advice, { cruise });
      step(simD, input);
      if (input.jump) advice = { ...advice, jump: null };
      simD.events.length = 0;
    }
    assert.ok(simD.p.finished && simD.p.downs === 0, `the ${cruise} m/s player, re-planning every ${every} steps: no miss`);
    assert.ok(simD.p.topSpeed < RULES.OVER_SPEED || simD.p.fever >= 0, 'stays under control');
  }
  // a player who never dashes does not get past the first wide hole
  const sim6 = createSim(buildLevel(), { mode: 'normal' });
  const memo6 = {};
  for (let i = 0; i < 300 * 120 && !sim6.p.finished && !sim6.p.over; i++) { step(sim6, botInput(sim6, advise(sim6, memo6), { cruise: 4, dash: false })); sim6.events.length = 0; }
  assert.equal(sim6.p.over, true, 'normal, never dashing: game over');
  assert.ok(sim6.p.falls === RULES.HEARTS && sim6.p.cp === -1);
}

// ---------------------------------------------------------------- advise() never changes the game
{
  const sim = createSim(buildLevel());
  for (let i = 0; i < 600; i++) step(sim, RUN);
  const before = JSON.stringify({ ...sim.p, on: null });
  const gone = sim.gone.size, t = sim.t;
  for (let i = 0; i < 50; i++) advise(sim);
  assert.equal(JSON.stringify({ ...sim.p, on: null }), before);
  assert.equal(sim.gone.size, gone);
  assert.equal(sim.t, t);
  assert.equal(sim.events.length > 0, true);
}

console.log('super-adventure-rules: ok');
