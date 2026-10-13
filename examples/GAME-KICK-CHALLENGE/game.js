/* キックチャレンジ
 * - ステージ（16:9）を縦長 8:9 の 2 枚に分け、左はゲーム画面、右は足元を映した実写
 * - 左のゲーム画面は、正面から撮った姿勢を奥行き反転して「後ろから見た」3D ビューで描く。
 *   プレイヤーの向き（つま先）とボールが来る方向・蹴り返す方向がそろう
 * - 右足を上げるとゲーム開始（ボタンでも可）。足元のズーム位置は開始時の立ち位置で固定する
 * - 足のボーンには靴の形を重ねて、自分の足の位置を分かりやすくする
 * - ボールは正面の奥から跳ねながら近づき、円の位置でミートして手前へ転がり抜ける。
 *   円とミート時のボールの大きさはゲーム中ずっと同じ（位置だけが変わる）
 * - 足（靴）を円に合わせて正面へ蹴り返す。外れていたら「位置ずれ」で失敗
 * - 失敗したキックは左右に曲がって飛んでいく
 * - 判定は ORPHE CORE の加速度ピーク |acc| [G]
 *     弱く蹴って: ピーク <= ゲージ で成功（超えたら失敗）
 *     強く蹴って: ピーク >  ゲージ で成功（届かなければ失敗）
 */
import { PoseLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { VISIBILITY_THRESHOLD, FOOT, toBody25, drawSkeleton } from './body25.js';
import { SessionRecorder, bindRecButton } from './recorder.js';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
};

const MODEL = 'full';  // 姿勢推定モデル（標準）
const ROUNDS = 10;
const GAUGE_MAX = 12;        // ゲージ上端 [G]
const PEAK_WINDOW_MS = 200;  // 検出開始からピークを探す時間
const KICK_COOLDOWN_MS = 500;
const READY_MS = 1100;       // ボールが足元に来てから転がり抜けるまでの時間
const EARLY_KICK_T = 0.95;   // 飛来中でもこの進行度以降（着地直前）なら蹴ってよい
const RESULT_MS = 1400;

const COLOR = {
  text: '#1d2330',
  weak: '#3e63dd',
  strong: '#e5484d',
  ok: '#18a058',
  ng: '#e5484d',
};
const SIDE_LABEL = { L: '左足', R: '右足' };
const FONT = '"Hiragino Sans", "Noto Sans JP", "Helvetica Neue", sans-serif';

// ---------- DOM ----------
const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const canvas = $('#game_canvas');
const ctx = canvas.getContext('2d');
const video = document.createElement('video');
video.playsInline = true;
video.muted = true;

const btnCamera = $('#btn_camera');
const selCamera = $('#sel_camera');
const chkMirror = $('#chk_mirror');
const chkSound = $('#chk_sound');
const btnFullscreen = $('#btn_fullscreen');
const btnGame = $('#btn_game');
const rngThreshold = $('#rng_threshold');
const rngTrigger = $('#rng_trigger');
const lblThreshold = $('#lbl_threshold');
const lblTrigger = $('#lbl_trigger');
const stageMessage = $('#stage_message');

const threshold = () => parseFloat(rngThreshold.value);
const triggerG = () => parseFloat(rngTrigger.value);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- サウンド ----------
let audio = null;
function initAudio() {
  if (!audio) {
    try { audio = new AudioContext(); } catch { audio = null; }
  }
  audio?.resume();
}
function tone(freq, dur, { type = 'sine', gain = 0.15, to = null, delay = 0 } = {}) {
  if (!audio || !chkSound.checked) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur);
}
const sfx = {
  bounce: () => tone(180, 0.08, { gain: 0.12, to: 90 }),
  kick: (p) => tone(140 + p * 20, 0.15, { type: 'triangle', gain: 0.35, to: 60 }),
  ok: () => { tone(660, 0.12, { gain: 0.12 }); tone(990, 0.2, { gain: 0.12, delay: 0.1 }); },
  ng: () => tone(220, 0.35, { type: 'sawtooth', gain: 0.08, to: 110 }),
  start: () => { tone(523, 0.1); tone(659, 0.1, { delay: 0.1 }); tone(784, 0.2, { delay: 0.2 }); },
};

// ---------- 姿勢推定 ----------
let landmarker = null;
let loadingModel = null;
let stream = null;
let cameraOn = false;
let lastVideoTime = -1;
let people = [];     // BODY_25 の配列（人数分、画像座標）
let poseImage = null; // MediaPipe landmarks[0]（画像座標）
let poseWorld = null; // MediaPipe worldLandmarks[0]（腰が原点、m）
let poseFps = 0;
let fpsFrames = 0;
let fpsSince = performance.now();

async function loadModel(kind) {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL[kind], delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
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
}

function ensureModel() {
  if (!loadingModel) {
    loadingModel = loadModel(MODEL).finally(() => { loadingModel = null; });
  }
  return loadingModel;
}

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

function setMessage(text, icon = 'bi-camera-video') {
  if (!text) { stageMessage.style.display = 'none'; return; }
  stageMessage.style.display = 'flex';
  stageMessage.innerHTML = `<i class="bi ${icon}"></i><p>${text}</p>`;
}

async function startCamera() {
  stopCamera();
  setMessage('カメラを起動しています…');
  // 足元をデジタルズームするので、なるべく高解像度で取得する
  const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: selCamera.value ? { deviceId: { exact: selCamera.value }, ...size } : size,
  });
  video.srcObject = stream;
  await video.play();
  await listCameras();
  const id = stream.getVideoTracks()[0].getSettings().deviceId;
  if (id) selCamera.value = id;

  setMessage('モデルを読み込んでいます…', 'bi-hourglass-split');
  if (!landmarker) await ensureModel();
  setMessage('');
  cameraOn = true;
  btnCamera.innerHTML = '<i class="bi bi-stop-circle"></i> カメラ停止';
  btnCamera.classList.replace('btn-dark', 'btn-outline-dark');
}

function stopCamera() {
  cameraOn = false;
  people = [];
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  btnCamera.innerHTML = '<i class="bi bi-camera-video"></i> カメラ開始';
  btnCamera.classList.replace('btn-outline-dark', 'btn-dark');
}

