// scope.js — shows the sensor signal the games judge, as it is judged.
//
// Two drawings on a plain 2D canvas:
//   createScope()        a scrolling strip chart of the last few seconds (live)
//   drawReactionPlot()   one attempt around the gun, with the moments the game used (result card)
// Values are plotted in "threshold units": 1.0 is the line the game compares against, so the
// picture reads the same whatever the thresholds are set to. No imports, no game state.

const FONT = '"Bebas Neue", "Arial Narrow", Impact, sans-serif';

function fit(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w, h, dpr };
}
/** Compress the top of the range so a hard shake stays on the canvas without flattening small signals. */
const squash = (v, max) => (v <= 1 ? v : 1 + (max - 1) * (1 - Math.exp(-(v - 1) / (max - 1))));

/**
 * A live strip chart.
 * options:
 *   seconds  width of the window
 *   max      top of the scale, in threshold units
 *   series   [{ color, label }]              one trace per value passed to push()
 *   lines    [{ y, color, label, dash }]     horizontal reference lines (y in threshold units)
 */
export function createScope(canvas, { seconds = 4, max = 2.2, series = [], lines = [] } = {}) {
  const ctx = canvas.getContext('2d');
  const buf = [];
  let tint = null;
  return {
    /** t in ms on the page clock; values in threshold units, one per series. */
    push(t, values) {
      buf.push({ t, v: values });
      const cut = t - seconds * 1000 - 500;
      while (buf.length > 2 && buf[0].t < cut) buf.shift();
    },
    /** A colour behind the traces: what the game currently makes of the signal (or null). */
    setTint(color) { tint = color; },
    setLines(next) { lines = next; },
    clear() { buf.length = 0; },
    draw(now) {
      if (!canvas.clientWidth) return;
      const { w, h, dpr } = fit(canvas);
      const span = seconds * 1000;
      const X = (t) => ((t - (now - span)) / span) * w;
      const Y = (v) => h - 2 * dpr - (squash(Math.max(0, v), max) / max) * (h - 6 * dpr);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(4, 8, 20, 0.72)';
      ctx.fillRect(0, 0, w, h);
      if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h); }
      // second ticks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'; ctx.lineWidth = dpr;
      for (let s = Math.ceil((now - span) / 1000) * 1000; s < now; s += 1000) { ctx.beginPath(); ctx.moveTo(X(s), 0); ctx.lineTo(X(s), h); ctx.stroke(); }
      for (const l of lines) {
        ctx.strokeStyle = l.color; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash(l.dash ? [5 * dpr, 4 * dpr] : []);
        ctx.beginPath(); ctx.moveTo(0, Y(l.y)); ctx.lineTo(w, Y(l.y)); ctx.stroke();
        ctx.setLineDash([]);
        if (l.label) { ctx.fillStyle = l.color; ctx.font = `${11 * dpr}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(l.label, 4 * dpr, Y(l.y) - 1 * dpr); }
      }
      series.forEach((s, k) => {
        if (buf.length < 2) return;
        ctx.strokeStyle = s.color; ctx.lineWidth = 2 * dpr; ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false, prevT = 0;
        for (const p of buf) {
          const x = X(p.t), y = Y(p.v[k]);
          // a gap in the stream is drawn as a gap, not bridged
          if (!started || p.t - prevT > 150) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
          prevT = p.t;
        }
        ctx.stroke();
      });
      // legend
      ctx.font = `${11 * dpr}px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'right';
      let lx = w - 4 * dpr;
      for (let k = series.length - 1; k >= 0; k--) {
        ctx.fillStyle = series[k].color;
        ctx.fillText(series[k].label, lx, 3 * dpr);
        lx -= ctx.measureText(series[k].label).width + 10 * dpr;
      }
    },
  };
}

/**
 * A live chart of raw, signed axes (gyro x/y/z, acceleration x/y/z) around zero, with the band
 * they have to stay inside. Values are passed in units of that band: +-1 is its edge.
 * options:
 *   seconds  width of the window
 *   range    top and bottom of the scale, in band units
 *   series   [{ color, label }]
 *   title    text in the top-left corner
 *   bandLabel  text on the band edge (e.g. "±90 °/s")
 */
