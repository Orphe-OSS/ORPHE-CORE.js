const assert = require('node:assert/strict');
const path = require('node:path');

// examples/GAME-UDON のリザルト解析（レーダーチャート・総合スコア）と、うどんの出し分けを検証する。
const UdonHealth = require(path.join(__dirname, '../examples/GAME-UDON/health-analysis.js'));
const UdonMenu = require(path.join(__dirname, '../examples/GAME-UDON/udon-menu.js'));

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 足踏みログを作る。
 * interval: 平均間隔[ms] / jitter: 間隔のばらつき（割合）/ peak: 強さ[G] / peakJitter: 強さのばらつき（割合）
 * rightScale: 右足の強さ倍率 / slowdown: 最後の間隔が最初の何倍になるか / feet: 1 | 2
 */
function makeLog({ count = 60, interval = 550, jitter = 0.05, peak = 1.2, peakJitter = 0.1, rightScale = 1,
  slowdown = 1, feet = 2, seed = 1, rightSkipEvery = 0 } = {}) {
  const rand = rng(seed);
  const steps = [];
  let t = 0;
  let foot = 0;
  for (let i = 0; i < count; i++) {
    const k = 1 + (slowdown - 1) * (i / Math.max(1, count - 1));
    if (i > 0) t += interval * k * (1 + (rand() * 2 - 1) * jitter);
    let f = feet === 2 ? foot : 0;
    if (feet === 2 && rightSkipEvery && f === 1 && (i % rightSkipEvery) === 1) f = 0;
    steps.push({ t, foot: f, peak: peak * (f === 1 ? rightScale : 1) * (1 + (rand() * 2 - 1) * peakJitter) });
    foot = 1 - foot;
  }
  return steps;
}

const score = (r, key) => r.axes.find(a => a.key === key).score;

// 1) そろった足踏み: すべての軸が高く、名人〜職人ランク
{
  const r = UdonHealth.analyze({ steps: makeLog({ count: 80, interval: 500, jitter: 0.03, peak: 1.6, peakJitter: 0.08 }) });
  assert.equal(r.ok, true);
  assert.equal(r.stepCount, 80);
  assert.equal(r.feet, 2);
  assert.ok(Math.abs(r.cadence - 120) < 3, `cadence ≈ 120 (${r.cadence.toFixed(1)})`);
  assert.ok(score(r, 'rhythm') >= 95, `rhythm ${score(r, 'rhythm')}`);
  assert.ok(score(r, 'balance') >= 95, `balance ${score(r, 'balance')}`);
  assert.ok(score(r, 'stamina') >= 90, `stamina ${score(r, 'stamina')}`);
  assert.ok(score(r, 'steady') >= 95, `steady ${score(r, 'steady')}`);
  assert.ok(r.total >= 88, `total ${r.total}`);
  assert.equal(r.rank.key, 'meijin');
  assert.equal(r.axes.length, 6);
  assert.ok(r.bestStreak >= 40, `long rhythm streak (${r.bestStreak})`);
  assert.equal(r.restCount, 0);
}

// 2) 各軸は、それぞれの観点だけに反応する
{
  const base = UdonHealth.analyze({ steps: makeLog({ seed: 2 }) });

  const ragged = UdonHealth.analyze({ steps: makeLog({ seed: 2, jitter: 0.45 }) });
  assert.ok(score(ragged, 'rhythm') < score(base, 'rhythm') - 25, 'irregular intervals lower the rhythm score');
  assert.equal(ragged.weakAxis, 'rhythm');

  const lopsided = UdonHealth.analyze({ steps: makeLog({ seed: 2, rightScale: 0.35, rightSkipEvery: 4 }) });
  assert.ok(score(lopsided, 'balance') < score(base, 'balance') - 25, 'asymmetry lowers the balance score');
  assert.ok(lopsided.left.share > 0.6, `left share ${lopsided.left.share.toFixed(2)}`);
  assert.ok(Math.abs(score(lopsided, 'rhythm') - score(base, 'rhythm')) <= 5, 'balance does not leak into rhythm');
  assert.ok(lopsided.tip.startsWith('右足'), `advice names the weaker foot: ${lopsided.tip}`);

  const fading = UdonHealth.analyze({ steps: makeLog({ seed: 2, slowdown: 1.9 }) });
  assert.ok(score(fading, 'stamina') < score(base, 'stamina') - 30, 'slowing down lowers the stamina score');
  assert.ok(fading.paceRatio < 0.7);

  const uneven = UdonHealth.analyze({ steps: makeLog({ seed: 2, peakJitter: 0.9 }) });
  assert.ok(score(uneven, 'steady') < score(base, 'steady') - 30, 'uneven strength lowers the steady score');

  const strong = UdonHealth.analyze({ steps: makeLog({ seed: 2, peak: 3 }) });
  const gentle = UdonHealth.analyze({ steps: makeLog({ seed: 2, peak: 0.25 }) });
  assert.ok(score(strong, 'power') > score(gentle, 'power') + 40);
  assert.equal(score(strong, 'rhythm'), score(gentle, 'rhythm'), 'strength does not change the rhythm score');

  const fast = UdonHealth.analyze({ steps: makeLog({ seed: 2, interval: 430 }) });
  const slow = UdonHealth.analyze({ steps: makeLog({ seed: 2, interval: 1000 }) });
  assert.ok(score(fast, 'tempo') > score(slow, 'tempo') + 30);
}

