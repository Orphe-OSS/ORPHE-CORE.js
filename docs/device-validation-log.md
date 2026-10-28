# Device Validation Log / 実機確認ログ

公開掲載状態（`examples/catalog.json` の `status` / `public_navigation`）と、実機での確認状態は別に管理します。
このファイルは **実機確認の一次記録** です。README の「実機確認」欄と `catalog.json` の
`validation` / `needs_real_device_validation` は、ここに記録がある範囲でだけ「実機確認済み」にします。

ルール（`docs/agents.md` と同じ）:

- 実際に行っていない実機確認を「済み」と書かない。
- 記録できない項目は空欄ではなく **未記録** と書く（推測で埋めない）。
- 行を追加するときは、下の「記録項目」をすべて埋める。古い行は消さず、新しい行を足す。
- 感度・閾値・レンジなど **ゲームの反応が変わる変更** は、マージ前に新しい行を要求する。

## 記録項目

| 項目 | 書くこと |
|---|---|
| 日付 | 確認した日（JST） |
| 確認者 | 氏名または GitHub ID |
| example | `examples/<DIR>/` |
| 機材 | ORPHE CORE の世代（2.0 / 3.0）と台数。分かれば個体名（`CR-xxxx`） |
| FW | デバイス情報で確認できる FW 版。不明なら未記録 |
| ブラウザ / OS | 例: Chrome 141 / macOS 15 |
| 装着位置 | 例: 両足の甲（靴ひも）、右手の甲、左右の拳 |
| 通知タイプ / レンジ | `begin()` の引数。例: `SENSOR_VALUES`, acc ±16 G / gyro ±2000 dps |
| 確認したこと | 接続・開始・入力が効く・終了/再試行・切断からの復帰 など、実際に見た事実 |
| 未確認 | 見ていないこと |
| 根拠 | PR / コミット / Slack / 動画などへの参照 |

## 記録

| 日付 | 確認者 | example | 機材 | FW | ブラウザ / OS | 装着位置 | 通知タイプ / レンジ | 確認したこと | 未確認 | 根拠 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-14 | SAKA hyuga (shiratsumu) | `examples/GAME-PINGPONG/` | ORPHE CORE × 2（世代は未記録） | 未記録 | Chrome（版・OS は未記録） | 未記録 | `SENSOR_VALUES`（レンジ指定なし） | 2台接続後、両方から Euler を受信するとカウントダウンが始まる。ボールの移動、パドル操作、切断時の停止 | 装着位置ごとの操作感、再接続後の復帰 | [PR #119](https://github.com/Orphe-OSS/ORPHE-CORE.js/pull/119)（README を実機確認済みに更新したコミット `21d5f60`）、`30_Deliverables/ORPHE-CORE-SDK/PRレビュー_坂くん_119_120_123_2026-08-26.md`（社内） |
| 2026-05 以前 | オーナー（菊川） | `examples/GAME-HURDLE/` | ORPHE CORE × 2（世代は未記録） | 未記録 | Chrome | 両足の甲（推定・未記録） | `STEP_ANALYSIS_AND_SENSOR_VALUES` | 2台接続、足踏みで前進、つま先上げでジャンプ、完走（カタログ `owner-real-device-check`） | 日付・FW・ブラウザ版 | `examples/catalog.json`（`validation: owner-real-device-check`）、`docs/public-candidate-validation.md` |
| 2026-05 以前 | オーナー（菊川） | `examples/GAME-SPRINT-100M-VS/`, `examples/GAME-HURDLE-400M-VS/` | ORPHE CORE × 2 | 未記録 | Chrome | 未記録 | `STEP_ANALYSIS_AND_SENSOR_VALUES` | 2人対戦、各プレイヤーが独立に入力、完走/再試行 | 日付・FW・ブラウザ版 | `docs/public-candidate-validation.md`（"Owner verified"） |
| 2026-05 以前 | オーナー（菊川） | `examples/GAME-PK/` | ORPHE CORE × 1 | 未記録 | Chrome | 未記録 | `SENSOR_VALUES` | キック検出と方向（カタログ `real-device-validated`） | 日付・FW・ブラウザ版 | `examples/catalog.json` |

## 実機確認待ち（マージ前に確認が必要な変更）

| 追加日 | example | 変更 | 確認してほしいこと | 状態 |
|---|---|---|---|---|
| 2026-10-09 | `examples/GAME-BOXING/` | 接続時に `begin('SENSOR_VALUES', { range: { acc: 16, gyro: 2000 } })` を明示（従来はデバイス側の既定レンジのまま）。画面の単位表記を m/s² → G に修正（処理は元から G） | 左右の拳に装着し、静止時の合成加速度が約 1 G、通常のパンチで上限閾値 15 G を超えてパンチが検出されること。基準測定後のスコアの出方 | **未確認** |
| 2026-10-09 | `examples/GAME-UDON/`, `examples/MOVEYOURFEET/` | 変更なし。座位・小さな動きで反応するかの確認が、特設サイトで「座位対応」と表示する前提 | 椅子に座った状態での足踏み・足首の上下で反応するか、必要な大きさ | **未確認** |

## 未実機確認の public example（catalog の `needs_real_device_validation: true`）

`node -e "const c=require('./examples/catalog.json');console.log(c.entries.filter(e=>e.needs_real_device_validation).map(e=>e.id).join('\n'))"` で一覧できます。
2026-10-09 時点で GAME-UDON、MOVEYOURFEET、GAME-BOXING、GAME-DDR などが該当します。これらは公開掲載されていますが、実機確認の記録はありません。
