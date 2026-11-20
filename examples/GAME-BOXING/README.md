# ORPHE Fight Core 🥊

ORPHE CORE モジュールを使ったリアルタイム・ボクシング音ゲーです。左右の拳（手の甲側）にセンサーを装着し、パンチの動きを検出してスコアを競います。

> **Status**: `public`（カタログ掲載） ／ **実機確認**: 未記録 — 静的検証（パス・参照・単位の整合）と説明用モードの表示確認のみ。
> 実機での感度確認は [`docs/device-validation-log.md`](../../docs/device-validation-log.md) を参照してください。

## 🎮 デモ

GitHub Pages でプレイできます:

```text
https://orphe-oss.github.io/ORPHE-CORE.js/examples/GAME-BOXING/
```

## ✨ 特徴

- 🎯 **リアルタイムセンサーデータ可視化** - 加速度（G）・ジャイロ（°/s）の波形をリアルタイム表示
- 🥊 **パンチ検出** - 合成加速度の閾値判定による動作認識
- 🎵 **音ゲー風ゲームプレイ** - ノーツが落ちてくるタイミングでパンチ
- 📊 **自分の基準に対するスコアリング** - 基準測定で決めた最大加速度に対する比率とタイミングで得点計算
- ⚙️ **個別の基準測定** - 参加者ごとにピーク合成加速度の基準値を測定
- 🎨 **視覚的フィードバック** - パーティクルエフェクトとアニメーション
- 🔧 **柔軟な設定** - 難易度・閾値・判定窓などを調整可能
- 🧪 **説明用モード** - ORPHE CORE が無くても画面の動きを確認できる（実測とは区別）

## 🚀 クイックスタート

### ローカルで実行

Web Bluetooth API は HTTPS または `localhost` が必須なので、リポジトリのルートでローカルサーバーを起動します:

```bash
# Python 3
python3 -m http.server 8767

# Node.js
npx http-server -p 8767
```

ブラウザで `http://localhost:8767/examples/GAME-BOXING/` にアクセス。

> **注意**: Web Bluetooth API は Chrome/Edge のみ対応。Firefox/Safari は未対応です。

SDK はリポジトリ同梱の `../../js/ORPHE-CORE.js`（現行版）を読み込みます。このフォルダに SDK のコピーは置いていません。

## 📖 使い方

### 0. 装着

- ORPHE CORE を左右それぞれの **拳（手の甲側）** に固定します（グローブやリストバンドに挟む、テープで留める等）。足ではなく手に付けるため、`STEP_ANALYSIS`（歩行解析）は使いません。
- 歩行解析系のコールバック（`gotGait` 等）はこのゲームでは意味を持ちません。

### 1. デバイス接続

1. 左手・右手の「接続」ボタンをクリック
2. ORPHE CORE デバイスを選択してペアリング
3. 接続成功すると、センサーデータがリアルタイム表示されます

接続時に加速度レンジ **±16 G**・ジャイロレンジ **±2000 °/s** を指定します（`begin('SENSOR_VALUES', { range: { acc: 16, gyro: 2000 } })`）。
閾値・基準値は G 単位なので、デバイス側の既定レンジが ±8 G 等のままだと既定の上限閾値 15 G に届かず、パンチが検出されません。

### 2. 基準の測定（キャリブレーション）

1. 「基準を測る（5秒・最大合成加速度）」ボタンをクリック
2. 5秒間、**自分が無理なく出せる速さ**でパンチを繰り返す（競技的に遊ぶときは全力で測ってもよい）
3. その間の最大合成加速度が基準値になります

> 基準の測定をスキップすると、既定値 **10 G** が基準値として使われます。
> 基準値は「その人の動き」に対する比率を決めるための値で、体力や筋力の測定値ではありません。

### 3. ゲーム開始

1. 難易度を選択（初級・中級・上級）
2. 「ゲーム開始」ボタンをクリック
3. 画面上部から落ちてくるノーツに合わせてパンチ！

### 4. スコアリング

- **Perfect**: ±100ms 以内 → 満点
- **Good**: ±200ms 以内 → 減点
- **Miss**: 判定窓外 → コンボリセット
- **コンボボーナス**: 連続ヒットで追加点

### 説明用モード（擬似データ）

