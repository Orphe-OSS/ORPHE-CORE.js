// game.js — the ping-pong rules as a plain simulation (no rendering, no DOM, no imports).
//
// The court is the table top seen from above:
//   x: along the table, -paddleX (player 0, left) .. +paddleX (player 1, right)
//   y: across the table, -halfW (near the camera) .. +halfW (far side); + is "up" for the players
//   z: height above the table top (cosmetic: the ball is steered in x/y like Pong and
//      only drawn hopping over the net and bouncing once on the far half)
// Units are metres and seconds. main.js feeds paddle commands in, steps the
// simulation at a fixed rate and drains `events` to drive graphics, sound and logs.

export const COURT = {
  halfL: 1.37,       // table half length
  halfW: 0.85,       // table half width (a little deeper than a real table so the paddles travel further on screen)
  paddleX: 1.43,     // paddle planes sit just past the end lines
  netH: 0.1525,
  tableH: 0.76,      // table top above the floor
  hitH: 0.17,        // height at which paddles meet the ball
};

export const CPU_LEVELS = [
  // speed: paddle m/s, react: seconds before it starts moving, err: aim spread as a share of its reach,
  // miss: chance to misjudge a ball completely, smash: chance to smash a ball it reaches
  { key: 'yasashii', label: 'やさしい', name: '番頭さん', speed: 0.85, react: 0.5, err: 0.7, miss: 0.3, smash: 0 },
  { key: 'futsuu', label: 'ふつう', name: '女将さん', speed: 1.5, react: 0.32, err: 0.55, miss: 0.16, smash: 0.06 },
  { key: 'tsuyoi', label: 'つよい', name: '卓球名人', speed: 2.6, react: 0.18, err: 0.4, miss: 0.07, smash: 0.2 },
];
/** The two CPUs of the title screen's exhibition rally. */
const ATTRACT_LEVEL = { key: 'attract', label: '', name: '', speed: 2.2, react: 0.2, err: 0.6, miss: 0.035, smash: 0.1 };

export const ITEM_TYPES = {
  mikan: { key: 'mikan', label: 'みかん', effect: 'でかラケット', seconds: 12 },
  dango: { key: 'dango', label: 'おだんご', effect: 'ゆっくり球', seconds: 9 },
  take: { key: 'take', label: '竹がき', effect: 'いちどだけ守る', seconds: 0 },
};

/** Rally lengths that get a celebration. */
export const MILESTONES = [5, 10, 15, 20, 30, 40, 50, 75, 100];

/**
 * How quickly a rally speeds up, by the 0..4 "rally pace" setting. `rate` is the gain per
 * return as a share of the starting speed, `max` the ceiling the ball stops at. Step 1 is
 * the pace of the first release; play-testing found it slow to build, so the default is step 2.
 */
export const RALLY_PACES = [
  { key: 'off', label: 'なし', rate: 0, max: 1 },
  { key: 'gentle', label: 'ゆっくり', rate: 0.045, max: 1.63 },
  { key: 'normal', label: 'ふつう', rate: 0.08, max: 2.1 },
  { key: 'fast', label: 'はやい', rate: 0.12, max: 2.6 },
  { key: 'fastest', label: '超はやい', rate: 0.17, max: 3.0 },
];
export const DEFAULT_RALLY_PACE = 2;
const SMASH_BOOST = 1.3;
const SMASH_PADDLE_SPEED = 1.5;  // m/s across the table at contact
const MAX_ANGLE = (50 * Math.PI) / 180;
const SLOW_FACTOR = 0.7;
const BIG_FACTOR = 1.5;
const SERVE_DELAY = 1.5;
const DEAD_SECONDS = 1.7;
const GRAVITY = 7.5;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Small deterministic RNG so a match can be replayed in tests. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where a ball at (x, y) moving with (vx, vy) crosses the line x = targetX, with the side rails folding y back. */
export function predictY(x, y, vx, vy, targetX, wall) {
  if (!(Math.abs(vx) > 1e-6)) return y;
  const t = (targetX - x) / vx;
  if (t <= 0) return y;
  const span = 2 * wall;
  let u = (y + vy * t + wall) % (2 * span);
  if (u < 0) u += 2 * span;
  return (u > span ? 2 * span - u : u) - wall;
}

