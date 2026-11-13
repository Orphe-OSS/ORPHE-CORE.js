// analysis.js — turns one runner's race trace into coaching-style feedback:
// six 0-100 axes for a radar chart, an overall score and grade, a stats table
// and a short comment. Pure functions (no DOM), so it can be unit-tested in Node.
//
// These are game metrics meant as training feedback, not medical measurements.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const h = a.length >> 1;
  return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
};
/** 0 at `bad`, 100 at `good` (works in either direction). */
const scale = (v, bad, good) => Math.round(100 * clamp01((v - bad) / (good - bad)));

export const AXES = [
  { key: 'speed', label: 'スピード', en: 'SPEED', weight: 0.25 },
  { key: 'start', label: 'スタート', en: 'START', weight: 0.15 },
  { key: 'hurdle', label: 'ハードリング', en: 'HURDLING', weight: 0.2 },
  { key: 'rhythm', label: 'リズム', en: 'RHYTHM', weight: 0.15 },
  { key: 'pace', label: 'ペース配分', en: 'PACING', weight: 0.15 },
  { key: 'finish', label: '後半の粘り', en: 'FINISH', weight: 0.1 },
];

// The window (seconds before the bar) in which a take-off clears the hurdle,
// from the jump arc: lift >= 0.35 m between 0.081 s and 0.544 s after take-off.
const TAKEOFF_MIN = 0.081, TAKEOFF_MAX = 0.544;
const TAKEOFF_MID = (TAKEOFF_MIN + TAKEOFF_MAX) / 2;
// An interval this many times the runner's usual one counts as a broken rhythm (a hit, a stumble).
const RHYTHM_BREAK = 1.5;

/**
 * run: {
 *   time, dnf, hits, cleared, hurdles (count), topSpeed, staminaLeft, exhaustCount, paceRule (bool),
 *   courseLen, maxSpeed, ignoredJumps (sensor jumps the jump guard ignored),
 *   trace: { firstAccel, hurdles: [{ i, t, hit, speed, tth, gap }], samples: [[t, dist, speed, stamina, pace]], blockedTime },
 *   sensor: null | { steps, cadence, oneFoot, balance, meanPeakG, maxG, toeUpDeg, contactMs, sampleHz, packets, lost },
 * }
 */
