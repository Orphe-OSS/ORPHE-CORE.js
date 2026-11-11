const assert = require('node:assert/strict');
const path = require('node:path');

// examples/GAME-UDON の「ふみ」検出器を、合成した加速度波形で検証する。
// 実機なしで確認したいのは次の 3 点:
//   - 感度を上げれば、弱い足踏み（高齢の方・座位）でも数えられること
//   - どの感度でも、静止ノイズや量子化ノイズ・反対の足の振動を数えないこと
//   - サンプリングレート（50Hz / 200Hz）や取り付け向きに依存しないこと
const UdonStepDetector = require(path.join(__dirname, '../examples/GAME-UDON/step-detector.js'));

// 再現性のための擬似乱数（mulberry32）
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

function gauss(rand) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * 1 本の足の加速度波形を作る。
 * steps: [{ t: ms, amp: G, widthMs }] … 半正弦波のパルスを重力に重ねる
 */
function makeSignal({ durationMs, fs, gravity = [0, 0, 1], noise = 0.01, steps = [], seed = 1, axis = [0.3, 0.2, 0.93] }) {
  const rand = rng(seed);
  const n = Math.floor(durationMs * fs / 1000);
  const norm = Math.hypot(...axis);
  const ax = axis.map(v => v / norm);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i * 1000 / fs;
    let p = 0;
    for (const s of steps) {
      const w = s.widthMs || 90;
      if (t >= s.t && t <= s.t + w) p += s.amp * Math.sin(Math.PI * (t - s.t) / w);
    }
    out.push({
      t,
      x: gravity[0] + ax[0] * p + gauss(rand) * noise,
      y: gravity[1] + ax[1] * p + gauss(rand) * noise,
      z: gravity[2] + ax[2] * p + gauss(rand) * noise,
    });
  }
  return out;
}

/** 波形を検出器に流す。packet > 1 のときは BLE と同じく複数サンプルを同じ受信時刻で渡す */
function run(det, foot, signal, { packet = 1, withSampleTs = false, t0 = 0 } = {}) {
  const found = [];
  for (let i = 0; i < signal.length; i++) {
    const s = signal[i];
    const arrive = t0 + signal[Math.min(signal.length - 1, (Math.floor(i / packet) + 1) * packet - 1)].t;
    const step = det.push(foot, s.x, s.y, s.z, arrive, withSampleTs ? 5000000 + s.t : undefined);
    if (step) found.push(step);
  }
  return found;
}

function stepTrain(count, intervalMs, amp, startMs = 1000, widthMs = 90) {
  return Array.from({ length: count }, (_, i) => ({ t: startMs + i * intervalMs, amp, widthMs }));
}

// 1) しっかりした足踏みは「ふつう」で全部数えられる（50Hz・サンプル時刻なし＝CORE 2 相当）
{
  const det = new UdonStepDetector();
  det.setLevel(2);
  const sig = makeSignal({ durationMs: 12000, fs: 50, steps: stepTrain(20, 500, 3.0) });
  const found = run(det, 0, sig);
  assert.equal(found.length, 20, 'strong stomps at 2 Hz are all counted');
}

// 2) 弱い足踏み（0.35G）は「しっかり」「ふつう」では届かないが、感度を上げれば数えられる
{
  const gentle = () => makeSignal({ durationMs: 14000, fs: 50, steps: stepTrain(15, 800, 0.35, 1000, 160), seed: 7 });
  const counts = {};
  for (const lv of [1, 2, 3, 4, 5]) {
    const det = new UdonStepDetector();
    det.setLevel(lv);
    counts[lv] = run(det, 0, gentle()).length;
  }
  assert.equal(counts[1], 0, 'firm level ignores gentle steps');
  assert.equal(counts[2], 0, 'normal level ignores gentle steps');
  assert.equal(counts[4], 15, 'softer level counts every gentle step');
  assert.equal(counts[5], 15, 'feather level counts every gentle step exactly once');
}