function detectPose(now) {
  if (!cameraOn || !landmarker || loadingModel || video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  const result = landmarker.detectForVideo(video, now);
  people = (result.landmarks || []).map(toBody25);
  poseImage = result.landmarks?.[0] || null;
  poseWorld = result.worldLandmarks?.[0] || null;
  updateWorld();
  recorder?.addPose(result);
  fpsFrames++;
}

// ---------- 足元ズーム ----------
// crop は「表示座標（ミラー反映後）」の正規化座標。w は canvas のアスペクトから決まる
const crop = { cx: 0.5, cy: 0.7, h: 0.6, init: false, locked: false };
let W = 0, H = 0;

function videoAspect() {
  return video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
}
function cropW() {
  return crop.h * (W / H) / videoAspect();
}
function dispX(p) {
  return chkMirror.checked ? 1 - p.x : p.x;
}

function updateCrop() {
  if (crop.locked) return; // ゲーム中は最初の立ち位置で固定
  const kAspect = (W / H) / videoAspect(); // crop.w = crop.h * kAspect
  const pts = people[0];
  const feet = pts ? [11, 14, 19, 21, 22, 24].map((i) => pts[i]).filter((p) => p && p.v > VISIBILITY_THRESHOLD) : [];
  let target;
  if (feet.length >= 2) {
    const xs = feet.map(dispX), ys = feet.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const h = Math.max((maxY - minY) * 3, ((maxX - minX) * 1.7) / kAspect, 0.25);
    // 足が画面の下 70% あたりに来るよう、切り出し中心を上にずらす
    target = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 - h * 0.2, h };
  } else {
    target = { cx: 0.5, cy: 0.72, h: 0.56 };
  }
  target.h = Math.min(target.h, 1, 1 / kAspect);
  const w = target.h * kAspect;
  target.cx = clamp(target.cx, w / 2, 1 - w / 2);
  target.cy = clamp(target.cy, target.h / 2, 1 - target.h / 2);

  const k = crop.init ? 0.12 : 1;
  crop.cx = lerp(crop.cx, target.cx, k);
  crop.cy = lerp(crop.cy, target.cy, k);
  crop.h = lerp(crop.h, target.h, k);
  crop.init = true;
}

// ---------- 後ろから見た 3D ビュー（左パネル） ----------
// カメラは正面から撮っているが、左パネルはプレイヤーを「後ろから」見た向きで描く。
// 世界座標（m）: X = 画面右（プレイヤーの右）、Y = 上、Z = 前（プレイヤーが向いている方向 = 画面の奥）、床は Y = 0。
// MediaPipe のワールド座標（腰が原点、x = 画像の右、y = 下、z = 小さいほどカメラに近い）を (-x, -y, -z) にすると
// 奥行きが反転して後ろ向きになり、左右も「自分の右 = 画面の右」になる。これを後ろ斜め上の仮想カメラから透視投影する。
// 奥行き（前後の位置）はカメラ 1 台では正確に分からないので、ゲームの判定には画面上の横位置だけを使う。
const VIEW = {
  camHeight: 0.9,             // 仮想カメラの高さ [m]
  camBack: 0.9,               // 足元から後ろへの距離 [m]
  pitch: 30 * Math.PI / 180,  // 見下ろす角度
  horizonV: 0.3,              // 地平線（ボールが出てくる高さ）の画面比
  homeV: 0.72,                // 足元（Z = 0 の床）の画面比
};
const BALL_R = 0.12;            // ボールの半径 [m]
const TARGET_R = BALL_R * 1.8;  // ミート位置の円の半径 [m]
const MP_FOOT = { L: { ankle: 27, heel: 29, toe: 31 }, R: { ankle: 28, heel: 30, toe: 32 } };
const view = { camX: 0, f: 1, cy: 0, locked: false, init: false };
let world = null;     // 33 点の世界座標（平滑化済み）{ x, y, z, v }
let viewPts = null;   // 左パネル用 BODY_25（パネルに対する正規化座標）
let legScale = null;  // 画像上の脚の長さ / 実際の脚の長さ（画像の横移動を m に直す）
let rootX = 0;        // 腰の横位置 [m]（カメラ画像の中央が 0）

function updateProjection() {
  const s = Math.sin(VIEW.pitch), c = Math.cos(VIEW.pitch);
  const dy = -VIEW.camHeight, dz = VIEW.camBack;
  const yc = dy * c + dz * s, zc = -dy * s + dz * c;
  view.f = (VIEW.homeV - VIEW.horizonV) * H / (Math.tan(VIEW.pitch) - yc / zc);
  view.cy = VIEW.horizonV * H + view.f * Math.tan(VIEW.pitch);
}

// 世界座標 → 左パネルの px。s は 1 m がその奥行きで何 px に見えるか
function project(x, y, z) {
  const sn = Math.sin(VIEW.pitch), cs = Math.cos(VIEW.pitch);
  const dx = x - view.camX, dy = y - VIEW.camHeight, dz = z + VIEW.camBack;
  const yc = dy * cs + dz * sn;
  const zc = Math.max(0.05, -dy * sn + dz * cs);
  return { x: W / 2 + view.f * dx / zc, y: view.cy - view.f * yc / zc, s: view.f / zc };
}

// MediaPipe の結果から世界座標を作る（推定のたびに呼ぶ）
function updateWorld() {
  if (!poseWorld || !poseImage) { world = null; return; }
  const aspect = videoAspect();
  const img = (i) => ({ x: poseImage[i].x * aspect, y: poseImage[i].y });
  const imgLeg = (i, j) => Math.hypot(img(i).x - img(j).x, img(i).y - img(j).y);
  const wLeg = (i, j) => Math.hypot(poseWorld[i].x - poseWorld[j].x, poseWorld[i].y - poseWorld[j].y, poseWorld[i].z - poseWorld[j].z);
  const il = (imgLeg(23, 27) + imgLeg(24, 28)) / 2;
  const wl = (wLeg(23, 27) + wLeg(24, 28)) / 2;
  if (il > 0.01 && wl > 0.1) legScale = legScale ? lerp(legScale, il / wl, 0.1) : il / wl;
  // 画像上の腰の横位置 → 世界の X（画像の右 = プレイヤーの左 なので符号を反転）
  const hipU = (img(23).x + img(24).x) / 2;
  rootX = legScale ? -(hipU - aspect / 2) / legScale : 0;
  let pts = poseWorld.map((p, i) => ({ x: -p.x + rootX, y: -p.y, z: -p.z, v: poseImage[i].visibility ?? 1 }));
  // 低い方の足を床（Y = 0）に置く
  const minY = Math.min(...[27, 28, 29, 30, 31, 32].map((i) => pts[i].y));
  pts.forEach((p) => { p.y -= minY; });
  if (world) pts = pts.map((p, i) => ({ x: lerp(world[i].x, p.x, 0.5), y: lerp(world[i].y, p.y, 0.5), z: lerp(world[i].z, p.z, 0.5), v: p.v }));
  world = pts;
}

