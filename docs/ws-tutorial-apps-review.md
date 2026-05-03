# `ws/` / `tutorial/` / `apps/` 公開価値レビュー (2026-05-02)

`examples/` 以外の HTML/JS が置かれている 3 ディレクトリ (`ws/`, `tutorial/`, `apps/`) が公開価値ベースで catalog にどう乗るべきかを整理する。**この PR は監査ドキュメントの追加のみ**で、削除・移動・リネームは行わない。

## なぜ今このレビューか

- `examples/catalog.json` には `ws-tmu2025` / `ws-tmu2022` / `app-orphe-terminal` の 3 entry が登録済みで、`tutorial/` 配下は未登録
- ランディング / docs ページから飛ぶ「学習導線」と、ws (workshop) 由来の「過去開催資料」、apps (実用ツール) が同じトップ階層に並んでおり、来訪者がどれを使えばいいか判断しにくい
- catalog の `audit_findings` は `examples/` 配下しか見ていないので、`ws/` 等が監査外になっている

## ディレクトリ別所見

### `tutorial/` (catalog 未登録)

| File | Lines | `<title>` | 公開価値 | 提案 |
| --- | ---: | --- | --- | --- |
| `tutorial/index.html` | 129 | `ORPHE-CORE.js Document` | 高 (ドキュメントの目次的) | catalog に `tutorial-index` (status: `public`) として登録。タイトルを具体化 (PR A 系で別 PR) |
| `tutorial/basic.html` | 395 | `ORPHE-CORE.js Document` | 高 (basic な使い方ドキュメント、ORPHE 言及 30 回) | catalog に `tutorial-basic` (status: `public`) で登録。`<title>` を `Basic Usage — ORPHE-CORE.js Document` などに変更 |

> last-modified に `2024/05/29` のラベルが残っているので、内容自体が古いまま放置の可能性あり。実機テスト or 内容更新を別 task に。

### `ws/tmu2022/` (status: `needs-review`)

| Path | 内容 | 公開価値 |
| --- | --- | --- |
| `ws/tmu2022/index.html` | TMU 2022 ワークショップ landing (26 KB / `<title>orphe-core.tmu</title>`) | 中 (歴史的資料、`<title>` は要修正) |
| `ws/tmu2022/demos/orphe-ping/` | 回転検知デモ。**`<title>uoo</title>`** だったのを PR #44 で修正済 | 中 |
| `ws/tmu2022/demos/LJ/` | 走り幅跳びの DTW + FFT デモ。**`<title>` 欠落**を PR #44 で追加 | 高 (DTW/FFT のリアル例として recipe 化の価値あり) |
| `ws/tmu2022/demos/YOU_ARE_theBIRD/` | `<title>YOU ARE the BIRD</title>`、p5.js + 鳥の画像。`p5.js` (4.3 MB) を同梱しているため重い | 低〜中 (動作するなら残す価値あり、ただしファイル肥大化) |
| `ws/tmu2022/demos/otameshi/` | `<title>ORPHE SLIDE</title>` | 低 (内容未確認、`otameshi` の名前から実験的) |
| `ws/tmu2022/demos/ripples.zip` | 配布前の zip ファイルが残存 | **要削除** (`.gitignore` に zip 追加検討) |

**提案**:

- `ws/tmu2022/` は archive 扱いで残す (`status: legacy` or `archive`)
- `LJ/` (DTW + FFT) は recipe candidate として `docs/recipes/dtw-fft-walkthrough.md` の実例参照に昇格検討
- `ripples.zip` は別 PR で削除

### `ws/tmu2025/` (status: `public-candidate`)

`ws/tmu2025/apps/` には L01.html を含む 16 ファイル (1.html〜14.html + L01.html + 9 という生徒提出風命名)。

| File | `<title>` | 内容 |
| --- | --- | --- |
| `1.html` | ORPHE BOXING - V6.5 | ボクシング (BOXING の派生?) |
| `2.html` | ORPHE カーフトレーニング・ジャンプ | カーフトレ |
| `3.html` | ORPHE CORE Shield Game | シールドゲーム |
| `4.html` | ORPHE CORE PUSH-UP SURFING 3D | プッシュアップ |
| `5.html` | ORPHE 刀剣リズム | 刀剣 |
| `6.html` | ORPHE 3D Tetris | 3D テトリス |
| `7.html` | ORPHE CORE 風船大空の旅 | 風船 |
| `8.html` | ORPHE CORE ジャンプゲーム | ジャンプ |
| `9.html` | ORPHE Wire Walker | ワイヤー綱渡り |
| `10.html` | ORPHE CORE 育成バトル | 育成 |
| `11.html` | ORPHE CORE Sword Visualization | 剣可視化 |
| `12.html` | Neck Age Trainer | 首トレ (`<title>` に ORPHE 表記なし) |
| `13.html` | ORPHE CORE Taiko | 太鼓 |
| `14.html` | ORPHE CORE だるまさんがころんだ | だるまさんが |
| `L01.html` | QUIET MOVE QUEST | 静かに動く 8-bit |

