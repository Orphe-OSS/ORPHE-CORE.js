/**
 * 生データのきろく（UdonRawRecorder）
 *
 * ふみふみ中にセンサーから届いた値を、1 サンプル 1 行でそのまま残します（CSV）。
 * あとから「なぜ数えられなかったか」「しきい値は合っているか」を調べられるように、
 * センサーの生値（加速度・ジャイロ・INSOLE の 6ch 圧力）のとなりに、そのときゲームが見ていた値
 * （動きの包絡線としきい値、圧力の押しぐあいとしきい値）と、ふみを数えた・見送ったという出来事を並べます。
 *
 * 列:
 *   t_ms         きろく開始からの時間 [ms]（ブラウザが受け取った時刻。BLE の 1 パケットぶんは同じ値になる）
 *   screen       intro（カウントダウン）| play | pause | boil（終わりの 1 ふみと同じパケットで届いた残り）
 *   foot         L | R
 *   ax_g ay_g az_g       加速度 [G]
 *   gx_dps gy_dps gz_dps ジャイロ [deg/s]
 *   p1 … p6      INSOLE の圧力の生値（公式のセンサ番号順。CORE では空）
 *   imu_env_g    動きの大きさ（重力を引いた包絡線）[G]      imu_thr_g  いま効いているしきい値 [G]
 *   press_sum    6ch の「床からの上がり幅」の合計           press_floor 無負荷とみなしている合計値
 *   press_thr    1 ふみに必要な立ち上がり                   press_load  画面の足の押しぐあい 0〜1
 *   serial pkt sensor_ms  SDK が付けたパケット連番・パケット内の順番・センサー側の時刻（欠損を調べる用）
 *   event        step:press / step:imu（数えたふみ）、detect:…（ふみふみ中以外で見つけた）、
 *                imu:ignored（圧力で数えているので見送った加速度のふみ）、press:merged（加速度が先に数えた着地）、
 *                または行だけの目印（start / phase:roll / pause / resume / end:finish など）
 *   count mult   ふみを数えた行だけ: その時点のふみ数と、コンボの倍率
 *
 * ファイルの先頭には「# 名前: 値」の行で、つかったセンサー・感度・コースなどを書きます
 * （pandas なら read_csv(..., comment='#') で読み飛ばせます）。純ロジックなので Node でテストできます。
 */
