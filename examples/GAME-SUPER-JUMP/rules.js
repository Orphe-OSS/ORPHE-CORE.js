// rules.js — SUPER VIRTUAL JUMP: the rules of the long jump and the triple jump.
//
// No DOM, no three.js: main.js feeds it two inputs (stamping = run, a real vertical jump = jump)
// and draws what it says; tests/super-jump-rules.test.js plays it in Node.
//
// A real jump reaches the rules in two halves, because its height is only known when the player
// is back on the floor:
//   takeoff(ahead)   the feet left the floor  -> the jumper leaves the board (or the contact is timed)
//   launch(cm)       the feet are back, the jump was `cm` high -> the flight starts, and the
//                    higher the real jump, the more lift it gets
// Between the two the attempt waits in the phase 'charge' (main.js all but stops the clock).
//
// What the two inputs decide, as in the real events:
//   run-up     stamp without a pause and the speed keeps building; every pause costs speed, and
//              speed is most of the distance.
//   the board  the jump is measured from the foul line, wherever the foot left the ground. Take
//              off early and those centimetres are thrown away; a toe over the line is a foul.
//   height     how high the player really jumped is the lift of the flight: a higher jump is a
//              longer one. In the triple jump every phase is its own real jump.
//   contact    (triple jump) "jump again the moment the foot meets the ground". An active
//              contact keeps the speed, a late or missing one collapses and the next phase is short.
//   wind       it changes while the athlete stands on the runway. Waiting for a tail wind is
//              part of the event; above +2.0 m/s the mark still counts in the competition but
//              not as a record.
//
// Distances are metres along the runway, measured from the foul line of the board in use:
// s < 0 is the runway, s > 0 is beyond the line. Times are game seconds (main.js slows the game
// clock around the board and in the air; the sim does not care).

export const G = 9.81;

export const RULES = {
  RUNUP: 40,            // m from the start mark to the foul line
  VMAX: 10.6,           // m/s the speed tends to while stamping
  TAU: 1.9,             // s: how quickly it gets there (stamping all the way: about 9.8 m/s at the board)
  COAST: 0.25,          // s a pause is forgiven before the speed starts to drop
  DECEL0: 0.6, DECEL1: 0.35,   // m/s² + 1/s × v: the drop while not stamping
  MIN_RUN: 3.0,         // m/s: slower than this at the board and the jump is not attempted
  ZONE: 6.0,            // m before the line: the take-off zone (speed is carried, the jump is armed)
  OVER: 0.45,           // m past the line where a late take-off is still a take-off (and a foul)
  JUST: 0.05,           // m: a take-off this close to the line is "JUST"
  WIND_LEGAL: 2.0,
  WIND_GAIN: 0.05,      // m/s of carried speed per m/s of tail wind
  // the take-off: the share of the run-up speed that is kept, and the vertical speed bought with it
  // (tuned so that stamping all the way + a toe on the line + real jumps of JUMP_REF_CM is about
  // 8.75 m, and the same with perfect contacts is about 18.1 m: the world records need a tail
  // wind or a jump higher than the reference)
  LONG: { keep: 0.965, lift: 0.408, drop: 0.55, reach: 0.0 },
  // hop, step, jump: lift = vertical speed as a share of the horizontal speed going in
  // (minScale: a low jump costs more here than in the long jump — asked for after the first real play, 2026-11-23)
  TRIPLE: { keep: 0.965, lift: [0.348, 0.269, 0.282], drop: 0.5, reach: -0.15, stance: 0.14, minScale: 0.48 },
  // an active contact keeps this share of the horizontal speed (quality 0..1)
  RETAIN: [0.885, 0.955],
  LIFT_LOSS: 0.12,      // a collapsed contact also loses this share of its lift
  LAND_REACH: 0.15,     // m the heels reach forward into the sand
  // the real jump: its height (cm, top of the foot's path) scales the lift of the flight
  JUMP_REF_CM: 40,      // a jump this high gets the full lift (the player can change it: settings)
  JUMP_MIN_SCALE: 0.55, // lift of a jump of 0 cm
  JUMP_BONUS: 0.12,     // extra lift at 1.5 × the reference (and no more above that)
  MISS_CM: 8,           // the height given to a jump that was not made or could not be measured
  // contact timing, |error| in game seconds
  GRADES: [
    { key: 'perfect', max: 0.022, q: 1.0 },
    { key: 'great', max: 0.05, q: 0.75 },
    { key: 'good', max: 0.09, q: 0.45 },
  ],
  EARLY_IGNORE: 0.4,    // jumps in the first share of a flight are not taken as the contact
  PIT_LEN: 10,
};

