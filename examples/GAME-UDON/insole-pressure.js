/**
 * ORPHE INSOLE の 6ch 圧力 → 「ふみ」と、足うらの押しぐあい（UdonInsolePressure）
 *
 * ORPHE INSOLE の圧力は ADC の生値で、足をのせていなくても 1ch あたり 220 前後の値が出ています
 * （チャネルや個体によって 256 前後のものもある）。くつをはいて立っているだけでも、
 * いくつかのチャネルは最初から数百上がったままです。そこで、値そのものではなく
 *
 *   押しぐあい = いまの値 − そのチャネルの「床」（直近 8 秒の最小値）
 *
 * で見ます。床はチャネルごとに自動で追いかけるので、はじめに「足を上げてください」のような
 * 校正は要りません（足を 1 回上げれば、その瞬間に本当の無負荷まで下がります）。
 *
 * 「ふみ」は 6ch の押しぐあいの合計が、谷から十分に立ち上がったときに 1 回数えます。
 * 加速度だけで数えると、ゆっくり足を上げ下げしたときに「上げた瞬間」と「着地」の両方を
 * 数えてしまうことがありますが、圧力は着地で 1 回だけ立ち上がるので数えまちがえません。
 * 足を床から離さない、体重を左右に移すだけの足踏みも数えられます。
 *
 * しきい値は「無負荷の合計値に対する割合」で持ちます（ADC 生値の製品版でも、mV×10 で届く
 * INSOLE 1.5 でも同じ式で動くように）。純ロジックなので Node でテストできます
 * （tests/udon-insole-pressure.test.js）。
 */
