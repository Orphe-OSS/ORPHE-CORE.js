const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// examples/GAME-UDON の生データのきろく（raw-recorder.js）を検証する。
// あとから解析に使うファイルなので、「列がずれない」「値が欠けたところは空になる」「読み戻すと元の値になる」ことを見る。
const dir = path.join(__dirname, '../examples/GAME-UDON');
const UdonRawRecorder = require(path.join(dir, 'raw-recorder.js'));
const COLS = UdonRawRecorder.COLUMNS;

/** CSV を読み戻す（# で始まる行はメタ情報） */
function parse(csv) {
  const lines = csv.trimEnd().split('\n');
  const meta = {};
  const body = [];
  for (const line of lines) {
    if (line.startsWith('# ')) {
      const i = line.indexOf(': ');
      meta[line.slice(2, i)] = line.slice(i + 2);
    } else {
      body.push(line.split(','));
    }
  }
  const header = body.shift();
  const rows = body.map(cells => Object.fromEntries(header.map((name, i) => [name, cells[i]])));
  return { meta, header, cells: body, rows };
}

const insoleSample = (t, foot, extra = {}) => ({
  t, screen: 'play', foot,
  acc: { x: 0.0123456, y: -0.5, z: 1.00049, timestamp: 1784970808142, serial_number: 13025, packet_number: 2 },
  gyro: { x: 1.234, y: -56.789, z: 0 },
  press: [220, 222, 220, 256, 411, 221],
  env: 0.123456, thr: 0.6, sum: 191.26, floor: 1359.04, pthr: 163.08, load: 0.4567,
  serial: 13025, pkt: 2, sensorMs: 1784970808142,
  ...extra,
});

// 1) INSOLE の 1 サンプルが 1 行になる。列の数と並びは見出しどおり
{
  const rec = new UdonRawRecorder();
  assert.equal(rec.active, false);
  rec.start({ device: 'insole', course: 'nami target 60' }, 1000);
  assert.equal(rec.active, true);
  assert.equal(rec.sample(insoleSample(1012.34, 0)), true);
  assert.equal(rec.sample(insoleSample(1012.34, 1, { event: 'step:press', count: 7, mult: 1.5 })), true);
  const sum = rec.stop(1500, { ended: 'finish' });
  assert.equal(rec.active, false);
  assert.deepEqual(sum, { rows: 2, samples: [1, 1], steps: 1, durationMs: 500, truncated: false });

  const { meta, header, cells, rows } = parse(rec.toCsv());
  assert.deepEqual(header, COLS);
  assert.ok(cells.every(c => c.length === COLS.length), 'every row has exactly one cell per column');
  assert.deepEqual(cells[0], [
    '12.3', 'play', 'L', '0.0123', '-0.5000', '1.0005', '1.23', '-56.79', '0.00',
    '220', '222', '220', '256', '411', '221',
    '0.123', '0.600', '191.3', '1359.0', '163.1', '0.457',
    '13025', '2', '1784970808142', '', '', '',
  ]);
  assert.equal(rows[1].foot, 'R');
  assert.equal(rows[1].event, 'step:press');
  assert.equal(rows[1].count, '7');
  assert.equal(rows[1].mult, '1.5');

  // 先頭のメタ情報: 渡したもの＋集計
  assert.equal(meta.format, 'udon-fumifumi-raw/1');
  assert.equal(meta.device, 'insole');
  assert.equal(meta.course, 'nami target 60');
  assert.equal(meta.ended, 'finish');
  assert.equal(meta.rows, '2');
  assert.equal(meta.samples_left, '1');
  assert.equal(meta.samples_right, '1');
  assert.equal(meta.steps, '1');
  assert.equal(meta.duration_ms, '500');
  assert.equal(meta.rate_left_hz, '2.0');
  assert.equal(meta.truncated, 'no');
  // メタ情報 → 見出し → データ の順
  const lines = rec.toCsv().split('\n');
  const firstData = lines.findIndex(l => !l.startsWith('#'));
  assert.equal(lines[firstData], COLS.join(','));
  assert.ok(lines.slice(0, firstData).every(l => l.startsWith('# ')));
  assert.ok(rec.toCsv().endsWith('\n'));
}