/** Ball speed (m/s) for the 1..10 speed setting: 4 crosses the table in about 4.3 s, like the original default. */
export function ballSpeedFor(setting) {
  const crossSeconds = 6.4 * (0.875 ** (clamp(setting, 1, 10) - 1));
  return (2 * COURT.paddleX) / crossSeconds;
}

/** Ball radius (m) for the 1..5 size setting. */
export function ballRadiusFor(setting) { return 0.028 + 0.008 * (clamp(setting, 1, 5) - 1); }

/** Paddle half length (m) for the 1..5 size setting. */
export function paddleHalfFor(setting) { return 0.11 + 0.04 * (clamp(setting, 1, 5) - 1); }

/** Simulation config fields for a rally pace setting (see RALLY_PACES); out-of-range values are clamped. */
export function rallyPaceFor(setting) {
  const index = Number.isFinite(setting) ? clamp(Math.round(setting), 0, RALLY_PACES.length - 1) : DEFAULT_RALLY_PACE;
  return { accelRate: RALLY_PACES[index].rate, accelMax: RALLY_PACES[index].max };
}

/** Rally goal of the co-op mode for a "points" setting. */
export function coopGoalFor(points) { return points * 6; }

export class PongSim {
  /**
   * @param {object} cfg
   * @param {'vs'|'solo'|'coop'|'attract'} cfg.mode
   * @param {number} cfg.pointsToWin
   * @param {number} cfg.ballSpeed - m/s at the start of a rally
   * @param {number} cfg.ballRadius
   * @param {number[]} cfg.paddleHalf - per side
   * @param {number} cfg.accelRate - speed gain per return in a rally, as a share of ballSpeed (see rallyPaceFor)
   * @param {number} cfg.accelMax - ceiling of that speed-up, as a multiple of ballSpeed
   * @param {boolean} cfg.items
   * @param {number[]} cfg.assist - per side 0..1, how strongly the paddle is pulled to the ball
   * @param {(number|null)[]} cfg.cpu - per side CPU level index, or null for a human
   * @param {number} [cfg.seed]
   */
  constructor(cfg = {}) {
    this.cfg = {
      mode: 'vs', pointsToWin: 5, ballSpeed: ballSpeedFor(4), ballRadius: ballRadiusFor(2),
      paddleHalf: [paddleHalfFor(3), paddleHalfFor(3)], ...rallyPaceFor(DEFAULT_RALLY_PACE), items: true,
      assist: [0, 0], cpu: [null, null], coopLives: 3, seed: (Math.random() * 2 ** 32) >>> 0,
      ...cfg,
    };
    this.rand = mulberry32(this.cfg.seed);
    this.events = [];
    this.t = 0;
    this.phase = 'ready';     // ready | serve | rally | dead | over
    this.score = [0, 0];
    this.rally = 0;
    this.bestRally = 0;
    this.totalHits = 0;
    this.lives = this.cfg.coopLives;
    this.coopGoal = coopGoalFor(this.cfg.pointsToWin);
    this.server = 0;
    this.winner = null;
    this.slowUntil = -1;
    this.items = [];
    this._itemId = 0;
    this._nextItemAt = 8;
    this._phaseT = 0;
    this._pendingOver = false;
    this._goalReached = false;
    this.paddles = [0, 1].map((side) => ({
      side, y: 0, vy: 0, cmd: 0, cmdY: 0,
      baseHalf: this.cfg.paddleHalf[side], half: this.cfg.paddleHalf[side],
      bigUntil: -1, guard: false,
      cpu: this.cfg.cpu[side] === null || this.cfg.cpu[side] === undefined ? null : { level: this.cfg.mode === 'attract' ? ATTRACT_LEVEL : CPU_LEVELS[this.cfg.cpu[side]], target: 0, reactAt: 0, aimed: true },
    }));
    this.ball = {
      x: 0, y: 0, z: COURT.hitH, vx: 0, vy: 0, vz: 0, speed: 0, r: this.cfg.ballRadius,
      state: 'hidden',        // hidden | held | live | dead
      lastHitBy: null, smash: false, seg: null, spin: 0,
    };
  }

