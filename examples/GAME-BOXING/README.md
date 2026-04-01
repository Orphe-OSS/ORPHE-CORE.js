# ORPHE Fight Core 🥊

ORPHE CORE モジュールを使ったリアルタイム・ボクシング音ゲーです。左右の手にセンサーを装着し、パンチの動きを検出してスコアを競います。

[![ORPHE CORE JS](https://img.shields.io/badge/ORPHE-CORE%20JS-blue)](https://github.com/Orphe-OSS/ORPHE-CORE.js)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 🎮 デモ

GitHub Pages でプレイ可能（予定）:
```
https://[your-username].github.io/orphe-fight-core/
```

## ✨ 特徴

- 🎯 **リアルタイムセンサーデータ可視化** - 加速度・ジャイロの波形をリアルタイム表示
- 🥊 **高精度パンチ検出** - 二重閾値法による正確な動作認識
- 🎵 **音ゲー風ゲームプレイ** - ノーツが落ちてくるタイミングでパンチ
- 📊 **動的スコアリング** - パンチの威力とタイミングで得点計算
- ⚙️ **個別キャリブレーション** - ユーザーごとの最大速度を測定
- 🎨 **視覚的フィードバック** - パーティクルエフェクトとアニメーション
- 🔧 **柔軟な設定** - 難易度・閾値・判定窓などを調整可能

## 🚀 クイックスタート

### オンラインでプレイ（推奨）

GitHub Pages にデプロイすれば、すぐにプレイできます：

1. このリポジトリを GitHub にプッシュ
2. Settings → Pages → Source を `main` ブランチに設定
3. 公開された URL にアクセス

### ローカルで実行

Web Bluetooth API は HTTPS が必須なので、ローカルサーバーを起動：

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -p 8000

# PHP
php -S localhost:8000
```

ブラウザで `http://localhost:8000` にアクセス。

> **注意**: Web Bluetooth API は Chrome/Edge のみ対応。Firefox/Safari は未対応です。

## 📖 使い方

### 1. デバイス接続

1. 左手・右手の「接続」ボタンをクリック
2. ORPHE CORE デバイスを選択してペアリング
3. 接続成功すると、センサーデータがリアルタイム表示されます

### 2. キャリブレーション

1. 「最大速度測定」ボタンをクリック
2. 5秒間、全力でパンチを繰り返す
3. 基準値が自動設定されます

> キャリブレーションをスキップすると、デフォルト値（10 m/s²）が使用されます。

### 3. ゲーム開始

1. 難易度を選択（初級・中級・上級）
2. 「ゲーム開始」ボタンをクリック
3. 画面上部から落ちてくるノーツに合わせてパンチ！

### 4. スコアリング

- **Perfect**: ±100ms 以内 → 満点
- **Good**: ±200ms 以内 → 減点
- **Miss**: 判定窓外 → コンボリセット
- **コンボボーナス**: 連続ヒットで追加点

## 🛠️ 技術仕様

### パンチ検出アルゴリズム

#### 合成加速度の計算

```javascript
resultant = √(ax² + ay² + az²)
```

#### 二重閾値法

- **下限閾値** (2.0 m/s²): イベントの開始・終了を検出
- **上限閾値** (15.0 m/s²): パンチ動作として認識

#### スコア計算式

```javascript
powerRatio = min(punchPower / maxAcceleration, 1.0)
timingBonus = max(1.0 - (reactionTime / targetTimeWindow), 0.2)
baseScore = floor(powerRatio * 100 * timingBonus)
comboBonus = floor(baseScore * (combo * 0.1))
totalScore = baseScore + comboBonus
```

### 対応ファームウェア

このプロジェクトは以下のパケット形式に対応しています：

| ヘッダ | パケット長 | 説明 |
|--------|-----------|------|
| **40** | 可変 | 通常の update sensor values |
| **50** | 92 バイト | 200Hz 魔改造版（旧FW） |
| **50** | 104 バイト | 200Hz 拡張版（新FW） |

> 未知のヘッダでも、17バイト以上あればフォールバック処理で動作を試みます。

## ⚙️ 設定項目

### ゲーム設定

- **難易度**: 初級（1個）/ 中級（2個）/ 上級（3個）
- **コンビネーション間隔**: 300 - 1000 ms
- **楽曲ノーツ数**: 10 - 30 個
- **判定窓**: 1.0 - 3.0 秒
- **ノーツ落下速度**: 2.0 - 5.0 秒

### パンチ検出設定

- **下限閾値**: 1.0 - 5.0 m/s²（ノイズ除去）
- **上限閾値**: 5.0 - 30.0 m/s²（パンチ検出感度）

## 📁 ファイル構成

```
orphe-fight-core/
├── index.html              # メインHTML
├── css/
│   └── style.css           # スタイルシート
├── js/
│   ├── ORPHE-CORE.js       # ORPHE COREライブラリ（改良版）
│   ├── float16.js          # Float16サポート
│   ├── quaternion.js       # クォータニオン計算
│   ├── chart.js            # Chart.js（グラフ描画）
│   └── game.js             # ゲームロジック
├── images/
│   └── normal.png          # 対戦相手の顔画像
├── README.md               # このファイル
└── CHANGELOG.md            # 変更履歴
```

## 🐛 トラブルシューティング

### センサーバリューが取れない

**症状**: デバイスは接続できているが、グラフが更新されない

**原因と対処法**:

1. **ファームウェアのパケット形式が異なる**
   - ブラウザの開発者ツール（F12）を開く
   - Console タブで以下のログを確認：
   ```
   [SENSOR_VALUES] Header: XX, Length: YY bytes
   ```
   - ヘッダが 40 または 50 以外の場合、対応が必要

2. **DEVICE_INFORMATION が読み込まれていない**
   - Console に `Cannot read property 'gyro' of undefined` が出ていないか確認
   - デバイス接続後、自動的に読み込まれるはず

3. **Notify が開始されていない**
   - Console に `onStartNotify SENSOR_VALUES` が出ているか確認
   - 出ていない場合、Bluetooth 接続を確認

### グラフは更新されるが、パンチが検出されない

- キャリブレーションを実行
- 上限閾値を下げる（設定パネルで調整）
- センサーパネルで合成加速度の値を確認

### 接続が頻繁に切れる

- デバイスのバッテリーを確認
- Bluetooth の通信範囲内にいるか確認
- 他の Bluetooth デバイスとの干渉を確認

### GitHub Pages で動作しない

- **HTTPS が必須**: GitHub Pages は自動的に HTTPS になるので問題なし
- **相対パス**: すべてのリソースは相対パスなので問題なし
- **ブラウザ**: Chrome または Edge を使用（Firefox/Safari は Web Bluetooth 未対応）

## 🔧 開発者向け情報

### カスタマイズ

#### パンチ検出感度の調整

```javascript
// game.js 内で変更可能
this.lowerThreshold = 2.0;    // 下限閾値
this.upperThreshold = 15.0;   // 上限閾値
this.punchWindow = 500;       // パンチ検出間隔(ms)
```

#### ゲームバランスの調整

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

### デバッグモード

ORPHE CORE が接続されていない場合、10秒後に自動的にデバッグモードが開始され、擬似センサーデータが生成されます。

### ORPHE-CORE.js の改良点

このプロジェクトの `ORPHE-CORE.js` は、公式版（v1.3.0）に以下の改良を加えています：

1. **デバッグログの追加**: パケットのヘッダとサイズを自動ログ出力
2. **104バイトパケット対応**: 新しいFWの拡張パケットに対応
3. **フォールバック処理**: 未知のヘッダでも解析を試みる
4. **エラーハンドリング強化**: オプショナルチェーンでクラッシュを防止

詳細は [CHANGELOG.md](CHANGELOG.md) を参照。

## 📋 必要要件

### ブラウザ

- Chrome 56+ または Edge 79+（Web Bluetooth API 対応）
- HTTPS 環境（GitHub Pages は自動的に HTTPS）

### デバイス

- ORPHE CORE モジュール（左右ペア推奨）
- Bluetooth 4.0 以上対応環境

### 依存ライブラリ

- [ORPHE-CORE.js](https://github.com/Orphe-OSS/ORPHE-CORE.js) - センサーデータ取得
- [Chart.js](https://www.chartjs.org/) - リアルタイムグラフ表示
- [float16.js](https://github.com/petamoriken/float16) - 16bit 浮動小数点サポート
- [quaternion.js](https://github.com/infusion/Quaternion.js) - クォータニオン計算

## 🎉 高スコアのコツ

1. **正確なキャリブレーション**: 全力でパンチして正しい基準値を設定
2. **タイミング重視**: ノーツが判定ラインに到達した瞬間にパンチ
3. **コンボ維持**: 連続ヒットでボーナス点を獲得
4. **威力とスピード**: バランスの取れたパンチング
5. **難易度を上げる**: 上級モードで高得点を狙う

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## 🙏 謝辞

- [ORPHE-OSS](https://github.com/Orphe-OSS) - ORPHE CORE JS ライブラリ
- [Chart.js](https://www.chartjs.org/) - グラフ表示ライブラリ
- [petamoriken/float16](https://github.com/petamoriken/float16) - Float16 サポート
- [infusion/Quaternion.js](https://github.com/infusion/Quaternion.js) - クォータニオン計算

## 🤝 コントリビューション

バグ報告・機能リクエスト・プルリクエストを歓迎します！

---

**楽しいボクシングゲーム体験をお楽しみください！** 🥊💪
