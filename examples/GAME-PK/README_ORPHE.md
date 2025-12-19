# ORPHE PENALTY KICK - センサー統合版

ORPHE COREセンサーを使ったペナルティキックゲームです。足を振ってキックを打ち、ゴールを決めましょう！

## 🎮 ゲームの特徴

- **3D視点**: モバイルPKゲームのような臨場感ある3Dグラフィック
- **リアルな物理演算**: ボールの軌道、重力、キーパーAIが高度にシミュレート
- **ORPHE CORE連携**: 足のセンサーでシュートを打つ革新的な体験
- **マウス操作対応**: センサーがなくてもマウスでプレイ可能
- **リアルタイムセンサー表示**: 加速度・ジャイロデータをグラフで可視化

## 📋 必要なもの

### センサーモードでプレイする場合
- ORPHE CORE デバイス **1個**
- Google Chrome ブラウザ (Bluetooth対応必須)
- MacOS, Windows, または Linux

### マウスモードでプレイする場合
- 任意のモダンブラウザ

## 🚀 起動方法

### ローカルHTTPサーバーで起動（推奨）

```bash
cd examples/GAME-PK
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080/index_orphe.html` を開く

### 直接ファイルを開く

```bash
open index_orphe.html
```

※ただし、一部のブラウザではCORS制限によりCDNのスクリプトが読み込めない場合があります。

## 🎯 操作方法

### マウス操作
1. STARTボタンをクリック
2. キャンバスをドラッグしてシュートの方向と強さを決める
3. マウスを離してキック！

### ORPHE COREセンサー操作
1. 「BLE接続」ボタンからORPHE COREデバイスを接続
2. STARTボタンをクリック
3. カウントダウン（3-2-1-GO!）が始まる
4. GOと表示されたら、足を強く振る
5. **キック検出条件**: 3軸加速度の合成値が閾値（デフォルト3.0G）を超える
6. 振った方向と強さでシュートの軌道が決まる

## ⚙️ センサー設定

### キック閾値 (Kick Threshold)
- 範囲: 1.0〜10.0 G
- デフォルト: 3.0 G
- 推奨: 体力に合わせて調整（強く振れる人は4.0-5.0G、軽めは2.0-3.0G）

### 左右感度 (Horizontal Sensitivity)
- 範囲: 0.5〜3.0
- デフォルト: 1.5
- 高くすると横方向の反応が敏感になる

### 上下感度 (Vertical Sensitivity)
- 範囲: 0.5〜3.0
- デフォルト: 1.5
- 高くすると縦方向（高さ）の反応が敏感になる

## 🧮 センサーアルゴリズム

### データ収集
カウントダウン後、常に最新20フレーム（約0.32秒）のセンサーデータをバッファリング

### キック検出
```
加速度合成値 = sqrt(ax² + ay² + az²)
```
この値が閾値を超えたらキック判定

### パワー計算
```
maxAccel = 20フレーム中の最大加速度
avgAccel = 20フレームの平均加速度
power = (maxAccel × 0.7 + avgAccel × 0.3) / 8.0
```
- パワーは0.0〜1.0に正規化
- 強く振るほど強いシュート

### 方向計算
```
yawValues = 20フレームのジャイロZ軸データ（左右回転）
pitchValues = 20フレームのジャイロY軸データ（上下回転）

avgYaw = yawValuesの平均
avgPitch = pitchValuesの平均

dx = avgYaw × 左右感度 × 200  （ピクセル）
dy = avgPitch × 上下感度 × 150  （ピクセル）
```
- 右に振ると右方向にシュート
- 上に振り上げると高いシュート

### ボール物理
- 初速度: baseBallSpeed × (0.5 + power × 0.5)
- 重力: 1400 px/s²
- スピードマルチプライヤー: 1.25x

## 🏆 ゲームルール

- 合計5本のシュート
- ゴールを決めるとスコア +1
- ゴールポストに当たると無得点
- キーパーにセーブされると無得点
- 外すと無得点
- 最終的なスコアと成功率が表示される

## 🎨 技術仕様

### フロントエンド
- HTML5 Canvas (1200×800px)
- JavaScript (ES6+)
- Bootstrap 5 (UI)
- Web Audio API (効果音)

### センサー連携
- ORPHE-CORE.js (Bluetooth LE通信)
- CoreToolkit.js (接続UI)
- サンプリングレート: 約60Hz (16ms間隔)
- バッファサイズ: 20フレーム

### ゲームエンジン
- game_3d.js (1842行)
  - CFG: ゲーム設定
  - SoundSystem: 効果音生成
  - ParticleSystem: パーティクル演出
  - Game: メインゲームループ

## 📊 デバッグ情報

### ブラウザコンソールで確認できる情報
- `[GAME-PK 3D] Initialized successfully` - ゲーム初期化成功
- `[PK] Starting sensor recording...` - センサー記録開始
- `[PK] Kick detected:` - キック検出時の詳細データ
  - power: パワー（%）
  - maxAccel / avgAccel: 加速度データ
  - dx / dy: 方向データ
  - yawDelta / pitchDelta: ジャイロ変化量

### センサーグラフ
リアルタイムで以下を可視化：
- 加速度合成値 (0-15G範囲、閾値ラインあり)
- ジャイロYaw (-5〜+5 rad/s)
- ジャイロPitch (-5〜+5 rad/s)

### 動作ステータス
- 待機中 / Waiting: 通常状態
- データ記録中... / Recording...: カウントダウン後のバッファリング中
- キック検出！/ Kick Detected!: 閾値を超えた瞬間

## 🐛 トラブルシューティング

### センサーが接続できない
- Google Chromeを使用しているか確認
- Bluetoothが有効になっているか確認
- ORPHE COREデバイスの電源が入っているか確認
- 一度ページをリロードして再試行

### キックが検出されない
- キック閾値を下げてみる（2.0G程度）
- センサーグラフで加速度が閾値を超えているか確認
- デバイスがしっかり足に装着されているか確認

### シュートの方向がおかしい
- 左右感度/上下感度を調整
- センサーの向きが正しいか確認
- ジャイログラフで値が変化しているか確認

### ゲームがフリーズする
- ブラウザコンソールでエラーを確認
- ページをリロード
- ブラウザのキャッシュをクリア

## 📝 開発ログ

### センサーロジックテスト結果
```
Test 1: Strong Kick (Right) - 86% power, dx=427.5px
Test 2: Weak Kick (Straight) - 39% power, dx=71.2px  
Test 3: Corner Kick (Top-Right) - 75% power, dx=356.3px, dy=213.7px
```
全テスト合格 ✅

### ファイル構成
- `index_orphe.html` - メインHTML（573行）
- `game_3d.js` - ゲームエンジン（1842行）
- `test_sensor_logic.js` - センサーアルゴリズムテスト

## 🔗 リンク

- [ORPHE公式サイト](https://orphe.io/)
- [ORPHE-CORE.js GitHub](https://github.com/Orphe-OSS/ORPHE-CORE.js)
- [ORPHE-CORE.js ドキュメント](https://orphe-oss.github.io/ORPHE-CORE.js/)

## 📄 ライセンス

このゲームはオープンソースの[ORPHE-CORE.js](https://github.com/Orphe-OSS/ORPHE-CORE.js)を使用しています。

---

**楽しんでプレイしてください！⚽✨**