// 毎フレーム: 仮想カメラの位置と、左パネルに描く BODY_25 を更新する
function updateView() {
  updateProjection();
  if (!view.locked) {
    view.camX = view.init ? lerp(view.camX, rootX, 0.08) : rootX;
    view.init = true;
  }
  if (!world || !cameraOn) { viewPts = null; return; }
  viewPts = toBody25(world.map((p) => {
    const q = project(p.x, p.y, p.z);
    return { x: q.x / W, y: q.y / H, visibility: p.v };
  }));
}

// ---------- キック検出（ORPHE CORE） ----------
const kickDet = [0, 1].map(() => ({ active: false, peak: 0, t0: 0, last: -Infinity }));
const liveMag = [1, 1];  // ゲージ表示用（減衰付き）
let lastPeak = null;     // { value, at }

window.orpheAccListeners.push(function (id, acc) {
  const mag = Math.hypot(acc.x, acc.y, acc.z);
  const now = performance.now();
  liveMag[id] = Math.max(liveMag[id], mag);
  const d = kickDet[id];
  if (d.active) {
    d.peak = Math.max(d.peak, mag);
    if (now - d.t0 >= PEAK_WINDOW_MS) {
      d.active = false;
      d.last = now;
      onKick(id, d.peak, d.t0);
    }
  } else if (mag >= triggerG() && now - d.last > KICK_COOLDOWN_MS) {
    d.active = true;
    d.peak = mag;
    d.t0 = now;
  }
});

function connectedCores() {
  return (window.orpheState || []).filter((s) => s.connected);
}

// ---------- ゲーム ----------
// ボールは前方の奥（Z = 12 m）から跳ねながら近づき、円の位置（足元）でミートする。
// 位置はすべて世界座標（m）で持ち、project() で左パネルに描く。
const Z_FAR = 12;
const TRAIL_FADE_MS = 1600;

const game = { running: false, over: false, round: 0, score: 0, nextAt: 0 };
let ball = null;
let result = null;          // { ok, msg, peak, at }
let home = null;            // ゲーム開始時の足の位置（世界座標）{ L: { X, Z }, R: { X, Z } }
let fadingTrails = [];      // 終わったボールの軌道 { pts, color, at }

function footHome(side) {
  const f = feet[side];
  if (f) return { X: f.X, Z: f.Z };
  return { X: view.camX + (side === 'L' ? -0.15 : 0.15), Z: 0 };
}

// ---------- 右足を上げてスタート ----------
// 画面から離れて立っていてもボタンを押さずに始められるよう、右足（人物の右）を
// 一定時間上げたらゲームを開始する。開始時の立ち位置は「両足が着いていた最後の状態」を使う
const LIFT_HOLD_MS = 600;
const LIFT_RATIO = 0.18;     // 右足首が左足首より「股関節〜足首の長さ × この比」以上高ければ上げている
let liftStart = 0;
let liftProgress = 0;
let gestureBlockedUntil = 0;
let groundedSnapshot = null; // { crop, home }

function rightFootLifted() {
  const pts = people[0];
  const ok = (p) => p && p.v > VISIBILITY_THRESHOLD;
  if (!pts) return false;
  const ra = pts[FOOT.R.ankle], la = pts[FOOT.L.ankle], lh = pts[12], rh = pts[9];
  if (!ok(ra) || !ok(la) || !(ok(lh) || ok(rh))) return false;
  const hipY = ok(lh) ? lh.y : rh.y;
  const leg = Math.abs(la.y - hipY);
  return leg > 0.05 && la.y - ra.y > leg * LIFT_RATIO;
}

function updateStartGesture(now) {
  if (game.running || !cameraOn || !landmarker || now < gestureBlockedUntil) {
    liftStart = 0;
    liftProgress = 0;
    return;
  }
  if (rightFootLifted()) {
    if (!liftStart) liftStart = now;
    liftProgress = clamp((now - liftStart) / LIFT_HOLD_MS, 0, 1);
    if (liftProgress >= 1) {
      liftStart = 0;
      liftProgress = 0;
      setMessage('');
      startGame();
    }
  } else {
    liftStart = 0;
    liftProgress = 0;
    if (people[0]) groundedSnapshot = { crop: { ...crop }, camX: view.camX, home: { L: footHome('L'), R: footHome('R') } };
  }
}

function startGame() {
  initAudio();
  // 最初の立ち位置で切り出し範囲を固定する（足を上げる前の状態があればそれを使う）
  if (groundedSnapshot) {
    Object.assign(crop, groundedSnapshot.crop);
    view.camX = groundedSnapshot.camX;
    home = groundedSnapshot.home;
  } else {
    home = { L: footHome('L'), R: footHome('R') };
  }
  crop.locked = true;
  view.locked = true;
  Object.assign(game, { running: true, over: false, round: 0, score: 0, nextAt: performance.now() + 1200 });
  ball = null;
  result = null;
  fadingTrails = [];
  sfx.start();
  recorder?.addEvent('app', 'game_start', { home, ball_r_m: BALL_R, target_r_m: TARGET_R, threshold_g: threshold(), trigger_g: triggerG() });
  btnGame.innerHTML = '<i class="bi bi-stop-fill"></i> ゲーム停止';
  btnGame.classList.add('running');
}

function stopGame(over = false) {
  recorder?.addEvent('app', over ? 'game_over' : 'game_stop', { score: game.score, rounds: ROUNDS });
  game.running = false;
  game.over = over;
  // 結果を見る間に足を上げても再開しないよう少し待つ
  gestureBlockedUntil = performance.now() + 2500;
  crop.locked = false;
  view.locked = false;
  if (!over) ball = null;
  btnGame.innerHTML = '<i class="bi bi-play-fill"></i> ゲーム開始';
  btnGame.classList.remove('running');
}