export const EVENTS = {
  long: {
    key: 'long', en: 'LONG JUMP', ja: '走り幅跳び', pitNear: 2.0, phases: ['JUMP'],
    wr: 8.95, lines: [6, 7, 8, 9],
    rivalMeans: [8.50, 8.39, 8.29, 8.19, 8.09, 7.99, 7.86], rivalSd: 0.14,
  },
  triple: {
    key: 'triple', en: 'TRIPLE JUMP', ja: '三段跳び', pitNear: 13.0, phases: ['HOP', 'STEP', 'JUMP'],
    wr: 18.29, lines: [15, 16, 17, 18],
    rivalMeans: [17.34, 17.14, 16.96, 16.78, 16.60, 16.42, 16.18], rivalSd: 0.24,
  },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grade of a contact from its timing error (game seconds; negative = early). */
export function gradeOf(error) {
  if (error == null) return { key: 'miss', q: 0 };
  const a = Math.abs(error);
  for (const g of RULES.GRADES) if (a <= g.max) return { key: g.key, q: g.q };
  return { key: 'miss', q: 0 };
}

/** Lift of a flight for a real jump of `cm`, as a share of the lift of the reference jump. */
export function liftScale(cm, ref = RULES.JUMP_REF_CM, min = RULES.JUMP_MIN_SCALE) {
  const x = Math.max(0, Number.isFinite(cm) ? cm : 0) / ref;
  return min + (1 - min) * Math.min(1, x) + RULES.JUMP_BONUS * clamp01((x - 1) / 0.5);
}

/** The wind over the runway: slow swings plus gusts, in m/s (+ = tail wind). */
export function createWind(seed = 1) {
  const rnd = mulberry32(seed);
  const base = -0.5 + rnd() * 1.5, p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;
  return (t) => {
    const w = base + 1.25 * Math.sin(0.33 * t + p1) + 0.6 * Math.sin(0.91 * t + p2) + 0.25 * Math.sin(2.3 * t + p3);
    return Math.round(w * 10) / 10;
  };
}

function flightTime(vy, drop) { return (vy + Math.sqrt(vy * vy + 2 * G * drop)) / G; }

/**
 * One attempt. Call step(dt, accel) every frame, takeoff(ahead) when the player's feet leave
 * the floor and launch(cm) when the height of that jump is known; read phase / s / y / v and
 * the events the three return.
 *
 * phase: 'ready' → 'run' → 'charge' → ('air' → 'stance' → 'charge')* → 'air' → 'landed'   a jump
 *                        → 'through'                                  ran over the board without jumping
 * ('charge' is skipped when the height is already known: a contact jumped early and landed before the touch)
 */
export function createAttempt(eventKey, { wind = 0, refCm = RULES.JUMP_REF_CM } = {}) {
  const ev = EVENTS[eventKey];
  const triple = eventKey === 'triple';
  const cfg = triple ? RULES.TRIPLE : RULES.LONG;
  const nPhases = ev.phases.length;
  const sim = {
    event: ev, triple, wind, refCm,
    phase: 'ready',
    t: 0,
    s: -RULES.RUNUP,       // where the runner is (toe on the ground, hips in the air)
    y: 0,                  // height of the hips above standing
    v: 0,                  // speed along the runway
    inZone: false,
    coast: 0,
    topSpeed: 0,
    pauses: 0,             // seconds not stamping during the run-up (after the first step)
    runTime: 0,
    // the jump
    board: null,           // the take-off: { toe, loss, foul, just, speed }
    flight: null,          // { i, t0, T, s0, vh, vy, drop, input: error | null }
    stance: null,          // { i, t0, s0, vh, input }
    charge: null,          // { i, s0, vh, q }: waiting for the height of the real jump
    jumpIn: null,          // { cm: number | null }: the real jump that belongs to the next flight
    heights: [],           // cm of the real jump behind each phase so far
    contacts: [],          // [{ i, error, grade, q, s, vhIn, vhOut }] — hop→step, step→jump
    phaseMarks: [],        // toe-to-toe length of each phase so far
    landing: null,         // { heel }
    result: null,          // { mark, foul, reason, ... } once it is over
    /** Predicted moment and place of the next contact while in the air (for the timing ring). */
    get nextContact() {
      const f = sim.flight;
      return f ? { at: f.t0 + f.T, s: f.s0 + f.vh * f.T, in: f.t0 + f.T - sim.t, T: f.T, final: f.i === nPhases - 1 } : null;
    },
  };

  function startFlight(i, s0, vhIn, q, cm, t0, events) {
    const lift = triple ? cfg.lift[i] : cfg.lift;
    const scale = liftScale(cm, sim.refCm, cfg.minScale);
    const vy = vhIn * lift * scale * (1 - RULES.LIFT_LOSS * (1 - q));
    const final = i === nPhases - 1;
    const drop = final ? cfg.drop : 0;
    sim.flight = { i, t0, T: flightTime(vy, drop), s0, vh: vhIn, vy, drop, input: null, cm, scale };
    sim.heights[i] = cm;
    sim.stance = null; sim.charge = null;
    sim.phase = 'air';
    events.push({ type: 'phase', i, name: ev.phases[i], vh: vhIn, T: sim.flight.T, cm, scale });
  }
  /** The foot leaves the ground for phase i: fly if the height of the real jump is known, wait for it if not. */
  function leave(i, s0, vhIn, q, t0, events) {
    const j = sim.jumpIn;
    if (j && j.cm == null) {
      sim.flight = null; sim.stance = null;
      sim.charge = { i, s0, vh: vhIn, q };
      sim.phase = 'charge';
      sim.s = s0; sim.y = 0;
      events.push({ type: 'charge', i, name: ev.phases[i] });
      return;
    }
    sim.jumpIn = null;
    startFlight(i, s0, vhIn, q, j ? j.cm : RULES.MISS_CM, t0, events);
  }

  function finish(events) {
    const f = sim.flight;
    const heel = f.s0 + f.vh * f.T + cfg.reach + RULES.LAND_REACH;
    sim.landing = { heel };
    // each phase is measured on the ground, from where the foot left it to where the next one lands
    sim.phaseMarks.push(heel - (sim.contacts.length ? sim.contacts[sim.contacts.length - 1].s : sim.board.toe));
    sim.s = heel; sim.y = -cfg.drop; sim.v = 0;
    sim.phase = 'landed';
    sim.flight = null;
    const to = sim.board;
    const short = heel < ev.pitNear;
    const mark = Math.floor(heel * 100 + 1e-6) / 100;      // marks are rounded down to the centimetre
    sim.result = {
      foul: to.foul || short, reason: to.foul ? 'line' : short ? 'short' : null,
      mark: to.foul || short ? null : mark, raw: heel,
      speed: to.speed, loss: to.loss, toe: to.toe, just: to.just, wind: sim.wind,
      windAided: sim.wind > RULES.WIND_LEGAL,
      landing: sim.landing, contacts: sim.contacts, phases: sim.phaseMarks.slice(),
      heights: sim.heights.slice(), refCm: sim.refCm,
      topSpeed: sim.topSpeed, pauses: sim.pauses,
    };
    events.push({ type: 'land', ...sim.result });
  }

  /** Stamping (accel = true) or not, for dt game seconds. Returns what happened. */
  sim.step = function step(dt, accel) {
    const events = [];
    if (sim.phase === 'ready') {
      if (!accel) return events;
      sim.phase = 'run';
      events.push({ type: 'start' });
    }
    if (sim.phase === 'landed' || sim.phase === 'through' || sim.phase === 'charge') return events;
    sim.t += dt;

    if (sim.phase === 'run') {
      if (!sim.inZone) {
        sim.runTime += dt;
        if (accel) { sim.coast = 0; sim.v += ((RULES.VMAX - sim.v) / RULES.TAU) * dt; } else {
          sim.coast += dt; sim.pauses += dt;
          if (sim.coast > RULES.COAST) sim.v = Math.max(0, sim.v - (RULES.DECEL0 + RULES.DECEL1 * sim.v) * dt);
        }
      }
      sim.topSpeed = Math.max(sim.topSpeed, sim.v);
      sim.s += sim.v * dt;
      if (!sim.inZone && sim.s >= -RULES.ZONE) {
        sim.inZone = true;
        // too slow to jump: walking up to the board is not an attempt worth slowing time for
        events.push({ type: 'zone', speed: sim.v, armed: sim.v >= RULES.MIN_RUN });
      }
      if (sim.s > RULES.OVER) {
        sim.phase = 'through';
        sim.result = { foul: true, reason: 'through', mark: null, speed: sim.v, loss: null, toe: null, wind: sim.wind, topSpeed: sim.topSpeed, pauses: sim.pauses, contacts: [], phases: [], heights: [], refCm: sim.refCm };
        events.push({ type: 'through', ...sim.result });
      }
      return events;
    }

    if (sim.phase === 'air') {
      const f = sim.flight;
      let tau = sim.t - f.t0;
      if (tau < f.T) {
        sim.s = f.s0 + f.vh * tau;
        sim.y = f.vy * tau - 0.5 * G * tau * tau;
        return events;
      }
      // the ground
      if (f.i === nPhases - 1) { sim.t = f.t0 + f.T; finish(events); return events; }
      const sC = f.s0 + f.vh * f.T;
      sim.phaseMarks.push(sC - (f.i === 0 ? sim.board.toe : sim.contacts[f.i - 1].s));
      sim.stance = { i: f.i, t0: f.t0 + f.T, s0: sC, vh: f.vh, input: f.input };
      sim.flight = null;
      sim.phase = 'stance';
      sim.y = 0;
      events.push({ type: 'touch', i: f.i, s: sC, early: f.input });
      tau = sim.t - sim.stance.t0;          // fall through with what is left of the frame
    }

    if (sim.phase === 'stance') {
      const st = sim.stance;
      const tau = sim.t - st.t0;
      // the foot is on the ground for a fixed moment; a real jump just before the touch or
      // during it is the active contact, and it is judged when the foot leaves
      sim.s = st.s0 + st.vh * 0.6 * Math.min(tau, cfg.stance);     // the hips travel over the planted foot
      sim.y = -0.1 * Math.sin(Math.PI * clamp01(tau / cfg.stance));
      if (tau >= cfg.stance) {
        const g = gradeOf(st.input);
        const vhOut = st.vh * lerp(RULES.RETAIN[0], RULES.RETAIN[1], g.q);
        const c = { i: st.i, error: st.input, grade: g.key, q: g.q, s: st.s0, vhIn: st.vh, vhOut };
        sim.contacts.push(c);
        events.push({ type: 'contact', ...c });
        sim.y = 0;
        if (st.input == null) sim.jumpIn = null;      // no jump was made for this contact
        leave(st.i + 1, st.s0 + st.vh * 0.6 * cfg.stance, vhOut, g.q, st.t0 + cfg.stance, events);
      }
    }
    return events;
  };

  /**
   * The player's feet left the floor. `ahead` = game seconds since the last step() (so that a
   * take-off between two frames lands on the right centimetre). Returns the events, or null
   * when a jump means nothing here.
   */
  sim.takeoff = function takeoff(ahead = 0) {
    const events = [];
    if (sim.phase === 'run') {
      if (!sim.inZone || sim.v < RULES.MIN_RUN) return null;
      const toe = sim.s + sim.v * ahead;
      if (toe > RULES.OVER) return null;
      const foul = toe > 1e-9;
      const loss = foul ? 0 : -toe;
      sim.board = { toe, loss, foul, just: !foul && loss <= RULES.JUST, speed: sim.v };
      sim.jumpIn = { cm: null };
      events.push({ type: 'takeoff', ...sim.board });
      leave(0, toe, sim.v * cfg.keep + RULES.WIND_GAIN * sim.wind, 1, sim.t + ahead, events);
      return events;
    }
    if (sim.phase === 'air') {
      const f = sim.flight;
      if (f.i === nPhases - 1) return null;       // the last flight ends in the sand: nothing to jump for
      const tau = sim.t + ahead - f.t0;
      if (f.input != null || sim.jumpIn || tau < f.T * RULES.EARLY_IGNORE) return null;
      f.input = tau - f.T;                      // negative: before the ground
      sim.jumpIn = { cm: null };
      events.push({ type: 'ready-contact', i: f.i, error: f.input });
      return events;
    }
    if (sim.phase === 'stance') {
      const st = sim.stance;
      if (st.input != null || sim.jumpIn) return null;
      st.input = Math.max(1e-4, sim.t + ahead - st.t0);   // positive: after the touch
      sim.jumpIn = { cm: null };
      events.push({ type: 'ready-contact', i: st.i, error: st.input });
      return events;
    }
    return null;
  };

  /**
   * The height of the jump that takeoff() announced is known (the player is back on the floor).
   * Returns the events, or null when no jump was waiting for its height.
   */
  sim.launch = function launch(cm) {
    const j = sim.jumpIn;
    if (!j || j.cm != null) return null;
    j.cm = Math.max(0, Number.isFinite(cm) ? cm : RULES.MISS_CM);
    const events = [{ type: 'height', cm: j.cm, scale: liftScale(j.cm, sim.refCm, cfg.minScale), ref: sim.refCm }];
    if (sim.phase === 'charge') {
      const c = sim.charge;
      sim.jumpIn = null;
      startFlight(c.i, c.s0, c.vh, c.q, j.cm, sim.t, events);
    }
    return events;
  };

  return sim;
}

/**
 * Marks an athlete jumping at `speed` with the given precision would get (used for tuning and tests).
 * cms: height of the real jump behind each phase; errors: timing of each contact (null = no jump).
 */
export function simulate(eventKey, { speed = 10, loss = 0, errors = [], cms = [], wind = 0, refCm = RULES.JUMP_REF_CM } = {}) {
  const sim = createAttempt(eventKey, { wind, refCm });
  const cm = (i) => (cms[i] == null ? refCm : cms[i]);
  sim.phase = 'run'; sim.inZone = true; sim.v = speed; sim.topSpeed = speed; sim.s = -loss;
  sim.takeoff(0); sim.launch(cm(0));
  const dt = 1 / 2000;
  let guard = 0;
  while (sim.phase !== 'landed' && guard++ < 40000) {
    const f = sim.flight;
    if (f && f.input == null && f.i < sim.event.phases.length - 1) {
      const want = errors[f.i];
      if (want != null && want <= 0 && sim.t + dt - f.t0 >= f.T + want) { f.input = want; sim.jumpIn = { cm: cm(f.i + 1) }; }
    }
    const st = sim.stance;
    if (st && st.input == null) {
      const want = errors[st.i];
      if (want != null && want > 0 && sim.t - st.t0 >= want) { st.input = want; sim.jumpIn = { cm: cm(st.i + 1) }; }
    }
    sim.step(dt, false);
  }
  return sim.result;
}

// ------------------------------------------------------------------ the competition
const RIVALS = [
  { name: 'J. CARTER', nat: 'USA' },
  { name: 'M. LINDQVIST', nat: 'SWE' },
  { name: 'D. MOREAU', nat: 'FRA' },
  { name: 'A. NKEMELU', nat: 'NGR' },
  { name: 'L. FERREIRA', nat: 'BRA' },
  { name: 'W. ZHANG', nat: 'CHN' },
  { name: 'T. KOVAC', nat: 'CRO' },
];
function gauss(rnd) { return Math.sqrt(-2 * Math.log(1 - rnd() * 0.9999)) * Math.cos(6.2832 * rnd()); }

/** Seven rivals and everything they will jump in `rounds` rounds (null = foul). */
export function createField(eventKey, rounds = 3, seed = Date.now()) {
  const ev = EVENTS[eventKey];
  const rnd = mulberry32(seed >>> 0);
  const order = RIVALS.map((r, i) => ({ r, k: rnd(), i })).sort((a, b) => a.k - b.k);
  return order.map(({ r }, rank) => {
    const mean = ev.rivalMeans[rank] + (rnd() - 0.5) * 0.08;
    const marks = [];
    for (let k = 0; k < rounds; k++) {
      marks.push(rnd() < 0.16 ? null : Math.round((mean + gauss(rnd) * ev.rivalSd - 0.06) * 100) / 100);
    }
    if (marks.every((m) => m == null)) marks[rounds - 1] = Math.round((mean - 0.2) * 100) / 100;
    return { name: r.name, nat: r.nat, marks, wind: marks.map(() => Math.round((rnd() * 2.6 - 0.8) * 10) / 10) };
  });
}

const best = (marks) => marks.reduce((b, m) => (m != null && (b == null || m > b) ? m : b), null);

/**
 * The table after `rivalRounds` rounds of the rivals and whatever the player has jumped.
 * player: { name, marks: [number | null] }. Sorted best first; athletes with no mark last.
 */
export function standings(field, player, rivalRounds) {
  const rows = field.map((r) => ({ name: r.name, nat: r.nat, marks: r.marks.slice(0, rivalRounds), you: false }));
  rows.push({ name: player.name || 'YOU', nat: player.nat || 'JPN', marks: player.marks.slice(), you: true });
  for (const r of rows) r.best = best(r.marks);
  rows.sort((a, b) => (b.best ?? -1) - (a.best ?? -1) || (a.you ? 1 : 0) - (b.you ? 1 : 0));
  rows.forEach((r, i) => { r.place = i + 1; });
  return rows;
}

/** 0..100 for each thing the player controls, from one attempt's result. */
export function technique(result, eventKey) {
  if (!result) return null;
  const speed = Math.round(100 * clamp01(((result.speed || 0) - 8.0) / 2.0));
  const board = result.reason === 'through' || result.reason === 'line' ? 0 : Math.round(100 * clamp01(1 - (result.loss || 0) / 0.4));
  const hs = result.heights || [];
  const ref = result.refCm || RULES.JUMP_REF_CM;
  const height = hs.length ? Math.round(100 * hs.reduce((a, cm) => a + clamp01(cm / ref), 0) / hs.length) : 0;
  const out = { speed, board, height };
  if (eventKey === 'triple') {
    const cs = result.contacts || [];
    out.rhythm = cs.length ? Math.round(100 * cs.reduce((a, c) => a + c.q, 0) / 2) : 0;
  }
  const vals = Object.values(out);
  out.total = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return out;
}