// 3) かかとの上げ下げ程度（0.14G、ゆっくり）でも「ふわふわ」なら少しずつ進む
{
  const det = new UdonStepDetector();
  det.setLevel(5);
  const sig = makeSignal({ durationMs: 16000, fs: 50, noise: 0.008, steps: stepTrain(12, 1100, 0.16, 1200, 260), seed: 3 });
  assert.equal(run(det, 0, sig).length, 12, 'very gentle heel raises still make progress');
}

// 4) 静止しているだけなら、どの感度でも 0 ふみ
for (const lv of [1, 2, 3, 4, 5]) {
  const det = new UdonStepDetector();
  det.setLevel(lv);
  const sig = makeSignal({ durationMs: 20000, fs: 200, noise: 0.012, seed: 11 + lv });
  assert.equal(run(det, 0, sig, { packet: 4, withSampleTs: true }).length, 0, `no false steps at rest (level ${lv})`);
}

// 5) CORE 2（ヘッダ 40: int8、±16G では 1 LSB = 0.126G）の量子化のちらつきを数えない
{
  const det = new UdonStepDetector();
  det.setLevel(5);
  const rand = rng(99);
  const lsb = 16 / 127;
  const q = v => Math.round(v / lsb) * lsb;
  let count = 0;
  for (let i = 0; i < 50 * 30; i++) {
    // 真値が量子化レベルの中間にあり、ノイズで 1 LSB をまたいで行き来する
    const step = det.push(0, q(0.31 + gauss(rand) * 0.05), q(-0.2 + gauss(rand) * 0.05), q(0.93 + gauss(rand) * 0.05), i * 20);
    if (step) count++;
  }
  assert.equal(count, 0, 'int8 quantisation flicker is not counted even at the most sensitive level');
}

// 6) 200Hz（1 パケット 4 サンプル）でも 50Hz と同じ数になる。サンプル時刻の有無にもよらない
{
  const steps = stepTrain(16, 600, 1.4);
  const base = { durationMs: 12000, steps, seed: 5 };
  const a = new UdonStepDetector(); a.setLevel(2);
  const b = new UdonStepDetector(); b.setLevel(2);
  const c = new UdonStepDetector(); c.setLevel(2);
  assert.equal(run(a, 0, makeSignal({ ...base, fs: 50 })).length, 16);
  assert.equal(run(b, 0, makeSignal({ ...base, fs: 200 }), { packet: 4, withSampleTs: true }).length, 16);
  assert.equal(run(c, 0, makeSignal({ ...base, fs: 200 }), { packet: 4, withSampleTs: false }).length, 16,
    'sample period is estimated when the sensor timestamp is missing');
}

// 7) 取り付け向き（重力の向き）に依存しない
for (const gravity of [[0, 0, 1], [1, 0, 0], [0, -1, 0], [0.6, 0.64, 0.48]]) {
  const det = new UdonStepDetector();
  det.setLevel(3);
  const sig = makeSignal({ durationMs: 9000, fs: 50, gravity, steps: stepTrain(10, 700, 0.9), seed: 21 });
  assert.equal(run(det, 0, sig).length, 10, `orientation independent (gravity ${gravity})`);
}

// 8) 1 回の足踏みで「持ち上げ」と「着地」の 2 山が出ても 1 ふみ
{
  const det = new UdonStepDetector();
  det.setLevel(4);
  const steps = [];
  for (let i = 0; i < 10; i++) {
    steps.push({ t: 1000 + i * 900, amp: 0.4, widthMs: 110 });
    steps.push({ t: 1000 + i * 900 + 190, amp: 0.6, widthMs: 90 });
  }
  const sig = makeSignal({ durationMs: 11000, fs: 50, steps, seed: 31 });
  assert.equal(run(det, 0, sig).length, 10, 'lift + landing bumps of one step are counted once');
}