// ミート位置（ボールの中心が来る位置）を、開始時の足の位置の近くに決める。
// 横位置と高さ（画面の上下）を変え、奥行きは足のすぐ前に固定する（ミート時の円とボールの大きさはほぼ同じ）
const TARGET_HEIGHT = [BALL_R, BALL_R + 0.3]; // ミート位置の高さの範囲 [m]（床に置いたボール 〜 少し浮いたボール）

function pickTarget(side) {
  const base = home[side];
  const Z = base.Z + 0.05;
  const Y = rand(TARGET_HEIGHT[0], TARGET_HEIGHT[1]);
  // 円がパネルからはみ出さないよう、その奥行きで見えている横幅に収める
  const halfW = (W / 2) / project(view.camX, BALL_R, Z).s;
  const margin = TARGET_R * 1.3;
  const X = clamp(base.X + rand(-0.35, 0.35), view.camX - halfW + margin, view.camX + halfW - margin);
  return { X, Y, Z };
}

function spawnBall(now) {
  const sides = [...new Set(connectedCores().map((s) => s.side))];
  const side = sides.length ? pick(sides) : pick(['L', 'R']);
  const target = pickTarget(side);
  ball = {
    state: 'incoming',
    side,
    mode: Math.random() < 0.5 ? 'weak' : 'strong',
    target,
    X0: target.X + rand(-1.5, 1.5),   // 奥のどこから来るか
    t0: now, t: 0, dur: rand(1.8, 2.6) * 1000,
    X: target.X, Y: BALL_R, Z: Z_FAR,
    A: rand(0.4, 1.0), nb: pick([1.5, 2.5, 3.5]), phase: 0,
    vX: 0, vY: 0, vZ: 0, aX: 0,
    rot: 0, spin: 0, alpha: 1, readyAt: 0, endAt: 0, kickedAt: 0,
    inTrail: [], outTrail: [], outColor: COLOR.text,
  };
}

// ボールの見かけ（px）。gx, gy は真下の床（影）、s はミート時の大きさに対する比
function ballScreen(b) {
  const p = project(b.X, b.Y, b.Z);
  const g = project(b.X, 0, b.Z);
  const meet = project(b.target.X, b.target.Y, b.target.Z);
  return { x: p.x, y: p.y, gx: g.x, gy: g.y, r: BALL_R * p.s, s: p.s / meet.s };
}

// ミート位置の円（床に垂直に立てた円。画面とほぼ平行なので正円で描く）の中心と半径（px）
function targetScreen(b) {
  const c = project(b.target.X, b.target.Y, b.target.Z);
  return { x: c.x, y: c.y, R: TARGET_R * c.s };
}

// 足が円に入っているか。画面上のボーン（足首・かかと・つま先・足の中心）のどれかが円の中にあれば OK。
// ゲーム判定では「ミートの区間」＝ CORE の加速度が大きくなった区間（キック検出〜ピーク探索の終わり）の
// ボーン位置を使う。カメラと BLE の遅れを見込んで前後に少し余裕を持たせる。
// 骨格が取れていないときは位置判定しない。dx は最も近い点の横方向のずれ（px、右が正）
const MEET_MARGIN_BEFORE_MS = 150;
const MEET_MARGIN_AFTER_MS = 50;
const CIRCLE_TOLERANCE = 1.15;   // 円の半径の何倍までを「中」とするか（骨格のブレの分）

function footInCircle(b, tFrom = null, tTo = null) {
  const t = targetScreen(b);
  let samples = footSamples[b.side];
  if (tFrom !== null) samples = samples.filter((sm) => sm.t >= tFrom && sm.t <= tTo);
  else samples = samples.slice(-1);
  if (!samples.length) return { inside: !feet[b.side], dx: 0, dist: null };
  let best = Infinity, bestDx = 0;
  for (const sm of samples) {
    for (const [u, v] of sm.pts) {
      const dx = u * W - t.x, dy = v * H - t.y;
      const d = Math.hypot(dx, dy) / t.R;
      if (d < best) { best = d; bestDx = dx; }
    }
  }
  return { inside: best <= CIRCLE_TOLERANCE, dx: bestDx, dist: best };
}

function judge(peak, now, meetFrom, meetTo) {
  const th = threshold();
  const pos = footInCircle(ball, meetFrom, meetTo);
  let ok, msg, err;
  if (!pos.inside) {
    ok = false;
    msg = '位置ずれ！';
    err = 1;
  } else if (ball.mode === 'weak') {
    ok = peak <= th;
    msg = ok ? 'ナイス！' : '強すぎ！';
    err = clamp((peak - th) / th, 0.25, 1);
  } else {
    ok = peak > th;
    msg = ok ? 'ナイス！' : '弱すぎ！';
    err = clamp((th - peak) / th, 0.25, 1);
  }
  if (ok) game.score++;
  result = { ok, msg, peak, at: now };
  recorder?.addEvent('app', 'judge', {
    round: game.round, side: ball.side, mode: ball.mode, ok, result: msg, peak_g: peak,
    threshold_g: th, foot_in_circle: pos.inside, foot_dx_px: pos.dx, foot_dist_r: pos.dist,
    meet_window_ms: Math.round(meetTo - meetFrom), target: ball.target,
  });

  // 前方（奥）へ蹴り返す。強いほど速く・高く飛ぶ [m/s]
  const p = clamp(peak / GAUGE_MAX, 0, 1);
  ball.state = 'kicked';
  ball.kickedAt = now;
  ball.vZ = 4 + p * 14;
  ball.vY = 1 + p * 5;
  if (ok) {
    ball.vX = rand(-0.3, 0.3);
    ball.aX = 0;
    ball.spin = -(4 + ball.vZ);
  } else {
    // 失敗したキックは左右に変な方向へ曲がっていく（大きく外したほど大きく）。
    // 位置ずれのときは足と反対側へ、それ以外はランダム
    const dir = !pos.inside && pos.dx !== 0 ? -Math.sign(pos.dx) : pick([-1, 1]);
    ball.vX = dir * (1.5 + 2.5 * err);
    ball.aX = dir * (2 + 4 * err);
    ball.spin = dir * (10 + 10 * err);
  }
  ball.outColor = ok ? COLOR.ok : COLOR.ng;
  sfx.kick(p);
  (ok ? sfx.ok : sfx.ng)();
}

