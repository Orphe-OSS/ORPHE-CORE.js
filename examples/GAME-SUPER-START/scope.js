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
 * Raw axes drawn straight onto the picture: no panel, no frame, glowing lines running across the
 * whole screen, newest on the right. Values are in band units (+-1 = the edge of the band).
 * groups: [{ title, center, amp, series: [{ color, label }] }]
 *   center  where the group's zero line sits, as a share of the height (0 = top)
 *   amp     the height of one band unit, as a share of the height
 */
export function createWaveOverlay(canvas, { seconds = 2.4, range = 3.2, groups = [] } = {}) {
  const ctx = canvas.getContext('2d');
  const bufs = groups.map(() => []);
  const labels = groups.map(() => '');
  let shown = 0;
  return {
    push(g, t, values) {
      const buf = bufs[g];
      buf.push({ t, v: values });
      const cut = t - seconds * 1000 - 400;
      while (buf.length > 2 && buf[0].t < cut) buf.shift();
    },
    setBandLabel(g, text) { labels[g] = text; },
    clear() { for (const b of bufs) b.length = 0; },
    /** worst[g] = how far group g's worst axis is from zero right now, in band units. */
    draw(now, worst = []) {
      if (!canvas.clientWidth) return;
      // a full-screen canvas: keep the pixel count down, the glow hides it
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      shown = Math.min(1, shown + 0.08);       // the lines sweep in from the right when the overlay appears
      const span = seconds * 1000;
      const right = w * 0.985;
      const X = (t) => right - ((now - t) / span) * right;
      ctx.clearRect(0, 0, w, h);
      groups.forEach((g, gi) => {
        const cy = g.center * h, a = g.amp * h;
        const out = (worst[gi] || 0) >= 1;
        const Y = (v) => cy - (Math.sign(v) * squash(Math.abs(v), range)) * a;
        // the band the lines have to stay inside: a faint glow and two hairlines, edge to edge
        ctx.globalCompositeOperation = 'source-over';
        const band = ctx.createLinearGradient(0, Y(1), 0, Y(-1));
        const tint = out ? '255, 61, 110' : '34, 227, 255';
        band.addColorStop(0, `rgba(${tint}, 0)`); band.addColorStop(0.5, `rgba(${tint}, ${out ? 0.2 : 0.1})`); band.addColorStop(1, `rgba(${tint}, 0)`);
        ctx.fillStyle = band; ctx.fillRect(0, Y(1), w, Y(-1) - Y(1));
        ctx.strokeStyle = `rgba(${tint}, ${out ? 0.95 : 0.6})`; ctx.lineWidth = (out ? 2.5 : 1.5) * dpr; ctx.setLineDash([14 * dpr, 10 * dpr]);
        for (const y of [1, -1]) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(w, Y(y)); ctx.stroke(); }
        ctx.setLineDash([]);
        // the axes: three strokes each, wide and faint to narrow and bright, added together = a glow
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const buf = bufs[gi];
        g.series.forEach((s, k) => {
          if (buf.length < 2) return;
          const fade = ctx.createLinearGradient(right * (1 - shown), 0, right, 0);
          fade.addColorStop(0, 'rgba(0, 0, 0, 0)'); fade.addColorStop(0.35, s.color); fade.addColorStop(1, s.color);
          ctx.strokeStyle = fade;
          ctx.beginPath();
          let started = false, prevT = 0;
          for (const p of buf) {
            const x = X(p.t);
            if (x < -20) continue;
            if (!started || p.t - prevT > 150) { ctx.moveTo(x, Y(p.v[k])); started = true; } else ctx.lineTo(x, Y(p.v[k]));
            prevT = p.t;
          }
          for (const [width, alpha] of [[13, 0.1], [6, 0.3], [2.4, 1]]) { ctx.lineWidth = width * dpr; ctx.globalAlpha = alpha; ctx.stroke(); }
          ctx.globalAlpha = 1;
          const last = buf[buf.length - 1];
          if (now - last.t < 300) {
            // the newest value: a bright head on each line
            const y = Y(last.v[k]);
            ctx.fillStyle = s.color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(right, y, 11 * dpr, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(right, y, 3.5 * dpr, 0, Math.PI * 2); ctx.fill();
          }
        });
        // what it is, at the left end of the band
        ctx.globalCompositeOperation = 'source-over';
        ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
        ctx.font = `${22 * dpr}px ${FONT}`;
        ctx.fillStyle = out ? '#ffb3c4' : '#d6f8ff';
        ctx.fillText(g.title, 18 * dpr, Y(1) - 5 * dpr);
        let lx = 18 * dpr + ctx.measureText(g.title).width + 14 * dpr;
        for (const s of g.series) { ctx.fillStyle = s.color; ctx.fillText(s.label, lx, Y(1) - 5 * dpr); lx += ctx.measureText(s.label).width + 10 * dpr; }
        if (labels[gi]) { ctx.font = `${15 * dpr}px ${FONT}`; ctx.fillStyle = `rgba(${tint}, 0.95)`; ctx.fillText(labels[gi], lx + 8 * dpr, Y(1) - 7 * dpr); }
      });
      ctx.globalCompositeOperation = 'source-over';
    },
    /** Call when the overlay is shown again, so the lines sweep in. */
    appear() { shown = 0; },
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
