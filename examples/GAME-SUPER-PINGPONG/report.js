// report.js — the result sheet: one card per human player with the total score, rank,
// a radar of the six metrics (against the previous session), a meter list that carries
// the exact values, key figures, the tilt over time and one piece of advice.
import { METRIC_KEYS, METRIC_INFO, EXERCISES, adviceFor } from './analysis.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RING = 2 * Math.PI * 52;

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) el.append(c);
  return el;
}
function s(tag, attrs = {}, text = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== null) el.textContent = text;
  return el;
}
const fmtTime = (sec) => `${Math.floor(sec / 60)}分${String(Math.round(sec % 60)).padStart(2, '0')}秒`;
const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** The numbers behind a score, in plain words. */
export function detailFor(key, r) {
  const ex = EXERCISES[r.exercise];
  if (r.scores[key] === null) return (key === 'rom' || key === 'activity') && r.flags && r.flags.implausibleRange ? `角度が大きすぎるため採点していません（${r.rom.usedTotal.toFixed(0)}°）` : 'この試合では測れませんでした';
  switch (key) {
    case 'rom': return `${r.rom.usedTotal.toFixed(0)}°（${ex.up}${r.rom.usedUp.toFixed(0)}°${r.rom.usedDown >= 1.5 ? `・${ex.down}${r.rom.usedDown.toFixed(0)}°` : ''}）／めやす ${r.rom.target}°`;
    case 'activity': return `${r.activity.reps}回・毎分${r.activity.repsPerMin.toFixed(1)}回・合計 ${Math.round(r.activity.travelDeg)}°`;
    case 'smooth': return `指数 ${r.smooth.sparc.toFixed(2)}（-1.6 が理想）`;
    case 'accuracy': return `返球 ${r.accuracy.hits}/${r.accuracy.hits + r.accuracy.misses}球・まん中度 ${Math.round(r.accuracy.centering * 100)}%`;
    case 'reaction': return `動き出しまで 約${(r.reaction.medianMs / 1000).toFixed(2)}秒`;
    case 'endurance': return `後半の動きは 前半の${Math.round(r.endurance.ratio * 100)}%`;
    default: return '';
  }
}

function radar(result, previous, tip) {
  const W = 320, H = 286, cx = 160, cy = 146, R = 92;
  const n = METRIC_KEYS.length;
  const at = (i, k) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k]; };
  const poly = (values) => values.map((v, i) => at(i, Math.max(0.02, (v ?? 0) / 100)).map((c) => c.toFixed(1)).join(',')).join(' ');
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `6項目のレーダーチャート。総合 ${result.total} 点` });
  for (const k of [0.25, 0.5, 0.75, 1]) svg.append(s('polygon', { class: 'grid', points: poly(METRIC_KEYS.map(() => k * 100)) }));
  METRIC_KEYS.forEach((_, i) => { const [x, y] = at(i, 1); svg.append(s('line', { class: 'grid', x1: cx, y1: cy, x2: x.toFixed(1), y2: y.toFixed(1) })); });
  if (previous) svg.append(s('polygon', { class: 'prev-line', points: poly(METRIC_KEYS.map((key) => previous.scores[key])) }));
  svg.append(s('polygon', { class: 'now-area', points: poly(METRIC_KEYS.map((key) => result.scores[key])) }));
  METRIC_KEYS.forEach((key, i) => {
    const score = result.scores[key];
    const [x, y] = at(i, Math.max(0.02, (score ?? 0) / 100));
    svg.append(s('circle', { class: `dot${score === null ? ' none' : ''}`, cx: x.toFixed(1), cy: y.toFixed(1), r: 4.5 }));
    const [lx, ly] = at(i, 1.27);
    const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
    const dy = ly < cy - 40 ? -6 : ly > cy + 40 ? 8 : 0;
    svg.append(s('text', { class: 'axis-label', x: lx.toFixed(1), y: (ly + dy).toFixed(1), 'text-anchor': anchor }, METRIC_INFO[key].label));
    svg.append(s('text', { class: 'axis-value', x: lx.toFixed(1), y: (ly + dy + 16).toFixed(1), 'text-anchor': anchor }, score === null ? '—' : `${score}点`));
    // generous hover / focus target over the vertex
    const hit = s('circle', { class: 'hit', cx: x.toFixed(1), cy: y.toFixed(1), r: 17, tabindex: 0, role: 'img', 'aria-label': `${METRIC_INFO[key].label} ${score === null ? '測定なし' : `${score}点`}。${detailFor(key, result)}` });
    const show = () => tip.show(hit, score === null ? '—' : `${score}点`, METRIC_INFO[key].label, `${METRIC_INFO[key].hint}。${detailFor(key, result)}${previous && previous.scores[key] !== null && previous.scores[key] !== undefined ? `　前回 ${previous.scores[key]}点` : ''}`);
    hit.addEventListener('pointerenter', show); hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', tip.hide); hit.addEventListener('blur', tip.hide);
    svg.append(hit);
  });
  return svg;
}

