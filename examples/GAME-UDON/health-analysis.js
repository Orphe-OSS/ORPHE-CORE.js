/**
 * ふみふみログの解析（UdonHealth）
 *
 * 足踏みのログ [{ t: ミリ秒, foot: 0(左)|1(右), peak: ふみの強さ[G] }] から、
 * 6 つの観点のスコア（レーダーチャート用）と総合スコア、ひとことアドバイスを作る純ロジックです。
 * DOM にも SDK にも依存しません（tests/udon-health-analysis.test.js）。
 *
 *   リズム   … ふむ間隔のそろい方（間隔の変動係数）
 *   テンポ   … 1 分あたりのふみ数（ケイデンス）
 *   バランス … 左右の回数・強さ・タイミングのつりあい、左右交互にふめたか（CORE 2 台のときだけ）
 *   ちから   … ふみこみの強さ（中央値）
 *   スタミナ … 前半と後半でペースと強さを保てたか
 *   あんてい … ふみこみの強さのそろい方
 *
 * 注意: これは遊びながら体の動きをふり返るための目安で、医療的な診断や評価ではありません。
 * 各スコアの換算カーブは経験的に決めた値です。
 */
(function (root) {
  'use strict';

  var MIN_STEPS = 8;          // これより少ないと統計にならない
  var MIN_STEPS_STAMINA = 12; // 前半・後半を比べるのに必要な数

  var AXES = [
    { key: 'rhythm', label: 'リズム', weight: 0.25, desc: 'ふむ間隔のそろい方' },
    { key: 'tempo', label: 'テンポ', weight: 0.15, desc: '1分あたりのふみ数' },
    { key: 'balance', label: 'バランス', weight: 0.2, desc: '左右のつりあい' },
    { key: 'power', label: 'ちから', weight: 0.1, desc: 'ふみこみの強さ' },
    { key: 'stamina', label: 'スタミナ', weight: 0.15, desc: '後半までのねばり' },
    { key: 'steady', label: 'あんてい', weight: 0.15, desc: '強さのそろい方' }
  ];

  var RANKS = [
    { min: 88, key: 'meijin', grade: 'S', ja: '名人', en: 'GENIUS' },
    { min: 74, key: 'shokunin', grade: 'A', ja: '職人', en: 'EXPERT' },
    { min: 58, key: 'ichininmae', grade: 'B', ja: '一人前', en: 'ARTISAN' },
    { min: 40, key: 'minarai', grade: 'C', ja: '見習い', en: 'AMATEUR' },
    { min: 0, key: 'deshi', grade: 'D', ja: '新弟子', en: 'ROOKIE' }
  ];

  // 換算カーブ（[入力値, スコア] の折れ線）
  var CURVES = {
    rhythmCv: [[0.04, 100], [0.08, 88], [0.12, 76], [0.2, 56], [0.3, 36], [0.45, 15], [0.6, 0]],
    cadence: [[0, 0], [40, 25], [70, 55], [100, 80], [120, 95], [135, 100]],
    balance: [[0.5, 0], [0.7, 40], [0.85, 75], [0.95, 95], [1, 100]],
    peakG: [[0.1, 10], [0.3, 35], [0.6, 55], [1, 70], [2, 88], [3.5, 100]],
    paceRatio: [[0.5, 0], [0.7, 45], [0.85, 75], [0.95, 92], [1, 100]],
    peakCv: [[0.15, 100], [0.3, 80], [0.5, 55], [0.8, 25], [1.2, 0]]
  };

  var PRAISE = {
    rhythm: 'ふむ間隔がよくそろっています。メトロノームのような足どりです。',
    tempo: 'テンポのよい、元気なふみふみでした。',
    balance: '左右のつりあいがとてもきれいです。',
    power: 'しっかり力強くふみこめています。',
    stamina: '最後までペースが落ちませんでした。ねばり強いです。',
    steady: '毎回おなじ強さでふめています。コシのそろった麺になります。'
  };

  var TIPS = {
    rhythm: '「いち、に、いち、に」と声に出すと、間隔がそろいやすくなります。',
    tempo: '次はほんの少しだけテンポアップ。好きな音楽に合わせるのもおすすめです。',
    balance: '左右おなじ数だけ、交互にふむことを意識してみましょう。',
    power: 'ひざを少しだけ高く上げると、ふみこみがしっかりします。無理は禁物です。',
    stamina: '前半を少しおさえて、おなじペースで最後までふんでみましょう。',
    steady: '毎回おなじ高さまで足を上げるつもりでふむと、強さがそろいます。'
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /** 折れ線カーブで値をスコアに換算する */
  function curve(x, pts) {
    if (!(x > pts[0][0])) return pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        var k = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return pts[i - 1][1] + k * (pts[i][1] - pts[i - 1][1]);
      }
    }
    return pts[pts.length - 1][1];
  }

  function mean(a) {
    if (!a.length) return 0;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }

  function sd(a) {
    if (a.length < 2) return 0;
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }

  function median(a) {
    if (!a.length) return 0;
    var v = a.slice().sort(function (x, y) { return x - y; });
    var h = v.length >> 1;
    return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
  }

  function cv(a) {
    var m = mean(a);
    return m > 0 ? sd(a) / m : 0;
  }

  function symmetry(a, b) {
    return (a + b) > 0 ? 1 - Math.abs(a - b) / (a + b) : 1;
  }

  function rankFor(total) {
    for (var i = 0; i < RANKS.length; i++) if (total >= RANKS[i].min) return RANKS[i];
    return RANKS[RANKS.length - 1];
  }

  /**
   * @param {object} input
   * @param {Array<{t:number, foot:number, peak:number, rest?:boolean, press?:number, fore?:number}>} input.steps
   *   ふみのログ（t はミリ秒）。rest = true は「この 1 ふみの前に、ひとやすみ（一時停止）をはさんだ」。
   *   press / fore は ORPHE INSOLE のときだけ付く（押しぐあいと、つま先／かかとのどちらでふんだか）。
   *   点数には使わず、そのままログ（CSV）に出す
   * @param {number} [input.feet] 使った足の数（1 | 2）。省略時はログから判断
   * @returns {object} 解析結果
   */
  function analyze(input) {
    input = input || {};
    var steps = (input.steps || [])
      .filter(function (s) { return s && isFinite(s.t) && isFinite(s.peak); })
      .map(function (s) {
        return {
          t: s.t, foot: s.foot === 1 ? 1 : 0, peak: Math.max(0, s.peak), rest: !!s.rest,
          press: isFinite(s.press) && s.press !== null ? Number(s.press) : null,
          fore: isFinite(s.fore) && s.fore !== null ? Number(s.fore) : null
        };
      })
      .sort(function (a, b) { return a.t - b.t; });
    var n = steps.length;

    var nFoot = [0, 0];
    var peaksByFoot = [[], []];
    for (var i = 0; i < n; i++) {
      nFoot[steps[i].foot]++;
      peaksByFoot[steps[i].foot].push(steps[i].peak);
    }
    var feet = input.feet === 1 || input.feet === 2 ? input.feet : ((nFoot[0] > 0 && nFoot[1] > 0) ? 2 : 1);

    // --- 間隔と「ひとやすみ」 ---
    var gaps = [];
    for (i = 1; i < n; i++) gaps.push(steps[i].t - steps[i - 1].t);
    var med = median(gaps);
    var restThreshold = Math.max(2000, med * 3);
    var active = [];      // ひとやすみを除いた間隔
    var restCount = 0, restMs = 0;
    var isRest = [];
    for (i = 0; i < gaps.length; i++) {
      // 長くあいた間隔、または「ひとやすみ明け」と印のついた 1 ふみの直前は、ひとやすみ
      var r = gaps[i] > restThreshold || steps[i + 1].rest;
      isRest.push(r);
      if (r) { restCount++; restMs += gaps[i]; } else { active.push(gaps[i]); }
    }
    var activeMs = 0;
    for (i = 0; i < active.length; i++) activeMs += active[i];
    var totalMs = n > 1 ? steps[n - 1].t - steps[0].t : 0;
    var cadence = activeMs > 0 ? active.length / activeMs * 60000 : 0;
    var activeMedian = median(active);
    var rhythmCv = cv(active);

    // --- 左右 ---
    var meanPeak = [mean(peaksByFoot[0]), mean(peaksByFoot[1])];
    var alternations = 0, pairs = 0;
    var lr = [], rl = [];
    for (i = 0; i < gaps.length; i++) {
      if (isRest[i]) continue;
      pairs++;
      if (steps[i].foot !== steps[i + 1].foot) {
        alternations++;
        (steps[i].foot === 0 ? lr : rl).push(gaps[i]);
      }
    }
    var alternation = pairs > 0 ? alternations / pairs : 0;
    var countSym = symmetry(nFoot[0], nFoot[1]);
    var powerSym = symmetry(meanPeak[0], meanPeak[1]);
    var timingSym = (lr.length >= 2 && rl.length >= 2) ? symmetry(mean(lr), mean(rl)) : 1;

    // --- 強さ ---
    var allPeaks = steps.map(function (s) { return s.peak; });
    var medianPeak = median(allPeaks);
    var peakCv;
    if (feet === 2 && peaksByFoot[0].length >= 3 && peaksByFoot[1].length >= 3) {
      // 左右で強さが違っても「そろっていない」とは数えない（それはバランスで見る）
      peakCv = (cv(peaksByFoot[0]) * nFoot[0] + cv(peaksByFoot[1]) * nFoot[1]) / n;
    } else {
      peakCv = cv(allPeaks);
    }

    // --- 前半と後半 ---
    var paceRatio = null, peakRatio = null;
    if (n >= MIN_STEPS_STAMINA) {
      var third = Math.floor(n / 3);
      var cadOf = function (from, to) {      // steps[from..to] の区間のケイデンス
        var ms = 0, c = 0;
        for (var j = from; j < to; j++) if (!isRest[j]) { ms += gaps[j]; c++; }
        return ms > 0 ? c / ms * 60000 : 0;
      };
      var first = cadOf(0, third);
      var last = cadOf(gaps.length - third, gaps.length);
      paceRatio = first > 0 ? last / first : null;
      var pFirst = mean(allPeaks.slice(0, third));
      var pLast = mean(allPeaks.slice(n - third));
      peakRatio = pFirst > 0 ? pLast / pFirst : null;
    }

    // --- いちばん長く続いた「いいリズム」 ---
    var bestStreak = 0, streak = 0;
    for (i = 0; i < gaps.length; i++) {
      if (!isRest[i] && activeMedian > 0 && Math.abs(gaps[i] - activeMedian) <= activeMedian * 0.2) {
        streak++;
        if (streak > bestStreak) bestStreak = streak;
      } else {
        streak = 0;
      }
    }
    if (bestStreak > 0) bestStreak += 1; // 間隔の数 → ふみの数

    // --- グラフ用: ケイデンスの移り変わり（直近 4 間隔の平均） ---
    var series = [];
    var win = [];
    for (i = 0; i < gaps.length; i++) {
      if (isRest[i]) { win = []; continue; }
      win.push(gaps[i]);
      if (win.length > 4) win.shift();
      if (win.length >= 2) series.push({ t: steps[i + 1].t - steps[0].t, spm: 60000 / mean(win) });
    }

    // --- スコア ---
    var ok = n >= MIN_STEPS && active.length >= 4;
    var scores = {
      rhythm: ok ? curve(rhythmCv, CURVES.rhythmCv) : null,
      tempo: ok ? curve(cadence, CURVES.cadence) : null,
      balance: (ok && feet === 2)
        ? curve(0.3 * countSym + 0.25 * powerSym + 0.2 * timingSym + 0.25 * alternation, CURVES.balance)
        : null,
      power: ok ? curve(medianPeak, CURVES.peakG) : null,
      stamina: (ok && paceRatio !== null)
        ? 0.7 * curve(Math.min(paceRatio, 1), CURVES.paceRatio) +
          0.3 * curve(Math.min(peakRatio === null ? 1 : peakRatio, 1), CURVES.paceRatio)
        : null,
      steady: ok ? curve(peakCv, CURVES.peakCv) : null
    };

    var share = n > 0 ? [nFoot[0] / n, nFoot[1] / n] : [0, 0];
    var display = {
      rhythm: 'ばらつき ' + Math.round(rhythmCv * 100) + '%',
      tempo: Math.round(cadence) + ' ふみ/分',
      balance: feet === 2 ? ('左 ' + Math.round(share[0] * 100) + ' : 右 ' + Math.round(share[1] * 100)) : 'CORE 2台で計測',
      power: medianPeak.toFixed(2) + ' G',
      stamina: paceRatio === null ? 'もう少しふむと計測' : ('後半のペース ' + Math.round(Math.min(paceRatio, 1.5) * 100) + '%'),
      steady: 'ばらつき ' + Math.round(peakCv * 100) + '%'
    };

    var axes = AXES.map(function (a) {
      var s = scores[a.key];
      return {
        key: a.key, label: a.label, desc: a.desc, weight: a.weight,
        score: s === null ? null : Math.round(clamp(s, 0, 100)),
        display: display[a.key]
      };
    });

    var wSum = 0, total = 0;
    var bestAxis = null, weakAxis = null;
    axes.forEach(function (a) {
      if (a.score === null) return;
      wSum += a.weight;
      total += a.weight * a.score;
      if (!bestAxis || a.score > bestAxis.score) bestAxis = a;
      if (!weakAxis || a.score < weakAxis.score) weakAxis = a;
    });
    total = wSum > 0 ? Math.round(total / wSum) : 0;

    var praise, tip;
    if (!ok) {
      praise = 'おつかれさまでした。';
      tip = 'もう少し長くふむと、リズムやバランスをくわしく見られます。';
    } else {
      praise = PRAISE[bestAxis.key];
      tip = weakAxis.key === 'balance' && feet === 2
        ? ((share[0] < share[1] || (share[0] === share[1] && meanPeak[0] < meanPeak[1]) ? '左' : '右') +
           '足を少しだけ意識して。' + TIPS.balance)
        : TIPS[weakAxis.key];
      if (bestAxis.key === weakAxis.key || weakAxis.score >= 85) {
        tip = 'どの項目もそろっています。この調子で、ときどき続けてみましょう。';
      }
    }

    return {
      ok: ok,
      feet: feet,
      stepCount: n,
      totalSec: totalMs / 1000,
      activeSec: activeMs / 1000,
      restSec: restMs / 1000,
      restCount: restCount,
      cadence: cadence,
      interval: { mean: mean(active), median: activeMedian, sd: sd(active), cv: rhythmCv },
      left: { count: nFoot[0], share: share[0], meanPeak: meanPeak[0] },
      right: { count: nFoot[1], share: share[1], meanPeak: meanPeak[1] },
      alternation: alternation,
      countSymmetry: countSym,
      powerSymmetry: powerSym,
      timingSymmetry: timingSym,
      medianPeak: medianPeak,
      peakCv: peakCv,
      paceRatio: paceRatio,
      peakRatio: peakRatio,
      bestStreak: bestStreak,
      axes: axes,
      total: total,
      rank: rankFor(total),
      bestAxis: bestAxis ? bestAxis.key : null,
      weakAxis: weakAxis ? weakAxis.key : null,
      praise: praise,
      tip: tip,
      series: {
        cadence: series,
        steps: steps.map(function (s, idx) {
          return {
            t: s.t - (n ? steps[0].t : 0), foot: s.foot, peak: s.peak, afterRest: idx > 0 && isRest[idx - 1],
            press: s.press, fore: s.fore
          };
        })
      }
    };
  }

  /** 解析結果のうち、きろく（履歴）に残す最小限の値 */
  function summarize(result) {
    var axes = {};
    result.axes.forEach(function (a) { axes[a.key] = a.score; });
    return {
      total: result.total,
      rank: result.rank.key,
      steps: result.stepCount,
      activeSec: Math.round(result.activeSec),
      cadence: Math.round(result.cadence),
      axes: axes
    };
  }

  /** ふみふみログを CSV にする（健康づくりの記録や、スタッフとの共有用） */
  function toCsv(result) {
    var steps = result.series.steps;
    // ORPHE INSOLE で遊んだときだけ、圧力の列を足す
    var withPress = steps.some(function (s) { return s.press !== null && s.press !== undefined; });
    var rows = ['no,time_sec,foot,strength_g,interval_sec,after_rest' + (withPress ? ',press_rel,fore_aft' : '')];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      rows.push([
        i + 1,
        (s.t / 1000).toFixed(3),
        s.foot === 0 ? 'L' : 'R',
        s.peak.toFixed(3),
        i === 0 ? '' : ((s.t - steps[i - 1].t) / 1000).toFixed(3),
        s.afterRest ? 1 : 0
      ].concat(withPress ? [
        s.press === null || s.press === undefined ? '' : s.press.toFixed(2),
        s.fore === null || s.fore === undefined ? '' : s.fore.toFixed(2)
      ] : []).join(','));
    }
    return rows.join('\n') + '\n';
  }

  var UdonHealth = {
    AXES: AXES,
    RANKS: RANKS,
    CURVES: CURVES,
    MIN_STEPS: MIN_STEPS,
    analyze: analyze,
    summarize: summarize,
    toCsv: toCsv,
    curve: curve,
    rankFor: rankFor
  };

  root.UdonHealth = UdonHealth;
  if (typeof module !== 'undefined' && module.exports) module.exports = UdonHealth;
})(typeof globalThis !== 'undefined' ? globalThis : this);
