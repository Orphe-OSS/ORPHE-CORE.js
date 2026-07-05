# Codex作業指示書: ORPHE-CORE.js 改善 Round 1/2（2026-07）

発行: Claude（改善計画 `docs/ai/improvement-plan-2026-07.md` の実行フェーズ）
実行者: Codex ／ レビュー・マージ: Claude ／ 最終判断: 人間（菊川）

## 0. 運用フロー

1. Codexは本指示書のWOカードを**1カード=1ブランチ=1PR**で実装する（`codex/<slug>` ブランチ）。**mainへ直接pushしない。マージしない。**
2. 各PR完了時に「§9 完了報告フォーマット」で報告し、`docs/in-flight.md` に行を追加する。
3. 全カード完了（またはブロック）後、Claudeが全PRをレビューし、軽微な問題は修正コミットを積み、依存順にマージする（§10）。
4. 人間判断が必要な項目（各カードの「質問」欄）は**勝手に決めず**PR本文に質問として残す。

## 1. 必読資料（このリポジトリ内）

- `docs/agents.md` — 協働規約。**特に: 1PR1目的 / 実機検証の虚偽申告禁止 / human decision points**
- `docs/ai/improvement-plan-2026-07.md` — 改善計画本体（各WOの背景・根拠行番号はここ参照）
- `docs/ai/device-test-plan.md` — 実機検証チェックリスト（Round 2で使用）
- `CLAUDE.md` — APIリファレンス（ただしgait.direction記述は矛盾あり。WO-11参照）

## 2. グローバル規約（全WO共通）

- 差分は最小に。**リフォーマット・インデント一括変更・無関係な修正の混入禁止。**
- `examples/catalog.json` と `index.html`（LP）は、カードで明示された場合のみ変更可。
- `js/ORPHE-CORE.js` / `js/CoreToolkit.js` の**挙動変更はRound 2のみ**（実機検証日が前提）。Round 1でこれらに触れるのは文字列/コメント/JSDocのみ。
- 公開APIシグネチャ（`Orphe`クラスのメソッド名・引数・戻り値、`bles[0]/bles[1]`、`cores`、`buildCoreToolkit`）は変更禁止。
- starter-templatesの方針（`starter-templates/README.md` L33-37「CoreToolkit化しない」）を尊重。
- 実機検証はCodexには不可能。**「Needs real-device validation」欄に正直に書く。**

## 3. 検証ベースライン（2026-07-05にClaudeが確認済み・すべて緑）

```bash
node --check js/ORPHE-CORE.js && node --check js/CoreToolkit.js && node --check js/BleSharedBridge.js
node tests/core2-header40-parse.test.js        # exit 0
node scripts/check-examples-catalog.js         # exit 0, "Catalog OK: 48 entries checked"
node scripts/check-examples-static-quality.js  # exit 0, "0 errors, 0 warnings, 0 info"
```

各PRの作業後、この4行が緑のままであることを必ず確認しログをPR本文に貼ること。

**旧計画の訂正**: `.claude/plan/repo-improvement.md` にある「.DS_Store/.obsidianがコミットされている」は現在は該当なし（`git ls-files`で確認済み）。対応不要。

---

## Round 1 — 実機不要（着手順に並んでいる。WO-1とWO-2を最優先）

### WO-1: in-flight棚卸しと未マージブランチの処遇提案
- **ブランチ**: `codex/inflight-refresh-2026-07`
- **変更**: `docs/in-flight.md` のみ
- **作業**:
  1. Active Workの全行を検分し、2026-05-03以前で動きのない行を「stale」節へ移動（削除しない）。
  2. 以下6ブランチについて `git log main..<branch> --oneline` と `git diff main...<branch> --stat` を取り、処遇提案表（merge推奨/rebase要/破棄提案/要人間判断）をin-flight.mdに追加:
     `codex/fix-ble-shared-bridge-reset`, `codex/readme-install-paths`, `codex/readme-license-v140`, `codex/remove-icc-externalize-pose`, `codex/seo-language-pages`, `refactor/use-got-converted-acc`
  3. 本指示書のWO一覧をPlanned Workに登録。