// 9) 反対の足に伝わった振動（クロストーク）は数えない
{
  const det = new UdonStepDetector();
  det.setLevel(4);
  const stomps = stepTrain(10, 1000, 2.5);
  const echo = stomps.map(s => ({ t: s.t + 30, amp: 0.3, widthMs: 60 }));
  const left = makeSignal({ durationMs: 12000, fs: 50, steps: stomps, seed: 41 });
  const right = makeSignal({ durationMs: 12000, fs: 50, steps: echo, seed: 42 });
  const count = [0, 0];
  for (let i = 0; i < left.length; i++) {
    for (const [foot, sig] of [[0, left], [1, right]]) {
      const s = sig[i];
      if (det.push(foot, s.x, s.y, s.z, s.t)) count[foot]++;
    }
  }
  assert.deepEqual(count, [10, 0], 'floor vibration reaching the other foot is ignored');
}

// 10) 左右交互の足踏みは、それぞれの足で数えられる
{
  const det = new UdonStepDetector();
  det.setLevel(2);
  const left = makeSignal({ durationMs: 12000, fs: 50, steps: stepTrain(10, 1000, 1.5, 1000), seed: 51 });
  const right = makeSignal({ durationMs: 12000, fs: 50, steps: stepTrain(10, 1000, 1.5, 1500), seed: 52 });
  const log = [];
  det.onStep = step => log.push(step);
  for (let i = 0; i < left.length; i++) {
    det.push(0, left[i].x, left[i].y, left[i].z, left[i].t);
    det.push(1, right[i].x, right[i].y, right[i].z, right[i].t);
  }
  assert.equal(log.length, 20);
  assert.equal(log.filter(s => s.foot === 0).length, 10);
  assert.ok(log.every((s, i) => i === 0 || s.foot !== log[i - 1].foot), 'steps alternate L/R');
  const gaps = log.slice(1).map((s, i) => s.t - log[i].t);
  assert.ok(gaps.every(g => Math.abs(g - 500) <= 45), `step timing is preserved (gaps ${gaps.join(',')})`);
}

// 11) 「ふみの強さ」は踏み込みの大きさを反映する
{
  const peakOf = amp => {
    const det = new UdonStepDetector();
    det.setLevel(3);
    const found = run(det, 0, makeSignal({ durationMs: 9000, fs: 200, steps: stepTrain(10, 700, amp), seed: 61 }),
      { packet: 4, withSampleTs: true });
    assert.equal(found.length, 10);
    return found.reduce((a, s) => a + s.peak, 0) / found.length;
  };
  const weak = peakOf(0.6);
  const strong = peakOf(2.4);
  assert.ok(strong > weak * 2.5, `peak scales with stomp strength (${weak.toFixed(2)} → ${strong.toFixed(2)})`);
  assert.ok(Math.abs(strong - 2.4) / 2.4 < 0.35, `peak is close to the true amplitude (${strong.toFixed(2)}G)`);
}

// 12) じどう感度調整: やさしい足踏みから、その人が全部数えられるしきい値を提案する
{
  const sig = makeSignal({ durationMs: 7000, fs: 50, noise: 0.012, steps: stepTrain(8, 750, 0.3, 600, 170), seed: 71 });
  const probe = new UdonStepDetector();
  probe.setLevel(1);
  const cal = new UdonStepDetector.Calibrator();
  for (const s of sig) { probe.push(0, s.x, s.y, s.z, s.t); cal.add(probe.level(0)); }
  const r = cal.result();
  assert.equal(r.ok, true);
  assert.ok(r.threshold > r.noise * 2 && r.threshold < r.strong, `suggested ${r.threshold}G sits between noise and stomp`);
  const det = new UdonStepDetector();
  det.setThreshold(r.threshold);
  const again = makeSignal({ durationMs: 14000, fs: 50, noise: 0.012, steps: stepTrain(15, 800, 0.3, 1000, 170), seed: 72 });
  assert.equal(run(det, 0, again).length, 15, 'calibrated threshold counts every step of the same person');

  // じっとしていたら提案しない
  const still = new UdonStepDetector.Calibrator();
  const quiet = new UdonStepDetector();
  for (const s of makeSignal({ durationMs: 6000, fs: 50, seed: 73 })) { quiet.push(0, s.x, s.y, s.z, s.t); still.add(quiet.level(0)); }
  assert.equal(still.result().ok, false);
  assert.equal(new UdonStepDetector.Calibrator().result().ok, false);
}

