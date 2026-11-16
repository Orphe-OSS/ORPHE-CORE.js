const assert = require('node:assert/strict');
const path = require('node:path');
const { loadExampleModule } = require('./helpers/load-example-module');

// examples/GAME-SUPER-RELAY/relay.js: the rules of the one-sensor 4 x 100 m relay.
// A "team" below is a policy: given the race state, how hard is the sensor shaken (effort) and
// how much does it move while it changes hands (rough, in units of the calm limit).
const { RelayRace, RELAY_DEFAULTS, makeRivalTeam, roughness, isCalm, formatTime, gradePass } = loadExampleModule(path.join(__dirname, '../examples/GAME-SUPER-RELAY/relay.js'));

const H = 1 / 120;          // one step of hand (real) time
const SLOW = 0.3;           // the game plays the exchange at this speed
/** Run a race to the end. policy(race) -> { effort, rough, drop }. Returns { race, events }. */
function run(policy, options, slow = SLOW) {
  const race = new RelayRace(options);
  const events = [];
  for (let i = 0; i < 120 * 900 && !race.finished; i++) {
    const dt = H * (race.awaiting ? slow : 1);
    for (const e of race.step(dt, { ...policy(race), handDt: H })) events.push({ ...e, t: race.t });
  }
  return { race, events };
}
const of = (events, type) => events.filter((e) => e.type === type);
/** Shake flat out on the track; in the zone hold the baton with roughness `r`; shake again once it is passed. */
const team = (r = 0, effort = 1) => (race) => (race.awaiting ? { effort: 0, rough: r } : { effort, rough: 3 });
const flawless = team(0);

// ---------------------------------------------------------------- a flawless race
{
  const { race, events } = run(flawless);
  assert.equal(race.finished, true);
  assert.equal(race.dq, false);
  assert.equal(race.leg, 3, 'the anchor has the baton at the finish');
  assert.equal(of(events, 'pass').length, 3);
  assert.equal(of(events, 'zone-enter').length, 3);
  assert.equal(of(events, 'zone-exit').length, 3);
  assert.equal(of(events, 'zone-over').length, 0);
  assert.equal(race.passes.length, 3);
  assert.equal(race.splits.length, 4, 'a split at 100, 200, 300 and the finish');
  assert.ok(race.splits.every((t, i) => i === 0 || t > race.splits[i - 1]));
  assert.ok(Math.abs(race.splits[3] - race.time) < 1e-9, 'no penalty: the time is the last split');
  assert.ok(race.time > 36.84 && race.time < 38.5, `a flawless race is world class but does not beat the real record of 36.84 (${race.time.toFixed(2)} s)`);
  for (const p of of(events, 'pass')) {
    const z = race.zoneOf(p.k);
    assert.ok(p.s > z.start && p.s < z.end, `exchange ${p.k} inside the zone (${p.s.toFixed(1)} m)`);
    assert.ok(Math.abs(p.handSec - RELAY_DEFAULTS.passSec) < 0.05, 'still hands: the exchange takes passSec of real time');
    assert.ok(Math.abs(p.sec - RELAY_DEFAULTS.passSec * SLOW) < 0.05, 'and that much less of race time, because it is played in slow motion');
    assert.ok(p.keep > 0.8 && p.keep < 0.88, `still hands keep about 84 % of the baton speed (${p.keep.toFixed(2)})`);
  }
  for (const p of race.passes) {
    assert.equal(p.over, false);
    assert.equal(gradePass(p).grade, 'S');
    assert.ok(p.roughAvg < 1e-9);
  }
  console.log(`  flawless race ${race.time.toFixed(2)} s, baton speed kept ${race.passes.map((p) => Math.round(p.keep * 100)).join(' / ')} %`);
}

// ---------------------------------------------------------------- every movement costs
// rougher hands: less speed kept, a longer exchange, a slower race. Monotonic all the way.
{
  const runs = [0, 0.3, 0.6, 0.9].map((r) => run(team(r)).race);
  for (let i = 1; i < runs.length; i++) {
    assert.ok(runs[i].passes[0].keep < runs[i - 1].passes[0].keep - 0.03, `keep falls with roughness (${runs.map((x) => x.passes[0].keep.toFixed(2)).join(' > ')})`);
    assert.ok(runs[i].passes[0].handSec > runs[i - 1].passes[0].handSec + 0.1, 'the exchange takes longer');
    assert.ok(runs[i].time > runs[i - 1].time, 'the race is slower');
  }
  assert.deepEqual(runs.map((x) => gradePass(x.passes[0]).grade), ['S', 'A', 'B', 'C'], 'the grades spread over the range of hands');
  // a small twitch is not free: even well inside the limit it costs measurable speed
  assert.ok(runs[0].passes[0].keep - runs[1].passes[0].keep > 0.04);
}

