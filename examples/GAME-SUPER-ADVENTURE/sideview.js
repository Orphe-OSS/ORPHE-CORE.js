// sideview.js — the same course, seen from the side.
//
// The main view runs into the screen; this strip shows what a side-scrolling
// game would show: blocks of earth with grass on top, holes, coins, what is
// waiting ahead, and the runner as a little pixel character. It is drawn from
// the simulation every frame, so the two views are always the same world.
import { RULES, enemyS, hammerState, bridgeLit, bridgeState } from './rules.js';
import { PALETTES } from './world.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// ---- pixel art. One character per pixel; '.' is empty. All of it is this game's own.
// The runner is ORPHE-kun, as in the company's line drawing: a cap, black hair at the back, big
// eyes, a T-shirt, hatched shorts, sneakers. White with black: the outline is added when drawn.
const RUNNER_COLORS = { W: '#ffffff', K: '#17171c', G: '#8a8a92' };
const TOP = [
  '....WWWWW...',
  '...WWWWWWW..',
  '...WWWWWWWWW',     // the cap, and its peak
  '..KKKKKKKKKK',
  '..KKWWWKWW..',     // hair, an eye
  '...KWWWWWW..',
  '....WWWKW...',     // a smile
];
const TORSO = {
  // arms: back and forth in a run, both up in a jump
  a: ['...WWWWW....', '..WWWWWWWW..', '.WWWWWWW.WW.', '.W.WWWWW....', '...GWGWG....'],
  b: ['...WWWWW....', '..WWWWWWW...', '..WWWWWWW...', '...WWWWWW...', '...WGWGW....'],
  up: ['.W.WWWWW.W..', '.WWWWWWWWW..', '...WWWWW....', '...WWWWW....', '...GWGWG....'],
  still: ['...WWWWW....', '..WWWWWWW...', '..WWWWWWW...', '..WWWWWWW...', '...GWGWG....'],
};
const LEGS = {
  wide: ['..WGWGWGW...', '.GWG...GWG..', '.WW.....WW..', '.WW.....WW..', '.WW.....WW..', 'WWK....WWWK.'],
  pass: ['...GWGWGW...', '...WGWGWGW..', '....WW..WW..', '....WW.WW...', '....WW.WWK..', '...WWK......'],
  tuck: ['...GWGWGW...', '..GWGWGWGW..', '.WW....WWW..', 'WW.....WWWWK', 'WWK.........', '............'],
  stand: ['...GWGWG....', '...WG.GW....', '...WW.WW....', '...WW.WW....', '...WW.WW....', '..WWK.WWK...'],
};
const frame = (torso, legs) => [...TOP, ...TORSO[torso], ...legs];
const RUNNER_ROWS = TOP.length + 5 + 6;
const RUNNER = {
  stand: frame('still', LEGS.stand),
  run: [frame('a', LEGS.wide), frame('b', LEGS.pass), frame('b', LEGS.wide), frame('a', LEGS.pass)],
  jump: frame('up', LEGS.tuck),
};
// The creatures, in the same pen: W paper, K ink, G hatching.
const JELLY = ['...WW.WW..', '....KK....', '..WWWWWW..', '.WWWWWWWW.', '.WKKWWKKW.', '.WKKWWKKW.', '.WWWKKWWW.', '.WWWWWWWW.', '..KK..KK..'];
const DASHER = ['...KKKK...', '..KWWWWW..', '.WWWWWWWW.', '.KKKKKKKK.', '.KWWKKWWK.', '.WWWWWWWW.', '.WWKWKWWW.', '..WWWWWW..', '.KK....KK.'];
const SPIKE = ['W..W..W..W', '.W.WWWW.W.', 'WWGKGKGKWW', '.GKGKGKGK.', '.KWWGKWWG.', '.GKGKKGKG.', '..KGKGKG..', '..KK..KK..'];
const COIN = ['.OO.', 'OYYO', 'OYOO', 'OYYO', '.OO.'];

