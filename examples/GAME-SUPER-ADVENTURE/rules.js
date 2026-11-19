// rules.js — the rules of SUPER VIRTUAL ADVENTURE.
//
// A side-scrolling platformer has two axes: along the course, and up. Here the
// course runs away from the player instead of across the screen, so the same two
// numbers describe everything: `s` (metres along the course) and `y` (metres up).
// There is no steering. The sensors give two inputs, exactly as in SUPER VIRTUAL
// HURDLE: stamping (accelerate) and toe-up (jump).
//
// This file has no DOM, no three.js and no imports, so the tests can run it in
// Node. Everything that changes over time on its own (patrolling creatures,
// hammers, beat bridges) is a pure function of the race clock `sim.t`; that is
// what makes `advise()` possible: it plays the next second forward on a copy of
// the player ("keep running" and "jump now") and reports which one ends well.
// The on-screen JUMP / STOP / GO cues, the jump assist for the sensors, the
// landing marker and the demo player all come from that one function.
//
// Speed is the third thing to play with. Stamping gets a runner to a jog at once
// and then builds up slowly to a dash; a jump keeps the speed it was taken at, so
// how far it carries is decided on the ground. Wide holes need a run-up, small
// footholds need a slower jump. prepareLevel() works out, for every hole, the
// range of take-off speeds that land well; advise() reports it as `pace`.

export const RULES = {
  DT: 1 / 120,          // fixed step
  HEAD: 1.75,           // body height (m)
  EYE: 1.62,
  RADIUS: 0.3,
  MAX_SPEED: 13,        // m/s. Keep stamping and the runner keeps getting faster, past what can be handled:
  OVER_SPEED: 10,       // above this a jump is 7.6 m or more and stopping takes 9 m or more. The course is built for less.
  RUN_SPEED: 4,         // a jog: reached almost at once
  DASH_SPEED: 7.5,      // from here on it is a dash (HUD, sound, speed lines)
  ACCEL: 12,            // up to RUN_SPEED
  DASH_ACCEL: 3,        // above it: 1.2 s of steady stamping from a jog to a dash, 3 s to top speed
  COAST_SEC: 0.22,      // a short break in the stamping only coasts (stamping flickers on a sensor) ...
  COAST_DECEL: 1.2,
  FRICTION: 7,          // ... after that the runner brakes: stopping takes 6 m from 8 m/s, 15 m from top speed
  AIR_MIN_SPEED: 3.2,   // stamping in the air only helps up to this (a standing jump can still reach a ledge)
  JUMP_MIN_SPEED: 3.2,  // a jump taken while moving carries at least this much speed: 2.4 m, enough for every hole
  AIR_ACCEL: 8,
  JUMP_V0: 8.4,         // 0.76 s in the air, 1.6 m high: enough for a slow runner to clear a spike
  GRAVITY: 22,
  COYOTE: 0.12,         // s after running off an edge in which a jump still counts (1 m at a dash)
  JUMP_BUFFER: 0.12,    // s a jump pressed just before landing is remembered
  STEP_UP: 0.3,         // a rise this small is walked up
  STEP_DOWN: 0.35,      // a drop this small is walked down
  LEDGE_GRAB: 0.14,     // in the air, this close under a ledge still gets on top
  EDGE: 0.12,           // feet may overhang an edge by this much
  STOMP_MIN: 0.1,       // coming down with the feet this far above a creature's base counts as a stomp (generous: first person)
  STOMP_BOUNCE: 8.6,
  SPRING_VY: 15.5,
  SPRING_VS: 6,
  HEARTS: 3,
  INVULN: 1.6,
  KNOCKBACK: 4.5,
  KB_DECAY: 14,
  FEVER_SEC: 9,
  FEVER_SPEED: 1.25,
  NOTE_R: 0.65,
  PIT_DEPTH: 7,
  BEAT: 0.5,            // 120 BPM: hammers and beat bridges keep this time
  HAMMER_UP: 3.8,       // m the hammer hangs above the floor (clear of a jumping head)
  PAR_TIME: 150,        // s: every second under it is worth TIME_POINTS
  TIME_POINTS: 60,
  FALL_COST: 300,
};

// The look-ahead plays by slightly harsher rules than the game: narrower edges, fatter creatures,
// a higher bar for a stomp. A cue is then only given with room to spare, so being a frame or two
// late on a cue (or a sensor sample late) still works.
const CAUTIOUS = { EDGE: 0.02, FAT: 0.1, STOMP_MIN: 0.34, LEDGE_GRAB: 0 };
/** How far under a ledge a jump is still caught. The look-ahead does not count on being caught at all. */
const grabOf = (sim) => (sim.dry ? CAUTIOUS.LEDGE_GRAB : RULES.LEDGE_GRAB);

const ENEMY = {
  jelly: { r: 0.45, height: 0.75, stomp: true },
  dasher: { r: 0.45, height: 0.75, stomp: true },      // the same size, but it runs
  spike: { r: 0.3, height: 0.6, stomp: false },
};

// ---------------------------------------------------------------- things that move on the clock
/** Position of a patrolling creature: back and forth between a and b at v m/s. */
export function enemyS(en, t) {
  const len = en.b - en.a;
  if (!(len > 0) || !en.v) return en.a;
  let u = (t * en.v + (en.phase || 0)) % (2 * len);
  if (u < 0) u += 2 * len;
  return en.a + (u < len ? u : 2 * len - u);
}

/** A hammer strikes once every 8 beats. sole = height of its face above the floor. */
export function hammerState(hm, t) {
  const P = 8 * RULES.BEAT;
  let u = (t + (hm.phase || 0)) % P;
  if (u < 0) u += P;
  const UP = RULES.HAMMER_UP;
  if (u < 2.4) return { state: 'up', sole: UP, u };
  if (u < 2.85) return { state: 'warn', sole: UP, u };
  if (u < 3.0) { const k = (u - 2.85) / 0.15; return { state: 'slam', sole: UP * (1 - k * k), u }; }
  if (u < 3.5) return { state: 'down', sole: 0, u };
  const k = (u - 3.5) / 0.5;
  return { state: 'rise', sole: UP * k * k * (3 - 2 * k), u };
}

