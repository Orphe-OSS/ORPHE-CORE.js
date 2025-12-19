# センサーデータ取得の修正

## 問題点

### 1. ライブラリの重複読み込み
```
Uncaught SyntaxError: Identifier 'float16' has already been declared
```
- CDNからのライブラリとローカルファイルが競合

### 2. センサーデータが取得できない
```
ORPHE-CORE.js:1414 onError: TypeError: Cannot read properties of undefined (reading 'getUint8')
```
- 間違ったbegin()モードを使用
- コールバック関数が正しく設定されていない

## 修正内容

### 1. ライブラリ読み込みをローカルに変更

**変更前:**
```html
<script src="https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js/js/float16.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js/js/quaternion.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js/js/ORPHE-CORE.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js/js/CoreToolkit.js"></script>
```

**変更後:**
```html
<script src="../../js/float16.min.js"></script>
<script src="../../js/quaternion.js"></script>
<script src="../../js/ORPHE-CORE.js"></script>
<script src="../../js/CoreToolkit.js"></script>
```

### 2. begin()モードを変更

**変更前:**
```javascript
this.begin('SENSOR_VALUES');
```

**変更後:**
```javascript
this.begin('STEP_ANALYSIS_AND_SENSOR_VALUES');
```

理由: GAME-HURDLEと同じモードを使用することで、加速度とオイラー角の両方が正しく取得できる

### 3. コールバック関数の修正

#### 変更前: gotConvertedGyro (存在しないメソッド)
```javascript
device.gotConvertedGyro = function(_gyro) {
  currentSensorData.gyro = _gyro;
};
```

#### 変更後: gotEuler (正しいメソッド)
```javascript
ble_device.gotEuler = function(_euler) {
  gyroDataCount++;
  currentSensorData.gyro = {
    x: _euler.roll,
    y: _euler.pitch,
    z: _euler.yaw
  };
  window.devices[this.id].eulers = _euler;
};
```

### 4. デバイスデータストレージの追加

```javascript
window.devices = [
  { acc: {x:0, y:0, z:0}, eulers: {pitch:0, roll:0, yaw:0} }
];
```

GAME-HURDLEと同じデータ構造を使用

### 5. グラフ表示範囲の調整

**変更前:**
```javascript
drawGraph('yaw', currentSensorData.gyro.z, -5, 5);      // rad/s
drawGraph('pitch', currentSensorData.gyro.y, -5, 5);    // rad/s
```

**変更後:**
```javascript
drawGraph('yaw', currentSensorData.gyro.z, -Math.PI, Math.PI);           // rad
drawGraph('pitch', currentSensorData.gyro.y, -Math.PI/2, Math.PI/2);     // rad
```

理由: Euler角度は角速度ではなく角度なので、範囲を変更

### 6. ラベル表示の修正

```html
<span>ジャイロ Yaw (Euler):</span>
<span>ジャイロ Pitch (Euler):</span>
```

角速度ではなくEuler角であることを明示

## GAME-HURDLEとの主な違い

| 項目 | GAME-HURDLE | GAME-PK |
|-----|-------------|---------|
| デバイス数 | 2個 (左右の足) | 1個 (片足のみ) |
| センサー用途 | 走る動作、ジャンプ | キック動作 |
| 加速度使用 | 閾値判定 (移動検出) | 合成値 + 履歴 (パワー計算) |
| Euler使用 | Pitch (ジャンプ判定) | Yaw/Pitch (方向計算) |
| データバッファ | なし | 20フレーム |

## 動作確認手順

1. ページを開く
2. F12でデベロッパーツールを開く
3. 「BLE接続」ボタンをクリック
4. デバイスを選択して接続
5. コンソールで以下を確認:

```
[BLE] 🔵 onConnect callback triggered
[BLE] Starting data stream: STEP_ANALYSIS_AND_SENSOR_VALUES
[SENSOR] 📊 Acc data #1: { x: "...", y: "...", z: "...", mag: "...G" }
[SENSOR] 🌀 Euler data #1: { pitch: "...", roll: "...", yaw: "..." }
```

6. センサー値モニターで数値が更新されることを確認
7. データカウンターが増加することを確認: `Acc: 123 | Gyro: 456`

## トラブルシューティング

### センサーデータが来ない場合

**チェック1: コンソールログを確認**
```javascript
[BLE] onConnect
[BLE] Starting data stream: STEP_ANALYSIS_AND_SENSOR_VALUES
[CALLBACK] Setting up gotConvertedAcc callback
[CALLBACK] Setting up gotEuler callback
```
これらが全て表示されているか？

**チェック2: エラーメッセージを確認**
```
onError: TypeError: Cannot read properties...
```
このエラーが出ていないか？

**チェック3: データカウンターを確認**
```
受信データ: Acc: 0 | Gyro: 0
```
両方が0のまま → コールバックが呼ばれていない

**チェック4: 手動でデータ確認**
```javascript
// コンソールで実行
window.devices[0]
// { acc: {x, y, z}, eulers: {pitch, roll, yaw} }
```

### よくある問題

#### 問題1: float16エラー
```
Identifier 'float16' has already been declared
```
**解決**: ページを完全にリロード (Cmd+Shift+R)

#### 問題2: デバイスが見つからない
**解決**: 
- デバイスの電源を確認
- Bluetoothをオフ→オンにする
- ブラウザを再起動

#### 問題3: 接続後すぐ切断される
**解決**:
- デバイスのバッテリーを確認
- 他のアプリケーションが接続していないか確認
- ペアリング情報をクリアして再接続

## まとめ

主な修正点:
1. ✅ CDN → ローカルファイル読み込みに変更
2. ✅ `SENSOR_VALUES` → `STEP_ANALYSIS_AND_SENSOR_VALUES`
3. ✅ `gotConvertedGyro` → `gotEuler`
4. ✅ データ構造をHURDLEに合わせる
5. ✅ グラフ範囲を角度用に調整

これでGAME-HURDLEと同じようにセンサーデータが取得できるようになりました！