(function (root) {
  'use strict';

  var FORMAT = 'udon-fumifumi-raw/1';
  var COLUMNS = [
    't_ms', 'screen', 'foot', 'ax_g', 'ay_g', 'az_g', 'gx_dps', 'gy_dps', 'gz_dps',
    'p1', 'p2', 'p3', 'p4', 'p5', 'p6',
    'imu_env_g', 'imu_thr_g', 'press_sum', 'press_floor', 'press_thr', 'press_load',
    'serial', 'pkt', 'sensor_ms', 'event', 'count', 'mult'
  ];
  // 200Hz × 2 足で 1 秒に 400 行。60 万行でおよそ 25 分ぶん（CSV で 80MB ほど）
  var DEFAULT_MAX_ROWS = 600000;

  function num(v, digits) { return (typeof v === 'number' && isFinite(v)) ? v.toFixed(digits) : ''; }
  function int(v) { return (typeof v === 'number' && isFinite(v)) ? String(Math.round(v)) : ''; }
  /** CSV をこわす文字（改行・カンマ・引用符）を落とす */
  function clean(text) { return String(text === null || text === undefined ? '' : text).replace(/[\r\n,"]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  function UdonRawRecorder(options) {
    options = options || {};
    this.maxRows = options.maxRows > 0 ? options.maxRows : DEFAULT_MAX_ROWS;
    this.active = false;
    this._reset();
  }

  UdonRawRecorder.FORMAT = FORMAT;
  UdonRawRecorder.COLUMNS = COLUMNS;
  UdonRawRecorder.DEFAULT_MAX_ROWS = DEFAULT_MAX_ROWS;

  UdonRawRecorder.prototype._reset = function () {
    this.rows = [];
    this.meta = {};
    this.t0 = 0;
    this.lastT = 0;
    this.samples = [0, 0];
    this.steps = 0;
    this.truncated = false;
  };

  /**
   * きろくを始める。前のきろくは捨てる。
   * @param {object} meta 先頭に書く情報（名前 → 値）
   * @param {number} t0 基準の時刻 [ms]（performance.now()）
   */
  UdonRawRecorder.prototype.start = function (meta, t0) {
    this._reset();
    this.active = true;
    this.t0 = isFinite(t0) ? t0 : 0;
    this.lastT = this.t0;
    this.meta = { format: FORMAT };
    for (var k in (meta || {})) this.meta[k] = meta[k];
  };

  UdonRawRecorder.prototype._push = function (line) {
    if (this.rows.length >= this.maxRows) { this.truncated = true; return false; }
    this.rows.push(line);
    return true;
  };

  /**
   * センサーの 1 サンプルを 1 行にする。
   * @param {object} s { t, screen, foot, acc:{x,y,z}|null, gyro:{x,y,z}|null, press:[6]|null,
   *                     env, thr, sum, floor, pthr, load, serial, pkt, sensorMs, event, count, mult }
   * @returns {boolean} 書けたら true（きろく中でない・上限に達したときは false）
   */
  UdonRawRecorder.prototype.sample = function (s) {
    if (!this.active || !s) return false;
    var a = s.acc || {}, g = s.gyro || {}, p = s.press || [];
    var foot = s.foot === 1 ? 1 : 0;
    if (isFinite(s.t)) this.lastT = s.t;
    var event = clean(s.event);
    var ok = this._push([
      num(s.t - this.t0, 1), clean(s.screen), foot ? 'R' : 'L',
      num(a.x, 4), num(a.y, 4), num(a.z, 4), num(g.x, 2), num(g.y, 2), num(g.z, 2),
      int(p[0]), int(p[1]), int(p[2]), int(p[3]), int(p[4]), int(p[5]),
      num(s.env, 3), num(s.thr, 3), num(s.sum, 1), num(s.floor, 1), num(s.pthr, 1), num(s.load, 3),
      int(s.serial), int(s.pkt), int(s.sensorMs), event, int(s.count), num(s.mult, 1)
    ].join(','));
    if (ok) {
      this.samples[foot]++;
      if (event.indexOf('step:') >= 0) this.steps++;
    }
    return ok;
  };

  /** センサーの値を持たない、目印だけの行（開始・一時停止・区間の切り替わりなど）。上限に達していても書く */
  UdonRawRecorder.prototype.mark = function (tMs, screen, event) {
    if (!this.active) return false;
    if (isFinite(tMs)) this.lastT = tMs;
    var line = [num(tMs - this.t0, 1), clean(screen), ''];
    for (var i = 3; i < COLUMNS.length; i++) line.push(COLUMNS[i] === 'event' ? clean(event) : '');
    this.rows.push(line.join(','));
    return true;
  };

  /**
   * きろくを終える。
   * @param {number} tMs 終わった時刻 [ms]
   * @param {object} [extra] 先頭に書き足す情報（終わり方・ふみ数など）
   * @returns {{rows:number, samples:number[], steps:number, durationMs:number, truncated:boolean}}
   */
  UdonRawRecorder.prototype.stop = function (tMs, extra) {
    if (!this.active) return this.summary();
    this.active = false;
    if (isFinite(tMs)) this.lastT = tMs;
    for (var k in (extra || {})) this.meta[k] = extra[k];
    var s = this.summary();
    this.meta.rows = s.rows;
    this.meta.samples_left = s.samples[0];
    this.meta.samples_right = s.samples[1];
    this.meta.steps = s.steps;
    this.meta.duration_ms = Math.round(s.durationMs);
    // 実際に届いていた割合の目安（200Hz のはずが 115Hz、のような通信の落ち方が分かる）
    if (s.durationMs > 0) {
      this.meta.rate_left_hz = (s.samples[0] / s.durationMs * 1000).toFixed(1);
      this.meta.rate_right_hz = (s.samples[1] / s.durationMs * 1000).toFixed(1);
    }
    this.meta.truncated = s.truncated ? 'yes (row limit ' + this.maxRows + ')' : 'no';
    return s;
  };

  /** 行を手放す（CSV にしたあと、メモリを空ける） */
  UdonRawRecorder.prototype.clear = function () {
    if (!this.active) this._reset();
  };

  UdonRawRecorder.prototype.summary = function () {
    return {
      rows: this.rows.length, samples: this.samples.slice(), steps: this.steps,
      durationMs: Math.max(0, this.lastT - this.t0), truncated: this.truncated
    };
  };

  UdonRawRecorder.prototype.toCsv = function () {
    var head = [];
    for (var k in this.meta) head.push('# ' + clean(k) + ': ' + clean(this.meta[k]));
    return head.concat([COLUMNS.join(',')], this.rows).join('\n') + '\n';
  };

  /** 保存するときのファイル名。例: fumifumi-raw-20261113-012345-insole.csv */
  UdonRawRecorder.fileName = function (date, device) {
    var pad = function (n) { return ('0' + n).slice(-2); };
    var d = date || new Date();
    return 'fumifumi-raw-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '-' + (device === 'insole' ? 'insole' : 'core') + '.csv';
  };

  /**
   * センサーの 1 サンプルを 1 行に組み立てる。
   *
   * 1 サンプルは、いくつかのコールバックに分かれて届く（CORE: 加速度 → ジャイロ、INSOLE: 加速度 → ジャイロ → 圧力）。
   * 足ごとにためておき、最後の 1 つが届いたところで 1 行にする。その間に起きたこと（ふみを数えた・見送った）は
   * 同じ行に、その間に入った目印（区間の切り替わりなど）はその行のすぐあとに書く。
   *
   *   asm.begin(foot, now)            … サンプルの処理を始める前（前のサンプルの続きが届いていなければ、あるぶんで 1 行にする）
   *   asm.acc(foot, acc) / asm.gyro(foot, gyro) / asm.note(foot, text, count, mult)
   *   asm.flush(foot, values, now)    … そのサンプルの最後のコールバックで（values = INSOLE の圧力、なければ null）
   *   asm.mark(text, now, screen)     … 目印の行
   *   asm.drain(now)                  … きろくを終える前に、ためているぶんを書き出す
   *
   * @param {UdonRawRecorder} recorder
   * @param {function(number, ?ArrayLike<number>): object} read ゲームがそのとき見ていた値を返す関数。
   *   read(foot, values) → { screen, env, thr, sum, floor, pthr, load }。foot = -1 のときは screen だけでよい
   */
  function Assembler(recorder, read) {
    this.rec = recorder;
    this.read = read || function () { return {}; };
    this.reset();
  }

  function newBuf() { return { acc: null, gyro: null, note: '', count: null, mult: null }; }

  Assembler.prototype.reset = function () {
    this.buf = [newBuf(), newBuf()];
    this.busy = false;
    this.queue = [];
  };

  Assembler.prototype.begin = function (foot, nowMs) {
    if (!this.rec.active) return;
    if (this.buf[foot].acc) this._write(foot, null, nowMs);
    this.busy = true;
  };

  Assembler.prototype.acc = function (foot, acc) { if (this.rec.active) this.buf[foot].acc = acc; };
  Assembler.prototype.gyro = function (foot, gyro) { if (this.rec.active) this.buf[foot].gyro = gyro; };

  Assembler.prototype.note = function (foot, text, count, mult) {
    if (!this.rec.active) return;
    var b = this.buf[foot];
    b.note = b.note ? b.note + ' ' + text : text;
    if (count !== undefined) { b.count = count; b.mult = mult; }
  };

  Assembler.prototype.flush = function (foot, values, nowMs) {
    if (this.rec.active) this._write(foot, values || null, nowMs);
  };

  /** ためているぶんがあれば 1 行にする */
  Assembler.prototype._row = function (foot, values, nowMs) {
    var b = this.buf[foot];
    if (!(b.acc || b.gyro || values || b.note)) return;
    var acc = b.acc;
    var g = this.read(foot, values) || {};
    this.rec.sample({
      t: nowMs, screen: g.screen, foot: foot, acc: acc, gyro: b.gyro, press: values,
      env: g.env, thr: g.thr, sum: g.sum, floor: g.floor, pthr: g.pthr, load: g.load,
      serial: acc ? acc.serial_number : null, pkt: acc ? acc.packet_number : null, sensorMs: acc ? acc.timestamp : null,
      event: b.note, count: b.count, mult: b.mult
    });
    this.buf[foot] = newBuf();
  };

  Assembler.prototype._write = function (foot, values, nowMs) {
    this._row(foot, values, nowMs);
    this.busy = false;
    this._marks(nowMs);
  };

  Assembler.prototype._marks = function (nowMs) {
    if (!this.queue.length) return;
    var screen = (this.read(-1, null) || {}).screen;
    for (var i = 0; i < this.queue.length; i++) this.rec.mark(nowMs, screen, this.queue[i]);
    this.queue = [];
  };

  Assembler.prototype.mark = function (text, nowMs, screen) {
    if (!this.rec.active) return;
    // サンプルの処理中に起きたことは、そのサンプルの行のあとに並べる（行の順番と時刻の順番をそろえる）
    if (this.busy) { this.queue.push(text); return; }
    this.rec.mark(nowMs, screen, text);
  };

  Assembler.prototype.drain = function (nowMs) {
    if (!this.rec.active) return;
    this._row(0, null, nowMs);
    this._row(1, null, nowMs);
    this.busy = false;
    this._marks(nowMs);
  };

  UdonRawRecorder.Assembler = Assembler;

  root.UdonRawRecorder = UdonRawRecorder;
  if (typeof module !== 'undefined' && module.exports) module.exports = UdonRawRecorder;
})(typeof globalThis !== 'undefined' ? globalThis : this);