/** A beat bridge is solid for 5 beats out of 8. warn = about to go out. */
export function bridgeState(br, t) {
  const P = 8 * RULES.BEAT, ON = 5 * RULES.BEAT;
  let u = (t + (br.phase || 0)) % P;
  if (u < 0) u += P;
  return { on: u < ON, warn: u < ON && u > ON - 0.75, u, left: u < ON ? ON - u : 0, until: u < ON ? 0 : P - u };
}

const HELP_AFTER_FALLS = 2;
/** Is this beat bridge solid now? (One that was fallen through twice stays lit.) */
export function bridgeLit(sim, br) {
  if (sim.still) return false;
  return sim.steady.has(br.id) || bridgeState(br, sim.t).on;
}

// ---------------------------------------------------------------- level index
function makeIndex(items, lo, hi, pad, cell = 4) {
  const cells = new Map();
  const EMPTY = [];
  for (const it of items) {
    for (let c = Math.floor((lo(it) - pad) / cell); c <= Math.floor((hi(it) + pad) / cell); c++) {
      if (!cells.has(c)) cells.set(c, []);
      cells.get(c).push(it);
    }
  }
  return { at: (s) => cells.get(Math.floor(s / cell)) || EMPTY };
}

/** Sort the level and build the lookups the rules use. Safe to call twice. */
export function prepareLevel(level) {
  if (level.ix) return level;
  const span = (list) => makeIndex(list, (o) => o.a, (o) => o.b, 1.6);
  const point = (list) => makeIndex(list, (o) => o.s, (o) => o.s, 1.6);
  level.gates = [...level.hammers, ...level.bridges].sort((x, y) => x.a - y.a);
  level.ix = {
    plat: span(level.platforms), bridge: span(level.bridges), enemy: span(level.enemies),
    hammer: span(level.hammers), spring: span(level.springs), note: point(level.notes), bell: point(level.bells),
  };
  const stompable = level.enemies.filter((e) => ENEMY[e.type].stomp).length;
  const bellNotes = level.bells.reduce((n, b) => n + (b.notes || 0), 0);
  level.totals = { notes: level.notes.length + bellNotes, bells: level.bells.length, enemies: level.enemies.length, stompable };
  level.refScore = level.totals.notes * 100 + level.totals.bells * 300 + stompable * 250 + 5000 + 2250 + RULES.HEARTS * 300 + 2000;
  level.gaps = findGaps(level);
  return level;
}

// ---------------------------------------------------------------- speed: run-up, braking, and what each hole asks for
/** Metres of steady stamping it takes to get from speed v0 to v1. */
export function runUp(v0, v1) {
  const R = RULES, lo = Math.min(v1, R.RUN_SPEED);
  let d = 0;
  if (v0 < lo) { d += (lo * lo - v0 * v0) / (2 * R.ACCEL); v0 = lo; }
  if (v1 > v0) d += (v1 * v1 - v0 * v0) / (2 * R.DASH_ACCEL);
  return d;
}
/** Metres it takes to slow from v0 to v1 once the feet stop (the coast, then the brake). coasted: seconds the feet have been still already. */
export function brakeDist(v0, v1, coasted = 0) {
  if (v0 <= v1) return 0;
  return v0 * Math.max(0, RULES.COAST_SEC - coasted) + (v0 * v0 - v1 * v1) / (2 * RULES.FRICTION);
}

const PACE_STEP = 0.25;
/**
 * Every hole in the road, with the take-off speeds that land well on the far side:
 *   vmin  slower than this and the jump falls short;
 *   vmax  faster than this and a jump from the edge flies past the landing (a small foothold),
 *         or lands on something that hurts.
 * Found by playing each jump with the real rules (the cautious look-ahead version of them),
 * so it stays true when the numbers in RULES change. Things that move on the clock are left out.
 */
function findGaps(level) {
  const R = RULES;
  const solid = level.platforms.filter((p) => p.kind === 'ground' || p.kind === 'float');
  const gaps = [];
  for (const from of solid) {
    const s = from.b + 0.3;
    if (from.b >= level.length - 0.5) continue;
    // something to walk onto, drop onto or bump into right after the end: not a hole
    if (solid.some((q) => q !== from && s >= q.a && s <= q.b && q.h - q.thick <= from.h + R.STEP_UP)) continue;
    if (level.bridges.some((br) => Math.abs(br.a - from.b) < 0.1)) continue;      // a beat bridge: a matter of timing, not of speed
    let to = null;
    for (const q of solid) if (q.a > from.b + 0.05 && q.h <= from.h + 1.5 && q.h > from.h - 6 && (!to || q.a < to.a)) to = q;
    if (!to || to.a - from.b > 12 || to.finale) continue;                          // the long jump at the end has no "too fast"
    gaps.push({ a: from.b, b: to.a, h: from.h, from, to, vmin: 0, vmax: 0, dash: false, slow: false, runup: 0 });
  }
  gaps.sort((x, y) => x.a - y.a);
  const top = R.MAX_SPEED * R.FEVER_SPEED;
  for (const g of gaps) {
    let vmin = null, vmax = null;
    for (let v = 2.5; v <= top + 1e-9; v += PACE_STEP) {
      const ok = edgeJumpLands(level, g, v);
      if (ok) { if (vmin == null) vmin = v; vmax = v; } else if (vmin != null) break;
    }
    g.vmin = vmin == null ? Infinity : vmin;
    g.vmax = vmax == null ? 0 : vmax;
    g.from.gap = g;
  }
  for (const g of gaps) {
    // a foothold with another hole right behind it: allow at least 0.42 s on it to take the next jump
    const len = g.to.b - g.to.a;
    if (g.to.gap) g.vmax = Math.min(g.vmax, Math.floor(len / 0.42 / PACE_STEP) * PACE_STEP);
    // (a hole no speed can jump has vmin = Infinity: a mistake in the course, which the tests catch.
    //  It gets no speed range, so the cues and the bot treat it as a plain hole instead of freezing.)
    const possible = Number.isFinite(g.vmin);
    g.dash = possible && g.vmin > R.RUN_SPEED + 0.6;
    g.slow = possible && g.vmax < R.MAX_SPEED - 0.4;
    g.runup = runUp(0, Math.min(R.MAX_SPEED, g.vmin + 0.5));
  }
  return gaps;
}
/** Take off from the very edge of a hole at speed v: does the jump come down on the far side, on its feet? */
function edgeJumpLands(level, g, v) {
  const sim = {
    level, t: 0, gone: new Set(), local: new Set(), dry: true, still: true, events: null, harm: null, bonus: 0, jumps0: 0,
    p: newPlayer(level), assists: [], steady: new Set(), pitFalls: new Map(),
  };
  const p = sim.p;
  p.s = g.a - 0.03; p.y = g.h; p.vs = v; p.on = g.from; p.airFromY = g.h; p.edgeS = p.s;
  step(sim, { hold: true, accel: true, jump: true });
  for (let i = 0; i < 300 && !sim.harm && !p.ground; i++) step(sim, HOLD);
  if (sim.harm || !p.ground || p.on !== g.to) return false;
  for (let i = 0; i < AFTER_STEPS && !sim.harm; i++) step(sim, HOLD);
  return !sim.harm || sim.harm.kind === 'pit' || sim.harm.kind === 'wall';
}

