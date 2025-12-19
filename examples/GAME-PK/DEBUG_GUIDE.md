# 🔍 ORPHE PENALTY KICK - デバッグガイド

## デバッグモードの有効化

デバッグモードは**常時ON**になっています（`DEBUG_MODE = true`）

## デバッグ機能一覧

### 1. ブラウザコンソールログ

ブラウザの開発者ツールを開く（F12 または Cmd+Option+I）

#### ログカテゴリ

| カテゴリ | 説明 | 確認内容 |
|---------|------|---------|
| **[INIT]** | 初期化プロセス | ページ読み込み、ライブラリ初期化 |
| **[BLE]** | Bluetooth接続 | 接続成功/失敗、デバイス情報 |
| **[SENSOR]** | センサーデータ | 加速度・ジャイロの生データ（最初5回 + 2秒ごと） |
| **[BUFFER]** | データバッファ | バッファ状態、サイズ、閾値との比較 |
| **[KICK]** | キック検出 | キックトリガー、パワー計算、方向計算 |
| **[RECORDING]** | 記録状態 | 記録開始/停止、センサー接続状態 |
| **[UI]** | UIイベント | ボタンクリック、画面遷移 |
| **[CHECK]** | 状態確認 | 接続チェック、データ受信数 |

### 2. デバッグコンソール（ページ内）

**表示方法**: 設定パネル下部の「🔍 Show Debug Console」ボタンをクリック

**機能**:
- リアルタイムログ表示（カラーコード付き）
- 最大100エントリ自動削除
- Clearボタンでログクリア

**表示内容**:
- タイムスタンプ付きログ
- カテゴリ別カラーコーディング
- JSON形式のデータ表示

### 3. データカウンター

**場所**: 「センサー状態」セクション

**表示内容**:
```
受信データ / Data Received: Acc: 123 | Gyro: 456
```

- **Acc**: 加速度データ受信回数
- **Gyro**: ジャイロデータ受信回数

**期待値**: 
- 両方とも増加していれば正常
- 片方だけ増加 → センサーの問題
- 両方0 → 接続未確立

## BLE接続のデバッグ

### 接続プロセスのログ確認

```javascript
// 1. 初期化
[INIT] Creating Orphe instance...
[INIT] Calling ble.setup()...
[INIT] Building CoreToolkit UI...

// 2. 接続ボタンクリック後
[BLE] 🔵 onConnect callback triggered
[BLE] Device info: { id: 0, name: "ORPHE_XXXX", connected: true }
[BLE] Starting data stream: SENSOR_VALUES
[BLE] Setting up data callbacks...

// 3. データ受信開始
[SENSOR] 📊 Acc data #1: { x: "0.123", y: "0.456", z: "0.789", mag: "0.950G" }
[SENSOR] 🌀 Gyro data #1: { x: "0.001", y: "0.002", z: "0.003" }
```

### 問題パターンと対処法

#### ❌ パターン1: onConnectが呼ばれない

**ログ**: 
```
[INIT] Building CoreToolkit UI...
（以降何も出ない）
```

**原因**:
- デバイスの電源が入っていない
- Bluetoothが無効
- ペアリング選択をキャンセル
- ブラウザのBluetooth権限がない

**対処**:
1. デバイスのLEDが点灯しているか確認
2. システム設定でBluetoothがONか確認
3. Google Chromeを使用しているか確認
4. ページを再読み込みして再試行

#### ❌ パターン2: 接続したがデータが来ない

**ログ**:
```
[BLE] 🔵 onConnect callback triggered
[BLE] Starting data stream: SENSOR_VALUES
（Acc/Gyroデータが出ない）
```

**原因**:
- `begin('SENSOR_VALUES')`が失敗
- コールバックが正しく設定されていない
- デバイスのファームウェア問題

**対処**:
1. コンソールでエラーメッセージを確認
2. デバイスを再起動
3. 一度切断して再接続
4. ページを再読み込み

#### ❌ パターン3: AccまたはGyroの片方しか来ない

**ログ**:
```
[SENSOR] 📊 Acc data #5: ...
（Gyroデータが出ない、または逆）
```

**原因**:
- センサーの部分的な故障
- ファームウェアの問題

**対処**:
1. デバイスを再起動
2. 別のデバイスで試す
3. ファームウェア更新

## キック検出のデバッグ

### 記録開始の確認

```javascript
[RECORDING] ▶️ Starting sensor recording...
[RECORDING] Sensor connection status: { 
  isConnected: true, 
  accDataReceived: 234, 
  gyroDataReceived: 234 
}
[RECORDING] ✅ Recording active, buffer cleared
```

### バッファリング状態

```javascript
[BUFFER] Buffer full (20), current accMag: 2.34G, threshold: 3.0G
```

**確認ポイント**:
- `bufferSize` が20に達しているか
- `current accMag` が閾値に近づいているか

### キック検出時のログ

