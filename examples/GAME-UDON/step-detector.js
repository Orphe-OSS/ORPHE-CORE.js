/**
 * ふみふみ検出器（UdonStepDetector）
 *
 * ORPHE CORE の加速度（G）から「ふみ」を検出する純ロジックです。DOM にも SDK にも依存しないので、
 * Node（tests/udon-step-detector.test.js）でもブラウザでも同じコードが動きます。
 *
 * しくみ（1 サンプルごと）:
 *   1. 重力の推定  足が止まっている瞬間（接地中）にすばやく合わせ、動いている間はほとんど動かさない
 *                  （動きに引きずられると、ふんだあとに「余韻」が残って次のふみを数えられなくなるため）
 *   2. 動きの大きさ dyn = |acc − g|   … 足の向きに関係なく「どれだけ動いたか」[G]
 *   3. なめらかな包絡線 env（立ち上がりは速く、戻りはゆっくり）
 *   4. env の「山」と「谷」を追いかける。しきい値を超え、かつ直前の谷から十分に立ち上がったら 1 ふみ。
 *      次を数えるには、山から 3 割ほど下がればよい（速くバタバタふんで、包絡線がしきい値まで
 *      下がりきらなくても数えられる）。
 *      ＋同じ足の連続検出を防ぐ不応期（足踏みが速いときは自動で短くなる）
 *      ＋反対の足への振動の伝わり（クロストーク）対策
 *
 * しきい値（＝感度）を下げれば、座ったままのやさしい足踏みでも反応します。
 * 従来版は「連続 2 サンプルの差が 0.06（正規化値）以上」という衝撃ベースの判定で、
 * ±16G レンジではおよそ 1G の鋭い衝撃が必要でした。
 */