// 2) CORE（圧力なし・ジャイロあり）や、値が欠けたサンプル: 欠けたところは空。NaN や undefined という文字は出さない
{
  const rec = new UdonRawRecorder();
  rec.start({}, 0);
  rec.sample({ t: 5, screen: 'play', foot: 0, acc: { x: 0, y: 0, z: 1 }, gyro: { x: 1, y: 2, z: 3 }, press: null, env: 0.01, thr: 0.6 });
  rec.sample({ t: 10, screen: 'intro', foot: 1, acc: { x: NaN, y: Infinity, z: undefined }, gyro: null, press: [1, 2], env: NaN, thr: null, serial: 'x', mult: NaN });
  rec.sample({ t: 15, foot: 5 });
  rec.stop(20);
  const csv = rec.toCsv();
  assert.doesNotMatch(csv, /NaN|undefined|null|Infinity/);
  const { cells, rows } = parse(csv);
  assert.ok(cells.every(c => c.length === COLS.length));
  assert.equal(rows[0].gx_dps, '1.00');
  assert.equal(rows[0].p1, '');
  assert.equal(rows[0].press_sum, '');
  assert.equal(rows[1].ax_g, '');
  assert.equal(rows[1].ay_g, '');
  assert.equal(rows[1].p1, '1');
  assert.equal(rows[1].p3, '');
  assert.equal(rows[1].serial, '');
  assert.equal(rows[2].foot, 'L', 'an unknown foot falls back to L instead of breaking the row');
  assert.equal(rows[2].screen, '');
}

// 3) 出来事の文字は CSV をこわさない（カンマ・改行・引用符は落とす）。メタ情報も同じ
{
  const rec = new UdonRawRecorder();
  rec.start({ 'user,agent': 'Mozilla/5.0 (Macintosh; "Intel")\nline2', note: null }, 0);
  rec.sample(insoleSample(1, 0, { event: 'imu:ignored, step:press\n"x"', screen: 'pl,ay' }));
  rec.mark(2, 'pause', 'pause:manual, by "user"');
  rec.stop(3);
  const { meta, cells, rows } = parse(rec.toCsv());
  assert.ok(cells.every(c => c.length === COLS.length));
  assert.equal(rows[0].event, 'imu:ignored step:press x');
  assert.equal(rows[0].screen, 'pl ay');
  assert.equal(rows[1].event, 'pause:manual by user');
  assert.equal(meta['user agent'], 'Mozilla/5.0 (Macintosh; Intel ) line2');
  assert.equal(meta.note, '');
  assert.equal(rec.toCsv().split('\n').filter(l => l.startsWith('# ')).length, Object.keys(meta).length, 'one line per meta entry');
}

// 4) 目印の行: センサーの列は空で、時刻・画面・出来事だけ。ふみには数えない
{
  const rec = new UdonRawRecorder();
  rec.start({}, 100);
  assert.equal(rec.mark(100, 'intro', 'start'), true);
  rec.mark(5400, 'play', 'play');
  rec.mark(9000, 'play', 'phase:roll');
  const sum = rec.stop(9500);
  assert.deepEqual(sum.samples, [0, 0]);
  assert.equal(sum.steps, 0);
  assert.equal(sum.durationMs, 9400);
  const { rows } = parse(rec.toCsv());
  assert.deepEqual(rows.map(r => [r.t_ms, r.screen, r.foot, r.ax_g, r.event]), [
    ['0.0', 'intro', '', '', 'start'],
    ['5300.0', 'play', '', '', 'play'],
    ['8900.0', 'play', '', '', 'phase:roll'],
  ]);
}

// 5) 上限に達したら、それ以上センサーの行は書かない（目印は書く）。先頭にそのことを残す
{
  const rec = new UdonRawRecorder({ maxRows: 5 });
  rec.start({}, 0);
  const results = [];
  for (let i = 0; i < 9; i++) results.push(rec.sample(insoleSample(i, i % 2)));
  assert.deepEqual(results, [true, true, true, true, true, false, false, false, false]);
  rec.mark(10, 'play', 'end:finish');
  const sum = rec.stop(10);
  assert.equal(sum.truncated, true);
  assert.equal(sum.rows, 6);
  assert.deepEqual(sum.samples, [3, 2]);
  const { meta, rows } = parse(rec.toCsv());
  assert.match(meta.truncated, /^yes \(row limit 5\)$/);
  assert.equal(rows.at(-1).event, 'end:finish');
  assert.equal(UdonRawRecorder.DEFAULT_MAX_ROWS, 600000);
  assert.equal(new UdonRawRecorder({ maxRows: -1 }).maxRows, 600000);
}