- **受け入れ条件**: 表に6ブランチ全部の実差分サマリーと提案が入っている。削除操作はしない。
- **質問**: ブランチ破棄の最終判断は人間。

### WO-2: 未コミットのMINスターターの裁きと公開
- **ブランチ**: `codex/commit-starter-min-templates`
- **変更**: `starter-templates/P5_CORETOOLKIT_MOTION_PINGPONG_MIN.html`, 同`_COPY.txt`（新規追跡）, `starter-templates/P5_CORETOOLKIT_MOTION_PINGPONG.html`, 同`_COPY.txt`（既存修正分）, `starter-templates/README.md`
- **作業**:
  1. `git diff starter-templates/P5_CORETOOLKIT_MOTION_PINGPONG.html` の内容を確認しPR本文に要約（意図不明な差分があれば質問化して**コミットは保留**）。
  2. `diff` で各`.html`と`_COPY.txt`のバイト一致を確認（不一致なら`.html`を正として`.txt`を再生成）。
  3. `starter-templates/README.md` の表にMIN版の行を追加（Notify type: `STEP_ANALYSIS_AND_SENSOR_VALUES`、目的: PINGPONGの最小構成・p5.js Web Editor貼り付け用）。
  4. **`examples/*/sound/*.mp3`（未追跡・日本語ファイル名）はこのPRに含めない。**
- **受け入れ条件**: `git status` でstarter配下がクリーン、README表更新、ベースライン緑。
- **質問**: mp3群の採否・リネーム・出所ライセンス（人間判断）。

### WO-3: CI最小導入
- **ブランチ**: `codex/ci-minimal`
- **変更**: `.github/workflows/ci.yml`（新規）, `package.json`（scriptsのみ）
- **作業**: 以下をそのまま作成（§3で緑を確認済みのコマンドのみで構成）:

```yaml
name: CI
on:
  push:
    branches: [main, dev]
  pull_request:
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Syntax check (first-party JS only)
        run: |
          node --check js/ORPHE-CORE.js
          node --check js/CoreToolkit.js
          node --check js/BleSharedBridge.js
          for f in scripts/*.js tests/*.test.js; do node --check "$f"; done
      - name: Unit tests
        run: for t in tests/*.test.js; do echo "== $t"; node "$t"; done
      - name: Examples catalog check
        run: node scripts/check-examples-catalog.js
      - name: Examples static quality
        run: node scripts/check-examples-static-quality.js
```

  `package.json` に `"test": "node tests/core2-header40-parse.test.js"` を追加（テスト追加時に更新する運用。dependencies等は触らない）。
- **受け入れ条件**: PR上でActionsが緑。わざと壊したcommitで赤くなることを確認後revert（確認結果をPRに記載）。
- **注意**: `js/p5.js`・`js/bootstrap.bundle.min.js`等のサードパーティは対象外のまま。

### WO-4: デッドファイル除去（GAME-RHYTHM）
- **ブランチ**: `codex/remove-dead-sdk-copies`
- **変更**: `examples/GAME-RHYTHM/ORPHE-CORE.js` 削除、`examples/GAME-RHYTHM/p5.js` 削除（存在すれば）
- **作業**: 削除前に `grep -rn "ORPHE-CORE.js\|p5.js" examples/GAME-RHYTHM/` で参照を全数確認。index.html L6(CDN p5) / L13(CDN SDK) / sketch.js を確認し、ローカルコピーが未参照であることをPR本文に証明として貼る。
- **受け入れ条件**: GAME-RHYTHMページをローカルサーバで開いてconsole errorなし（BLE接続までは不要）。ベースライン緑。
- **注意**: 他examplesのローカル`bootstrap.min.js`等は**対象外**（オフライン動作の意図があるため。改善計画T9-Phase4）。