function sprite(g, rows, colors, x, y, scale) {
  // x: centre, y: bottom
  const w = rows[0].length, left = Math.round(x - (w * scale) / 2), top = Math.round(y - rows.length * scale);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < w; c++) {
      const color = colors[row[c]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(left + c * scale, top + r * scale, scale, scale);
    }
  }
}
/** The same sprite with a dark edge all round: readable against any background. */
function outlined(g, rows, colors, x, y, scale, edge = '#17171c') {
  const dark = {};
  for (const k of Object.keys(colors)) dark[k] = edge;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sprite(g, rows, dark, x + dx * scale * 0.5, y + dy * scale * 0.5, scale);
  sprite(g, rows, colors, x, y, scale);
}

export function createSideView(canvas, level) {
  const g = canvas.getContext('2d');
  const BEHIND = 5, AHEAD = 26;          // metres shown behind / ahead of the runner
  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(50, Math.round(r.width)); H = Math.max(30, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
  }
  resize();
  window.addEventListener('resize', resize);

  const zoneAt = (s) => { let z = 0; for (let i = 0; i < level.zones.length; i++) if (s >= level.zones[i].s) z = i; return z; };
  let camY = 0;

  function draw(sim, time) {
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(canvas.getBoundingClientRect().height * dpr)) resize();
    const p = sim.p;
    const px = W / (BEHIND + AHEAD);          // pixels per metre along the course
    const py = px * 0.9;                      // and up
    const unit = Math.max(2, Math.ceil((RULES.HEAD * py) / RUNNER_ROWS));   // one sprite pixel (rounded up: the characters are a little larger than life)
    // the camera follows the ground, not every jump (but it does follow a springboard up to the upper road)
    camY += ((p.ground ? p.y : p.spring ? Math.max(p.airFromY, p.y - 2.5) : p.airFromY) - camY) * 0.08;
    const X = (s) => Math.round((s - p.s + BEHIND) * px);
    const Y = (y) => Math.round(H * 0.8 - (y - camY) * py);
    const s0 = p.s - BEHIND - 2, s1 = p.s + AHEAD + 2;
    const P = PALETTES[level.zones[zoneAt(p.s)].palette];
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    // sky, clouds and hills (they drift by more slowly than the road: far away)
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, hex(P.top)); sky.addColorStop(1, hex(P.horizon));
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 137 - p.s * px * 0.2) % (W + 80) + W + 80) % (W + 80) - 40, cy = 10 + (i * 37) % 26;
      g.fillRect(cx, cy, 30, 6); g.fillRect(cx + 6, cy - 5, 16, 5);
    }
    g.fillStyle = hex(P.hill);
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 171 - p.s * px * 0.45) % (W + 200) + W + 200) % (W + 200) - 100, r = 34 + (i * 23) % 30;
      g.beginPath(); g.arc(cx, H + 4, r, Math.PI, 0); g.fill();
    }
    // water at the bottom of every hole
    g.fillStyle = hex(P.water); g.fillRect(0, H - 7, W, 7);

    const mark = (a, b, h, color) => { if (b < s0 || a > s1) return; g.fillStyle = color; g.fillRect(X(a), Y(h) - 4, X(b) - X(a), 3); };
    // ground: earth with grass on top
    for (const pl of level.platforms) {
      if (pl.b < s0 || pl.a > s1) continue;
      const x = X(pl.a), w = X(pl.b) - x, y = Y(pl.h);
      if (pl.kind === 'ground') {
        g.fillStyle = pl.belt ? '#3a3f4a' : hex(P.dirt);
        g.fillRect(x, y, w, H - y);
        g.fillStyle = hex(P.dirtDark);
        for (let yy = y + 11; yy < H; yy += 10) g.fillRect(x, yy, w, 1);
        g.fillStyle = pl.belt ? '#ffb020' : pl.finale ? '#f0d9a0' : hex(P.grass);
        g.fillRect(x, y, w, 5);
        if (pl.belt) { const off = ((time * 2) % 1.2) * px; for (let bx = x + w - off; bx > x; bx -= 1.2 * px) { g.beginPath(); g.moveTo(bx, y + 6); g.lineTo(bx + 6, y + 11); g.lineTo(bx, y + 16); g.fill(); } }
      } else {
        g.fillStyle = hex(P.dirt); g.fillRect(x, y, w, Math.max(4, pl.thick * py));
        g.fillStyle = hex(P.dirtDark); g.fillRect(x, y + Math.max(4, pl.thick * py) - 1, w, 1);
      }
    }
    // runways and slow stretches: a coloured line along the top of the ground
    for (const gp of level.gaps || []) {
      if (gp.dash) mark(Math.max(gp.from.a + 2.6, gp.a - gp.runup - 7), gp.a, gp.h, '#2f8bff');
      else if (gp.slow) mark(Math.max(gp.from.a, gp.a - 9), gp.a, gp.h, '#ffd21f');
    }
    for (const z of level.slowZones || []) mark(z.a, z.b, z.h, '#ffd21f');
    for (const pl of sim.assists) {
      const grad = g.createLinearGradient(X(pl.a), 0, X(pl.b), 0);
      grad.addColorStop(0, '#ff5a5a'); grad.addColorStop(0.5, '#ffe14a'); grad.addColorStop(1, '#5ad7ff');
      g.fillStyle = grad; g.fillRect(X(pl.a), Y(pl.h), X(pl.b) - X(pl.a), 5);
    }
    for (const br of level.bridges) {
      if (br.b < s0 || br.a > s1) continue;
      const lit = bridgeLit(sim, br), st = bridgeState(br, sim.t);
      g.globalAlpha = lit ? (st.warn && !sim.steady.has(br.id) && Math.sin(time * 26) < 0 ? 0.4 : 1) : 0.25;
      g.fillStyle = hex(P.accent);
      g.fillRect(X(br.a), Y(br.h), X(br.b) - X(br.a), 5);
      g.globalAlpha = 1;
    }
    // springboards
    for (const sp of level.springs) {
      if (sp.b < s0 || sp.a > s1) continue;
      g.fillStyle = '#d8dde6'; g.fillRect(X(sp.a) + 3, Y(sp.h) - 4, X(sp.b) - X(sp.a) - 6, 4);
      g.fillStyle = '#e0302a'; g.fillRect(X(sp.a), Y(sp.h) - 7, X(sp.b) - X(sp.a), 3);
    }
    // checkpoints (the ones that count in this mode) and the goal: flags
    const cps = sim.cps || level.checkpoints;
    cps.forEach((cp, i) => {
      if (cp.s < s0 || cp.s > s1) return;
      const x = X(cp.s), top = Y(cp.y + 3.4);
      g.fillStyle = '#0a1c5c'; g.fillRect(x - 1, top - 1, 4, Y(cp.y) - top + 1);
      g.fillStyle = '#fff'; g.fillRect(x, top, 2, Y(cp.y) - top);
      g.fillStyle = p.cp >= i ? '#35e06a' : '#ff9a1a';
      g.beginPath(); g.moveTo(x + 2, top); g.lineTo(x + 14, top + 6); g.lineTo(x + 2, top + 12); g.fill();
    });
    if (level.goal > s0 && level.goal < s1) {
      const gy = level.finale ? level.finale.landH : 0, x = X(level.goal), top = Y(gy + 4.2);
      g.fillStyle = '#fff'; g.fillRect(x, top, 2, Y(gy) - top);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#18181c'; g.fillRect(x + 2 + i * 5, top + j * 5, 5, 5); }
    }
    // coins
    const coinColors = { O: '#b3650c', Y: '#ffd21f' };
    for (const n of level.notes) {
      if (n.s < s0) continue;
      if (n.s > s1) break;
      if (!sim.gone.has(n.id)) sprite(g, COIN, coinColors, X(n.s), Y(n.y) + 4, 1.6);
    }
    // coin blocks
    for (const b of level.bells) {
      if (b.s < s0 || b.s > s1 || sim.gone.has(b.id)) continue;
      const r = Math.round((b.fever ? 0.52 : 0.4) * px), x = X(b.s), y = Y(b.y) - r * 2;
      g.fillStyle = '#7a4208'; g.fillRect(x - r - 1, y - 1, r * 2 + 2, r * 2 + 2);
      g.fillStyle = b.fever ? `hsl(${(time * 300) % 360} 100% 60%)` : '#f7a81c'; g.fillRect(x - r, y, r * 2, r * 2);
      g.fillStyle = '#fff3b0'; g.fillRect(x - 2, y + r - 3, 4, 6);
    }
    // hammers
    for (const hm of level.hammers) {
      if (hm.b < s0 || hm.a > s1) continue;
      const st = hammerState(hm, sim.t);
      const x = X(hm.a), w = X(hm.b) - x, y = Y(hm.h + st.sole), hgt = Math.round(1.6 * py);
      g.fillStyle = '#4a4f5a'; g.fillRect(x + w / 2 - 1, 0, 3, Math.max(0, y - hgt));
      g.fillStyle = '#5e6470'; g.fillRect(x - 1, y - hgt - 1, w + 2, hgt + 1);
      g.fillStyle = '#9aa1ae'; g.fillRect(x, y - hgt, w, hgt - 4);
      g.fillStyle = st.state === 'warn' && Math.sin(time * 30) > 0 ? '#ffffff' : '#e0302a'; g.fillRect(x, y - 4, w, 4);
    }
    // creatures
    for (const en of level.enemies) {
      if (sim.gone.has(en.id)) continue;
      const es = enemyS(en, sim.t);
      if (es < s0 || es > s1) continue;
      const x = X(es), y = Y(en.h);
      if (en.type === 'jelly') {
        const hop = Math.round(2 * Math.abs(Math.sin(sim.t * Math.PI / RULES.BEAT / 2 + en.a)));
        outlined(g, JELLY, RUNNER_COLORS, x, y - hop, unit);
      } else if (en.type === 'dasher') {
        outlined(g, DASHER, RUNNER_COLORS, x, y - (Math.sin(time * 22) > 0 ? 1 : 0), unit);
      } else {
        outlined(g, SPIKE, RUNNER_COLORS, x, y, unit);
      }
    }
    // the runner
    {
      const x = X(p.s), y = Y(p.y);
      const blink = p.invuln > 0 && Math.sin(time * 40) > 0;
      if (!blink) {
        const dash = p.vs >= RULES.DASH_SPEED;
        if (dash || p.fever > 0) { g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 3; i++) g.fillRect(x - 12 - unit * 6 - i * 7, y - unit * (5 + i * 4), (10 + i * 4) * (p.vs > RULES.OVER_SPEED ? 2 : 1), 2); }   // speed lines behind a dash
        let rows = RUNNER.stand;
        if (!p.ground) rows = RUNNER.jump;
        else if (p.vs > 0.4) rows = RUNNER.run[Math.floor(time * (5 + p.vs * 1.4)) % 4];
        const colors = p.fever > 0 ? { ...RUNNER_COLORS, W: `hsl(${(time * 500) % 360} 100% 78%)` } : RUNNER_COLORS;
        outlined(g, rows, colors, x, y, unit);
        // "you are here"
        const ty = y - unit * RUNNER_ROWS - 9 + Math.round(2 * Math.sin(time * 6));
        g.fillStyle = '#0a1c5c'; g.beginPath(); g.moveTo(x - 7, ty - 8); g.lineTo(x + 7, ty - 8); g.lineTo(x, ty + 2); g.fill();
        g.fillStyle = '#ffd21f'; g.beginPath(); g.moveTo(x - 5, ty - 7); g.lineTo(x + 5, ty - 7); g.lineTo(x, ty); g.fill();
      }
    }
    // progress along the whole course
    const barY = H - 5;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(8, barY - 1, W - 16, 4);
    for (const z of level.zones) { g.fillStyle = '#fff'; g.fillRect(8 + Math.round((W - 16) * z.s / level.goal), barY - 2, 1, 6); }
    for (const cp of cps) { g.fillStyle = '#ff9a1a'; g.fillRect(8 + Math.round((W - 16) * cp.s / level.goal) - 1, barY - 4, 3, 8); }
    g.fillStyle = '#ffd21f'; g.fillRect(8, barY, Math.round((W - 16) * Math.min(1, p.s / level.goal)), 2);
    g.fillStyle = '#fff'; g.fillRect(8 + Math.round((W - 16) * Math.min(1, p.s / level.goal)) - 2, barY - 3, 4, 8);
  }
  return { draw, resize };
}