  get wall() { return COURT.halfW - this.ball.r; }
  /** Largest |y| a paddle centre can reach. */
  travel(side) { return Math.max(0.01, COURT.halfW - this.paddles[side].half); }
  isCpu(side) { return !!this.paddles[side].cpu; }

  /** Paddle command of a human player, -1 (near) .. +1 (far). */
  setInput(side, cmd) { this.paddles[side].cmd = clamp(cmd, -1, 1); }

  emit(type, data = {}) { this.events.push({ ...data, type, t: this.t }); }
  drain() { const out = this.events; this.events = []; return out; }

  startMatch(firstServer = this.rand() < 0.5 ? 0 : 1) {
    this.score = [0, 0]; this.rally = 0; this.bestRally = 0; this.totalHits = 0;
    this.lives = this.cfg.coopLives; this.winner = null; this.slowUntil = -1;
    this.items = []; this._nextItemAt = this.t + 8 + this.rand() * 4; this._pendingOver = false; this._goalReached = false;
    for (const p of this.paddles) { p.bigUntil = -1; p.guard = false; p.half = p.baseHalf; }
    this.emit('start', { server: firstServer });
    this._beginServe(firstServer, 1.0);
  }

  _beginServe(server, delay = SERVE_DELAY) {
    this.server = server;
    this.phase = 'serve';
    this._phaseT = delay;
    this.rally = 0;
    const b = this.ball;
    b.state = 'held'; b.vx = 0; b.vy = 0; b.vz = 0; b.smash = false; b.lastHitBy = null; b.seg = null;
    this._holdBall();
    this.emit('serve-ready', { server });
  }

  _holdBall() {
    const b = this.ball, p = this.paddles[this.server];
    const dir = this.server === 0 ? 1 : -1;
    b.x = -dir * COURT.paddleX + dir * 0.09;
    b.y = clamp(p.y, -this.wall, this.wall);
    b.z = COURT.hitH;
  }

  _baseSpeed() {
    let s = this.cfg.ballSpeed;
    // (?? so a config that names only one of the two fields cannot turn the speed into NaN)
    s *= Math.min(this.cfg.accelMax ?? 1, 1 + (this.cfg.accelRate ?? 0) * this.rally);
    if (this.t < this.slowUntil) s *= SLOW_FACTOR;
    return s;
  }

  /** Send the ball from `side`'s paddle plane at `angle` (radians, + = towards the far rail). */
  _launch(side, angle, smash) {
    const b = this.ball;
    const dir = side === 0 ? 1 : -1;
    const speed = this._baseSpeed() * (smash ? SMASH_BOOST : 1);
    b.speed = speed;
    b.vx = dir * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    b.state = 'live';
    b.lastHitBy = side;
    b.smash = smash;
    // the hop: over the net, one bounce on the far half, then up to the other paddle
    const xs = b.x, xe = dir * COURT.paddleX;
    const ub = 0.62 + this.rand() * 0.16;
    const sNet = clamp(((0 - xs) / (xe - xs)) / ub, 0.05, 0.95);
    const clear = COURT.netH + b.r + 0.06;
    const arch = Math.max(0.2, (clear - COURT.hitH * (1 - sNet)) / (4 * sNet * (1 - sNet)));
    b.seg = { xs, xe, ub, arch: smash ? arch * 0.9 : arch, bounced: false };
    const receiver = 1 - side;
    const targetY = predictY(b.x, b.y, b.vx, b.vy, xe, this.wall);
    this.emit('incoming', { side: receiver, targetY, target: clamp(targetY / this.travel(receiver), -1, 1), eta: Math.abs((xe - xs) / b.vx) });
    const cpu = this.paddles[receiver].cpu;
    if (cpu) { cpu.reactAt = this.t + cpu.level.react * (0.7 + 0.6 * this.rand()); cpu.aimed = false; }
  }