### WO-5: セットアップ要件のREADME一元化
- **ブランチ**: `codex/readme-setup-requirements`
- **変更**: `README.md`（新セクション追加）、`docs/getting-started-vscode.html` と `docs/getting-started-p5.html`（相互リンク1-2行のみ）
- **作業**: READMEの「Use via CDN」の直前に「Requirements / 動作要件」セクションを英日併記で追加。内容:
  1. Web Bluetooth対応ブラウザ: Chrome / Edge（macOS, Windows, Android）。Safari/Firefox不可。iOSはBluefyアプリ。
  2. **HTTPSまたはlocalhostでのみ動作**（secure context必須）。`file://` で開くと接続不可。
  3. ローカル実行例: VSCode Live Server、`npx serve`、`python3 -m http.server`。
  4. 最速経路はp5.js Web Editor（環境構築不要）→ `docs/getting-started-p5.html` へリンク。
  5. デバイスの装着: シューレースマウント → `docs/shoelace-mount-guide.html` へリンク。
- **受け入れ条件**: LP `index.html` は変更しない。リンク先が全て実在。英日とも簡潔（合計40行以内目安）。
- **質問**: なし。

### WO-6: `_COPY.txt` 同期スクリプト
- **ブランチ**: `codex/starter-copy-sync-script`
- **変更**: `scripts/sync-starter-copies.js`（新規）, `package.json`（scripts）, `.github/workflows/ci.yml`（1ステップ追加。WO-3マージ後にrebase）
- **仕様**: `starter-templates/` 内の `X.html` と `X_COPY.txt` のペアを列挙し、`--check` で不一致ペアを列挙してexit 1、`--write` で `.html`→`.txt` を上書き生成。ペアが片方しか無いファイルは対象外として一覧表示のみ。CIには `node scripts/sync-starter-copies.js --check` を追加。
- **受け入れ条件**: 現状全ペアで `--check` が緑（WO-2マージ後）。意図的に1文字変えてexit 1を確認しrevert。
- **依存**: WO-2, WO-3。

### WO-7: CoreToolkit 文字列・typo修正（挙動変更なし）
- **ブランチ**: `codex/coretoolkit-ui-strings`
- **変更**: `js/CoreToolkit.js` のみ。以下の表のとおり:

| 行 | 現状 | 修正 |
|---|---|---|
| L46 | `'form-ckeck form-switch d-flex'` | `'form-check form-switch d-flex'` |
| L83 | `tanslate-middle` | `translate-middle` |
| L108 | `setAttribute('tanindex', '-1')` | `setAttribute('tabindex', '-1')` |
| L143 | `Gryorscope Range [g]` | `Gyroscope Range [deg/s]` |
| L169 | `'STEP_ANALYSIS_AND_SENSOR_VALURS'` | `'STEP_ANALYSIS_AND_SENSOR_VALUES'` |
| L284 | `共有` | `Shared` |

- **触らないもの**: L123の「Realtime data protocol[not available]」（実装済みだが動作保証が不明のため人間判断待ち）、`toggleLED()` のパターン範囲0-6（実機確認待ち、improvement-plan §T4）。
- **受け入れ条件**: 差分が上記6行のみ。ブラウザで`examples/CORETOOLKIT-STARTER/`を開きUI表示崩れなし（スクショをPRに添付）。
- **質問**: L123ラベルの扱い／LEDパターン数の正。

