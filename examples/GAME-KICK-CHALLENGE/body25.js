/* MediaPipe Pose Landmarker（33 点）→ OpenPose BODY_25 形式への変換と描画定数 */

export const VISIBILITY_THRESHOLD = 0.5;

// BODY_25 index → MediaPipe index（配列は中点、null は MediaPipe に対応点なし）
const BODY25_FROM_MP = [
  0,        // 0  Nose
  [11, 12], // 1  Neck
  12,       // 2  RShoulder
  14,       // 3  RElbow
  16,       // 4  RWrist
  11,       // 5  LShoulder
  13,       // 6  LElbow
  15,       // 7  LWrist
  [23, 24], // 8  MidHip
  24,       // 9  RHip
  26,       // 10 RKnee
  28,       // 11 RAnkle
  23,       // 12 LHip
  25,       // 13 LKnee
  27,       // 14 LAnkle
  5,        // 15 REye
  2,        // 16 LEye
  8,        // 17 REar
  7,        // 18 LEar
  31,       // 19 LBigToe
  null,     // 20 LSmallToe
  29,       // 21 LHeel
  32,       // 22 RBigToe
  null,     // 23 RSmallToe
  30,       // 24 RHeel
];

// OpenPose POSE_BODY_25_PAIRS_RENDER
export const BODY25_PAIRS = [
  [1, 8], [1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [8, 9], [9, 10], [10, 11],
  [8, 12], [12, 13], [13, 14], [1, 0], [0, 15], [15, 17], [0, 16], [16, 18],
  [14, 19], [19, 20], [14, 21], [11, 22], [22, 23], [11, 24],
];

// OpenPose POSE_BODY_25_COLORS_RENDER
export const BODY25_COLORS = [
  [255, 0, 85], [255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0],
  [170, 255, 0], [85, 255, 0], [0, 255, 0], [255, 0, 0], [0, 255, 85],
  [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255],
  [255, 0, 170], [170, 0, 255], [255, 0, 255], [85, 0, 255], [0, 0, 255],
  [0, 0, 255], [0, 0, 255], [0, 255, 255], [0, 255, 255], [0, 255, 255],
];

// 足まわりの BODY_25 index（人物から見た左右）
export const FOOT = {
  L: { knee: 13, ankle: 14, toe: 19, heel: 21 },
  R: { knee: 10, ankle: 11, toe: 22, heel: 24 },
};

export function toBody25(landmarks) {
  return BODY25_FROM_MP.map((src) => {
    if (src === null) return null;
    if (Array.isArray(src)) {
      const a = landmarks[src[0]], b = landmarks[src[1]];
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        v: Math.min(a.visibility ?? 1, b.visibility ?? 1),
      };
    }
    const p = landmarks[src];
    return { x: p.x, y: p.y, v: p.visibility ?? 1 };
  });
}

function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

/**
 * BODY_25 骨格を描画する。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} points - toBody25() の結果
 * @param {(p) => [number, number]} map - 正規化座標 → canvas 座標
 */
export function drawSkeleton(ctx, points, map, limbWidth, jointRadius, alpha = 0.75) {
  const ok = (p) => p && p.v > VISIBILITY_THRESHOLD;
  ctx.lineCap = 'round';
  ctx.lineWidth = limbWidth;
  for (const [a, b] of BODY25_PAIRS) {
    const pa = points[a], pb = points[b];
    if (!ok(pa) || !ok(pb)) continue;
    const [x1, y1] = map(pa), [x2, y2] = map(pb);
    ctx.strokeStyle = rgba(BODY25_COLORS[b], alpha);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  points.forEach((p, i) => {
    if (!ok(p)) return;
    const [x, y] = map(p);
    ctx.fillStyle = rgba(BODY25_COLORS[i], 1);
    ctx.beginPath();
    ctx.arc(x, y, jointRadius, 0, Math.PI * 2);
    ctx.fill();
  });
}