// ---------------------------------------------------------------- simulation state
function newPlayer(level) {
  const st = level.start;
  return {
    s: st.s, y: st.y, vs: 0, vy: 0, kb: 0, ground: true, on: null, coyote: 0, jumpBuf: 0, airFromY: st.y, edgeS: st.s,
    spring: false, hearts: RULES.HEARTS, invuln: 0, fever: 0, combo: 0, safeS: st.s, safeY: st.y, cp: -1, coast: 9, dashing: false,
    finished: false, over: false, doomed: false, time: 0, bumpT: -9,
    notes: 0, bells: 0, stomps: 0, blasts: 0, bestCombo: 0, hurts: 0, falls: 0, downs: 0, jumps: 0, score: 0, topSpeed: 0, dashSec: 0,
    takeoffS: null, finaleDist: null, bonus: null,
  };
}

/**
 * options.mode:
 *   'normal'  every miss (a creature, a hammer, a fall) costs a heart and sends the runner back to the
 *             start, or to the one checkpoint in the middle of the course once it has been passed, with
 *             the stage as it was then (creatures, blocks and coins are back). No hearts left: game over.
 *             No helper bridges. A beginner is back at the start within seconds; someone who knows the
 *             course is through it in under a minute.
 *   'easy'    (default) a miss costs a heart and the run goes on from where it happened; the hearts
 *             refill at the last checkpoint when they run out; there is a checkpoint at every zone and
 *             runway; the second fall into a hole builds a helper bridge. Nobody is stuck.
 */
export function createSim(level, options = {}) {
  prepareLevel(level);
  const mode = options.mode === 'normal' ? 'normal' : 'easy';
  const sim = {
    level, mode, t: 0, gone: new Set(), local: null, dry: false, events: [], harm: null, bonus: 0, p: newPlayer(level),
    cps: mode === 'normal' ? level.checkpoints.filter((cp) => cp.mid) : level.checkpoints,
    assists: [], steady: new Set(), pitFalls: new Map(),      // help for players who keep falling at one place (easy mode)
    snap: null,
  };
  sim.snap = snapshot(sim);
  return sim;
}
/** What a miss in normal mode goes back to: the stage and the tally as they were at the last checkpoint. */
const TALLY = ['notes', 'bells', 'stomps', 'blasts', 'bestCombo', 'score'];
function snapshot(sim) {
  const tally = {};
  for (const k of TALLY) tally[k] = sim.p[k];
  return { gone: new Set(sim.gone), tally };
}

const BONUS = { note: 1, bell: 3, stomp: 2, blast: 1 };
function emit(sim, type, data) {
  if (sim.dry) { if (BONUS[type]) sim.bonus += BONUS[type]; return; }
  sim.events.push(data ? { type, t: sim.t, ...data } : { type, t: sim.t });
}
const isGone = (sim, id) => sim.gone.has(id) || (sim.dry && sim.local.has(id));
const take = (sim, id) => { (sim.dry ? sim.local : sim.gone).add(id); };

// ---------------------------------------------------------------- ground
const scratch = [];
/** Everything that can be stood on at s right now (platforms, and beat bridges while they are lit). */
function surfaces(sim, s) {
  scratch.length = 0;
  const E = sim.dry ? CAUTIOUS.EDGE : RULES.EDGE, ix = sim.level.ix;
  for (const pl of ix.plat.at(s)) if (s >= pl.a - E && s <= pl.b + E) scratch.push(pl);
  for (const br of ix.bridge.at(s)) if (s >= br.a - E && s <= br.b + E && bridgeLit(sim, br)) scratch.push(br);
  for (const pl of sim.assists) if (s >= pl.a - E && s <= pl.b + E) scratch.push(pl);
  return scratch;
}
/** Highest surface at s whose top is no higher than y + tol; null over a pit. */
function supportBelow(sim, s, y, tol) {
  let best = null;
  for (const pl of surfaces(sim, s)) if (pl.h <= y + tol && (!best || pl.h > best.h)) best = pl;
  return best;
}

function blocks(sim, p, pl) {
  const tol = p.ground ? RULES.STEP_UP : grabOf(sim);
  return p.y < pl.h - tol && p.y + RULES.HEAD > pl.h - pl.thick;
}
/** Stop at the face of anything solid between the old and the new position. */
function collideWalls(sim, p, ns) {
  const R = RULES.RADIUS, ix = sim.level.ix;
  let hit = false;
  if (ns > p.s) {
    const front = ns + R;
    const test = (pl) => { if (pl.a >= p.s + R - 1e-9 && pl.a < ns + R && blocks(sim, p, pl)) { ns = pl.a - R; hit = true; } };
    for (const pl of ix.plat.at(front)) test(pl);
    for (const br of ix.bridge.at(front)) if (bridgeLit(sim, br)) test(br);
    if (hit) {
      p.vs = 0;
      if (sim.dry) { if (p.ground && !sim.harm) sim.harm = { kind: 'wall', s: ns }; }
      else if (sim.t - p.bumpT > 0.5) { p.bumpT = sim.t; emit(sim, 'bump'); }
    }
  } else if (ns < p.s) {
    const back = ns - R;
    for (const pl of ix.plat.at(back)) if (pl.b <= p.s - R + 1e-9 && pl.b > ns - R && blocks(sim, p, pl)) { ns = pl.b + R; hit = true; }
    if (hit) p.kb = 0;
  }
  return ns;
}