### WO-8: パーサunitテスト拡充
- **ブランチ**: `codex/parser-unit-tests`
- **変更**: `tests/step-analysis-parse.test.js`, `tests/sensor-values-header50-parse.test.js`, `tests/deprecated-begin-names.test.js`（各新規）, `package.json`（testスクリプト更新）
- **作業**: 既存 `tests/core2-header40-parse.test.js` のvm+スタブcontext方式を踏襲。
  1. **STEP_ANALYSIS**: header(byte1)=0/1/2/4 の合成パケット（20byte, DataView）を作り、`gotGait`/`gotStride`/`gotPronation`/`gotQuat`+`gotEuler` の発火と値を検証。float16が必要なheader 0(calorie)/4 は `js/float16.min.js` をcontextへ先にロード。steps単調増加ガード（steps_now > 既知steps）も1ケース検証。
  2. **SENSOR_VALUES header 50**: パーサ実装（`js/ORPHE-CORE.js` L1538-1676）のレイアウトどおり92byteを合成し、4パケット分の`gotAcc`等が計4回発火・`converted_acc`のレンジ換算・`lostData`（serial跳び）を検証。
  3. **deprecated名**: `begin('RAW')` 等が `SENSOR_VALUES` へ写像されることを、`scan`/`getDeviceInformation`/`setDeviceInformation`/`syncCoreTime`/`startNotify` をすべて成功スタブ化した上で `notification_type` プロパティで検証。
- **受け入れ条件**: 新テスト全緑、CIに自動包含（`tests/*.test.js` glob）、既存テストも緑のまま。
- **注意**: 期待値は**現行実装の出力を正**とするスナップショット主義（実装への追随であって仕様確定ではない、とテスト内コメントに明記）。

---

## Round 2 — 実機検証日の確保後に着手（人間がGOを出すまで実装のみ・マージ不可）

### WO-9: `begin()` のnotify失敗経路修正（永久ハング解消）
- **ブランチ**: `codex/fix-begin-notify-error-paths`
- **変更**: `js/ORPHE-CORE.js` L497-521周辺 + JSDoc L421 + `tests/begin-error-paths.test.js`（新規）
- **修正内容**（この形をベースにすること）:

```js
      if (str_type == "STEP_ANALYSIS") {
        this.startNotify('STEP_ANALYSIS')
          .then(() => resolve("done begin(); STEP ANALYSIS"))
          .catch(err => reject(err));
      }
      else if (str_type == "SENSOR_VALUES") {
        this.startNotify('SENSOR_VALUES')
          .then(() => resolve("done begin(); SENSOR VALUES"))
          .catch(err => reject(err));
      }
      else if (str_type == "STEP_ANALYSIS_AND_SENSOR_VALUES") {
        this.startNotify('STEP_ANALYSIS')
          .then(() => this.startNotify('SENSOR_VALUES'))   // 内側Promiseを必ずreturnで連結
          .then(() => resolve("done begin(); STEP_ANALYSIS and SENSOR VALUES"))
          .catch(err => reject(err));
      }
      else {
        reject(new Error(`Unknown notification type: ${str_type}`));
      }
```

- **互換性方針**: 末尾の `.catch(error => { this._reportError(error); return; })`（L547-550）は**残す**。つまり「失敗時はonError発火+undefinedでresolve」という既存の外部契約は不変。変わるのは (a) SENSOR_VALUES/combined/未知typeで**ハングしなくなる**、(b) STEP_ANALYSIS失敗時のonErrorペイロードが `'User cancel.'` 固定文字列→実エラーになる、の2点。(b)はPR本文のBreaking-ish notesに明記。
- **テスト**: vm方式で `scan`/`getDeviceInformation`/`setDeviceInformation`/`syncCoreTime` を成功スタブ、`startNotify` をrejectスタブにし、3type+未知typeすべてで「2秒以内にundefined resolve + onError発火」を検証（現行コードではcombined/SENSOR_VALUESがタイムアウトする＝赤、修正後緑になることを確認）。
- **実機検証**（`docs/ai/device-test-plan.md` に節を追加して実施記録）: 3 type × {ダイアログキャンセル, 接続直後に電源断, 接続成功} で、UIが復帰し再接続可能なこと。autoReconnect有効時の回帰。CORE/CORE 2.0両方。
- **依存**: WO-3（CI）。**マージは実機検証ログが揃ってから。**

