# Examples Thumbnail Audit (2026-05-02)

`examples/catalog.json` の `audit_findings.missing_thumbnails_count` を具体化するためのスナップショット。

将来のランディング / ギャラリー / カタログページで、各 example のサムネイル表示を 1 か所から拾えるようにすることが最終目的。**この PR は調査ドキュメントの追加のみ**で、画像の追加 / 移動 / 削除は行わない。

## サマリ (`examples/` 配下の catalog エントリ 30 件)

| カテゴリ | 件数 | 内訳 |
| --- | ---: | --- |
| `_thumbnails/` 集約に画像あり | 7 | すべて public のゲーム系 (boxing / ddr / drum / hurdle-110m / move-your-feet / pingpong / udon) |
| ディレクトリ直下に teaser.gif あり | 2 | INFORMATION / LIGHT (どちらも public) |
| **不在: public + public-candidate** | **17** | 本ドキュメントで列挙 |
| 不在: needs-review / needs-fix | 4 | 別セクションで列挙 |
| 計 | 30 | (内訳: public 19 + public-candidate 7 + needs-fix 1 + needs-review 3) |

## catalog の `missing_thumbnails_count: 29` との関係

- catalog の 29 は **集計範囲が `examples/` 以外も含む**: ws-tmu2025 / ws-tmu2022 / app-orphe-terminal / starter-templates 等の catalog エントリも対象に取った可能性あり (catalog 全 48 entry のうち、ロゴ・サムネ前提でない starter-templates と guides を除いて算出した古い値)
- 本ドキュメントでは **`examples/` 配下のみ** に絞って再集計し、public+candidate に絞ると **17 件** が不在
- `examples/` 配下の全 status (public 19 + candidate 7 + needs-fix 1 + needs-review 3 = 30) で再集計すると 30 - 9 (画像あり) = **21 件** が不在
- 数字の正本化は catalog schema 拡張 PR (`thumbnail` フィールド追加) と一緒に実施するのが望ましい

## 集約済 (`examples/_thumbnails/`)

| ファイル | サイズ | 関連 example (status) |
| --- | ---: | --- |
| `boxing.png` | 230 KB | `examples/GAME-BOXING/` (public) |
| `ddr.png` | 159 KB | `examples/GAME-DDR/` (public) |
| `drum.png` | 67 KB | `examples/drum_test/` (public) |
| `hurdle-110m.png` | 208 KB | `examples/GAME-HURDLE/` (public) |
| `move-your-feet.png` | 66 KB | `examples/MOVEYOURFEET/` (public) |
| `pingpong.png` | 59 KB | `examples/GAME-PINGPONG/` (public) |
| `udon.png` | 84 KB | `examples/GAME-UDON/` (public) |

すべてゲーム系。`_thumbnails/` 集約には現状ファイル名と example ディレクトリ名の**規約はなく**、暗黙的なマッピング (`hurdle-110m.png` → `GAME-HURDLE`) になっている。catalog の各 entry に `thumbnail` フィールドを足してマッピングを明示するのが先決 (Codex 担当の schema 拡張側で要相談)。

## ディレクトリ直下 (legacy convention)

| Path | 種別 | コメント |
| --- | --- | --- |
| `examples/INFORMATION/teaser.gif` | gif | 動作 gif。LP からのリンク先候補 |
| `examples/LIGHT/teaser.gif` | gif | LED 動作 gif。getting-started-led.html と相互参照可 |

## 不在: public + public-candidate (17 件)

### Sensor Viewer / Utility (7 件) — public

`STEP_ANALYSIS` / `SENSOR_VALUES` を可視化する系で、画面のスクリーンショットだけで thumbnail が取れる (BLE 実機接続不要 or 既存スクリーンショット流用可)。

| Example | Status | 候補スナップショット |
| --- | --- | --- |
| `examples/AIRWALKER/` | public | ダッシュボード (Activity ゲージ + Steps カード) |
| `examples/CORETOOLKIT-STARTER/` | public | CoreToolkit の接続スイッチ + センサー表 |
| `examples/FOOT ANGLE/` | public | 足跡 png + 円描画 |
| `examples/PRONATION/` | public | 内反外反バー / 足画像 |
| `examples/SENSOR-CALIBRATION/` | public | レコーディング UI |
| `examples/VIEW/` | public | センサー表 + 3D quaternion ビュー |
| `examples/VISUALIZE/` | public | Chart.js グラフ |

### Pose / External BLE (3 件) — public

| Example | Status | 候補スナップショット |
| --- | --- | --- |
| `examples/GESTURE-DEMO/` | public | (動作 gif 推奨) |
| `examples/OH1/` | public | 心拍計 + UI |
| `examples/POSE/` | public | MediaPipe Pose + ORPHE 連携 |

### Game (5 件) — public-candidate