/** Tilt over the match. One series, so no legend box for it; events ride a rug along the bottom. */
function timeline(player, tip) {
  const { result, log } = player;
  const W = 640, H = 122, L = 38, Rm = 10, Tm = 8, B = 30;
  const angle = log.angle, fs = log.fs, n = angle.length;
  const dur = Math.max(1, n / fs);
  const calib = player.calib;
  let lo = Math.min(-2, -(calib ? calib.down : 0), -result.rom.peakDown), hi = Math.max(2, calib ? calib.up : 0, result.rom.peakUp);
  const step = hi - lo > 60 ? 20 : hi - lo > 28 ? 10 : 5;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const X = (t) => L + (t / dur) * (W - L - Rm);
  const Y = (a) => Tm + (1 - (a - lo) / (hi - lo)) * (H - Tm - B);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `試合中の角度の変化。上に最大 ${result.rom.peakUp.toFixed(0)}度、下に最大 ${result.rom.peakDown.toFixed(0)}度` });
  svg.style.height = 'auto';
  for (let a = lo; a <= hi + 1e-6; a += step) {
    svg.append(s('line', { class: 'grid', x1: L, x2: W - Rm, y1: Y(a).toFixed(1), y2: Y(a).toFixed(1) }));
    svg.append(s('text', { class: 'tick', x: L - 6, y: (Y(a) + 4).toFixed(1), 'text-anchor': 'end' }, `${a > 0 ? '+' : ''}${a}°`));
  }
  const tStep = dur > 240 ? 60 : dur > 100 ? 30 : dur > 40 ? 15 : 5;
  for (let t = 0; t <= dur + 1e-6; t += tStep) svg.append(s('text', { class: 'tick', x: X(t).toFixed(1), y: H - 2, 'text-anchor': t === 0 ? 'start' : 'middle' }, fmtClock(t)));
  // min/max per pixel column keeps the peaks when the log is longer than the chart is wide
  const cols = Math.min(n, 300);
  const pts = [];
  for (let c = 0; c < cols; c++) {
    const i0 = Math.floor((c / cols) * n), i1 = Math.max(i0 + 1, Math.floor(((c + 1) / cols) * n));
    let mn = Infinity, mx = -Infinity;
    for (let i = i0; i < i1; i++) { if (angle[i] < mn) mn = angle[i]; if (angle[i] > mx) mx = angle[i]; }
    const t = (i0 + i1) / 2 / fs;
    pts.push([X(t), Y(c % 2 ? mx : mn)]);
  }
  if (pts.length > 1) {
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    svg.append(s('path', { class: 'area', d: `${d} L${pts[pts.length - 1][0].toFixed(1)} ${Y(0).toFixed(1)} L${pts[0][0].toFixed(1)} ${Y(0).toFixed(1)} Z` }));
    svg.append(s('path', { class: 'line', d }));
  }
  if (calib && player.source === 'core') {
    for (const [value, label] of [[calib.up, 'はかった上限'], [-calib.down, 'はかった下限']]) {
      if (Math.abs(value) < 1.5) continue;
      svg.append(s('line', { class: 'limit', x1: L, x2: W - Rm, y1: Y(value).toFixed(1), y2: Y(value).toFixed(1) }));
      svg.append(s('text', { class: 'tick', x: W - Rm - 2, y: (Y(value) + (value > 0 ? 13 : -4)).toFixed(1), 'text-anchor': 'end' }, label));
    }
  }
  const rugY = H - B + 6;
  for (const ev of log.hits) svg.append(s('line', { class: 'rug', x1: X(ev.t).toFixed(1), x2: X(ev.t).toFixed(1), y1: rugY, y2: rugY + 7 }));
  for (const ev of log.misses) svg.append(s('line', { class: 'rug miss', x1: X(ev.t).toFixed(1), x2: X(ev.t).toFixed(1), y1: rugY - 2, y2: rugY + 9 }));
  // crosshair: aim at a time, read the angle
  const cross = s('line', { class: 'cross', y1: Tm, y2: H - B, visibility: 'hidden' });
  const overlay = s('rect', { x: L, y: Tm, width: W - L - Rm, height: H - Tm - B, fill: 'transparent' });
  overlay.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect();
    const t = Math.max(0, Math.min(dur, (((e.clientX - box.left) / box.width) * W - L) / (W - L - Rm) * dur));
    const a = angle[Math.min(n - 1, Math.round(t * fs))] ?? 0;
    cross.setAttribute('x1', X(t).toFixed(1)); cross.setAttribute('x2', X(t).toFixed(1)); cross.setAttribute('visibility', 'visible');
    tip.showAt(e.clientX, e.clientY, `${a >= 0 ? '+' : ''}${a.toFixed(0)}°`, fmtClock(t), a >= 0 ? EXERCISES[result.exercise].upHint : EXERCISES[result.exercise].downHint);
  });
  overlay.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hide(); });
  svg.append(cross, overlay);
  return svg;
}

