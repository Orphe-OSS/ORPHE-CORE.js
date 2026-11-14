# Pose + ORPHE CORE

カメラの姿勢推定（ボーン）と ORPHE CORE のセンサー値を並べて表示する example です。
白背景では左にボーン、右に実写を縦長で並べ、カメラ重ねでは実写の上にボーンを重ねて表示します。

## このexampleで学べること

- ブラウザで動く姿勢推定（MediaPipe Pose Landmarker）の結果を、関節ごとに色分けしたボーン（BODY_25 形式）として描く方法
- 2台の ORPHE CORE のセンサー値と歩行解析の結果をリアルタイムに表示する方法
- 姿勢推定と CORE のステップ検出を組み合わせる方法（ステップを検出した足の足首をパルス表示）
- 画面・カメラ映像・CORE の生データ・姿勢をまとめて記録する方法（REC）

## 使うデータ

- 加速度 (gotConvertedAcc)、角速度 (gotConvertedGyro)
- クォータニオン (gotQuat)、オイラー角 (gotEuler)
- 歩行解析: Steps, Gait, Stride, Foot Angle, Landing Impact, Pronation

## 必要なもの

- ORPHE CORE 1〜2 台（CORE を接続しなくても姿勢推定は動きます）
- Webカメラ
- Chrome / Edge（Web Bluetooth）

## 起動方法

1. ローカルサーバを起動します。
2. ブラウザで `examples/POSE/` を開きます。
3. 「カメラ開始」を押してカメラを許可すると、姿勢推定が始まります。全身が映る位置に立ってください。
4. ヘッダーの `CORE 01` / `CORE 02` スイッチから ORPHE CORE へ接続します。
5. 各 CORE パネルで装着した足（左足 / 右足）を選びます。ヘッダーの ⇄ ボタンで、2台の左右をまとめて入れ替えられます（ホバーで今の割り当てを表示）。

GitHub Pagesでも試せます。

<https://orphe-oss.github.io/ORPHE-CORE.js/examples/POSE/>

## 画面

- **白背景 / カメラ重ね**: 白背景では 16:9 の画面を縦長 8:9 の 2 枚に分け、左にボーン、右に実写を並べます。カメラ重ねでは 16:9 の 1 枚に実写とボーンを重ねます。
  映像は高さ固定で、人の左右の移動に合わせて横にだけなめらかに動きます。
- **ステップ表示**: CORE がステップを検出すると、その CORE を付けた足の足首がパルス表示されます。
- **関節角度**: 膝・股関節・足首・肘の角度（1人目）。
- **CORE パネル**: 加速度グラフ、Acc / Gyro / Euler / Quaternion、Stride、Pronation、Steps、Gait、Foot Angle、Landing Impact、Distance、受信レート。
- **ミラー / PNG / 全画面**: 左右反転、骨格画像の保存、16:9 のままの全画面表示（スライド用）。

## REC（記録）

ツールバーの `REC`（または `R` キー）で記録を開始・停止します。停止すると次の内容を 1 つの zip にまとめて保存します。
時刻はすべて REC 開始からの経過ミリ秒 `t_ms` でそろえています。

| ファイル | 内容 |
| --- | --- |
| `screen.webm` | 画面の録画（スライド用） |
| `camera.webm` | カメラの生映像 |
| `core01_sensor.csv` / `core02_sensor.csv` | CORE のセンサー値 1 サンプル 1 行（正規化生値・G / deg/s 換算値・クォータニオン・オイラー角・CORE のタイムスタンプ） |
| `events.jsonl` | CORE の歩行解析イベント（steps / gait / stride / pronation など） |
| `pose.jsonl` | 姿勢推定の結果（MediaPipe 33 点の画像座標とワールド座標） |
| `meta.json` | 開始時刻・設定・CORE の情報・各動画の開始オフセット |

## Runtime assets

次のファイルを CDN から読み込むため、起動時にネット接続が必要です。

- [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker): `@mediapipe/tasks-vision@0.10.14`（jsDelivr）とモデル（Google Cloud Storage、Full モデル）
- JSZip `jszip@3.10.1`（jsDelivr、REC の zip 作成）

## 実機確認

- **実機確認済み** — Webカメラと ORPHE CORE 実機で動作を確認しています。
- 確認項目: 2台接続、センサー値の表示、ステップ時の足首パルス、⇄ ボタンでの左右入れ替え、REC の保存

## 関連example

- [`examples/GAME-KICK-CHALLENGE/`](../GAME-KICK-CHALLENGE/README.md) — Kick Challenge（姿勢推定と ORPHE CORE を使ったキックゲーム）