export function analyzeRun(run) {
  const { trace } = run;
  const time = run.time;
  const avgSpeed = time > 0 ? run.courseLen / time : 0;
  const hs = trace.hurdles;
  const h1 = hs.length ? hs[0].t : null;
  const splits = [];
  for (let i = 1; i < hs.length; i++) splits.push(hs[i].t - hs[i - 1].t);
  // Rhythm: how even the hurdle-to-hurdle times are. A clipped hurdle makes the next interval two or
  // three times longer, and with std / mean that single interval zeroed the axis (the hit is already
  // paid for under hurdling). So: the spread of the intervals that kept the rhythm (scaled median
  // absolute deviation / median), and a separate count of the intervals that broke it.
  const splitMed = median(splits);
  const cv = splits.length >= 3 && splitMed > 0 ? (1.4826 * median(splits.map((x) => Math.abs(x - splitMed)))) / splitMed : null;
  const brokenSplits = cv == null ? 0 : splits.filter((x) => x > RHYTHM_BREAK * splitMed).length;
  const jumped = hs.filter((h) => h.tth != null);
  const precision = jumped.length ? mean(jumped.map((h) => clamp01(1 - Math.abs(h.tth - TAKEOFF_MID) / ((TAKEOFF_MAX - TAKEOFF_MIN) / 2)))) : 0;
  const meanTth = jumped.length ? mean(jumped.map((h) => h.tth)) : null;
  const meanGap = jumped.length ? mean(jumped.map((h) => h.gap)) : null;
  const cleanRate = run.hurdles ? run.cleared / run.hurdles : 0;

  const s = trace.samples;
  const paceDev = run.paceRule && s.length ? mean(s.map((r) => Math.abs(r[3] - r[4]))) : null;
  const mid = s.filter((r) => r[1] >= 20 && r[1] < 80).map((r) => r[2]);
  const late = s.filter((r) => r[1] >= 80).map((r) => r[2]);
  // Last 30 m against the runner's usual mid-race speed. The median, so that a hit in the middle
  // (a second or two near zero) does not make an ordinary finish look like a strong one.
  const midSpeed = median(mid);
  const finishRatio = late.length && midSpeed > 0 ? mean(late) / midSpeed : null;

  // ---- six axes, 0-100
  const score = {};
  score.speed = scale(avgSpeed, 4.5, 10.5);
  const sReact = trace.firstAccel == null ? 50 : scale(trace.firstAccel, 0.6, 0.15);
  score.start = h1 == null ? Math.round(sReact * 0.4) : Math.round(0.4 * sReact + 0.6 * scale(h1, 4.0, 1.75));
  score.hurdle = Math.round(70 * cleanRate + 30 * precision * cleanRate);
  score.rhythm = cv == null ? 0 : Math.round(scale(cv, 0.25, 0.03) * (1 - brokenSplits / splits.length));
  if (run.paceRule) {
    // off the even pace costs up to 45, each time out of breath 30, stamina left unused up to 25
    score.pace = Math.round(100 * clamp01(1 - 0.45 * clamp01((paceDev ?? 0.3) / 0.3) - 0.3 * run.exhaustCount - 0.25 * run.staminaLeft));
  } else {
    score.pace = time > 0 ? Math.round(100 * clamp01(1 - trace.blockedTime / time)) : 0;
  }
  score.finish = finishRatio == null ? 0 : scale(finishRatio, 0.6, 1.05);
  if (run.dnf) { score.speed = Math.min(score.speed, 20); score.finish = 0; }

  const axes = AXES.map((a) => ({ ...a, score: score[a.key] }));
  const total = Math.round(axes.reduce((sum, a) => sum + a.score * a.weight, 0));
  const grade = total >= 90 ? 'S' : total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D';

  // ---- coaching comment: best axis, weakest axis, one concrete next step
  const sorted = [...axes].sort((a, b) => b.score - a.score);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const tips = {
    speed: 'トップスピードがまだ伸びます。接地を短く、ピッチを上げる意識で。',
    start: trace.firstAccel != null && trace.firstAccel > 0.35
      ? `号砲への反応が ${trace.firstAccel.toFixed(2)} 秒。「SET」で静止して、音に飛び出す練習を。`
      : '最初の1台目までの加速がカギ。スタート直後から大きく足踏みを。',
    hurdle: run.hits > 0
      ? (meanTth != null && meanTth < 0.2 ? '踏み切りが遅れています。スピードに乗ると着地から次のバーまで0.5秒もありません。JUMPサインを待たず、着地と同時につま先を上げるリズムで。' : meanTth != null && meanTth > 0.42 ? '踏み切りが早すぎます。JUMPサインの中ほどまで引きつけて。' : 'ハードル接触でタイムを失っています。JUMPサインを目印に。')
      : (meanTth != null && meanTth < 0.2 ? 'クリアは安定。踏み切りがやや近いので、着地したらすぐ次のつま先上げに入ると余裕が出ます。' : meanTth != null && meanTth > 0.42 ? 'クリアは安定。踏み切りがやや遠いので、もう少し引きつけるとロスが減ります。' : '踏み切り位置は適正です。'),
    rhythm: brokenSplits > 0
      ? `ハードル接触などでリズムが ${brokenSplits} 区間で途切れました。崩れた直後の立て直しがカギです。`
      : 'ハードル間のリズムにばらつきがあります。インターバルを同じテンポで刻む意識を。',
    pace: run.paceRule
      ? (run.exhaustCount > 0 ? '前半で飛ばしすぎて息切れしました。PACE印より左に行かない速度で。' : run.staminaLeft > 0.25 ? `スタミナを ${Math.round(run.staminaLeft * 100)}% 残しました。もっと攻めて、ゴールで使い切りましょう。` : 'ペース配分は良好です。')
      : 'スタミナ切れで加速できない時間がありました。踏みっぱなしにせず、少し休みを入れて。',
    finish: '後半に失速しています。ラスト30mまで足踏みを緩めないスタミナ配分を。',
  };
  const comment = {
    strength: `${best.label}が強み（${best.score}点）。`,
    weakness: worst.score < 80 ? `伸びしろは${worst.label}（${worst.score}点）。` : '大きな弱点はありません。',
    tip: worst.score < 80 ? tips[worst.key] : 'バランスの良い走りです。この調子で自己ベスト更新を狙いましょう。',
  };

  // ---- stats table
  const f = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d));
  const sn = run.sensor;
  const intensity = !sn || sn.cadence == null ? null : sn.cadence >= 220 ? '非常に高い' : sn.cadence >= 180 ? '高い' : sn.cadence >= 140 ? '中程度' : '低め';
  const stats = [
    { group: 'RUN', label: '記録', value: run.dnf ? 'DNF' : `${f(time)} 秒` },
    { group: 'RUN', label: '平均速度', value: `${f(avgSpeed, 1)} m/s（${f(avgSpeed * 3.6, 0)} km/h）` },
    { group: 'RUN', label: '最高速度', value: `${f(run.topSpeed, 1)} m/s` },
    { group: 'RUN', label: '反応時間', value: trace.firstAccel == null ? '—' : `${f(trace.firstAccel)} 秒` },
    { group: 'RUN', label: '1台目まで', value: h1 == null ? '—' : `${f(h1)} 秒` },
    { group: 'HURDLE', label: 'クリア / 接触', value: `${run.cleared} / ${run.hits}` },
    { group: 'HURDLE', label: 'ハードル間タイム', value: splits.length ? `平均 ${f(mean(splits))} 秒` : '—' },
    { group: 'HURDLE', label: 'リズムのばらつき', value: cv == null ? '—' : `${f(cv * 100, 1)} %${brokenSplits ? `（乱れ ${brokenSplits} 区間）` : ''}` },
    { group: 'HURDLE', label: '踏み切り位置', value: meanGap == null ? '—' : `ハードルの ${f(meanGap, 1)} m 手前` },
    { group: 'HURDLE', label: '踏み切りタイミング', value: meanTth == null ? '—' : meanTth < 0.2 ? '近め（遅い）' : meanTth > 0.42 ? '遠め（早い）' : '適正' },
    ...(run.heldJumps ? [{ group: 'HURDLE', label: '踏み切り補助', value: `${run.heldJumps} 回（早すぎたつま先上げを踏み切り位置まで待って跳んだ）` }] : []),
    ...(run.ignoredJumps ? [{ group: 'HURDLE', label: '誤ジャンプ防止', value: `${run.ignoredJumps} 回（ハードルが遠い位置でのつま先上げ）` }] : []),
    { group: 'BODY', label: 'スタミナ残', value: `${Math.round(run.staminaLeft * 100)} %${run.exhaustCount ? `（息切れ ${run.exhaustCount} 回）` : ''}` },
    { group: 'BODY', label: 'ピッチ', value: sn?.cadence == null ? '—' : `${f(sn.cadence, 0)} 歩/分${sn.oneFoot ? '（片足×2）' : ''}` },
    { group: 'BODY', label: '歩数', value: sn ? `${sn.steps} 歩${sn.oneFoot ? '（片足）' : ''}` : '—' },
    { group: 'BODY', label: '左右バランス', value: sn?.balance == null ? '—' : `左 ${Math.round(sn.balance * 100)} : 右 ${Math.round((1 - sn.balance) * 100)}` },
    { group: 'BODY', label: '足の加速度', value: sn ? `平均ピーク ${f(sn.meanPeakG, 1)} G / 最大 ${f(sn.maxG, 1)} G` : '—' },
    ...(sn?.contactMs != null ? [{ group: 'BODY', label: '接地時間', value: `中央値 ${f(sn.contactMs, 0)} ms（圧力センサー）` }] : []),
    { group: 'BODY', label: 'つま先上げ角度', value: sn?.toeUpDeg == null ? '—' : `平均 ${f(sn.toeUpDeg, 0)}°` },
    { group: 'BODY', label: '運動強度（目安）', value: intensity ?? '—' },
    { group: 'SENSOR', label: 'センサー受信', value: sn ? `${f(sn.sampleHz, 0)} Hz / 欠落 ${sn.lost}` : '未接続（キーボード）' },
  ];

  return {
    axes, total, grade, comment, stats,
    splits: hs.map((h, i) => ({ i: h.i, hit: h.hit, t: h.t, split: i === 0 ? h.t : h.t - hs[i - 1].t, speed: h.speed, tth: h.tth })),
    metrics: { avgSpeed, h1, cv, brokenSplits, meanTth, meanGap, paceDev, finishRatio, reaction: trace.firstAccel },
  };
}
