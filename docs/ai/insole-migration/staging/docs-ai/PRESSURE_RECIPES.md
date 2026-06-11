# ORPHE INSOLE — Pressure Sensor Recipes

6チャネル圧力センサ（FSR）データの典型的な処理パターン集です。
すべて `insole.gotPress = function(press) {...}` で受け取る `press.values`（ADC生値の6要素配列）を入力とします。

対象レート: mode 4 = 100Hz / mode 3 = 200Hz

---

## 0. 前提: キャリブレーション

ADC生値は個体・装着状態で大きく変わります。アプリ起動時に2点サンプリングを推奨します。

```javascript
class PressCalibration {
  constructor() {
    this.zero = new Array(6).fill(0);     // 無負荷時
    this.full = new Array(6).fill(4095);  // 全体重時
  }
  // それぞれ1〜2秒分のサンプル平均を取って設定する
  setZero(samples) { this.zero = averageChannels(samples); }
  setFull(samples) { this.full = averageChannels(samples); }
  normalize(values) {
    return values.map((v, i) =>
      Math.max(0, Math.min(1, (v - this.zero[i]) / (this.full[i] - this.zero[i] + 1e-6))));
  }
}

function averageChannels(samples) {
  const sum = new Array(6).fill(0);
  for (const s of samples) s.forEach((v, i) => sum[i] += v);
  return sum.map(v => v / samples.length);
}
```

## 1. 合計荷重・移動平均

```javascript
const window = [];
const WINDOW_SIZE = 10; // 100Hzなら100ms

insole.gotPress = function(press) {
  const total = press.values.reduce((a, b) => a + b, 0);
  window.push(total);
  if (window.length > WINDOW_SIZE) window.shift();
  const smoothed = window.reduce((a, b) => a + b, 0) / window.length;
  // smoothed を荷重インジケータに使用
};
```

## 2. 接地/離地イベント（ヒステリシス付き）

しきい値1本では接地境界でチャタリングします。必ずON/OFF 2しきい値にします。

```javascript
class ContactDetector {
  constructor(onThreshold, offThreshold) {
    this.on = onThreshold;   // 例: 校正済み合計の 0.15
    this.off = offThreshold; // 例: 0.08
    this.isContact = false;
    this.lastChange = 0;
  }
  update(total, timestamp) {
    if (!this.isContact && total > this.on) {
      this.isContact = true;
      const flight = timestamp - this.lastChange; // 遊脚時間
      this.lastChange = timestamp;
      return { event: 'down', flight };
    }
    if (this.isContact && total < this.off) {
      this.isContact = false;
      const stance = timestamp - this.lastChange; // 立脚時間
      this.lastChange = timestamp;
      return { event: 'up', stance };
    }
    return null;
  }
}
```

## 3. ケイデンス（歩調）とエアタイム

```javascript
const detector = new ContactDetector(0.15, 0.08);
const downTimes = [];

insole.gotPress = function(press) {
  const total = calib.normalize(press.values).reduce((a, b) => a + b, 0);
  const ev = detector.update(total, press.timestamp);
  if (ev?.event === 'down') {
    downTimes.push(press.timestamp);
    if (downTimes.length > 5) downTimes.shift();
    if (downTimes.length >= 2) {
      const periodMs = (downTimes.at(-1) - downTimes[0]) / (downTimes.length - 1);
      const cadenceSpm = 60000 / periodMs;  // この足のみ。両足ケイデンスは×2
    }
  }
  if (ev?.event === 'down' && ev.flight > 80) {
    // 遊脚時間が長い → ジャンプの可能性。両足同時離地ならジャンプ確定
    onAirTime(ev.flight);
  }
};
```

## 4. 前後・内外バランス

チャネルの物理配置はモデルに依存するため、必ずリマップ層を挟みます。

```javascript
// 物理配置に合わせて編集（例: 0,1=前足部 2,3=中足部 4,5=踵部）
const REGION = {
  front: [0, 1],
  mid: [2, 3],
  heel: [4, 5],
  inner: [0, 2, 4],
  outer: [1, 3, 5],
};
const sumOf = (values, idxs) => idxs.reduce((a, i) => a + values[i], 0);

insole.gotPress = function(press) {
  const v = press.values;
  const frontBack = sumOf(v, REGION.front) / (sumOf(v, REGION.front) + sumOf(v, REGION.heel) + 1e-6);
  const innerOuter = sumOf(v, REGION.inner) / (sumOf(v, REGION.inner) + sumOf(v, REGION.outer) + 1e-6);
  // frontBack: 1=つま先荷重, 0=踵荷重 / innerOuter: 1=内側, 0=外側
};
```