// ---------------------------------------------------------------- damage and respawn
function place(p, s, y) {
  p.doomed = false;
  p.s = s; p.y = y; p.vs = 0; p.vy = 0; p.kb = 0; p.ground = true; p.on = null;
  p.spring = false; p.combo = 0; p.coyote = 0; p.jumpBuf = 0; p.airFromY = y;
}
function down(sim) {
  const p = sim.p, L = sim.level;
  p.downs++; p.fever = 0; p.dashing = false;
  if (sim.mode === 'normal') {
    if (p.hearts <= 0) { p.over = true; emit(sim, 'gameover'); return; }
    sim.gone = new Set(sim.snap.gone);
    Object.assign(p, sim.snap.tally);
    p.finaleDist = null; p.takeoffS = null;
  } else {
    p.hearts = RULES.HEARTS;
    p.score = Math.max(0, p.score - 500);
  }
  const cp = p.cp >= 0 ? sim.cps[p.cp] : L.start;
  place(p, cp.s, cp.y);
  p.safeS = cp.s; p.safeY = cp.y;
  p.invuln = 2.2;
  emit(sim, 'down', { cp: p.cp, hearts: p.hearts });
}
/** Returns true when the step should stop (dry run, or the player was moved). */
function hurt(sim, kind) {
  const p = sim.p;
  if (sim.dry) { if (!sim.harm || sim.harm.kind === 'wall') sim.harm = { kind, s: p.s }; return true; }
  p.hearts--; p.hurts++; p.combo = 0;
  emit(sim, 'hurt', { kind, hearts: p.hearts });
  if (p.hearts <= 0 || sim.mode === 'normal') { down(sim); return true; }
  p.invuln = RULES.INVULN; p.vs = 0; p.kb = -RULES.KNOCKBACK;
  return false;
}
/**
 * Nobody should be stuck at one hole for good (a first-time player, a child, someone who cannot
 * stamp fast). The second fall from the same place builds a helper bridge over that hole; a beat
 * bridge that was fallen through twice stays lit.
 */
function helpAfterFall(sim, from) {
  if (!from) return;
  const key = from.kind === 'bridge' ? from.id : `pit${from.b}`;
  const count = (sim.pitFalls.get(key) || 0) + 1;
  sim.pitFalls.set(key, count);
  if (count !== HELP_AFTER_FALLS) return;
  const L = sim.level;
  if (from.kind === 'bridge') { sim.steady.add(from.id); emit(sim, 'assist', { bridge: from.id }); return; }
  const beat = L.bridges.find((br) => Math.abs(br.a - from.b) < 0.05 && !sim.steady.has(br.id));
  if (beat) { sim.steady.add(beat.id); emit(sim, 'assist', { bridge: beat.id }); return; }
  let next = null;
  for (const pl of L.platforms) if (pl.kind === 'ground' && pl.a > from.b + 0.05 && (!next || pl.a < next.a)) next = pl;
  if (!next || next.a - from.b > 12) return;
  const helper = { a: from.b - 0.05, b: next.a + 0.05, h: Math.min(from.h, next.h), thick: 0.25, belt: 0, safe: false, kind: 'assist' };
  sim.assists.push(helper);
  emit(sim, 'assist', { a: helper.a, b: helper.b, h: helper.h });
}
function fall(sim) {
  const p = sim.p;
  p.falls++; p.hearts--;
  emit(sim, 'fall', { hearts: p.hearts });
  if (sim.mode === 'normal') { down(sim); return; }
  p.score = Math.max(0, p.score - RULES.FALL_COST);
  helpAfterFall(sim, p.lastOn);
  if (p.hearts <= 0) { down(sim); return; }
  place(p, p.safeS, p.safeY);
  p.invuln = RULES.INVULN;
}

function land(sim, p, pl) {
  const impact = -p.vy;
  p.y = pl.h; p.vy = 0; p.ground = true; p.on = pl; p.spring = false; p.combo = 0; p.doomed = false;
  emit(sim, 'land', { impact });
  const F = sim.level.finale;
  if (pl.finale && F && p.finaleDist == null) {
    p.finaleDist = Math.max(0, p.s - F.board);
    const pts = Math.round(p.finaleDist * 300);
    p.score += pts;
    emit(sim, 'finale', { dist: p.finaleDist, toBoard: p.takeoffS != null ? F.board - p.takeoffS : null, pts });
  }
}

function finish(sim) {
  const p = sim.p;
  p.finished = true;
  const time = Math.max(0, Math.round((RULES.PAR_TIME - sim.t) * RULES.TIME_POINTS));
  const hearts = p.hearts * 300;
  const clean = p.hurts === 0 && p.falls === 0 ? 2000 : 0;
  p.bonus = { time, hearts, clean };
  p.score += time + hearts + clean;
  emit(sim, 'goal', { time: sim.t, score: p.score });
}

/** S..D from the score against what a clean, complete run is worth on this level. */
export function gradeOf(level, score) {
  const k = score / prepareLevel(level).refScore;
  return k >= 0.85 ? 'S' : k >= 0.7 ? 'A' : k >= 0.5 ? 'B' : k >= 0.3 ? 'C' : 'D';
}