// 13) 途切れて再開（再接続・取り付け直し）しても、再開直後に誤って数えない
{
  const det = new UdonStepDetector();
  det.setLevel(5);
  const first = makeSignal({ durationMs: 3000, fs: 50, gravity: [0, 0, 1], seed: 81 });
  const second = makeSignal({ durationMs: 3000, fs: 50, gravity: [1, 0, 0], seed: 82 });
  assert.equal(run(det, 0, first).length, 0);
  assert.equal(run(det, 0, second, { t0: 9000 }).length, 0, 'orientation change across a data gap is not a step');
}

// 14) 強い踏み込みのあとの「余韻」を、感度が高い設定でも 2 回目として数えない
{
  const det = new UdonStepDetector();
  det.setLevel(5);
  const sig = makeSignal({ durationMs: 10000, fs: 200, noise: 0.008, steps: stepTrain(8, 1000, 6.0, 1000, 40), seed: 91 });
  assert.equal(run(det, 0, sig, { packet: 4, withSampleTs: true }).length, 8,
    'a hard stomp does not leave a ghost step behind (gravity estimate is not dragged by impacts)');
}

// 15) ノイズの大きいセンサーでも、静止中は数えない。もっとひどい個体では、しきい値が自動で持ち上がる
{
  const noisy = new UdonStepDetector();
  noisy.setLevel(5);
  // 実際の IMU の 5〜10 倍のノイズ（20 mG rms）
  assert.equal(run(noisy, 0, makeSignal({ durationMs: 60000, fs: 50, noise: 0.02, seed: 95 })).length, 0,
    'a noisy sensor at rest is not counted at the most sensitive level');

  const awful = new UdonStepDetector();
  awful.setLevel(5);
  const ghosts = run(awful, 0, makeSignal({ durationMs: 30000, fs: 50, noise: 0.05, seed: 95 })).length;
  assert.ok(awful.effectiveThreshold(0) > awful.getThreshold() * 1.5, 'effective threshold rises above the noise floor');
  assert.ok(ghosts <= 3, `even a very noisy sensor yields almost no ghost steps (${ghosts} in 30 s)`);
}

// 16) 8 bit のデータ（CORE 2.0）: しきい値は量子化 1 目盛りの 1.8 倍より下がらない。
//     レンジを ±2G にすれば（1 目盛り 0.016G）、やさしい足踏みも数えられる
{
  const quantised = (range, steps) => {
    const lsb = range / 127;
    return makeSignal({ durationMs: 14000, fs: 50, noise: 0.004, steps, seed: 97 })
      .map(s => ({ t: s.t, x: Math.round(s.x / lsb) * lsb, y: Math.round(s.y / lsb) * lsb, z: Math.round(s.z / lsb) * lsb }));
  };
  const coarse = new UdonStepDetector();
  coarse.setLevel(5);
  assert.equal(run(coarse, 0, quantised(16, [])).length, 0);
  run(coarse, 0, quantised(16, stepTrain(4, 900, 0.5)), { t0: 20000 });
  assert.ok(coarse.effectiveThreshold(0) >= (16 / 127) * 1.8 - 1e-9,
    `±16G / 8 bit: threshold is kept above the quantisation step (${coarse.effectiveThreshold(0).toFixed(3)}G)`);

  const fine = new UdonStepDetector();
  fine.setLevel(4);
  assert.equal(run(fine, 0, quantised(2, stepTrain(12, 900, 0.4, 1500, 160))).length, 12,
    '±2G / 8 bit: gentle steps are still counted');
  assert.ok(Math.abs(fine.effectiveThreshold(0) - 0.18) < 1e-9, 'fine quantisation does not raise the threshold');
}

