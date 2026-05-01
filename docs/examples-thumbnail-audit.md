# Examples Thumbnail Audit (2026-05-02)

`examples/catalog.json` の `audit_findings.missing_thumbnails_count` を具体化するためのスナップショット。

将来のランディング / ギャラリー / カタログページで、各 example のサムネイル表示を 1 か所から拾えるようにすることが最終目的。**この PR は調査ドキュメントの追加のみ**で、画像の追加 / 移動 / 削除は行わない。

## サマリ

| 状態 | 件数 |
| --- | ---: |
| `_thumbnails/` 集約に画像あり | 7 |
| ディレクトリ直下に teaser / thumbnail あり | 2 (`INFORMATION/teaser.gif`, `LIGHT/teaser.gif`) |
| **不在** (public / public-candidate のみ集計) | 22 |

## 集約済 (`examples/_thumbnails/`)

| ファイル | サイズ | 関連 example |
| --- | ---: | --- |
| `boxing.png` | 230 KB | `examples/GAME-BOXING/` |
| `ddr.png` | 159 KB | `examples/GAME-DDR/` |
| `drum.png` | 67 KB | `examples/drum_test/` |
| `hurdle-110m.png` | 208 KB | `examples/GAME-HURDLE/` |
| `move-your-feet.png` | 66 KB | `examples/MOVEYOURFEET/` |
| `pingpong.png` | 59 KB | `examples/GAME-PINGPONG/` |
| `udon.png` | 84 KB | `examples/GAME-UDON/` |

すべてゲーム系。`_thumbnails/` 集約には現状ファイル名と example ディレクトリ名の**規約はなく**、暗黙的なマッピング (`hurdle-110m.png` → `GAME-HURDLE`) になっている。catalog の各 entry に `thumbnail` フィールドを足してマッピングを明示するのが先決 (Codex 担当の schema 拡張側で要相談)。

## ディレクトリ直下 (legacy convention)

| Path | 種別 | コメント |
| --- | --- | --- |
| `examples/INFORMATION/teaser.gif` | gif | 動作 gif。LP からのリンク先候補 |
| `examples/LIGHT/teaser.gif` | gif | LED 動作 gif。getting-started-led.html と相互参照可 |

## 不在 (public / public-candidate)

`examples/catalog.json` で `status` が `public` または `public-candidate` で、かつ `_thumbnails/` 集約 / 直下 teaser のどちらも持たない 22 件:

### Sensor Viewer / Utility (8 件)

| Example | Status | 候補スナップショット |
| --- | --- | --- |
| `examples/AIRWALKER/` | public | ダッシュボード (Activity ゲージ + Steps カード) のスクリーンショット |
| `examples/CORETOOLKIT-STARTER/` | public | CoreToolkit の接続スイッチ + センサー表 |
| `examples/CORE_TIME_SYNC/` | public-candidate | (静的画面なのでスクショで十分) |
| `examples/CORETOOLKIT-STARTER/` (再掲、上記と同じ) | public | — |
| `examples/FOOT ANGLE/` | public | 足跡 png + 円描画 |
| `examples/PRONATION/` | public | 内反外反バー / 足画像 |
| `examples/SENSOR-CALIBRATION/` | public | レコーディング UI |
| `examples/VIEW/` | public | センサー表 + 3D quaternion ビュー |
| `examples/VISUALIZE/` | public | Chart.js グラフ |

### Pose / External BLE (3 件)

| Example | Status | 候補スナップショット |
| --- | --- | --- |
| `examples/GESTURE-DEMO/` | public | (動作 gif 推奨) |
| `examples/OH1/` | public | 心拍計 + UI |
| `examples/POSE/` | public | MediaPipe Pose + ORPHE 連携 |

### Game (8 件)