export function createRawScope(canvas, { seconds = 2.5, range = 2.6, series = [], title = '', bandLabel = '' } = {}) {
  const ctx = canvas.getContext('2d');
  const buf = [];
  let label = bandLabel;
  return {
    push(t, values) {
      buf.push({ t, v: values });
      const cut = t - seconds * 1000 - 500;
      while (buf.length > 2 && buf[0].t < cut) buf.shift();
    },
    setBandLabel(text) { label = text; },
    clear() { buf.length = 0; },
    /** worst = how far the worst axis is from zero right now, in band units (colours the frame). */
    draw(now, worst = 0) {
      if (!canvas.clientWidth) return;
      const { w, h, dpr } = fit(canvas);
      const span = seconds * 1000;
      const X = (t) => ((t - (now - span)) / span) * w;
      const Y = (v) => h / 2 - (Math.sign(v) * squash(Math.abs(v), range) / range) * (h / 2 - 3 * dpr);
      const out = worst >= 1;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = out ? 'rgba(60, 6, 20, 0.82)' : 'rgba(3, 10, 26, 0.8)';
      ctx.fillRect(0, 0, w, h);
      // the band: inside it the exchange goes on
      ctx.fillStyle = out ? 'rgba(255, 61, 110, 0.16)' : `rgba(34, 227, 255, ${0.1 + 0.1 * (1 - Math.min(1, worst))})`;
      ctx.fillRect(0, Y(1), w, Y(-1) - Y(1));
      ctx.strokeStyle = out ? '#ff3d6e' : '#22e3ff'; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([6 * dpr, 4 * dpr]);
      for (const y of [1, -1]) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(w, Y(y)); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.stroke();
      series.forEach((s, k) => {
        if (buf.length < 2) return;
        ctx.strokeStyle = s.color; ctx.lineWidth = 2.2 * dpr; ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false, prevT = 0;
        for (const p of buf) {
          const x = X(p.t), y = Y(p.v[k]);
          if (!started || p.t - prevT > 150) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
          prevT = p.t;
        }
        ctx.stroke();
      });
      // the newest value of each axis as a dot on the right edge
      const last = buf[buf.length - 1];
      if (last && now - last.t < 300) series.forEach((s, k) => { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(w - 5 * dpr, Y(last.v[k]), 4 * dpr, 0, Math.PI * 2); ctx.fill(); });
      ctx.font = `${13 * dpr}px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillStyle = '#fff'; ctx.fillText(title, 6 * dpr, 4 * dpr);
      let lx = 6 * dpr + ctx.measureText(title).width + 12 * dpr;
      for (const s of series) { ctx.fillStyle = s.color; ctx.fillText(s.label, lx, 4 * dpr); lx += ctx.measureText(s.label).width + 8 * dpr; }
      if (label) { ctx.fillStyle = out ? '#ff9db5' : '#7fe9ff'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.font = `${11 * dpr}px ${FONT}`; ctx.fillText(label, w - 12 * dpr, Y(1) - 1 * dpr); }
    },
  };
}

/**
 * One attempt, drawn around the gun.
 *   samples  [{ t, v: [..] }]  in threshold units, t in ms on the page clock
 *   t0       the gun (or, when no gun was fired, the moment the plot is centred on)
 *   from/to  window in ms relative to t0
 *   series   [{ color, label }]
 *   bands    [{ from, to, color, label }]   shaded time ranges, ms relative to t0
 *   marks    [{ at, color, label, dash }]   vertical lines, ms relative to t0
 *   lines    [{ y, color, label, dash }]
 */
export function drawReactionPlot(canvas, { samples, t0, from = -400, to = 600, max = 2.6, series = [], bands = [], marks = [], lines = [] }) {
  if (!canvas.clientWidth) return;
  const ctx = canvas.getContext('2d');
  const { w, h, dpr } = fit(canvas);
  const padB = 16 * dpr, padT = 15 * dpr;
  const X = (ms) => ((ms - from) / (to - from)) * w;
  const Y = (v) => h - padB - (squash(Math.max(0, v), max) / max) * (h - padB - padT);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.fillRect(0, 0, w, h);
  for (const b of bands) {
    ctx.fillStyle = b.color;
    ctx.fillRect(X(b.from), padT, X(b.to) - X(b.from), h - padB - padT);
    if (b.label) { ctx.fillStyle = b.labelColor || '#fff'; ctx.font = `${10 * dpr}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(b.label, (X(b.from) + X(b.to)) / 2, padT + 2 * dpr); }
  }
  // time axis: every 100 ms
  ctx.font = `${11 * dpr}px ${FONT}`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
  for (let ms = Math.ceil(from / 100) * 100; ms <= to; ms += 100) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(X(ms), padT); ctx.lineTo(X(ms), h - padB); ctx.stroke();
    if (ms % 200 === 0) { ctx.fillStyle = 'rgba(159, 176, 208, 0.9)'; ctx.fillText((ms / 1000).toFixed(1), X(ms), h - 1 * dpr); }
  }
  for (const l of lines) {
    ctx.strokeStyle = l.color; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash(l.dash ? [5 * dpr, 4 * dpr] : []);
    ctx.beginPath(); ctx.moveTo(0, Y(l.y)); ctx.lineTo(w, Y(l.y)); ctx.stroke();
    ctx.setLineDash([]);
    if (l.label) { ctx.fillStyle = l.color; ctx.font = `${10 * dpr}px sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(l.label, w - 4 * dpr, Y(l.y) - 1 * dpr); }
  }
  series.forEach((s, k) => {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2 * dpr; ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false, prevT = 0;
    for (const p of samples) {
      const ms = p.t - t0;
      if (ms < from - 20 || ms > to + 20) continue;
      if (!started || p.t - prevT > 150) { ctx.moveTo(X(ms), Y(p.v[k])); started = true; } else ctx.lineTo(X(ms), Y(p.v[k]));
      prevT = p.t;
    }
    ctx.stroke();
  });
  for (const m of marks) {
    if (m.at < from || m.at > to) continue;
    ctx.strokeStyle = m.color; ctx.lineWidth = 2 * dpr; ctx.setLineDash(m.dash ? [4 * dpr, 3 * dpr] : []);
    ctx.beginPath(); ctx.moveTo(X(m.at), padT - 2 * dpr); ctx.lineTo(X(m.at), h - padB); ctx.stroke();
    ctx.setLineDash([]);
    if (m.label) {
      ctx.fillStyle = m.color; ctx.font = `${10.5 * dpr}px sans-serif`; ctx.textBaseline = 'top';
      const right = X(m.at) > w * 0.7;
      ctx.textAlign = m.align || (right ? 'right' : 'left');
      ctx.fillText(m.label, X(m.at) + (ctx.textAlign === 'right' ? -3 : 3) * dpr, 1 * dpr);
    }
  }
  // legend
  ctx.font = `${11 * dpr}px ${FONT}`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
  let lx = 4 * dpr;
  for (const s of series) { ctx.fillStyle = s.color; ctx.fillText(s.label, lx, h - padB - 2 * dpr); lx += ctx.measureText(s.label).width + 10 * dpr; }
}
