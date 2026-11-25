/* セッション記録（REC）
 * 撮影時のデータをあとで再現できるように、次のものをまとめて記録し zip で保存する。
 *   screen.webm   … 画面（ステージのキャンバス）をそのまま録画したもの。スライド用
 *   camera.webm   … カメラの生映像
 *   coreNN_sensor.csv … ORPHE CORE のセンサー生データ（1 サンプル 1 行）
 *   events.jsonl  … CORE の歩行解析イベントやアプリ側のイベント（ゲームの判定など）
 *   pose.jsonl    … 姿勢推定の結果（MediaPipe 33 点、画像座標とワールド座標）
 *   meta.json     … 開始時刻・設定・CORE の情報・各動画の開始オフセット
 * 時刻 t_ms はすべて REC 開始からの経過ミリ秒（performance.now() 基準）で揃えている。
 * zip の作成には JSZip（window.JSZip）を使う。
 */

const VIDEO_BITRATE = 8_000_000;

function pickMimeType() {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return candidates.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

function extOf(mime) {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

function stamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

const r4 = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10000) / 10000 : '');

export const CORE_SENSOR_COLUMNS = [
  't_ms', 'core_timestamp', 'serial_number', 'packet_number',
  'acc_x', 'acc_y', 'acc_z', 'gyro_x', 'gyro_y', 'gyro_z',
  'acc_x_g', 'acc_y_g', 'acc_z_g', 'gyro_x_dps', 'gyro_y_dps', 'gyro_z_dps',
  'quat_w', 'quat_x', 'quat_y', 'quat_z', 'pitch_rad', 'roll_rad', 'yaw_rad',
];

const README = `ORPHE CORE + 姿勢推定 セッション記録

t_ms はすべて REC 開始からの経過ミリ秒（ブラウザの performance.now() 基準）。
動画の 0 秒は meta.json の videos[].start_offset_ms（t_ms）に対応する。

screen.webm   画面の録画（ボーン + 実写の 16:9）
camera.webm   カメラの生映像
coreNN_sensor.csv  ORPHE CORE のセンサー値（1 サンプル 1 行）
  acc_* / gyro_*          正規化された生値（int16 / 32768、-1〜1）
  acc_*_g / gyro_*_dps    レンジ換算後の値（G / deg/s）
  quat_* / pitch,roll,yaw クォータニオンとオイラー角（rad）
  core_timestamp, serial_number, packet_number  CORE から届いた値（ファームウェアによっては空）
events.jsonl  1 行 1 イベントの JSON。event がイベント名。
              source=core は歩行解析（steps / gait / stride / pronation / foot_angle / landing_impact、core は 1 or 2）、
              source=app はアプリ側のイベント（ゲームの出題 ball・キック kick・判定 judge など）
pose.jsonl    1 行 1 フレームの JSON。people[].landmarks は MediaPipe 33 点の [x, y, z, visibility]
              （x, y は映像に対する 0〜1、ミラー前の座標）、people[].world は [x, y, z]（m）
meta.json     開始時刻・設定・CORE の情報など
`;

export class SessionRecorder {
  /**
   * @param {object} opts
   * @param {string} opts.name - zip 名の接頭辞
   * @param {HTMLCanvasElement} opts.canvas - 画面として録画するキャンバス
   * @param {() => MediaStream|null} opts.getCameraStream
   * @param {() => object} opts.getMeta - 開始・終了時に meta.json に入れる設定など
   */
  constructor({ name, canvas, getCameraStream, getMeta }) {
    this.name = name;
    this.canvas = canvas;
    this.getCameraStream = getCameraStream;
    this.getMeta = getMeta;
    this.active = false;
    this.saving = false;
  }

  get recording() {
    return this.active;
  }

  elapsed() {
    return this.active ? performance.now() - this.t0 : 0;
  }

  now() {
    return Math.round((performance.now() - this.t0) * 10) / 10;
  }

  start() {
    if (this.active || this.saving) return;
    this.t0 = performance.now();
    this.startedAt = new Date();
    this.sensor = [[], []];
    this.events = [];
    this.pose = [];
    this.videos = [];
    this.metaAtStart = this.getMeta();
    this.active = true;

    const mime = pickMimeType();
    if (mime) {
      this.videos.push(this._recordStream('screen', this.canvas.captureStream(30), mime, true));
      const cam = this.getCameraStream();
      if (cam) this.videos.push(this._recordStream('camera', cam, mime, false));
    } else {
      console.warn('MediaRecorder が使えないため動画は記録しません');
    }
  }