// ---------------------------------------------------------------- one step
/** Advance the simulation by RULES.DT. input = { accel: boolean, jump: boolean (true on the step it is asked for) }. */
export function step(sim, input) {
  const R = RULES, dt = R.DT, p = sim.p, L = sim.level, ix = L.ix;
  if (p.finished || p.over) return;
  sim.t += dt; p.time = sim.t;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.fever > 0) { p.fever -= dt; if (p.fever <= 0) { p.fever = 0; emit(sim, 'feverEnd'); } }

  // ---- input
  if (input.jump) p.jumpBuf = R.JUMP_BUFFER; else if (p.jumpBuf > 0) p.jumpBuf -= dt;
  // input.hold (look-ahead only): a steady runner, neither speeding up nor slowing down.
  // input.cap (look-ahead only): accelerate, but no faster than this.
  const cap = Math.min(R.MAX_SPEED * (p.fever > 0 ? R.FEVER_SPEED : 1), input.cap || Infinity);
  if (p.ground) {
    if (input.hold && p.vs <= cap) { /* keep the speed */ }
    else if (input.accel && p.kb > -0.5 && p.vs <= cap) {
      // a jog comes at once; a dash has to be built up (in fever everything comes at once)
      p.coast = 0;
      p.vs = Math.min(cap, p.vs + (p.vs < R.RUN_SPEED || p.fever > 0 ? R.ACCEL : R.DASH_ACCEL) * dt);
    } else {
      // feet stopped: coast for a moment, then brake. (Faster than allowed, e.g. fever just ended: brake at once.)
      if (!input.accel) p.coast += dt;
      p.vs = Math.max(0, p.vs - (!input.accel && p.coast < R.COAST_SEC ? R.COAST_DECEL : R.FRICTION) * dt);
    }
    if (!sim.dry) {
      if (p.vs > p.topSpeed) p.topSpeed = p.vs;
      const dashing = p.vs >= (p.dashing ? R.DASH_SPEED - 0.6 : R.DASH_SPEED);
      if (dashing) p.dashSec += dt;
      if (dashing !== p.dashing) { p.dashing = dashing; emit(sim, dashing ? 'dash' : 'dashEnd'); }
    }
  } else {
    // in the air the speed of the take-off is kept; stamping only helps a standing jump reach a ledge.
    // Feet that stop in the air have done their coasting by the time they land: the brake starts at once.
    if (!input.accel && !input.hold) p.coast += dt; else if (input.accel && !input.hold) p.coast = 0;
    if (!p.spring && input.accel && p.vs < R.AIR_MIN_SPEED) p.vs = Math.min(R.AIR_MIN_SPEED, p.vs + R.AIR_ACCEL * dt);
  }
  if (p.jumpBuf > 0 && (p.ground || p.coyote > 0)) {
    if (p.ground) p.airFromY = p.y;
    p.vy = R.JUMP_V0; p.ground = false; p.coyote = 0; p.jumpBuf = 0; p.spring = false; p.jumps++;
    if (p.vs > 1) p.vs = Math.max(p.vs, R.JUMP_MIN_SPEED);     // a walking jump is a hop forward: every hole can be crossed
    if (L.finale && p.s > L.finale.board - 6 && p.s <= L.finale.board + 0.6) p.takeoffS = Math.min(p.s, L.finale.board);
    emit(sim, 'jump');
  }

  // ---- along the course
  const belt = p.ground && p.on && p.on.belt ? p.on.belt : 0;
  const ds = (p.vs + belt + p.kb) * dt;
  if (p.kb < 0) p.kb = Math.min(0, p.kb + R.KB_DECAY * dt);
  let ns = collideWalls(sim, p, p.s + ds);
  if (ns < p.s && p.ground && !supportBelow(sim, ns, p.y, R.STEP_UP)) ns = p.s;   // never pushed backwards into a pit
  p.s = Math.max(L.start.s - 1, ns);

  // ---- up and down
  if (p.ground) {
    const sup = supportBelow(sim, p.s, p.y, R.STEP_UP);
    if (sup && sup.h >= p.y - R.STEP_DOWN) { p.y = sup.h; p.on = sup; p.lastOn = sup; }
    else { p.ground = false; p.on = null; p.coyote = R.COYOTE; p.vy = 0; p.airFromY = p.y; p.edgeS = p.s; }
  }
  if (!p.ground) {
    if (p.coyote > 0) p.coyote -= dt;
    const prevY = p.y;
    p.vy -= R.GRAVITY * dt;
    p.y += p.vy * dt;
    const here = surfaces(sim, p.s);
    if (p.vy > 0) {
      for (const pl of here) {
        const bottom = pl.h - pl.thick;
        if (prevY + R.HEAD <= bottom + 1e-6 && p.y + R.HEAD > bottom) { p.y = bottom - R.HEAD; p.vy = 0; emit(sim, 'bonk'); }
      }
    } else {
      let best = null;
      for (const pl of here) {
        const through = pl.h <= prevY + 1e-6 && pl.h >= p.y;
        const grab = pl.h > p.y && pl.h - p.y <= grabOf(sim) && pl.h <= prevY + grabOf(sim);
        if ((through || grab) && (!best || pl.h > best.h)) best = pl;
      }
      if (best) land(sim, p, best);
    }
    // Never inside a block. The wall test above lets a jumper through when the feet are within
    // LEDGE_GRAB of the top, but the body's front crosses the face before the feet are over the
    // ledge. If the jump then sinks below the top, either the ledge catches the feet (within
    // LEDGE_GRAB, coming down) or the face pushes the runner back out.
    if (!p.ground) {
      const front = p.s + R.RADIUS;
      const resolve = (pl) => {
        if (p.ground || front <= pl.a + 1e-9 || p.s >= pl.a || p.y >= pl.h || p.y + R.HEAD <= pl.h - pl.thick) return;
        if (pl.h - p.y <= grabOf(sim)) { if (p.vy <= 0) { p.s = Math.max(p.s, pl.a - R.EDGE * 0.5); land(sim, p, pl); } }
        else { p.s = pl.a - R.RADIUS; p.vs = 0; }
      };
      for (const pl of ix.plat.at(front)) resolve(pl);
      for (const br of ix.bridge.at(front)) if (bridgeLit(sim, br)) resolve(br);
    }
    if (!sim.dry && !p.ground && !p.doomed && p.vy < 0 && p.y < p.airFromY - 1.3 && !supportBelow(sim, p.s, p.y, 0) && !supportBelow(sim, p.s + p.vs * 0.35, p.y, 0)) {
      p.doomed = true;                      // below the road with nothing underneath: the fall has begun
      emit(sim, 'falling');
    }
    if (!p.ground && p.vy < 0) {
      const depth = sim.dry ? 0.9 : R.PIT_DEPTH;
      if (p.y < p.airFromY - depth && !supportBelow(sim, p.s, p.y, 0)) {
        // looking ahead: a pit that was walked into is reported at its edge
        if (sim.dry) { sim.harm = { kind: 'pit', s: p.jumps === sim.jumps0 ? p.edgeS : p.s }; return; }
        fall(sim);
        return;
      }
    }
  }

  // ---- springs (drums): fixed launch, the same for everyone
  if (p.ground) {
    for (const sp of ix.spring.at(p.s)) {
      if (p.s >= sp.a && p.s <= sp.b && Math.abs(p.y - sp.h) < 0.05) {
        p.vy = R.SPRING_VY; p.vs = R.SPRING_VS; p.ground = false; p.on = null; p.spring = true; p.coyote = 0; p.airFromY = p.y;
        emit(sim, 'spring', { id: sp.id });
        break;
      }
    }
  }

  // ---- notes
  const reach = p.fever > 0 ? 1.3 : R.NOTE_R;
  for (const n of ix.note.at(p.s)) {
    if (Math.abs(n.s - p.s) < reach && n.y > p.y - 0.25 && n.y < p.y + R.HEAD + 0.35 && !isGone(sim, n.id)) {
      take(sim, n.id); p.notes++; p.score += 100;
      emit(sim, 'note', { id: n.id });
    }
  }
  // ---- bells: ring them with the head
  for (const b of ix.bell.at(p.s)) {
    const top = p.y + R.HEAD;
    if (Math.abs(b.s - p.s) < 0.6 && top >= b.y && top <= b.y + 1.2 && !isGone(sim, b.id)) {
      take(sim, b.id); p.bells++; p.notes += b.notes || 0; p.score += 300 + (b.notes || 0) * 100;
      emit(sim, 'bell', { id: b.id, fever: !!b.fever, notes: b.notes || 0 });
      if (b.fever) { p.fever = R.FEVER_SEC; emit(sim, 'fever'); }
    }
  }
  // ---- creatures
  for (const en of ix.enemy.at(p.s)) {
    if (isGone(sim, en.id) || (sim.still && en.v)) continue;
    const kind = ENEMY[en.type];
    const es = enemyS(en, sim.t);
    const fat = sim.dry ? CAUTIOUS.FAT : 0;
    const gap = Math.abs(es - p.s) - (R.RADIUS + kind.r);
    if (gap >= fat || p.y >= en.h + kind.height + fat || p.y + R.HEAD <= en.h) continue;
    const touching = gap < 0 && p.y < en.h + kind.height;
    const fromAbove = kind.stomp && !p.ground && p.vy < -0.5 && p.y > en.h + (sim.dry ? CAUTIOUS.STOMP_MIN : R.STOMP_MIN);
    if (!touching) {
      // looking ahead only: a near miss counts as a hit, unless the player is coming down onto it.
      // Coming down past its edge it may be stomped after all (and the bounce goes somewhere else): not a jump to count on.
      if (p.fever <= 0 && !fromAbove && p.invuln <= 0 && hurt(sim, en.type)) return;
      if (sim.dry && fromAbove) sim.iffy = true;
      continue;
    }
    if (p.fever > 0) {
      take(sim, en.id); p.blasts++; p.score += 200;
      emit(sim, 'blast', { id: en.id });
    } else if (fromAbove) {
      take(sim, en.id); p.stomps++; p.combo++;
      p.bestCombo = Math.max(p.bestCombo, p.combo);
      const pts = 200 * Math.min(8, 2 ** (p.combo - 1));
      p.score += pts; p.vy = R.STOMP_BOUNCE; p.spring = false;
      emit(sim, 'stomp', { id: en.id, combo: p.combo, pts });
    } else if (p.invuln <= 0) {
      if (hurt(sim, en.type)) return;
    }
  }
  // ---- hammers
  for (const hm of ix.hammer.at(p.s)) {
    if (sim.still || p.s <= hm.a - R.RADIUS || p.s >= hm.b + R.RADIUS) continue;
    const st = hammerState(hm, sim.t);
    if (p.y + R.HEAD <= hm.h + st.sole + 0.02) continue;      // the face is still above the head
    const forward = p.s > (hm.a + hm.b) / 2;
    if (st.state === 'slam' && p.invuln <= 0) {
      if (hurt(sim, 'hammer')) return;
    } else if (sim.dry && p.ground && !sim.harm) {
      sim.harm = { kind: 'wall', s: hm.a - R.RADIUS };
    }
    p.s = forward ? hm.b + R.RADIUS : hm.a - R.RADIUS;
    if (!forward) p.vs = 0;
  }

  // ---- checkpoints, the place to come back to after a fall, the goal
  if (p.ground) {
    const next = (sim.cps || L.checkpoints)[p.cp + 1];
    if (next && p.s >= next.s) {
      p.cp++;
      if (!sim.dry && sim.mode === 'normal') sim.snap = snapshot(sim);
      emit(sim, 'checkpoint', { index: p.cp, s: next.s });
    }
    const on = p.on;
    if (on && on.safe) {
      let s = on.b - on.a < 1.8 ? (on.a + on.b) / 2 : Math.min(Math.max(p.s, on.a + 0.5), on.b - 1.1);
      // before a hole that needs a run-up, come back far enough from it to take the run-up again
      if (on.gap && on.gap.dash) s = Math.max(on.a + 0.5, Math.min(s, on.b - on.gap.runup - 1.5));
      let clear = true;
      for (const hm of ix.hammer.at(s)) if (s > hm.a - 1 && s < hm.b + 1) clear = false;
      if (clear) { p.safeS = s; p.safeY = on.h; }
    }
    if (p.s >= L.goal) finish(sim);
  }
}

