/**
 * リザルトのグラフ（UdonCharts）
 *
 * どれも SVG 文字列を返すだけの小さな描画関数です（外部ライブラリなし）。
 *   radar()     … 6 観点のレーダーチャート
 *   timeline()  … ふみふみログ（上: テンポの移り変わり / 下: 1 ふみごとの強さ。左右は上下に分けて描く）
 *   sparkline() … きろく（過去のスコアの推移）
 *
 * グラフの約束ごと:
 *   - 軸は 1 つ。単位の違う「テンポ」と「強さ」は 1 枚に重ねず、時間軸をそろえた 2 段に分ける
 *   - 左右は色（藍 / 朱）だけに頼らず、位置（上 / 下）と凡例でも区別する
 *   - 目盛り線は細い実線。数値は全部には書かず、要所だけ。細かい値は data-tip（ホバー／フォーカス）で読める
 */
(function (root) {
  'use strict';

  var INK = '#231815';
  var MUTED = '#7A6F68';
  var GRID = 'rgba(35,24,21,0.13)';
  var PAPER = '#FBF6EC';
  var LEFT = '#2E6FB7';   // 左足（01）: 藍
  var RIGHT = '#E15C3A';  // 右足（02）: 朱

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function f(n) { return (Math.round(n * 10) / 10).toString(); }

  function text(x, y, str, o) {
    o = o || {};
    return '<text x="' + f(x) + '" y="' + f(y) + '" text-anchor="' + (o.anchor || 'middle') + '" font-size="' + (o.size || 13) +
      '" font-weight="' + (o.weight || 700) + '" fill="' + (o.fill || INK) + '"' + (o.cls ? ' class="' + o.cls + '"' : '') + '>' + esc(str) + '</text>';
  }

  /** きりのいい上限値 */
  function niceMax(v) {
    var steps = [0.2, 0.5, 1, 2, 3, 5, 8, 10, 16];
    for (var i = 0; i < steps.length; i++) if (v <= steps[i]) return steps[i];
    return Math.ceil(v);
  }

  function timeLabel(sec) {
    if (sec < 60) return Math.round(sec) + '秒';
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m + '分' + (s ? s + '秒' : '');
  }

  /**
   * レーダーチャート。計測できた観点だけを頂点にする（CORE 1 台のときはバランスを除いた五角形）。
   * @param {Array<{label:string, score:number|null, display:string}>} axes
   */
  function radar(axes) {
    var list = axes.filter(function (a) { return a.score !== null && a.score !== undefined; });
    var n = list.length;
    var W = 400, H = 330, cx = 200, cy = 168, R = 102;
    var s = '<svg class="u-radar-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ふみふみ診断のレーダーチャート">';
    if (n < 3) {
      return s + text(cx, cy - 6, 'もう少しふむと', { size: 16, fill: MUTED }) + text(cx, cy + 18, 'チャートが出ます', { size: 16, fill: MUTED }) + '</svg>';
    }
    var pt = function (i, r) {
      var a = -Math.PI / 2 + i / n * Math.PI * 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    var poly = function (r) {
      var p = [];
      for (var i = 0; i < n; i++) { var q = pt(i, r); p.push(f(q[0]) + ',' + f(q[1])); }
      return p.join(' ');
    };

    // 目盛り（25 / 50 / 75 / 100）と軸
    [0.25, 0.5, 0.75, 1].forEach(function (k) {
      s += '<polygon points="' + poly(R * k) + '" fill="' + (k === 1 ? 'rgba(35,24,21,0.035)' : 'none') + '" stroke="' + GRID + '" stroke-width="1"/>';
    });
    for (var i = 0; i < n; i++) {
      var e = pt(i, R);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + f(e[0]) + '" y2="' + f(e[1]) + '" stroke="' + GRID + '" stroke-width="1"/>';
    }
    s += text(cx + 5, cy - R * 0.5 + 4, '50', { size: 10, weight: 500, fill: MUTED, anchor: 'start' });
    s += text(cx + 5, cy - R + 4, '100', { size: 10, weight: 500, fill: MUTED, anchor: 'start' });

    // データ
    var dp = [];
    for (i = 0; i < n; i++) { var q = pt(i, R * Math.max(4, list[i].score) / 100); dp.push(f(q[0]) + ',' + f(q[1])); }
    s += '<g class="u-radar-data" style="transform-origin:' + cx + 'px ' + cy + 'px">' +
      '<polygon points="' + dp.join(' ') + '" fill="' + RIGHT + '" fill-opacity="0.2" stroke="' + RIGHT + '" stroke-width="2.5" stroke-linejoin="round"/>';
    for (i = 0; i < n; i++) {
      var d = pt(i, R * Math.max(4, list[i].score) / 100);
      s += '<circle cx="' + f(d[0]) + '" cy="' + f(d[1]) + '" r="5" fill="' + RIGHT + '" stroke="' + PAPER + '" stroke-width="2"/>';
    }
    s += '</g>';

    // ラベル（観点名＋点数）とホバー用の当たり判定
    for (i = 0; i < n; i++) {
      var a = -Math.PI / 2 + i / n * Math.PI * 2;
      var lx = cx + Math.cos(a) * (R + 22), ly = cy + Math.sin(a) * (R + 22);
      var anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      var up = Math.sin(a) < -0.3, down = Math.sin(a) > 0.3;
      var y0 = up ? ly - 18 : (down ? ly + 10 : ly - 4);
      s += text(lx, y0, list[i].label, { size: 16, weight: 900, anchor: anchor });
      s += text(lx, y0 + 18, list[i].score + '点', { size: 14, weight: 700, anchor: anchor, fill: MUTED });
      var h = pt(i, R * Math.max(4, list[i].score) / 100);
      s += '<circle cx="' + f(h[0]) + '" cy="' + f(h[1]) + '" r="16" fill="transparent" tabindex="0" data-tip="' +
        esc(list[i].label + ' ' + list[i].score + '点｜' + list[i].display) + '"/>';
    }
    return s + '</svg>';
  }

  /**
   * ふみふみログ。
   * @param {object} result UdonHealth.analyze() の結果
   */
  function timeline(result) {
    var steps = result.series.steps;
    var cad = result.series.cadence;
    var W = 760, H = 372;
    var x0 = 50, x1 = W - 18;
    var aTop = 26, aH = 118;             // 上段: テンポ
    var bTop = aTop + aH + 44, bH = 150; // 下段: 強さ
    var s = '<svg class="u-timeline-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ふみふみログ。上はテンポの移り変わり、下は一ふみごとの強さ">';
    if (steps.length < 2) {
      return s + text(W / 2, H / 2, 'ふみふみすると、ここにログが出ます', { size: 16, fill: MUTED }) + '</svg>';
    }
    var T = steps[steps.length - 1].t;
    var X = function (t) { return x0 + (x1 - x0) * (T > 0 ? t / T : 0); };
    var two = result.feet === 2;

    // --- ひとやすみの帯（上下段共通） ---
    for (var i = 1; i < steps.length; i++) {
      if (!steps[i].afterRest) continue;
      var rx0 = X(steps[i - 1].t) + 3, rx1 = X(steps[i].t) - 3;
      if (rx1 - rx0 < 2) continue;
      s += '<rect x="' + f(rx0) + '" y="' + aTop + '" width="' + f(rx1 - rx0) + '" height="' + (bTop + bH - aTop) + '" fill="rgba(35,24,21,0.05)"/>';
      if (rx1 - rx0 > 62) s += text((rx0 + rx1) / 2, aTop + 13, 'ひとやすみ', { size: 10, weight: 500, fill: MUTED });
    }

    // --- 上段: テンポ（ふみ/分） ---
    s += text(x0, aTop - 10, 'テンポ（ふみ/分）', { size: 12, weight: 900, anchor: 'start' });
    if (cad.length >= 2) {
      var lo = Infinity, hi = -Infinity;
      cad.forEach(function (p) { if (p.spm < lo) lo = p.spm; if (p.spm > hi) hi = p.spm; });
      var yLo = Math.max(0, Math.floor((lo - 5) / 20) * 20), yHi = Math.ceil((hi + 5) / 20) * 20;
      if (yHi - yLo < 40) yHi = yLo + 40;
      var YA = function (v) { return aTop + aH - (v - yLo) / (yHi - yLo) * aH; };
      [yLo, (yLo + yHi) / 2, yHi].forEach(function (v) {
        s += '<line x1="' + x0 + '" y1="' + f(YA(v)) + '" x2="' + x1 + '" y2="' + f(YA(v)) + '" stroke="' + GRID + '" stroke-width="1"/>';
        s += text(x0 - 8, YA(v) + 4, Math.round(v), { size: 10, weight: 500, fill: MUTED, anchor: 'end' });
      });
      // ひとやすみをまたぐ線は引かない
      var seg = '', area = '', prevT = null, segStartX = null, lastX = null;
      var closeArea = function () {
        if (segStartX !== null) area += ' L' + f(lastX) + ',' + f(aTop + aH) + ' L' + f(segStartX) + ',' + f(aTop + aH) + ' Z';
      };
      cad.forEach(function (p) {
        var px = X(p.t), py = YA(p.spm);
        var broken = prevT !== null && steps.some(function (st) { return st.afterRest && st.t > prevT && st.t <= p.t; });
        if (prevT === null || broken) {
          closeArea();
          seg += ' M' + f(px) + ',' + f(py);
          area += ' M' + f(px) + ',' + f(py);
          segStartX = px;
        } else {
          seg += ' L' + f(px) + ',' + f(py);
          area += ' L' + f(px) + ',' + f(py);
        }
        prevT = p.t; lastX = px;
      });
      closeArea();
      s += '<path d="' + area.trim() + '" fill="' + INK + '" fill-opacity="0.07"/>';
      s += '<path d="' + seg.trim() + '" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      var end = cad[cad.length - 1];
      s += '<circle cx="' + f(X(end.t)) + '" cy="' + f(YA(end.spm)) + '" r="4.5" fill="' + INK + '" stroke="' + PAPER + '" stroke-width="2"/>';
      s += text(Math.min(X(end.t), x1 - 4), YA(end.spm) - 10, Math.round(end.spm), { size: 11, weight: 900, anchor: 'end' });
      // 平均
      var avg = result.cadence;
      if (avg > yLo && avg < yHi) {
        s += '<line x1="' + x0 + '" y1="' + f(YA(avg)) + '" x2="' + x1 + '" y2="' + f(YA(avg)) + '" stroke="' + INK + '" stroke-opacity="0.35" stroke-width="1"/>';
        s += text(x0 + 4, YA(avg) - 4, '平均 ' + Math.round(avg), { size: 10, weight: 700, fill: MUTED, anchor: 'start' });
      }
    } else {
      s += text((x0 + x1) / 2, aTop + aH / 2 + 4, 'もう少しふむと、テンポの線が出ます', { size: 12, weight: 500, fill: MUTED });
    }

    // --- 下段: 1 ふみごとの強さ（左は上向き・右は下向き） ---
    s += text(x0, bTop - 12, 'ふみの強さ（G）', { size: 12, weight: 900, anchor: 'start' });
    // 凡例（2 系列のときは必ず出す）
    if (two) {
      s += '<rect x="' + (x1 - 150) + '" y="' + (bTop - 22) + '" width="10" height="10" rx="2" fill="' + LEFT + '"/>' +
        text(x1 - 136, bTop - 13, '左（01）', { size: 11, anchor: 'start' }) +
        '<rect x="' + (x1 - 74) + '" y="' + (bTop - 22) + '" width="10" height="10" rx="2" fill="' + RIGHT + '"/>' +
        text(x1 - 60, bTop - 13, '右（02）', { size: 11, anchor: 'start' });
    }
    var maxPeak = 0;
    steps.forEach(function (st) { if (st.peak > maxPeak) maxPeak = st.peak; });
    var top = niceMax(maxPeak);
    var base = two ? bTop + bH / 2 : bTop + bH;
    var span = two ? bH / 2 - 4 : bH - 4;
    var slot = (x1 - x0) / steps.length;
    var bw = Math.max(1.5, Math.min(6, slot - 2));
    s += '<line x1="' + x0 + '" y1="' + f(base) + '" x2="' + x1 + '" y2="' + f(base) + '" stroke="rgba(35,24,21,0.4)" stroke-width="1"/>';
    s += '<line x1="' + x0 + '" y1="' + f(base - span) + '" x2="' + x1 + '" y2="' + f(base - span) + '" stroke="' + GRID + '" stroke-width="1"/>';
    s += text(x0 - 8, base - span + 4, top + 'G', { size: 10, weight: 500, fill: MUTED, anchor: 'end' });
    s += text(x0 - 8, base + 4, '0', { size: 10, weight: 500, fill: MUTED, anchor: 'end' });
    if (two) {
      s += '<line x1="' + x0 + '" y1="' + f(base + span) + '" x2="' + x1 + '" y2="' + f(base + span) + '" stroke="' + GRID + '" stroke-width="1"/>';
      s += text(x0 - 8, base + span + 4, top + 'G', { size: 10, weight: 500, fill: MUTED, anchor: 'end' });
      s += text(x0 + 4, base - span + 13, '左', { size: 11, weight: 900, anchor: 'start', fill: MUTED });
      s += text(x0 + 4, base + span - 5, '右', { size: 11, weight: 900, anchor: 'start', fill: MUTED });
    }
    var hits = '';
    steps.forEach(function (st, idx) {
      var h = Math.max(2, Math.min(1, st.peak / top) * span);
      var px = X(st.t);
      var down = two && st.foot === 1;
      var r = Math.min(2, bw / 2);
      var y = down ? base : base - h;
      // データ側の端だけ丸める（基線側は四角）
      var d = down
        ? 'M' + f(px - bw / 2) + ',' + f(y) + ' h' + f(bw) + ' v' + f(h - r) + ' q0,' + f(r) + ' ' + f(-r) + ',' + f(r) + ' h' + f(-(bw - 2 * r)) + ' q' + f(-r) + ',0 ' + f(-r) + ',' + f(-r) + ' Z'
        : 'M' + f(px - bw / 2) + ',' + f(base) + ' v' + f(-(h - r)) + ' q0,' + f(-r) + ' ' + f(r) + ',' + f(-r) + ' h' + f(bw - 2 * r) + ' q' + f(r) + ',0 ' + f(r) + ',' + f(r) + ' V' + f(base) + ' Z';
      s += '<path d="' + d + '" fill="' + (st.foot === 0 ? LEFT : RIGHT) + '"/>';
      var gap = idx > 0 ? ((st.t - steps[idx - 1].t) / 1000).toFixed(2) + '秒' : '—';
      var hw = Math.max(slot, 6);
      hits += '<rect x="' + f(px - hw / 2) + '" y="' + f(bTop) + '" width="' + f(hw) + '" height="' + bH + '" fill="transparent" tabindex="0" data-tip="' +
        esc((idx + 1) + 'ふみ目｜' + (two ? (st.foot === 0 ? '左（01）' : '右（02）') + '｜' : '') + '強さ ' + st.peak.toFixed(2) + 'G｜間隔 ' + gap) + '"/>';
    });
    s += hits;

    // --- 時間軸 ---
    var totalSec = T / 1000;
    var stepSec = totalSec <= 40 ? 10 : (totalSec <= 100 ? 20 : (totalSec <= 240 ? 60 : 120));
    for (var ts = 0; ts <= totalSec + 0.001; ts += stepSec) {
      var tx = X(ts * 1000);
      s += '<line x1="' + f(tx) + '" y1="' + (bTop + bH) + '" x2="' + f(tx) + '" y2="' + (bTop + bH + 4) + '" stroke="' + MUTED + '" stroke-width="1"/>';
      s += text(tx, bTop + bH + 18, ts === 0 ? '0' : timeLabel(ts), { size: 10, weight: 500, fill: MUTED });
    }
    return s + '</svg>';
  }

  /**
   * きろく用の小さな折れ線。values は古い順。
   */
  function sparkline(values, opts) {
    opts = opts || {};
    var W = opts.width || 520, H = opts.height || 150;
    var x0 = 34, x1 = W - 40, y0 = 16, y1 = H - 26;
    var s = '<svg class="u-spark-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="スコアの推移">';
    if (!values.length) return s + text(W / 2, H / 2, 'まだきろくがありません', { size: 14, fill: MUTED }) + '</svg>';
    var Y = function (v) { return y1 - (v / 100) * (y1 - y0); };
    var X = function (i) { return values.length === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (values.length - 1); };
    [0, 50, 100].forEach(function (v) {
      s += '<line x1="' + x0 + '" y1="' + f(Y(v)) + '" x2="' + x1 + '" y2="' + f(Y(v)) + '" stroke="' + GRID + '" stroke-width="1"/>';
      s += text(x0 - 8, Y(v) + 4, v, { size: 10, weight: 500, fill: MUTED, anchor: 'end' });
    });
    var d = '';
    values.forEach(function (v, i) { d += (i ? ' L' : 'M') + f(X(i)) + ',' + f(Y(v.total)); });
    if (values.length > 1) s += '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    values.forEach(function (v, i) {
      var last = i === values.length - 1;
      s += '<circle cx="' + f(X(i)) + '" cy="' + f(Y(v.total)) + '" r="' + (last ? 5.5 : 4) + '" fill="' + (last ? RIGHT : INK) + '" stroke="' + PAPER + '" stroke-width="2"/>';
      s += '<circle cx="' + f(X(i)) + '" cy="' + f(Y(v.total)) + '" r="14" fill="transparent" tabindex="0" data-tip="' + esc(v.tip || (v.total + '点')) + '"/>';
    });
    var lastV = values[values.length - 1];
    s += text(X(values.length - 1) + 10, Y(lastV.total) + 5, lastV.total + '点', { size: 13, weight: 900, anchor: 'start' });
    s += text(x0, H - 6, opts.fromLabel || '', { size: 10, weight: 500, fill: MUTED, anchor: 'start' });
    s += text(x1, H - 6, opts.toLabel || '', { size: 10, weight: 500, fill: MUTED, anchor: 'end' });
    return s + '</svg>';
  }

  var UdonCharts = { radar: radar, timeline: timeline, sparkline: sparkline, timeLabel: timeLabel, LEFT: LEFT, RIGHT: RIGHT };

  root.UdonCharts = UdonCharts;
  if (typeof module !== 'undefined' && module.exports) module.exports = UdonCharts;
})(typeof globalThis !== 'undefined' ? globalThis : this);