// ---------------------------------------------------------------- past the limit
// the gauge runs backwards, the baton coasts down, and the zone runs out
{
  const party = run(team(1.6));
  assert.equal(of(party.events, 'pass').length, 0);
  assert.equal(of(party.events, 'zone-over').length, 3);
  assert.equal(party.race.dq, false);
  assert.equal(party.race.penalty, 3 * RELAY_DEFAULTS.penaltySec, 'party rule: a time penalty per missed exchange');
  assert.ok(Math.abs(party.race.time - (party.race.splits[3] + 9)) < 1e-9);
  assert.equal(party.race.leg, 3, 'the baton is forced on so the race can go on');
  assert.ok(party.race.passes.every((p) => p.over && p.keep == null && gradePass(p).grade === '×'));
  assert.ok(party.race.time > run(flawless).race.time + 9, 'never faster than passing properly');

  const strict = run(team(1.6), { rule: 'dq' });
  assert.equal(strict.race.dq, true);
  assert.equal(strict.race.finished, true);
  assert.equal(strict.race.time, null);
  assert.equal(of(strict.events, 'zone-over')[0].dq, true);
  assert.ok(strict.race.s < 111, 'disqualified at the end of the first zone');
  assert.equal(of(strict.events, 'finish').length, 0);
}
// a jolt in the middle of an exchange: the gauge drains and the exchange takes longer
{
  const jolt = run((race) => {
    if (!race.awaiting) return { effort: 1, rough: 3 };
    const h = race.zone.handSec;
    return { effort: 0, rough: h > 0.8 && h < 1.1 ? 1.8 : 0 };
  });
  const clean = run(flawless);
  assert.equal(of(jolt.events, 'pass').length, 3);
  assert.ok(jolt.race.passes[0].handSec > clean.race.passes[0].handSec + 0.5, `${jolt.race.passes[0].handSec.toFixed(2)} s vs ${clean.race.passes[0].handSec.toFixed(2)} s`);
  assert.ok(jolt.race.passes[0].fumbleSec > 0.25);
  assert.ok(jolt.race.passes[0].keep < clean.race.passes[0].keep - 0.05);
}

// ---------------------------------------------------------------- the first moments are forgiven
// nobody stops a shake instantly: roughness in the first 0.35 s of the exchange costs no extra speed
{
  const late = run((race) => {
    if (!race.awaiting) return { effort: 1, rough: 3 };
    return race.zone.handSec < 0.3 ? { effort: 1, rough: 3 } : { effort: 0, rough: 0 };
  });
  const clean = run(flawless);
  assert.ok(Math.abs(late.race.passes[0].handSec - (clean.race.passes[0].handSec + 0.3)) < 0.06, 'the gauge starts when the hand is still');
  assert.ok(late.race.passes[0].keep > clean.race.passes[0].keep - 0.05, `only the extra time costs (${late.race.passes[0].keep.toFixed(2)} vs ${clean.race.passes[0].keep.toFixed(2)})`);
  // but keeping it up after the grace does cost
  const later = run((race) => {
    if (!race.awaiting) return { effort: 1, rough: 3 };
    return race.zone.handSec < 0.9 ? { effort: 1, rough: 3 } : { effort: 0, rough: 0 };
  });
  assert.ok(later.race.passes[0].keep < clean.race.passes[0].keep - 0.25);
}

// ---------------------------------------------------------------- slow motion is the host's choice
// the hands always get real time; without slow motion the same exchange uses up more of the zone
{
  const slow = run(flawless).race, real = run(flawless, {}, 1).race;
  assert.ok(Math.abs(slow.passes[0].handSec - real.passes[0].handSec) < 0.02);
  assert.ok(real.passes[0].handAt > slow.passes[0].handAt + 6, `${real.passes[0].handAt.toFixed(1)} m vs ${slow.passes[0].handAt.toFixed(1)} m into the zone`);
  assert.ok(real.time > slow.time, 'and the next runner gets to drive the baton later');
  // handDt defaults to dt
  const a = new RelayRace(), b = new RelayRace();
  for (let i = 0; i < 2400; i++) { a.step(H, team(0.2)(a)); b.step(H, { ...team(0.2)(b), handDt: H }); }
  assert.ok(Math.abs(a.s - b.s) < 1e-9);
}