// 6) きろく中でなければ何も残さない。始め直すと前のきろくは消える。clear() でメモリを空ける
{
  const rec = new UdonRawRecorder();
  assert.equal(rec.sample(insoleSample(1, 0)), false);
  assert.equal(rec.mark(1, 'play', 'x'), false);
  assert.equal(rec.summary().rows, 0);
  rec.start({ a: 1 }, 0);
  rec.sample(insoleSample(1, 0));
  rec.stop(2);
  assert.equal(rec.sample(insoleSample(3, 0)), false, 'no rows after stop');
  assert.deepEqual(rec.stop(9), rec.summary(), 'stopping twice changes nothing');
  rec.start({ b: 2 }, 100);
  assert.equal(rec.summary().rows, 0);
  rec.clear();
  assert.equal(rec.active, true, 'clear() does nothing while recording');
  rec.sample(insoleSample(101, 1));
  rec.stop(102);
  const { meta } = parse(rec.toCsv());
  assert.equal(meta.b, '2');
  assert.equal('a' in meta, false);
  rec.clear();
  assert.equal(rec.summary().rows, 0);
}

// 7) 読み戻すと元の値になる（200Hz・2 足・30 秒ぶん）。時刻は 0.1ms、加速度は 0.0001G、圧力は整数で残る
{
  const rec = new UdonRawRecorder();
  rec.start({}, 5000);
  let seed = 9;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const sent = [];
  for (let t = 5000; t < 35000; t += 20) {
    for (let k = 0; k < 4; k++) {
      for (let foot = 0; foot < 2; foot++) {
        const s = insoleSample(t, foot, {
          acc: { x: rand() * 8 - 4, y: rand() * 8 - 4, z: rand() * 8 - 4 },
          press: Array.from({ length: 6 }, () => Math.round(220 + rand() * 1200)),
          serial: (60000 + t / 20) % 65536, pkt: k,
        });
        sent.push(s);
        rec.sample(s);
      }
    }
  }
  const sum = rec.stop(35000);
  assert.equal(sum.rows, 12000);
  const { meta, rows } = parse(rec.toCsv());
  assert.equal(rows.length, 12000);
  assert.equal(meta.rate_left_hz, '200.0');
  assert.equal(meta.rate_right_hz, '200.0');
  rows.forEach((r, i) => {
    const s = sent[i];
    assert.ok(Math.abs(Number(r.t_ms) - (s.t - 5000)) < 0.051);
    assert.ok(Math.abs(Number(r.ax_g) - s.acc.x) < 0.00006 && Math.abs(Number(r.az_g) - s.acc.z) < 0.00006);
    assert.deepEqual([r.p1, r.p2, r.p3, r.p4, r.p5, r.p6].map(Number), s.press);
    assert.equal(Number(r.serial), s.serial);
    assert.equal(Number(r.pkt), s.pkt);
    assert.equal(r.foot, s.foot ? 'R' : 'L');
  });
  // 1 行あたりの大きさ（25 分で 100MB をこえない）
  assert.ok(rec.toCsv().length / rows.length < 170, `${(rec.toCsv().length / rows.length).toFixed(0)} bytes per row`);
}

// 8) ファイル名
{
  const d = new Date(2026, 10, 13, 1, 2, 3);
  assert.equal(UdonRawRecorder.fileName(d, 'insole'), 'fumifumi-raw-20261113-010203-insole.csv');
  assert.equal(UdonRawRecorder.fileName(d, 'core'), 'fumifumi-raw-20261113-010203-core.csv');
  assert.equal(UdonRawRecorder.fileName(d, '../x'), 'fumifumi-raw-20261113-010203-core.csv');
  assert.match(UdonRawRecorder.fileName(), /^fumifumi-raw-\d{8}-\d{6}-core\.csv$/);
}

