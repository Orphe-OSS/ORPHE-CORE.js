// start.js — the start procedure of a sprint race as a small state machine.
//
//   ON YOUR MARKS -> SET -> (everyone steady) -> a random hold -> gun -> reaction
//
// The rules are the real ones: moving after SET and before the gun is a false start, and so is
// a reaction faster than 0.100 s after the gun (the World Athletics limit: nobody can hear a gun
// and move that quickly, so it counts as having anticipated it).
// Pure: the host feeds it the page clock and what the sensor says, and acts on the events it returns.

export const FALSE_START_MS = 100;

export const START_DEFAULTS = {
  marksMs: 2600,     // time on "on your marks" before "set"
  steadyMs: 600,     // the sensor has to be still this long before the starter is satisfied
  // The gun comes holdMinMs after everyone is steady, plus a wait that is exponentially
  // distributed (mean holdMeanMs), cut off at holdMaxMs. With an exponential wait the gun is no
  // more likely in the next instant however long it has been already, so it cannot be timed:
  // a uniform 1.1-2.4 s wait could be, after a few goes. About half the guns come within 2 s
  // of "steady", one in ten after more than 4.2 s.
  holdMinMs: 1000,
  holdMeanMs: 1400,
  holdMaxMs: 6000,
  setLimitMs: 8000,  // still not steady after this long in SET: stand up and start over
  noStartMs: 2500,   // no reaction this long after the gun: recorded as no start
};

export class StartProcedure {
  constructor(options = {}, rng = Math.random) {
    this.o = { ...START_DEFAULTS, ...options };
    this.rng = rng;
    this.phase = 'idle';
  }
  /** "On your marks". */
  begin(now) {
    this.phase = 'marks';
    this.t0 = now;
    this.setAt = null; this.steadyAt = null; this.fireAt = null; this.gunAt = null;
    this.result = null;
  }
  /** From when a movement counts (the moment the starter was satisfied). null before that. */
  get watchFrom() { return this.steadyAt; }
  /** The host reports when the gun is actually heard / seen (page clock, ms). */
  fired(stimulusAt) { if (this.phase === 'fired') this.gunAt = stimulusAt; }

  /**
   * Advance. input: { stillMs, onsetAt, keyAt }
   *   stillMs  how long the sensor has been still (use Infinity for keyboard-only play)
   *   onsetAt  start of the first deliberate movement since watchFrom, or null
   *   keyAt    time of a start key press since "set", or null
   * Returns the events that happened, in order.
   */
  step(now, input = {}) {
    const o = this.o, ev = [];
    const { stillMs = 0, onsetAt = null, keyAt = null } = input;
    const finish = (result) => { this.phase = 'done'; this.result = result; ev.push(result); };

    if (this.phase === 'marks' && now - this.t0 >= o.marksMs) {
      this.phase = 'set'; this.setAt = now;
      ev.push({ type: 'set' });
    }
    if (this.phase === 'set') {
      if (keyAt != null && keyAt >= this.setAt) {
        finish({ type: 'false-start', reason: 'before-gun', ms: null });
      } else if (stillMs >= o.steadyMs && now - this.setAt >= o.steadyMs) {
        this.phase = 'hold'; this.steadyAt = now;
        this.fireAt = now + holdMs(o, this.rng());
        ev.push({ type: 'steady' });
      } else if (now - this.setAt >= o.setLimitMs) {
        // the starter never fires on a field that will not settle: everyone stands up, no penalty
        this.phase = 'marks'; this.t0 = now;
        ev.push({ type: 'unsteady' });
      }
    }
    if (this.phase === 'hold') {
      const moved = earliest(onsetAt, keyAt, this.steadyAt);
      if (moved != null && moved < this.fireAt) {
        finish({ type: 'false-start', reason: 'before-gun', ms: null });
      } else if (now >= this.fireAt) {
        this.phase = 'fired'; this.gunAt = now;
        ev.push({ type: 'fire' });
      }
    }
    if (this.phase === 'fired') {
      const moved = earliest(onsetAt, keyAt, this.steadyAt);
      if (moved != null) {
        const ms = moved - this.gunAt;
        if (ms < FALSE_START_MS) finish({ type: 'false-start', reason: ms < 0 ? 'before-gun' : 'too-fast', ms });
        else finish({ type: 'reaction', ms });
      } else if (now - this.gunAt >= o.noStartMs) {
        finish({ type: 'no-start', ms: null });
      }
    }
    return ev;
  }
}

/** The wait between "steady" and the gun for a random number u in [0, 1). */
export function holdMs(o, u) {
  const extra = -o.holdMeanMs * Math.log(1 - Math.min(0.999999, Math.max(0, u)));
  return Math.min(o.holdMaxMs, o.holdMinMs + extra);
}

function earliest(a, b, since) {
  let best = null;
  for (const v of [a, b]) if (v != null && v >= since && (best == null || v < best)) best = v;
  return best;
}

/** Reaction time in ms -> a grade for the result screen. Boundaries are in ms. */
export const REACTION_GRADES = [
  { below: 130, grade: 'S', en: 'WORLD CLASS', ja: '世界の決勝レベル' },
  { below: 160, grade: 'A', en: 'ELITE', ja: 'トップ選手なみ' },
  { below: 200, grade: 'B', en: 'SHARP', ja: 'するどい反応' },
  { below: 260, grade: 'C', en: 'GOOD', ja: 'いいスタート' },
  { below: 350, grade: 'D', en: 'OK', ja: 'もう少し' },
  { below: Infinity, grade: 'E', en: 'LATE', ja: '出遅れ' },
];
export function gradeReaction(ms) {
  if (!Number.isFinite(ms) || ms < FALSE_START_MS) return null;
  return REACTION_GRADES.find((g) => ms < g.below);
}
/** 142.4 -> "0.142" (truncated to the millisecond, as timing systems do). */
export function formatReaction(ms) {
  if (!Number.isFinite(ms)) return '-.---';
  const v = Math.floor(Math.abs(ms)) / 1000;
  return (ms < 0 ? '-' : '') + v.toFixed(3);
}
