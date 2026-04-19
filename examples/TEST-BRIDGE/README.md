# TEST-BRIDGE — BleSharedBridge 動作確認

ORPHE COREのBLE接続を複数タブ間で共有する `BleSharedBridge` 機能の動作確認用サンプルです。

## ファイル構成

| ファイル | 用途 |
|---------|------|
| `index.html` | 実機BLEを使った動作確認ページ |
| `unit-test.html` | BleSharedBridge クラスの単体テスト（25ケース、実機不要） |
| `integration-test.html` | Orphe + BleSharedBridge の統合テスト（17ケース、実機不要） |
| `test-frame.html` | テスト用の補助iframe |

## 実機での動作確認手順

### 準備
ローカルHTTPサーバーで配信してください（`file://`だとBroadcastChannelが動作しない場合があります）。

```bash
# プロジェクトルートで
python3 -m http.server 8765
```

### テスト手順

1. **Tab A を開く**: http://localhost:8765/examples/TEST-BRIDGE/index.html
2. Tab A でスイッチをONにして ORPHE CORE に **BLE接続**
   - バッジが「🔵 BLE接続中（Primary）」になることを確認
   - センサーデータ（加速度、歩行方向、歩数）が表示される
3. **Tab B を開く**（同じURL）
4. Tab B でスイッチをONにする
   - **BLEデバイス選択ダイアログは表示されない**
   - バッジが「📡 共有接続中（Secondary）」になる
   - Tab A と同じセンサーデータが Tab B にも流れる
5. Tab A を閉じる / リロードする
   - Tab B は自動で再接続を試みる（Fast Reconnect）
   - ペアリング済みなら数秒でBLE接続に切り替わり Primary に昇格
   - ペアリング情報がない場合は手動再接続が必要

## 自動テスト

BLE実機がなくても以下の2つのテストが実行可能：

- 単体テスト: http://localhost:8765/examples/TEST-BRIDGE/unit-test.html
- 統合テスト: http://localhost:8765/examples/TEST-BRIDGE/integration-test.html

各ページで「テスト実行」ボタンを押すと、タブ間通信・LeaderElection・バッチ配信などを自動検証します。

## ブラウザ要件

- **Chrome 85+ 推奨**（Web Bluetooth + BroadcastChannel + navigator.bluetooth.getDevices が必要）
- Edge、Opera も可
- Firefox / Safari は Web Bluetooth 非対応のため動作しません
