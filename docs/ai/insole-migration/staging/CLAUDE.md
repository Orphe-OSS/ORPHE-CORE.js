# ORPHE-INSOLE.js - AI Development Guide

ORPHE INSOLEは6チャネル圧力センサ＋IMU（加速度・ジャイロ・クォータニオン）を内蔵したインソール型IoTセンサーです。このガイドは生成AIがORPHE INSOLEを使ったアプリケーションを正確に生成するための包括的なリファレンスです。

## ORPHE CORE との関係

ORPHE-INSOLE.js は [ORPHE-CORE.js](https://github.com/Orphe-OSS/ORPHE-CORE.js) と互換性のあるAPI設計（`got*` コールバック、id 0/1 の2デバイスモデル、同一BLE UUID）を持ちますが、別ハードウェア・別SDKです。

| 観点 | ORPHE CORE | ORPHE INSOLE |
|---|---|---|
| クラス名 | `Orphe` | `OrpheInsole`（`Orphe` エイリアスあり※） |
| 圧力センサ | なし | **6ch (`gotPress`)** |
| STEP_ANALYSIS (gait/stride/pronation) | あり | **なし（FW対応待ち）** |
| LED制御 | `setLED()` | なし |
| データ設定 | `begin(type, {range})` | `setDataStreamingMode(1/3/4)` |
| Notification | STEP_ANALYSIS / SENSOR_VALUES / 両方 | SENSOR_VALUES のみ |

※ 同一ページに ORPHE-CORE.js が読み込まれていない場合のみ `Orphe` が INSOLE を指します。CORE と併用するページでは必ず `OrpheInsole` を使ってください。

**重要: `gait.direction` や `gotStride` 等を使うコードはINSOLEでは動きません。** 歩行イベントが必要な場合は圧力センサから自前で導出します（後述のパターン参照）。

## Project Overview

```
ORPHE-INSOLE.js/
├── src/
│   ├── ORPHE-INSOLE.js        # Main SDK
│   └── InsoleToolkit.js       # Connection UI toolkit
├── dist/
│   ├── orphe-insole.js        # ビルド済み（未圧縮）
│   └── orphe-insole.min.js    # ビルド済み（CDN配信対象）
├── examples/
│   ├── VISUALIZE/             # センサ可視化（推奨スターター）
│   ├── sensor-dashboard/      # 2台同時ダッシュボード
│   ├── hula-motion-sonifier/  # 動作の可聴化（Web Audio）
│   └── terminal/              # 生データデバッグ
├── tests/                     # node 単体テスト（npm test）
└── docs/                      # JSDoc
```

## Quick Start

### Pattern A: 最小構成（テスト用）

```html
<!DOCTYPE html>
<html>
<head>
  <script src="src/ORPHE-INSOLE.js"></script>
</head>
<body>
  <button onclick="insole.begin('SENSOR_VALUES')">Connect</button>
  <div id="output"></div>

  <script>
    var insole = new OrpheInsole(0);
    insole.setup();

    insole.gotPress = function(press) {
      // press.values は 6ch の ADC 生値
      document.getElementById('output').textContent = press.values.join(', ');
    };
  </script>
</body>
</html>
```

### Pattern B: InsoleToolkit使用（推奨）

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css">
  <script src="../../src/ORPHE-INSOLE.js"></script>
  <script src="../../src/InsoleToolkit.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/js/bootstrap.bundle.min.js"></script>
</head>
<body>
  <div id="toolkit_placeholder"></div>

  <script>
    // InsoleToolkit generates insoles[0] and insoles[1] globally
    buildInsoleToolkit(
      document.getElementById('toolkit_placeholder'),
      'ORPHE INSOLE',
      0,                                        // device ID (0 or 1)
      { streamingMode: 4, autoReconnect: true } // options
    );

    window.onload = function() {
      insoles[0].setup();

      insoles[0].gotPress = function(press) {
        console.log('Pressure:', press.values);
      };
      insoles[0].gotConvertedAcc = function(acc) {
        console.log('Acceleration [G]:', acc);
      };
    };
  </script>
</body>
</html>
```

## Data Streaming Modes - 最も重要な設計判断

`begin()` のオプション、または `setDataStreamingMode(mode)` で選択します。

| Mode | Data | Frequency | Use Case |
|---|---|---|---|
| `1` | quat + gyro + acc | 200Hz | 姿勢のみ高速取得（CORE互換） |
| `3` | gyro + acc + **press** | 200Hz | 圧力＋IMUの高速取得（クォータニオン不要時） |
| `4` | gyro + acc + **press** + quat | 100Hz | **全データ。デフォルト。迷ったらこれ** |

```
What does your app need?

├── 圧力 + 姿勢（quat/euler）も使う
│   └── Mode 4 (default)
├── 圧力のイベント検出を最高レートで（着地検出・リズム系）
│   └── Mode 3 (200Hz, quatなし → gotEulerも来ない)
└── 姿勢のみ・圧力不要
    └── Mode 1 (200Hz)
```

## API Reference

### OrpheInsole Class

```javascript
// Constructor
var insole = new OrpheInsole(id);  // id: 0 or 1 (supports 2 devices max)

// Initialization (MUST call before begin)
insole.setup();

// Start connection and data streaming
await insole.begin('SENSOR_VALUES', {
  streamingMode: 4,        // 1 | 3 | 4
  autoReconnect: true,     // 切断時に自動再接続
  reconnectIntervalMs: 3000,
  reconnectMaxAttempts: 120
});

// Stop / reset（マニュアル切断。autoReconnectも解除される）
insole.stop();
insole.reset();

// Streaming mode change while connected
await insole.setDataStreamingMode(3);

// Device info
await insole.getDeviceInformation();
// Returns: { battery: 0-2, mount_position, range: { acc, gyro } }
// mount_position bit0: 0=LEFT, 1=RIGHT / bit1: 0=足底, 1=足背

// デバイス選択ダイアログを強制表示（別のINSOLEに切り替えたいとき）
insole.selectBluetoothDevice();
insole.forgetLastBluetoothDevice();

// Analysis log reset
insole.resetAnalysisLogs();

// デバッグログ（接続トラブル調査時）
insole.debug = true;
```

### Data Callbacks - Override these to receive data

```javascript
// === 圧力（INSOLE固有・最重要） ===
insole.gotPress = function(press) {
  // press: {
  //   values: [p0, p1, p2, p3, p4, p5],  // 6ch ADC生値 (uint16)
  //   timestamp, serial_number, packet_number
  // }
  // 注意: チャネルの物理配置はモデルによって異なる場合があるため、
  // 配置依存のロジックにはチャネルリマップ層を挟むこと
};

// === IMU（CORE互換） ===
insole.gotAcc = function(acc) { };           // {x,y,z} normalized -1..1
insole.gotConvertedAcc = function(acc) { };  // {x,y,z} 実値[G]
insole.gotGyro = function(gyro) { };         // {x,y,z} normalized -1..1
insole.gotConvertedGyro = function(gyro) { };// {x,y,z} 実値[deg/s]
insole.gotQuat = function(quat) { };         // {w,x,y,z} (mode 1, 4のみ)
insole.gotEuler = function(euler) { };       // {pitch,roll,yaw} [rad] (mode 1, 4のみ)

// === Advertisement（接続前のステータス監視） ===
insole.gotStatus = function(status) {
  // { name, rssi, txPower, id, battery, model_type,
  //   mounting_position, human_activity_recognition, version }
};

// === Connection / quality events ===
insole.onConnect = function(uuid) { };
insole.onDisconnect = function() { };
insole.onError = function(error) { };
insole.gotBLEFrequency = function(frequency) { }; // 実測Hz
insole.lostData = function(serial, prevSerial) { }; // パケット欠損

// === Auto reconnect events ===
insole.onReconnectAttempt = function(info) { }; // {attempt, maxAttempts, intervalMs}
insole.onReconnectSuccess = function(info) { }; // {attempt, elapsedMs}
insole.onReconnectFailed  = function(info) { }; // {maxAttempts, error}
```

### InsoleToolkit.js

```javascript
buildInsoleToolkit(
  parent_element,   // DOM element to append UI
  title,            // 表示タイトル (e.g., 'Left Foot')
  insole_id,        // 0 or 1
  options           // { streamingMode: 4, autoReconnect: true }
);

// Global variables created by InsoleToolkit:
// var insoles = [new OrpheInsole(0), new OrpheInsole(1)];
// var bles = insoles;   // CORE互換エイリアス
// var cores = insoles;  // CORE互換エイリアス
```

接続後、ツールキットのヘッダには 実測周波数 / L・Rバッジ（mount_position から自動判定）/ バッテリー / 再接続ステータス / 設定（ストリーミングモード変更）が表示されます。

## Common Patterns

### Pattern 1: 接地検出（圧力合計＋ヒステリシス）

```javascript
const CONTACT_ON = 800;   // 接地判定しきい値（要キャリブレーション）
const CONTACT_OFF = 400;  // 離地判定しきい値（ヒステリシス）
let isContact = false;

insole.gotPress = function(press) {
  const total = press.values.reduce((a, b) => a + b, 0);

  if (!isContact && total > CONTACT_ON) {
    isContact = true;
    onFootDown(press.timestamp);   // 着地イベント
  } else if (isContact && total < CONTACT_OFF) {
    isContact = false;
    onFootUp(press.timestamp);     // 離地イベント
  }
};
```

### Pattern 2: 左右荷重バランス（2台接続）

```javascript
const totals = [0, 0];
for (let i = 0; i < 2; i++) {
  buildInsoleToolkit(document.getElementById(`toolkit${i}`), `INSOLE ${i}`, i);
}
window.onload = function() {
  for (let i = 0; i < 2; i++) {
    insoles[i].setup();
    insoles[i].gotPress = function(press) {
      totals[this.id] = press.values.reduce((a, b) => a + b, 0);
      const balance = totals[0] / (totals[0] + totals[1] + 1e-6); // 0..1
      updateBalanceUI(balance);
    };
  }
};
// 注意: insoles[0]が左足とは限らない。device_information.mount_position の
// bit0 (0=LEFT, 1=RIGHT) で実際の左右を判定して表示にマップすること。
```

### Pattern 3: 圧力中心（CoP）の推定

```javascript
// SENSOR_POSITIONS はモデルの物理配置に合わせて調整（単位は任意の足座標系）
const SENSOR_POSITIONS = [
  { x: -1, y:  2 }, { x: 1, y:  2 },   // 前足部
  { x: -1, y:  0 }, { x: 1, y:  0 },   // 中足部
  { x: -1, y: -2 }, { x: 1, y: -2 },   // 踵部
];

insole.gotPress = function(press) {
  const total = press.values.reduce((a, b) => a + b, 0);
  if (total < 100) return; // 接地していない
  let cx = 0, cy = 0;
  press.values.forEach((v, i) => {
    cx += SENSOR_POSITIONS[i].x * v;
    cy += SENSOR_POSITIONS[i].y * v;
  });
  drawCoP(cx / total, cy / total);
};
```

### Pattern 4: 可聴化（Web Audio）

```javascript
const ctx = new AudioContext();
const osc = ctx.createOscillator();
const gain = ctx.createGain();
gain.gain.value = 0;
osc.connect(gain).connect(ctx.destination);
osc.start();
// ユーザー操作（クリック等）の中で ctx.resume() を呼ぶこと

insole.gotPress = function(press) {
  const total = press.values.reduce((a, b) => a + b, 0);
  const norm = Math.min(1, total / 6000);  // 要キャリブレーション
  // 荷重→音量、前後バランス→ピッチ
  const front = press.values[0] + press.values[1];
  const heel = press.values[4] + press.values[5];
  const fb = front / (front + heel + 1e-6);
  gain.gain.setTargetAtTime(norm * 0.4, ctx.currentTime, 0.02);
  osc.frequency.setTargetAtTime(220 + fb * 440, ctx.currentTime, 0.02);
};
```

イベント駆動の可聴化（着地で音を鳴らす等）は Pattern 1 の接地イベントと組み合わせます。連続値の垂れ流しより、状態遷移時のみ発音する方が聴き取りやすくなります（examples/hula-motion-sonifier 参照）。

### Pattern 5: 高頻度データの描画スロットリング（CRITICAL）

```javascript
// WRONG - 100Hz で chart.update() するとタブが固まる
insole.gotPress = function(press) {
  chart.data.datasets[0].data.push(press.values[0]);
  chart.update();  // 重い！
};

// CORRECT - データはバッファに溜め、描画は rAF で 30fps に間引く
const buffer = [];
insole.gotPress = function(press) { buffer.push(press.values); };
(function render() {
  if (buffer.length) {
    for (const v of buffer.splice(0)) pushToChart(v);
    chart.update();
  }
  requestAnimationFrame(render);
})();
```

## Common Mistakes to Avoid

### 1. setup()を忘れる

```javascript
// WRONG
var insole = new OrpheInsole(0);
insole.begin('SENSOR_VALUES');  // Will fail!

// CORRECT
var insole = new OrpheInsole(0);
insole.setup();
insole.begin('SENSOR_VALUES');
```

### 2. アロー関数でコールバックを書く

```javascript
// WRONG - 'this' will be undefined
insole.gotPress = (press) => { console.log(this.id); };

// CORRECT
insole.gotPress = function(press) { console.log(this.id); };  // 0 or 1
```

### 3. CORE専用APIを呼ぶ

```javascript
// WRONG - INSOLEに存在しない
insole.setLED(1, 0);
insole.begin('STEP_ANALYSIS');         // SENSOR_VALUESに強制される
insole.gotGait = function(gait) {};    // 呼び出されない（FW対応待ち）

// CORRECT - 歩行イベントは圧力から導出する（Pattern 1）
```

### 4. 圧力生値を体重等の物理量として扱う

`press.values` は ADC 生値です。個体差・装着差があるため、物理量が必要な場合はアプリ起動時にキャリブレーション（無負荷時・全体重時のサンプリング）を行ってください。

### 5. gotData をデバッグ目的でオーバーライドしたまま放置

`gotData` をオーバーライドすると **他のすべての got* コールバックが停止**します（TERMINALモード）。

## Browser Compatibility

- **Required**: Web Bluetooth API
- **Supported**: Chrome (desktop/Android), Edge, Opera
- **NOT Supported**: Firefox, Safari (iOS/macOS)
- デバイス記憶による自動再接続には `navigator.bluetooth.getDevices()` が必要（Chrome では既定で有効。無効環境では選択ダイアログにフォールバック）

## Development

```bash
npm test            # 構文チェック + 単体テスト
npm run build       # dist/ を生成（terser）
npm run generate-docs  # JSDoc
```

ソースを編集したら必ず `npm test` と `npm run build` を実行してください。CDN利用者は `dist/orphe-insole.min.js` を読み込んでいます。

## Reference Examples

| App Type | Reference | Key Patterns |
|---|---|---|
| 可視化 | examples/VISUALIZE | 6chチャート、描画スロットリング |
| ダッシュボード | examples/sensor-dashboard | 2台接続、L/R自動マッピング |
| 可聴化 | examples/hula-motion-sonifier | Web Audio、状態遷移発音 |
| プロトコルデバッグ | examples/terminal | gotData生データ |