// 10) 行の組み立て（Assembler）: 1 サンプルは複数のコールバックに分かれて届く。最後の 1 つで 1 行にする
{
  const make = () => {
    const rec = new UdonRawRecorder();
    const reads = [];
    const asm = new UdonRawRecorder.Assembler(rec, (foot, values) => {
      reads.push([foot, values]);
      return foot < 0 ? { screen: 'play' } : { screen: 'play', env: 0.5, thr: 0.6, sum: values ? 300 : undefined, floor: values ? 1360 : undefined };
    });
    rec.start({}, 0);
    return { rec, asm, reads, rows: () => { const copy = new UdonRawRecorder(); copy.rows = rec.rows.slice(); return parse(copy.toCsv()).rows; } };
  };
  const acc = (n) => ({ x: n, y: 0, z: 1, serial_number: 100 + n, packet_number: n % 4, timestamp: 5000 + n });
  const gyro = (n) => ({ x: n * 10, y: 0, z: 0 });
  const press = [220, 222, 220, 256, 411, 221];

  // CORE: 加速度（その処理の中でふみが決まる）→ ジャイロ。ふみは、そのサンプルの行に入る
  {
    const { asm, rows } = make();
    asm.begin(0, 10);
    asm.note(0, 'step:imu', 12, 2);
    asm.acc(0, acc(1));
    assert.equal(rows().length, 0, 'nothing is written until the last callback of the sample');
    asm.gyro(0, gyro(1));
    asm.flush(0, null, 10);
    const r = rows();
    assert.equal(r.length, 1);
    assert.deepEqual([r[0].foot, r[0].ax_g, r[0].gx_dps, r[0].p1, r[0].event, r[0].count, r[0].mult, r[0].serial, r[0].pkt, r[0].sensor_ms, r[0].imu_env_g],
      ['L', '1.0000', '10.00', '', 'step:imu', '12', '2.0', '101', '1', '5001', '0.500']);
  }

  // INSOLE: 加速度（見送ったふみ）→ ジャイロ → 圧力（数えたふみ）。出来事は 2 つとも同じ行に。圧力の列も入る
  {
    const { asm, rows, reads } = make();
    asm.begin(1, 20);
    asm.note(1, 'imu:ignored');
    asm.acc(1, acc(2));
    asm.gyro(1, gyro(2));
    asm.note(1, 'step:press', 5, 1.5);
    asm.flush(1, press, 20);
    const r = rows();
    assert.equal(r.length, 1);
    assert.equal(r[0].foot, 'R');
    assert.equal(r[0].event, 'imu:ignored step:press');
    assert.deepEqual([r[0].p1, r[0].p5, r[0].press_sum, r[0].press_floor, r[0].count, r[0].mult], ['220', '411', '300.0', '1360.0', '5', '1.5']);
    assert.deepEqual(reads, [[1, press]], 'the game is asked once, for that foot, with the pressure values');
    // 左右は別々にためる
    asm.begin(0, 30); asm.acc(0, acc(3));
    asm.begin(1, 30); asm.acc(1, acc(4)); asm.gyro(1, gyro(4)); asm.flush(1, press, 30);
    assert.deepEqual(rows().map(x => x.foot + x.ax_g), ['R2.0000', 'R4.0000'], 'the left sample is still waiting for its last callback');
    asm.flush(0, press, 31);
    assert.equal(rows().at(-1).ax_g, '3.0000');
  }

  // ジャイロや圧力が届かなかった: 次のサンプルを始めるときに、あるぶんだけで 1 行にする。出来事は元のサンプルに付いたまま
  {
    const { asm, rows } = make();
    asm.begin(0, 10); asm.note(0, 'step:imu', 1, 1); asm.acc(0, acc(1));
    asm.begin(0, 15); asm.note(0, 'imu:ignored'); asm.acc(0, acc(2));
    let r = rows();
    assert.equal(r.length, 1);
    assert.deepEqual([r[0].ax_g, r[0].gx_dps, r[0].event, r[0].t_ms], ['1.0000', '', 'step:imu', '15.0']);
    asm.begin(0, 20);
    r = rows();
    assert.deepEqual([r[1].ax_g, r[1].event], ['2.0000', 'imu:ignored']);
  }

  // 目印: サンプルの処理中に起きたものは、そのサンプルの行のあと。そうでなければ、その場で書く
  {
    const { asm, rows } = make();
    asm.mark('start', 1, 'intro');
    asm.begin(0, 10);
    asm.note(0, 'step:press', 36, 3);
    asm.mark('phase:roll', 10, 'play');
    asm.mark('combo', 10, 'play');
    asm.acc(0, acc(1)); asm.gyro(0, gyro(1));
    assert.deepEqual(rows().map(x => x.event), ['start']);
    asm.flush(0, press, 11);
    assert.deepEqual(rows().map(x => x.event), ['start', 'step:press', 'phase:roll', 'combo'], 'the phase marker follows the step that caused it');
    assert.deepEqual(rows().map(x => x.t_ms), ['1.0', '11.0', '11.0', '11.0'], 'and time never goes backwards');
    asm.mark('pause:manual', 50, 'pause');
    assert.equal(rows().at(-1).event, 'pause:manual');
    assert.equal(rows().at(-1).screen, 'pause');
  }

  // ふみふみを終える 1 ふみ: 終わると決まっても、そのサンプルの行を書き終えてから締める（行にセンサーの値が入る）。
  // drain() は、まだ届いていない続きを待たずに、あるぶんを書き出す。何もためていなければ何も書かない
  {
    const { rec, asm, rows } = make();
    asm.begin(0, 10);
    asm.note(0, 'step:imu', 30, 3);          // ここで「おしまい」が決まる（締めるのはあと）
    asm.acc(0, acc(7)); asm.gyro(0, gyro(7));
    asm.flush(0, null, 10);
    asm.drain(12);
    rec.mark(12, 'boil', 'end:finish');
    const r = rows();
    assert.deepEqual(r.map(x => x.event), ['step:imu', 'end:finish']);
    assert.equal(r[0].ax_g, '7.0000', 'the finishing step keeps its sensor values');
    assert.equal(rec.summary().samples[0], 1);

    asm.begin(1, 20); asm.acc(1, acc(8));
    asm.mark('insole:disconnect:R', 20, 'play');
    asm.drain(25);
    assert.deepEqual(rows().slice(2).map(x => [x.foot, x.ax_g, x.event]), [['R', '8.0000', ''], ['', '', 'insole:disconnect:R']]);
    asm.drain(26);
    assert.equal(rows().length, 4, 'draining twice writes nothing more');
  }

  // きろくしていないときは、何もためない
  {
    const rec = new UdonRawRecorder();
    const asm = new UdonRawRecorder.Assembler(rec);
    asm.begin(0, 1); asm.acc(0, acc(1)); asm.note(0, 'x'); asm.gyro(0, gyro(1)); asm.flush(0, press, 1); asm.mark('m', 1, 'play'); asm.drain(2);
    assert.equal(rec.summary().rows, 0);
    assert.equal(asm.buf[0].acc, null);
    rec.start({}, 0);
    asm.begin(0, 1); asm.acc(0, acc(1)); asm.flush(0, null, 1);
    assert.equal(rec.summary().rows, 1, 'a missing read function is fine');
    asm.begin(0, 2); asm.acc(0, acc(2));
    asm.reset();
    asm.drain(3);
    assert.equal(rec.summary().rows, 1, 'reset() forgets what was pending');
  }
}

// 9) index.html と game.js: きろくのボタンと保存ボタンがあり、記録モジュールがゲーム本体より先に読み込まれる
{
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const scripts = Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g), m => m[1]);
  assert.ok(scripts.indexOf('raw-recorder.js') >= 0 && scripts.indexOf('raw-recorder.js') < scripts.indexOf('game.js'));
  for (const id of ['btnRecord', 'btnRawCsv']) assert.ok(html.includes(`id="${id}"`), `#${id} exists`);
  const game = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
  // 既定では記録しない（保存データに record: true があるときだけ）
  assert.match(game, /record: false/);
  assert.match(game, /base\.settings\.record = raw\.settings\.record === true/);
}

console.log('udon-raw-recorder.test.js passed');