| Example | Status | 候補スナップショット |
| --- | --- | --- |
| `examples/GAME-FIREBALL-MARIO/` | public-candidate | ゲーム画面 (キック・ジャンプ系のアクション) |
| `examples/GAME-MARIO/` | public-candidate | 2D アクション画面 |
| `examples/GAME-PK/` | public-candidate | ペナルティキック画面 |
| `examples/GAME-RHYTHM/` | needs-review | (実機確認後に判断) |
| `examples/GAME-SHOOTING/` | public-candidate | 2D シューティング画面 |
| `examples/GAME-SHOOTING2/` | public-candidate | 3D シューティング画面 |
| `examples/GAME-HURDLE-VS/` | public (family) | (代表は GAME-HURDLE で済むので family 全体に 1 枚で OK?) |
| `examples/GAME-HURDLE-VS-advance/` | public (family) | 同上 |
| `examples/GAME-HURDLE-2D-VS/` | public (family) | 2D 版なので別カット推奨 |
| `examples/GAME-HURDLE-400M-VS/` | public (family) | family 共通でも OK |
| `examples/GAME-SPRINT-100M-VS/` | public (family) | family 共通でも OK |

### Workshop / Advanced (3 件)

| Example | Status | 候補スナップショット |
| --- | --- | --- |
| `examples/DTW/` | public-candidate | DTW のグラフ + 時系列 |
| `examples/WORKSHOP_07/` | public-candidate | DFT/FFT の 4 line plot |
| `examples/ICC2022Sep/` | needs-review | (実機接続必要) |

### FSR / 別系統 (1 件)

| Example | Status | 候補スナップショット |
| --- | --- | --- |
| `examples/p5.ORPHE.FSR_visualise_0327_submit/` | needs-review | INSOLE 接続後の FSR 円グラデーション (撮影は ORPHE INSOLE 必要) |

## 推奨運用

### 短期 (このスプリント)

1. **catalog.json schema に `thumbnail` フィールドを足す** (Codex 担当の schema 拡張に乗せる)
   - 値は `examples/_thumbnails/<file>.png` のような相対パス、未生成は `null`
2. **既存 7 枚のマッピングを catalog に明示** (`game-hurdle.thumbnail = "examples/_thumbnails/hurdle-110m.png"` 等)
3. ランディング / カタログページは catalog の `thumbnail` を参照、未設定時は placeholder 画像

### 中期 (次のスプリント以降)

4. **Sensor Viewer / Utility 8 件のスクリーンショット撮影** (実機接続不要、ブラウザ画面のみで取れる)
   - INFORMATION / LIGHT は teaser.gif があるので転用検討 (`examples/_thumbnails/information.gif` 等にコピー)
5. **Game 系の動画 → gif** 化 (実機が必要、各ゲームで 5 秒程度のループ gif)
6. **POSE / GESTURE-DEMO / OH1** は動作 gif が情報量高い (静止画だと判別不能)

### 長期

7. `_thumbnails/` 命名規則の正規化 (`hurdle-110m.png` → `game-hurdle.png` のような catalog id ベース)
8. 自動撮影パイプライン (Playwright で各 example を開いてスクリーンショット保存) の検討

## 既知の制約

- 本ドキュメントは **PR を作らない静的調査** にとどまる。画像の生成 / 配置 / 命名規則決定は別 PR で要相談。
- `_thumbnails/` 命名は catalog id とずれる (例: `hurdle-110m.png` ↔ `game-hurdle`)。schema 拡張時に正規化を検討。
- `INFORMATION/teaser.gif` と `LIGHT/teaser.gif` は **ディレクトリ直下** にあり、catalog の `thumbnail` フィールドが追加されたら相対パス `examples/INFORMATION/teaser.gif` で参照する想定。

## 関連

- `examples/catalog.json` `audit_findings.missing_thumbnails_count` (現在 29 と書かれているが、private/internal を除く実数は **22**)
- `docs/examples-catalog.md` の overlap families 節
- Codex 側 schema 拡張 PR (`thumbnail` フィールドのスキーマ確定後にこのドキュメントを更新)