(function (root) {
  'use strict';

  /**
   * 感度プリセット。threshold は「重力を除いた動きの大きさ」[G]。
   * 数字が小さいほど、弱い足踏みでも「ふみ」になる。
   */
  var LEVELS = [
    { id: 1, key: 'firm', label: 'しっかり', hint: '元気にふみこむ人向け', threshold: 1.2, refractoryMs: 260 },
    { id: 2, key: 'normal', label: 'ふつう', hint: '立って足踏み', threshold: 0.6, refractoryMs: 280 },
    { id: 3, key: 'soft', label: 'やさしい', hint: 'ゆっくり足踏み', threshold: 0.32, refractoryMs: 320 },
    { id: 4, key: 'softer', label: 'とてもやさしい', hint: 'いすに座って足踏み', threshold: 0.18, refractoryMs: 360 },
    { id: 5, key: 'feather', label: 'ふわふわ', hint: 'かかとの上げ下げだけでも', threshold: 0.1, refractoryMs: 400 }
  ];

  var MIN_THRESHOLD = 0.06;
  var MAX_THRESHOLD = 2.5;

  var DEFAULTS = {
    threshold: 0.6,       // [G]
    refractoryMs: 280,    // 同じ足が次に数えられるまでの最短時間（ゆっくりふんでいるとき）
    minRefractoryMs: 170, // 速くふんでいるときは、ここまで短くなる
    refractoryIntervalRatio: 0.45, // 不応期 ＝ 直近のふみ間隔 × この割合
    crossLockMs: 140,     // 反対の足の直後は、クロストークかどうかを確かめる
    crossRatio: 0.5,      // 反対の足の大きさのこの割合に満たない動きは、伝わってきた振動とみなす
    rearmRatio: 0.55,     // しきい値のこの割合まで下がったら再び検出可能
    fallRatio: 0.3,       // または、山からこの割合ぶん下がったら（速い足踏みでも次を数えられるように）
    riseRatio: 0.3,       // 谷から「しきい値 × この割合」ぶん立ち上がって、はじめて「ふみ」
    relRiseRatio: 0.2,    // 強くふんでいるときは「最近の山の高さ × この割合」ぶんの立ち上がりが要る
    levelTauMs: 700,      // 「最近の山の高さ」を覚えておく時間
    oppositeCos: -0.3,    // 前のふみと逆向きの動き（cos がこれ未満）が…
    oppositeRatio: 0.7,   // …直近のふみ間隔のこの割合より早く来たら、同じ 1 歩の「行き・帰り」とみなして数えない
    dirTauMs: 30,         // 動きの向きをならす時間
    gravityTauMs: 1500,   // 重力推定: 動いている間の時定数（ゆっくり）
    gravityStillTauMs: 40, //          止まっている間の時定数（すばやく合わせる）
    gravityClampG: 0.3,   // 動いている間の 1 回の修正量の上限（衝撃で引きずられない）
    settleTauMs: 110,     // 接続直後に重力推定を落ち着かせる時定数
    stillG: 0.012,        // ゆらぎがこれ未満なら「止まっている」
    stillFloorRatio: 1.8, // …ただしセンサーのノイズが大きい個体では、直近のゆらぎの最小値のこの倍まで許す
    stillWindowMs: 4000,  // ゆらぎの最小値を覚えておく時間
    stillHoldMs: 80,      // この時間つづけて止まっていたら、重力推定をすばやく合わせる
    fastTauMs: 40,        // ゆらぎを測るための短い平均
    jitterTauMs: 40,
    attackTauMs: 25,      // 包絡線の立ち上がり
    releaseTauMs: 60,     // 包絡線の戻り
    peakWindowMs: 220,    // ふみ検出後、この時間内の最大値を「ふみの強さ」とする
    warmupMs: 350,        // 接続直後は重力推定が落ち着くまで数えない
    noiseRiseTauMs: 6000, // ノイズフロア推定: 上がるのはゆっくり（足踏みの山を覚えない）
    noiseFallTauMs: 300,  //                   下がるのは速く（静かな瞬間にすぐ合わせる）
    noiseLearnMs: 2500,   // 接続直後、ノイズフロアを早めに覚える時間
    noiseLearnTauMs: 400,
    noiseGuard: 2.5,      // しきい値は最低でもノイズフロアのこの倍数
    noiseGuardMaxG: 0.3,  // ただしノイズ由来の持ち上げはここまで
    noiseGuardMaxRatio: 3,   // かつ、選んだしきい値のこの倍まで
    lsbGuard: 1.8,        // しきい値は、センサーの量子化ステップのこの倍以上（8 bit のデータで 1 目盛りの変化を数えない）
    lsbWindowMs: 5000,    // 量子化ステップを覚えておく時間
    defaultDtMs: 10       // サンプル間隔が分かるまでの仮の値
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function levelById(id) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i];
    return null;
  }

  /** しきい値に最も近いプリセット（表示用） */
  function nearestLevel(threshold) {
    var best = LEVELS[0];
    var bestD = Infinity;
    for (var i = 0; i < LEVELS.length; i++) {
      var d = Math.abs(Math.log(LEVELS[i].threshold) - Math.log(threshold));
      if (d < bestD) { bestD = d; best = LEVELS[i]; }
    }
    return best;
  }

  /** しきい値から不応期を決める（やさしい設定ほど長め＝持ち上げ・着地の二重カウントを防ぐ） */
  function refractoryFor(threshold) {
    var t = clamp(threshold, 0.1, 1.2);
    // 1.2G → 260ms, 0.1G → 400ms を対数で補間
    var k = (Math.log(1.2) - Math.log(t)) / (Math.log(1.2) - Math.log(0.1));
    return Math.round(260 + k * 140);
  }

  function makeFootState() {
    return {
      ready: false, gx: 0, gy: 0, gz: 0,
      fx: 0, fy: 0, fz: 0, jit: 0, stillMs: 0, jMinCur: Infinity, jMinPrev: Infinity, jWinT0: 0,
      px: 0, py: 0, pz: 0, lsbCur: Infinity, lsbPrev: Infinity, lsbT0: 0,
      env: 0, dyn: 0, noise: 0.01,
      armed: false, peak: 0, valley: 0, level: 0, ivl: 1000, lastStepT: -1e9, firstT: null,
      dvx: 0, dvy: 0, dvz: 0, ux: 0, uy: 0, uz: 0,
      prevSampleTs: null, cur: null,
      dtEst: null, rateT0: null, rateN: 0,
      lastT: -1e9, samples: 0
    };
  }

  /**
   * @param {object} [options] DEFAULTS を上書きする設定。onStep(step) を渡すと検出ごとに呼ばれる。
   *   step = { foot: 0|1, t: 検出時刻[ms], peak: ふみの強さ[G]（検出後 peakWindowMs の間は更新され続ける） }
   */
  function UdonStepDetector(options) {
    options = options || {};
    this.cfg = {};
    for (var k in DEFAULTS) this.cfg[k] = (options[k] !== undefined) ? options[k] : DEFAULTS[k];
    this.onStep = options.onStep || null;
    this.feet = [makeFootState(), makeFootState()];
    this.lastStepAnyT = -1e9;
    this.lastStepFoot = -1;
  }

  UdonStepDetector.LEVELS = LEVELS;
  UdonStepDetector.DEFAULTS = DEFAULTS;
  UdonStepDetector.MIN_THRESHOLD = MIN_THRESHOLD;
  UdonStepDetector.MAX_THRESHOLD = MAX_THRESHOLD;
  UdonStepDetector.levelById = levelById;
  UdonStepDetector.nearestLevel = nearestLevel;
  UdonStepDetector.refractoryFor = refractoryFor;

  /** 感度をプリセット番号（1〜5）で設定 */
  UdonStepDetector.prototype.setLevel = function (id) {
    var lv = levelById(id) || LEVELS[1];
    this.cfg.threshold = lv.threshold;
    this.cfg.refractoryMs = lv.refractoryMs;
    return lv;
  };

  /** 感度をしきい値 [G] で直接設定（じどう調整用） */
  UdonStepDetector.prototype.setThreshold = function (g) {
    var t = clamp(Number(g) || DEFAULTS.threshold, MIN_THRESHOLD, MAX_THRESHOLD);
    this.cfg.threshold = t;
    this.cfg.refractoryMs = refractoryFor(t);
    return t;
  };

  UdonStepDetector.prototype.getThreshold = function () { return this.cfg.threshold; };

  /** いま実際に効いているしきい値（ノイズが大きい個体ではノイズフロアぶん持ち上がる） */
  UdonStepDetector.prototype.effectiveThreshold = function (foot) {
    return this._threshold(this.feet[foot]);
  };

  UdonStepDetector.prototype._threshold = function (st) {
    var c = this.cfg;
    var guard = Math.min(st.noise * c.noiseGuard, c.noiseGuardMaxG, c.threshold * c.noiseGuardMaxRatio);
    var lsb = Math.min(st.lsbCur, st.lsbPrev);
    return Math.max(c.threshold, guard, isFinite(lsb) ? lsb * c.lsbGuard : 0);
  };

  /** メーター表示用: 現在の動きの大きさ（包絡線）[G] */
  UdonStepDetector.prototype.level = function (foot) { return this.feet[foot].env; };

  /** その足のデータが最近（既定 1.5 秒以内）届いているか */
  UdonStepDetector.prototype.isLive = function (foot, nowMs, withinMs) {
    return (nowMs - this.feet[foot].lastT) <= (withinMs || 1500);
  };

  UdonStepDetector.prototype.reset = function (foot) {
    if (foot === 0 || foot === 1) { this.feet[foot] = makeFootState(); return; }
    this.feet = [makeFootState(), makeFootState()];
    this.lastStepAnyT = -1e9;
    this.lastStepFoot = -1;
  };

  /**
   * 加速度サンプルを 1 つ入れる。
   * @param {number} foot 0 | 1
   * @param {number} ax,ay,az 加速度 [G]（重力込み）
   * @param {number} tMs 共通の時計での受信時刻 [ms]（performance.now()）
   * @param {number} [sampleTs] センサー側のサンプル時刻 [ms]。あればフィルタの dt に使う
   *   （BLE は 1 パケットに複数サンプルが入るため、受信時刻だけでは間隔が 0 になる）
   * @returns {object|null} このサンプルで「ふみ」を検出したら step、なければ null
   */
  UdonStepDetector.prototype.push = function (foot, ax, ay, az, tMs, sampleTs) {
    if (foot !== 0 && foot !== 1) return null;
    if (!isFinite(ax) || !isFinite(ay) || !isFinite(az) || !isFinite(tMs)) return null;
    var c = this.cfg;
    var st = this.feet[foot];

    // 長く途切れたあと（再接続など）は状態を作り直す
    if (st.ready && (tMs - st.lastT) > 1500) {
      this.feet[foot] = st = makeFootState();
    }

    // --- サンプル間隔 dt の決定 ---
    if (st.rateT0 === null) { st.rateT0 = tMs; st.rateN = 0; }
    st.rateN++;
    if (tMs - st.rateT0 >= 500) {
      st.dtEst = clamp((tMs - st.rateT0) / st.rateN, 2, 60);
      st.rateT0 = tMs; st.rateN = 0;
    }
    var dt = st.dtEst || c.defaultDtMs;
    if (isFinite(sampleTs) && st.prevSampleTs !== null) {
      var d = sampleTs - st.prevSampleTs;
      if (d > 0 && d < 200) dt = d;
    }
    st.prevSampleTs = isFinite(sampleTs) ? sampleTs : null;
    st.lastT = tMs;
    st.samples++;

    if (!st.ready) {
      st.ready = true;
      st.gx = st.fx = st.px = ax; st.gy = st.fy = st.py = ay; st.gz = st.fz = st.pz = az;
      st.firstT = tMs;
      st.lsbT0 = st.jWinT0 = tMs;
      return null;
    }

    // --- 0) 量子化ステップの見積もり ---
    // CORE 2.0（ヘッダ 40）の加速度は 8 bit で、±16G レンジでは 1 目盛りが 0.126G もある。
    // 連続するサンプルの差のうち、0 でない最小のものがその 1 目盛り。
    var q = Math.abs(ax - st.px), qy = Math.abs(ay - st.py), qz = Math.abs(az - st.pz);
    if (q < 1e-9 || (qy > 1e-9 && qy < q)) q = qy;
    if (q < 1e-9 || (qz > 1e-9 && qz < q)) q = qz;
    if (q > 1e-9 && q < st.lsbCur) st.lsbCur = q;
    if (tMs - st.lsbT0 >= c.lsbWindowMs) {
      // 値が変化しなかった区間（じっとしていた）では、前に分かった 1 目盛りを覚えたままにする
      if (isFinite(st.lsbCur)) st.lsbPrev = st.lsbCur;
      st.lsbCur = Infinity;
      st.lsbT0 = tMs;
    }
    st.px = ax; st.py = ay; st.pz = az;

    // --- 1) 動きの大きさ（重力推定との差） ---
    var dx = ax - st.gx, dy = ay - st.gy, dz = az - st.gz;
    var dyn = Math.sqrt(dx * dx + dy * dy + dz * dz);
    st.dyn = dyn;

    // --- 2) 重力推定の更新 ---
    // 「止まっているか」は、短い平均からのゆらぎで判断する（足の向きや、重力推定のずれには左右されない）
    var aF = 1 - Math.exp(-dt / c.fastTauMs);
    st.fx += aF * (ax - st.fx); st.fy += aF * (ay - st.fy); st.fz += aF * (az - st.fz);
    var jx = ax - st.fx, jy = ay - st.fy, jz = az - st.fz;
    st.jit += (Math.sqrt(jx * jx + jy * jy + jz * jz) - st.jit) * (1 - Math.exp(-dt / c.jitterTauMs));

    var warm = (tMs - st.firstT) >= c.warmupMs;
    // 直近（4〜8 秒）のゆらぎの最小値 ＝ そのセンサーが止まっているときのノイズ量
    if (warm) {
      if (st.jit < st.jMinCur) st.jMinCur = st.jit;
      if (tMs - st.jWinT0 >= c.stillWindowMs) { st.jMinPrev = st.jMinCur; st.jMinCur = st.jit; st.jWinT0 = tMs; }
    }
    var jFloor = Math.min(st.jMinCur, st.jMinPrev);
    var stillThr = Math.max(c.stillG, isFinite(jFloor) ? jFloor * c.stillFloorRatio : 0);
    st.stillMs = st.jit < stillThr ? st.stillMs + dt : 0;

    if (!warm || st.stillMs >= c.stillHoldMs) {
      // 接続直後と、止まっている間: すばやく合わせる
      var aS = 1 - Math.exp(-dt / (warm ? c.gravityStillTauMs : c.settleTauMs));
      st.gx += aS * dx; st.gy += aS * dy; st.gz += aS * dz;
    } else {
      // 動いている間: ごくゆっくり、しかも 1 回の修正量を制限する
      var aG = 1 - Math.exp(-dt / c.gravityTauMs);
      var cl = c.gravityClampG;
      st.gx += aG * clamp(dx, -cl, cl);
      st.gy += aG * clamp(dy, -cl, cl);
      st.gz += aG * clamp(dz, -cl, cl);
    }

    // 動きの向き（少しならしたもの）。足を「振り上げる」と「ふみおろす」では逆を向く
    var aD = 1 - Math.exp(-dt / c.dirTauMs);
    st.dvx += aD * (dx - st.dvx); st.dvy += aD * (dy - st.dvy); st.dvz += aD * (dz - st.dvz);

    // --- 3) 包絡線 ---
    var aE = 1 - Math.exp(-dt / (dyn > st.env ? c.attackTauMs : c.releaseTauMs));
    st.env += (dyn - st.env) * aE;

    // 検出済みのふみは、しばらく最大値を追いかけて「強さ」を確定させる
    if (st.cur) {
      if (tMs - st.cur.t <= c.peakWindowMs) {
        if (dyn > st.cur.peak) st.cur.peak = dyn;
      } else {
        st.cur = null;
      }
    }

    if (!warm) return null;

    var thr = this._threshold(st);

    // ノイズフロア（包絡線の下側）を学習する。下がるのは速く、上がるのはゆっくりなので、
    // 足踏みの「谷」に張りつく。ずっとざわついているセンサーでは全体が持ち上がる
    // 接続して最初の数秒は、そのセンサーのノイズ量を早めに覚える
    var learning = (tMs - st.firstT) < c.warmupMs + c.noiseLearnMs;
    var tauN = st.env > st.noise ? (learning ? c.noiseLearnTauMs : c.noiseRiseTauMs) : c.noiseFallTauMs;
    st.noise += (st.env - st.noise) * (1 - Math.exp(-dt / tauN));

    // --- 4) ふみの判定（山と谷を追いかける） ---
    // 最近の山の高さ（ゆっくり忘れる）。強くふんでいる間は、小さな揺れを 1 ふみに数えないために使う
    st.level = Math.max(st.env, st.level * Math.exp(-dt / c.levelTauMs));

    if (!st.armed) {
      // 山を追いかけ、そこから十分に下がったら次の立ち上がりを待つ。
      // 速い足踏みでは包絡線がしきい値まで下がりきらないので、「山から 3 割下がった」でもよいことにする
      if (st.env > st.peak) st.peak = st.env;
      if (st.env < Math.max(thr * c.rearmRatio, st.peak * (1 - c.fallRatio))) {
        st.armed = true;
        st.valley = st.env;
      }
      return null;
    }
    if (st.env < st.valley) st.valley = st.env;
    var rise = Math.max(thr * c.riseRatio, st.level * c.relRiseRatio);
    if (st.env < thr || (st.env - st.valley) < rise) return null;

    // 反対の足の直後で、しかもずっと小さい動きなら、床を伝わってきた振動かもしれない。
    // まだ数えずに様子を見る（本当にふんでいれば、このあと大きくなって数えられる）
    var other = this.feet[1 - foot];
    if (this.lastStepFoot !== foot && (tMs - this.lastStepAnyT) < c.crossLockMs && st.env < other.level * c.crossRatio) {
      return null;
    }

    // 山が来た。数えるかどうかにかかわらず、いったん下がるまで再検出しない
    st.armed = false;
    st.peak = st.env;
    // 不応期: ゆっくりふんでいるときは長め（持ち上げと着地の二重カウントを防ぐ）、速いときは短め
    var since = tMs - st.lastStepT;
    var refractory = clamp(st.ivl * c.refractoryIntervalRatio, Math.min(c.minRefractoryMs, c.refractoryMs), c.refractoryMs);
    if (since < refractory) return null;

    // 足を上下に動かすと、加速度は 1 歩のあいだに「行き」と「帰り」で逆向きの山を 2 つ作る。
    // 前のふみと逆向きの山が、いつもの間隔よりずっと早く来たら、同じ 1 歩の残り半分なので数えない
    var dn = Math.sqrt(st.dvx * st.dvx + st.dvy * st.dvy + st.dvz * st.dvz);
    if (dn > 1e-6) {
      var cos = (st.dvx * st.ux + st.dvy * st.uy + st.dvz * st.uz) / dn;
      if (cos < c.oppositeCos && since < Math.min(st.ivl, 1500) * c.oppositeRatio) return null;
      st.ux = st.dvx / dn; st.uy = st.dvy / dn; st.uz = st.dvz / dn;
    }

    st.ivl = since > 1500 ? 1000 : st.ivl + (since - st.ivl) * 0.4;
    st.lastStepT = tMs;
    this.lastStepAnyT = tMs;
    this.lastStepFoot = foot;
    var step = { foot: foot, t: tMs, peak: Math.max(dyn, st.env) };
    st.cur = step;
    if (this.onStep) this.onStep(step);
    return step;
  };

  /**
   * じどう感度調整（ためしふみ）。数秒間の包絡線を集めて、その人に合うしきい値を提案する。
   *   var cal = new UdonStepDetector.Calibrator();
   *   // ためしふみ中、サンプルごとに  cal.add(detector.level(foot))
   *   var r = cal.result();   // { ok, threshold, noise, strong, level }
   */
  function Calibrator() { this.values = []; }

  Calibrator.prototype.add = function (env) {
    if (isFinite(env) && env >= 0) this.values.push(env);
  };

  Calibrator.prototype.result = function () {
    var v = this.values.slice().sort(function (a, b) { return a - b; });
    if (v.length < 30) return { ok: false, reason: 'short' };
    function pct(p) { return v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))]; }
    var noise = pct(0.1);      // 足が止まっている瞬間の大きさ
    var strong = pct(0.97);    // ふんだときの山のあたり
    // 動きがほとんど無い（静止ノイズと見分けがつかない）ときは提案しない
    if (strong < 0.05 || strong < noise * 2.5) {
      return { ok: false, reason: 'still', noise: noise, strong: strong };
    }
    // 山の高さの 4 割強を境目にする（ノイズの 2.5 倍は必ず確保）
    var threshold = clamp(Math.max(noise * 2.5, noise + (strong - noise) * 0.42), MIN_THRESHOLD, 1.6);
    threshold = Math.round(threshold * 100) / 100;
    return { ok: true, threshold: threshold, noise: noise, strong: strong, level: nearestLevel(threshold) };
  };

  UdonStepDetector.Calibrator = Calibrator;

  root.UdonStepDetector = UdonStepDetector;
  if (typeof module !== 'undefined' && module.exports) module.exports = UdonStepDetector;
})(typeof globalThis !== 'undefined' ? globalThis : this);