// 17) 動きの形・幅・テンポを変えても、取りこぼしも数えすぎもしない（しきい値の 1.8 倍と 5 倍の動き）
//     uni = 一方向の押し込み / bi = 行って戻る（平均 0）/ tilt = 足の傾き（かかとの上げ下げ）
{
  const train = ({ shape, amp, width, period, fs, n = 40, noise = 0.004, seed = 3 }) => {
    const rand = rng(seed);
    const g = () => gauss(rand) * noise;
    const lead = 1500;
    const thMax = 2 * Math.asin(Math.min(1, amp / 2));
    const out = [];
    for (let i = 0; i < (lead + n * period + 600) * fs / 1000; i++) {
      const t = i * 1000 / fs;
      const k = Math.floor((t - lead) / period);
      const d = t - lead - k * period;
      let p = 0, th = 0;
      if (k >= 0 && k < n && d <= width) {
        if (shape === 'uni') p = amp * Math.sin(Math.PI * d / width);
        else if (shape === 'bi') p = amp * Math.sin(2 * Math.PI * d / width);
        else th = thMax * Math.sin(Math.PI * d / width);
      }
      out.push({ t, x: Math.sin(th) + 0.3 * p + g(), y: g(), z: Math.cos(th) + 0.95 * p + g() });
    }
    return out;
  };
  let cases = 0;
  for (const shape of ['uni', 'bi', 'tilt']) {
    for (const lv of [5, 4, 3, 2]) {
      const thr = UdonStepDetector.levelById(lv).threshold;
      for (const ratio of [1.8, 5]) for (const width of [100, 300]) for (const period of [600, 1100]) for (const fs of [50, 200]) {
        if (shape === 'tilt' && thr * ratio > 1.2) continue;   // 傾きだけで 1.2G を超える動きは作れない
        const det = new UdonStepDetector();
        det.setLevel(lv);
        const sig = train({ shape, amp: thr * ratio, width, period, fs });
        const found = run(det, 0, sig, fs === 200 ? { packet: 4, withSampleTs: true } : {});
        assert.ok(Math.abs(found.length - 40) <= 1,
          `${shape} level ${lv} ×${ratio} width ${width} every ${period}ms @${fs}Hz: counted ${found.length} of 40`);
        // 足が止まれば、重力の推定はすぐ元に戻る（動きに引きずられたままだと、次のふみを数えられなくなる）
        assert.ok(det.level(0) < thr * 0.3, `${shape} level ${lv}: envelope settles after stepping (${det.level(0).toFixed(3)}G)`);
        cases++;
      }
    }
  }
  assert.ok(cases > 150);

  // ノイズが多めのセンサー（12 mG rms）でも、「止まった瞬間」を見つけて重力の推定を戻せる
  for (const fs of [50, 200]) {
    const det = new UdonStepDetector();
    det.setLevel(3);
    const sig = train({ shape: 'uni', amp: 0.8, width: 300, period: 600, fs, noise: 0.012, n: 60 });
    const found = run(det, 0, sig, fs === 200 ? { packet: 4, withSampleTs: true } : {});
    assert.ok(Math.abs(found.length - 60) <= 1, `noisy sensor, long pushes every 600ms @${fs}Hz: counted ${found.length} of 60`);
  }

  // じどう調整も、テンポや動きの幅によらず「その人が数えられる」しきい値を出す
  for (const [shape, amp, width, period] of [['uni', 0.5, 150, 600], ['uni', 0.2, 300, 800], ['bi', 1.5, 100, 600], ['tilt', 0.3, 300, 1100]]) {
    const probe = new UdonStepDetector();
    probe.setLevel(1);
    const cal = new UdonStepDetector.Calibrator();
    for (const s of train({ shape, amp, width, period, fs: 50, n: Math.floor(6000 / period) }).slice(15)) {
      probe.push(0, s.x, s.y, s.z, s.t);
      cal.add(probe.level(0));
    }
    const r = cal.result();
    assert.equal(r.ok, true, `calibration finds ${shape} ${amp}G steps every ${period}ms`);
    const det = new UdonStepDetector();
    det.setThreshold(r.threshold);
    const again = run(det, 0, train({ shape, amp, width, period, fs: 50, seed: 8 })).length;
    assert.ok(Math.abs(again - 40) <= 1, `calibrated ${r.threshold}G counts ${again} of 40 (${shape} ${amp}G every ${period}ms)`);
  }
}

