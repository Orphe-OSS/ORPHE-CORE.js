/**
 * うどんふみふみ — ゲーム本体（進行・描画・リザルト）
 *
 * センサーまわりは scripts.js（CORE 接続）→ UdonGame.pushAcc() → step-detector.js の順に流れてきます。
 * ORPHE INSOLE をえらんだときは insole-connect.js → UdonGame.pushInsoleAcc() / pushPress() で、
 * 足の動き（step-detector.js）に加えて足うらの圧力（insole-pressure.js）も届きます。
 * このファイルは「ふみ」を受け取ってからの世界（生地・足・麺棒・包丁のアニメーション、HUD、
 * できあがりとリザルト、図鑑ときろく）を受け持ちます。
 *
 * 画面の流れ:  title → setup（コース・感度）→ intro → play（こねる → のばす → きる）→ boil → finish → result
 */
(function () {
  'use strict';

  var INK = '#231815';
  var COL = {
    shu: '#E15C3A', shuLight: '#E86B49', dough: '#F2EFE9', doughShade: '#E2DDD3', white: '#FFFDF8',
    wood: '#EAC690', woodDark: '#D4A562', peach: '#FAD4BC', yolk: '#F7B500', glow: '#F7A735',
    steel: '#D5DBDE', led: ['#39C6F4', '#FFD23F']
  };
  var LW = 1280, LH = 720;        // キャンバスの論理サイズ
  var BOARD_Y = 598;              // のし板の上面
  var DOUGH_X = 660;
  var STORE_KEY = 'orphe-udon-fumifumi-v1';
  var HISTORY_MAX = 60;

  var COURSES = [
    { id: 'komori', name: '小盛り', steps: 30, note: 'おためしに', time: '30秒〜', scale: 0.62 },
    { id: 'nami', name: '並', steps: 60, note: 'ちょうどいい', time: '1分〜', scale: 0.76 },
    { id: 'oomori', name: '大盛り', steps: 100, note: 'しっかり運動', time: '2分〜', scale: 0.9 },
    { id: 'tokumori', name: '特盛', steps: 200, note: 'たっぷり運動', time: '4分〜', scale: 1 }
  ];
  var KNEAD_END = 0.6, ROLL_END = 0.8;   // もちもち度のうち、こねる / のばす / きる の境目
  var WORDS = {
    knead: ['ふみっ', 'ぷにっ', 'もちっ', 'むにっ', 'ぽふっ', 'ぎゅっ'],
    roll: ['ころころ', 'のび〜', 'すーっ', 'ころん'],
    cut: ['トン', 'トン!', 'ストン', 'トントン']
  };
  // リズムのコンボ（combo.js）: おなじ間隔でふみつづけると、1 ふみで進む量（もちもち度）が増える
  var COMBO_LEVELS = UdonCombo.LEVELS;

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');
  var canvas = $('stageCanvas');
  var ctx = canvas.getContext('2d');

  // ---------------------------------------------------------------------------
  // 保存データ（感度・コース・図鑑・きろく）
  // ---------------------------------------------------------------------------
  function loadStore() {
    var base = {
      settings: { course: 'nami', sens: { mode: 'level', level: 2, threshold: 0.6 }, sound: true, device: 'core', record: false },
      collection: {},
      history: []
    };
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        if (raw.settings) {
          if (courseById(raw.settings.course)) base.settings.course = raw.settings.course;
          if (raw.settings.sens && isFinite(raw.settings.sens.threshold)) {
            base.settings.sens = {
              mode: raw.settings.sens.mode === 'auto' ? 'auto' : 'level',
              level: UdonStepDetector.levelById(raw.settings.sens.level) ? raw.settings.sens.level : 2,
              threshold: raw.settings.sens.threshold
            };
          }
          base.settings.sound = raw.settings.sound !== false;
          base.settings.device = raw.settings.device === 'insole' ? 'insole' : 'core';
          base.settings.record = raw.settings.record === true;
        }
        // 保存データはそのまま画面（innerHTML）に出すので、知っている項目だけを数値・既知の id に直して取り込む
        var num = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.round(v)) : 0; };
        if (raw.collection && typeof raw.collection === 'object') {
          UdonMenu.MENU.forEach(function (m) {
            var c = raw.collection[m.id];
            if (c && num(c.count) > 0) base.collection[m.id] = { count: num(c.count), best: Math.min(100, num(c.best)), first: String(c.first || '').slice(0, 30) };
          });
        }
        if (Array.isArray(raw.history)) {
          raw.history.slice(-HISTORY_MAX).forEach(function (e) {
            if (!e || isNaN(new Date(e.at).getTime())) return;
            base.history.push({
              at: new Date(e.at).toISOString(), udon: UdonMenu.byId(e.udon) ? e.udon : 'kake',
              course: courseById(e.course) ? e.course : 'nami', feet: e.feet === 1 ? 1 : 2,
              total: Math.min(100, num(e.total)), rank: String(e.rank || '').replace(/[^a-z]/g, '').slice(0, 20),
              steps: num(e.steps), activeSec: num(e.activeSec), cadence: num(e.cadence), combo: num(e.combo),
              axes: (e.axes && typeof e.axes === 'object') ? e.axes : {}
            });
          });
        }
      }
    } catch (e) { /* 保存データが壊れていたら初期値で始める */ }
    return base;
  }

  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* プライベートモード等 */ }
  }

  function courseById(id) {
    for (var i = 0; i < COURSES.length; i++) if (COURSES[i].id === id) return COURSES[i];
    return null;
  }

  var store = loadStore();

  // ---------------------------------------------------------------------------
  // 状態
  // ---------------------------------------------------------------------------
  var state = {
    screen: 'title',
    mode: 'core',          // core = センサーで遊ぶ（CORE でも INSOLE でも）| demo = おためし（キーボード・タップ）
    device: 'core',        // core = ORPHE CORE | insole = ORPHE INSOLE（画面上の切り替えでえらぶ）
    paused: false,
    tryCount: 0,
    calib: null,           // じどう調整中 { cal, until }
    introT: 0,
    lastCount: -1,
    finishTimer: null,
    result: null,          // { analysis, pick, course }
    debug: {}
  };
  var run = null;          // ふみふみ中の記録

  var detector = new UdonStepDetector({ onStep: handleImuStep });
  // ORPHE INSOLE の足うらの圧力（6ch）。CORE のときは使わない
  var press = new UdonInsolePressure({ onStep: handlePressStep });
  applySensitivity();

  function applySensitivity() {
    var s = store.settings.sens;
    if (s.mode === 'auto') detector.setThreshold(s.threshold);
    else s.threshold = detector.setLevel(s.level).threshold;
    // 圧力の感度も、同じ 5 段階に合わせる
    press.setLevel(s.mode === 'auto' ? UdonStepDetector.nearestLevel(s.threshold).id : s.level);
  }

  function isInsole() { return state.device === 'insole'; }

  function sensLabel() {
    var s = store.settings.sens;
    if (s.mode === 'auto') return 'じどう（' + UdonStepDetector.nearestLevel(s.threshold).label + '相当）';
    return UdonStepDetector.levelById(s.level).label;
  }

  // ---------------------------------------------------------------------------
  // 入力: CORE（scripts.js から）・INSOLE（insole-connect.js から）・おためしモード（キーボード・タップ）
  // ---------------------------------------------------------------------------
  var coreSeen = [false, false];

  /** scripts.js の gotConvertedAcc から呼ばれる。acc は G 単位 */
  function pushAcc(foot, acc) {
    if (!acc) return;
    coreSeen[foot] = true;
    if (isInsole()) return;              // INSOLE をえらんでいる間は、CORE のデータは使わない
    if (state.mode === 'demo') return;   // おためし中は、キーボード／タップの合成データだけを使う
    recBegin(foot);
    detector.push(foot, acc.x, acc.y, acc.z, performance.now(), acc.timestamp);
    afterSample(foot);
    recAcc(foot, acc);
  }

  /** scripts.js の gotConvertedGyro から呼ばれる（加速度のすぐあとに届く）。生データのきろくにだけ使う */
  function pushGyro(foot, gyro) {
    if (isInsole() || state.mode === 'demo') return;
    recGyro(foot, gyro);
    recFlush(foot, null);
  }

  /**
   * insole-connect.js の gotConvertedAcc から呼ばれる。足うらに CORE を付けたのと同じように、足の動きとして扱う。
   * INSOLE は 1 パケットの全サンプルが同じ時刻で届くので、サンプル間隔は届いた数から見積もらせる
   */
  function pushInsoleAcc(foot, acc) {
    if (!acc || !isInsole() || state.mode === 'demo') return;
    if (!isFinite(acc.x) || !isFinite(acc.y) || !isFinite(acc.z)) return;
    recBegin(foot);
    detector.push(foot, acc.x, acc.y, acc.z, performance.now());
    afterSample(foot);
    recAcc(foot, acc);
  }

  /** insole-connect.js の gotConvertedGyro から呼ばれる。生データのきろくにだけ使う */
  function pushInsoleGyro(foot, gyro) {
    if (!isInsole() || state.mode === 'demo') return;
    recGyro(foot, gyro);
  }

  /** insole-connect.js の gotPress から呼ばれる。values は 6ch の生値。INSOLE では、これが 1 サンプルの最後に届く */
  function pushPress(foot, values) {
    if (!isInsole() || state.mode === 'demo') return;
    press.record = recording();
    press.push(foot, values, performance.now());
    recFlush(foot, values);
  }

  /** リザルト用の集計をためてよいか（ふみふみ中で、止めていない） */
  function recording() {
    return !!(run && state.screen === 'play' && !state.paused && !run.done && run.count > 0);
  }

  // INSOLE: 加速度のふみと、圧力のふみを 1 つにまとめる（規則は insole-pressure.js の Fusion）。
  // 圧力でふみを数えられている間は圧力を正とし、圧力が反応しないときは CORE と同じように加速度で数える
  var fusion = new UdonInsolePressure.Fusion(press);

  function handleImuStep(step) {
    if (isInsole() && !fusion.acceptImu(step, performance.now())) { recNote(step.foot, 'imu:ignored'); return; }
    handleStep(step);
  }

  function handlePressStep(step) {
    if (!fusion.acceptPress(step, performance.now())) { recNote(step.foot, 'press:merged'); return; }
    if (state.calib) state.calib.pressSteps++;
    handleStep(step);
  }

  // ---------------------------------------------------------------------------
  // 生データのきろく（開発・解析用。画面上の ● ボタンで ON / OFF。書式は raw-recorder.js）
  //
  // センサーの 1 サンプルは、いくつかのコールバックに分かれて届く（CORE: 加速度 → ジャイロ、
  // INSOLE: 加速度 → ジャイロ → 圧力）。足ごとにためておき、最後の 1 つが届いたところで 1 行にする。
  // その間に起きたこと（ふみを数えた・見送った）も、同じ行に書く
  // ---------------------------------------------------------------------------
  var rec = new UdonRawRecorder();
  // 行の組み立て（raw-recorder.js の Assembler）に、ゲームがそのとき見ていた値を渡す
  var recAsm = new UdonRawRecorder.Assembler(rec, function (foot, values) {
    var out = { screen: recScreen() };
    if (foot < 0) return out;
    out.env = detector.level(foot);
    out.thr = detector.effectiveThreshold(foot);
    if (isInsole() && values) {
      var sole = press.feet[foot];
      out.sum = sole.sum; out.floor = sole.floorTotal; out.pthr = press.threshold(foot); out.load = sole.load;
    }
    return out;
  });
  var recEnding = null;   // 終わりかけのきろく { reason, extra, run }。ファイルにする処理は、あとで行う
  var recErrors = 0;

  /** きろくで何か起きても、ふみの判定や画面には影響させない。そのきろくはあきらめる */
  function recFail(error) {
    if (recErrors++ < 3) console.warn('[うどんふみふみ] 生データのきろくで問題が起きました（ゲームには影響しません）', error);
    try { rec.stop(performance.now(), { ended: 'error' }); rec.clear(); } catch (e) { /* あきらめる */ }
    recEnding = null;
    try { recAsm.reset(); renderRecord(); } catch (e) { /* あきらめる */ }
  }

  function recScreen() { return state.paused ? 'pause' : state.screen; }

  /** 新しいサンプルの処理を始める前に呼ぶ */
  function recBegin(foot) {
    if (!rec.active) return;
    try { recAsm.begin(foot, performance.now()); } catch (e) { recFail(e); }
  }

  function recAcc(foot, acc) { if (rec.active) recAsm.acc(foot, acc); }
  function recGyro(foot, gyro) { if (rec.active) recAsm.gyro(foot, gyro); }
  function recNote(foot, text, count, mult) { if (rec.active) recAsm.note(foot, text, count, mult); }

  /** そのサンプルの最後のコールバックで呼ぶ（values = INSOLE の圧力。なければ null） */
  function recFlush(foot, values) {
    if (!rec.active) return;
    try { recAsm.flush(foot, values, performance.now()); } catch (e) { recFail(e); }
  }

  /** センサーの値を持たない目印の行（開始・一時停止・区間の切り替わり・接続切れなど） */
  function recMark(text) {
    if (!rec.active) return;
    try { recAsm.mark(text, performance.now(), recScreen()); } catch (e) { recFail(e); }
  }

  function recMeta() {
    var s = store.settings.sens;
    var course = courseById(store.settings.course) || COURSES[1];
    var meta = {
      app: 'GAME-UDON',
      started_at: new Date().toISOString(),
      device: state.device,
      input: state.mode === 'demo' ? 'demo (synthetic, keyboard / tap)' : 'sensor',
      course: course.id + ' target ' + course.steps,
      sensitivity: (s.mode === 'auto' ? 'auto' : 'level ' + s.level) + ' / imu threshold ' + detector.getThreshold() +
        ' G / pressure level ' + press.getLevel()
    };
    recLinks(meta, '');
    meta.user_agent = navigator.userAgent;
    return meta;
  }

  /** つないでいるセンサーのようす（電池・左右・実測 Hz・落ちたパケット数など）。開始時と終了時に書く */
  function recLinks(meta, suffix) {
    for (var i = 0; i < 2; i++) {
      var text = 'n/a';
      try {
        if (isInsole()) {
          if (window.UdonInsole) text = window.UdonInsole.describe(i);
        } else if (window.bles && window.bles[i]) {
          var info = window.bles[i].device_information;
          text = info
            ? 'battery=' + info.battery + ' lr=' + info.lr + ' range_acc=' + (info.range ? info.range.acc : 'n/a') +
              ' range_gyro=' + (info.range ? info.range.gyro : 'n/a')
            : 'no device information';
        }
      } catch (e) { text = 'n/a'; }
      meta[state.device + '_0' + (i + 1) + suffix] = text;
    }
  }

  function recStart(how) {
    if (!store.settings.record) return;
    if (recEnding) recFinish();   // 前のきろくの後始末がまだなら、先に済ませる
    if (rec.active) return;
    try {
      recAsm.reset();
      rec.start(recMeta(), performance.now());
      recMark(how || 'start');
    } catch (e) { recFail(e); }
    renderRecord();
  }

  /**
   * きろくを終える（ふみふみが終わった・途中でやめた・トグルを切った）。
   * ここでは「終わる」と決めるだけ。CSV にして保存する重い処理は recFinish() が、いまの処理が済んでから行う
   * （最後の 1 ふみはセンサーの処理の途中で決まるので、その行を書き終えてから締める。保存で何か起きても画面は進む）。
   * @param {string} reason finish | quit | title | retry | off
   * @param {object|null} liveRun いま進めているふみふみ（先頭にふみ数などを書く）。なければ null
   */
  function recStop(reason, liveRun) {
    if (!rec.active || recEnding) return;
    var extra = { ended: reason };
    if (liveRun) {
      extra.counted_steps = liveRun.count;
      extra.progress = Math.round(liveRun.points * 10) / 10 + ' / ' + liveRun.target;
      extra.max_combo = liveRun.maxCombo;
    }
    recEnding = { reason: reason, extra: extra, run: liveRun || null };
    setTimeout(recFinish, 0);
  }

  function recFinish() {
    var end = recEnding;
    if (!end) return;
    recEnding = null;
    try {
      var now = performance.now();
      recAsm.drain(now);
      rec.mark(now, recScreen(), 'end:' + end.reason);
      recLinks(end.extra, '_end');
      var sum = rec.stop(now, end.extra);
      if (sum.samples[0] + sum.samples[1] >= 100) {
        var file = {
          name: UdonRawRecorder.fileName(new Date(), state.device),
          blob: new Blob([rec.toCsv()], { type: 'text/csv' }), rows: sum.rows
        };
        state.rawFile = file;
        if (end.run) end.run.rawFile = file;
        saveRawFile();
      } else {
        // センサーの値がほとんど無いきろく（すぐにやめた・つながっていなかった）は保存しない
        toast('きろくが短すぎたので、生データは保存しませんでした');
      }
      rec.clear();
    } catch (e) { recFail(e); }
    renderRecord();
  }

  function saveRawFile() {
    var f = state.rawFile;
    if (!f) return;
    var url = URL.createObjectURL(f.blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 10000);
    toast('生データを保存しました（' + f.rows + ' 行）');
  }

  function renderRecord() {
    var on = !!store.settings.record;
    $('btnRecord').setAttribute('aria-pressed', on);
    document.body.dataset.rec = (rec.active && !recEnding) ? 'on' : (on ? 'armed' : 'off');
  }

  /** いま進めているふみふみ（きろくの先頭に、ふみ数などを書くため）。カウントダウン中やリザルトでは null */
  function currentRun() {
    return (run && !run.done && state.screen === 'play') ? run : null;
  }

  function setRecord(on) {
    store.settings.record = !!on;
    saveStore();
    if (on) {
      // ふみふみの途中で ON にしたら、そこからきろくする
      if (state.screen === 'intro' || state.screen === 'play') recStart('start:mid');
      toast('生データをきろくします。ふみふみが終わると、CSV を自動で保存します');
    } else {
      if (rec.active) recStop('off', currentRun());
      else toast('生データのきろくをやめました');
    }
    renderRecord();
  }

  /** 1 サンプルごとの記録（実機・おためし共通） */
  function afterSample(foot) {
    var env = detector.level(foot);
    if (state.calib) state.calib.cal.add(env);
    if (isInsole()) fusion.track(foot, env, performance.now());
    if (run && state.screen === 'play' && !state.paused && !run.done) {
      // その足がどれだけ動いたか（CORE をつけているのに ふめていない足と、置いてあるだけの CORE を見分ける）
      if (env > run.motion[foot]) run.motion[foot] = env;
      // ふみが届いていない間の動き（直近 6 秒ぶん）をためておき、「感度を上げる」ときの目安にする
      var now = performance.now();
      run.idle.env.push(env);
      run.idle.t.push(now);
      if (now - run.idle.trimmedAt > 1000) {
        var from = 0;
        while (from < run.idle.t.length && run.idle.t[from] < now - IDLE_WINDOW_MS) from++;
        run.idle.env = run.idle.env.slice(from);
        run.idle.t = run.idle.t.slice(from);
        run.idle.trimmedAt = now;
      }
    }
  }

  var IDLE_WINDOW_MS = 6000;

  function newIdle() { return { env: [], t: [], trimmedAt: performance.now() }; }

  /** 直近の「届かなかった動き」から、その人が数えられるしきい値を見積もる */
  function idleResult() {
    var cal = new UdonStepDetector.Calibrator();
    var from = performance.now() - IDLE_WINDOW_MS;
    for (var i = 0; i < run.idle.env.length; i++) if (run.idle.t[i] >= from) cal.add(run.idle.env[i]);
    return cal.result();
  }

  var demo = { timer: null, pulses: [[], []], soles: [[], []], next: 0 };
  // おためしモードでまねる足うらの圧力。実機と同じく、のせていなくても 220 前後の値が出ていて、
  // 立っているだけで かかと・中足部に少し圧がかかっている
  var DEMO_FLOOR = [220, 222, 220, 256, 222, 221];
  var DEMO_STAND = [0, 10, 0, 40, 90, 150];

  function demoTick() {
    var now = performance.now();
    for (var foot = 0; foot < 2; foot++) {
      var p = 0;
      var list = demo.pulses[foot];
      for (var i = list.length - 1; i >= 0; i--) {
        var age = now - list[i].t0;
        if (age > list[i].w) { list.splice(i, 1); continue; }
        p += list[i].amp * Math.sin(Math.PI * age / list[i].w);
      }
      var n = function () { return (Math.random() - 0.5) * 0.012; };
      var acc = { x: 0.25 * p + n(), y: n(), z: 1 + 0.95 * p + n() };
      recBegin(foot);
      detector.push(foot, acc.x, acc.y, acc.z, now);
      afterSample(foot);
      recAcc(foot, acc);
      recFlush(foot, isInsole() ? demoPress(foot, now) : null);
    }
  }

  /** おためしモード × INSOLE: かかとから着いて、つま先へぬける 1 歩ぶんの圧力をまねる */
  function demoPress(foot, now) {
    var v = DEMO_FLOOR.map(function (base, ch) { return base + DEMO_STAND[ch] + (Math.random() - 0.5) * 3; });
    var list = demo.soles[foot];
    for (var i = list.length - 1; i >= 0; i--) {
      var u = (now - list[i].t0) / list[i].w;
      if (u > 1) { list.splice(i, 1); continue; }
      var e = Math.pow(Math.sin(Math.PI * u), 0.7) * list[i].amp * 900;
      v[5] += e * 0.45 * (1.25 - u);          // かかと
      v[4] += e * 0.26;                        // 中足部（外）
      v[3] += e * 0.12;                        // 中足部（中）
      v[1] += e * 0.16 * u * 1.6;              // 母趾球
      v[0] += e * 0.10 * u * u * 2;            // つま先（内）
      v[2] += e * 0.05 * u * u * 2;            // つま先（外）
    }
    press.record = recording();
    press.push(foot, v, now);
    return v;
  }

  function setMode(mode) {
    if (state.mode !== mode) { detector.reset(); press.reset(); fusion.reset(); }   // 実機とおためしのデータを混ぜない
    state.mode = mode;
    stage.dataset.mode = mode;
    if (mode === 'demo' && !demo.timer) demo.timer = setInterval(demoTick, 10);
    if (mode !== 'demo' && demo.timer) { clearInterval(demo.timer); demo.timer = null; }
  }

  /** おためしモードの 1 ふみ。gentle = そっとふむ（感度のテスト用） */
  function demoStomp(foot, gentle) {
    if (state.mode !== 'demo') return;
    demo.pulses[foot].push({
      t0: performance.now(),
      w: gentle ? 170 : 85,
      amp: gentle ? 0.27 + Math.random() * 0.1 : 1.1 + Math.random() * 1.3
    });
    if (isInsole()) {
      demo.soles[foot].push({
        t0: performance.now(),
        w: gentle ? 520 : 300,
        // そっとふむ: 「ふつう」では届かず、「やさしい」より右で数えられる強さ
        amp: gentle ? 0.11 + Math.random() * 0.04 : 0.75 + Math.random() * 0.4
      });
    }
  }

  function liveFeet() {
    var now = performance.now();
    return [detector.isLive(0, now), detector.isLive(1, now)];
  }

  // ---------------------------------------------------------------------------
  // 「ふみ」を受け取る
  // ---------------------------------------------------------------------------
  function handleStep(step) {
    flashFoot(step.foot);
    // ふみふみ中以外（カウントダウン中など）に見つけたふみも、きろくには残す
    if (state.screen !== 'play') recNote(step.foot, 'detect:' + (step.source || 'imu'));
    if (state.screen === 'setup') {
      state.tryCount++;
      $('tryCount').textContent = state.tryCount;
      UdonAudio.play('puni', { rate: step.foot ? 1.06 : 0.96 });
      return;
    }
    if (state.screen === 'title') {
      scene.hop.kick = 1;
      return;
    }
    if (state.screen === 'play' && run && !state.paused && !run.done) registerStep(step);
  }

  function flashFoot(foot) {
    ['hudFoot', 'tryMeter'].forEach(function (prefix) {
      var el = $(prefix + foot);
      if (!el) return;
      el.classList.remove('is-hit');
      void el.offsetWidth;   // アニメーションを最初から
      el.classList.add('is-hit');
    });
  }

  function registerStep(step) {
    var now = performance.now();
    if (run.count === 0) { run.clockStart = now; run.clock = 0; }
    run.clock = now - run.clockStart - run.pausedMs;
    var entry = { t: run.clock, foot: step.foot, ref: step, rest: run.restNext };
    run.restNext = false;
    run.steps.push(entry);
    run.count++;
    run.lastStepAt = now;
    run.feetUsed[step.foot] = true;
    run.idle = newIdle();
    hideAssist();
    $('playHint').classList.add('is-gone');

    // リズムのコンボ: いつもの間隔とほぼ同じ間隔でふめたら、つながる（規則は combo.js）
    var prevLevel = UdonCombo.level(run.streak);
    var combo = UdonCombo.advance(run.steps, run.streak);
    run.streak = combo.streak;
    if (combo.broke) comboBreak();
    if (run.streak > run.maxCombo) run.maxCombo = run.streak;
    var level = UdonCombo.level(run.streak);
    var mult = UdonCombo.mult(run.streak);
    if (level > prevLevel) {
      callout(COMBO_LEVELS[level - 1].call);
      UdonAudio.good();
      burst(DOUGH_X, BOARD_Y - 220, 6 + level * 3);
    }
    run.level = level;
    run.points = Math.min(run.target, run.points + mult);
    recNote(step.foot, 'step:' + (step.source || 'imu'), run.count, mult);

    var p = run.points / run.target;
    var prevPhase = run.phase;
    run.phase = p >= ROLL_END ? 'cut' : (p >= KNEAD_END ? 'roll' : 'knead');
    var strength = Math.min(1, step.peak / Math.max(0.3, detector.getThreshold() * 3));
    // INSOLE: 圧力で数えたふみは、押しぐあい（その人のいつもの強さ = 1）も演出の強さに使う
    if (step.source === 'press') strength = Math.max(strength, Math.min(1, step.rel * 0.8));

    if (run.points >= run.target - 1e-9) {
      sceneStep(prevPhase, step.foot, strength, mult);
      beginBoil();
      return;
    }
    if (run.phase !== prevPhase) {
      enterPhase(run.phase);
    } else if (run.phase === 'knead') {
      // 生地をたたんで、もう一度（こねる区間を 3 回に分ける）
      var per = run.target * KNEAD_END / 3;
      var fold = Math.floor(run.points / per + 1e-9);
      if (fold > run.folds && fold < 3) {
        run.folds = fold;
        scene.dough.cycle0 = run.points;
        if (level <= prevLevel) callout('たたんで もういちど！');
        UdonAudio.fold();
        burst(DOUGH_X, BOARD_Y - 160, 8);
      }
    }
    sceneStep(run.phase, step.foot, strength, mult);
  }

  function comboBreak() {
    var el = $('combo');
    el.classList.remove('is-break');
    void el.offsetWidth;
    el.classList.add('is-break');
  }

  function enterPhase(phase) {
    var li = stage.querySelectorAll('#phaseList li');
    for (var i = 0; i < li.length; i++) {
      var k = li[i].dataset.phase;
      li[i].classList.toggle('is-now', k === phase);
      li[i].classList.toggle('is-done', (phase === 'roll' && k === 'knead') || (phase === 'cut' && k !== 'cut'));
    }
    recMark('phase:' + phase);
    if (phase === 'roll') { callout('もちもち！ つぎは のばすよ'); UdonAudio.fold(); scene.pin.x = DOUGH_X - 200; scene.pin.tx = scene.pin.x; }
    if (phase === 'cut') { callout('のびた！ トントン きるよ'); UdonAudio.fold(); scene.cut.n = 0; }
    if (phase !== 'knead') burst(DOUGH_X, BOARD_Y - 150, 10);
  }

  // ---------------------------------------------------------------------------
  // 画面の切り替え
  // ---------------------------------------------------------------------------
  var wakeLock = null;
  /** ふみふみ中は画面をスリープさせない（足踏みだけで、マウスにもキーボードにも触らないため） */
  function keepAwake(on) {
    try {
      if (on && !wakeLock && navigator.wakeLock) {
        navigator.wakeLock.request('screen').then(function (lock) {
          wakeLock = lock;
          lock.addEventListener('release', function () { if (wakeLock === lock) wakeLock = null; });
        }).catch(function () { /* 対応していない・許可されない場合はそのまま */ });
      } else if (!on && wakeLock) {
        wakeLock.release().catch(function () {});
        wakeLock = null;
      }
    } catch (e) { /* 画面スリープ防止は、できなくてもゲームに支障はない */ }
  }

  function showScreen(name) {
    state.screen = name;
    keepAwake(name === 'intro' || name === 'play' || name === 'boil' || name === 'finish');
    stage.dataset.screen = name;
    var list = stage.querySelectorAll('.u-screen');
    for (var i = 0; i < list.length; i++) list[i].classList.toggle('is-on', list[i].dataset.screen === name);
    if (name === 'title' || name === 'setup' || name === 'intro' || name === 'result') UdonAudio.bgm('menu');
    if (name === 'play') UdonAudio.bgm('play');
    if (name === 'boil' || name === 'finish') UdonAudio.bgm(null);
  }

  function cancelCalibration() {
    state.calib = null;
    $('btnCalibrate').disabled = false;
    stage.querySelector('.u-try').classList.remove('is-calib');
  }

  function goTitle() {
    clearTimeout(state.finishTimer);
    cancelCalibration();
    recStop('title', currentRun());   // とちゅうでやめたときのきろくも残す（数えられなかった原因を調べるのに、いちばん役に立つ）
    setMode('core');
    press.record = false;
    run = null;
    state.paused = false;
    refreshZukanCount();
    showScreen('title');
  }

  var TRY_TEXT = {
    core: '足踏みしてみましょう。メーターが線をこえると「ふみ」になります。',
    insole: '足踏みしてみましょう。足うらの丸がふくらみ、メーターが線をこえると「ふみ」になります。',
    demo: 'F・J キー（またはメーターをタップ）でためしふみ。Shift を押しながらだと「そっと」ふみます。'
  };

  function tryText() {
    return TRY_TEXT[state.mode === 'demo' ? 'demo' : state.device];
  }

  function goSetup() {
    state.tryCount = 0;
    $('tryCount').textContent = '0';
    $('tryText').textContent = tryText();
    cancelCalibration();
    renderSetup();
    showScreen('setup');
  }

  function goIntro() {
    cancelCalibration();
    state.introT = 0;
    state.lastCount = -1;
    $('countdown').textContent = '';
    resetScene();
    recStop('retry', null);
    showScreen('intro');
    recStart();   // カウントダウン中（立っているだけの数秒）から残す
  }

  function startPlay() {
    var course = courseById(store.settings.course) || COURSES[1];
    var live = liveFeet();
    run = {
      course: course, target: course.steps, count: 0, points: 0, steps: [], phase: 'knead', folds: 0,
      clockStart: 0, clock: 0, pausedMs: 0, pauseStart: 0, pauses: 0, streak: 0, maxCombo: 0, level: 0,
      startedAt: performance.now(), lastStepAt: performance.now(), done: false,
      assistUntil: 0, assistOff: false, restNext: false,
      idle: newIdle(), motion: [0, 0],
      feetUsed: [false, false], feetLive: [live[0], live[1]]
    };
    state.paused = false;
    press.resetStats();
    press.clearMissed();
    $('pausedLayer').hidden = true;
    $('playHint').classList.remove('is-gone');
    hideAssist();
    resetScene();
    enterPhaseQuiet('knead');
    showScreen('play');
    recStart();
    recMark('play');
    UdonAudio.play('pipi');
  }

  function enterPhaseQuiet(phase) {
    var li = stage.querySelectorAll('#phaseList li');
    for (var i = 0; i < li.length; i++) {
      li[i].classList.toggle('is-now', li[i].dataset.phase === phase);
      li[i].classList.remove('is-done');
    }
  }

  /**
   * @param {boolean} on
   * @param {boolean} [manual] 利用者が自分で「ひとやすみ」した（ボタン・Esc）。
   *   タブを切り替えた・接続が切れた、といった自動の一時停止は「ひとやすみ」に数えない
   */
  function setPaused(on, manual) {
    if (!run || run.done || state.paused === on) return;
    state.paused = on;
    $('pausedLayer').hidden = !on;
    var now = performance.now();
    recMark(on ? (manual ? 'pause:manual' : 'pause:auto') : 'resume');
    if (on) {
      run.pauseStart = now;
      if (manual) run.pauses++;
      hideAssist();
    } else {
      // 止めていた時間は時計から丸ごと除き、次の 1 ふみに「ひとやすみ明け」の印をつける
      // （解析では、その間隔をリズムやテンポの計算に入れない）
      if (run.count > 0) { run.pausedMs += now - run.pauseStart; run.restNext = true; }
      run.lastStepAt = now;
      run.idle = newIdle();
    }
  }

  /** ゆであがり → できあがり */
  function beginBoil() {
    run.done = true;
    recStop(run.points >= run.target - 1e-9 ? 'finish' : 'quit', run);
    hideAssist();
    scene.boil.t = 0;
    showScreen('boil');
    UdonAudio.play('pipi');
    state.finishTimer = setTimeout(finishRun, state.debug.fast ? 60 : 2600);
  }

  function finishRun() {
    var steps = run.steps.map(function (s) {
      // INSOLE: 圧力で数えたふみ、または加速度が先に数えて圧力があとから同じ着地を見つけたふみには、押しぐあいが付く
      var sole = s.ref.source === 'press' ? s.ref : (s.ref.sole || null);
      return { t: s.t, foot: s.foot, peak: s.ref.peak, rest: s.rest, press: sole ? sole.rel : null, fore: sole ? sole.fore : null };
    });
    var analysis = UdonHealth.analyze({ steps: steps, feet: feetInPlay(steps) });
    var feet = analysis.feet;
    var pick = UdonMenu.pick(analysis, {
      target: run.target, completed: run.points >= run.target - 1e-9,
      threshold: detector.getThreshold(), pauses: run.pauses, collected: store.collection
    });
    if (state.debug.udon && UdonMenu.byId(state.debug.udon)) {
      pick = { id: state.debug.udon, item: UdonMenu.byId(state.debug.udon), isNew: !store.collection[state.debug.udon] };
    }
    state.result = {
      analysis: analysis, pick: pick, course: run.course, sens: sensLabel(), at: new Date(), maxCombo: run.maxCombo,
      device: state.device,
      // INSOLE: 足うらのどこに体重がのっていたか（左・右）
      sole: isInsole() ? [press.summary(0), press.summary(1)] : null,
      raw: run.rawFile || null
    };

    // 図鑑ときろく
    var c = store.collection[pick.id] || { count: 0, best: 0 };
    c.count++;
    c.best = Math.max(c.best || 0, analysis.total);
    if (!c.first) c.first = state.result.at.toISOString();
    store.collection[pick.id] = c;
    var entry = UdonHealth.summarize(analysis);
    entry.at = state.result.at.toISOString();
    entry.udon = pick.id;
    entry.course = run.course.id;
    entry.feet = feet;
    entry.combo = run.maxCombo;
    store.history.push(entry);
    if (store.history.length > HISTORY_MAX) store.history = store.history.slice(-HISTORY_MAX);
    saveStore();

    renderFinish();
    showScreen('finish');
    flash();
    UdonAudio.fanfare();
    state.finishTimer = setTimeout(function () { goResult(); }, state.debug.hold ? 1e9 : 3600);
  }

  /**
   * 左右バランスを見られるか（両足で遊んだか）を判断する。
   *   - 両方の足にふみがある → 2
   *   - 片方しかふめていないが、もう片方の CORE も足の上で動いていた → 2（左右差としてそのまま見せる）
   *   - もう片方の CORE がつながっていない／置いてあるだけ → 1（バランスは計測しない）
   */
  function feetInPlay(steps) {
    var n = [0, 0];
    steps.forEach(function (s) { n[s.foot]++; });
    var minor = n[0] <= n[1] ? 0 : 1;
    if (n[minor] >= Math.max(3, steps.length * 0.1)) return 2;
    var moved = run.motion[minor] >= Math.max(0.05, detector.getThreshold() * 0.3);
    return (run.feetLive[0] && run.feetLive[1] && moved) ? 2 : 1;
  }

  function goResult() {
    clearTimeout(state.finishTimer);
    renderResult();
    showScreen('result');
  }

  // ---------------------------------------------------------------------------
  // 小さな UI 部品
  // ---------------------------------------------------------------------------
  var calloutTimer = null;
  function callout(text) {
    var el = $('callout');
    el.textContent = text;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(function () { el.classList.remove('is-on'); }, 1700);
  }

  var toastTimer = null;
  function toast(text) {
    var el = $('toast');
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); el.hidden = true; }, 2600);
  }

  function flash() {
    var el = $('flash');
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
  }

  function hideAssist() { $('assist').hidden = true; }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------------------
  // したく画面（コース・感度・ためしふみ）
  // ---------------------------------------------------------------------------
  function renderSetup() {
    var html = '';
    COURSES.forEach(function (c) {
      var on = c.id === store.settings.course;
      html += '<button type="button" role="radio" aria-checked="' + on + '" class="u-course' + (on ? ' is-on' : '') + '" data-course="' + c.id + '">' +
        '<span class="u-course-dish" style="--s:' + c.scale + '">' + UdonArt.dish('kake') + '</span>' +
        '<b>' + c.name + '</b><em>' + c.steps + '<small>ふみ</small><i>' + c.time + '</i></em><small>' + c.note + '</small></button>';
    });
    $('courseList').innerHTML = html;

    var s = store.settings.sens;
    html = '';
    UdonStepDetector.LEVELS.forEach(function (lv) {
      var on = s.mode === 'level' && s.level === lv.id;
      html += '<button type="button" role="radio" aria-checked="' + on + '" class="u-level' + (on ? ' is-on' : '') + '" data-level="' + lv.id + '">' +
        '<i style="--h:' + (22 + (6 - lv.id) * 15) + '%"></i><b>' + lv.label + '</b></button>';
    });
    $('levelList').innerHTML = html;
    var hint;
    if (s.mode === 'auto') {
      hint = '<b>じどう調整ずみ</b> あなたの足踏みに合わせました（' + UdonStepDetector.nearestLevel(s.threshold).label + '相当）。';
    } else {
      var lv = UdonStepDetector.levelById(s.level);
      hint = '<b>' + lv.label + '</b> ' + lv.hint + '。' + (lv.id >= 3 ? 'やさしい足踏みでも、少しずつうどんができます。' : '右へいくほど、弱い足踏みでも反応します。');
    }
    $('levelHint').innerHTML = hint;
  }

  function startCalibration() {
    if (state.calib) return;
    state.calib = { cal: new UdonStepDetector.Calibrator(), until: performance.now() + 6000, pressSteps: 0 };
    $('btnCalibrate').disabled = true;
    stage.querySelector('.u-try').classList.add('is-calib');
  }

  function endCalibration() {
    var r = state.calib.cal.result();
    var pressSteps = state.calib.pressSteps;
    state.calib = null;
    $('btnCalibrate').disabled = false;
    stage.querySelector('.u-try').classList.remove('is-calib');
    if (r.ok) {
      store.settings.sens = { mode: 'auto', level: r.level.id, threshold: r.threshold };
      applySensitivity();
      saveStore();
      renderSetup();
      $('tryText').textContent = 'ぴったりの感度に合わせました。ためしにふんで、たしかめてみましょう。';
      toast('感度を合わせました（' + r.level.label + '相当）');
      UdonAudio.good();
    } else if (isInsole() && pressSteps >= 3) {
      // 足の動きは小さいが、足うらの圧力ではっきり数えられている（座ったままの、やさしい足踏みなど）
      $('tryText').textContent = 'そっとした足踏みですが、足うらの圧力で ' + pressSteps + ' ふみ 数えられました。このままで大丈夫です。';
      UdonAudio.good();
    } else {
      $('tryText').textContent = '足の動きが見つかりませんでした。' + (isInsole() ? 'INSOLE' : 'CORE') + ' の接続をたしかめて、もう一度どうぞ。';
    }
  }

  // ---------------------------------------------------------------------------
  // できあがり・リザルト
  // ---------------------------------------------------------------------------
  function renderFinish() {
    var p = state.result.pick;
    $('finishDish').innerHTML = UdonArt.dish(p.id, { title: p.item.name });
    $('finishName').textContent = p.item.name;
    $('finishTrait').textContent = p.item.trait;
    $('finishNew').hidden = !p.isNew;
  }

  function renderResult() {
    var r = state.result, a = r.analysis, item = r.pick.item;
    $('resultDish').innerHTML = UdonArt.dish(r.pick.id, { title: item.name });
    $('resultName').innerHTML = esc(item.name) + (r.pick.isNew ? '<span class="u-new">NEW</span>' : '');
    $('resultStars').innerHTML = UdonArt.stars(item.rarity);
    $('resultTrait').textContent = item.trait;
    $('resultReason').textContent = item.reason;
    var d = r.at;
    $('resultDate').textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
      d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2) + '｜' + r.course.name + 'コース｜感度 ' + r.sens +
      (r.device === 'insole' ? '｜INSOLE' : '');

    // スコア
    countUp($('scoreNum'), a.ok ? a.total : 0);
    $('scoreNum').parentNode.classList.toggle('is-none', !a.ok);
    $('rankStamp').innerHTML = UdonArt.stamp(a.ok ? a.rank.ja : '試食', a.ok ? rankColor(a.rank.key) : '#7A6F68');
    $('rankEn').textContent = a.ok ? a.rank.en : 'TASTING';
    $('rankJa').textContent = a.ok ? ('うどん' + a.rank.ja) : 'もう少しふむと診断できます';
    $('radar').innerHTML = UdonCharts.radar(a.axes);

    // 数字のタイル
    var tiles = [
      ['じかん', UdonCharts.timeLabel(a.activeSec), a.restCount ? ('ひとやすみ ' + a.restCount + '回') : 'ふんでいた時間'],
      ['ふみ数', a.stepCount + '<small>ふみ</small>', r.course.name + 'コース'],
      ['テンポ', Math.round(a.cadence) + '<small>ふみ/分</small>', 'さいだいコンボ ' + r.maxCombo],
      a.feet === 2
        ? ['左右', Math.round(a.left.share * 100) + '<small>:</small>' + Math.round(a.right.share * 100), '左（01）: 右（02）']
        : ['ちから', a.medianPeak.toFixed(2) + '<small>G</small>', 'ふみこみの強さ']
    ];
    $('statTiles').innerHTML = tiles.map(function (t) {
      return '<li><span>' + t[0] + '</span><b>' + t[1] + '</b><small>' + esc(t[2]) + '</small></li>';
    }).join('');
    $('advicePraise').textContent = a.praise;
    $('adviceTip').textContent = a.tip;

    // ログ
    $('timeline').innerHTML = UdonCharts.timeline(a);
    $('axisList').innerHTML = a.axes.map(function (ax) {
      var none = ax.score === null;
      return '<li' + (none ? ' class="is-none"' : '') + '><b>' + ax.label + '</b><span class="u-axisbar"><i style="width:' + (none ? 0 : ax.score) + '%"></i></span>' +
        '<em>' + (none ? '—' : ax.score) + '</em><small>' + esc(ax.display) + '</small></li>';
    }).join('');

    $('zukanInline').innerHTML = zukanHtml(r.pick.id);
    var sole = soleHtml(r.sole);
    $('tabSole').hidden = !sole;
    $('soleReport').innerHTML = sole;
    $('btnRawCsv').hidden = !r.raw;
    selectTab('score');
    refreshZukanCount();
  }

  /**
   * INSOLE のリザルト「あしうら」: 足うらのどこに体重がのっていたか。
   * センサどうし・左右どうしの生値は比べられないので（個体差がある）、足ごとの「割合」だけを見せる
   */
  function soleHtml(sole) {
    if (!sole || !(sole[0].ok || sole[1].ok)) return '';
    var pct = function (v) { return Math.round(v * 100); };
    var html = '<div class="u-sole-feet">';
    sole.forEach(function (f, i) {
      var side = i === 0 ? 'L' : 'R';
      var name = i === 0 ? '左足' : '右足';
      if (!f.ok) {
        html += '<figure class="u-sole-foot is-none">' + UdonArt.insoleMap(side, { layout: UdonInsolePressure.LAYOUT }) +
          '<figcaption><b>' + name + '</b><p>きろくがありません</p></figcaption></figure>';
        return;
      }
      var max = Math.max.apply(null, f.share) || 1;
      var zones = [['つま先', f.fore], ['まんなか', f.mid], ['かかと', f.heel]];
      html += '<figure class="u-sole-foot">' +
        UdonArt.insoleMap(side, { layout: UdonInsolePressure.LAYOUT, values: f.share.map(function (v) { return v / max; }) }) +
        '<figcaption><b>' + name + '</b><ul class="u-sole-zones">' + zones.map(function (z) {
          return '<li><span>' + z[0] + '</span><i><em style="width:' + pct(z[1]) + '%"></em></i><b>' + pct(z[1]) + '<small>%</small></b></li>';
        }).join('') + '</ul>' +
        // 内がわ（親指側）と外がわ（小指側）のどちらに体重がのっていたか。左足は内がわが右、右足は内がわが左
        '<div class="u-sole-side">' + (i === 0 ? '<span>外がわ</span>' : '<span>内がわ</span>') +
        '<i><em style="left:' + pct(i === 0 ? f.inner : 1 - f.inner) + '%"></em></i>' +
        (i === 0 ? '<span>内がわ</span>' : '<span>外がわ</span>') + '</div>' +
        '<p class="u-sole-time">のせていた時間<b>' + pct(f.loadedRatio) + '%</b></p>' +
        '<p>' + esc(soleComment(f)) + '</p></figcaption></figure>';
    });
    html += '</div><p class="u-sole-note"><i class="bi bi-info-circle"></i> 丸が大きいところほど、体重がよくのっていました。' +
      'センサの当たり方は、くつやインソールの位置で変わります。目安としてごらんください。</p>';
    return html;
  }

  function soleComment(f) {
    if (f.heel >= 0.62) return 'かかと中心でふんでいます。足うら全体をつけると、安定してふめます。';
    if (f.fore >= 0.5) return 'つま先寄りでふんでいます。かかとまで下ろすと、ふくらはぎが楽になります。';
    if (f.fore < 0.08) return 'かかとから まんなかでふんでいます。つま先まで体重をのせると、ふみ切りが強くなります。';
    return '足うら全体で、バランスよくふめています。';
  }

  function rankColor(key) {
    return { meijin: '#D8303F', shokunin: '#E15C3A', ichininmae: '#2E6FB7', minarai: '#3E8E7E', deshi: '#7A6F68' }[key] || '#D8303F';
  }

  function countUp(el, to) {
    var t0 = performance.now();
    var dur = state.debug.fast ? 1 : 900;
    (function tick() {
      var k = Math.min(1, (performance.now() - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    })();
  }

  function selectTab(name) {
    var tabs = stage.querySelectorAll('.u-tabs button');
    var panes = stage.querySelectorAll('.u-tabpane');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].dataset.tab === name;
      tabs[i].classList.toggle('is-on', on);
      tabs[i].setAttribute('aria-selected', on);
    }
    for (i = 0; i < panes.length; i++) panes[i].classList.toggle('is-on', panes[i].dataset.pane === name);
  }

  function collectedCount() {
    var n = 0;
    UdonMenu.MENU.forEach(function (m) { if (store.collection[m.id]) n++; });
    return n;
  }

  function refreshZukanCount() {
    $('zukanCount').textContent = collectedCount() + '/' + UdonMenu.MENU.length;
  }

  function zukanHtml(highlightId) {
    return '<p class="u-zukan-head">あつめたうどん <b>' + collectedCount() + '</b> / ' + UdonMenu.MENU.length +
      '<small>ふみかたを変えると、ちがううどんに出会えます</small></p><ul class="u-zukan-grid">' +
      UdonMenu.MENU.map(function (m) {
        var c = store.collection[m.id];
        if (!c) {
          return '<li class="is-locked">' + UdonArt.dish(m.id, { locked: true, title: 'まだ出会っていないうどん' }) +
            '<b>？？？</b><small>' + esc(m.hint) + '</small></li>';
        }
        return '<li' + (m.id === highlightId ? ' class="is-now"' : '') + '>' + UdonArt.dish(m.id, { title: m.name }) +
          '<b>' + esc(m.name) + '</b><small>' + esc(m.trait) + '・' + c.count + '杯</small></li>';
      }).join('') + '</ul>';
  }

  function historyHtml() {
    var h = store.history;
    var today = new Date().toDateString();
    var tSteps = 0, tSec = 0, tRuns = 0;
    h.forEach(function (e) {
      if (new Date(e.at).toDateString() === today) { tSteps += e.steps; tSec += e.activeSec; tRuns++; }
    });
    var recent = h.slice(-20);
    var fmt = function (iso) {
      var d = new Date(iso);
      return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
    };
    var html = '<ul class="u-stats u-stats--sheet">' +
      '<li><span>きょうのふみ数</span><b>' + tSteps + '<small>ふみ</small></b><small>' + tRuns + '杯ぶん</small></li>' +
      '<li><span>きょうの運動時間</span><b>' + UdonCharts.timeLabel(tSec) + '</b><small>ふんでいた時間の合計</small></li>' +
      '<li><span>これまで</span><b>' + h.length + '<small>杯</small></b><small>この端末のきろく</small></li></ul>';
    html += '<h4 class="u-sheet-sub">ふみふみ技（スコア）のうつりかわり</h4><div class="u-chart">' +
      UdonCharts.sparkline(recent.map(function (e) {
        var m = UdonMenu.byId(e.udon);
        return { total: e.total, tip: fmt(e.at) + '｜' + e.total + '点｜' + (m ? m.name : '') + '｜' + e.steps + 'ふみ' };
      }), { fromLabel: recent.length ? fmt(recent[0].at) : '', toLabel: recent.length > 1 ? fmt(recent[recent.length - 1].at) : '' }) + '</div>';
    if (h.length) {
      html += '<table class="u-histtable"><thead><tr><th>日時</th><th>うどん</th><th>点</th><th>ふみ</th><th>テンポ</th></tr></thead><tbody>' +
        h.slice(-8).reverse().map(function (e) {
          var m = UdonMenu.byId(e.udon);
          return '<tr><td>' + fmt(e.at) + '</td><td>' + esc(m ? m.name : '—') + '</td><td>' + e.total + '</td><td>' + e.steps + '</td><td>' + e.cadence + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p class="u-sheet-foot"><button type="button" class="u-link u-link--dark" id="btnClearHistory"><i class="bi bi-trash3"></i> きろくと図鑑を消す</button>' +
        '<span>きろくはこのブラウザの中だけに保存されます</span></p>';
    }
    return html;
  }

  function openSheet(kind) {
    $('sheetTitle').textContent = kind === 'zukan' ? 'うどん図鑑' : 'ふみふみのきろく';
    $('sheetBody').innerHTML = kind === 'zukan' ? ('<div class="u-zukan">' + zukanHtml() + '</div>') : historyHtml();
    $('sheet').hidden = false;
    $('btnSheetClose').focus();
  }

  function closeSheet() { $('sheet').hidden = true; }

  function downloadCsv() {
    if (!state.result) return;
    var csv = UdonHealth.toCsv(state.result.analysis);
    var d = state.result.at;
    var pad = function (n) { return ('0' + n).slice(-2); };
    var name = 'fumifumi-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.csv';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('ログを保存しました');
  }

  // ---------------------------------------------------------------------------
  // ツールチップ（グラフの細かい値。ホバーでもキーボードのフォーカスでも出る）
  // ---------------------------------------------------------------------------
  var tip = document.createElement('div');
  tip.className = 'u-tip';
  tip.hidden = true;
  stage.appendChild(tip);

  function showTip(target) {
    var text = target.getAttribute('data-tip');
    if (!text) return;
    tip.innerHTML = text.split('｜').map(function (part, i) { return (i ? '<span>' : '<b>') + esc(part) + (i ? '</span>' : '</b>'); }).join('');
    tip.hidden = false;
    var sr = stage.getBoundingClientRect(), tr = target.getBoundingClientRect();
    var x = tr.left + tr.width / 2 - sr.left, y = tr.top - sr.top;
    tip.style.left = Math.max(tip.offsetWidth / 2 + 6, Math.min(sr.width - tip.offsetWidth / 2 - 6, x)) + 'px';
    tip.style.top = Math.max(tip.offsetHeight + 8, y) + 'px';
  }

  stage.addEventListener('pointerover', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-tip')) showTip(e.target); });
  stage.addEventListener('pointerout', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-tip')) tip.hidden = true; });
  stage.addEventListener('focusin', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-tip')) showTip(e.target); });
  stage.addEventListener('focusout', function () { tip.hidden = true; });

  // ---------------------------------------------------------------------------
  // シーン（キャンバス）
  // ---------------------------------------------------------------------------
  var N = 36;   // 生地の上面の制御点の数
  var legImg = [null, null];       // CORE を足の甲に付けた足
  var legImgBare = [null, null];   // INSOLE 用（CORE なし。インソールは drawLeg が足の下に描く）
  var scene = {};

  function resetScene() {
    scene.t = scene.t || 0;
    scene.dough = {
      x: DOUGH_X, baseY: BOARD_Y + 4, w: 330, h: 250, ex: 0.72, ey: 0.78,
      off: new Array(N + 1).fill(0), vel: new Array(N + 1).fill(0),
      squash: 0, squashV: 0, cycle0: 0
    };
    scene.legs = [
      { x: 452, soleY: 0, state: 'idle', t: 0, press: 0, glow: 0, init: false, kick: 0, tilt: 0 },
      { x: 668, soleY: 0, state: 'idle', t: 0, press: 0, glow: 0, init: false, kick: 0, tilt: 0 }
    ];
    scene.pin = { x: DOUGH_X - 200, tx: DOUGH_X - 200, rot: 0, dir: 1 };
    scene.cut = { n: 0, chopT: 9 };
    scene.boil = { t: 0 };
    scene.parts = [];
    scene.words = [];
    scene.hop = scene.hop || { x: -60, phase: 0, kick: 0 };
  }

  var LEG_W = 200, LEG_H = LEG_W * 910 / 465;
  var INSOLE_H = 15;   // 足の下に描くインソールの厚み

  /**
   * INSOLE の圧力で足を動かしているか。動かしているなら、その足の押しぐあい 0〜1 を返す（そうでなければ null）。
   * ふみふみ中は、画面の足が「ふんだ瞬間」だけでなく、足うらにかかっている圧力のとおりに生地を押す
   */
  function soleLoad(foot) {
    if (!isInsole() || state.screen !== 'play') return null;
    return press.isLive(foot, performance.now()) ? press.load(foot) : null;
  }

  function restTop(d, x) {
    var u = Math.min(1, Math.abs((x - d.x) / (d.w / 2)));
    var c = Math.pow(u, 1 / d.ex);
    var s = Math.sqrt(Math.max(0, 1 - c * c));
    return d.baseY - d.h * Math.pow(s, d.ey);
  }

  /** 1 ふみぶんの演出。mult = コンボの倍率 */
  function sceneStep(phase, foot, k, mult) {
    var d = scene.dough;
    var lv = run ? run.level : 0;
    if (lv > 0) scene.glowPulse = 1;   // コンボ中は、ふむたびに後ろの丸がふくらむ
    if (phase === 'knead') {
      var leg = scene.legs[foot];
      leg.glow = 1;
      if (soleLoad(foot) !== null) {
        // INSOLE: 足の上下は圧力が決める。ふんだ瞬間は、ぐっと押しこむ勢いだけ足す
        leg.kick = 1;
      } else {
        leg.state = 'down'; leg.t = 0; leg.press = 22 + 26 * k;
        leg.from = leg.soleY;
      }
      d.squashV += 2.2 + 2.4 * k;
      var cx = leg.x + LEG_W * 0.44;
      puffs(d.x - d.w / 2 - 6, d.baseY - 10, -1, 3);
      puffs(d.x + d.w / 2 + 6, d.baseY - 10, 1, 3);
      word(pickWord('knead'), cx + (foot ? 150 : -190), restTop(d, cx) - 90 - Math.random() * 40);
      if (mult > 1) word('+' + mult, d.x + (foot ? 70 : -70) + (Math.random() - 0.5) * 60, restTop(d, d.x) - 150 - Math.random() * 40, COL.yolk);
      // コンボが上がるほど、音が少しずつ高くなる
      UdonAudio.play('puni', { rate: (foot ? 1.06 : 0.95) + lv * 0.07 + (Math.random() - 0.5) * 0.06, gain: 0.7 + 0.5 * k });
    } else if (phase === 'roll') {
      var pin = scene.pin;
      pin.dir = (foot === 0) === (pin.dir > 0) ? -pin.dir : pin.dir;
      if (run && !(run.feetUsed[0] && run.feetUsed[1])) pin.dir = -pin.dir;   // 片足のときは往復
      var half = d.w / 2 - 80;
      // INSOLE を両足につけているときは、麺棒は体重の移動で転がる（updateScene の rollBySole）
      if (!rollBySole()) {
        pin.tx = d.x + (foot === 0 || pin.dir < 0 ? -half : half);
        if (Math.abs(pin.tx - pin.x) < 40) pin.tx = d.x + (pin.x > d.x ? -half : half);
      }
      d.squashV += 1.2;
      if (mult > 1) word('+' + mult, d.x + (Math.random() - 0.5) * 160, d.baseY - d.h - 150 - Math.random() * 40, COL.yolk);
      scene.side = -(scene.side || 1);
      word(pickWord('roll'), d.x + scene.side * 210, BOARD_Y - 340 - Math.random() * 30);
      UdonAudio.roll();
    } else {
      var K = cutTotal();
      // コンボ中は 1 回の「トン」でたくさん切れる
      var cutP = (run.points / run.target - ROLL_END) / (1 - ROLL_END);
      scene.cut.n = Math.min(K, Math.max(scene.cut.n + 1, Math.round(K * cutP)));
      scene.cut.chopT = 0;
      var xCut = cutX(scene.cut.n, K);
      puffs(xCut, BOARD_Y - 6, 1, 2);
      scene.side = -(scene.side || 1);
      word(pickWord('cut'), xCut + 120 + scene.side * 90, BOARD_Y - 250 - (scene.side > 0 ? 70 : 0));
      if (mult > 1) word('+' + mult, xCut - 90 + (Math.random() - 0.5) * 80, BOARD_Y - 330 - Math.random() * 40, COL.yolk);
      UdonAudio.chop();
    }
  }

  /**
   * INSOLE を両足につけているとき、「のばす」の麺棒を体重の移動で転がす。
   * 左足に体重をのせると左へ、右足にのせると右へ。動かしたら true（片足のときは、従来どおり 1 ふみごとに往復）
   */
  function rollBySole() {
    var l = soleLoad(0), r = soleLoad(1);
    if (l === null || r === null) return false;
    var d = scene.dough;
    var half = d.w / 2 - 80;
    var shift = Math.max(-1, Math.min(1, (r - l) * 1.5));
    scene.pin.tx = d.x + half * shift;
    return true;
  }

  /** 「きる」区間で、生地を何本ぶんに切り分けて見せるか */
  function cutTotal() { return run ? Math.max(6, Math.min(40, Math.round(run.target * (1 - ROLL_END)))) : 12; }
  var CUT_W = 600, CUT_H = 112;
  function cutX(n, K) { return DOUGH_X - 60 + CUT_W / 2 - CUT_W * Math.min(1, n / K); }

  function pickWord(kind) { var w = WORDS[kind]; return w[Math.floor(Math.random() * w.length)]; }

  var WORD_LIFE = 0.62;
  function word(text, x, y, color) {
    scene.words.push({ text: text, x: Math.max(120, Math.min(LW - 120, x)), y: y, t: 0, rot: (Math.random() - 0.5) * 0.3, color: color });
    if (scene.words.length > 4) scene.words.shift();
  }

  function puffs(x, y, dir, n) {
    for (var i = 0; i < n; i++) {
      scene.parts.push({
        kind: 'puff', x: x, y: y, vx: dir * (60 + Math.random() * 120), vy: -40 - Math.random() * 90,
        r: 7 + Math.random() * 6, t: 0, life: 0.5 + Math.random() * 0.3
      });
    }
  }

  function burst(x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = 160 + Math.random() * 240;
      scene.parts.push({
        kind: 'star', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120,
        r: 9 + Math.random() * 9, t: 0, life: 0.7 + Math.random() * 0.4, rot: Math.random() * 6
      });
    }
  }

  // --- 更新 -------------------------------------------------------------------
  function ease(k) { return 1 - Math.pow(1 - k, 3); }

  function updateDough(dt) {
    var d = scene.dough;
    var tw, th, ex, ey;
    var phase = run ? run.phase : 'knead';
    if (state.screen === 'intro') phase = 'knead';
    if (phase === 'knead') {
      var per = run ? run.target * KNEAD_END / 3 : 6;
      var c = run ? Math.min(1, (run.points - d.cycle0) / per) : (0.25 + 0.2 * Math.sin(scene.t * 0.8));
      var folds = run ? run.folds : 0;
      tw = 330 + (290 + folds * 16) * ease(c);
      th = 250 - (130 - folds * 4) * ease(c);
      ex = 0.72; ey = 0.78;
    } else if (phase === 'roll') {
      var cr = Math.max(0, Math.min(1, (run.points / run.target - KNEAD_END) / (ROLL_END - KNEAD_END)));
      tw = 640 + 250 * cr; th = 92 - 44 * cr; ex = 0.3; ey = 0.42;
    } else {
      tw = CUT_W; th = CUT_H; ex = 0.12; ey = 0.2;
    }
    var k = 1 - Math.exp(-dt * 9);
    d.w += (tw - d.w) * k; d.h += (th - d.h) * k;
    d.ex += (ex - d.ex) * k; d.ey += (ey - d.ey) * k;

    // ばねの計算は 1/120 秒きざみ（フレームが遅い端末でも発散させない）
    var o = d.off, v = d.vel;
    var sub = Math.max(1, Math.ceil(dt / (1 / 120)));
    var h = dt / sub;
    for (var n = 0; n < sub; n++) {
      // ぷるんと戻る全体のつぶれ
      d.squashV += (-90 * d.squash - 11 * d.squashV) * h;
      d.squash += d.squashV * h;
      // 上面の波打ち（となり同士がつながったばね）
      for (var i = 0; i <= N; i++) {
        var l = o[Math.max(0, i - 1)], r = o[Math.min(N, i + 1)];
        v[i] += (-300 * o[i] - 14 * v[i] + 420 * (l + r - 2 * o[i])) * h;
      }
      for (i = 0; i <= N; i++) o[i] += v[i] * h;
    }

  }

  function doughPoints(d) {
    var pts = [];
    var sx = 1 + d.squash * 0.045, sy = 1 - d.squash * 0.07;
    for (var i = 0; i <= N; i++) {
      var a = Math.PI * (1 - i / N);
      var c = Math.cos(a), s = Math.sin(a);
      var x = d.x + (d.w / 2) * sx * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), d.ex);
      var y = d.baseY - d.h * sy * Math.pow(s, d.ey) + d.off[i];
      pts.push([x, Math.min(d.baseY - 6, y)]);
    }
    return pts;
  }

  /**
   * 足の裏が生地を押し下げる（足の下の制御点を足裏より上に行かせない）。
   * slope を渡すと足裏がかたむく（x が 1 進むごとに slope だけ下がる。pivotX での高さが soleY）
   */
  function pressDough(x0, x1, soleY, slope, pivotX) {
    var d = scene.dough;
    var sx = 1 + d.squash * 0.045, sy = 1 - d.squash * 0.07;
    for (var i = 0; i <= N; i++) {
      var a = Math.PI * (1 - i / N);
      var c = Math.cos(a), s = Math.sin(a);
      var x = d.x + (d.w / 2) * sx * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), d.ex);
      if (x < x0 || x > x1) continue;
      var rest = d.baseY - d.h * sy * Math.pow(s, d.ey);
      var need = Math.min(soleY + (slope ? (x - pivotX) * slope : 0), d.baseY - 26) - rest;
      if (d.off[i] < need) { d.off[i] = need; if (d.vel[i] < 0) d.vel[i] = 0; }
    }
  }

  function updateLegs(dt) {
    var d = scene.dough;
    for (var i = 0; i < 2; i++) {
      var leg = scene.legs[i];
      var cx = leg.x + LEG_W * 0.44;
      var top = restTop(d, cx);
      var hover = top - 62 + Math.sin(scene.t * 2.2 + i * Math.PI) * 5;
      if (!leg.init) { leg.soleY = hover; leg.init = true; }
      leg.t += dt;
      leg.glow = Math.max(0, leg.glow - dt * 2.4);
      var load = soleLoad(i);
      if (load !== null) {
        // INSOLE: 足うらの圧力のとおりに、足が生地にしずむ。圧がぬけると足が上がる
        leg.state = 'idle';
        leg.kick = Math.max(0, leg.kick - dt * 7);
        var touch = Math.min(1, load / 0.1);                      // 足が生地にふれているか
        var lifted = top - 78 + Math.sin(scene.t * 2.2 + i * Math.PI) * 4;
        var deep = Math.min(top + 14 + 44 * load + leg.kick * 12, d.baseY - 30);
        var want = lifted + (deep - lifted) * touch;
        leg.soleY += (want - leg.soleY) * (1 - Math.exp(-dt * 30));
        // つま先寄り・かかと寄りで、足がすこしかたむく（つま先は左）
        var cop = press.cop(i);
        var tiltWant = cop.valid ? -cop.fore * 0.06 * Math.min(1, load * 2.5) : 0;
        leg.tilt += (tiltWant - leg.tilt) * (1 - Math.exp(-dt * 12));
        // インソールの光り方が見えるよう、生地の線はインソールのすぐ下にくる
        if (touch > 0.05) pressDough(leg.x + 8, leg.x + LEG_W * 0.9, leg.soleY + 3, Math.tan(leg.tilt), leg.x + LEG_W * 0.72);
        continue;
      }
      leg.tilt += (0 - leg.tilt) * (1 - Math.exp(-dt * 12));
      var pressY = Math.min(top + leg.press, d.baseY - 30);
      if (leg.state === 'down') {
        var k = Math.min(1, leg.t / 0.075);
        leg.soleY = leg.from + (pressY - leg.from) * k * k;
        if (k >= 1) { leg.state = 'hold'; leg.t = 0; }
      } else if (leg.state === 'hold') {
        leg.soleY = pressY;
        if (leg.t > 0.07) { leg.state = 'up'; leg.t = 0; }
      } else if (leg.state === 'up') {
        var u = Math.min(1, leg.t / 0.26);
        leg.soleY = pressY + (hover - pressY) * ease(u);
        if (u >= 1) leg.state = 'idle';
      } else {
        leg.soleY += (hover - leg.soleY) * (1 - Math.exp(-dt * 10));
      }
      if (leg.state !== 'idle') pressDough(leg.x + 8, leg.x + LEG_W * 0.9, leg.soleY - 6);
    }
  }

  function updateScene(dt) {
    scene.t += dt;
    // コンボの明るさ（ふみふみ中だけ。なめらかに追従する）
    var wantGlow = (run && state.screen === 'play' && !run.done) ? run.level : 0;
    scene.glow = (scene.glow || 0) + (wantGlow - (scene.glow || 0)) * (1 - Math.exp(-dt * 4));
    scene.glowPulse = Math.max(0, (scene.glowPulse || 0) - dt * 4);
    var i;
    for (i = scene.parts.length - 1; i >= 0; i--) {
      var p = scene.parts[i];
      p.t += dt;
      if (p.t >= p.life) { scene.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.kind === 'star' ? 520 : 60) * dt;
      p.vx *= Math.exp(-dt * 2);
    }
    for (i = scene.words.length - 1; i >= 0; i--) {
      scene.words[i].t += dt;
      if (scene.words[i].t > WORD_LIFE) scene.words.splice(i, 1);
    }

    var s = state.screen;
    if (s === 'title' || s === 'setup' || s === 'result' || s === 'finish') {
      var h = scene.hop;
      var speed = 1.15 + h.kick * 1.6;
      h.kick = Math.max(0, h.kick - dt * 0.9);
      h.phase += dt * speed;
      h.x += dt * 92 * speed;
      if (h.x > LW + 90) h.x = -90;
    }
    if (s === 'intro') {
      // 見本: 足が左右交互にふむ
      state.introT += dt;
      var beat = Math.floor(state.introT / 0.55);
      if (beat !== scene.introBeat) {
        scene.introBeat = beat;
        if (state.introT > 0.3) {
          var leg = scene.legs[beat % 2];
          leg.state = 'down'; leg.t = 0; leg.press = 34; leg.from = leg.soleY;
          scene.dough.squashV += 3;
        }
      }
      updateDough(dt);
      updateLegs(dt);
      var left = Math.ceil(3.9 - (state.introT - 1.4));
      if (state.introT > 1.4 && left !== state.lastCount) {
        state.lastCount = left;
        var cd = $('countdown');
        if (left >= 1 && left <= 3) {
          cd.textContent = left;
          cd.classList.remove('is-pop'); void cd.offsetWidth; cd.classList.add('is-pop');
          UdonAudio.tick(false);
        }
      }
      if (state.introT >= (state.debug.fast ? 0.2 : 5.3)) startPlay();
    }
    if ((s === 'play' || s === 'boil') && run) {
      if (!state.paused) {
        updateDough(dt);
        if (run.phase === 'knead') updateLegs(dt);
        var pin = scene.pin;
        if (run.phase === 'roll') rollBySole();
        var dx = (pin.tx - pin.x) * (1 - Math.exp(-dt * 9));
        pin.x += dx; pin.rot += dx / 52;
        scene.cut.chopT += dt;
      }
      if (s === 'boil') scene.boil.t += dt;
    }
  }

  // --- 描画 -------------------------------------------------------------------
  function mix(a, b, k) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var ch = function (sh) { return Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * k); };
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }

  function inkShape(fill, lw) {
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = lw === undefined ? 11 : lw;
    ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawBackdrop() {
    ctx.fillStyle = COL.shu;
    ctx.fillRect(-400, -400, LW + 800, LH + 800);
    // うしろの大きな丸（のれんの向こうの明かり）。コンボが続くほど明るくなる
    var glow = scene.glow || 0;
    if (glow > 2.05) {
      // 最高のコンボ: 光の筋がゆっくり回る
      ctx.save();
      ctx.translate(DOUGH_X, 400); ctx.rotate(scene.t * 0.25);
      ctx.fillStyle = mix(COL.shu, COL.glow, 0.28 * Math.min(1, glow - 2.05) / 0.95);
      for (var r = 0; r < 12; r++) {
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.arc(0, 0, 1400, r * Math.PI / 6, r * Math.PI / 6 + Math.PI / 12);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(DOUGH_X, 400, 372 + (scene.glowPulse || 0) * 16, 0, Math.PI * 2);
    ctx.fillStyle = mix(COL.shuLight, COL.glow, Math.min(1, glow / 3) * 0.8); ctx.fill();
    // のし板
    ctx.fillStyle = COL.wood;
    ctx.fillRect(-400, BOARD_Y, LW + 800, LH - BOARD_Y + 400);
    ctx.strokeStyle = COL.woodDark; ctx.lineWidth = 6; ctx.lineCap = 'round';
    [[60, 640, 300], [470, 660, 180], [760, 636, 260], [1090, 668, 140], [180, 692, 220], [900, 698, 300]].forEach(function (g) {
      ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[0] + g[2], g[1]); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(-400, BOARD_Y); ctx.lineTo(LW + 400, BOARD_Y);
    ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.stroke();
  }

  function drawDough(d) {
    var pts = doughPoints(d);
    // 板に落ちる影
    ctx.fillStyle = COL.woodDark;
    ctx.beginPath(); ctx.ellipse(d.x, d.baseY + 6, d.w / 2 + 16, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], d.baseY);
    ctx.lineTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[N][0], pts[N][1]);
    ctx.lineTo(pts[N][0], d.baseY);
    ctx.closePath();
    inkShape(COL.dough, 11);
    // つや
    var q = Math.round(N * 0.2), q2 = Math.round(N * 0.36);
    ctx.beginPath();
    ctx.moveTo(pts[q][0] + 16, pts[q][1] + 26);
    ctx.quadraticCurveTo(pts[q + 2][0] + 10, pts[q + 2][1] + 20, pts[q2][0], pts[q2][1] + 20);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke();
  }

  function drawLeg(i) {
    var leg = scene.legs[i];
    var sole = isInsole();
    var img = (sole ? legImgBare : legImg)[i];
    if (!img || !img.complete || !img.naturalWidth) return;
    var k = LEG_W / 465;
    var y = leg.soleY - LEG_H + 4 - (sole ? INSOLE_H : 0);
    if (sole) {
      drawSoleLeg(i, leg, img, y, k);
      return;
    }
    ctx.drawImage(img, leg.x, y, LEG_W, LEG_H);
    // 画像の上端より先（ひざから上）を、画面の外までつぎ足す
    var x0 = leg.x + 206 * k, x1 = leg.x + 444 * k, yTop = y + 12 * k;
    ctx.fillStyle = COL.peach;
    ctx.fillRect(x0 + 10 * k, -2000, x1 - x0 - 20 * k, yTop + 2000 + 16 * k);
    ctx.strokeStyle = INK; ctx.lineWidth = 22 * k; ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x0, -2000); ctx.lineTo(x0, yTop + 6 * k);
    ctx.moveTo(x1, -2000); ctx.lineTo(x1, yTop + 6 * k);
    ctx.stroke();
    if (leg.glow > 0) {
      // ふんだ瞬間、CORE の LED が光る
      var gx = leg.x + 221 * k, gy = y + 778 * k;
      ctx.beginPath(); ctx.arc(gx, gy, 10 + (1 - leg.glow) * 34, 0, Math.PI * 2);
      ctx.strokeStyle = COL.led[i]; ctx.globalAlpha = leg.glow; ctx.lineWidth = 6; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * INSOLE の足: 足の下にインソールを描き、つま先・まんなか・かかとの 3 つに分けて、
   * 圧力がかかっているところほど濃く光らせる。足首を中心に、つま先寄り／かかと寄りでかたむく
   */
  function drawSoleLeg(i, leg, img, y, k) {
    var px = leg.x + 330 * k, py = y + 800 * k;   // 足首のあたり
    var pads = press.pads(i);
    var live = soleLoad(i) !== null;
    var zone = live ? [Math.max(pads[0], pads[2]), Math.max(pads[1], pads[3], pads[4]), pads[5]] : [0, 0, 0];
    ctx.save();
    ctx.translate(px, py); ctx.rotate(leg.tilt); ctx.translate(-px, -py);
    // インソール（つま先が左）
    var bx = leg.x + 18 * k, bw = 424 * k, by = y + 897 * k, bh = INSOLE_H + 3;
    roundRect(bx, by, bw, bh, bh / 2);
    ctx.fillStyle = COL.white; ctx.fill();
    ctx.save();
    roundRect(bx, by, bw, bh, bh / 2); ctx.clip();
    var cuts = [0, 0.3, 0.68, 1];
    for (var z = 0; z < 3; z++) {
      ctx.fillStyle = mix(COL.white, COL.led[i], 0.18 + 0.82 * Math.min(1, zone[z]));
      ctx.fillRect(bx + bw * cuts[z], by, bw * (cuts[z + 1] - cuts[z]), bh);
    }
    ctx.restore();
    roundRect(bx, by, bw, bh, bh / 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineWidth = 4; ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.3, by); ctx.lineTo(bx + bw * 0.3, by + bh);
    ctx.moveTo(bx + bw * 0.68, by); ctx.lineTo(bx + bw * 0.68, by + bh);
    ctx.stroke();
    ctx.drawImage(img, leg.x, y, LEG_W, LEG_H);
    // ひざから上を画面の外までつぎ足す（かたむいても切れ目が見えないよう、足といっしょに回す）
    var x0 = leg.x + 206 * k, x1 = leg.x + 444 * k, yTop = y + 12 * k;
    ctx.fillStyle = COL.peach;
    ctx.fillRect(x0 + 10 * k, -2000, x1 - x0 - 20 * k, yTop + 2000 + 16 * k);
    ctx.strokeStyle = INK; ctx.lineWidth = 22 * k; ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x0, -2000); ctx.lineTo(x0, yTop + 6 * k);
    ctx.moveTo(x1, -2000); ctx.lineTo(x1, yTop + 6 * k);
    ctx.stroke();
    if (leg.glow > 0) {
      // ふんだ瞬間、インソールが光る
      ctx.beginPath(); ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2 + (1 - leg.glow) * 26, bh / 2 + (1 - leg.glow) * 20, 0, 0, Math.PI * 2);
      ctx.strokeStyle = COL.led[i]; ctx.globalAlpha = leg.glow; ctx.lineWidth = 6; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawPin(d) {
    var pin = scene.pin;
    var r = 52;
    var y = restTop(d, pin.x) - r + 10;
    ctx.save();
    ctx.translate(pin.x, y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); inkShape('#E3B877', 11);
    ctx.rotate(pin.rot);
    ctx.strokeStyle = COL.woodDark; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 34, 0.3, 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 34, 3.4, 4.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); inkShape('#C98A4B', 8);
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
    ctx.restore();
    // 麺棒の下の生地を押さえる
    pressDough(pin.x - 46, pin.x + 46, y + r - 4);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCut() {
    var K = cutTotal();
    var n = Math.min(K, scene.cut.n);
    var cx = DOUGH_X - 60;
    var xL = cx - CUT_W / 2, yT = BOARD_Y + 4 - CUT_H;
    var sw = CUT_W / K;
    var gap = Math.min(7, 130 / K);
    ctx.fillStyle = COL.woodDark;
    ctx.beginPath(); ctx.ellipse(cx + 40, BOARD_Y + 10, CUT_W / 2 + 90, 12, 0, 0, Math.PI * 2); ctx.fill();
    // のこりの生地（屏風だたみ）
    var remain = CUT_W * (1 - n / K);
    if (remain > 4) {
      roundRect(xL, yT, remain, CUT_H, Math.min(26, remain / 2));
      inkShape(COL.dough, 11);
      ctx.save();
      roundRect(xL, yT, remain, CUT_H, Math.min(26, remain / 2)); ctx.clip();
      ctx.strokeStyle = COL.doughShade; ctx.lineWidth = 7; ctx.lineCap = 'round';
      [0.36, 0.68].forEach(function (f) {
        ctx.beginPath(); ctx.moveTo(xL + 16, yT + CUT_H * f); ctx.lineTo(xL + CUT_W, yT + CUT_H * f); ctx.stroke();
      });
      ctx.restore();
    }
    // 切れた麺（右へ少しずつ離れていく）。1 回の「トン」で、細い麺が数本できる
    var per = Math.max(1, Math.round(sw / 24));
    var nw = sw / per;
    var nlw = nw < 14 ? 5 : 7;
    for (var i = 0; i < n * per; i++) {
      var chop = Math.floor(i / per);
      var x = xL + CUT_W - (i + 1) * nw + 22 + (n - chop) * gap;
      var fresh = (chop === n - 1) ? Math.max(0, 1 - scene.cut.chopT / 0.18) : 0;
      roundRect(x + 1, yT + fresh * -10, Math.max(3, nw - 2), CUT_H, Math.min(8, nw / 2.4));
      inkShape(COL.white, nlw);
    }
    // 包丁
    var kx = cutX(n, K);
    var t = scene.cut.chopT;
    var lift = t < 0.06 ? 150 * (1 - t / 0.06) : (t < 0.12 ? 0 : 150 * ease(Math.min(1, (t - 0.12) / 0.22)));
    if (n >= K) lift = 150;
    var bx = kx - 6 - gap, by = BOARD_Y + 2 - lift;
    ctx.save();
    ctx.translate(bx, by);
    ctx.beginPath();   // 柄
    roundRect(-176, -214, 70, 150, 16); inkShape('#B9783F', 10);
    ctx.beginPath();   // 刃
    ctx.moveTo(-190, -150); ctx.lineTo(0, -150); ctx.lineTo(0, -14); ctx.quadraticCurveTo(0, 0, -14, 0);
    ctx.lineTo(-176, 0); ctx.quadraticCurveTo(-190, 0, -190, -14); ctx.closePath();
    inkShape(COL.steel, 11);
    ctx.beginPath(); ctx.moveTo(-170, -24); ctx.lineTo(-22, -24);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }

  function drawBoil() {
    var t = scene.boil.t;
    var cx = LW / 2;
    // かまど
    roundRect(cx - 330, 610, 660, 150, 20); inkShape('#5A4A42', 11);
    // 釜
    ctx.beginPath();
    ctx.moveTo(cx - 290, 372);
    ctx.bezierCurveTo(cx - 290, 560, cx - 180, 640, cx, 640);
    ctx.bezierCurveTo(cx + 180, 640, cx + 290, 560, cx + 290, 372);
    ctx.closePath(); inkShape('#4B4541', 12);
    ctx.beginPath(); ctx.ellipse(cx, 372, 300, 64, 0, 0, Math.PI * 2); inkShape('#6B6460', 12);
    ctx.beginPath(); ctx.ellipse(cx, 376, 262, 46, 0, 0, Math.PI * 2); inkShape('#DDEFF1', 9);
    // 麺が泳ぐ
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, 376, 258, 43, 0, 0, Math.PI * 2); ctx.clip();
    var show = Math.min(1, t / 0.7);
    for (var i = 0; i < 5; i++) {
      var yy = 352 + i * 12, ph = t * 3 + i * 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - 230, yy);
      for (var x = -230; x <= 230 * (2 * show - 1); x += 20) ctx.lineTo(cx + x, yy + Math.sin(x * 0.03 + ph) * 9);
      ctx.strokeStyle = INK; ctx.lineWidth = 19; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.strokeStyle = COL.white; ctx.lineWidth = 11; ctx.stroke();
    }
    ctx.restore();
    // あわ
    for (i = 0; i < 9; i++) {
      var bp = (t * 1.3 + i * 0.37) % 1;
      var bx = cx - 220 + ((i * 97) % 440), by = 384 - bp * 30;
      if (bp > 0.85) continue;
      ctx.beginPath(); ctx.arc(bx, by, 4 + bp * 8, 0, Math.PI * 2);
      inkShape('#FFFFFF', 4);
    }
    // 湯気がもくもく立ちのぼる
    for (i = 0; i < 9; i++) {
      var k = ((t * 0.55 + i * 0.111) % 1);
      if (t * 0.55 + i * 0.111 < 0.25) continue;
      var sx = cx + Math.sin(i * 2.4) * (70 + k * 150) + Math.sin(t * 2 + i) * 14;
      var sy = 330 - k * 300;
      var rr = (22 + k * 62) * (k > 0.8 ? (1 - k) / 0.2 : 1);
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.1, rr), 0, Math.PI * 2);
      inkShape('#FFFDF8', 8);
    }
    // 最後は湯気が画面いっぱいに広がって、できあがりへ
    if (t > 1.9) {
      ctx.beginPath(); ctx.arc(cx, 380, Math.pow((t - 1.9) / 0.7, 2) * 1000, 0, Math.PI * 2);
      inkShape('#FFFDF8', 12);
    }
    if (t < 2.1) drawWordAt('ゆであがるよ〜', cx, 118, 70, 1);
  }

  function drawWordAt(text, x, y, size, alpha, rot, color) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.globalAlpha = alpha;
    ctx.font = size + 'px "Dela Gothic One", "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = size * 0.26;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color || COL.white; ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drawParticles() {
    // 粉けむり: 先に墨のふちをまとめて描き、あとから白を重ねる（重なった煙がひとつの雲に見える）
    [4, 0].forEach(function (edge) {
      scene.parts.forEach(function (p) {
        if (p.kind !== 'puff') return;
        var k = p.t / p.life;
        var grow = k < 0.6 ? 0.5 + k * 1.5 : 1.4 * (1 - (k - 0.6) / 0.4);
        if (p.r * grow < 1) return;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * grow + edge, 0, Math.PI * 2);
        ctx.fillStyle = edge ? INK : '#FFFFFF'; ctx.fill();
      });
    });
    scene.parts.forEach(function (p) {
      var k = p.t / p.life;
      if (p.kind === 'puff') {
        return;
      } else {
        var sc = k < 0.7 ? 1 : (1 - k) / 0.3;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * 5);
        ctx.beginPath();
        for (var i = 0; i < 8; i++) {
          var r = (i % 2 ? p.r * 0.42 : p.r) * sc;
          var a = i / 8 * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); inkShape(COL.yolk, 5);
        ctx.restore();
      }
    });
    ctx.globalAlpha = 1;
    scene.words.forEach(function (w) {
      var k = w.t / WORD_LIFE;
      var pop = k < 0.15 ? 0.6 + 0.5 * (k / 0.15) : (k < 0.8 ? 1.1 - 0.1 * Math.min(1, (k - 0.15) / 0.2) : Math.max(0.05, (1 - k) / 0.2));
      drawWordAt(w.text, w.x, w.y - k * 46, 46 * pop, 1, w.rot, w.color);
    });
  }

  /** タイトルなどで、生地のかたまりが板の上をぴょんぴょん跳ねていく（元の待機アニメーション） */
  function drawHopper() {
    var h = scene.hop;
    var s = Math.abs(Math.sin(h.phase * Math.PI));
    var land = Math.max(0, 1 - s * 5);
    var d = {
      x: h.x, baseY: BOARD_Y + 4 - s * 96, w: 150 * (1 + land * 0.22), h: 118 * (1 - land * 0.24 + s * 0.08),
      ex: 0.72, ey: 0.78, off: scene.dough.off.map(function () { return 0; }), squash: 0
    };
    ctx.fillStyle = COL.woodDark;
    ctx.beginPath(); ctx.ellipse(h.x, BOARD_Y + 10, 70 - s * 26, 10 - s * 4, 0, 0, Math.PI * 2); ctx.fill();
    var pts = doughPoints(d);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], d.baseY);
    for (var i = 0; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    ctx.lineTo(pts[N][0], d.baseY);
    ctx.closePath(); inkShape(COL.dough, 10);
    // つや
    ctx.beginPath();
    ctx.moveTo(h.x - d.w * 0.3, d.baseY - d.h * 0.5);
    ctx.quadraticCurveTo(h.x - d.w * 0.26, d.baseY - d.h * 0.78, h.x - d.w * 0.06, d.baseY - d.h * 0.84);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
  }

  var view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };

  function resize() {
    var r = stage.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    view.w = w; view.h = h;
    // 板が画面の下端に届くよう、下そろえで全体が入る倍率にする
    view.scale = Math.min(w / LW, h / LH);
    view.ox = (w - LW * view.scale) / 2;
    view.oy = h - LH * view.scale;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COL.shu;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    drawBackdrop();
    var s = state.screen;
    if (s === 'title' || s === 'setup') {
      drawHopper();
    } else if (s === 'intro' || (s === 'play' && run && run.phase === 'knead')) {
      drawLeg(0); drawLeg(1);
      drawDough(scene.dough);
    } else if (s === 'play' && run && run.phase === 'roll') {
      drawDough(scene.dough);
      drawPin(scene.dough);
    } else if (s === 'play' && run && run.phase === 'cut') {
      drawCut();
    } else if (s === 'boil') {
      drawBoil();
    }
    drawParticles();
  }

  // ---------------------------------------------------------------------------
  // 毎フレーム
  // ---------------------------------------------------------------------------
  var lastFrame = performance.now();
  var chipTimer = 0;

  var frameErrors = 0;
  function frame(now) {
    // 先に次のフレームを予約しておく（描画のどこかで例外が出ても、画面が固まったままにならない）
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    try {
      updateScene(dt);
      draw();
      updateHud(now, dt);
    } catch (e) {
      if (frameErrors++ < 3) console.error(e);
    }
  }

  function meterPct(foot) {
    var thr = detector.effectiveThreshold(foot);
    var ratio = detector.level(foot) / thr;
    if (isInsole()) {
      // INSOLE: 圧力でふみを数えられている間は、圧力の立ち上がりを見せる（線をこえると 1 ふみ）
      var now = performance.now();
      if (press.isLive(foot, now)) ratio = press.isActive(foot, now) ? press.meter(foot) : Math.max(ratio, press.meter(foot));
    }
    return Math.min(100, ratio * 62);   // しきい値の線は 62% の高さ
  }

  // ---------------------------------------------------------------------------
  // INSOLE の足うらマップ（HUD と ためしふみ）: 6 つのセンサの丸を、圧力に合わせてふくらませる
  // ---------------------------------------------------------------------------
  var soleMaps = { hud: [null, null], tryout: [null, null] };

  function buildSoleMap(host, foot) {
    host.innerHTML = UdonArt.insoleMap(foot === 0 ? 'L' : 'R', { layout: UdonInsolePressure.LAYOUT });
    return {
      pads: Array.prototype.slice.call(host.querySelectorAll('.udon-pad')),
      cop: host.querySelector('.udon-cop'), shown: -1
    };
  }

  function paintSoleMap(map, foot, now) {
    if (!map) return;
    var live = press.isLive(foot, now);
    var pads = press.pads(foot);
    for (var i = 0; i < map.pads.length; i++) {
      var v = live ? pads[i] : 0;
      map.pads[i].setAttribute('r', (5 + 9 * v).toFixed(1));
      map.pads[i].setAttribute('fill-opacity', (v > 0.02 ? 0.25 + 0.75 * v : 0).toFixed(2));
    }
    var c = press.cop(foot);
    var on = live && c.valid;
    if (on) {
      map.cop.setAttribute('cx', (10 + c.x * 100).toFixed(1));
      map.cop.setAttribute('cy', (8 + c.y * 218).toFixed(1));
    }
    if (map.shown !== (on ? 1 : 0)) { map.shown = on ? 1 : 0; map.cop.setAttribute('opacity', on ? 0.85 : 0); }
  }

  function updateHud(now, dt) {
    var live = liveFeet();
    chipTimer -= dt;
    if (chipTimer <= 0) {
      chipTimer = 0.3;
      var slots = (isInsole() && window.UdonInsole) ? window.UdonInsole.status() : null;
      for (var i = 0; i < 2; i++) {
        var chip = $('chipCore' + i);
        // CORE は 01 = 左・02 = 右。INSOLE は左右を自分で知っているので、スイッチ（01・02）ごとに「どちらの足か」を出す
        var on = (slots ? (slots[i].state === 'on' && live[slots[i].foot]) : live[i]) && state.mode === 'core';
        chip.classList.toggle('is-on', on);
        var text = on ? 'つながりました' : '未接続';
        if (slots) {
          if (on && slots[i].side !== null) text = 'つながりました（' + (slots[i].foot === 0 ? '左足' : '右足') + '）';
          else if (slots[i].state === 'connecting') text = '接続中…';
          else if (slots[i].state === 'retry') text = '再接続中…';
        }
        chip.querySelector('b').textContent = text;
        ['hudFoot', 'tryMeter', 'tryMap'].forEach(function (p) { $(p + i).classList.toggle('is-off', !live[i]); });
      }
      var any = (live[0] || live[1]) && state.mode === 'core';
      document.body.dataset.cores = state.mode === 'core' ? ((live[0] ? 1 : 0) + (live[1] ? 1 : 0)) : 'demo';
      $('btnStart').disabled = !any;
      var guide;
      if (isInsole()) {
        var unit = '枚';
        if (window.UdonInsole && !window.UdonInsole.available) guide = 'ORPHE INSOLE の SDK を読み込めませんでした。インターネット接続をたしかめて、ページを開き直してください';
        else if (!any) guide = '画面上の <b>01</b>・<b>02</b> のスイッチで ORPHE INSOLE をつないでください（1 ' + unit + 'でも遊べます）';
        else if (live[0] && live[1]) guide = '2 ' + unit + 'つながりました。<b>はじめる</b> を押してください';
        else guide = '1 ' + unit + 'つながりました。このまま <b>はじめる</b> か、もう 1 ' + unit + 'つなぐと左右バランスも見られます';
      } else {
        guide = any
          ? ((live[0] && live[1]) ? '2 台つながりました。<b>はじめる</b> を押してください' : '1 台つながりました。このまま <b>はじめる</b> か、もう 1 台つなぐと左右バランスも見られます')
          : '画面上の <b>01</b>・<b>02</b> のスイッチで ORPHE CORE をつないでください（1 台でも遊べます）';
      }
      if (state.guide !== guide) { state.guide = guide; $('titleGuide').innerHTML = guide; }
      if (run && state.screen === 'play') { run.feetLive[0] = run.feetLive[0] || live[0]; run.feetLive[1] = run.feetLive[1] || live[1]; }
    }

    if (state.screen === 'setup') {
      for (var f = 0; f < 2; f++) {
        $('tryMeter' + f).querySelector('.u-meter-fill').style.height = meterPct(f) + '%';
        if (isInsole()) paintSoleMap(soleMaps.tryout[f], f, now);
      }
      if (state.calib) {
        var left = Math.max(0, state.calib.until - now);
        $('tryText').textContent = 'いつもの強さで ふみふみ… あと ' + Math.ceil(left / 1000) + ' 秒';
        if (left <= 0) endCalibration();
      }
    }

    if (state.screen === 'play' && run) {
      for (var g = 0; g < 2; g++) {
        $('hudFoot' + g).querySelector('.u-foot-meter b').style.height = meterPct(g) + '%';
        if (isInsole()) paintSoleMap(soleMaps.hud[g], g, now);
      }
      var p = Math.min(1, run.points / run.target);
      $('gaugeFill').style.width = (p * 100) + '%';
      $('gaugePct').textContent = Math.floor(p * 100) + '%';
      $('hudSteps').textContent = run.count;
      // コンボ: おなじリズムが続くほどバーがのび、区切りをこえると倍率が上がる
      var combo = $('combo');
      if (combo.dataset.level !== String(run.level)) {
        combo.dataset.level = run.level;
        $('comboMult').textContent = '×' + (run.level ? COMBO_LEVELS[run.level - 1].mult : 1);
      }
      $('comboFill').style.width = Math.min(100, run.streak / UdonCombo.FULL * 100) + '%';
      var clock = run.count === 0 ? 0 : (state.paused ? run.pauseStart : now) - run.clockStart - run.pausedMs;
      $('hudTime').textContent = Math.floor(clock / 1000) + 's';

      updateAssist(now);
    }
  }

  // ---------------------------------------------------------------------------
  // 感度のアシスト: 足は動いているのに「ふみ」にならないとき、感度を上げる
  // （足踏み中は手がふさがっているので、数秒待てば自動で上がる。「このまま」で断れる）
  // ---------------------------------------------------------------------------
  var ASSIST_AFTER_MS = 8000, ASSIST_COUNT_MS = 6000;

  function updateAssist(now) {
    if (state.paused || run.done || run.assistOff) return;
    var el = $('assist');
    if (el.hidden) {
      if (now - run.lastStepAt < ASSIST_AFTER_MS) return;
      if (detector.getThreshold() <= UdonStepDetector.LEVELS[4].threshold + 0.001) return;
      // じっとしているだけ（ひとやすみ中など）なら何もしない。
      // INSOLE では、足うらを押しているのに しきい値に届かない山が続いているときも声をかける
      var pressed = isInsole() && (press.missedCount(0, now) + press.missedCount(1, now)) >= 3;
      if (!idleResult().ok && !pressed) return;
      run.assistUntil = now + ASSIST_COUNT_MS;
      el.hidden = false;
    }
    var left = Math.ceil((run.assistUntil - now) / 1000);
    $('assistCount').textContent = left > 0 ? left : '';
    if (now >= run.assistUntil) raiseSensitivity();
  }

  function raiseSensitivity() {
    var cur = detector.getThreshold();
    var min = UdonStepDetector.LEVELS[4].threshold;
    var r = run ? idleResult() : { ok: false };
    var label;
    if (r.ok && r.threshold < cur * 0.9) {
      // 届かなかった動きの大きさから、その人が数えられるしきい値にする
      var thr = Math.max(min, r.threshold);
      store.settings.sens = { mode: 'auto', level: UdonStepDetector.nearestLevel(thr).id, threshold: thr };
      label = UdonStepDetector.nearestLevel(thr).label + '相当';
    } else {
      var next = UdonStepDetector.levelById(Math.min(5, UdonStepDetector.nearestLevel(cur).id + 1));
      store.settings.sens = { mode: 'level', level: next.id, threshold: next.threshold };
      label = next.label;
    }
    applySensitivity();
    saveStore();
    hideAssist();
    press.clearMissed();
    recMark('sensitivity:' + detector.getThreshold() + 'G level' + press.getLevel());
    if (run) { run.lastStepAt = performance.now(); run.idle = newIdle(); }
    toast('感度を「' + label + '」に上げました');
  }

  // ---------------------------------------------------------------------------
  // 操作
  // ---------------------------------------------------------------------------
  function on(id, handler) { $(id).addEventListener('click', function (e) { UdonAudio.unlock(); UdonAudio.tap(); handler(e); }); }

  // ---------------------------------------------------------------------------
  // つかうセンサーの切り替え（ORPHE CORE / ORPHE INSOLE）
  // ---------------------------------------------------------------------------
  var DEVICE_TEXT = {
    core: { name: 'CORE', kicker: 'ORPHE CORE で足踏み', dock: 'CORE をつなぐ', feet: ['01', '02'] },
    insole: { name: 'INSOLE', kicker: 'ORPHE INSOLE で足踏み', dock: 'INSOLE をつなぐ', feet: ['左', '右'] }
  };

  function setDevice(device, save) {
    device = device === 'insole' ? 'insole' : 'core';
    if (state.device !== device) {
      detector.reset(); press.reset(); fusion.reset();
      if (state.calib) cancelCalibration();   // 別のセンサーのデータで、じどう調整を終わらせない
    }
    state.device = device;
    if (save) { store.settings.device = device; saveStore(); }
    document.body.dataset.device = device;
    stage.dataset.device = device;
    var t = DEVICE_TEXT[device];
    var buttons = $('deviceSwitch').querySelectorAll('[data-device]');
    for (var i = 0; i < buttons.length; i++) {
      var sel = buttons[i].dataset.device === device;
      buttons[i].classList.toggle('is-on', sel);
      buttons[i].setAttribute('aria-checked', sel);
    }
    $('dockLabel').textContent = t.dock;
    $('titleKicker').textContent = t.kicker;
    $('btnDemoLabel').textContent = t.name + ' なしでおためし';
    for (var f = 0; f < 2; f++) {
      $('chipCore' + f).querySelector('span').textContent = t.name + ' 0' + (f + 1);
      $('hudFoot' + f).querySelector('span').textContent = t.feet[f];
      $('tryMeter' + f).querySelector('span').textContent = t.feet[f];
      var icon = $('hudFoot' + f).querySelector('.u-foot-icon');
      if (device === 'insole') {
        soleMaps.hud[f] = buildSoleMap(icon, f);
        soleMaps.tryout[f] = buildSoleMap($('tryMap' + f), f);
      } else {
        icon.innerHTML = UdonArt.footprint(f === 0 ? 'L' : 'R');
        $('tryMap' + f).innerHTML = '';
        soleMaps.hud[f] = soleMaps.tryout[f] = null;
      }
    }
    if (state.screen === 'setup') $('tryText').textContent = tryText();
  }

  $('deviceSwitch').addEventListener('click', function (e) {
    var b = e.target.closest('[data-device]');
    if (!b || b.dataset.device === state.device) return;
    UdonAudio.unlock(); UdonAudio.tap();
    if (state.screen !== 'title' && state.screen !== 'setup') {
      toast('センサーの切り替えは、タイトルか したく の画面でどうぞ');
      return;
    }
    setDevice(b.dataset.device, true);
    toast(b.dataset.device === 'insole'
      ? 'ORPHE INSOLE で遊びます。01・02 のスイッチでつないでください'
      : 'ORPHE CORE で遊びます。01・02 のスイッチでつないでください');
  });

  on('btnStart', function () { setMode('core'); goSetup(); });
  on('btnDemo', function () { setMode('demo'); goSetup(); toast('おためしモード: F・J キー（または画面の足ボタン）でふみふみ'); });
  on('btnSetupBack', function () { setMode('core'); goTitle(); });
  on('btnGo', goIntro);
  on('btnCalibrate', startCalibration);
  on('btnPause', function () { setPaused(true, true); });
  on('btnResume', function () { setPaused(false); });
  on('btnQuit', function () {
    $('pausedLayer').hidden = true;
    state.paused = false;
    if (run && run.count >= UdonHealth.MIN_STEPS) beginBoil();
    else goTitle();
  });
  on('btnAssist', raiseSensitivity);
  on('btnAssistKeep', function () { if (run) run.assistOff = true; hideAssist(); });
  on('btnPrint', function () { window.print(); });
  on('btnRetry', goIntro);
  on('btnResultSetup', goSetup);
  on('btnZukan', function () { openSheet('zukan'); });
  on('btnHistory', function () { openSheet('history'); });
  on('btnHistory2', function () { openSheet('history'); });
  on('btnSheetClose', closeSheet);
  on('btnCsv', downloadCsv);
  on('btnRawCsv', function () { if (state.result && state.result.raw) { state.rawFile = state.result.raw; saveRawFile(); } });
  on('btnRecord', function () { setRecord(!store.settings.record); });

  $('sheet').addEventListener('click', function (e) {
    if (e.target === $('sheet')) closeSheet();
    var clear = e.target.closest && e.target.closest('#btnClearHistory');
    if (clear && window.confirm('この端末のきろくと図鑑を、すべて消します。よろしいですか？')) {
      store.history = [];
      store.collection = {};
      saveStore();
      refreshZukanCount();
      openSheet('history');
      toast('きろくを消しました');
    }
  });

  $('finishDish').parentNode.addEventListener('click', function () { if (state.screen === 'finish') goResult(); });

  $('courseList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-course]');
    if (!b) return;
    UdonAudio.unlock(); UdonAudio.tap();
    store.settings.course = b.dataset.course;
    saveStore();
    renderSetup();
  });

  $('levelList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-level]');
    if (!b) return;
    UdonAudio.unlock(); UdonAudio.tap();
    store.settings.sens = { mode: 'level', level: Number(b.dataset.level), threshold: 0 };
    applySensitivity();
    saveStore();
    renderSetup();
    $('tryText').textContent = tryText();
  });

  stage.querySelector('.u-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) { UdonAudio.tap(); selectTab(b.dataset.tab); }
  });

  // おためしモード: したく画面ではメーターをタップしてためしふみ
  ['tryMeter0', 'tryMeter1'].forEach(function (id, foot) {
    $(id).addEventListener('pointerdown', function (e) { UdonAudio.unlock(); demoStomp(foot, e.shiftKey); });
  });

  // おためしモードの足ボタン（タップ）とキーボード
  $('pads').addEventListener('pointerdown', function (e) {
    var b = e.target.closest('[data-foot]');
    if (!b) return;
    e.preventDefault();
    UdonAudio.unlock();
    demoStomp(Number(b.dataset.foot), e.shiftKey);
  });

  window.addEventListener('keydown', function (e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (!$('sheet').hidden) closeSheet();
      else if (state.screen === 'play' && run && !run.done) setPaused(!state.paused, true);
      return;
    }
    if (state.mode !== 'demo') return;
    var k = e.key.toLowerCase();
    var foot = (k === 'f' || k === 'arrowleft') ? 0 : ((k === 'j' || k === 'arrowright') ? 1 : -1);
    if (k === ' ') { foot = demo.next; demo.next = 1 - demo.next; }
    if (foot < 0) return;
    if (/^(input|select|textarea|button)$/i.test((e.target && e.target.tagName) || '') && k === ' ') return;
    e.preventDefault();
    UdonAudio.unlock();
    demoStomp(foot, e.shiftKey);
  });

  $('btnSound').addEventListener('click', function () {
    UdonAudio.unlock();
    store.settings.sound = !store.settings.sound;
    saveStore();
    applySound();
  });

  function applySound() {
    UdonAudio.setEnabled(store.settings.sound);
    $('btnSound').setAttribute('aria-pressed', store.settings.sound);
    $('btnSound').innerHTML = '<i class="bi ' + (store.settings.sound ? 'bi-volume-up-fill' : 'bi-volume-mute-fill') + '"></i>';
  }

  $('btnFullscreen').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.screen === 'play' && run && !run.done && run.count > 0) setPaused(true);
    if (!document.hidden && (state.screen === 'intro' || state.screen === 'play')) keepAwake(true);
  });

  // ---------------------------------------------------------------------------
  // 起動
  // ---------------------------------------------------------------------------
  function init() {
    $('noren').innerHTML = UdonArt.noren(['う', 'ど', 'ん', 'ふ', 'み', 'ふ', 'み'], { height: 200 });
    legImg[0] = UdonArt.toImage(UdonArt.leg({ core: COL.led[0], width: 465 }));
    legImg[1] = UdonArt.toImage(UdonArt.leg({ core: COL.led[1], width: 465 }));
    legImgBare[0] = legImgBare[1] = UdonArt.toImage(UdonArt.leg({ width: 465 }));
    setDevice(store.settings.device, false);
    renderRecord();
    resetScene();
    applySound();
    refreshZukanCount();
    showScreen('title');
    resize();
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    requestAnimationFrame(frame);
    debugBoot();
  }

  /**
   * 見た目の確認用（開発者向け）。URL に付けると途中の画面から始められる。
   *   ?screen=setup|intro|play|result|finish|zukan|history  &demo=1  &auto=1（自動でふむ）
   *   &p=0.7（play の進み具合） &course=komori &udon=tsukimi &feet=1 &style=gentle|ragged|rest
   *   &seed（図鑑ときろくにダミーデータ） &slow（演出を省略しない） &hold（できあがり画面で止める）
   *   &device=insole（ORPHE INSOLE の見た目で。保存はしない） &record（生データのきろくを ON に。保存はしない）
   *   &still / &notrans（スクリーンショット用にアニメーション／トランジションを止める）
   */
  function debugBoot() {
    var q = new URLSearchParams(location.search);
    if (q.has('still')) stage.classList.add('u-still');
    if (q.has('notrans')) stage.classList.add('u-notrans');
    if (q.has('device')) setDevice(q.get('device'), false);
    if (q.has('record')) { store.settings.record = true; renderRecord(); }
    if (!q.has('screen') && !q.has('demo') && !q.has('auto')) return;
    state.debug = { fast: (q.has('fast') || q.has('screen')) && !q.has('slow'), udon: q.get('udon'), hold: q.has('hold') };
    if (courseById(q.get('course'))) store.settings.course = q.get('course');
    setMode('demo');
    var screen = q.get('screen') || 'setup';
    var feet = q.get('feet') === '1' ? 1 : 2;
    var fakeLog = function (count, style) {
      var steps = [], t = 0, st;
      for (var i = 0; i < count; i++) {
        var jitter = style === 'ragged' ? 0.5 : 0.1;
        var peak = style === 'gentle' ? 0.24 : 1.3;
        if (i > 0) t += (style === 'gentle' ? 880 : 540) * (1 + i / count * 0.12) * (1 + (Math.random() * 2 - 1) * jitter);
        if (style === 'rest' && i === Math.floor(count / 2)) t += 7000;
        var foot = feet === 2 ? i % 2 : 0;
        st = { foot: foot, t: t, peak: peak * (foot ? 0.86 : 1) * (0.75 + Math.random() * 0.5) };
        steps.push({ t: t, foot: foot, ref: st });
      }
      return steps;
    };
    if (screen === 'setup') { goSetup(); return; }
    if (screen === 'zukan' || screen === 'history') {
      if (q.has('seed')) seedStore();
      refreshZukanCount();
      openSheet(screen);
      return;
    }
    if (screen === 'intro') { goIntro(); state.debug.fast = false; return; }
    startPlay();
    if (screen === 'play') {
      var p = Math.max(0, Math.min(0.99, parseFloat(q.get('p') || '0.3')));
      for (var i = 0; i < 400 && run.points < run.target * p; i++) {
        var foot = feet === 2 ? i % 2 : 0;
        registerStep({ foot: foot, t: performance.now(), peak: 1 + Math.random() });
        run.clockStart -= 520;
      }
      scene.words = [];
      if (q.has('auto')) autoStep(feet);
      return;
    }
    // result / finish: 合成ログで一気に最後まで
    if (q.has('seed')) seedStore();
    run.steps = fakeLog(run.target, q.get('style') || '');
    run.count = run.target;
    run.points = run.target;
    run.maxCombo = q.get('style') === 'ragged' ? 2 : 17;
    run.feetUsed = [true, feet === 2];
    run.feetLive = [true, feet === 2];
    if (isInsole()) {
      // あしうらタブの見た目確認用のダミー集計（左はかかと寄り、右は全体）
      [[1, 3, 0, 9, 30, 57], [9, 14, 6, 15, 24, 32]].forEach(function (imp, f) {
        if (f === 1 && feet !== 2) return;
        press.feet[f].stats = { ms: 60000, loadedMs: 33000, impulse: imp, steps: 30, relSum: 29 };
      });
    }
    if (q.get('style') === 'gentle') { store.settings.sens = { mode: 'level', level: 4, threshold: 0.18 }; applySensitivity(); }
    run.done = true;
    finishRun();
    if (screen === 'result') goResult();
  }

  function autoStep(feet) {
    var foot = 0;
    (function next() {
      if (!run || run.done) return;
      if (!state.paused) demoStomp(feet === 2 ? foot : 0, false);
      foot = 1 - foot;
      setTimeout(next, 430 + Math.random() * 60);
    })();
  }

  /** 図鑑ときろくの見た目確認用のダミーデータ */
  function seedStore() {
    ['kake', 'kitsune', 'tsukimi', 'curry', 'tanuki', 'ume', 'wakame'].forEach(function (id, i) {
      store.collection[id] = { count: 1 + (i % 3), best: 60 + i * 4 };
    });
    store.history = [];
    for (var i = 0; i < 14; i++) {
      var d = new Date(Date.now() - (13 - i) * 86400000 * 0.7);
      store.history.push({
        at: d.toISOString(), udon: ['kake', 'kitsune', 'tsukimi', 'curry', 'tanuki', 'ume', 'wakame'][i % 7], course: 'nami', feet: 2,
        total: Math.round(52 + i * 2.4 + Math.sin(i) * 6), rank: 'ichininmae', steps: 60, activeSec: 40 + i, cadence: 84 + i,
        axes: {}
      });
    }
  }

  window.UdonGame = {
    pushAcc: pushAcc,
    pushGyro: pushGyro,
    pushInsoleAcc: pushInsoleAcc,
    pushInsoleGyro: pushInsoleGyro,
    pushPress: pushPress,
    /** insole-connect.js から: 接続・切断・左右の割り当て直しの通知 */
    insoleEvent: function (foot, type) {
      if (!isInsole()) return;
      recMark('insole:' + type + ':' + (foot === 0 ? 'L' : 'R'));
      if (type === 'remap') {
        // どちらの足のデータかが変わった: まざらないよう、両足とも作り直す
        detector.reset();
        press.reset();
        fusion.reset();
      } else if (type === 'error') {
        toast('ORPHE INSOLE につなげませんでした。もう一度スイッチを入れてください');
      } else if (type === 'disconnect') {
        detector.reset(foot);
        if (state.mode === 'core' && state.screen === 'play' && run && !run.done && run.count > 0 && !liveFeet()[1 - foot]) {
          setPaused(true);
          toast('INSOLE の接続が切れました。つながり直したら「つづける」を押してください');
        }
      }
    },
    press: press,
    /** scripts.js から: 接続・切断の通知（表示の更新は届いているデータを見て行うので、ここでは切断だけ扱う） */
    coreEvent: function (foot, type) {
      if (isInsole()) return;
      if (type === 'disconnect') recMark('core:disconnect:' + (foot === 0 ? 'L' : 'R'));
      if (type === 'disconnect') {
        detector.reset(foot);
        if (state.screen === 'play' && run && !run.done && run.count > 0 && !liveFeet()[1 - foot]) {
          setPaused(true);
          toast('CORE の接続が切れました。つなぎ直してから「つづける」を押してください');
        }
      }
    },
    detector: detector,
    state: state
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
