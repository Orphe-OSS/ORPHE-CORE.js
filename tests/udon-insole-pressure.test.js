const assert = require('node:assert/strict');
const path = require('node:path');

// examples/GAME-UDON の ORPHE INSOLE 圧力処理（insole-pressure.js）を検証する。
//
// 合成データは、ORPHE-INSOLE.js の udon example で 2026-07 に収録した実機ログ
// （左右 2 枚・約 60 秒の足踏み）の特徴に合わせてある:
//   - 足をのせていなくても 1ch あたり 220 前後（チャネルによって 256 前後）の値が出ている
//   - 立っているだけで、かかと・中足部には最初から数百の圧がかかっている
//   - 1 ふみの立ち上がりは、合計でおよそ 150〜2000（ふつうの足踏みで 800〜1000）
//   - 体重は かかと・中足部（外）にのり、つま先（外）はほとんど反応しない個体もある
//   - 2 枚同時だと BLE パケットが 2〜4 割ほど落ちる（1 パケット = 4 サンプルが同じ時刻に届く）
const UdonInsolePressure = require(path.join(__dirname, '../examples/GAME-UDON/insole-pressure.js'));

const FLOOR = [220, 222, 220, 256, 222, 221];
const SHAPE = [0.03, 0.07, 0.01, 0.08, 0.33, 0.48];   // 合計 1。かかと・中足部（外）が中心
const TOE = [0.4, 0.35, 0.2, 0.05, 0, 0];             // つま先でふんだとき

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * 圧力を作って流す。load(tMs) = その時刻の「合計の押しぐあい」（生値の合計がどれだけ増えるか）
 * @returns {{steps: object[], p: UdonInsolePressure, t: number}}
 */
function feed(p, load, {
  ms = 10000, from = 0, foot = 0, scale = 1, noise = 1.5, shape = SHAPE, preload = 0, loss = 0, seed = 7,
  glitch = null, drift = 0,
} = {}) {
  const rand = rng(seed + foot);
  const steps = [];
  // 200Hz。BLE は 20ms ごとに 4 サンプルをまとめて届ける
  for (let t = from; t < from + ms; t += 20) {
    if (loss && rand() < loss) continue;
    for (let k = 0; k < 4; k++) {
      const ts = t + k * 5;
      const total = load(ts);
      const values = FLOOR.map((base, ch) => {
        let v = base + drift * (ts - from) / 1000 + SHAPE[ch] * preload + shape[ch] * total + (rand() - 0.5) * 2 * noise;
        if (glitch) v = glitch(ts, ch, v);
        return Math.round(v * scale);
      });
      const step = p.push(foot, values, t);
      if (step) steps.push(step);
    }
  }
  return { steps, p, t: from + ms };
}

/** 足踏み: period ごとに 1 回、duty の間だけ体重がのる（立ち上がり・立ち下がりはなめらか） */
function stepping({ period = 760, duty = 0.5, amp = 850, low = 0, start = 1000, count = Infinity, ramp = 70 }) {
  return (t) => {
    if (t < start) return low;
    const n = Math.floor((t - start) / period);
    if (n >= count) return low;
    const u = (t - start) - n * period;
    const on = period * duty;
    const k = Math.max(0, Math.min(1, u / ramp, (on - u) / ramp));
    return low + (amp - low) * k;
  };
}

const at = (level, options) => { const p = new UdonInsolePressure(options); p.setLevel(level); return p; };
const LEVELS = [1, 2, 3, 4, 5];

// 1) じっとしている（ノイズだけ）: どの感度でも数えない。押しぐあいの表示も 0 のまま
for (const level of LEVELS) {
  const { steps, p } = feed(at(level), () => 0, { ms: 12000 });
  assert.equal(steps.length, 0, `level ${level}: no step at rest`);
  assert.ok(p.load(0) < 0.05, `level ${level}: no load shown at rest`);
  assert.equal(p.cop(0).valid, false);
}