  _height(u) {
    const seg = this.ball.seg;
    if (u < seg.ub) {
      const s = u / seg.ub;
      return COURT.hitH * (1 - s) + 4 * seg.arch * s * (1 - s);
    }
    const k = (u - seg.ub) / (1 - seg.ub);
    return Math.max(0, COURT.hitH * (2 * k - k * k));
  }

  step(dt) {
    this.t += dt;
    this._stepPaddles(dt);
    if (this.phase === 'serve') {
      this._holdBall();
      this._phaseT -= dt;
      if (this._phaseT <= 0) {
        const aim = clamp(-this.ball.y / COURT.halfW, -1, 1) * 0.3 + (this.rand() - 0.5) * 0.45;
        this.phase = 'rally';
        this._launch(this.server, aim, false);
        this.emit('serve', { server: this.server });
      }
    } else if (this.phase === 'rally') {
      this._stepBall(dt);
      this._stepItems(dt);
    } else if (this.phase === 'dead') {
      this._stepDeadBall(dt);
      this._phaseT -= dt;
      if (this._phaseT <= 0) {
        if (this._pendingOver) {
          this.phase = 'over';
          this.ball.state = 'hidden';
          this.emit('over', { winner: this.winner, score: this.score.slice(), bestRally: this.bestRally, totalHits: this.totalHits });
        } else {
          this._beginServe(this._nextServer);
        }
      }
    }
    this._expireEffects();
  }

  _stepPaddles(dt) {
    const b = this.ball;
    for (const p of this.paddles) {
      const travel = this.travel(p.side);
      const prevY = p.y;
      if (p.cpu) {
        this._stepCpu(p, dt);
      } else {
        p.cmdY = p.cmd * travel;
        let y = p.cmdY;
        const assist = this.cfg.assist[p.side] || 0;
        const dir = p.side === 0 ? -1 : 1;   // the ball comes towards this player when vx has this sign
        if (assist > 0 && b.state === 'live' && Math.sign(b.vx) === dir) {
          // pull grows as the ball crosses this player's half
          const planeX = dir * COURT.paddleX;
          const near = clamp(1 - Math.abs(planeX - b.x) / COURT.paddleX, 0, 1);
          const pull = assist * near * near * (3 - 2 * near);
          y += (clamp(predictY(b.x, b.y, b.vx, b.vy, planeX, this.wall), -travel, travel) - y) * pull;
        }
        p.y = clamp(y, -travel, travel);
      }
      const v = dt > 0 ? (p.y - prevY) / dt : 0;
      p.vy += clamp(dt / 0.06, 0, 1) * (v - p.vy);
    }
  }

  _stepCpu(p, dt) {
    const b = this.ball, cpu = p.cpu;
    const travel = this.travel(p.side);
    const dir = p.side === 0 ? -1 : 1;
    const coming = b.state === 'live' && Math.sign(b.vx) === dir;
    if (coming) {
      if (!cpu.aimed && this.t >= cpu.reactAt) {
        // a CPU in the lead gets sloppier, one that is behind sharpens up: close games are more fun
        const lead = this.score[p.side] - this.score[1 - p.side];
        const whiff = this.rand() < cpu.level.miss * clamp(1 + 0.4 * lead, 0.5, 2.5);
        const reach = p.half + b.r;
        const sign = this.rand() < 0.5 ? -1 : 1;
        let off = whiff ? sign * (1.2 + 0.5 * this.rand()) : (this.rand() * 2 - 1) * cpu.level.err;
        const arrival = predictY(b.x, b.y, b.vx, b.vy, dir * COURT.paddleX, this.wall);
        // next to a rail the paddle cannot get far enough from the ball on that side: misjudge towards the open side
        if (whiff && Math.abs(clamp(arrival + off * reach, -travel, travel) - arrival) < reach * 1.1) off = -off;
        cpu.target = arrival + off * reach;
        cpu.aimed = true;
      }
    } else if (this.phase === 'serve' && this.server === p.side) {
      // wander a little so serves start from different places
      if (!cpu.aimed) { cpu.target = (this.rand() * 2 - 1) * travel * 0.6; cpu.aimed = true; }
    } else {
      cpu.target *= Math.exp(-dt * 0.8);
      if (this.phase !== 'serve') cpu.aimed = false;
    }
    const want = clamp(cpu.target, -travel, travel);
    const maxStep = cpu.level.speed * dt;
    p.y += clamp(want - p.y, -maxStep, maxStep);
    p.cmdY = p.y;
    p.cmd = p.y / travel;
  }