(function (root) {
  'use strict';

  var CH = 6;

  /**
   * 圧力センサの位置（足うらを上から見た図）。x: 0 = 外側（小指側）… 1 = 内側（親指側）、
   * y: 0 = つま先 … 1 = かかと。ORPHE-INSOLE.js の OrpheInsoleUtils.SENSOR_LAYOUT_IMAGE と同じ値。
   * press.values[i] は公式のセンサ番号 i + 1 に対応する。
   */
  var LAYOUT = [
    { x: 0.7596, y: 0.1680, zone: 'fore', name: 'つま先（内）' },
    { x: 0.7513, y: 0.3320, zone: 'fore', name: '母趾球' },
    { x: 0.4024, y: 0.2210, zone: 'fore', name: 'つま先（外）' },
    { x: 0.5245, y: 0.3483, zone: 'mid', name: '中足部（中）' },
    { x: 0.2884, y: 0.3681, zone: 'mid', name: '中足部（外）' },
    { x: 0.5552, y: 0.8206, zone: 'heel', name: 'かかと' }
  ];

  /**
   * 感度（step-detector.js の LEVELS と同じ番号）。rise = 1 ふみに必要な立ち上がり。
   * 無負荷の合計値（製品版で 1360 前後）に対する割合で、製品版ではおよそ 350 / 165 / 90 / 52 / 30。
   */
  var LEVELS = [
    { id: 1, rise: 0.26 },
    { id: 2, rise: 0.12 },
    { id: 3, rise: 0.065 },
    { id: 4, rise: 0.038 },
    { id: 5, rise: 0.022 }
  ];

  var DEFAULTS = {
    level: 2,
    floorWindowMs: 8000,      // 床（無負荷の値）を探す時間幅
    floorBucketMs: 500,
    smoothTauMs: 12,          // 各チャネルのならし
    attackTauMs: 12,          // 合計の包絡線
    releaseTauMs: 35,
    guardRatio: 0.008,        // ノイズとみなす幅（無負荷の合計値に対する割合）
    guardMin: 8,
    bumpRatio: 2,             // guard のこの倍より大きい山を「押した」とみなす
    fallRatio: 0.35,          // 山の高さのこれだけ戻ったら、次の山を待つ
    relRiseRatio: 0.2,        // 強くふんでいる間は、小さなゆれを数えない（最近の山の高さに対する割合）
    levelTauMs: 700,
    refractoryMs: 150,
    activeHoldMs: 4000,       // 最後に圧力でふみを数えてから、この間は「圧力で数えられている」とみなす
    unloadHoldMs: 1200,       // 足を上げて圧が抜けた直後も同じ（その瞬間の加速度は「上げた」動きで、着地ではない）
    spanAlpha: 0.3,           // その人の「いつもの押しぐあい」の学習の速さ
    spanInitRatio: 0.3,
    spanMinRatio: 0.06,
    spanOutlier: 2.5,
    spanHeadroom: 1.15,
    padShare: 0.5,            // いちばん押されるチャネルは、合計のおよそ半分を受け持つ
    loadTauMs: 45,
    copTauMs: 60,
    missWindowMs: 6000,
    staleMs: 1500,
    defaultDtMs: 5
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function zeros() { return [0, 0, 0, 0, 0, 0]; }
  function median3(a, b, c) { return a > b ? (b > c ? b : (a > c ? c : a)) : (a > c ? a : (b > c ? c : b)); }

  function levelById(id) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === Number(id)) return LEVELS[i];
    return null;
  }

  function makeStats() {
    return { ms: 0, loadedMs: 0, impulse: zeros(), steps: 0, relSum: 0 };
  }

  function makeFoot(keep) {
    return {
      ready: false, lastT: -1e9, samples: 0,
      rateT0: null, rateN: 0, dtEst: null,
      h1: zeros(), h2: zeros(),
      x: zeros(), floor: zeros(), bucketMin: zeros(), buckets: [], bucketT0: 0, floorTotal: 0,
      d: zeros(), sum: 0, env: 0,
      high: false, valley: 0, peak: 0, counted: false, level: 0, cur: null,
      lastStepT: -1e9, unloadT: -1e9, floorRef: 0,
      span: keep ? keep.span : null, learned: keep ? keep.learned : 0,
      load: 0, pads: zeros(), copX: 0.5, copY: 0.5, copValid: false,
      missed: [],
      stats: keep ? keep.stats : makeStats()
    };
  }

  /**
   * @param {object} [options] DEFAULTS を上書きする設定。onStep(step) を渡すと検出ごとに呼ばれる。
   *   step = { foot, t, source: 'press', rise: 立ち上がりの大きさ, rel: その人のいつもの押しぐあいに対する割合,
   *            fore: -1（かかと）〜 +1（つま先）, peak: 0（加速度の強さ。呼び出し側が入れる） }
   */
  function UdonInsolePressure(options) {
    options = options || {};
    this.cfg = {};
    for (var k in DEFAULTS) this.cfg[k] = (options[k] !== undefined) ? options[k] : DEFAULTS[k];
    this.onStep = options.onStep || null;
    this.record = false;     // true の間だけ、リザルト用の集計（stats）をためる
    this.feet = [makeFoot(), makeFoot()];
  }

  UdonInsolePressure.LAYOUT = LAYOUT;
  UdonInsolePressure.LEVELS = LEVELS;
  UdonInsolePressure.DEFAULTS = DEFAULTS;
  UdonInsolePressure.CHANNELS = CH;
  UdonInsolePressure.levelById = levelById;

  /** 感度をプリセット番号（1〜5）で設定 */
  UdonInsolePressure.prototype.setLevel = function (id) {
    var lv = levelById(id) || LEVELS[1];
    this.cfg.level = lv.id;
    return lv;
  };

  UdonInsolePressure.prototype.getLevel = function () { return this.cfg.level; };

  UdonInsolePressure.prototype.reset = function (foot) {
    if (foot === 0 || foot === 1) { this.feet[foot] = makeFoot(); return; }
    this.feet = [makeFoot(), makeFoot()];
  };

  UdonInsolePressure.prototype.resetStats = function () {
    this.feet[0].stats = makeStats();
    this.feet[1].stats = makeStats();
  };

  /** その足の圧力が最近（既定 1.5 秒以内）届いているか */
  UdonInsolePressure.prototype.isLive = function (foot, nowMs, withinMs) {
    return (nowMs - this.feet[foot].lastT) <= (withinMs || this.cfg.staleMs);
  };

  /**
   * 圧力で「ふみ」を数えられているか。最近、圧力のふみがあったか、足を上げて圧が抜けたところ。
   * この間は加速度のふみを使わない
   */
  UdonInsolePressure.prototype.isActive = function (foot, nowMs) {
    var st = this.feet[foot];
    return (nowMs - st.lastStepT) <= this.cfg.activeHoldMs || (nowMs - st.unloadT) <= this.cfg.unloadHoldMs;
  };

  UdonInsolePressure.prototype._guard = function (st) {
    return Math.max(this.cfg.guardMin, st.floorTotal * this.cfg.guardRatio);
  };

  /** 1 ふみに必要な立ち上がり（いま効いている値） */
  UdonInsolePressure.prototype.threshold = function (foot) {
    return this._threshold(this.feet[foot]);
  };

  UdonInsolePressure.prototype._threshold = function (st) {
    var c = this.cfg;
    var lv = levelById(c.level) || LEVELS[1];
    return Math.max(lv.rise * st.floorTotal, this._guard(st) * c.bumpRatio * 1.2, st.level * c.relRiseRatio);
  };

  /** メーター表示用: 谷からの立ち上がり ÷ しきい値（1 で「ふみ」になる） */
  UdonInsolePressure.prototype.meter = function (foot) {
    var st = this.feet[foot];
    if (!st.ready) return 0;
    return Math.max(0, st.env - st.valley) / this._threshold(st);
  };

  /** 足うら全体の押しぐあい 0〜1（その人のいつもの押しぐあいを 1 とする） */
  UdonInsolePressure.prototype.load = function (foot) { return this.feet[foot].load; };

  /** センサごとの押しぐあい 0〜1（6 個） */
  UdonInsolePressure.prototype.pads = function (foot) { return this.feet[foot].pads; };

  /**
   * 圧力の中心。x: 0 = 外側 … 1 = 内側、y: 0 = つま先 … 1 = かかと、fore: -1 = かかと … +1 = つま先。
   * valid が false のとき（足が浮いている）は、最後の値のまま
   */
  UdonInsolePressure.prototype.cop = function (foot) {
    var st = this.feet[foot];
    return { x: st.copX, y: st.copY, fore: clamp((0.5 - st.copY) / 0.33, -1, 1), valid: st.copValid };
  };

  /** 直近（既定 6 秒）に、しきい値に届かなかった山がいくつあったか（感度アシスト用） */
  UdonInsolePressure.prototype.missedCount = function (foot, nowMs) {
    var st = this.feet[foot], from = nowMs - this.cfg.missWindowMs, n = 0;
    for (var i = 0; i < st.missed.length; i++) if (st.missed[i] >= from) n++;
    return n;
  };

  UdonInsolePressure.prototype.clearMissed = function () {
    this.feet[0].missed = [];
    this.feet[1].missed = [];
  };

  /**
   * リザルト用の集計。record = true の間に届いたサンプルから、足うらのどこに体重がのっていたかを出す。
   * @returns {{ ok:boolean, ms:number, loadedRatio:number, share:number[], fore:number, mid:number, heel:number,
   *            inner:number, steps:number, rel:number }}
   *   share = センサごとの割合（合計 1）、fore/mid/heel = つま先・まんなか・かかとの割合、
   *   inner = 内側（親指側）の割合、steps = 圧力で見つけたふみの数（ゲームが数えたふみ数とは、加速度と
   *   まとめたぶんだけ違うことがある）、rel = その押しぐあいの平均（いつもの押しぐあい = 1）
   */
  UdonInsolePressure.prototype.summary = function (foot) {
    var s = this.feet[foot].stats;
    var total = 0, i;
    for (i = 0; i < CH; i++) total += s.impulse[i];
    var out = {
      ok: s.ms >= 3000 && total > 0, ms: s.ms, loadedRatio: s.ms > 0 ? s.loadedMs / s.ms : 0,
      share: zeros(), fore: 0, mid: 0, heel: 0, inner: 0, steps: s.steps, rel: s.steps ? s.relSum / s.steps : 0
    };
    if (total <= 0) return out;
    var wx = 0;
    for (i = 0; i < CH; i++) {
      out.share[i] = s.impulse[i] / total;
      out[LAYOUT[i].zone] += out.share[i];
      wx += out.share[i] * LAYOUT[i].x;
    }
    // センサの x の範囲（0.29〜0.76）を 0〜1 に引きのばす
    out.inner = clamp((wx - 0.2884) / (0.7596 - 0.2884), 0, 1);
    return out;
  };

  /**
   * 圧力サンプルを 1 つ入れる。
   * @param {number} foot 0 | 1
   * @param {ArrayLike<number>} values press.values（6ch の生値）
   * @param {number} tMs 共通の時計での受信時刻 [ms]（performance.now()）
   * @returns {object|null} このサンプルで「ふみ」を検出したら step、なければ null
   */
  UdonInsolePressure.prototype.push = function (foot, values, tMs) {
    if (foot !== 0 && foot !== 1) return null;
    if (!values || values.length < CH || !isFinite(tMs)) return null;
    var c = this.cfg;
    var st = this.feet[foot];
    var i, v;
    for (i = 0; i < CH; i++) if (!isFinite(values[i])) return null;

    // 長く途切れたあと（再接続など）は作り直す。その人のいつもの押しぐあいと集計は残す
    if (st.ready && (tMs - st.lastT) > c.staleMs) this.feet[foot] = st = makeFoot(st);

    // --- サンプル間隔 dt（BLE は 1 パケットに複数サンプルが入るので、届いた数から見積もる） ---
    if (st.rateT0 === null) { st.rateT0 = tMs; st.rateN = 0; }
    st.rateN++;
    if (tMs - st.rateT0 >= 500) {
      st.dtEst = clamp((tMs - st.rateT0) / st.rateN, 2, 60);
      st.rateT0 = tMs; st.rateN = 0;
    }
    var dt = st.dtEst || c.defaultDtMs;
    st.lastT = tMs;
    st.samples++;

    // --- 1) 1 サンプルだけの飛び値を 3 点メディアンで落とし、軽くならす ---
    var aS = 1 - Math.exp(-dt / c.smoothTauMs);
    var first = !st.ready;
    for (i = 0; i < CH; i++) {
      v = clamp(Number(values[i]), 0, 65535);
      var m = first ? v : median3(v, st.h1[i], st.h2[i]);
      st.h2[i] = first ? v : st.h1[i];
      st.h1[i] = v;
      st.x[i] = first ? m : st.x[i] + (m - st.x[i]) * aS;
    }

    // --- 2) チャネルごとの床（直近の最小値） ---
    if (first) {
      st.ready = true;
      st.bucketT0 = tMs;
      for (i = 0; i < CH; i++) st.floor[i] = st.bucketMin[i] = st.x[i];
    } else if (tMs - st.bucketT0 >= c.floorBucketMs) {
      st.buckets.push(st.bucketMin.slice());
      var keep = Math.max(1, Math.round(c.floorWindowMs / c.floorBucketMs));
      while (st.buckets.length > keep) st.buckets.shift();
      st.bucketT0 = tMs;
      for (i = 0; i < CH; i++) {
        st.bucketMin[i] = st.x[i];
        var f = st.x[i];
        for (var b = 0; b < st.buckets.length; b++) if (st.buckets[b][i] < f) f = st.buckets[b][i];
        st.floor[i] = f;
      }
    } else {
      for (i = 0; i < CH; i++) {
        if (st.x[i] < st.bucketMin[i]) st.bucketMin[i] = st.x[i];
        if (st.x[i] < st.floor[i]) st.floor[i] = st.x[i];
      }
    }
    var floorTotal = 0, sum = 0;
    for (i = 0; i < CH; i++) {
      floorTotal += st.floor[i];
      st.d[i] = Math.max(0, st.x[i] - st.floor[i]);
      sum += st.d[i];
    }
    st.floorTotal = floorTotal;
    st.sum = sum;

    // --- 3) 合計の包絡線 ---
    st.env += (sum - st.env) * (1 - Math.exp(-dt / (sum > st.env ? c.attackTauMs : c.releaseTauMs)));
    var env = st.env;

    var guard = this._guard(st);
    var bumpMin = guard * c.bumpRatio;

    // 立ったまま接続したあと、はじめて足を上げたとき: 床が一気に下がる（押しぐあいは 0 のまま）。
    // 圧力センサが足に反応している証拠なので、「圧が抜けた」時刻として覚えておく
    if (first) st.floorRef = floorTotal;
    else if (st.floorRef - floorTotal >= bumpMin) { st.unloadT = tMs; st.floorRef = floorTotal; }
    else if (floorTotal > st.floorRef) st.floorRef = floorTotal;
    if (st.span === null) st.span = Math.max(c.spanInitRatio * floorTotal, bumpMin * 4);
    var spanFloor = Math.max(c.spanMinRatio * floorTotal, bumpMin * 2);

    // --- 4) 表示用: 押しぐあい・センサごとの値・圧力の中心 ---
    var full = Math.max(st.span, spanFloor) * c.spanHeadroom;
    var aL = 1 - Math.exp(-dt / c.loadTauMs);
    st.load += (clamp(env / full, 0, 1) - st.load) * aL;
    for (i = 0; i < CH; i++) st.pads[i] += (clamp(st.d[i] / (full * c.padShare), 0, 1) - st.pads[i]) * aL;
    st.copValid = sum >= bumpMin;
    if (st.copValid) {
      var cx = 0, cy = 0;
      for (i = 0; i < CH; i++) { cx += st.d[i] * LAYOUT[i].x; cy += st.d[i] * LAYOUT[i].y; }
      var aC = 1 - Math.exp(-dt / c.copTauMs);
      st.copX += (cx / sum - st.copX) * aC;
      st.copY += (cy / sum - st.copY) * aC;
    }

    // --- 5) リザルト用の集計 ---
    if (this.record) {
      st.stats.ms += dt;
      if (sum >= bumpMin) {
        st.stats.loadedMs += dt;
        for (i = 0; i < CH; i++) st.stats.impulse[i] += st.d[i] * dt;
      }
    }

    // --- 6) ふみの判定（谷と山を追いかける） ---
    st.level *= Math.exp(-dt / c.levelTauMs);
    if (!st.high) {
      if (env < st.valley) st.valley = env;
      if (env - st.valley < bumpMin) return null;
      st.high = true;
      st.peak = env;
      st.counted = false;
    }
    if (env > st.peak) st.peak = env;
    var amp = st.peak - st.valley;
    if (st.cur) { st.cur.rise = amp; st.cur.rel = amp / Math.max(st.span, spanFloor); }

    var step = null;
    if (!st.counted && (env - st.valley) >= this._threshold(st)) {
      st.counted = true;
      if (tMs - st.lastStepT >= c.refractoryMs) {
        st.lastStepT = tMs;
        step = {
          foot: foot, t: tMs, source: 'press', peak: 0,
          rise: amp, rel: amp / Math.max(st.span, spanFloor),
          fore: clamp((0.5 - st.copY) / 0.33, -1, 1)
        };
        st.cur = step;
        if (this.record) st.stats.steps++;
      }
    }

    // 山から十分に戻った: この山はおしまい
    if (env <= st.peak - amp * c.fallRatio) {
      if (amp > st.level) st.level = amp;
      if (st.cur) {
        // その人の「いつもの押しぐあい」は、ふみとして数えた山から覚える
        // （とびぬけて強い 1 回や、ふみの合間の小さなゆれに引っぱられないようにする）
        // 最初の数回は平均で（はじめの見積もりから早くはなれる）、そのあとはゆっくり追いかける
        var p = Math.min(st.peak, st.span * c.spanOutlier);
        st.learned++;
        st.span += (p - st.span) * Math.max(c.spanAlpha, 1 / st.learned);
        if (this.record) st.stats.relSum += st.cur.rel;
        st.cur = null;
        // ふみとして数えた山が終わった = 足を上げて圧が抜けた。長く立っていたあとでも、
        // この瞬間の加速度（足を上げる動き）は着地ではない。
        // 数えなかった小さな山では覚えない（圧力で数えられていないのに、加速度のふみまで止めてしまうため）
        st.unloadT = tMs;
      } else if (!st.counted) {
        st.missed.push(tMs);
        if (st.missed.length > 40) st.missed.shift();
      }
      st.high = false;
      st.valley = env;
    }

    if (step && this.onStep) this.onStep(step);
    return step;
  };

  /**
   * 加速度のふみ（step-detector.js）と圧力のふみを、1 つにまとめる。
   *
   * 実機のログ（片足 35 秒・着地 33 回）で確かめると、加速度だけでは感度によって数がぶれる:
   * 「ふつう」で 43 回、「やさしい」で 49 回（足を上げた瞬間も数えている）、「しっかり」では 16 回（数え落とし）。
   * 圧力は着地で 1 回だけ立ち上がり、どの感度でも 33〜34 回だった。そこで、圧力でふみを数えられている間は
   * 圧力を正とし、加速度のふみは使わない。圧力が反応していない間（センサに足が当たっていない・足を浮かせたままの
   * 足踏み・手に持って動かしたとき）は、CORE と同じように加速度で数える。
   *
   *   var fusion = new UdonInsolePressure.Fusion(press);
   *   // 加速度 1 サンプルごと:  fusion.track(foot, detector.level(foot), now)
   *   // 加速度のふみ:           if (fusion.acceptImu(step, now)) …数える
   *   // 圧力のふみ:             if (fusion.acceptPress(step, now)) …数える（step.peak に加速度の強さ [G] が入る）
   *   // 同じ着地を両方が見つけたときは、先に数えた加速度のふみに imuStep.sole = 圧力のふみ が付く
   */
  function Fusion(press, options) {
    options = options || {};
    this.press = press;
    this.mergeMs = options.mergeMs || 180;           // 同じ着地を両方が見つけたとき、1 つにまとめる時間幅
    this.peakTrackMs = options.peakTrackMs || 220;   // 圧力のふみのあと、加速度の山を追いかける時間
    this.holdTauMs = options.holdTauMs || 150;
    this.reset();
  }

  Fusion.prototype.reset = function () {
    this.last = [-1e9, -1e9];
    this.hold = [0, 0];
    this.holdT = [0, 0];
    this.cur = [null, null];
    this.lastImu = [null, null];
  };

  /** 加速度の包絡線 [G] を 1 サンプルごとに渡す（ふみの強さを、着地の前後の山からとるため） */
  Fusion.prototype.track = function (foot, env, nowMs) {
    this.hold[foot] = Math.max(env, this.hold[foot] * Math.exp(-(nowMs - this.holdT[foot]) / this.holdTauMs));
    this.holdT[foot] = nowMs;
    var cur = this.cur[foot];
    if (!cur) return;
    if (nowMs - cur.t <= this.peakTrackMs) { if (env > cur.peak) cur.peak = env; }
    else this.cur[foot] = null;
  };

  /** 加速度のふみを数えてよいか */
  Fusion.prototype.acceptImu = function (step, nowMs) {
    if (this.press.isActive(step.foot, nowMs)) return false;
    if (nowMs - this.last[step.foot] < this.mergeMs) return false;
    this.last[step.foot] = nowMs;
    this.lastImu[step.foot] = step;
    return true;
  };

  /** 圧力のふみを数えてよいか。数えるときは step.peak に加速度の強さを入れる */
  Fusion.prototype.acceptPress = function (step, nowMs) {
    if (nowMs - this.last[step.foot] < this.mergeMs) {
      // 同じ着地を、加速度が先に数えていた。ふみは増やさず、押しぐあいだけ、数えたほうのふみに付けておく
      if (this.lastImu[step.foot]) this.lastImu[step.foot].sole = step;
      return false;
    }
    this.last[step.foot] = nowMs;
    this.lastImu[step.foot] = null;
    step.peak = this.hold[step.foot];
    this.cur[step.foot] = step;
    return true;
  };

  UdonInsolePressure.Fusion = Fusion;

  root.UdonInsolePressure = UdonInsolePressure;
  if (typeof module !== 'undefined' && module.exports) module.exports = UdonInsolePressure;
})(typeof globalThis !== 'undefined' ? globalThis : this);