// 3) やさしく・ゆっくりでも、そろっていれば総合スコアはしっかり出る（弱さを罰しない）
{
  const r = UdonHealth.analyze({ steps: makeLog({ count: 40, interval: 900, jitter: 0.06, peak: 0.25, peakJitter: 0.12, seed: 3 }) });
  assert.ok(score(r, 'power') < 40);
  assert.ok(r.total >= 70, `gentle but regular stepping still scores well (${r.total})`);
  assert.ok(['shokunin', 'ichininmae'].includes(r.rank.key), r.rank.key);
}

// 4) CORE 1 台（片足）: バランスは計測せず、残りの 5 軸で総合スコアを出す
{
  const r = UdonHealth.analyze({ steps: makeLog({ feet: 1, seed: 4 }) });
  assert.equal(r.feet, 1);
  assert.equal(score(r, 'balance'), null);
  assert.equal(r.axes.filter(a => a.score !== null).length, 5);
  assert.ok(r.total > 0 && r.total <= 100);
  assert.notEqual(r.weakAxis, 'balance');
  // 明示指定はログからの推定より優先
  assert.equal(UdonHealth.analyze({ steps: makeLog({ feet: 1 }), feet: 2 }).feet, 2);
}

// 5) ひとやすみ（長い間隔）はリズムやテンポを下げず、休んだ回数として数える
{
  const steps = makeLog({ count: 60, interval: 600, jitter: 0.04, seed: 5 });
  const noRest = UdonHealth.analyze({ steps });
  const withRest = UdonHealth.analyze({
    steps: steps.map((s, i) => ({ ...s, t: s.t + (i >= 20 ? 9000 : 0) + (i >= 40 ? 6000 : 0) })),
  });
  assert.equal(withRest.restCount, 2);
  assert.ok(Math.abs(withRest.restSec - 15) < 2, `rest ≈ 15s (${withRest.restSec.toFixed(1)})`);
  assert.ok(Math.abs(withRest.cadence - noRest.cadence) < 2, 'cadence is computed on active time');
  assert.ok(Math.abs(score(withRest, 'rhythm') - score(noRest, 'rhythm')) <= 3, 'rests do not count as bad rhythm');
  assert.ok(Math.abs(withRest.activeSec - noRest.activeSec) < 2);
  assert.equal(withRest.series.steps.filter(s => s.afterRest).length, 2);
}

// 5b) 一時停止（ひとやすみボタン）は、止めていた時間を時計から除いたうえで「ひとやすみ明け」の印で伝わる。
//     ゆっくりの人（間隔 1.5 秒）でも、その間隔がリズムやテンポを乱さない
{
  const slow = makeLog({ count: 40, interval: 1500, jitter: 0.04, seed: 6 });
  const base = UdonHealth.analyze({ steps: slow });
  // 20 ふみ目の前で一時停止 → 再開。時計は止まっていたので、間隔はたまたま 0.3 秒しか空いていない
  const paused = slow.map((s, i) => ({ ...s, t: s.t - (i >= 20 ? 1200 : 0), rest: i === 20 }));
  const r = UdonHealth.analyze({ steps: paused });
  assert.equal(r.restCount, 1, 'a flagged pause counts as one rest');
  assert.equal(r.series.steps[20].afterRest, true);
  assert.ok(Math.abs(score(r, 'rhythm') - score(base, 'rhythm')) <= 3, 'the short gap around a pause does not hurt rhythm');
  assert.ok(Math.abs(r.cadence - base.cadence) < 1.5, 'nor cadence');
  // 印がなければ、同じログは「1 回だけ極端に短い間隔」として リズムを下げる（＝印が効いている）
  const unflagged = UdonHealth.analyze({ steps: paused.map(s => ({ ...s, rest: false })) });
  assert.equal(unflagged.restCount, 0);
  assert.ok(unflagged.interval.cv > r.interval.cv);
}