  _recordStream(label, stream, mime, ownsStream) {
    const v = { label, mime, chunks: [], startOffset: null, ownsStream, stream };
    v.rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE });
    v.rec.ondataavailable = (e) => { if (e.data && e.data.size) v.chunks.push(e.data); };
    v.rec.onstart = () => { v.startOffset = this.now(); };
    v.stopped = new Promise((resolve) => { v.rec.onstop = resolve; });
    v.rec.start(1000);
    return v;
  }

  /** ORPHE CORE の 1 サンプル（core.js の window.orpheSampleListeners から） */
  addCoreSample(id, s) {
    if (!this.active) return;
    this.sensor[id].push([
      this.now(), s.timestamp ?? '', s.serial_number ?? '', s.packet_number ?? '',
      r4(s.acc.x), r4(s.acc.y), r4(s.acc.z), r4(s.gyro.x), r4(s.gyro.y), r4(s.gyro.z),
      r4(s.accG.x), r4(s.accG.y), r4(s.accG.z), r4(s.gyroDps.x), r4(s.gyroDps.y), r4(s.gyroDps.z),
      r4(s.quat.w), r4(s.quat.x), r4(s.quat.y), r4(s.quat.z),
      r4(s.euler.pitch), r4(s.euler.roll), r4(s.euler.yaw),
    ].join(','));
  }

  /** CORE の歩行解析など（source=core）とアプリ側のイベント（source=app） */
  addEvent(source, type, data = {}) {
    if (!this.active) return;
    // data に type（歩行タイプなど）が含まれても上書きされないよう、イベント名は event に入れる
    this.events.push(JSON.stringify({ t_ms: this.now(), source, event: type, ...data }));
  }

  /** MediaPipe PoseLandmarker の結果 */
  addPose(result) {
    if (!this.active || !result) return;
    const people = (result.landmarks || []).map((lm, i) => ({
      landmarks: lm.map((p) => [r4(p.x), r4(p.y), r4(p.z), r4(p.visibility ?? 1)]),
      world: (result.worldLandmarks?.[i] || []).map((p) => [r4(p.x), r4(p.y), r4(p.z)]),
    }));
    this.pose.push(JSON.stringify({ t_ms: this.now(), people }));
  }

  async stopAndSave() {
    if (!this.active) return;
    this.active = false;
    this.saving = true;
    const durationMs = Math.round(performance.now() - this.t0);
    try {
      for (const v of this.videos) {
        if (v.rec.state !== 'inactive') v.rec.stop();
      }
      await Promise.all(this.videos.map((v) => v.stopped));
      for (const v of this.videos) {
        if (v.ownsStream) v.stream.getTracks().forEach((t) => t.stop());
      }

      const JSZip = window.JSZip;
      if (!JSZip) throw new Error('JSZip が読み込まれていません');
      const folder = `${this.name}_${stamp(this.startedAt)}`;
      const zip = new JSZip();
      const dir = zip.folder(folder);

      const videoMeta = [];
      for (const v of this.videos) {
        if (!v.chunks.length) continue;
        const file = `${v.label}.${extOf(v.mime)}`;
        dir.file(file, new Blob(v.chunks, { type: v.mime }), { compression: 'STORE' });
        videoMeta.push({ file, mime: v.mime, start_offset_ms: v.startOffset });
      }
      this.sensor.forEach((rows, id) => {
        if (!rows.length) return;
        dir.file(`core0${id + 1}_sensor.csv`, [CORE_SENSOR_COLUMNS.join(','), ...rows].join('\n') + '\n');
      });
      if (this.events.length) dir.file('events.jsonl', this.events.join('\n') + '\n');
      if (this.pose.length) dir.file('pose.jsonl', this.pose.join('\n') + '\n');
      dir.file('meta.json', JSON.stringify({
        app: this.name,
        started_at: this.startedAt.toISOString(),
        duration_ms: durationMs,
        user_agent: navigator.userAgent,
        videos: videoMeta,
        sensor_samples: this.sensor.map((rows) => rows.length),
        pose_frames: this.pose.length,
        settings_at_start: this.metaAtStart,
        settings_at_end: this.getMeta(),
      }, null, 2));
      dir.file('README.txt', README);

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${folder}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } finally {
      this.saving = false;
      this.videos = [];
      this.sensor = [[], []];
      this.events = [];
      this.pose = [];
    }
  }
}

/**
 * REC ボタン（と R キー）を recorder につなぐ。録画中は経過時間を表示し、
 * ステージの隅に小さな赤い点を出す（DOM なので screen.webm には映らない）。
 */
export function bindRecButton(recorder, button, indicator) {
  const label = button.querySelector('[data-rec-label]');
  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const toggle = async () => {
    if (recorder.saving) return;
    if (!recorder.recording) {
      recorder.start();
      button.classList.add('recording');
      indicator?.classList.add('on');
      return;
    }
    button.classList.remove('recording');
    indicator?.classList.remove('on');
    button.disabled = true;
    label.textContent = '保存中…';
    try {
      await recorder.stopAndSave();
    } catch (e) {
      console.error(e);
      alert(`記録の保存に失敗しました: ${e.message || e}`);
    } finally {
      button.disabled = false;
      label.textContent = 'REC';
    }
  };
  button.addEventListener('click', toggle);
  window.addEventListener('keydown', (e) => {
    if ((e.target instanceof Element && e.target.matches('input, select, textarea')) || e.repeat) return;
    if (e.key === 'r' || e.key === 'R') toggle();
  });
  setInterval(() => {
    if (recorder.recording) label.textContent = fmt(recorder.elapsed());
  }, 250);
}