// 2) はじめから圧がかかっている（立ったまま接続）→ 足踏み: 着地 1 回につき 1 ふみ
for (const level of LEVELS) {
  const { steps } = feed(at(level), stepping({ count: 20 }), { ms: 18000, preload: 0 });
  assert.equal(steps.length, 20, `level ${level}: 20 landings → 20 steps`);
}
{
  // 立っているだけで かかと・中足部に 450 の圧がかかっていて、足を上げるとそれが抜ける。
  // 最初の 1 歩（足を上げる）で床が無負荷まで下がり、そのあとは着地ごとに 1 ふみ
  const standing = 450;
  const load = (t) => {
    if (t < 1500) return standing;                     // 立っている
    const u = (t - 1500) % 800;
    return u < 330 ? 0 : standing + 500;               // 上げる → 着地して体重をのせる
  };
  for (const level of LEVELS) {
    const { steps } = feed(at(level), load, { ms: 1500 + 800 * 15 });
    assert.equal(steps.length, 15, `level ${level}: standing preload does not hide or duplicate steps`);
  }
}

// 3) 感度: そっとした押しぐあいは、やさしい感度でだけ数える
{
  const count = (level, amp, options) => feed(at(level), stepping({ amp, count: 12, period: 1000 }), { ms: 14000, ...options }).steps.length;
  assert.deepEqual(LEVELS.map(l => count(l, 60)), [0, 0, 0, 12, 12], 'a 60-count press needs level 4+');
  assert.deepEqual(LEVELS.map(l => count(l, 120)), [0, 0, 12, 12, 12], 'a 120-count press needs level 3+');
  assert.deepEqual(LEVELS.map(l => count(l, 230)), [0, 12, 12, 12, 12], 'a 230-count press needs level 2+');
  assert.deepEqual(LEVELS.map(l => count(l, 480)), [12, 12, 12, 12, 12]);

  // 4) 値の単位がちがっても同じ（INSOLE 1.5 は mV×10 で届き、無負荷が 590 前後）。割合で見ているため
  const scale = 590 / 222;
  assert.deepEqual(LEVELS.map(l => count(l, 60, { scale })), [0, 0, 0, 12, 12]);
  assert.deepEqual(LEVELS.map(l => count(l, 230, { scale })), [0, 12, 12, 12, 12]);
  assert.deepEqual(LEVELS.map(l => count(l, 480, { scale, noise: 4 })), [12, 12, 12, 12, 12]);
}

// 5) 1 サンプルだけの飛び値（0 や上限値）で、床もふみも狂わない
{
  const glitch = (ts, ch, v) => {
    if (ts === 3000 && ch === 5) return 0;
    if (ts === 5000 && ch === 4) return 65535;
    if (ts === 7005 && ch === 0) return 0;
    return v;
  };
  const p = at(5);
  const r = feed(p, () => 0, { ms: 9000, glitch });
  assert.equal(r.steps.length, 0, 'single-sample dropouts are not steps, even at the most sensitive level');
  assert.ok(Math.abs(p.feet[0].floorTotal - 1361) < 12, `the floor stays at the unloaded level (${p.feet[0].floorTotal})`);
  const after = feed(p, stepping({ start: 9500, count: 5 }), { from: 9000, ms: 6000 });
  assert.equal(after.steps.length, 5);
}

// 6) BLE のパケット落ち（2 枚同時だと 2〜4 割落ちる）でも、数はそのまま
for (const loss of [0.2, 0.4]) {
  for (const level of [2, 4]) {
    const { steps } = feed(at(level), stepping({ count: 20 }), { ms: 18000, loss, seed: 11 });
    assert.equal(steps.length, 20, `level ${level}, ${loss * 100}% packet loss`);
  }
}

// 7) 足を床から離さない、体重を移すだけの足踏み（圧が 350〜900 を行き来して、0 には戻らない）
{
  const { steps } = feed(at(2), stepping({ low: 350, amp: 900, count: 14, period: 1000 }), { ms: 16000 });
  assert.equal(steps.length, 14);
}