```javascript
[KICK] 🎯 KICK TRIGGERED! {
  accMag: "5.67G",
  threshold: "3.0G",
  bufferSize: 20
}

[KICK] 🚀 Processing kick from sensor data...

[KICK] 📈 Sensor buffer analysis: {
  bufferSize: 20,
  timeSpan: "320ms"
}

[KICK] ⚡ Acceleration analysis: {
  maxAccel: "5.67G",
  avgAccel: "3.45G",
  minAccel: "1.23G",
  power: "65.3%",
  rawPower: "0.653"
}

[KICK] 🌀 Gyro analysis: {
  yaw: {
    avg: "2.345 rad/s",
    min: "0.123",
    max: "4.567",
    delta: "4.444"
  },
  pitch: {
    avg: "1.234 rad/s",
    min: "0.012",
    max: "2.456",
    delta: "2.444"
  }
}

[KICK] 🎯 Final shot parameters: {
  power: "65%",
  dx: "703.5 px",
  dy: "277.7 px",
  sensitivity: { yaw: 1.5, pitch: 1.5 }
}
```

### バッファフレーム詳細

デバッグモードON時、最初と最後の3フレームを詳細表示：

```javascript
📊 Buffer first 3 frames:
  Frame 0: {
    acc: "(0.12, 0.34, 1.56)",
    accMag: "1.61G",
    gyro: "(0.001, 0.002, 0.003)"
  }
  ...

📊 Buffer last 3 frames:
  Frame 17: {
    acc: "(0.56, 0.78, 5.67)",
    accMag: "5.73G",
    gyro: "(0.123, 1.234, 2.345)"
  }
  ...
```

## トラブルシューティング手順

### Step 1: 初期化確認

```javascript
// コンソールで確認
typeof ble          // "object"
typeof Orphe        // "function"
ble.isConnected     // false (接続前) / true (接続後)
```

### Step 2: 接続確認

1. 「BLE接続」ボタンをクリック
2. デバイス選択ポップアップが表示されるか
3. デバイスを選択後、`[BLE] onConnect`が出るか
4. データカウンターが増加するか

### Step 3: センサーデータ確認

```javascript
// コンソールで手動確認
window.isSensorConnected()  // true

// 現在のセンサー値（グローバル変数）
currentSensorData
// { acc: {x, y, z}, gyro: {x, y, z} }
```

### Step 4: キック検出確認

1. STARTボタン → カウントダウン
2. GO後、足を振る
3. 加速度グラフが閾値（オレンジライン）を超えるか
4. `[KICK] KICK TRIGGERED!`が出るか
5. ボールが発射されるか

### Step 5: パラメータ調整

キックが検出されない場合：

```javascript
// コンソールで閾値を下げる
kickThreshold = 2.0  // デフォルト: 3.0

// または、スライダーで調整
```

## 便利なコンソールコマンド

### 接続状態確認
```javascript
window.isSensorConnected()
```

### センサーデータ確認
```javascript
currentSensorData
```

### バッファ状態確認
```javascript
sensorBuffer.length
sensorBuffer
```

### 記録状態確認
```javascript
isWaitingForKick
```

### 設定値確認
```javascript
console.log({
  kickThreshold,
  yawSensitivity,
  pitchSensitivity
})
```

### データ受信数確認
```javascript
console.log({ accDataCount, gyroDataCount })
```

### 強制的にキックシミュレート（テスト用）
```javascript
// マウスモードで試す
window.game.shootFromSensor(100, 50, 0.8)
```

## ログの見方

### 🟢 正常なログパターン

```
[INIT] 系統 → [BLE] 系統 → [SENSOR] 定期的 → [RECORDING] → [KICK]
```

### 🔴 異常なログパターン

**パターンA: 初期化で止まる**
```
[INIT] ...
（止まる）
```
→ ライブラリ読み込みエラー、ページ再読み込み

**パターンB: BLEで止まる**
```
[BLE] onConnect
[BLE] Starting data stream
（止まる）
```
→ begin()失敗、デバイス再起動

**パターンC: センサーデータが来ない**
```
[BLE] Setup complete
（SENSORログが出ない）
```
→ コールバック未登録、ページ再読み込み

**パターンD: キックが検出されない**
```
[RECORDING] Recording active
[BUFFER] current accMag: 2.5G, threshold: 3.0G
（閾値を超えない）
```
→ 閾値を下げる、もっと強く振る

## 開発者向け: デバッグモードのカスタマイズ

### ログの追加

```javascript
debugLog('カテゴリ', 'メッセージ', { データ: 'オブジェクト' });
```

### 特定ログの無効化

```javascript
// index_orphe.html内で
if (category === 'SENSOR') return;  // SENSORログをスキップ
```

### ログサンプリング頻度の変更

```javascript
// 現在: 最初5回 + 2秒ごと
// 変更例: 最初10回 + 5秒ごと
if (accDataCount <= 10 || now - lastAccLogTime > 5000) {
```

## まとめ

1. **デバッグコンソールを開く** → リアルタイムログ確認
2. **BLE接続** → `onConnect`と`SENSOR`ログを確認
3. **カウントダウン** → `RECORDING`ログを確認
4. **足を振る** → `BUFFER`と`KICK`ログを確認
5. **問題があれば** → エラーメッセージとログパターンから原因特定

---

**このガイドを使って、BLE接続やセンサーデータの問題を素早く特定・解決できます！** 🚀