// ---------------------------------------------------------------- looking ahead
function fork(sim) {
  return {
    level: sim.level, t: sim.t, gone: sim.gone, local: new Set(), dry: true, events: null, harm: null, bonus: 0,
    jumps0: sim.p.jumps, p: { ...sim.p }, assists: sim.assists, steady: sim.steady, pitFalls: sim.pitFalls, still: sim.still, cps: sim.cps, mode: sim.mode,
  };
}
const A_STEPS = 156;     // 1.3 s of "keep running": far enough to see trouble before the early cue is due
const B_MAX = 216;       // 1.8 s: longest flight (a drum launch) that is followed
const G_MAX = 384;       // 3.2 s to get through a hammer or over a beat bridge
const AFTER_STEPS = 36;  // 0.3 s after the landing must be safe too
const LAST_CHANCE_STEPS = 30;
const GATE_SPEED = 4.5;  // m/s
const PACE_AHEAD = 26;   // m: how far ahead a hole's speed range is announced
export const SOON_SEC = 0.3;
const SOON_STEPS = Math.round(SOON_SEC * 120);

// "keep running" means: hold this speed. A sensor player's stamping flickers on and off, so the
// speed is a better guess of the next second than the input is. From a standstill: start running.
const HOLD = { hold: true, accel: true, jump: false }, START = { accel: true, jump: false };

