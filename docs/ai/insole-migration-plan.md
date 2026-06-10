# ORPHE-INSOLE.js 移植・改修プラン（確定版）

- 作成日: 2026-06-10
- 対象: [ORPHE-INSOLE.js](https://github.com/Orphe-OSS/ORPHE-INSOLE.js)（v1.0.0 beta, src 1455行）
- 参照: [ORPHE-CORE.js](https://github.com/Orphe-OSS/ORPHE-CORE.js)（v1.3.4 stable, 1924行）
- ステージング実装: `docs/ai/insole-migration/staging/`（INSOLE リポジトリへコピー可能な状態）

## ゴール

**ORPHE INSOLE.js のページで安定してインソールを接続し、いろいろな計測・可視化・可聴化ができる状態にする。**

## 確定した意思決定

| # | 論点 | 決定 |
|---|---|---|
| 1 | STEP_ANALYSIS | **FW対応を待つ。** まずは生データ（SENSOR_VALUES）ストリーミングでできることに集中。SDKのgait系コールバックは「FW対応待ち」と明記して温存 |
| 2 | クラス名 | **`OrpheInsole` を正式名、`Orphe` は後方互換エイリアス**（詳細は下記） |
| 3 | CoreToolkit | **INSOLE 専用 slim 版 `InsoleToolkit.js` を新規作成**（Phase 2 案A）。`buildCoreToolkit` 互換ラッパーを残す |
| 4 | Examples | **まず VISUALIZE のみ移植。** 他はあとで増やす |
| 5 | プラン保管場所 | **本リポジトリ `docs/ai/insole-migration-plan.md`**（INSOLE 側にPRを切る際に staging ごと持っていく） |

### 決定2の根拠（クラス名）

CORE と INSOLE を今後もずっと並走させる前提では、**同名クラス `Orphe` の二重定義は致命的**:

- 両SDKとも classic script のトップレベルで `class Orphe` に加え `class FixedSizeArray`・`class OrpheTimestamp` を宣言しており、同一ページに両方読み込むと `SyntaxError: Identifier ... has already been declared` で**後から読み込んだ側のスクリプト全体が死ぬ**（vm 検証で確認済み）。CORE+INSOLE 併用アプリ（例: 足背CORE＋インソールのハイブリッド計測）が原理的に作れない。
- INSOLE は beta でユーザが少ない今が rename の最後のチャンス。

採用した設計（staging 実装済み）:

```javascript
(function (global) {            // ライブラリ本体をIIFEで包み、レキシカル束縛の衝突自体を排除
  class FixedSizeArray { ... }
  class OrpheTimestamp { ... }
  class OrpheInsole { ... }     // 正式クラス名
  global.OrpheInsole = global.OrpheInsole || OrpheInsole;
  // CORE が同一ページに居ない場合のみ Orphe エイリアスを公開
  if (typeof Orphe === 'undefined' && typeof global.Orphe === 'undefined') {
    global.Orphe = OrpheInsole;
  }
})(globalThis);
```

- INSOLE 単独ページ: 既存コード `new Orphe(0)` はそのまま動く（後方互換）
- CORE 併用ページ: 読み込み順に関わらず `Orphe`=CORE、`OrpheInsole`=INSOLE と決定的に解決（CORE のレキシカル束縛がグローバルプロパティを常にシャドウするため）
- 上記3パターンすべて `tests/insole-coexistence.test.js` で回帰テスト化済み
- 将来 CORE 側にも `OrpheCore` エイリアスを追加し、ドキュメントは段階的に `OrpheInsole`/`OrpheCore` 表記へ移行することを推奨

## 両SDKの差分サマリ（調査結果）

| 観点 | ORPHE-CORE.js v1.3.4 | ORPHE-INSOLE.js v1.0.0 beta |
|---|---|---|
| 圧力(FSR) | なし | **6ch `gotPress`**（mode 3=200Hz / mode 4=100Hz） |
| STEP_ANALYSIS | 完全実装 | コールバック宣言のみ・未配線（FW未対応） |
| LED / Mount書込 | あり | なし（ハードに存在しない） |
| データ設定 | `begin(type,{range})` | `setDataStreamingMode(1/3/4)`（0x0D write） |
| パケット | header 50 (92byte) | header 50/55/56 (104byte)、パーサは関数分離済みでテスト可能 |
| 接続安定化 | デバイス記憶・自動再接続・BleSharedBridge | **なし** ← 今回の移植対象 |
| Toolkit | CoreToolkit 512行 | CORE版の流用388行（LED等の無効UIが残存） |
| Examples | 30+ | 3（dashboard / terminal / hula-motion-sonifier） |
| 配布 | js/ 直読み | src/ + dist/（terser, jsDelivr） |
| テスト | なし | node 単体テストあり（`npm test`） |
| 隠れ依存 | — | float16/quaternion を **CORE リポの CDN から実行時ロード** |

## フェーズ計画と進捗

### Phase 1: SDK 安定化 — ✅ staging 実装済み

`staging/src/ORPHE-INSOLE.js`（v1.1.0 相当）。CORE.js から以下を移植:

1. **デバイス記憶 + ダイアログレス再接続**: 接続成功時に localStorage へデバイス情報を記憶（キーは `orphe_insole_last_bluetooth_device_{id}` で CORE と非衝突）。次回 `begin()` 時に `navigator.bluetooth.getDevices()` で選択ダイアログなしの再接続。デバイス喪失時は自動でダイアログにフォールバック。`selectBluetoothDevice()` / `forgetLastBluetoothDevice()` も移植。
2. **自動再接続**: `begin('SENSOR_VALUES', {autoReconnect: true})`。切断検知→最大120回・3秒間隔（設定可）で再接続。`onReconnectAttempt/Success/Failed` コールバック。再接続中の `onError` 連発は `_reportError` で抑制。
3. **品質改善**: `gattserverdisconnected` リスナーを遅延バインド化（リスナー登録後の `onDisconnect` 上書きが効かないバグの修正）、`setDeviceInformation` の `alert()` を `console.warn`+`onError` に変更、`console.info` ノイズを `insole.debug` フラグでゲート、`reset()` 時に autoReconnect も解除。
4. **クラス名整理**: 上記の決定2。Node エクスポート（`module.exports`）は従来どおり `Orphe`/`OrpheInsole` 両方を維持し**既存テストはそのままパス**。

検証済み（INSOLE リポジトリの実テスト一式を staged ソースで実行）:
- `node --check`: src 2本 + 既存 examples（terminal / hula-motion-sonifier）すべてパス
- 既存テスト: `insole-parser.test.js` / `hula-detector.test.js` パス
- 新規テスト: `insole-stability.test.js`（エイリアス・デバイスマッチング・再接続設定・streaming mode バリデーション）、`insole-coexistence.test.js`（CORE↔INSOLE 両順序の共存 + 単独後方互換）パス

**やらなかったこと（意図的）**: BleSharedBridge（複数タブ共有）は CORE 固有の運用要件が強く、INSOLE では必要になってから移植する。interpolation の実装は CORE 側も未実装のため見送り。`gotConvertedPress` は kgf 換算式が未確定のため API を作らない（キャリブレーションパターンを PRESSURE_RECIPES.md で提供）。

### Phase 2: InsoleToolkit（slim版） — ✅ staging 実装済み

`staging/src/InsoleToolkit.js`（CORE 版から新規書き起こし）:

- 削除: LEDトグル、LED輝度、L/R書込、notification選択（STEP_ANALYSIS系）、acc/gyroレンジ書込（INSOLE は setDeviceInformation 未対応のため読み取り専用表示に変更）
- 追加: **データストリーミングモード選択（1/3/4）**、**L/Rバッジ**（mount_position bit0 から自動判定・色分け）、**自動再接続ステータス表示**（試行回数）、mount_position 詳細表示
- グローバルは `insoles[]` を正とし、`bles`/`cores` エイリアスで CORE 系コードの移植を容易化
- `buildCoreToolkit()` 互換ラッパーを残置（notification 引数は警告つきで無視）
- toolkit が上書きする `gotBLEFrequency` 等はユーザコールバックとチェーン実行（CORE 版は上書きで衝突していた）

### Phase 3: Examples — ✅ VISUALIZE 移植済み（決定4によりまずこれのみ）

`staging/examples/VISUALIZE/`:

- CORE 版 VISUALIZE をベースに、圧力6chチャートを追加（計5チャート×2台）
- 接続UIを InsoleToolkit に置換（自動再接続つき）
- **rAF スロットリング**を導入: 100Hz×複数チャートの `chart.update()` 連打はタブを固まらせるため、受信はバッファ、描画は約30fps。今後のINSOLE向けサンプルの標準パターンとする
- `lostData` でパケット欠損を console 警告

### Phase 4: ドキュメント — ✅ staging 実装済み

- `staging/CLAUDE.md`: INSOLE リポジトリ用 AI 開発ガイド（CORE の CLAUDE.md と同形式）。ストリーミングモード選択ガイド、全コールバックリファレンス、接地検出/バランス/CoP/可聴化/描画スロットリングの5パターン、アンチパターン集
- `staging/docs-ai/PRESSURE_RECIPES.md`: 圧力6chの処理レシピ集（キャリブレーション、ヒステリシス接地検出、ケイデンス/エアタイム、前後内外バランス、CoP、ピーク/インパルス、可聴化3種、データ記録）

### Phase 5: INSOLE リポジトリへの適用（次のアクション・未実施）

このリポジトリの GitHub 連携は orphe-core.js に限定されているため、INSOLE 側への反映は手動またはローカルで行う:

1. `docs/ai/insole-migration/staging/` の内容を ORPHE-INSOLE.js リポジトリへコピー（手順は `docs/ai/insole-migration/README.md`）
2. `npm test` → `npm run build` → `npm run generate-docs`
3. 既存 examples（sensor-dashboard / terminal / hula-motion-sonifier）の動作確認（`Orphe` エイリアスで動くはず。順次 `OrpheInsole` 表記へ）
4. README に InsoleToolkit / autoReconnect / VISUALIZE を追記
5. v1.1.0 としてリリース（jsDelivr の参照は `@latest` でなく `@1` 系タグ推奨）

### Phase 6: 中期ロードマップ（未実施・優先順）

1. **float16/quaternion の同梱**: 現状 CORE リポの CDN から実行時ロードしており、CORE 側の変更で INSOLE が壊れる。`src/vendor/` に同梱して切る
2. **実機での安定性検証**: autoReconnect の実機テスト（電源断・距離・スリープ復帰の3シナリオ）
3. **examples 増設**（PRESSURE_RECIPES.md のレシピをそのまま製品化）: PRESS-HEATMAP（足型ヒートマップ）→ BALANCE(2台) → SONIFY-PRESSURE → JUMP-AIR-TIME
4. **starter-templates**: PRESS / ACCELEROMETER / QUATERNION / STREAMING_MODE の4本から
5. **STEP_ANALYSIS**: FW対応がリリースされたら CORE のパーサ（`ORPHE-CORE.js` l.1330-1495 相当）を移植。それまでに圧力ベースの接地検出（レシピ2）で代替できるよう examples を整備
6. **CORE 側に `OrpheCore` エイリアス追加**: 命名の対称性を完成させる（CORE リポ側の小PR）
7. **共通コア抽出（モノレポ化）の検討**: BLE接続・デバイス記憶・自動再接続・時刻同期は今回の移植で両SDKがほぼ同型になったので、抽出コストが下がっている

## リスク・未確定事項

1. **DEVICE_INFORMATION のバイトレイアウト**: INSOLE の `getDeviceInformation` は offset 8,9 を range として読むが、ハード仕様書との照合が未実施。実機確認推奨
2. **圧力の物理量換算**: ADC生値→kgf の変換式が未公開。`gotConvertedPress` API はそれまで作らない
3. **`navigator.bluetooth.getDevices()` の可用性**: 環境によっては無効。無効時は従来どおり選択ダイアログにフォールバックする実装にしてある
4. **mode 3（200Hz）の実効スループット**: BLE接続パラメータ次第で欠損が増える可能性。`lostData` の発生率を VISUALIZE で観察できる
