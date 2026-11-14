/* OpenPose スタイルの姿勢推定
 * 推定エンジンは MediaPipe Pose Landmarker（ブラウザで動作）。
 * 33 点のランドマークを OpenPose BODY_25 形式に変換し、OpenPose 配色で描画する。
 * 白背景ではステージ（16:9）を縦長 8:9 の 2 枚に分け、左にボーン、右に実写を並べる。カメラ重ねでは 16:9 の 1 枚に重ねる。
 */
import { PoseLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { SessionRecorder, bindRecButton } from './recorder.js';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
};
const MODEL = 'full';  // 姿勢推定モデル（標準）
const NUM_POSES = 2;
const VISIBILITY_THRESHOLD = 0.5;

// ---------- OpenPose BODY_25 ----------
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
const BODY25_PAIRS = [
  [1, 8], [1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [8, 9], [9, 10], [10, 11],
  [8, 12], [12, 13], [13, 14], [1, 0], [0, 15], [15, 17], [0, 16], [16, 18],
  [14, 19], [19, 20], [14, 21], [11, 22], [22, 23], [11, 24],
];

// OpenPose POSE_BODY_25_COLORS_RENDER
const BODY25_COLORS = [
  [255, 0, 85], [255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0],
  [170, 255, 0], [85, 255, 0], [0, 255, 0], [255, 0, 0], [0, 255, 85],
  [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255],
  [255, 0, 170], [170, 0, 255], [255, 0, 255], [85, 0, 255], [0, 0, 255],
  [0, 0, 255], [0, 0, 255], [0, 255, 255], [0, 255, 255], [0, 255, 255],
];

const ANKLE_INDEX = { L: 14, R: 11 };

function toBody25(landmarks) {
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

// ---------- 関節角度（3D ワールド座標） ----------
const ANGLE_DEFS = {
  lknee: [23, 25, 27], rknee: [24, 26, 28],
  lhip: [11, 23, 25], rhip: [12, 24, 26],
  lankle: [25, 27, 31], rankle: [26, 28, 32],
  lelbow: [11, 13, 15], relbow: [12, 14, 16],
};
const angleEls = Object.fromEntries(Object.keys(ANGLE_DEFS).map((k) => [k, document.querySelector(`#ang_${k}`)]));
const angleSmoothed = {};

function jointAngle(a, b, c) {
  const v1 = [a.x - b.x, a.y - b.y, a.z - b.z];
  const v2 = [c.x - b.x, c.y - b.y, c.z - b.z];
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const n = Math.hypot(...v1) * Math.hypot(...v2);
  if (n === 0) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot / n))) * 180 / Math.PI;
}

function updateAngles(world, image) {
  for (const [key, [ia, ib, ic]] of Object.entries(ANGLE_DEFS)) {
    let text = '-';
    if (world && image && [ia, ib, ic].every((i) => (image[i].visibility ?? 1) > VISIBILITY_THRESHOLD)) {
      const deg = jointAngle(world[ia], world[ib], world[ic]);
      if (deg !== null) {
        angleSmoothed[key] = angleSmoothed[key] == null ? deg : angleSmoothed[key] * 0.6 + deg * 0.4;
        text = `${angleSmoothed[key].toFixed(0)}°`;
      }
    } else {
      angleSmoothed[key] = null;
    }
    if (angleEls[key].textContent !== text) angleEls[key].textContent = text;
  }
}

// ---------- DOM ----------
const stage = document.querySelector('#stage');
const canvas = document.querySelector('#pose_canvas');
const ctx = canvas.getContext('2d');
const video = document.createElement('video');
video.playsInline = true;
video.muted = true;
const btnCamera = document.querySelector('#btn_camera');
const selCamera = document.querySelector('#sel_camera');
const chkMirror = document.querySelector('#chk_mirror');
const btnSnapshot = document.querySelector('#btn_snapshot');
const stageMessage = document.querySelector('#stage_message');
const statusModel = document.querySelector('#status_model');
const statusFps = document.querySelector('#status_fps');
const statusPeople = document.querySelector('#status_people');

