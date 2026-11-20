# 現行説明と実装の整合レビュー（2026-10 / Phase 1）

出典: `AI-Workspace/30_Deliverables/ORPHE-Sports-Site/ORPHE_COREサイト改善とスポーツ特設サイト構想_20261009.md`（Codex、2026-10-09）の
「2 優先して整合を確認する箇所」と、公開サイト確認記録 `20_Projects/ORPHE-Sports-Site/20261009_サイトレビュー/公開サイト確認範囲_20261009.json`
（`origin/main` = `abb973b`、v1.4.2 時点）。

このファイルは **何が食い違っていたか → 何を変えたか → 根拠 → 確認結果 → 実機確認が必要か** を追うための記録です。
PR 本文の要約と同じ内容を、リポジトリ側にも残します。実機確認そのものの記録は [`device-validation-log.md`](./device-validation-log.md)。

担当: Claude Code（AI-Workspace `TASKS.md` T98）。ブランチ `claude/sports-site-phase1`（`origin/main` 基点）。
SDK 本体（`js/ORPHE-CORE.js`・`js/CoreToolkit.js`・CHANGELOG）は PR #137 / #138 が進行中のため **触っていません**。

## 一覧

| # | 指摘（企画書） | 確認した事実（2026-10-09） | 変更 | 根拠 | 確認結果 | 実機確認 |
|---|---|---|---|---|---|---|
| 1 | ボクシングの単位。`gotConvertedAcc`（G）をそのまま閾値判定に使う経路に対し、画面が m/s² | `js/game.js` は `gotConvertedAcc` の x/y/z から合成加速度を計算し、`upperThreshold`（既定 15.0）と比較。`index.html` の加速度・合成加速度・閾値ラベルが `m/s²`。README も m/s² と「デフォルト値 10 m/s²」 | 画面・README・設定スライダーの単位を **G** に統一（処理は元から G なので判定値は変えていない）。基準値の表示にも単位を追加 | `CLAUDE.md` の `gotConvertedAcc` 仕様、`js/ORPHE-CORE.js` の `converted_acc = normalized × ORPHE_CORE_ACC_RANGE_G[index]` | `npm run test:examples`（`tests/example-boxing-units.test.js`）で README / HTML / game.js の単位・既定値の一致を検査。ヘッドレス Chrome で描画確認 | 不要（表示のみ） |
| 1b | 同上。閾値 15（G）がデバイスの加速度レンジに届かない可能性 | `begin('SENSOR_VALUES')` はレンジ未指定 → デバイス側の既定レンジのまま。±8 G なら 15 G に届かずパンチが検出されない | 接続時に `range: { acc: 16, gyro: 2000 }` を明示。上限閾値スライダーの最大値を 30 → 16（レンジを超える値を設定できない） | `CLAUDE.md`「Wrong sensor range for use case」、`begin()` のレンジ→index 変換 | 静的検査のみ。感度に影響する | **必要**（`device-validation-log.md` の「実機確認待ち」） |
| 2 | 「最大速度測定」は実装では最大加速度を取る | `finishCalibration()` は `calibrationData`（合成加速度 [G]）の最大値を `maxAcceleration` に入れる。速度は計算していない | ボタンを「基準を測る（5秒・最大合成加速度）」、見出しを「基準の測定（キャリブレーション）」に変更。README の説明も「ピーク合成加速度の基準値」に | `js/game.js` `finishCalibration()` | テストで旧名称の残存を検査 | 不要 |
| 2b | 加速度をパンチの力・速度・医学的指標と呼ばない | 画面に「パンチ力」「平均パンチ力」、結果ダイアログに「平均パンチ力」 | 「パンチの勢い（基準比）」「平均ピーク加速度 (G)」に変更。結果ダイアログに「ゲーム用の指標であり力・速度・体力の測定値ではない」旨を追加。README の特徴欄から「高精度」「威力」の語を外した | 企画書「8 結果と自宅での継続」 | 描画確認 | 不要 |
| 3 | 擬似データの自動開始。未接続のまま 10 秒で擬似データが始まる | `game.js` 末尾の `setTimeout(..., 10000)` + `setInterval(generateDummyData, 50)`。表示上の区別なし | 自動開始を廃止。ヘッダーに「説明用モード（擬似データ）を開始」ボタンを追加し、開始中は黄色のバナーで「実測ではない」と表示。擬似データはチャート・数値表示にだけ流れ、基準の測定・ゲーム開始はガード（alert で理由を説明）。実機が接続されたら自動終了 | 企画書「2 擬似データの表示」 | テスト 5b/5c（vm 上で `startDemoMode` → 基準測定・開始がブロックされる、実機接続で終了）。描画確認 | 不要（実機接続時の自動終了は実機で確認できるとよい） |
| 4 | 運動強度の言葉（全力でのキャリブレーション） | README「5秒間、全力でパンチを繰り返す」「全力でパンチして正しい基準値を設定」 | 「自分が無理なく出せる速さで」を標準の説明にし、全力は競技的に遊ぶときの選択肢と記載。コードは変更なし（基準値は本人比の分母なので、どちらで測っても仕組みは同じ） | 企画書「2 運動強度の言葉」 | README 目視 | 不要 |
| 5 | 「二重閾値法」と説明されているが、下限閾値は未使用 | `detectPunch()` は `upperThreshold` だけを見る。`lowerThreshold` はスライダーと変数があるだけ | README の「二重閾値法」を実装どおり（上限閾値のみ）に書き直し、スライダーのラベルに「現在の判定では未使用」と明記。コードは変更なし | `js/game.js` `detectPunch()` | — | 不要 |
| 6 | 検証状態。卓球 README「実機確認済み」とカタログ `needs-device-verification` が不一致 | PR #119（2026-08-14、SAKA hyuga）で README が実機確認済みに更新されたが、`examples/catalog.json` は `needs_real_device_validation: true` のまま。カタログの `data` に未使用の `convertedAcc`、`issues` に解決済みの PR #40 の記載 | `docs/device-validation-log.md` を新設し、記録項目（機材・FW・ブラウザ/OS・装着位置・通知タイプ/レンジ・確認内容・未確認・根拠）を定義。卓球の記録を PR #119 を根拠に登録（世代・FW・装着位置は **未記録** と明記）。カタログの卓球エントリを `real-device-validated` / `needs_real_device_validation: false` / `data: ["euler"]` / `issues: []` に更新。README に未記録項目と装着位置の注意を追記 | PR #119、`30_Deliverables/ORPHE-CORE-SDK/PRレビュー_坂くん_119_120_123_2026-08-26.md` の P2 | `node scripts/check-examples-catalog.js` OK | 既存記録に基づく。装着位置ごとの操作感は未確認 |
| 6b | `needs_fix` の 3 件（MARIO / PINGPONG / SHOOTING の `test.html`）が「PR #40 で提案中」のまま | 3 ファイルとも `../../js/ORPHE-CORE.js` を読み込んでいる（修正済み） | `resolution` を「fixed（PR #40 merged、再確認 2026-10-09）」に更新。エントリは残す（履歴） | `examples/*/test.html` | カタログ検査 OK | 不要 |
| 7 | CLAUDE.md の冒頭が v1.4.1、履歴は v1.4.2 | Project Overview ツリーの `# Main SDK (v1.4.1, …)` だけが古い | v1.4.2 に修正。`tests/core-version-sync.test.js` にこの行の検査を追加（次のリリースで漏れると CI で落ちる）。リリース手順に追記 | `package.json` `version`、README「Current version」 | `npm test` OK | 不要。**注意**: PR #138 も同じ行（IIFE 注記の追加）を触るため、マージ順によっては 1 行の衝突が出る。両方を残す（`v1.4.2` + IIFE 注記） |
| 8 | Tutorial の「CoreToolkit.js Basic（準備中）」が空リンク、別に導入ガイドがある | `tutorial/index.html` の `href=""`。`docs/getting-started-coretoolkit.html` が存在 | 導入ガイドへリンクし、「チュートリアル形式のページは準備中」と説明 | — | 目視 | 不要 |
| 9 | 都立大 WS の時間。本文「90分の受講＋90分の実習」、スケジュールは講義 10:45–12:00（75分）・実習 13:00–14:30（90分） | 同一ページ内の記述が食い違う。講義の実時間は開催記録（スケジュール表）以外で確認できない | 本文を「午前のレクチャーの後、午後の 90 分の実習（13:00–14:30）で制作」に改め、講義の分数は書かない（スケジュール表に委ねる）。「2025（2025年度）」を追記して開催日 2026-01-31 との関係を明示 | `ws/tmu2025/index.html` のスケジュール表 | 目視 | 不要。講義の実時間（75 分 or 90 分）は馬場先生・菊川に確認 |
| 10 | 利用条件の適用範囲。SDK は v1.4.0 以降 source-available、ボクシング README は MIT | ボクシングのゲームコードは tomiyata（2026-04）が追加し README に MIT 表記。ただし LICENSE ファイルは無い。画像・音の出典は未記録 | ルート README に「Examples・素材の利用条件について」を追加（SDK 本体 / example 独自コード / 第三者ライブラリ / 素材・学生作品 の 4 層）。ボクシング README の「ライセンス」を 4 層の表にし、LICENSE 未同梱と素材の出典未確認を明記 | `LICENSE.md`、`git log -- examples/GAME-BOXING` | 目視 | 不要。**菊川確認**: tomiyata さんの MIT 意図と、画像・音の出典 |