// 8) 速いバタバタ（片足 3Hz）も、ゆっくりていねいな 1 歩（2 秒に 1 回）も、1 回ずつ
{
  const fast = feed(at(2), stepping({ period: 333, amp: 700, count: 30, ramp: 40 }), { ms: 12000 });
  assert.equal(fast.steps.length, 30);
  const slow = feed(at(2), stepping({ period: 2000, duty: 0.6, amp: 900, count: 8, ramp: 250 }), { ms: 18000 });
  assert.equal(slow.steps.length, 8, 'a slow lift-and-land is one step, not two');
  // 着地のあと体重をのせたまま、ゆらゆらしても数えない
  const sway = (t) => (t < 1000 ? 0 : 800 + 90 * Math.sin(t / 180));
  assert.equal(feed(at(2), sway, { ms: 9000 }).steps.length, 1);
}

// 9) 左右は別々に数える。step には足・時刻・押しぐあいが入る
{
  const p = at(2);
  const all = [];
  p.onStep = (s) => all.push(s);
  for (let t = 0; t < 12000; t += 20) {
    for (let foot = 0; foot < 2; foot++) {
      const load = stepping({ start: 1000 + foot * 400, period: 800, count: 10 });
      feed(p, load, { from: t, ms: 20, foot, seed: 3 + t });
    }
  }
  assert.equal(all.length, 20);
  assert.deepEqual(all.slice(0, 6).map(s => s.foot), [0, 1, 0, 1, 0, 1]);
  for (const s of all) {
    assert.equal(s.source, 'press');
    assert.equal(s.peak, 0, 'the IMU strength is filled in by the game');
    assert.ok(s.rise > 150 && s.rise < 1000);
    assert.ok(s.fore >= -1 && s.fore <= 1);
  }
  // 山が終わると、その人のいつもの押しぐあいに対する割合がほぼ 1 になる
  assert.ok(Math.abs(all[5].rel - 1) < 0.25, `rel ${all[5].rel}`);
  assert.ok(Math.abs(p.feet[0].span - 850) < 120, `span learns the usual press (${p.feet[0].span})`);
}

// 10) 表示用の値: 押しぐあい・センサごとの値・圧力の中心
{
  const p = at(2);
  let maxLoad = 0, heelFore = null, pads = null;
  const load = stepping({ count: 12 });
  for (let t = 0; t < 11000; t += 20) {
    feed(p, load, { from: t, ms: 20, seed: t });
    if (t > 6000) {
      if (p.load(0) > maxLoad) { maxLoad = p.load(0); pads = p.pads(0).slice(); heelFore = p.cop(0).fore; }
    }
  }
  assert.ok(maxLoad > 0.7 && maxLoad <= 1, `a usual press shows as a nearly full load (${maxLoad})`);
  assert.equal(pads.indexOf(Math.max(...pads)), 5, 'the heel pad is the largest for a heel-heavy press');
  assert.ok(pads.every(v => v >= 0 && v <= 1));
  assert.ok(heelFore < -0.2, `heel-heavy → fore < 0 (${heelFore})`);
  assert.ok(p.load(0) < 0.1, 'the load falls back when the foot is lifted');

  const toe = at(2);
  let toeFore = 0;
  const toeLoad = stepping({ count: 6 });
  for (let t = 0; t < 6000; t += 20) {
    feed(toe, toeLoad, { from: t, ms: 20, shape: TOE, seed: t });
    if (toe.cop(0).valid) toeFore = Math.max(toeFore, toe.cop(0).fore);
  }
  assert.ok(toeFore > 0.4, `toe press → fore > 0 (${toeFore})`);
  const c = toe.cop(0);
  assert.ok(c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1);
}