// 6) データが少ないときは、点数をつけずにそう伝える
{
  for (const steps of [undefined, [], makeLog({ count: 1 }), makeLog({ count: 5 })]) {
    const r = UdonHealth.analyze({ steps });
    assert.equal(r.ok, false);
    assert.equal(r.total, 0);
    assert.ok(r.axes.every(a => a.score === null));
    assert.ok(r.tip.length > 0);
    assert.equal(r.rank.key, 'deshi');
  }
  // 12 ふみ未満はスタミナだけ未計測
  const short = UdonHealth.analyze({ steps: makeLog({ count: 10 }) });
  assert.equal(short.ok, true);
  assert.equal(score(short, 'stamina'), null);
  // 壊れたデータは無視する
  const dirty = UdonHealth.analyze({ steps: [...makeLog({ count: 20 }), { t: NaN, foot: 0, peak: 1 }, null] });
  assert.equal(dirty.stepCount, 20);
}

// 7) スコアは 0〜100 の整数に収まる。極端な入力でも壊れない
{
  for (let seed = 10; seed < 40; seed++) {
    const rand = rng(seed);
    const r = UdonHealth.analyze({
      steps: makeLog({
        count: 12 + Math.floor(rand() * 200), interval: 150 + rand() * 2500, jitter: rand() * 0.95,
        peak: 0.05 + rand() * 8, peakJitter: rand() * 0.99, rightScale: 0.1 + rand() * 3,
        slowdown: 0.4 + rand() * 3, feet: rand() < 0.3 ? 1 : 2, seed,
      }),
    });
    for (const a of r.axes) {
      assert.ok(a.score === null || (Number.isInteger(a.score) && a.score >= 0 && a.score <= 100), `${a.key}=${a.score}`);
      assert.equal(typeof a.display, 'string');
    }
    assert.ok(Number.isInteger(r.total) && r.total >= 0 && r.total <= 100);
    assert.ok(r.rank && r.praise && r.tip);
    assert.ok(r.series.cadence.every(p => isFinite(p.spm) && p.spm > 0));
  }
  assert.equal(UdonHealth.curve(-5, [[0, 10], [1, 20]]), 10);
  assert.equal(UdonHealth.curve(0.5, [[0, 10], [1, 20]]), 15);
  assert.equal(UdonHealth.curve(9, [[0, 10], [1, 20]]), 20);
  assert.equal(UdonHealth.curve(NaN, [[0, 10], [1, 20]]), 10);
  assert.deepEqual(UdonHealth.AXES.reduce((s, a) => s + a.weight, 0).toFixed(6), '1.000000');
  assert.equal(UdonHealth.rankFor(100).key, 'meijin');
  assert.equal(UdonHealth.rankFor(0).key, 'deshi');
}

// 8) CSV と履歴用サマリ
{
  const r = UdonHealth.analyze({ steps: makeLog({ count: 20, seed: 8 }) });
  const lines = UdonHealth.toCsv(r).trim().split('\n');
  assert.equal(lines[0], 'no,time_sec,foot,strength_g,interval_sec,after_rest');
  assert.equal(lines.length, 21);
  assert.match(lines[1], /^1,0\.000,L,\d+\.\d{3},,0$/);
  assert.match(lines[2], /^2,\d+\.\d{3},R,\d+\.\d{3},\d+\.\d{3},0$/);
  const s = UdonHealth.summarize(r);
  assert.equal(s.total, r.total);
  assert.equal(s.steps, 20);
  assert.deepEqual(Object.keys(s.axes), ['rhythm', 'tempo', 'balance', 'power', 'stamina', 'steady']);
  assert.ok(JSON.stringify(s).length < 300, 'history entry stays small');
}