### WO-10: CoreToolkit range部分指定の二重変換修正
- **ブランチ**: `codex/fix-coretoolkit-range-conversion`
- **変更**: `js/CoreToolkit.js` L26-44
- **作業**:
  1. まず全examplesの実呼び出しを調査: `grep -rn "buildCoreToolkit(" examples/ starter-templates/ docs/ ws/ apps/ | grep -v "\.md"`。`options.range` を渡している箇所を列挙しPRに貼る（G値渡しかインデックス渡しかの実態確認）。
  2. L31-44のG値→インデックス変換ブロックを**削除**し、`options.range` はそのまま `begin()` へ渡す（`begin()` L478-485 がG値→インデックス変換の唯一の担当になる）。
  3. 調査でインデックス値(0-3)を渡している既存コードが見つかった場合のみ、`begin()` 側に0-3受理の互換分岐を追加提案（勝手に入れずPRで質問）。
- **実機検証**: `{range:{acc:8, gyro:-1}}` / `{acc:16, gyro:2000}` / 未指定 の3パターンで、接続後に設定モーダルとgetDeviceInformation()実値が期待どおりか。
- **依存**: WO-3。マージは実機検証後。

### WO-11: gait.direction / gait.type の仕様確定とドキュメント統一
- **ブランチ**: `codex/gait-direction-docs-truth`
- **変更**: `js/ORPHE-CORE.js`（JSDoc L197-198, L1878, L1883のみ）, `CLAUDE.md`, `docs/ai/SENSOR_RECIPES.md`, `api_doc/`（`npm run generate-docs` 再生成）
- **前提（人間+実機）**: 左右装着×{前進/後退/左/右ステップ}で `gotGait` のdirection生値、{静止/歩行/走行}でtype生値を記録した表をもらうこと。ファームウェア仕様書があればそれを一次資料とする。
- **作業**: 確定表で3系統の矛盾記述（improvement-plan §1-3-2）を統一。GAME-DDRの`LANE_MAP`との整合をコメントで明記。
- **受け入れ条件**: `grep -rn "direction" CLAUDE.md docs/ai/SENSOR_RECIPES.md js/ORPHE-CORE.js | grep -i "0:"` の結果が単一の表に揃う。実測ログがPRに添付されている。
- **依存**: 実機計測データ。**データが来るまで着手しない。**

---

## 8. 今回やらないこと（スコープ外・人間判断待ち）

- LICENSE/COMMERCIAL_LICENSEファイル化（法務確定待ち: `.claude/plan/license-v2.md`）
- npm公開・ESM化・d.ts・パーサ純関数化（Phase 4。Round 1/2の後）
- サムネイル21件（プレースホルダ方針の人間判断待ち）
- mp3ファイル群の採否
- LP `index.html` の構成変更
- tutorial第2章の執筆判断

## 9. 完了報告フォーマット（各PRおよび最終サマリー）

```
## WO-<n> <タイトル>
- Branch / PR: codex/<slug> / #<番号>
- 変更ファイル: （全列挙）
- Validation: （§3ベースライン4行＋カード固有の検証ログを貼る）
- Needs real-device validation: yes/no（yesなら何を）
- 質問: （人間判断が必要な点。なければ「なし」）
- Out of scope で見つけた問題: （あれば improvement-plan の該当テーマ番号を添えて）
```

## 10. Claudeレビュー・マージ手順（Codexは読むだけでよい）

1. `git fetch` → 各PRについて `git diff main...codex/<slug>` を確認。チェック観点: (a) 差分がWOカードの変更ファイル欄内に収まっているか、(b) §3ベースライン再実行、(c) catalog.json/index.htmlへの無断変更なし、(d) 報告フォーマットの検証ログと差分の整合。
2. 軽微な問題（typo、抜け、テストの脆さ）はClaudeがブランチに修正コミットを積んで解決。設計レベルの問題は差し戻しコメント。
3. マージ順: WO-1 → WO-3(CI) → WO-2 → WO-4/5/7（任意順）→ WO-6 → WO-8。Round 2は実機検証ログ確認後に WO-9 → WO-10 → WO-11。各マージ後にベースライン+`git status`クリーンを確認。
4. 全マージ後: `docs/in-flight.md` を閉じ、v1.3.4タグ付け（improvement-plan PR-14）を人間に提案。
