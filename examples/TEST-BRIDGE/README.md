# TEST-BRIDGE — BleSharedBridge 動作確認

ORPHE COREのBLE接続を複数タブ間で共有する `BleSharedBridge` 機能の動作確認用サンプルです。

## ファイル構成

| ファイル | 用途 |
|---------|------|
| `index.html` | 実機BLEを使った動作確認ページ |
| `physical-reconnect-test.html` | 実機BLEの前回デバイス記憶・自動再接続・手動切り替え確認ページ |
| `physical-range-test.html` | 物理的なBLE距離断・復帰時間・再接続試行回数の確認ページ |
| `unit-test.html` | BleSharedBridge クラスの単体テスト（25ケース、実機不要） |
| `integration-test.html` | Orphe + BleSharedBridge の統合テスト（58ケース、実機不要） |
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

### 前回デバイス記憶・切り替え確認

`physical-reconnect-test.html` を使うと、前回接続した Bluetooth デバイスの記憶と再接続を確認できます。

1. Tab A / Tab B で `physical-reconnect-test.html` を開く
2. Tab A で「接続 / 再接続」を押して ORPHE CORE を選ぶ
3. Tab B で「接続 / 再接続」を押し、Secondary になることを確認
4. Tab A で「切断」を押す
5. Tab B が前回記憶した ORPHE CORE へ自動再接続して Primary になることを確認
6. 別の ORPHE CORE へ切り替える場合は、Primary接続中に「接続 / 再接続 / 切り替え」をもう一度押してBLE選択ダイアログから選び直す

### 物理的なBLE距離断・自動復帰確認

`physical-range-test.html` は、ORPHE CORE を持って離れた時のBLE切断と、近づいた時の自動再接続をログで確認するページです。

1. `physical-range-test.html` を開く
2. 「デバイス選択して開始」でORPHE COREを選ぶ
3. センサーデータが流れ始めたら、ORPHE COREを持って通信圏外まで離れる
4. ログに `disconnect detected` と `reconnect attempt` が出ることを確認
5. ORPHE COREを近づける
6. ログに `reconnect success` が出て、復帰時間と試行回数が記録されることを確認

## 自動テスト

BLE実機がなくても以下の2つのテストが実行可能：

- 単体テスト: http://localhost:8765/examples/TEST-BRIDGE/unit-test.html
- 統合テスト: http://localhost:8765/examples/TEST-BRIDGE/integration-test.html

各ページで「テスト実行」ボタンを押すと、タブ間通信・LeaderElection・バッチ配信などを自動検証します。

## ブラウザ要件

- **Chrome 85+ 推奨**（Web Bluetooth + BroadcastChannel + navigator.bluetooth.getDevices が必要）
- Edge、Opera も可
- Firefox / Safari は Web Bluetooth 非対応のため動作しません