// 9) お品書き: 12 種類、id は一意、説明とヒントがある
{
  assert.equal(UdonMenu.MENU.length, 12);
  assert.equal(new Set(UdonMenu.MENU.map(m => m.id)).size, 12);
  for (const m of UdonMenu.MENU) {
    assert.ok(m.name && m.en && m.trait && m.reason && m.hint, m.id);
    assert.ok([1, 2, 3].includes(m.rarity));
  }
  assert.equal(UdonMenu.byId('nope'), null);
}

// 10) ふみかたで、できあがるうどんが変わる（pick() 単体: 解析結果を直接組み立てて検証）
{
  const all = Object.fromEntries(UdonMenu.MENU.map(m => [m.id, 1]));   // 図鑑が全部埋まっている状態
  const base = { rhythm: 50, tempo: 60, balance: 50, power: 50, stamina: 50, steady: 50 };
  const result = (axes, extra = {}) => {
    const merged = { ...base, ...axes };
    const entries = Object.entries(merged).filter(([, v]) => v !== null);
    const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return {
      ok: true, stepCount: 60, cadence: 95, medianPeak: 1, restCount: 0, total: 60, bestAxis: best[0],
      axes: Object.entries(merged).map(([key, score]) => ({ key, score })), ...extra,
    };
  };
  const pick = (axes, extra, ctx = {}) => UdonMenu.pick(result(axes, extra), { collected: all, target: 60, threshold: 0.6, ...ctx }).id;

  assert.equal(pick({}), 'kake', 'no standout trait → the basic bowl');
  assert.equal(pick({ rhythm: 92 }), 'kitsune');
  assert.equal(pick({ balance: 92 }), 'tsukimi');
  assert.equal(pick({ power: 92 }), 'ebiten');
  assert.equal(pick({ stamina: 92 }), 'niku');
  assert.equal(pick({ steady: 92 }), 'wakame');
  assert.equal(pick({ tempo: 96 }, { cadence: 124 }), 'curry');
  assert.equal(pick({ tempo: 80 }, { cadence: 100 }), 'kake', 'an ordinary tempo is not "high tempo"');
  assert.equal(pick({ rhythm: 80, tempo: 50 }, { cadence: 66 }), 'zaru', 'slow but regular → zaru, not kitsune');
  assert.equal(pick({ rhythm: 40, tempo: 50 }, { cadence: 66 }), 'kake', 'slow and irregular is not zaru');
  assert.equal(pick({}, {}, { threshold: 0.18 }), 'tanuki', 'gentle sensitivity → tanuki');
  assert.equal(pick({ power: 30 }, { medianPeak: 0.3 }), 'tanuki', 'soft stepping → tanuki');
  assert.equal(pick({}, {}, { pauses: 1 }), 'ume');
  assert.equal(pick({}, { restCount: 2 }), 'ume');
  // コンボで早く進むので、ふみ数は目標より少なくてよい。大盛り以上を「ふみきった」ことが条件
  assert.equal(pick({}, { stepCount: 55 }, { target: 100, completed: true }), 'chikara');
  assert.equal(pick({}, { stepCount: 70 }, { target: 100, completed: false }), 'kake', 'chikara needs the big course to be finished');
  assert.equal(pick({}, { stepCount: 60 }, { target: 60, completed: true }), 'kake', 'the regular course is not enough for chikara');
  assert.equal(pick({ rhythm: 99, balance: 99, stamina: 99, steady: 99 }, { total: 92 }), 'nabeyaki');
  assert.equal(pick({ rhythm: 99, balance: 99 }, { total: 92, stepCount: 30 }), 'kitsune', 'nabeyaki needs 40+ steps');
  assert.equal(pick({ balance: null, rhythm: 75 }), 'kitsune', 'unmeasured balance never yields tsukimi');
  // いちばん得意な観点が選ばれる
  assert.equal(pick({ rhythm: 80, stamina: 88 }), 'niku');
  assert.equal(pick({ rhythm: 88, stamina: 80 }), 'kitsune');

  // 通し: 実際の解析結果から
  const meijin = UdonHealth.analyze({ steps: makeLog({ count: 80, interval: 500, jitter: 0.03, peak: 1.6, peakJitter: 0.08 }) });
  assert.equal(UdonMenu.pick(meijin, { collected: all, target: 60, threshold: 0.6 }).id, 'nabeyaki');
  const gentle = UdonHealth.analyze({ steps: makeLog({ feet: 1, count: 30, interval: 900, jitter: 0.6, peak: 0.2, peakJitter: 0.9, seed: 8 }) });
  assert.equal(UdonMenu.pick(gentle, { collected: all, target: 30, threshold: 0.18 }).id, 'tanuki');
  // データ不足でも必ず 1 杯
  assert.equal(UdonMenu.pick(UdonHealth.analyze({ steps: [] }), {}).id, 'kake');
  assert.equal(UdonMenu.pick(null, {}).id, 'kake');
  assert.equal(UdonMenu.pick(null, { pauses: 2, collected: all }).id, 'ume');
}