let landmarker = null;
let loadingModel = null;
let stream = null;
let running = false;
let lastVideoTime = -1;
let lastResult = null;
let fpsFrames = 0;
let fpsSince = performance.now();

function background() {
  return document.querySelector('input[name="bg"]:checked').value;
}

function setMessage(text, icon = 'bi-camera-video') {
  if (!text) { stageMessage.style.display = 'none'; return; }
  stageMessage.style.display = 'flex';
  stageMessage.innerHTML = `<i class="bi ${icon}"></i><p>${text}</p>`;
}

// ---------- モデル ----------
async function loadModel(kind) {
  statusModel.textContent = `model: ${kind} loading…`;
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL[kind], delegate },
    runningMode: 'VIDEO',
    numPoses: NUM_POSES,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  let lm;
  try {
    lm = await PoseLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (e) {
    console.warn('GPU delegate unavailable, falling back to CPU', e);
    lm = await PoseLandmarker.createFromOptions(fileset, options('CPU'));
  }
  if (landmarker) landmarker.close();
  landmarker = lm;
  lastVideoTime = -1;
  statusModel.textContent = `model: ${kind}`;
}

function ensureModel() {
  if (!loadingModel) {
    loadingModel = loadModel(MODEL).finally(() => { loadingModel = null; });
  }
  return loadingModel;
}

// ---------- カメラ ----------
async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((d) => d.kind === 'videoinput');
  const current = selCamera.value;
  selCamera.innerHTML = '';
  cams.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || `Camera ${i + 1}`;
    selCamera.appendChild(opt);
  });
  if (current && cams.some((d) => d.deviceId === current)) selCamera.value = current;
}

async function startCamera() {
  stopCamera();
  setMessage('カメラを起動しています…');
  // 縦長に切り出して表示するので、なるべく高解像度で取得する
  const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: selCamera.value ? { deviceId: { exact: selCamera.value }, ...size } : size,
  });
  video.srcObject = stream;
  await video.play();
  await listCameras();
  const track = stream.getVideoTracks()[0];
  const id = track.getSettings().deviceId;
  if (id) selCamera.value = id;

  setMessage('モデルを読み込んでいます…', 'bi-hourglass-split');
  await (landmarker ? Promise.resolve() : ensureModel());
  setMessage('');
  running = true;
  btnCamera.innerHTML = '<i class="bi bi-stop-circle"></i> カメラ停止';
  btnCamera.classList.replace('btn-dark', 'btn-outline-dark');
}

function stopCamera() {
  running = false;
  lastResult = null;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  btnCamera.innerHTML = '<i class="bi bi-camera-video"></i> カメラ開始';
  btnCamera.classList.replace('btn-outline-dark', 'btn-dark');
}

// ---------- 表示範囲（横移動のみ） ----------
// 映像は常に高さいっぱいに表示し（拡大縮小しない）、横位置だけを人物に合わせて動かす。
// 白背景のときは縦長 8:9 の 2 枚（左: ボーン / 右: 実写）が同じ範囲を映し、
// カメラ重ねのときは 16:9 の 1 枚に実写とボーンを重ねる。
// 手足の動きで揺れないよう腰の中心を追い、中央付近（デッドゾーン）では動かさず、時間ベースでなめらかに動かす。
const PAN_DEADZONE = 0.12;  // 表示幅に対する割合。腰がこの範囲内ならほとんど動かさない
const PAN_SPEED = 3;        // 追従の速さ [1/s]
const PAN_RECENTER_SPEED = 0.4; // デッドゾーン内で中央に寄せる速さ [1/s]
const crop = { cx: 0.5, w: 1, init: false, last: 0 };

function videoAspect() {
  return video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
}

function dispX(p) {
  return chkMirror.checked ? 1 - p.x : p.x;
}