ORPHE CORE が無い環境で画面の動きを見せるためのモードです。ヘッダーの「説明用モード（擬似データ）を開始」ボタンで明示的に開始し、画面上部に「実測ではありません」のバナーが出ます。

- 擬似データはチャートと数値表示にだけ流れます。**基準の測定とゲーム開始はできない**ので、説明用のスコアが実測結果に混ざることはありません。
- ORPHE CORE を接続すると説明用モードは自動で終了します。
- 旧版にあった「未接続のまま 10 秒で自動開始」は廃止しました。

## 🛠️ 技術仕様

### 単位

| 値 | 取得元 | 単位 |
|---|---|---|
| 加速度 x/y/z | `gotConvertedAcc` | G（レンジ ±16 G） |
| 合成加速度 | `√(x² + y² + z²)` | G（静止時 ≈ 1 G） |
| ジャイロ x/y/z | `gotConvertedGyro` | °/s |
| 基準値・閾値 | 画面の設定 | G |

画面の表示・設定スライダー・閾値判定・基準値はすべて G で統一しています（2026-10-09 まで、処理は G のまま画面の単位表記が誤って SI 単位（メートル毎秒毎秒）になっていました）。

### パンチ検出

```javascript
resultant = √(ax² + ay² + az²)   // [G]
if (resultant > upperThreshold)  // 既定 15.0 G
```

- **上限閾値**（既定 15.0 G）: 直近 500 ms にパンチが無く、合成加速度が上限閾値を超えたらパンチとして認識。直近 10 サンプルの最大値をそのパンチのピーク加速度にします。
- **下限閾値**（既定 2.0 G）: 設定スライダーは残していますが、**現在の判定処理では使っていません**（将来、イベントの開始・終了検出に使う予定の値）。
- パンチ検出間隔: 500 ms

### スコア計算式

```javascript
powerRatio = min(peakAcceleration / baseline, 1.0)   // 基準値に対する比率（0–1）
timingMultiplier = perfect ? 1.0 : 0.8
baseScore = floor(powerRatio * 100 * timingMultiplier)
comboBonus = floor(baseScore * (combo * 0.1))
totalScore = baseScore + comboBonus
```

`peakAcceleration` はパンチの力・速度の測定値ではなく、ゲーム用の「勢い」の指標です。画面でも「パンチの勢い（基準比）」「平均ピーク加速度 (G)」と表記しています。

### 対応ファームウェア

パケットの解釈（ヘッダ 40 = CORE 2.0 / ヘッダ 50 = CORE 1.x・3.0 の 200 Hz）は SDK 側（`js/ORPHE-CORE.js`）が行います。このゲーム固有の対応はありません。

## ⚙️ 設定項目

### ゲーム設定

- **難易度**: 初級（1個）/ 中級（2個）/ 上級（3個）
- **コンビネーション間隔**: 300 - 1000 ms
- **楽曲ノーツ数**: 10 - 30 個
- **判定窓**: 1.0 - 3.0 秒
- **ノーツ落下速度**: 2.0 - 5.0 秒

### パンチ検出設定

- **下限閾値**: 1.0 - 5.0 G（現在は判定に未使用）
- **上限閾値**: 5.0 - 16.0 G（パンチ検出感度。レンジ ±16 G を超える値は設定できません）

## 📁 ファイル構成

```text
examples/GAME-BOXING/
├── index.html              # メインHTML
├── css/
│   └── style.css           # スタイルシート
├── js/
│   ├── chart.js            # Chart.js（グラフ描画・同梱コピー）
│   └── game.js             # ゲームロジック
├── images/
│   ├── normal.png          # 対戦相手の顔画像
│   └── guf.png             # 被弾時の顔画像
├── music/                  # BGM・効果音
└── README.md               # このファイル
```

SDK（`ORPHE-CORE.js`・`float16.min.js`・`quaternion.js`）はリポジトリ直下の `js/` から読み込みます。

## 🐛 トラブルシューティング

### センサー値が取れない

**症状**: デバイスは接続できているが、グラフが更新されない

1. ブラウザの開発者ツール（F12）の Console にエラーが出ていないか確認
2. `ble.debug = true` 相当の進行ログが必要なら、SDK の `debug` を有効にする（[CLAUDE.md](../../CLAUDE.md) 参照）
3. Bluetooth 接続を確認し、「切断」→「接続」をやり直す