  _stepBall(dt) {
    const b = this.ball;
    const wall = this.wall;
    const prevX = b.x;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += b.speed * dt * 9;
    if (b.y > wall) { b.y = 2 * wall - b.y; b.vy = -Math.abs(b.vy); this.emit('wall', { x: b.x, y: wall, far: true }); }
    else if (b.y < -wall) { b.y = -2 * wall - b.y; b.vy = Math.abs(b.vy); this.emit('wall', { x: b.x, y: -wall, far: false }); }

    const seg = b.seg;
    const u = (b.x - seg.xs) / (seg.xe - seg.xs);
    if (!seg.bounced && u >= seg.ub) { seg.bounced = true; this.emit('bounce', { x: b.x, y: b.y, speed: b.speed }); }
    b.z = this._height(u);

    const side = b.vx > 0 ? 1 : 0;
    const planeX = side === 1 ? COURT.paddleX : -COURT.paddleX;
    const crossed = side === 1 ? (prevX < planeX && b.x >= planeX) : (prevX > planeX && b.x <= planeX);
    if (!crossed) return;

    const p = this.paddles[side];
    const reach = p.half + b.r * 0.85;
    const dy = b.y - p.y;
    const rawOffset = (b.y - p.cmdY) / reach;   // against the player's own command, before any assist
    if (Math.abs(dy) <= reach) {
      b.x = planeX;
      const offset = clamp(dy / reach, -1, 1);
      const human = !p.cpu;
      const smash = human ? Math.abs(p.vy) > SMASH_PADDLE_SPEED : this.rand() < p.cpu.level.smash;
      const angle = clamp(offset * MAX_ANGLE * 0.92 + clamp(p.vy * 0.1, -0.2, 0.2), -MAX_ANGLE, MAX_ANGLE);
      this.rally++;
      this.totalHits++;
      if (this.rally > this.bestRally) this.bestRally = this.rally;
      this._launch(side, angle, smash);
      this.emit('hit', { side, offset, rawOffset, smash, speed: b.speed, rally: this.rally, y: b.y, paddleV: p.vy });
      if (MILESTONES.includes(this.rally)) this.emit('milestone', { rally: this.rally });
      if (this.cfg.mode === 'coop' && this.totalHits >= this.coopGoal && !this._pendingOver) this._coopCleared();
    } else if (p.guard) {
      p.guard = false;
      b.x = planeX;
      const angle = Math.atan2(b.vy, Math.abs(b.vx));
      this._launch(side, clamp(angle, -MAX_ANGLE, MAX_ANGLE), false);
      this.emit('guard', { side, y: b.y });
    } else {
      this._miss(side, rawOffset);
    }
  }

  _coopCleared() {
    // the goal is reached: let this rally play on, the match ends when it does
    this.emit('goal', { totalHits: this.totalHits });
    this._goalReached = true;
  }