// 11) まだ出会っていないうどんを優先する → 遊ぶたびに図鑑が埋まる
{
  const analysis = UdonHealth.analyze({ steps: makeLog({ count: 80, interval: 500, jitter: 0.03, peak: 1.6, peakJitter: 0.08 }) });
  const collected = {};
  const seen = [];
  for (let i = 0; i < 8; i++) {
    const p = UdonMenu.pick(analysis, { collected, target: 60, threshold: 0.6 });
    seen.push(p.id);
    assert.equal(p.isNew, !collected[p.id]);
    collected[p.id] = (collected[p.id] || 0) + 1;
  }
  assert.equal(seen[0], 'nabeyaki', 'the strongest match comes first');
  assert.ok(new Set(seen.slice(0, 6)).size >= 6, `same style keeps unlocking new bowls: ${seen.join(',')}`);
  // 全部そろったら、いちばん合う一杯に戻る
  const done = Object.fromEntries(UdonMenu.MENU.map(m => [m.id, 1]));
  assert.equal(UdonMenu.pick(analysis, { collected: done }).id, 'nabeyaki');
}

// ORPHE INSOLE のログ: 押しぐあい（press）と、つま先／かかと（fore）が付いているときだけ CSV に列が増える。
// 点数には使わない（CORE と同じ土俵で比べられるように）
{
  const base = Array.from({ length: 24 }, (_, i) => ({ t: i * 520, foot: i % 2, peak: 1.1 }));
  const withSole = base.map((s, i) => ({ ...s, press: i === 3 ? null : 0.9 + (i % 4) * 0.05, fore: i % 2 ? 0.4 : -0.6 }));
  const plain = UdonHealth.analyze({ steps: base });
  const sole = UdonHealth.analyze({ steps: withSole });
  assert.equal(sole.total, plain.total, 'pressure columns do not change the score');
  assert.deepEqual(sole.axes.map(a => a.score), plain.axes.map(a => a.score));

  const plainCsv = UdonHealth.toCsv(plain).trim().split('\n');
  assert.equal(plainCsv[0], 'no,time_sec,foot,strength_g,interval_sec,after_rest', 'the CORE CSV keeps its columns');
  assert.equal(plainCsv[1].split(',').length, 6);

  const csv = UdonHealth.toCsv(sole).trim().split('\n');
  assert.equal(csv[0], 'no,time_sec,foot,strength_g,interval_sec,after_rest,press_rel,fore_aft');
  assert.equal(csv.length, 25);
  assert.deepEqual(csv[1].split(',').slice(6), ['0.90', '-0.60']);
  assert.deepEqual(csv[2].split(',').slice(6), ['0.95', '0.40']);
  assert.deepEqual(csv[4].split(',').slice(6), ['', '0.40'], 'a step counted by the IMU has no press value');
  assert.ok(csv.every(line => line.split(',').length === 8));
  assert.equal(sole.series.steps[0].press, 0.9);
  assert.equal(sole.series.steps[3].press, null);
  // おかしな値は無いものとして扱う
  const odd = UdonHealth.analyze({ steps: base.map(s => ({ ...s, press: NaN, fore: 'x' })) });
  assert.equal(UdonHealth.toCsv(odd).split('\n')[0], 'no,time_sec,foot,strength_g,interval_sec,after_rest');
}

console.log('udon-health-analysis.test.js passed');
