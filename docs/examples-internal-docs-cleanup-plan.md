# Examples Internal Docs Cleanup Plan (2026-05-02)

`examples/GAME-DDR/` と `examples/GAME-PK/` には、過去の Cursor / Claude / 開発者ログ由来の `.md` ファイルが多数残っており、`examples/catalog.json#audit_findings.internal_artifacts_in_examples` の指摘対象になっている。本ドキュメントは **削除前の整理プラン**で、この PR では何も削除/リネームしない。実作業は別 PR で要相談。

## なぜ今すぐ消さないか

- 過去の修正履歴やデバッグ手順を含むため、消す前に「公開価値あり / 内部のみ」を 1 ファイル単位で判定したい
- example の README は CDN や外部ブログから直接リンクされている可能性があり、リンク切れリスクを避けたい
- `git rm` で履歴は残るが、現状を共有したまま方針合意を先に取りたい

## 現状サマリ

| Example | ファイル数 | 合計行数 | 公開 README として残すべき | 内部のみ (削除候補) |
| --- | ---: | ---: | --- | --- |
| `GAME-DDR/` | 10 | 3185 | `README.md` (要圧縮) | 8 ファイル |
| `GAME-PK/` | 5 | 1309 | `README_ORPHE.md` (改名検討) | 3 ファイル |

## GAME-DDR/ (10 files, 3185 lines)

### 残す候補

| File | Lines | 公開価値 | アクション |
| --- | ---: | --- | --- |
| `README.md` | 342 | 高 (公開 README) | **残す**。Game Preview の壊れた画像参照 (`../GAME-PINGPONG/rogo.png`) を修正、絵文字を catalog 側の最小スタイルに揃える |
| `ARCHITECTURE.md` | 519 | 中 (アーキ図は学習価値あり) | **残す or `docs/` に移動**。図は再利用価値あり、ただし example ディレクトリ内で 519 行は重い |
| `QUICK_REFERENCE.md` | 205 | 中 (操作キーまとめ) | **README にマージ**して削除 |

### 削除候補 (内部のみ)

| File | Lines | 内容 | 削除理由 |
| --- | ---: | --- | --- |
| `CHANGELOG.md` | 475 | 開発履歴 + 統合サマリ (絵文字多め) | git log で代替できる、example 内に置くべきものではない |
| `BUGFIX_REPORT.md` | 381 | 緊急修正レポート (2025-10-14) | 既に修正済み、PR description で十分 |
| `FILE_INDEX.md` | 389 | ファイル一覧と各ファイル説明 | コード変更で容易に rot する。`tree` で代替可 |
| `PROJECT_SUMMARY.md` | 409 | 「PRODUCTION READY 完成報告」 | 開発者向けの自己評価ドキュメント |
| `FIXES_APPLIED.md` | 157 | 修正完了レポート | 既に適用済み |
| `UI_UX_IMPROVEMENTS.md` | 164 | UI/UX 改善レポート | 既に適用済み |
| `UPDATE_SUMMARY.md` | 144 | 改善レポート | 既に適用済み |

**削除合計: 7 ファイル / 2119 行**

## GAME-PK/ (5 files, 1309 lines)

### 残す候補

| File | Lines | 公開価値 | アクション |
| --- | ---: | --- | --- |
| `README_ORPHE.md` | 215 | 高 (実質的な README) | **`README.md` に改名**。現状ファイル名が非標準 |
| `DEBUG_GUIDE.md` | 394 | 中〜高 (BLE デバッグ手順は他 example でも参考になる) | **残す**。ただし内容は ORPHE 全体の話に近い → 将来 `docs/ai/BLE_DEBUG.md` への昇格検討 |

### 削除候補 (内部のみ)

| File | Lines | 内容 | 削除理由 |
| --- | ---: | --- | --- |
| `DEVELOPMENT_LOG.md` | 230 | 2025-10-23 phase 1/2 ログ | 開発者の作業日記 |
| `IMPLEMENTATION_REPORT.md` | 272 | 完成報告 | 既に実装済み |
| `SENSOR_FIX.md` | 198 | センサー読み込み修正記録 | 既に修正済み、PR description で十分 |

**削除合計: 3 ファイル / 700 行**

## トータルインパクト (案)

- 削除: 10 ファイル / 約 2819 行 (両 example の `.md` の **約 62%**)
- 改名: 1 ファイル (`GAME-PK/README_ORPHE.md` → `README.md`)
- マージ: 1 ファイル (`GAME-DDR/QUICK_REFERENCE.md` → `README.md` の操作セクションに統合)
- 残存: 4 ファイル (各 example の README + DDR の ARCHITECTURE + PK の DEBUG_GUIDE)

## 推奨手順 (別 PR で実施)

### Step 1: GAME-PK の改名 (低リスク)

- `git mv examples/GAME-PK/README_ORPHE.md examples/GAME-PK/README.md`
- `examples/catalog.json` の `game-pk` entry に `readme: "examples/GAME-PK/README.md"` を追加 (Codex 担当の schema 拡張側)
- 内部 3 ファイルを `git rm`

### Step 2: GAME-DDR の整理 (中リスク)

- `QUICK_REFERENCE.md` の操作キーまとめを `README.md` に統合
- 内部 7 ファイルを `git rm`
- `README.md` の壊れた画像参照を修正 (`../GAME-PINGPONG/rogo.png` → 削除 or `_thumbnails/ddr.png`)

### Step 3 (任意): ARCHITECTURE.md の昇格

- `GAME-DDR/ARCHITECTURE.md` の図を `docs/recipes/rhythm-game-architecture.md` に切り出すかは Codex 側 recipe roadmap 次第

## 既知の懸念

- 旧 README/CHANGELOG が外部ブログや SNS から直接リンクされている可能性
  - 対策: 削除前に `gh search code --owner <other-orgs> "examples/GAME-DDR/CHANGELOG.md"` で外部参照を確認 (社外検索は限界あり)
  - 代替: 削除せずに `examples/GAME-DDR/_archive/` へ移動して history を残す案もあり
- `ARCHITECTURE.md` のシステム図はそれ自体価値があるので、削除ではなく「移動先を決めてから動かす」方針が安全

## この PR で **行わないこと**

- ファイル削除 / リネーム / マージ
- catalog.json の更新
- README 内の壊れた画像参照修正

これらはすべて別 PR で実施 (各 1 PR ≒ 1 example).

## 関連

- `examples/catalog.json` `audit_findings.internal_artifacts_in_examples`
- `docs/examples-catalog.md` の status taxonomy (`internal` 扱いするか public README に統合するか)
- `docs/examples-thumbnail-audit.md` (thumbnail と同じく「監査だけする PR」のパターン)