## 変更していないもの（候補として残す）

| 項目 | 理由 |
|---|---|
| ルート `index.html` の「Last modified: 2026/04/30」 | 手書きの文字列。ページ更新日と SDK リリースを分けて自動表示する案は LP（Codex 担当）の構成変更になるため、別 PR で相談 |
| `examples/GAME-BOXING` のチャート縦軸（±30） | 表示範囲の調整は見た目の好みの範囲。レンジ ±16 G に合わせて ±16 にする案はあるが、実機で波形を見てから |
| `MOVEYOURFEET` の「vigorously（強く）」表現 | 画像内の文言を含むため、特設サイト側で「無理のない動き」の入口を作る方針（Phase 3） |
| `examples/catalog.json` の他エントリ | Codex 所有。今回は卓球の実機確認状態と解決済み `needs_fix` の事実訂正に限定 |

## 検証記録

| 日時 | 内容 | 結果 |
|---|---|---|
| 2026-10-09 | `npm test`（SDK 単体テスト + version-sync） | pass（version 1.4.2、104 pinned CDN references） |
| 2026-10-09 | `npm run test:examples` | pass（下記「テスト」参照） |
| 2026-10-09 | `npm run lint` | 0 errors / 77 warnings（変更前と同数） |
| 2026-10-09 | `node scripts/check-examples-catalog.js` | Catalog OK: 48 entries |
| 2026-10-09 | `node scripts/check-cdn-pins.js` | OK（308 files） |
| 2026-10-09 | `node scripts/check-examples-static-quality.js` | 0 errors / 0 warnings |
| 2026-10-09 | `git diff --check` | OK |
| 2026-10-09 | ヘッドレス Chrome（`--headless=new --screenshot`、file://）で `examples/GAME-BOXING/index.html` を描画 | 説明用モードのボタン・注記、G 表記、基準の測定、閾値ラベルの表示を確認。BLE は未接続 |

### テスト `tests/example-boxing-units.test.js`

1. 画面に `m/s²` が残っていない。加速度・合成加速度・基準値・閾値の表示が G
2. README / HTML スライダー / game.js の既定値（下限 2.0 G・上限 15.0 G・基準値 10 G）が一致
3. `begin()` で ±16 G を明示し、閾値とスライダー上限がレンジを超えない
4. 擬似データのトップレベル自動開始が無く、説明用モードのボタン・バナーがある
5. vm 上で `BoxingGame` を生成し、上限閾値を超えた合成加速度だけがパンチになること、500 ms の再検出抑止、説明用モードで基準測定・開始がブロックされること、実機接続で説明用モードが終了することを確認

## 実機で確認してほしいこと（未完）

- `examples/GAME-BOXING/`: 左右の拳に装着し、静止時 ≈ 1 G、通常のパンチで 15 G を超えて検出されるか。基準測定後のスコアの出方。実機接続で説明用モードが終了するか
- `examples/GAME-PINGPONG/`: 手の甲に装着したときの操作感（2026-08 の記録は装着位置が未記録）
- `examples/GAME-UDON/`, `examples/MOVEYOURFEET/`: 座位・小さな動きで反応するか（特設サイトで「座位対応」と表示する前提）