/** Compare "keep running" with "jump now" from this state (the game, or a look-ahead of it). */
function judge(sim) {
  const p = sim.p;
  const out = { jump: null, land: null, harm: null, harmIn: Infinity };
  const keep = p.vs > 1.5 ? HOLD : START;
  const airborne = !p.ground && p.coyote <= 0;

  // B: jump now, follow the flight to the landing, then a few steps more
  let B = null, landed = false, nB = 0, crowded = false;
  if (!airborne) {
    B = fork(sim);
    step(B, { ...keep, jump: true });
    for (nB = 1; nB < B_MAX && !B.harm; nB++) {
      if (B.p.ground) { landed = true; break; }
      step(B, keep);
    }
    if (landed) {
      // coming down right in front of a creature or under a hammer is not a good jump
      const bonus = B.bonus, s = B.p.s, y = B.p.y;
      for (let i = 0; i < AFTER_STEPS && !B.harm; i++) step(B, keep);
      crowded = !!B.harm && B.harm.kind !== 'pit' && B.harm.kind !== 'wall';
      B.harm = null; B.bonus = bonus; B.p.s = s; B.p.y = y;
    }
  }
  // A: keep running, no jump
  const A = fork(sim);
  let bonusA = 0, landA = null, nA = 0;
  const limit = airborne ? B_MAX : Math.max(A_STEPS, nB);
  for (; nA < limit && !A.harm; nA++) {
    step(A, keep);
    if (nA < nB) bonusA = A.bonus;          // what running collects in the time the jump would take
    if (airborne && A.p.ground) { landA = { s: A.p.s, y: A.p.y, ok: true }; break; }
  }
  out.harm = A.harm;
  if (A.harm) out.harmIn = nA * RULES.DT;

  if (airborne) {
    out.land = landA || (A.harm && A.harm.kind === 'pit' ? { s: A.p.s, y: p.airFromY, ok: false } : null);
  } else {
    const past = !A.harm || B.p.s > A.harm.s + 0.15;
    const clears = landed && !B.harm && past && !B.iffy;
    out.land = { s: B.p.s, y: landed ? B.p.y : p.y, ok: landed && !B.harm };
    if (clears && A.harm && !crowded) out.jump = 'need';
    else if (clears && !crowded && !A.harm && B.bonus > bonusA) out.jump = 'bonus';
    // last chance: a quarter second from certain trouble, a jump that at least gets past it
    // (even into a crowded landing, or into a creature further on) beats standing in its way
    else if (A.harm && nA < LAST_CHANCE_STEPS && past && (!B.harm || B.harm.kind !== 'pit')) out.jump = 'need';
  }
  return out;
}

/**
 * The speed the road ahead asks for: the next hole with a speed range (see findGaps), or a
 * stretch the course marks as slow (level.slowZones), whichever comes first.
 *   { kind: 'dash' | 'slow' | 'ok' | null, min, max, dist, dash }
 *   'dash'  too slow to get across: keep stamping
 *   'slow'  too fast, and it is time to ease off (reaction time + braking distance from here)
 *   'ok'    inside the range
 *   min     the speed to have (0 when there is no lower limit). For a wide hole it is a little
 *           above the bare minimum, so "ok" means the jump has room to spare.
 *   dash    true for a wide hole: inside the range, keep stamping all the same.
 * null when nothing ahead has a speed range.
 */
const PACE_MARGIN = 0.4;
function paceOf(sim) {
  const p = sim.p, L = sim.level;
  if (p.finished || p.fever > 0 || p.spring) return null;
  // in the air the speed cannot change, but the feet can already stop: the brake starts on landing
  const y = p.ground ? p.y : p.airFromY;
  // ... and a hole this jump is already flying over asks for nothing any more
  let from = p.s - 0.1;
  if (!p.ground) { const dy = Math.max(0, p.y - p.airFromY); from = p.s + p.vs * (p.vy + Math.sqrt(p.vy * p.vy + 2 * RULES.GRAVITY * dy)) / RULES.GRAVITY + 0.3; }
  let best = null;
  for (const g of L.gaps) {
    if (g.a < from) continue;
    const dist = g.a - p.s;
    if (dist > PACE_AHEAD) break;
    if ((!g.dash && !g.slow) || Math.abs(g.h - y) > 2.2) continue;
    if (sim.assists.some((q) => q.a <= g.a + 0.1 && q.b >= g.b - 0.1)) continue;    // a helper bridge covers it
    best = { kind: null, min: g.dash ? Math.min(g.vmin + PACE_MARGIN, g.vmax) : 0, max: g.vmax, dist, dash: g.dash, hole: true };
    break;
  }
  for (const z of L.slowZones || []) {
    if (z.b < p.s || Math.abs(z.h - y) > 2.2) continue;
    const dist = Math.max(0, z.a - p.s);
    if (dist > PACE_AHEAD) break;
    if (!best || dist < best.dist) best = { kind: null, min: 0, max: z.max, dist, dash: false, hole: false };
    break;
  }
  if (!best) return null;
  if (p.vs < best.min) best.kind = 'dash';
  // time to react (0.6 s) + the distance the brake needs
  else if (p.vs > best.max) { if (best.dist < brakeDist(p.vs, best.max) + p.vs * 0.6 + 1.5) best.kind = 'slow'; }
  else if (best.dash || best.dist < 14) best.kind = 'ok';
  return best;
}