// viewW: 映像を表示する幅（px）。高さは H で固定
function updateCrop(viewW, H) {
  const now = performance.now();
  const dt = crop.last ? Math.min(0.1, (now - crop.last) / 1000) : 0;
  crop.last = now;
  const w = (viewW / H) / videoAspect(); // 表示幅（映像の幅に対する割合）。1 を超えるときは左右に余白
  crop.w = w;
  if (w >= 1) { crop.cx = 0.5; crop.init = true; return; }

  let goal = crop.init ? crop.cx : 0.5;
  let speed = PAN_SPEED;
  const pts = lastResult?.landmarks?.[0];
  if (pts) {
    const hips = [pts[23], pts[24]].filter((p) => (p.visibility ?? 1) > VISIBILITY_THRESHOLD);
    if (hips.length) {
      const hx = hips.reduce((a, p) => a + dispX(p), 0) / hips.length;
      goal = hx;
      // デッドゾーン内ではごくゆっくり中央に寄せるだけにする（細かい揺れでは動かない）
      if (Math.abs(hx - crop.cx) <= w * PAN_DEADZONE) speed = PAN_RECENTER_SPEED;
    }
  }
  goal = Math.max(w / 2, Math.min(1 - w / 2, goal));
  crop.cx = crop.init ? crop.cx + (goal - crop.cx) * (1 - Math.exp(-dt * speed)) : goal;
  crop.cx = Math.max(w / 2, Math.min(1 - w / 2, crop.cx));
  crop.init = true;
}

// ---------- 描画 ----------
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  // 常に 16:9 でステージ中央に収める（全画面でも比率を保つ）
  const sw = stage.clientWidth, sh = stage.clientHeight;
  let cw = sw, ch = sw * 9 / 16;
  if (ch > sh) { ch = sh; cw = sh * 16 / 9; }
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  const w = Math.round(cw * dpr);
  const h = Math.round(ch * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function drawSkeleton(points, map, unit) {
  const limbWidth = Math.max(4, unit * 0.016);
  const jointRadius = Math.max(3, unit * 0.011);
  const ok = (p) => p && p.v > VISIBILITY_THRESHOLD;

  ctx.lineCap = 'round';
  for (const [a, b] of BODY25_PAIRS) {
    const pa = points[a], pb = points[b];
    if (!ok(pa) || !ok(pb)) continue;
    const [x1, y1] = map(pa), [x2, y2] = map(pb);
    ctx.strokeStyle = rgba(BODY25_COLORS[b], 0.75);
    ctx.lineWidth = limbWidth;
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

// ORPHE CORE の状態を足首に重ねる（1人目のみ）
function drawCoreOverlay(points, map, unit, now) {
  const states = window.orpheState || [];
  for (const s of states) {
    if (!s.connected) continue;
    const ankle = points[ANKLE_INDEX[s.side]];
    if (!ankle || ankle.v < VISIBILITY_THRESHOLD) continue;
    const [x, y] = map(ankle);

    const dt = now - s.lastStepAt;
    if (dt < 600) {
      const t = dt / 600;
      ctx.strokeStyle = `rgba(255,45,85,${1 - t})`;
      ctx.lineWidth = Math.max(2, unit * 0.006);
      ctx.beginPath();
      ctx.arc(x, y, unit * (0.02 + 0.06 * t), 0, Math.PI * 2);
      ctx.stroke();
    }

    const label = `CORE 0${s.id + 1}`;
    ctx.font = `600 ${Math.max(10, unit * 0.022)}px ui-monospace, Menlo, monospace`;
    const tw = ctx.measureText(label).width;
    const pad = 4, lh = Math.max(10, unit * 0.022) + pad * 2;
    const lx = x - tw / 2 - pad, ly = y + unit * 0.035;
    ctx.fillStyle = 'rgba(29,35,48,0.85)';
    ctx.beginPath();
    ctx.roundRect(lx, ly, tw + pad * 2, lh, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx + pad, ly + lh / 2);
  }
}

// 表示範囲の映像を (x0, 0, pw, H) に描く。映像が表示幅より狭いときは左右を空ける
function drawVideoCrop(x0, pw, H) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const left = crop.cx - crop.w / 2;
  const u0 = Math.max(0, left), u1 = Math.min(1, left + crop.w);
  const d0 = x0 + (u0 - left) / crop.w * pw, d1 = x0 + (u1 - left) / crop.w * pw;
  const srcX = (chkMirror.checked ? 1 - u1 : u0) * vw;
  ctx.save();
  if (chkMirror.checked) {
    ctx.translate(d0 + d1, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, srcX, 0, (u1 - u0) * vw, vh, d0, 0, d1 - d0, H);
  ctx.restore();
}

function drawPeople(map, unit, now) {
  if (!lastResult || !lastResult.landmarks) return;
  lastResult.landmarks.forEach((lm, i) => {
    const pts = toBody25(lm);
    drawSkeleton(pts, map, unit);
    if (i === 0) drawCoreOverlay(pts, map, unit, now);
  });
}

function render(now) {
  resizeCanvas();
  const W = canvas.width, H = canvas.height;
  const hasVideo = running && video.readyState >= 2;
  const unified = background() === 'camera';
  // カメラ重ねは 16:9 の 1 枚、白背景は 8:9 の 2 枚
  const pw = unified ? W : W / 2;
  const unit = Math.min(pw, H);
  updateCrop(pw, H);
  const map = (p) => [(dispX(p) - (crop.cx - crop.w / 2)) / crop.w * pw, p.y * H];

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (unified) {
    if (hasVideo) drawVideoCrop(0, W, H);
    drawPeople(map, unit, now);
    return;
  }

  // 左: ボーン
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, pw, H);
  ctx.clip();
  drawPeople(map, unit, now);
  ctx.restore();

  // 右: 実写
  if (hasVideo) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pw, 0, pw, H);
    ctx.clip();
    drawVideoCrop(pw, pw, H);
    ctx.restore();
  } else {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(pw, 0, pw, H);
  }
}