| Example | Status | 候補スナップショット |
| --- | --- | --- |
| `examples/GAME-FIREBALL-MARIO/` | public-candidate | キック・ジャンプ系 |
| `examples/GAME-MARIO/` | public-candidate | 2D アクション画面 |
| `examples/GAME-PK/` | public-candidate | ペナルティキック画面 |
| `examples/GAME-SHOOTING/` | public-candidate | 2D シューティング画面 |
| `examples/GAME-SHOOTING2/` | public-candidate | 3D シューティング画面 |

### Workshop / Advanced (2 件) — public-candidate

| Example | Status | 候補スナップショット |
| --- | --- | --- |
| `examples/DTW/` | public-candidate | DTW のグラフ + 時系列 |
| `examples/WORKSHOP_07/` | public-candidate | DFT/FFT の 4 line plot |

### 小計

7 + 3 + 5 + 2 = **17 件** (public 10 + public-candidate 7)。

## 不在: needs-review / needs-fix (4 件)

実機接続が必要 or 内容判断が必要なため、thumbnail 撮影は status を `public` / `public-candidate` に昇格させる時に同時実施するのが安全。

| Example | Status | コメント |
| --- | --- | --- |
| `examples/CORE_TIME_SYNC/` | needs-fix | 静的画面なのでスクショで十分 |
| `examples/GAME-RHYTHM/` | needs-review | 実機確認後に撮影判断 |
| `examples/ICC2022Sep/` | needs-review | 実機接続必要 |
| `examples/p5.ORPHE.FSR_visualise_0327_submit/` | needs-review | INSOLE 接続後の FSR 円グラデーション (撮影は ORPHE INSOLE 必要) |

## 補足: catalog 未登録の HURDLE family ディレクトリ

`examples/` 配下に存在するが catalog エントリではない:

- `GAME-HURDLE-VS/` / `GAME-HURDLE-VS-advance/` / `GAME-HURDLE-2D-VS/` / `GAME-HURDLE-400M-VS/` / `GAME-SPRINT-100M-VS/`

これらは catalog 上 `game-hurdle` 1 entry に集約されており、family thumbnail は `hurdle-110m.png` を共用する想定。家族別カットを撮るかは catalog schema 拡張で `family` フィールドを導入するか議論次第。

## 推奨運用

### 短期 (このスプリント)

1. **catalog.json schema に `thumbnail` フィールドを足す** (Codex 担当の schema 拡張に乗せる)
   - 値は `examples/_thumbnails/<file>.png` のような相対パス、未生成は `null`
2. **既存 7 枚のマッピングを catalog に明示** (`game-hurdle.thumbnail = "examples/_thumbnails/hurdle-110m.png"` 等)
3. **`missing_thumbnails_count: 29` を再計算**: 集計範囲が `examples/` のみなら 17 (public+candidate) / 21 (全 status)、catalog 全体なら別計算
4. ランディング / カタログページは catalog の `thumbnail` を参照、未設定時は placeholder 画像

### 中期 (次のスプリント以降)

1. **Sensor Viewer / Utility 7 件のスクリーンショット撮影** (実機接続不要、ブラウザ画面のみで取れる)
   - INFORMATION / LIGHT は teaser.gif があるので転用検討 (`examples/_thumbnails/information.gif` 等にコピー)
2. **Game 系 5 件の動画 → gif** 化 (実機が必要、各ゲームで 5 秒程度のループ gif)
3. **POSE / GESTURE-DEMO / OH1** は動作 gif が情報量高い (静止画だと判別不能)

### 長期

1. `_thumbnails/` 命名規則の正規化 (`hurdle-110m.png` → `game-hurdle.png` のような catalog id ベース)
2. 自動撮影パイプライン (Playwright で各 example を開いてスクリーンショット保存) の検討
3. needs-review / needs-fix の 4 件は status 昇格時に thumbnail も同時撮影するワークフロー化

## 既知の制約

- 本ドキュメントは **PR を作らない静的調査** にとどまる。画像の生成 / 配置 / 命名規則決定は別 PR で要相談。
- `_thumbnails/` 命名は catalog id とずれる (例: `hurdle-110m.png` ↔ `game-hurdle`)。schema 拡張時に正規化を検討。
- `INFORMATION/teaser.gif` と `LIGHT/teaser.gif` は **ディレクトリ直下** にあり、catalog の `thumbnail` フィールドが追加されたら相対パス `examples/INFORMATION/teaser.gif` で参照する想定。
- 数字 (17 / 21 / 29) の使い分けはこのドキュメントの「サマリ」と「catalog の 29 との関係」を参照。catalog 側の値は schema 拡張 PR で再計算する。

## 関連

- `examples/catalog.json` `audit_findings.missing_thumbnails_count` (現在 29、本ドキュメントの再集計では public+candidate に限れば 17、`examples/` 全 status で 21)
- `docs/examples-catalog.md` の overlap families 節
- Codex 側 schema 拡張 PR (`thumbnail` フィールドのスキーマ確定後にこのドキュメントを更新)