/**
 * What should the player do right now?
 *   jump: 'need'  — keep running and something goes wrong within a second; jumping now gets past it
 *         'bonus' — nothing is wrong, but jumping now collects more (a bell, notes in the air, a stomp)
 *         null
 *   soon: true when jump is not 'need' yet but will be in SOON_SEC. The cue is shown from here, and a
 *         jump asked for now is held until it is 'need': people need a moment to react.
 *   gate: 'stop' | 'wait' | 'go' | null — for hammers and beat bridges, which are about timing
 *   land: { s, y, ok } — where a jump taken now (or the flight in progress) comes down
 *   harm: what "keep running" runs into, if anything
 *   pace: the speed the next hole asks for (see paceOf), or null
 *
 * memo (optional): an object the caller keeps between calls, e.g. `const memo = {}` per run. With it,
 * STOP stays STOP until the runner has all but stopped. Without it, a runner who is braking for a
 * hammer can be told GO again a moment later (slower now, the timing works out after all), speeds up,
 * is told STOP, and so on, and arrives under the hammer at full speed.
 */
export function advise(sim, memo = null) {
  const p = sim.p;
  const out = { jump: null, soon: false, gate: null, land: null, harm: null, pace: null };
  if (p.finished || p.over) return out;
  out.pace = paceOf(sim);
  const now = judge(sim);
  out.jump = now.jump; out.land = now.land; out.harm = now.harm;
  // Too fast for a small foothold, and still room to brake: the cue is SLOW, not JUMP. (At this speed
  // the only jump that lands on the foothold is an early one that comes down on its near edge, with
  // no time for the next jump. Once it is too late to brake, that jump is offered after all.)
  const pc = out.pace;
  const brakeFirst = !!pc && pc.hole && pc.kind === 'slow' && !!out.harm && out.harm.kind === 'pit' && now.harmIn > 0.4 && pc.dist > brakeDist(p.vs, pc.max, p.coast) + 0.5;
  if (brakeFirst && out.jump === 'need') out.jump = null;
  if (p.ground && out.jump !== 'need' && out.harm && !brakeFirst) {
    const F = fork(sim);
    const keep = p.vs > 1.5 ? HOLD : START;
    for (let i = 0; i < SOON_STEPS && !F.harm && F.p.ground; i++) step(F, keep);
    if (!F.harm && F.p.ground) out.soon = judge(F).jump === 'need';
  }

  // hammers and beat bridges: is there time to get through if the player goes now?
  // Judged for a gentle runner (GATE_SPEED), so GO is not a promise only a sprinter can keep.
  // (Also in the air: the speed cannot change there, but the feet can already stop, and the brake
  //  then starts on landing. At a dash a landing can be closer to a hammer than the braking distance.)
  {
    const road = p.ground ? p.y : out.land ? out.land.y : p.airFromY;
    let gate = null;
    for (const g of sim.level.gates) {
      if (g.b + RULES.RADIUS <= p.s) continue;
      // looked at from far enough to react (0.6 s) and to stop: 9 m at a jog, 16 m at a dash
      if (g.a - p.s < 5 + p.vs * 0.6 + brakeDist(p.vs, 0) && Math.abs(g.h - road) < 1.5) gate = g;
      break;
    }
    if (gate) {
      const G = fork(sim);
      const go = { accel: true, jump: false, cap: Math.max(GATE_SPEED, p.vs) };
      const end = gate.b + RULES.RADIUS + 0.3;
      for (let i = 0; i < G_MAX && !G.harm && G.p.s <= end; i++) step(G, go);
      const inside = p.on === gate || (gate.kind !== 'bridge' && p.s > gate.a - RULES.RADIUS && p.s < gate.b + RULES.RADIUS);
      if (inside) out.gate = 'go';                              // on a beat bridge or under a hammer: the only way is forward
      else if (!G.harm && G.p.s > end) out.gate = 'go';
      else if (G.harm && G.harm.s > gate.a - 1.5) out.gate = p.vs > 1 ? 'stop' : 'wait';
      if (memo) {
        if (out.gate === 'stop') memo.stop = gate.id;
        else if (out.gate === 'go' && memo.stop === gate.id && !inside && p.vs > 1.5) out.gate = 'stop';
        else if (out.gate !== 'wait') memo.stop = null;
      }
      // the cue for a hammer that is down is STOP, never JUMP
      const blocked = out.gate === 'stop' || out.gate === 'wait';
      if (blocked && out.harm && out.harm.kind === 'wall' && Math.abs(out.harm.s - (gate.a - RULES.RADIUS)) < 0.4) { out.jump = null; out.soon = false; }
    } else if (memo) memo.stop = null;
  }
  // no detours for a bell or a note while the cue is to stop
  if (out.jump === 'bonus' && (out.gate === 'stop' || out.gate === 'wait')) out.jump = null;
  return out;
}

/**
 * A player made of advise(): runs, jumps when told to, stops for hammers and bridges.
 * Used by the title-screen demo and by the tests (which prove the course can be finished).
 * options.cruise: usual running speed (m/s); options.dash: false = never faster than that, even where
 * a hole needs it (a player who cannot or will not dash); options.greedy: also take 'bonus' jumps.
 */
export function botInput(sim, advice, options = {}) {
  const p = sim.p;
  let want = options.cruise || Infinity;
  const pace = advice.pace;
  if (pace) {
    // a wide hole: build up the speed it needs, and some to spare. Flat out (no cruise): everything there is.
    if (options.dash !== false && pace.dash) want = Math.max(want, pace.min + 1.5);
    if (pace.dist < brakeDist(p.vs, pace.max - 0.4) + 1.2) want = Math.min(want, pace.max - 0.4);            // ease off for a small foothold
  }
  let accel = p.vs < want || p.fever > 0;
  if (advice.gate === 'stop' || advice.gate === 'wait') accel = false;
  if (advice.gate === 'go') accel = true;                      // GO means go: do not dawdle under a hammer
  if (p.ground && p.on && p.on.belt) accel = true;
  let jump = advice.jump === 'need' || (advice.jump === 'bonus' && options.greedy !== false);
  // the long jump at the end: the nearer the board, the longer the jump. Wait for the last moment.
  const F = sim.level.finale;
  if (F && p.ground && p.s > F.board - 9 && p.s <= F.board) { accel = true; jump = F.board - p.s < p.vs * 0.04 + 0.08; }
  return { accel, jump };
}