// ---------------------------------------------------------------- stopping too early
// going still 15 m before the zone: the runner coasts down, the gauge only starts in the zone
{
  const early = run((race) => {
    const z = race.nextZone;
    if (race.awaiting || (z && race.s > z.start - 15)) return { effort: 0, rough: 0 };
    return { effort: 1, rough: 3 };
  });
  const clean = run(flawless);
  assert.equal(of(early.events, 'pass').length, 3);
  assert.ok(early.race.passes[0].enterV < clean.race.passes[0].enterV - 2, 'slower into the zone');
  assert.ok(early.race.time > clean.race.time + 1);
  for (const p of of(early.events, 'pass')) assert.ok(p.s >= early.race.zoneOf(p.k).start, 'no exchange before the zone');
}

// ---------------------------------------------------------------- a dropped baton
{
  let dropped = false;
  const { race, events } = run((r) => {
    if (r.awaiting && r.zone.k === 1 && !dropped && r.gauge > 0.5) { dropped = true; return { effort: 0, rough: 3, drop: true }; }
    return flawless(r);
  });
  assert.equal(of(events, 'drop').length, 1);
  assert.equal(race.drops, 1);
  assert.equal(race.passes[1].dropped, true);
  assert.ok(race.passes[1].handSec > race.passes[0].handSec + 1.5, 'picking it up costs seconds');
  assert.ok(race.passes[1].keep < 0.3);
  assert.equal(gradePass(race.passes[1]).grade, 'D');
  assert.equal(race.dq, false);
}
// holding the drop signal does not re-trigger while the baton is being picked up
{
  const { events } = run((r) => (r.t > 3 && r.t < 3.5 ? { effort: 1, rough: 3, drop: true } : flawless(r)));
  assert.equal(of(events, 'drop').length, 1);
}

// ---------------------------------------------------------------- never stuck, never free
// a team that keeps shaking in the zone is carried out of it by the creep
{
  const { race } = run(team(3), {}, 1);
  assert.equal(race.finished, true);
  assert.equal(race.passes.length, 3);
}
// nobody shaking: the race clock runs but the baton does not move
{
  const race = new RelayRace();
  for (let i = 0; i < 600; i++) race.step(H, { effort: 0, rough: 0 });
  assert.equal(race.s, 0);
  assert.ok(race.t > 4.9);
}
// the older boolean input still works: calm = still, not calm = past the limit
{
  const calm = run((r) => (r.awaiting ? { effort: 0, calm: true } : { effort: 1, calm: false })).race;
  assert.ok(Math.abs(calm.time - run(flawless).race.time) < 1e-9);
  const never = run(() => ({ effort: 1, calm: false }), {}, 1).race;
  assert.equal(never.penalty, 9);
}

// ---------------------------------------------------------------- rivals
{
  for (const target of [38.5, 41, 45]) {
    const t = makeRivalTeam(target, 0.15);
    let guard = 0;
    while (!t.finished && guard++ < 120 * 100) t.step(H);
    assert.ok(Math.abs(t.time - target) < 0.05, `rival calibrated to ${target} s (${t.time.toFixed(2)})`);
    const after = t.s;
    for (let i = 0; i < 600; i++) t.step(H);
    assert.ok(t.s > after && t.v < 3, 'eases down after the line');
  }
  const t = makeRivalTeam(40, 0.2);
  for (let i = 0; i < 20; i++) t.step(0.009);
  assert.equal(t.s, 0, 'still on the blocks during the reaction time');
}

// ---------------------------------------------------------------- roughness of a sample
{
  const f = (gyro, lin) => ({ gyro, lin, rot: Math.hypot(...gyro), mag: Math.hypot(...lin) });
  assert.equal(roughness(f([0, 0, 0], [0, 0, 0])), 0);
  assert.equal(roughness(f([90, 0, 0], [0, 0, 0])), 1, 'one gyro axis at the limit is the limit');
  assert.equal(roughness(f([0, -45, 0], [0, 0, 0])), 0.5, 'sign does not matter');
  assert.equal(roughness(f([10, 0, 0], [0, 0, 0.4])), 2, 'the larger of gyro and acceleration decides');
  assert.equal(roughness(f([60, 60, 60], [0, 0, 0])), 60 / 90, 'the largest single axis, not the vector length');
  assert.equal(roughness(f([180, 0, 0], [0, 0, 0]), { calmAcc: 0.2, calmGyro: 180 }), 1, 'the limit is tunable');
  assert.equal(roughness(null), 0);
  assert.equal(roughness({ rot: 45, mag: 0.05 }), 0.5, 'falls back to the magnitudes when there are no axes');
  assert.equal(isCalm(f([50, 0, 0], [0.1, 0, 0])), true);
  assert.equal(isCalm(f([100, 0, 0], [0, 0, 0])), false);
  assert.equal(isCalm(null), false);
}
assert.equal(formatTime(38.419), '38.41');
assert.equal(formatTime(NaN), '--.--');

console.log('super-relay-rules.test.js passed');
