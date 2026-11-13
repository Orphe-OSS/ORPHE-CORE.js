const assert = require('node:assert/strict');
const path = require('node:path');

// examples/GAME-UDON のコンボ（おなじリズムでふみつづけると早く進む）の規則を検証する。
const UdonCombo = require(path.join(__dirname, '../examples/GAME-UDON/combo.js'));

/** 間隔（ms）の列から、ふみのログを作って順に流す。戻り値は各ふみのあとの { streak, mult, broke } */
function play(intervals, { restAt = [] } = {}) {
  const steps = [{ t: 0 }];
  const out = [];
  let streak = 0;
  intervals.forEach((gap, i) => {
    steps.push({ t: steps[steps.length - 1].t + gap, rest: restAt.includes(i) });
    const r = UdonCombo.advance(steps, streak);
    streak = r.streak;
    out.push({ streak, mult: UdonCombo.mult(streak), level: UdonCombo.level(streak), broke: r.broke });
  });
  return out;
}

const repeat = (v, n) => Array.from({ length: n }, () => v);

// 1) 倍率の段階
{
  assert.deepEqual([0, 2, 3, 6, 7, 13, 14, 100].map(UdonCombo.mult), [1, 1, 1.5, 1.5, 2, 2, 3, 3]);
  assert.deepEqual([0, 3, 7, 14].map(UdonCombo.level), [0, 1, 2, 3]);
  assert.equal(UdonCombo.FULL, 14);
  const ats = UdonCombo.LEVELS.map(l => l.at), mults = UdonCombo.LEVELS.map(l => l.mult);
  assert.deepEqual(ats, [...ats].sort((a, b) => a - b));
  assert.deepEqual(mults, [...mults].sort((a, b) => a - b));
  assert.ok(UdonCombo.LEVELS.every(l => l.call));
}

// 2) おなじ間隔でふみつづけると、×1.5 → ×2 → ×3 と上がる。速さは関係ない
for (const interval of [250, 500, 900, 1600]) {
  const r = play(repeat(interval, 20));
  // 2 ふみ目までは間隔をくらべられないので、3 ふみ目からつながりはじめる
  assert.equal(r[0].streak, 0);
  assert.equal(r[1].streak, 1);
  assert.equal(r[3].mult, 1.5, `×1.5 after three even steps at ${interval}ms`);
  assert.equal(r[7].mult, 2);
  assert.equal(r[14].mult, 3);
  assert.ok(r.every(s => !s.broke));
}

// 3) 少しのゆらぎ（±10%）では切れない。大きくばらつくと上がらない
{
  let seed = 7;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const wobbly = Array.from({ length: 40 }, () => 500 * (1 + (rand() * 2 - 1) * 0.1));
  assert.equal(play(wobbly).at(-1).mult, 3, 'a human-like ±10% wobble keeps the combo');
  const ragged = Array.from({ length: 40 }, (_, i) => (i % 2 ? 300 : 800) * (1 + (rand() * 2 - 1) * 0.5));
  assert.ok(Math.max(...play(ragged).map(s => s.level)) <= 1, 'irregular stepping does not reach a high combo');
}

// 4) 左右で間隔がちがっても（タン・タ、タン・タ）、そろっていればつながる
{
  const limp = Array.from({ length: 24 }, (_, i) => (i % 2 ? 420 : 680));
  assert.equal(play(limp).at(-1).mult, 3);
}

// 5) 1 回ずれただけなら 1 段階さがるだけ。すぐ元のリズムに戻れば、また上がる
{
  const r = play([...repeat(500, 16), 900, ...repeat(500, 8)]);
  assert.equal(r[15].level, 3);
  assert.equal(r[16].level, 2, 'one off-beat step drops a single level');
  assert.equal(r[16].streak, UdonCombo.LEVELS[1].at);
  assert.equal(r[16].broke, true);
  assert.equal(r[17].broke, false);
  assert.equal(r.at(-1).level, 3, 'and the combo climbs back');

  // ×1.5 のときにずれたら、×1 に戻る
  const low = play([...repeat(500, 5), 900]);
  assert.equal(low[4].level, 1);
  assert.equal(low[5].streak, 0);
  // もともとコンボがなければ「切れた」とは言わない
  assert.equal(play([500, 900, 300]).some(s => s.broke), false);
}

// 6) 2 秒以上あいたら最初から。ひとやすみ（一時停止）明けも最初から
{
  const stopped = play([...repeat(500, 16), 2500, ...repeat(500, 3)]);
  assert.equal(stopped[16].streak, 0);
  assert.equal(stopped[16].broke, true);
  assert.equal(stopped[17].streak, 0, 'the gap itself is not used as "the usual interval"');
  assert.equal(stopped[18].streak, 1);

  // 一時停止の時間は時計から除かれるので、間隔だけ見ると「そろっている」ように見える。印で切る
  const paused = play(repeat(500, 20), { restAt: [16] });
  assert.equal(paused[15].level, 3);
  assert.equal(paused[16].streak, 0);
  assert.equal(paused[17].streak, 0);
}

// 7) テンポをゆっくり変えていくのは、ずれではない
{
  const speedingUp = Array.from({ length: 30 }, (_, i) => 800 - i * 12);
  assert.equal(play(speedingUp).at(-1).mult, 3);
}

// 8) データが少ない・おかしいときも壊れない
{
  assert.deepEqual(UdonCombo.advance([], 5), { streak: 0, broke: false });
  assert.deepEqual(UdonCombo.advance([{ t: 0 }, { t: 500 }], 0), { streak: 0, broke: false });
  assert.equal(UdonCombo.advance([{ t: 0 }, { t: 0 }, { t: 0 }], 0).streak, 0, 'zero intervals never count as even');
}

console.log('udon-combo.test.js passed');