// 11) とびぬけて強い 1 回のあとも、ふつうの強さのふみを数えつづける
{
  const amps = [850, 850, 850, 2700, 850, 850, 850, 850];
  const load = (t) => {
    if (t < 1000) return 0;
    const n = Math.floor((t - 1000) / 800);
    return n < amps.length && (t - 1000) % 800 < 400 ? amps[n] : 0;
  };
  const { steps, p } = feed(at(1), load, { ms: 9000 });
  assert.equal(steps.length, amps.length);
  assert.ok(p.feet[0].span < 1700, `one huge stomp does not rescale everything (${p.feet[0].span})`);

  // いちばん最初の 1 回がとびぬけて強くても、次のふつうの 1 回がしっかり押して見える
  const first = at(2);
  const big = (t) => (t >= 1000 && t < 1400 ? 3000 : (t >= 1800 && t < 2300 ? 850 : 0));
  let shown = 0;
  for (let t = 0; t < 2300; t += 20) {
    feed(first, big, { from: t, ms: 20, seed: t });
    if (t > 1900) shown = Math.max(shown, first.load(0));
  }
  assert.ok(shown > 0.6, `the usual press after a huge first stomp still shows clearly (${shown})`);
}

// 12) しきい値に届かなかった山を覚えている（感度アシスト用）。時間がたつと忘れる
{
  const p = at(2);
  const r = feed(p, stepping({ amp: 100, count: 5, period: 900 }), { ms: 6000 });
  assert.equal(r.steps.length, 0);
  assert.equal(p.missedCount(0, 6000), 5);
  assert.equal(p.missedCount(1, 6000), 0);
  assert.equal(p.missedCount(0, 6000 + 7000), 0, 'forgotten after the window');
  p.clearMissed();
  assert.equal(p.missedCount(0, 6000), 0);
}

// 13) 圧力で数えられているか（この間、ゲームは加速度のふみを使わない）
{
  const p = at(2);
  assert.equal(p.isActive(0, 0), false);
  const { steps } = feed(p, stepping({ count: 2 }), { ms: 3000 });
  const last = steps.at(-1).t;
  assert.equal(p.isActive(0, last + 100), true);
  assert.equal(p.isActive(0, last + 3900), true);
  assert.equal(p.isActive(0, last + 4100), false);
  assert.equal(p.isActive(1, last + 100), false, 'per foot');
  assert.equal(p.isLive(0, 3000), true);
  assert.equal(p.isLive(0, 3000 + 2000), false);
  assert.equal(p.isLive(1, 3000), false);
}

// 14) 立ったまま長く動かないと、床が立っている圧まで上がる（押しっぱなしの表示にならない）。
//     そこから足を上げて下ろせば、また 1 ふみ
{
  const p = at(2);
  const load = (t) => (t < 500 ? 0 : (t < 12000 ? 700 : (t < 12400 ? 0 : 700)));
  let mid = null;
  for (let t = 0; t < 14000; t += 20) {
    feed(p, load, { from: t, ms: 20, seed: t });
    if (t === 3000) mid = p.load(0);
    if (t === 11500) assert.ok(p.load(0) < 0.1, `standing still relaxes (${p.load(0)})`);
  }
  assert.ok(mid > 0.5);
  assert.ok(p.load(0) > 0.5);
  assert.equal(feed(at(2), load, { ms: 14000 }).steps.length, 2);
}

// 15) ゆっくりした値のずれ（温度など。1 分で合計 +30 ほど）では、いちばん敏感な感度でも数えない
assert.equal(feed(at(5), () => 0, { ms: 60000, drift: 0.08 }).steps.length, 0);