  _miss(side, rawOffset) {
    const b = this.ball;
    const scorer = 1 - side;
    b.state = 'dead';
    // keep flying: derive the vertical speed from the hop the ball was on
    b.vz = 0.4;
    this.phase = 'dead';
    this._phaseT = DEAD_SECONDS;
    this._nextServer = side;
    const rally = this.rally;
    let final = false;
    if (this.cfg.mode === 'coop') {
      this.lives--;
      if (this.lives <= 0 || this._goalReached) { final = true; this.winner = this._goalReached ? 'both' : null; }
    } else if (this.cfg.mode !== 'attract') {
      this.score[scorer]++;
      if (this.score[scorer] >= this.cfg.pointsToWin) { final = true; this.winner = scorer; }
    }
    this._pendingOver = final;
    if (final) this._phaseT = DEAD_SECONDS + 0.9;
    const matchPoint = !final && this.cfg.mode !== 'coop' && this.cfg.mode !== 'attract'
      ? [0, 1].filter((s) => this.score[s] === this.cfg.pointsToWin - 1) : [];
    this.emit('miss', { side, rawOffset, y: b.y });
    this.emit('point', { scorer, loser: side, score: this.score.slice(), rally, final, lives: this.lives, matchPoint });
  }

  _stepDeadBall(dt) {
    const b = this.ball;
    if (b.state !== 'dead') return;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vz -= GRAVITY * dt;
    b.z += b.vz * dt;
    b.spin += b.speed * dt * 6;
    const floor = -COURT.tableH;   // z is the height of the ball's lowest point above the table top
    if (b.z < floor) {
      b.z = floor;
      if (Math.abs(b.vz) > 0.5) this.emit('floor', { x: b.x, y: b.y, speed: Math.abs(b.vz) });
      b.vz = Math.abs(b.vz) * 0.62;
      b.vx *= 0.72; b.vy *= 0.72;
      if (b.vz < 0.35) b.vz = 0;
    }
  }

  _stepItems() {
    if (!this.cfg.items || this.cfg.mode === 'attract') return;
    const b = this.ball;
    if (this.t >= this._nextItemAt && this.items.length < 1) {
      const keys = Object.keys(ITEM_TYPES);
      const type = keys[Math.floor(this.rand() * keys.length)];
      const item = {
        id: ++this._itemId, type,
        x: (this.rand() < 0.5 ? -1 : 1) * (0.3 + this.rand() * 0.5),
        y: (this.rand() * 2 - 1) * COURT.halfW * 0.62,
        born: this.t, until: this.t + 11,
      };
      this.items.push(item);
      this._nextItemAt = this.t + 13 + this.rand() * 7;
      this.emit('item-spawn', { item });
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (this.t > item.until) { this.items.splice(i, 1); this.emit('item-gone', { item }); continue; }
      if (b.state !== 'live' || b.lastHitBy === null) continue;
      if (Math.hypot(b.x - item.x, b.y - item.y) > 0.17 + b.r) continue;
      this.items.splice(i, 1);
      const side = b.lastHitBy;
      const p = this.paddles[side];
      if (item.type === 'mikan') {
        p.bigUntil = this.t + ITEM_TYPES.mikan.seconds;
        p.half = Math.min(p.baseHalf * BIG_FACTOR, COURT.halfW * 0.6);
      } else if (item.type === 'dango') {
        if (!(this.t < this.slowUntil)) { b.vx *= SLOW_FACTOR; b.vy *= SLOW_FACTOR; b.speed *= SLOW_FACTOR; }
        this.slowUntil = this.t + ITEM_TYPES.dango.seconds;
      } else if (item.type === 'take') {
        p.guard = true;
      }
      this.emit('item-get', { item, side });
    }
  }

  _expireEffects() {
    for (const p of this.paddles) {
      if (p.bigUntil > 0 && this.t >= p.bigUntil) { p.bigUntil = -1; p.half = p.baseHalf; this.emit('item-end', { effect: 'mikan', side: p.side }); }
    }
    if (this.slowUntil > 0 && this.t >= this.slowUntil) { this.slowUntil = -1; this.emit('item-end', { effect: 'dango', side: null }); }
  }
}