// t0: 加速度がキック検出値を超えた時刻（キーボードのときは押した時刻）
function onKick(id, peak, t0 = performance.now()) {
  const now = performance.now();
  lastPeak = { value: peak, at: now };
  recorder?.addEvent('app', 'kick', { core: id >= 0 ? id + 1 : 'keyboard', peak_g: peak });
  if (!game.running || !ball) return;
  const kickable = ball.state === 'ready' || (ball.state === 'incoming' && ball.t >= EARLY_KICK_T);
  if (!kickable) return;
  // CORE 接続時は、ボールが来た足の CORE だけを判定に使う（id = -1 はキーボード）
  if (id >= 0 && window.orpheState[id].side !== ball.side) return;
  judge(peak, now, t0 - MEET_MARGIN_BEFORE_MS, Math.max(now, t0 + PEAK_WINDOW_MS) + MEET_MARGIN_AFTER_MS);
}

function missBall(now) {
  ball.state = 'missed';
  ball.endAt = now + 900;
  result = { ok: false, msg: 'ミス！', peak: null, at: now };
  recorder?.addEvent('app', 'judge', { round: game.round, side: ball.side, mode: ball.mode, ok: false, result: 'ミス！' });
  sfx.ng();
}

function pushTrail(trail, b) {
  const p = ballScreen(b);
  trail.push({ u: p.x / W, v: p.y / H, w: p.s });
}

function updateBall(now, dt) {
  if (!ball) return;
  const b = ball;

  if (b.state === 'incoming') {
    const t = clamp((now - b.t0) / b.dur, 0, 1);
    b.t = t;
    b.X = lerp(b.X0, b.target.X, t);
    b.Z = lerp(Z_FAR, b.target.Z, t);
    // 床で跳ねながら、最後はミート位置の高さに来る
    b.Y = lerp(BALL_R, b.target.Y, t) + b.A * Math.pow(1 - t, 0.8) * Math.abs(Math.cos(Math.PI * b.nb * t));
    b.rot += dt * 3;
    const phase = Math.floor(b.nb * t + 0.5);
    if (phase > b.phase) { b.phase = phase; sfx.bounce(); }
    pushTrail(b.inTrail, b);
    if (t >= 1) { b.state = 'ready'; b.readyAt = now; }
  } else if (b.state === 'ready') {
    // 止まらずにプレイヤーの方へ転がり続ける。この間に蹴らないとミス
    const tau = clamp((now - b.readyAt) / READY_MS, 0, 1);
    b.X = b.target.X;
    b.Z = b.target.Z - 0.5 * tau;
    b.Y = BALL_R + (b.target.Y - BALL_R) * (1 - tau) * (1 - tau) + 0.06 * (1 - tau) * Math.abs(Math.sin(Math.PI * 2 * tau));
    b.rot += dt * 4;
    if (tau >= 1) missBall(now);
  } else if (b.state === 'kicked') {
    b.vX += b.aX * dt;
    b.X += b.vX * dt;
    b.Z += b.vZ * dt;
    b.vY -= 9.8 * dt;
    b.Y += b.vY * dt;
    if (b.Y < BALL_R) { b.Y = BALL_R; b.vY = -b.vY * 0.45; b.vZ *= 0.85; }
    b.rot += b.spin * dt;
    pushTrail(b.outTrail, b);
    const p = ballScreen(b);
    const offscreen = p.x < -p.r * 2 || p.x > W + p.r * 2;
    if (b.Z > 40 || offscreen || now - b.kickedAt > 2600) endBall(now);
  } else if (b.state === 'missed') {
    // 蹴れなかったボールは足元を抜けて手前（後ろ）へ転がって消える
    b.Z = Math.max(b.target.Z - 1.5, b.Z - dt * 1.5);
    b.Y = BALL_R;
    b.rot += dt * 4;
    b.alpha = clamp((b.endAt - now) / 900, 0, 1);
    if (now > b.endAt) endBall(now);
  }
}

function endBall(now) {
  if (ball.inTrail.length) fadingTrails.push({ pts: ball.inTrail, color: COLOR.text, alpha: 0.12, at: now });
  if (ball.outTrail.length) fadingTrails.push({ pts: ball.outTrail, color: ball.outColor, alpha: 0.45, at: now });
  ball = null;
  game.nextAt = now + 700;
  if (game.running && game.round >= ROUNDS) stopGame(true);
}

function updateGame(now, dt) {
  if (game.running && !ball && now >= game.nextAt) {
    game.round++;
    spawnBall(now);
    recorder?.addEvent('app', 'ball', { round: game.round, side: ball.side, mode: ball.mode, target: ball.target });
  }
  updateBall(now, dt);
  fadingTrails = fadingTrails.filter((tr) => now - tr.at < TRAIL_FADE_MS);
}

// ---------- 描画 ----------
// キャンバスは常に 16:9（全画面でも比率を保って中央に置く）。
// ゲームの描画は左半分（8:9）で行うので、W は左パネルの幅にする
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
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
  W = canvas.width / 2;
  H = canvas.height;
}