### グラフは更新されるが、パンチが検出されない

- 接続時のレンジ指定（±16 G）が効いているか、合成加速度が静止時に約 1 G になっているか確認
- 上限閾値を下げる（設定パネルで調整）
- センサーパネルで合成加速度の値を確認

### 接続が頻繁に切れる

- デバイスのバッテリーを確認
- Bluetooth の通信範囲内にいるか確認
- 他の Bluetooth デバイスとの干渉を確認

## 🔧 開発者向け情報

### パンチ検出感度の調整

```javascript
// game.js 内で変更可能（単位: G）
this.lowerThreshold = 2.0;    // 下限閾値（現在未使用）
this.upperThreshold = 15.0;   // 上限閾値
this.punchWindow = 500;       // パンチ検出間隔(ms)
```

### ゲームバランスの調整

```javascript
// タイミング設定
this.fallSpeed = 3000;        // ノーツ落下時間(ms)
this.comboInterval = 600;     // コンビネーション間隔(ms)

// 判定窓
this.hitWindow = {
    perfect: 100,             // ±100ms
    good: 200                 // ±200ms
};
```

### 検証

`npm run test:examples`（`tests/example-boxing-units.test.js`）が、画面の単位表記（G）・既定値（閾値 2.0 / 15.0 G、基準値 10 G）・レンジ指定・説明用モードの明示開始が README・HTML・game.js で一致していることと、閾値判定の基本動作を確認します。

## ✅ 実機確認が必要な項目

- 接続時に `range: { acc: 16, gyro: 2000 }` を指定するようにした変更（2026-10-09）は感度に影響します。実機で、通常のパンチで上限閾値 15 G を超えること、静止時の合成加速度が約 1 G になることを確認してください。
- 確認したら [`docs/device-validation-log.md`](../../docs/device-validation-log.md) に機材・FW・ブラウザ・装着位置・確認日を記録してください。

## 📋 必要要件

### ブラウザ

- Chrome 56+ または Edge 79+（Web Bluetooth API 対応）
- HTTPS 環境または `localhost`

### デバイス

- ORPHE CORE モジュール（左右ペア推奨）
- Bluetooth 4.0 以上対応環境

### 依存ライブラリ

- [ORPHE-CORE.js](https://github.com/Orphe-OSS/ORPHE-CORE.js) - センサーデータ取得
- [Chart.js](https://www.chartjs.org/) - リアルタイムグラフ表示
- [float16.js](https://github.com/petamoriken/float16) - 16bit 浮動小数点サポート（SDK が読み込み）
- [quaternion.js](https://github.com/infusion/Quaternion.js) - クォータニオン計算（SDK が読み込み）

## 📄 利用条件

適用範囲が 3 つに分かれます。

| 対象 | 条件 |
|---|---|
| このゲーム独自のコード（`index.html`・`css/`・`js/game.js`） | 作者（tomiyata, 2026-04）の表記どおり **MIT ライセンス**。ただしこのフォルダに LICENSE ファイルは同梱されていません（要整備） |
| 読み込んでいる SDK `js/ORPHE-CORE.js` | ORPHE-CORE.js の[利用方針](../../LICENSE.md)（v1.4.0 以降は source-available。教育・非商用は無償、商用は別途契約） |
| 第三者ライブラリ（`js/chart.js` = Chart.js） | [Chart.js の MIT ライセンス](https://github.com/chartjs/Chart.js/blob/master/LICENSE.md) |
| 画像（`images/`）・音（`music/`） | 出典・利用条件は未記録（要確認）。公開会場での利用前に確認してください |

## 🙏 謝辞

- [ORPHE-OSS](https://github.com/Orphe-OSS) - ORPHE CORE JS ライブラリ
- [Chart.js](https://www.chartjs.org/) - グラフ表示ライブラリ
- [petamoriken/float16](https://github.com/petamoriken/float16) - Float16 サポート
- [infusion/Quaternion.js](https://github.com/infusion/Quaternion.js) - クォータニオン計算

---

**楽しいボクシングゲーム体験をお楽しみください！** 🥊💪