function sparkline(totals) {
  const W = 150, H = 34, n = totals.length;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  const X = (i) => 5 + (n > 1 ? i / (n - 1) : 0.5) * (W - 10), Y = (v) => H - 5 - (v / 100) * (H - 10);
  if (n > 1) svg.append(s('path', { d: totals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' '), fill: 'none', stroke: 'var(--prev)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  svg.append(s('circle', { cx: X(n - 1).toFixed(1), cy: Y(totals[n - 1]).toFixed(1), r: 4.5, fill: 'var(--series)', stroke: '#fffdf6', 'stroke-width': 2 }));
  return svg;
}

function playerCard(player) {
  const { result, previous, history } = player;
  const ex = EXERCISES[result.exercise];
  const card = h('article', { class: 'pcard', 'data-side': String(player.side) });
  const tipEl = h('div', { class: 'tip', hidden: '' });
  const place = (x, y) => {
    const box = card.getBoundingClientRect();
    tipEl.style.left = `${Math.max(4, Math.min(box.width - 260, x - box.left + 14))}px`;
    tipEl.style.top = `${y - box.top + 16}px`;
  };
  const fill = (value, label, detail) => { tipEl.replaceChildren(h('b', { text: value }), h('div', { text: label }), h('span', { text: detail })); tipEl.hidden = false; };
  const tip = {
    show(target, value, label, detail) { const b = target.getBoundingClientRect(); fill(value, label, detail); place(b.left + b.width / 2, b.bottom - 8); },
    showAt(x, y, value, label, detail) { fill(value, label, detail); place(x, y); },
    hide() { tipEl.hidden = true; },
  };
  card.style.position = 'relative';

  const head = h('div', { class: 'pcard-head' }, [h('span', { class: 'panel-dot' }), h('span', { text: player.name }), h('small', { text: `${ex.label}（${ex.place}）` })]);
  if (player.source !== 'core') head.append(h('span', { class: 'note', text: player.source === 'mixed' ? '途中で操作が切りかわったため参考値' : 'キーボード操作のため参考値' }));
  if (result.flags && result.flags.implausibleRange) head.append(h('span', { class: 'note', text: 'センサーの着け方を確認してください' }));
  card.append(head);

  // hero: the one number this card leads with
  const ring = s('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' });
  ring.append(s('circle', { class: 'ring-bg', cx: 60, cy: 60, r: 52, fill: 'none' }));
  const fg = s('circle', { class: 'ring-fg', cx: 60, cy: 60, r: 52, fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': RING.toFixed(1), 'stroke-dashoffset': RING.toFixed(1) });
  ring.append(fg);
  requestAnimationFrame(() => requestAnimationFrame(() => fg.setAttribute('stroke-dashoffset', (RING * (1 - result.total / 100)).toFixed(1))));
  const heroText = h('div', { class: 'hero-text' }, [
    h('div', { class: 'hero-label', text: 'あしげんき度　番付' }),
    h('div', { class: 'rank' }, [h('b', { text: result.rank.label }), h('span', { text: result.rank.note })]),
  ]);
  if (previous) {
    const d = result.total - previous.total;
    heroText.append(h('span', { class: `delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`, text: d === 0 ? '前回と同じ' : `前回より ${d > 0 ? '▲ +' : '▼ '}${d}` }));
  } else heroText.append(h('span', { class: 'delta', text: 'はじめての記録' }));
  if (result.engagement < 0.999) heroText.append(h('span', { class: 'delta down', title: '返球できた割合に応じて総合点を調整しています', text: `返球率による調整 ×${result.engagement.toFixed(2)}` }));
  const totals = history.map((e) => e.total).concat(result.total).slice(-8);
  if (totals.length > 1) heroText.append(h('div', { class: 'spark' }, [sparkline(totals), h('span', { text: `これまで ${history.length + 1} 回` })]));
  const hero = h('div', { class: 'hero' }, [
    h('div', { class: 'hero-ring' }, [ring, h('div', { class: 'hero-num' }, [h('b', { text: String(result.total) }), h('small', { text: '/ 100点' })])]),
    heroText,
  ]);

  // radar + the meter list that states every value
  const radarBox = h('div', { class: 'radar' }, [radar(result, previous, tip)]);
  if (previous) radarBox.append(h('div', { class: 'legend' }, [h('span', {}, [h('i'), '今回']), h('span', {}, [h('i', { class: 'prev' }), '前回'])]));
  const meters = h('div', { class: 'meters' });
  for (const key of METRIC_KEYS) {
    const score = result.scores[key];
    const fillEl = h('div', { class: 'fill' });
    requestAnimationFrame(() => requestAnimationFrame(() => { fillEl.style.width = `${score ?? 0}%`; }));
    meters.append(h('div', { class: `meter${score === null ? ' na' : ''}`, tabindex: '0', title: METRIC_INFO[key].hint }, [
      h('span', { class: 'name', text: METRIC_INFO[key].label }),
      h('div', { class: 'track' }, [fillEl]),
      h('span', { class: 'val', text: score === null ? '—' : String(score) }),
      h('span', { class: 'sub', text: detailFor(key, result) }),
    ]));
  }
  card.append(h('div', { class: 'top-grid' }, [h('div', { class: 'top-left' }, [hero, radarBox]), meters]));

  // key figures
  const tile = (label, value, unit) => h('div', { class: 'tile' }, [h('span', { text: label }), h('b', {}, [String(value), h('small', { text: unit })])]);
  const tiles = h('div', { class: 'tiles' }, [
    tile('上げ下げ', result.activity.reps, '回'),
    tile('動かした合計', Math.round(result.activity.travelDeg), '°'),
    tile(`最大の${ex.up}`, result.rom.peakUp.toFixed(0), '°'),
  ]);
  if (result.exercise === 'ankle') tiles.append(tile(`最大の${ex.down}`, result.rom.peakDown.toFixed(0), '°'));
  if (result.accuracy.hits + result.accuracy.misses > 0) tiles.append(tile('返球率', Math.round(result.accuracy.hitRate * 100), '%'));
  if (result.scores.reaction !== null) tiles.append(tile('反応', (result.reaction.medianMs / 1000).toFixed(2), '秒'));
  card.append(tiles);

  const tl = h('div', { class: 'timeline' }, [
    h('h4', { text: `${ex.short}の角度の変化（+ は${ex.up}）` }),
    timeline(player, tip),
    h('div', { class: 'legend' }, [h('span', {}, [h('i', { class: 'hit' }), '返球']), h('span', {}, [h('i', { class: 'miss' }), '✕ ミス'])]),
  ]);
  const advice = adviceFor(result);
  card.append(h('div', { class: 'advice' }, [h('b', { text: `${advice.praise} ` }), advice.focus ? `つぎは「${METRIC_INFO[advice.focus].label}」: ${advice.tip}` : advice.tip]));
  card.append(tl);
  card.append(tipEl);
  return card;
}

/**
 * @param {object} match - { mode, score, winner, bestRally, totalHits, goal, durationSec, at, names }
 * @param {object[]} players - humans only: { side, name, source, result, previous, history, log, calib }
 */
export function renderReport(match, players) {
  const title = document.getElementById('sheet-title');
  const meta = document.getElementById('sheet-meta');
  const score = document.getElementById('sheet-score');
  const date = new Date(match.at);
  title.textContent = match.mode === 'coop' ? '協力ラリーの結果' : '試合結果';
  meta.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}　プレイ時間 ${fmtTime(match.durationSec)}`;
  score.replaceChildren();
  if (match.mode === 'coop') {
    score.append(h('span', { text: 'ラリー合計' }), h('span', { class: 'num', text: String(match.totalHits) }), h('span', { text: `回 / 目標 ${match.goal}回` }));
    if (match.winner === 'both') score.append(h('span', { class: 'won', text: '達成！' }));
  } else {
    [0, 1].forEach((side) => {
      const part = [h('span', { text: match.names[side] })];
      if (match.winner === side) part.push(h('span', { class: 'won', text: '勝ち' }));
      if (side === 1) score.append(h('span', { class: 'num', text: '-' }));
      if (side === 0) { score.append(...part, h('span', { class: 'num', text: String(match.score[0]) })); } else { score.append(h('span', { class: 'num', text: String(match.score[1]) }), ...part); }
    });
  }
  score.append(h('span', { class: 'tag', text: `最長ラリー ${match.bestRally}回` }));
  const box = document.getElementById('sheet-players');
  box.replaceChildren(...players.map(playerCard));
  if (!players.length) box.append(h('p', { text: '人が操作したプレイヤーがいないため、分析はありません。' }));
}

/** CSV of the whole match: a commented summary, then one row per logged sample. */
export function buildCsv(match, players, frames) {
  const lines = [];
  lines.push('# SUPER PINGPONG (ORPHE CORE GAME-SUPER-PINGPONG) session log');
  lines.push(`# date,${new Date(match.at).toISOString()}`);
  lines.push(`# mode,${match.mode},score,${match.score.join('-')},best_rally,${match.bestRally},total_hits,${match.totalHits},duration_s,${match.durationSec.toFixed(1)}`);
  for (const p of players) {
    const r = p.result;
    lines.push(`# player,${p.side === 0 ? 'aka' : 'ao'},exercise,${r.exercise},input,${p.source},total,${r.total},rank,${r.rank.key},${METRIC_KEYS.map((k) => `${k},${r.scores[k] ?? ''}`).join(',')}`);
    lines.push(`# player,${p.side === 0 ? 'aka' : 'ao'},used_up_deg,${r.rom.usedUp.toFixed(1)},used_down_deg,${r.rom.usedDown.toFixed(1)},reps,${r.activity.reps},travel_deg,${r.activity.travelDeg.toFixed(0)},sparc,${r.smooth.sparc === null ? '' : r.smooth.sparc.toFixed(3)},hits,${r.accuracy.hits},misses,${r.accuracy.misses},reaction_median_ms,${r.reaction.medianMs === null ? '' : r.reaction.medianMs.toFixed(0)}`);
  }
  lines.push('time_s,aka_angle_deg,aka_paddle,ao_angle_deg,ao_paddle,ball_x_m,ball_y_m,event');
  const f = frames;
  const eventAt = new Map();
  for (const ev of f.events) { const i = Math.min(f.t.length - 1, Math.max(0, Math.round(ev.t * f.fs))); eventAt.set(i, eventAt.has(i) ? `${eventAt.get(i)}|${ev.label}` : ev.label); }
  for (let i = 0; i < f.t.length; i++) {
    lines.push([f.t[i].toFixed(2), f.angle[0][i].toFixed(2), f.pos[0][i].toFixed(3), f.angle[1][i].toFixed(2), f.pos[1][i].toFixed(3), f.ballX[i].toFixed(3), f.ballY[i].toFixed(3), eventAt.get(i) || ''].join(','));
  }
  return lines.join('\n');
}