function drawVideo(dx, dy, dw, dh, sx, sy, sw, sh) {
  ctx.save();
  if (chkMirror.checked) {
    ctx.translate(dx * 2 + dw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

// 奥行きが分かるように、床のガイド線を仮想カメラから描く
function drawFloor() {
  ctx.strokeStyle = 'rgba(29,35,48,0.07)';
  ctx.lineWidth = Math.max(1, H * 0.002);
  ctx.beginPath();
  const cx = view.camX;
  for (let x = -3; x <= 3.001; x += 0.5) {
    const a = project(cx + x, 0, -0.5), b = project(cx + x, 0, 40);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  for (const z of [0, 1, 2, 4, 8, 16]) {
    const a = project(cx - 8, 0, z), b = project(cx + 8, 0, z);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

function drawMainView() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  drawFloor();
  if (viewPts) {
    drawSkeleton(ctx, viewPts, (p) => [p.x * W, p.y * H], Math.max(4, H * 0.016), Math.max(3, H * 0.012), 0.85);
    drawFootShoes();
  }
}

// 右パネル: 実写。左のゲーム画面と同じ足元の切り出し範囲を映す（ボーンと実写の位置がそろう）
function drawCameraPanel() {
  const x0 = W, pw = W;
  if (!cameraOn || video.readyState < 2) {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(x0, 0, pw, H);
    return;
  }
  const vw = video.videoWidth, vh = video.videoHeight;
  const w = cropW();
  const left = crop.cx - w / 2;
  const srcX = (chkMirror.checked ? 1 - (left + w) : left) * vw;
  drawVideo(x0, 0, pw, H, srcX, (crop.cy - crop.h / 2) * vh, w * vw, crop.h * vh);
}

function pentagon(cx, cy, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + i * Math.PI * 2 / 5 - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function strokeTrail(pts, color, alpha) {
  if (pts.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    ctx.strokeStyle = hexAlpha(color, alpha);
    ctx.lineWidth = Math.max(1.5, H * 0.006 * b.w);
    ctx.beginPath();
    ctx.moveTo(a.u * W, a.v * H);
    ctx.lineTo(b.u * W, b.v * H);
    ctx.stroke();
  }
}

function drawTrails(now) {
  for (const tr of fadingTrails) {
    strokeTrail(tr.pts, tr.color, tr.alpha * clamp(1 - (now - tr.at) / TRAIL_FADE_MS, 0, 1));
  }
  if (ball) {
    strokeTrail(ball.inTrail, COLOR.text, 0.12);
    strokeTrail(ball.outTrail, ball.outColor, 0.45);
  }
}

// 靴の形のパス（中心 0,0、つま先が +y 方向）。inner は親指側の向き（-1 / +1）
function shoePath(w, l, inner) {
  const k = inner * w * 0.1;
  ctx.beginPath();
  ctx.moveTo(0, -l / 2);
  ctx.bezierCurveTo(w * 0.36, -l / 2, w * 0.42, -l * 0.2, w * 0.5, l * 0.08);
  ctx.bezierCurveTo(w * 0.56, l * 0.34, w * 0.3 + k, l / 2, k * 0.8, l / 2);
  ctx.bezierCurveTo(-w * 0.3 + k, l / 2, -w * 0.56, l * 0.34, -w * 0.5, l * 0.08);
  ctx.bezierCurveTo(-w * 0.42, -l * 0.2, -w * 0.36, -l / 2, 0, -l / 2);
  ctx.closePath();
}

// 足のボーンに重ねる靴。かかと→つま先の向きに置き、短く見えるときは最小サイズで奥向き（画面上）にする
const SHOE_COLOR = { L: '#3e63dd', R: '#0f9fb3' };
// 毎フレーム更新 { x, y, dx, dy, len: 靴（画面 px）, fx, fy: 足の真下の床（画面 px）, s: 1 m の px, X, Z: 世界座標 }
const feet = { L: null, R: null };
// ミート判定用に、直近の足のボーン位置（パネルに対する正規化座標）を時刻つきで残す
const FOOT_SAMPLE_MS = 1500;
const footSamples = { L: [], R: [] };

function recordFootSample(side, now) {
  const list = footSamples[side];
  const f = MP_FOOT[side];
  if (world && viewPts && feet[side]) {
    const pts = [f.ankle, f.heel, f.toe]
      .filter((i) => world[i].v > VISIBILITY_THRESHOLD)
      .map((i) => { const q = project(world[i].x, world[i].y, world[i].z); return [q.x / W, q.y / H]; });
    pts.push([feet[side].x / W, feet[side].y / H]);
    list.push({ t: now, pts });
  }
  while (list.length && now - list[0].t > FOOT_SAMPLE_MS) list.shift();
}

function updateFeet(now) {
  for (const side of ['L', 'R']) {
    if (!world || !viewPts) { feet[side] = null; continue; }
    const f = MP_FOOT[side];
    const ok = (i) => world[i].v > VISIBILITY_THRESHOLD;
    let cur = null;
    if (ok(f.toe) && ok(f.heel)) {
      const T = world[f.toe], Hl = world[f.heel];
      const pt = project(T.x, T.y, T.z), ph = project(Hl.x, Hl.y, Hl.z);
      const X = (T.x + Hl.x) / 2, Z = (T.z + Hl.z) / 2;
      const g = project(X, 0, Z);
      cur = { x: (pt.x + ph.x) / 2, y: (pt.y + ph.y) / 2, dx: pt.x - ph.x, dy: pt.y - ph.y, fx: g.x, fy: g.y, s: g.s, X, Z };
    } else if (ok(f.ankle)) {
      const A = world[f.ankle];
      const pa = project(A.x, A.y, A.z), g = project(A.x, 0, A.z);
      cur = { x: pa.x, y: pa.y, dx: 0, dy: 0, fx: g.x, fy: g.y, s: g.s, X: A.x, Z: A.z };
    }
    if (!cur) { feet[side] = null; continue; }
    const prev = feet[side];
    if (prev && Math.abs(prev.W - W) < 1) {
      for (const k of ['x', 'y', 'dx', 'dy', 'fx', 'fy']) cur[k] = lerp(prev[k], cur[k], 0.35);
    }
    cur.len = Math.hypot(cur.dx, cur.dy);
    cur.W = W;
    feet[side] = cur;
  }
  recordFootSample('L', now);
  recordFootSample('R', now);
}

function drawFootShoes() {
  const active = ball && (ball.state === 'incoming' || ball.state === 'ready') ? ball.side : null;
  for (const side of ['L', 'R']) {
    const f = feet[side];
    if (!f) continue;
    const baseR = BALL_R * f.s;
    const l = Math.max(f.len * 1.35, baseR * 2.2);
    const w = Math.max(l * 0.42, baseR * 1.3);
    // 向きが分かるほど長く見えていないときは、つま先を奥（画面上）に向ける
    const ang = f.len > baseR * 0.8 ? Math.atan2(f.dy, f.dx) - Math.PI / 2 : Math.PI;
    // 親指側（体の内側）: 後ろから見ているので左足は画面の右側が内側
    const inner = (side === 'L' ? 1 : -1) * (Math.cos(ang) >= 0 ? 1 : -1);
    const on = active === side;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(ang);
    shoePath(w, l, inner);
    ctx.fillStyle = hexAlpha(SHOE_COLOR[side], on ? 0.35 : 0.16);
    ctx.fill();
    ctx.lineWidth = Math.max(2, H * (on ? 0.006 : 0.004));
    ctx.strokeStyle = hexAlpha(SHOE_COLOR[side], on ? 0.95 : 0.55);
    ctx.stroke();
    ctx.restore();
  }
}

// ミート位置の円。床に垂直に立てた円（画面とほぼ平行）なので、画面上では正円で描く。
// 大きさはゲーム中ずっと同じで、位置だけが変わる。足が合うと塗りつぶし＋実線になる
function drawTarget() {
  if (!ball || ball.state === 'kicked' || ball.state === 'missed') return;
  const color = COLOR[ball.mode];
  const approach = ball.state === 'ready' ? 1 : ball.t;
  const { x, y, R } = targetScreen(ball);
  const inside = footInCircle(ball).inside;

  ctx.fillStyle = hexAlpha(color, inside ? 0.2 : 0.05 + 0.07 * approach);
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexAlpha(color, inside ? 0.85 : 0.3 + 0.3 * approach);
  ctx.lineWidth = Math.max(2, H * (inside ? 0.006 : 0.004));
  if (!inside) ctx.setLineDash([H * 0.015, H * 0.012]);
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  outlinedText(SIDE_LABEL[ball.side], x, y - R - H * 0.025, H * 0.028, hexAlpha(color, 0.9), { weight: 800 });
}

function drawBall(now) {
  if (!ball) return;
  const p = ballScreen(ball);
  const r = p.r;

  // 影
  const shadowK = clamp(1 - (ball.Y - BALL_R) / 1.5, 0.25, 1);
  ctx.fillStyle = `rgba(20,30,50,${0.22 * shadowK * ball.alpha})`;
  ctx.beginPath();
  ctx.ellipse(p.gx, p.gy, r * 0.9 * shadowK, r * 0.25 * shadowK, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = ball.alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(ball.rot);
  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#d5dae1');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = COLOR.text;
  pentagon(0, 0, r * 0.3, 0);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 - Math.PI / 2;
    pentagon(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, r * 0.25, Math.PI / 5);
  }
  ctx.restore();
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.strokeStyle = COLOR.text;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function outlinedText(text, x, y, size, color, { weight = 900, align = 'center', outline = '#ffffff' } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawGauge(now) {
  const gx = H * 0.04, gy = H * 0.16, gw = H * 0.055, gh = H * 0.6;
  const th = threshold(), trg = triggerG();
  const yOf = (g) => gy + gh * (1 - clamp(g, 0, GAUGE_MAX) / GAUGE_MAX);
  const active = ball && (ball.state === 'incoming' || ball.state === 'ready');

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.strokeStyle = '#d5dae1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(gx, gy, gw, gh, gw * 0.3);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(gx, gy, gw, gh, gw * 0.3);
  ctx.clip();
  // 成功ゾーン
  if (active) {
    ctx.fillStyle = ball.mode === 'weak' ? 'rgba(62,99,221,0.18)' : 'rgba(229,72,77,0.18)';
    if (ball.mode === 'weak') ctx.fillRect(gx, yOf(th), gw, gy + gh - yOf(th));
    else ctx.fillRect(gx, gy, gw, yOf(th) - gy);
  }
  // 現在の加速度
  const ids = ball && connectedCores().length
    ? connectedCores().filter((s) => s.side === ball.side).map((s) => s.id)
    : [0, 1];
  const v = Math.max(...ids.map((i) => liveMag[i]));
  const grad = ctx.createLinearGradient(0, gy + gh, 0, gy);
  grad.addColorStop(0, '#3e63dd');
  grad.addColorStop(clamp(th / GAUGE_MAX, 0, 1), '#8e4ec6');
  grad.addColorStop(1, '#e5484d');
  ctx.fillStyle = grad;
  ctx.fillRect(gx, yOf(v), gw, gy + gh - yOf(v));
  ctx.restore();

  // 目盛り
  ctx.font = `500 ${H * 0.022}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(29,35,48,0.5)';
  for (let g = 0; g <= GAUGE_MAX; g += 4) {
    ctx.fillRect(gx + gw, yOf(g) - 0.5, gw * 0.2, 1);
  }

  // キック検出ライン
  ctx.strokeStyle = 'rgba(29,35,48,0.45)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(gx, yOf(trg));
  ctx.lineTo(gx + gw, yOf(trg));
  ctx.stroke();
  ctx.setLineDash([]);

  // ゲージ（しきい値）ライン
  ctx.strokeStyle = COLOR.text;
  ctx.lineWidth = Math.max(3, H * 0.006);
  ctx.beginPath();
  ctx.moveTo(gx - gw * 0.2, yOf(th));
  ctx.lineTo(gx + gw * 1.2, yOf(th));
  ctx.stroke();
  outlinedText(`${th.toFixed(1)}G`, gx + gw * 1.35, yOf(th), H * 0.032, COLOR.text, { weight: 800, align: 'left' });

  // 直近のキックピーク
  if (lastPeak && now - lastPeak.at < 3000) {
    const y = yOf(lastPeak.value);
    ctx.fillStyle = lastPeak.value > th ? COLOR.strong : COLOR.weak;
    ctx.beginPath();
    ctx.moveTo(gx + gw + 2, y);
    ctx.lineTo(gx + gw + H * 0.03, y - H * 0.018);
    ctx.lineTo(gx + gw + H * 0.03, y + H * 0.018);
    ctx.closePath();
    ctx.fill();
  }

  outlinedText('ACC', gx + gw / 2, gy - H * 0.03, H * 0.026, COLOR.text, { weight: 800 });
}

// 指示・結果の文字が骨格と重なっても読めるよう、上部に白い帯を敷く
function drawTopBand() {
  const band = ctx.createLinearGradient(0, 0, 0, H * 0.28);
  band.addColorStop(0, 'rgba(255,255,255,0.85)');
  band.addColorStop(0.75, 'rgba(255,255,255,0.6)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, H * 0.28);
}

// 「右足を上げてスタート」と、上げている間の進み具合のバー
function drawStartPrompt(y, text) {
  const size = H * 0.06;
  outlinedText(text, W / 2, y, size, liftProgress > 0 ? COLOR.strong : COLOR.text);
  const bw = W * 0.28, bh = H * 0.014;
  const bx = W / 2 - bw / 2, by = y + size * 0.85;
  ctx.fillStyle = 'rgba(29,35,48,0.1)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  if (liftProgress > 0) {
    ctx.fillStyle = COLOR.strong;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw * liftProgress, bh, bh / 2);
    ctx.fill();
  }
}

function drawHud(now) {
  const cx = W / 2;
  if (result && now - result.at < RESULT_MS) {
    const k = clamp((now - result.at) / 150, 0, 1);
    outlinedText(result.msg, cx, H * 0.12, H * 0.1 * (0.7 + 0.3 * k), result.ok ? COLOR.ok : COLOR.ng);
    if (result.peak !== null) {
      outlinedText(`${result.peak.toFixed(1)} G`, cx, H * 0.22, H * 0.05, COLOR.text, { weight: 800 });
    }
  } else if (ball && (ball.state === 'incoming' || ball.state === 'ready')) {
    const pulse = ball.state === 'ready' ? 1 + 0.06 * Math.sin(now / 90) : 1;
    outlinedText(`${SIDE_LABEL[ball.side]}で`, cx, H * 0.065, H * 0.042, COLOR.text, { weight: 800 });
    outlinedText(ball.mode === 'weak' ? '弱く蹴って' : '強く蹴って', cx, H * 0.15, H * 0.095 * pulse, COLOR[ball.mode]);
  } else if (game.over) {
    outlinedText('RESULT', cx, H * 0.3, H * 0.05, COLOR.text, { weight: 800 });
    outlinedText(`${game.score} / ${ROUNDS}`, cx, H * 0.42, H * 0.14, COLOR.strong);
    if (cameraOn && now >= gestureBlockedUntil) drawStartPrompt(H * 0.56, '右足を上げてもう一度');
  } else if (!game.running && cameraOn) {
    drawStartPrompt(H * 0.12, '右足を上げてスタート');
  }

  // 縦長パネルでは中央上部の指示と重ならないよう、左上に 1 行で出す
  if (game.running || game.over) {
    outlinedText(`SCORE ${game.score}  ·  ${Math.min(game.round, ROUNDS)}/${ROUNDS}`, H * 0.04, H * 0.045, H * 0.03, COLOR.text, { weight: 800, align: 'left' });
  }

  // 状態表示
  const cores = connectedCores();
  const coreText = cores.length
    ? cores.map((s) => `CORE0${s.id + 1}:${SIDE_LABEL[s.side]}`).join('  ')
    : 'CORE 未接続';
  ctx.font = `500 ${H * 0.024}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const status = `${cameraOn ? `${poseFps} fps` : 'camera off'}  ${coreText}`;
  const tw = ctx.measureText(status).width;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(H * 0.02, H - H * 0.065, tw + H * 0.03, H * 0.045);
  ctx.fillStyle = COLOR.text;
  ctx.fillText(status, H * 0.035, H - H * 0.028);
}

// ---------- 記録 ----------
const recorder = new SessionRecorder({
  name: 'kick-challenge',
  canvas,
  getCameraStream: () => stream,
  getMeta: () => ({
    mirror: chkMirror.checked,
    model: MODEL,
    threshold_g: threshold(),
    trigger_g: triggerG(),
    canvas: { width: canvas.width, height: canvas.height, layout: 'left: game (8:9) / right: camera (8:9)' },
    camera: { width: video.videoWidth, height: video.videoHeight, label: selCamera.selectedOptions[0]?.textContent || '' },
    camera_crop: { ...crop },
    view: { ...VIEW, cam_x: view.camX, ball_r_m: BALL_R, target_r_m: TARGET_R, note: 'left panel: back view (world = -mediapipe_world)' },
    game: { running: game.running, round: game.round, score: game.score },
    cores: (window.orpheState || []).map((s) => ({
      id: s.id + 1, side: s.side, name: s.name, connected: s.connected,
      device_information: window.bles?.[s.id]?.device_information ?? null,
    })),
  }),
});
window.orpheSampleListeners.push((id, s) => recorder.addCoreSample(id, s));
window.orpheEventListeners.push((id, type, data) => recorder.addEvent('core', type, { core: id + 1, ...data }));
bindRecButton(recorder, $('#btn_rec'), $('#rec_indicator'));

// ---------- ループ ----------
let lastFrame = performance.now();

function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  detectPose(now);
  if (now - fpsSince >= 1000) {
    poseFps = Math.round(fpsFrames * 1000 / (now - fpsSince));
    fpsFrames = 0;
    fpsSince = now;
  }
  for (let i = 0; i < 2; i++) liveMag[i] = Math.max(1, liveMag[i] * Math.exp(-dt * 4));

  resizeCanvas();
  updateCrop();
  updateView();
  updateFeet(now);
  updateStartGesture(now);
  updateGame(now, dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawMainView();
  drawTarget();
  drawTrails(now);
  drawBall(now);
  drawTopBand();
  drawGauge(now);
  drawHud(now);
  drawCameraPanel(); // 左パネルからはみ出した描画（蹴ったボールなど）もここで隠れる

  requestAnimationFrame(loop);
}

// ---------- イベント ----------
btnCamera.addEventListener('click', async () => {
  initAudio();
  if (cameraOn) { stopCamera(); setMessage('「カメラ開始」で全身が映る位置に立ち、右足を上げるとゲームが始まります'); return; }
  try {
    await startCamera();
  } catch (e) {
    console.error(e);
    stopCamera();
    setMessage(`カメラを開始できませんでした: ${e.message || e.name}`, 'bi-exclamation-triangle');
  }
});
selCamera.addEventListener('change', () => { if (cameraOn) startCamera().catch(console.error); });

btnGame.addEventListener('click', () => {
  if (game.running) stopGame(false);
  else { setMessage(''); startGame(); }
});

btnFullscreen.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else stage.requestFullscreen?.();
});

function syncLabels() {
  // キック検出はゲージより低くないと「弱く」が成立しないので抑える
  if (triggerG() > threshold() - 0.5) rngTrigger.value = Math.max(1.2, threshold() - 0.5);
  lblThreshold.textContent = threshold().toFixed(1);
  lblTrigger.textContent = triggerG().toFixed(1);
}
rngThreshold.addEventListener('input', syncLabels);
rngTrigger.addEventListener('input', syncLabels);
syncLabels();

// CORE が無くても試せるようにキーボードでキックを代用
window.addEventListener('keydown', (e) => {
  if ((e.target instanceof Element && e.target.matches('input, select, textarea')) || e.repeat) return;
  const key = e.key.toLowerCase();
  if (key !== 'j' && key !== 'k') return;
  const peak = threshold() * (key === 'j' ? rand(0.4, 0.8) : rand(1.2, 1.6));
  for (let i = 0; i < 2; i++) liveMag[i] = Math.max(liveMag[i], peak);
  onKick(-1, peak);
});

if (navigator.mediaDevices?.enumerateDevices) listCameras().catch(() => {});
requestAnimationFrame(loop);