## 5. 圧力中心（CoP）軌跡

```javascript
const SENSOR_POSITIONS = [          // 足座標系での各chの位置（要モデル調整）
  { x: -1, y: 2 }, { x: 1, y: 2 },
  { x: -1, y: 0 }, { x: 1, y: 0 },
  { x: -1, y: -2 }, { x: 1, y: -2 },
];

function centerOfPressure(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total < 1e-6) return null;
  let cx = 0, cy = 0;
  values.forEach((v, i) => { cx += SENSOR_POSITIONS[i].x * v; cy += SENSOR_POSITIONS[i].y * v; });
  return { x: cx / total, y: cy / total };
}
```

CoP軌跡を `<canvas>` に残像つきで描くと歩行の質が一目でわかります（蹴り出しの直線性、回内傾向など）。

## 6. ピーク検出と荷重インパルス

```javascript
let prev = 0, rising = false;

insole.gotPress = function(press) {
  const total = press.values.reduce((a, b) => a + b, 0);
  if (total > prev) rising = true;
  else if (rising && total < prev * 0.95) {
    rising = false;
    onPeak(prev, press.timestamp);  // 着地衝撃ピーク
  }
  prev = total;
};

// インパルス（荷重×時間の積分）: リハビリ・トレーニング量の指標
let impulse = 0;
insole.gotPress = function(press) {
  const total = calib.normalize(press.values).reduce((a, b) => a + b, 0);
  impulse += total * (1 / 100); // mode 4 = 100Hz → dt = 10ms
};
```

## 7. 可聴化（Sonification）レシピ

### 7a. 連続マッピング（荷重→音量、バランス→ピッチ）

```javascript
const ctx = new AudioContext();
const osc = ctx.createOscillator();
const gain = ctx.createGain();
gain.gain.value = 0;
osc.connect(gain).connect(ctx.destination);
osc.start();
// AudioContextはユーザー操作内で ctx.resume() しないと鳴らない

insole.gotPress = function(press) {
  const v = calib.normalize(press.values);
  const total = v.reduce((a, b) => a + b, 0) / 6;
  const fb = sumOf(v, REGION.front) / (sumOf(v, REGION.front) + sumOf(v, REGION.heel) + 1e-6);
  gain.gain.setTargetAtTime(total * 0.4, ctx.currentTime, 0.02);
  osc.frequency.setTargetAtTime(220 + fb * 440, ctx.currentTime, 0.02);
};
```

### 7b. イベント発音（着地→打楽器、離地→消音）

連続音は疲れるので、フィードバック用途では状態遷移時のみ発音する方が有効です。

```javascript
function playClick(velocity = 1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = 180;
  g.gain.setValueAtTime(velocity * 0.5, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  o.connect(g).connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + 0.16);
}

insole.gotPress = function(press) {
  const total = calib.normalize(press.values).reduce((a, b) => a + b, 0);
  const ev = detector.update(total, press.timestamp);
  if (ev?.event === 'down') playClick(Math.min(1, total));
};
```

### 7c. 左右2台でステレオパン

```javascript
// insoles[i].device_information.mount_position の bit0 で左右を判定し、
// PannerNode/StereoPannerNode の pan=-1（左足）/+1（右足）に割り当てる
const panner = ctx.createStereoPanner();
panner.pan.value = isRight ? 1 : -1;
```

## 8. データ記録（後解析用）

```javascript
const log = [];
insole.gotPress = function(press) {
  log.push({ t: press.timestamp, sn: press.serial_number, v: [...press.values] });
};

function exportJSON() {
  const blob = new Blob([JSON.stringify(log)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `insole_press_${Date.now()}.json`;
  a.click();
}
```

`lostData` コールバックで欠損も記録しておくと、後解析時に信頼区間が判断できます。

---

## アンチパターン

1. **しきい値1本での接地判定** → 必ずヒステリシス（レシピ2）
2. **100Hzコールバック内でのDOM更新/chart.update()** → rAFスロットリング（VISUALIZE参照）
3. **ADC生値の機種間比較・体重換算** → キャリブレーション必須（レシピ0）
4. **チャネル番号の物理位置ハードコード** → REGION リマップ層を挟む（レシピ4）
5. **insoles[0]=左足の決め打ち** → mount_position bit0 で判定