// 16) リザルト用の集計: record = true の間だけためる
{
  const p = at(2);
  const load = stepping({ count: 14 });
  feed(p, load, { ms: 5000 });
  assert.equal(p.summary(0).ok, false, 'nothing is recorded until record is set');
  assert.equal(p.summary(0).ms, 0);
  p.record = true;
  feed(p, load, { from: 5000, ms: 7000 });
  const s = p.summary(0);
  assert.equal(s.ok, true);
  assert.ok(Math.abs(s.share.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(Math.abs(s.fore + s.mid + s.heel - 1) < 1e-9);
  assert.ok(Math.abs(s.heel - 0.48) < 0.05 && Math.abs(s.mid - 0.41) < 0.05 && Math.abs(s.fore - 0.11) < 0.05, JSON.stringify(s));
  assert.ok(s.loadedRatio > 0.35 && s.loadedRatio < 0.65, `loaded about half of the time (${s.loadedRatio})`);
  assert.ok(s.inner >= 0 && s.inner <= 1);
  assert.ok(s.steps >= 8 && s.steps <= 10, `steps ${s.steps}`);
  assert.ok(Math.abs(s.rel - 1) < 0.3);
  assert.equal(p.summary(1).ok, false);
  p.resetStats();
  assert.equal(p.summary(0).ok, false);
}

// 17) 長く途切れたあと（再接続）は作り直す。その人のいつもの押しぐあいは覚えている
{
  const p = at(2);
  feed(p, stepping({ count: 6 }), { ms: 7000 });
  const span = p.feet[0].span;
  const again = feed(p, stepping({ start: 10500, count: 4 }), { from: 10000, ms: 5000 });
  assert.equal(again.steps.length, 4);
  assert.ok(Math.abs(p.feet[0].span - span) < 150);
  p.reset(0);
  assert.equal(p.feet[0].span, null);
  p.reset();
  assert.equal(p.isLive(0, 15000), false);
}

// 18) おかしな入力では何もしない（例外も出さない）
{
  const p = at(2);
  assert.equal(p.push(0, null, 0), null);
  assert.equal(p.push(0, [1, 2, 3], 0), null);
  assert.equal(p.push(0, [220, 220, NaN, 220, 220, 220], 0), null);
  assert.equal(p.push(2, FLOOR, 0), null);
  assert.equal(p.push(0, FLOOR, NaN), null);
  assert.equal(p.feet[0].ready, false);
  assert.equal(p.push(0, new Uint16Array(FLOOR), 0), null, 'typed arrays are accepted');
  assert.equal(p.feet[0].ready, true);
  assert.equal(p.meter(1), 0);
}

// 19) 感度の番号は step-detector.js と同じ 5 段階。右へいくほど小さな立ち上がりで数える
{
  assert.deepEqual(UdonInsolePressure.LEVELS.map(l => l.id), [1, 2, 3, 4, 5]);
  const rises = UdonInsolePressure.LEVELS.map(l => l.rise);
  assert.deepEqual(rises, [...rises].sort((a, b) => b - a));
  assert.equal(UdonInsolePressure.LAYOUT.length, 6);
  assert.equal(at(9).getLevel(), 2, 'an unknown level falls back to the default');
  const p = at(2);
  feed(p, () => 0, { ms: 1000 });
  assert.ok(Math.abs(p.threshold(0) - 0.12 * 1361) < 6, `threshold ${p.threshold(0)}`);
}

// 20) 加速度のふみとまとめる（Fusion）: ゆっくり足を上げ下げすると、加速度だけでは「上げた瞬間」と「着地」の
//     両方を数えてしまう。圧力があれば、着地 1 回につき 1 ふみ
{
  const UdonStepDetector = require(path.join(__dirname, '../examples/GAME-UDON/step-detector.js'));
  const CYCLES = 12, PERIOD = 1600, LIFT = 650;
  // 立っている（圧 600）→ 足を上げる（圧 0、加速度に小さな山）→ 着地（圧 600、加速度に大きな山）
  const phase = (t) => (t < 2000 ? -1 : (t - 2000) % PERIOD);
  const cycle = (t) => Math.floor((t - 2000) / PERIOD);
  const load = (t) => { const u = phase(t); return (u >= 0 && u < LIFT && cycle(t) < CYCLES) ? 0 : 600; };
  const bump = (u, at, width, amp) => (u >= at && u < at + width ? amp * Math.sin(Math.PI * (u - at) / width) : 0);
  const accZ = (t) => {
    const u = phase(t);
    if (u < 0 || cycle(t) >= CYCLES) return 1;
    return 1 + bump(u, 0, 110, 0.9) - bump(u, 120, 110, 0.5) + bump(u, LIFT, 70, 1.6);
  };

  const run = ({ withPressure }) => {
    const detector = new UdonStepDetector();
    const p = at(2);
    const fusion = new UdonInsolePressure.Fusion(p);
    const counted = [];
    const rand = rng(5);
    for (let t = 0; t < 2000 + PERIOD * (CYCLES + 1); t += 20) {
      for (let k = 0; k < 4; k++) {
        const ts = t + k * 5;
        const n = () => (rand() - 0.5) * 0.02;
        const imu = detector.push(0, n(), n(), accZ(ts) + n(), t);
        fusion.track(0, detector.level(0), t);
        if (imu && (!withPressure || fusion.acceptImu(imu, t))) counted.push({ t, source: 'imu', step: imu });
        if (withPressure) {
          const values = FLOOR.map((base, ch) => Math.round(base + SHAPE[ch] * load(ts) + (rand() - 0.5) * 3));
          const ps = p.push(0, values, t);
          if (ps && fusion.acceptPress(ps, t)) counted.push({ t, source: 'press', step: ps });
        }
      }
    }
    return counted;
  };

  const imuOnly = run({ withPressure: false });
  assert.ok(imuOnly.length >= CYCLES * 1.5, `the IMU alone counts lift-offs as well (${imuOnly.length} for ${CYCLES} landings)`);
  const fused = run({ withPressure: true });
  assert.equal(fused.length, CYCLES, `with pressure: one step per landing (${fused.map(c => c.source).join(',')})`);
  assert.ok(fused.every(c => c.source === 'press'));
  // ふみの強さ [G] は、着地の前後の加速度の山から入る
  assert.ok(fused.every(c => c.step.peak > 0.8), `peaks ${fused.map(c => c.step.peak.toFixed(2)).join(' ')}`);
}

// 21) 圧力が反応しないとき（センサに足が当たっていない）は、CORE と同じく加速度のふみを数える。
//     同じ着地を加速度と圧力の両方が見つけたら、1 つにまとめる
{
  const p = at(2);
  const fusion = new UdonInsolePressure.Fusion(p);
  for (let t = 0; t < 3000; t += 20) for (let k = 0; k < 4; k++) p.push(0, FLOOR, t);
  assert.equal(fusion.acceptImu({ foot: 0, t: 3000, peak: 1 }, 3000), true, 'flat pressure → the IMU step counts');
  assert.equal(fusion.acceptImu({ foot: 0, t: 3100, peak: 1 }, 3100), false, 'but not twice within the merge window');
  assert.equal(fusion.acceptImu({ foot: 1, t: 3100, peak: 1 }, 3100), true, 'the other foot is independent');
  assert.equal(fusion.acceptImu({ foot: 0, t: 3400, peak: 1 }, 3400), true);

  // 加速度が先に数えた着地を、直後の圧力のふみで二重に数えない。それ以降は圧力を正とする
  const landing = { foot: 0, t: 3500, source: 'press', peak: 0, rise: 300, rel: 1, fore: 0 };
  assert.equal(fusion.acceptPress(landing, 3500), false);
  feed(p, stepping({ start: 4000, count: 1 }), { from: 3000, ms: 2000 });
  assert.equal(p.isActive(0, 4500), true);
  assert.equal(fusion.acceptImu({ foot: 0, t: 4500, peak: 1 }, 4500), false, 'pressure is counting now → IMU steps are ignored');
  fusion.track(0, 1.3, 5980);
  const next = { foot: 0, t: 6000, source: 'press', peak: 0, rise: 300, rel: 1, fore: 0 };
  assert.equal(fusion.acceptPress(next, 6000), true);
  assert.ok(next.peak > 1.1 && next.peak <= 1.3, `the IMU peak just before the landing (${next.peak})`);
  fusion.track(0, 1.8, 6100);
  assert.equal(next.peak, 1.8, 'and keeps following the peak for a short while');
  fusion.track(0, 2.5, 6400);
  assert.equal(next.peak, 1.8, 'but not after that');
  // 圧力が止まって 4 秒たてば、また加速度で数える
  assert.equal(fusion.acceptImu({ foot: 0, t: 10000, peak: 1 }, 10000), true);
  fusion.reset();
  assert.equal(fusion.acceptPress({ foot: 0, t: 10050, peak: 0 }, 10050), true);
}

// 22) しきい値に届かない小さな山が続いても、「圧力で数えられている」ことにはしない。
//     そうしないと、圧力では数えず、加速度のふみまで止めてしまい、1 ふみも数えられなくなる
{
  const p = at(3);
  const fusion = new UdonInsolePressure.Fusion(p);
  const load = (t) => (t < 1000 ? 0 : 60 * Math.max(0, Math.sin(Math.PI * ((t - 1000) % 1000) / 500)));
  let steps = 0, active = 0, accepted = 0, checks = 0;
  for (let t = 0; t < 12000; t += 20) {
    steps += feed(p, load, { from: t, ms: 20, seed: t }).steps.length;
    if (t >= 1500 && t % 260 === 0) {
      checks++;
      if (p.isActive(0, t)) active++;
      if (fusion.acceptImu({ foot: 0, t, peak: 0.4 }, t)) accepted++;
    }
  }
  assert.equal(steps, 0, 'a 60-count bump is below the level 3 threshold');
  assert.ok(p.missedCount(0, 12000) >= 4, 'but it is remembered for the sensitivity assist');
  assert.equal(active, 0, 'uncounted bumps never make pressure "active"');
  assert.ok(checks >= 30);
  assert.equal(accepted, checks, 'so every IMU step is still accepted');
}

// 23) 数えたふみのあと長く立っていても、足を上げた瞬間は「圧が抜けたところ」として覚えている
//     （その瞬間の加速度は足を上げる動きなので、数えない）
{
  const p = at(2);
  const fusion = new UdonInsolePressure.Fusion(p);
  // 1 秒で着地 → 6 秒間立ったまま → 7 秒で足を上げる
  const load = (t) => (t >= 1000 && t < 7000 ? 800 : 0);
  let landed = null;
  for (let t = 0; t < 8000; t += 20) {
    const r = feed(p, load, { from: t, ms: 20, seed: t });
    if (r.steps.length) landed = r.steps[0].t;
    if (t === 6900) assert.equal(p.isActive(0, t), false, 'long after the landing, pressure is no longer "active"');
  }
  assert.ok(landed >= 1000 && landed < 1200);
  assert.equal(p.isActive(0, 7150), true, 'the lift-off itself is noticed');
  assert.equal(fusion.acceptImu({ foot: 0, t: 7150, peak: 0.9 }, 7150), false, 'so the IMU bump of lifting the foot is not a step');
  assert.equal(p.isActive(0, 7150 + 1300), false);
}

// 24) 同じ着地を加速度が先に数えたとき: ふみは増やさず、押しぐあいは数えたほうのふみに付ける
{
  const p = at(2);
  const fusion = new UdonInsolePressure.Fusion(p);
  const imu = { foot: 1, t: 1000, peak: 1.2 };
  assert.equal(fusion.acceptImu(imu, 1000), true);
  const sole = { foot: 1, t: 1060, source: 'press', peak: 0, rise: 400, rel: 0.9, fore: -0.5 };
  assert.equal(fusion.acceptPress(sole, 1060), false);
  assert.equal(imu.sole, sole);
  assert.equal(sole.peak, 0, 'the merged pressure step is not given an IMU peak of its own');
  // 次の着地は圧力が数える。前の加速度のふみには、もう何も付けない
  const next = { foot: 1, t: 2000, source: 'press', peak: 0, rise: 400, rel: 1, fore: 0 };
  assert.equal(fusion.acceptPress(next, 2000), true);
  const dup = { foot: 1, t: 2050, source: 'press', peak: 0, rise: 100, rel: 0.2, fore: 0 };
  assert.equal(fusion.acceptPress(dup, 2050), false);
  assert.equal(imu.sole, sole);
}

console.log('udon-insole-pressure.test.js passed');