// 18) 速く「バタバタ」ふみつづけても数えられる（実機で見つかった不具合の再発防止）。
//     足が止まる瞬間がなく、動きの大きさがずっとしきい値より上にある。以前は山の半分まで下がらないと
//     次を数え始めなかったので、最初の 1 回しか数えられなかった
{
  const stamping = ({ A, f, kind, fs, secs = 8, seed = 4 }) => {
    const rand = rng(seed);
    const g = () => (rand() - 0.5) * 0.04;
    const lead = 1500, T = 1000 / f;
    const out = [];
    for (let i = 0; i < (lead + secs * 1000 + 300) * fs / 1000; i++) {
      const t = i * 1000 / fs;
      let v = 0, th = 0;
      if (t >= lead && t < lead + secs * 1000) {
        const d = (t - lead) % T, ph = d / T;
        if (kind === 'sine') {
          v = A * Math.sin(2 * Math.PI * ph);                      // なめらかな上下動（座って足をゆする など）
        } else {
          if (d < 35) v += A * Math.sin(Math.PI * d / 35);         // 着地の鋭い衝撃
          v += 0.3 * A * Math.exp(-d / 40) * Math.sin(2 * Math.PI * d / 40);   // そのあとの揺れ
          v -= 0.35 * A * Math.sin(2 * Math.PI * (ph - 0.15));     // 振り上げ・振り下ろし
        }
        th = 0.25 * Math.sin(2 * Math.PI * ph + 1);                // 足の傾き
      }
      out.push({ t, x: Math.sin(th) + 0.3 * v + g(), y: g(), z: Math.cos(th) + 0.95 * v + g() });
    }
    return out;
  };
  for (const kind of ['impact', 'sine']) {
    for (const [lv, A] of [[1, 6], [2, 2], [2, 8], [3, 3], [4, 1]]) {
      for (const f of [1.5, 2.5, 3.5]) for (const fs of [50, 200]) {
        const det = new UdonStepDetector();
        det.setLevel(lv);
        const found = run(det, 0, stamping({ A, f, kind, fs }), fs === 200 ? { packet: 4, withSampleTs: true } : {});
        const cycles = Math.round(8 * f);
        // 1 往復で 1 ふみ。行きと帰りの両方を数えて倍にもならない。
        // （やさしい感度は不応期が長めなので、毎秒 7 ふみ相当の速さでは 6 割以上数えられればよしとする）
        const least = lv >= 4 && f > 3 ? 0.6 : 0.8;
        assert.ok(found.length >= cycles * least && found.length <= cycles * 1.3,
          `fast ${kind} stamping ${A}G at ${f}Hz, level ${lv} @${fs}Hz: counted ${found.length} for ${cycles} cycles`);
      }
    }
  }
  // 速くふんでいる間は不応期が短くなり、ゆっくりに戻れば元の長さに戻る
  assert.equal(UdonStepDetector.DEFAULTS.minRefractoryMs < UdonStepDetector.levelById(2).refractoryMs, true);
}

// 19) 設定値の検証
{
  const det = new UdonStepDetector();
  assert.equal(det.setThreshold(100), UdonStepDetector.MAX_THRESHOLD);
  assert.equal(det.setThreshold(0.0001), UdonStepDetector.MIN_THRESHOLD);
  assert.equal(det.setLevel(999).key, 'normal', 'unknown level falls back to normal');
  assert.ok(UdonStepDetector.refractoryFor(0.1) > UdonStepDetector.refractoryFor(1.2));
  assert.equal(UdonStepDetector.nearestLevel(0.2).key, 'softer');
  const levels = UdonStepDetector.LEVELS.map(l => l.threshold);
  assert.deepEqual(levels, [...levels].sort((a, b) => b - a), 'levels go from firm to gentle');
  assert.equal(det.push(0, NaN, 0, 1, 0), null, 'NaN samples are ignored');
  assert.equal(det.push(2, 0, 0, 1, 0), null, 'unknown foot is ignored');
  assert.equal(det.isLive(0, 1000), false);
  det.push(0, 0, 0, 1, 1000);
  assert.equal(det.isLive(0, 1500), true);
  assert.equal(det.isLive(0, 4000), false);
}

console.log('udon-step-detector.test.js passed');