// ---------- 記録 ----------
const recorder = new SessionRecorder({
  name: 'pose',
  canvas,
  getCameraStream: () => stream,
  getMeta: () => ({
    mirror: chkMirror.checked,
    model: MODEL,
    background: background(),
    canvas: { width: canvas.width, height: canvas.height, layout: background() === 'camera' ? 'camera + bones (16:9)' : 'left: bones / right: camera (8:9 each)' },
    camera: { width: video.videoWidth, height: video.videoHeight, label: selCamera.selectedOptions[0]?.textContent || '' },
    crop: { ...crop },
    cores: (window.orpheState || []).map((s) => ({
      id: s.id + 1, side: s.side, name: s.name, connected: s.connected,
      device_information: window.bles?.[s.id]?.device_information ?? null,
    })),
  }),
});
window.orpheSampleListeners.push((id, s) => recorder.addCoreSample(id, s));
window.orpheEventListeners.push((id, type, data) => recorder.addEvent('core', type, { core: id + 1, ...data }));
bindRecButton(recorder, document.querySelector('#btn_rec'), document.querySelector('#rec_indicator'));

function loop() {
  const now = performance.now();
  if (running && landmarker && !loadingModel && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    lastResult = landmarker.detectForVideo(video, now);
    recorder.addPose(lastResult);
    const people = lastResult.landmarks?.length ?? 0;
    statusPeople.textContent = `${people} 人`;
    updateAngles(lastResult.worldLandmarks?.[0], lastResult.landmarks?.[0]);
    fpsFrames++;
  }
  if (now - fpsSince >= 1000) {
    statusFps.textContent = `${Math.round(fpsFrames * 1000 / (now - fpsSince))} fps`;
    fpsFrames = 0;
    fpsSince = now;
  }
  render(now);
  requestAnimationFrame(loop);
}

// ---------- イベント ----------
btnCamera.addEventListener('click', async () => {
  if (running) { stopCamera(); setMessage('「カメラ開始」を押すと姿勢推定を始めます'); return; }
  try {
    await startCamera();
  } catch (e) {
    console.error(e);
    stopCamera();
    setMessage(`カメラを開始できませんでした: ${e.message || e.name}`, 'bi-exclamation-triangle');
  }
});

selCamera.addEventListener('change', () => { if (running) startCamera().catch(console.error); });

btnSnapshot.addEventListener('click', () => {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pose_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
});

document.querySelector('#btn_fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else stage.requestFullscreen?.();
});

if (navigator.mediaDevices?.enumerateDevices) listCameras().catch(() => {});
requestAnimationFrame(loop);
