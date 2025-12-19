# ORPHE CORE Sensor Sample Data

このディレクトリには、SENSOR-CALIBRATIONツールで記録した実際のセンサーデータを配置します。

## ファイル構成

```
sensor_samples/
├── README.md                    # このファイル
├── gesture_analysis.md          # ジェスチャー解析結果（エクスポート済み）
├── raw_data.json                # 生データ（JSON形式）
└── detection_patterns.md        # 検出パターンの推奨設定
```

## 使い方

### 1. データ記録

1. `examples/SENSOR-CALIBRATION/index.html` をブラウザで開く
2. ORPHE COREを接続
3. 各ジェスチャーボタンをクリックして記録
   - 歩行（Walk）: 3-5歩前進
   - 足踏み（Step in Place）: その場で3-5回足踏み
   - キック（Kick）: 前方にキック
   - ジャンプ（Jump）: 軽くジャンプ
   - 静止（Idle）: 立ったまま動かない
4. 各ジェスチャーを3-5回記録
5. 「Export for AI」ボタンでMarkdownとJSONをエクスポート

### 2. ファイル配置

エクスポートしたファイルをこのディレクトリに配置:

```bash
mv ~/Downloads/orphe_sensor_analysis_*.md ./gesture_analysis.md
mv ~/Downloads/orphe_sensor_raw_*.json ./raw_data.json
```

### 3. AIへの指示

CLAUDE.mdまたはプロンプトで以下のように指示:

```
ジェスチャー検出アルゴリズムを作成する前に、
docs/ai/sensor_samples/gesture_analysis.md と
docs/ai/sensor_samples/raw_data.json を参照して、
実際のセンサー特性に基づいたロジックを生成してください。
```

## データ形式

### raw_data.json

```json
{
  "exportDate": "2025-01-15T10:30:00.000Z",
  "totalRecordings": 15,
  "recordings": [
    {
      "id": "abc123",
      "gesture": "kick",
      "timestamp": "2025-01-15T10:25:00.000Z",
      "duration": 3000,
      "sampleCount": 450,
      "deviceInfo": {
        "coreVersion": "CORE 3.0",
        "notificationType": "STEP_ANALYSIS_AND_SENSOR_VALUES",
        "accRange": 16,
        "gyroRange": 2000,
        "mountPosition": "Left Instep"
      },
      "data": [
        {
          "timestamp": 0,
          "type": "acc",
          "data": { "x": 0.12, "y": -0.05, "z": 1.02 }
        },
        {
          "timestamp": 5,
          "type": "gyro",
          "data": { "x": 12.5, "y": -3.2, "z": 1.1 }
        },
        {
          "timestamp": 10,
          "type": "gait",
          "data": { "direction": 2, "steps": 5, "type": 1 }
        }
        // ...
      ]
    }
  ]
}
```

### gesture_analysis.md

自動生成されるMarkdownファイルには以下が含まれます:

- デバイス設定情報
- 各ジェスチャーの統計データ
  - 加速度の最大/最小/平均/標準偏差
  - 歩数変化
  - 方向分布
  - 着地衝撃

## 重要な発見事項

記録データから得られた知見は `detection_patterns.md` に記載してください。

例:
```markdown
## キック vs ジャンプの区別

### キックの特徴
- 加速度スパイク: 4.0-8.0G（瞬間的）
- 持続時間: 50-100ms
- 着地衝撃: なし
- gait.steps: 変化なし

### ジャンプの特徴
- 加速度: 2.0-3.0G（離陸時）
- 滞空期間: 0.3-0.5秒（加速度 < 0.5G）
- 着地衝撃: 1.5-4.0
- gait.steps: 変化なし

### 足踏みの特徴
- gait.direction: 2→4→2→4... と交互に変化
- gait.steps: 変化なし（前進していないため）
- 加速度: 1.5-2.5G（周期的）
```