**提案**:

- 数字命名は学生作品アーカイブなので、catalog 上は **`ws-tmu2025` 1 entry にまとめたまま** で OK (個別 entry 化は逆に煩雑)
- ただし `12.html` (Neck Age Trainer) は `<title>` に ORPHE 表記がなく、検索で hit しないので別 PR で `<title>` 修正候補
- `ws/tmu2025/apps/9` (ディレクトリ) と `ws/tmu2025/apps/9.html` が混在しているのは要整理 (同じ作品の発展形なら `9.html` だけ残す等)
- `ws/tmu2025/apps/src/ORPHE-CORE.js` (SDK のコピー) は `js/` から相対参照に切り替えるべき (将来 SDK アップデート時の reference drift 防止)

### `apps/ORPHE-TERMINAL/` (status: `public-candidate`)

| File | 状態 |
| --- | --- |
| `index.html` | `<title>ORPHE TERMINAL</title>` (8.5 KB) |
| `index.js` | 12 KB |
| `README.md` | **`# ORPHE-TERMINAL` のみ (16 bytes)** — 内容空 |

**提案**:

- catalog で `public-candidate` に乗っているので、README 最低限の整備が必要 (PR B 系の追加候補)
- `apps/` は今後増えるなら命名規則 (`<verb>-<scope>` 等) を決めたい (Codex 側 schema 拡張で `category: "app"` を導入するか相談)

## 提案アクション (別 PR)

### 即時 (低リスク)

1. **`tutorial/` の catalog 登録** — `tutorial-index` / `tutorial-basic` を catalog.json に追加 (Codex schema 拡張 PR と相談)
2. **`tutorial/*.html` の `<title>` 改善** — `ORPHE-CORE.js Document` を `Tutorial Index` / `Basic Usage` に置換
3. **`apps/ORPHE-TERMINAL/README.md` の充実化** — PR #47 (B) と同テンプレで最低限の構造を追加
4. **`ws/tmu2022/demos/ripples.zip` 削除** — `.gitignore` に `*.zip` 追加検討

### 中期 (要相談)

5. `ws/tmu2025/apps/12.html` の `<title>` に ORPHE 文脈を補強 (`Neck Age Trainer — ORPHE TMU 2025` 等)
6. `ws/tmu2025/apps/9.html` と `ws/tmu2025/apps/9/` ディレクトリの重複整理
7. `ws/tmu2025/apps/src/ORPHE-CORE.js` を `../../../js/` 相対参照に切り替え
8. `ws/tmu2022/demos/LJ/` を recipe roadmap (`docs/recipes/dtw-fft-walkthrough.md`) の実例として参照

### 長期 (Codex schema 連動)

9. catalog schema に `category` フィールド追加 (`example` / `tutorial` / `workshop` / `app` / `demo`)
10. `ws/` 以下を catalog `audit_findings` 対象に拡大 (`internal_artifacts_in_examples` の対象範囲を `ws/` まで広げるか別 finding key にするか相談)
11. `tutorial/basic.html` の last-modified `2024-05-29` を rebuild

## この PR で **行わないこと**

- catalog.json の更新 (Codex の schema 拡張 PR で実施)
- `ws/` / `tutorial/` 配下のファイル削除 / 移動 / リネーム
- `<title>` 修正 (PR A 続編で別 PR)
- README 追加 (PR B 続編で別 PR)
- `ripples.zip` の削除 (別 PR、`.gitignore` 議論と一緒に)

## 関連

- `examples/catalog.json` `entries[ws-tmu2025 | ws-tmu2022 | app-orphe-terminal]`
- PR #44 (F): `ws/tmu2022/demos/orphe-ping` / `LJ` の `<title>` 修正
- `docs/examples-catalog.md` (status taxonomy の `legacy` / `archive` 追加検討)
- `docs/examples-internal-docs-cleanup-plan.md` (この PR と同じく「監査だけ」のパターン)
- `docs/examples-thumbnail-audit.md` (同上)
