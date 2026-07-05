# ORPHE-CORE.js 改善計画（2026-07-05）

作成: Claude（改善責任者としての調査に基づく計画。ファイル変更なし）
対象: `ORPHE-CORE.js` リポジトリ main（HEAD: `8def3ec` Merge PR #117）

**調査範囲**: `js/ORPHE-CORE.js`（全1,965行精読）、`js/CoreToolkit.js`（全533行）、`js/BleSharedBridge.js`（全236行）、`tests/`、`scripts/`、`starter-templates/`、`examples/`（34件）、`docs/`（getting-started 5種・ai・lessons・監査/計画md群）、LP `index.html`、`.claude/plan|audit`、`docs/agents.md`、`docs/in-flight.md`、git履歴・ブランチ・worktree。
**未調査**: GitHub上のopen issues/PR一覧（サンドボックスからGitHubへのfetchがタイムアウト。git履歴からPR #96〜#117の文脈は把握済み）。**各PR着手前に `gh issue list` / `gh pr list` で重複確認すること。**

**既存計画との関係**: 本計画は `.claude/plan/repo-improvement.md`（2026年前半作成）を置き換える後継。同計画のうち README改善・PRテンプレ・初テスト追加は実施済み、npm/型/CI/LICENSEは未着手のまま。ただし「MIT LICENSE追加」は README.md L60-90 の v1.4.0 利用方針および `.claude/plan/license-v2.md`（法務レビュー待ち）により**前提が変わっているため引き継がない**。`docs/agents.md` の所有権ルール（core=Codex、新example=Claude draft、catalog.json=Codex、実機検証必須項目）と `starter-templates/README.md` L33-37 の「starterはCoreToolkit化しない」方針を本計画のすべてのPRで尊重する。

---

## 1. 現状サマリー

### 1-1. リポジトリの構成

| 領域 | 実体 | 状態 |
|---|---|---|
| ライブラリ本体 | `js/ORPHE-CORE.js`（1,965行, JSDoc `@version 1.3.4`） | 活発。直近変更 2026-06-25（CORE 2.0 header 40 quat修正 `5a0b947`） |
| 接続UI | `js/CoreToolkit.js`（`bles[0]/bles[1]`・`cores` をグローバル生成） | 安定運用中だが後述のバグ・typoあり |
| タブ間共有 | `js/BleSharedBridge.js`（localStorageハートビート+BroadcastChannel） | 設計は明快。手動テストページ `tests/bridge/` 5種あり |
| examples | 34ディレクトリ + `examples/catalog.json`（schema 0.2.0, 1,473行, status定義付き） | README 32/34、サムネイル13/34。CoreToolkit使用22/34 |
| starter-templates | 短い生APIテンプレ9種 + p5系5種 + `_COPY.txt` 4組 | `_COPY.txt` は手動複製。MIN系2ファイルが**未コミット** |
| docs/LP | LP `index.html`（約1,100行・18セクション）、getting-started 5種、shoelace-mount-guide、tutorial（第2章「準備中」）、`docs/ai/`（SENSOR_RECIPES等） | 導線は多層で整備済み。鮮度ズレあり |
| テスト | `tests/core2-header40-parse.test.js`（node素朴実行、runner無し）+ `tests/bridge/` 手動ページ | `package.json` に test スクリプト無し |
| CI | **無し**（`.github/workflows` 不在）。`scripts/check-examples-catalog.js` と `check-examples-static-quality.js` は手動実行のみ | |
| リリース | npm未公開（package.jsonにname/version無し）。CDNは jsDelivr の **`@main` 直参照**（README L27、starter、examples） | バージョンピン無し |
| 運用 | `docs/agents.md`（人間+Codex+Claude並行開発規約）、`docs/in-flight.md`（**2026-05-03から更新停止**）、prunableなworktreeブランチ5本、未コミット変更（starter MIN系、ゲームsound mp3） | 棚卸しが必要 |

### 1-2. 主要な強み
- **初心者導線の設計思想が既に正しい**: LP→「3分で開始」→getting-started(p5/vscode/led)→starter→examplesの多層導線、`_COPY.txt`、p5.js Web Editor直リンク、`guardCoreToolkitBluetooth()`（CoreToolkit.js L190-219）による非対応ブラウザ案内。
- **BLE状態管理が世代を重ねて堅くなっている**: GATT操作の直列化キュー（ORPHE-CORE.js L973-977）、autoReconnect（L563-668）、デバイス記憶+`getDevices()`復元（L858-919）、複数タブ共有（BleSharedBridge）、2台接続時の重複デバイス拒否（CoreToolkit.js L241-245）。
- **運用ルールが明文化済み**: `docs/agents.md`（1PR1目的、実機検証の虚偽申告禁止、human decision points）、catalog.jsonのstatus体系、監査文化（`.claude/audit/EXAMPLES_AUDIT.md`は自己検証で誤判定を訂正している）。
- **検証資産の種がある**: `tests/bridge/`のunit/integration/physical系ページ、`.claude/audit/DEVICE_TEST_PLAN.md`（実機手順書）、catalog/static-quality チェックスクリプト。

### 1-3. 主要な技術的負債（コード根拠付き）
1. **`begin()` のPromise契約が経路によって非対称**（最重要）:
   - デバイス選択キャンセル等は `await this.scan(...)`（L475）でrejectし呼び出し側のtry/catchに届く。
   - しかし notify開始段階では、`STEP_ANALYSIS` のみ `reject('User cancel.')` があり（L501-507）、**`SENSOR_VALUES`（L509-513）と `STEP_ANALYSIS_AND_SENSOR_VALUES`（L514-520）は catch/reject が無い** → この段階で失敗すると executor が永遠に settle せず `await ble.begin(...)` が**永久にハングする**。
   - さらに末尾の `.catch(error => { this._reportError(error); return; })`（L547-550）がエラーを飲み込み **undefined で resolve** する。CoreToolkitは `if (!ret)` でケアしている（CoreToolkit.js L271-274）が、生API利用者（例: `starter-templates/P5_QUICK_START.html` L50-57 の try/catch）はこの経路の失敗を検知できない。
2. **歩容データ仕様のドキュメントが3系統で矛盾**:
   - コンストラクタJSDoc（L198）: direction「0:前進, 1:後退, 2:左, 3:右」
   - `gotDirection` JSDoc（L1883）: 「0:none, 1:foward, 2:backward, 3:inside, 4:outside」
   - `CLAUDE.md`（Data Structures節）と GAME-DDR 実装: 「0:left, 2:forward, 4:backward, 6:right」
   - パーサ実装（L1428-1430）は `(byte & 0b00111000) >>> 3` で0-7を取り得る。`gait.type` も同様に L197 / L1878 / CLAUDE.md で不一致。**実機とファームウェア仕様で正を確定しない限り、AI生成コードの品質にも直撃する**（CLAUDE.mdはAI向け一次資料のため）。
3. **APIサーフェスに未実装オプションが露出**: `setup()` の `interpolation` はJSDoc自身が「未実装」と明記（L380）し、onRead内の分岐が空（L1333-1336）なのに、`setup()` の引数シグネチャ（L383-390）と CLAUDE.md のAPIリファレンスに実装済みのように記載。
4. **CoreToolkitのrange二重変換バグ**: `buildCoreToolkit()` L31-44 は「片方が-1」のときだけG値→インデックス変換するが、`begin()` L478-485 はG値としか比較しない。例: `{range:{acc:8, gyro:-1}}` → CoreToolkitが8→2に変換 → begin()が「2」を±2Gと解釈し **±8G指定のつもりが±2Gに誤設定**。両方指定時は無変換で偶然正しく動く。
5. **`device_information` 未初期化ガード無し**: 初期値が空文字列 `''`（L192）。`begin()` を経ずに `startNotify('SENSOR_VALUES')` を呼ぶと L1580/L1701 の `this.device_information.range.gyro` でTypeError。
6. **バージョン/配布の規律が無い**: `js/ORPHE-CORE.js` L2 の手書き「Last modified: 2026/01/31」に対し実際の最終変更は2026-06-25。CoreToolkit.js L2 は「2025/08/20」。CDN参照はバージョンピン無し（README L27はref指定なし=デフォルトブランチ解決、P5_QUICK_START.html L34とGAME-RHYTHM L13は `@main`）で、**mainへのマージが即座に全ユーザ・全ワークショップ教材に波及**し、かつjsDelivrのブランチキャッシュで反映遅延も読めない。git tagはv1.2以降切られていない（README L95-99）。
7. **テスト/CIの空白**: 唯一のunitテストは手動実行のみ。`node --check` 相当の構文チェックすらCIで走らない。examples検証スクリプトも手動。`.claude/audit/DEVICE_TEST_PLAN.md` は「ローカル限定・未コミット」のまま。
8. **リポジトリ衛生**: 未コミット変更（`starter-templates/P5_CORETOOLKIT_MOTION_PINGPONG.html` 修正、MIN系4ファイル未追跡、日本語ファイル名のmp3 12個）、prunable worktreeブランチ5本（`codex/fix-ble-shared-bridge-reset` 等）、`docs/in-flight.md` の2ヶ月放置、`examples/GAME-RHYTHM/ORPHE-CORE.js`（CDN読み込みのため**未参照のデッドコピー**）、`examples/FOOT ANGLE/`（スペース入りディレクトリ名）、コミット済み `.DS_Store`/`.obsidian`。
9. **細かな品質問題（CoreToolkit）**: L169 `'STEP_ANALYSIS_AND_SENSOR_VALURS'` typo（HTML側のselected属性で偶然無害）、L123 実装済みなのに「Realtime data protocol[not available]」表記、L143 「Gryorscope Range [g]」（正: Gyroscope / deg/s）、L284 英語UIに日本語「共有」ハードコード、`toggleLED()` L491-504 はパターン0-6を回すが `setLED()` JSDoc（ORPHE-CORE.js L682-684）は0-4。

### 1-4. 初心者/外部開発者が詰まりそうな箇所
- **セットアップ前提条件が一箇所にまとまっていない**: HTTPS（secure context）必須・ローカルサーバの起動方法・Chrome系限定・iOSはBluefy、という情報がUI警告文（20+ファイルに同文）、LPのBrowser Compatibilityセクション、getting-started-vscodeに分散し、**README.mdには無い**。
- **失敗時の症状が分かりにくい**: 上記1の通り、接続失敗の一部が「ハング」または「無言でundefined」になる。エラーも文字列とErrorオブジェクト混在（L928 vs L773）。
- **examplesギャラリーの見た目の完成度**: サムネイル21/34欠落（catalog.jsonの`thumbnail`検証はスクリプトにあるが実画像が無い）。
- **tutorial第2章（CoreToolkit Basic）が「準備中」のままLPからリンク**されている。
- **p5.js Web Editorテンプレの鮮度**: p5.js 1.4.1固定（P5_QUICK_START.html L7）。MIN系テンプレは未コミットでリポジトリ利用者に届いていない。

---

## 2. 改善テーマ一覧

> 難易度: S=数時間 / M=1-2日 / L=3日以上。所有権は `docs/agents.md` 準拠。

### T1. 運用棚卸しとリポジトリ衛生【Phase 0】
- **課題**: 未コミット変更・prunable worktree 5本・`docs/in-flight.md` 停止・デッドファイル（GAME-RHYTHMのSDKコピー、.DS_Store、.obsidian）が、以後のすべての作業のベースラインを曖昧にしている。
- **なぜ重要か**: agents.mdの並行開発体制は in-flight.md が生きていることが前提。未コミットのMINテンプレは「初心者向け最重要成果物」なのに配布されていない。
- **対象**: `docs/in-flight.md`, `starter-templates/P5_CORETOOLKIT_MOTION_PINGPONG*`, `*_MIN*`, `examples/*/sound/*.mp3`, `examples/GAME-RHYTHM/ORPHE-CORE.js`, worktree 5ブランチ, `.DS_Store`/`.obsidian`
- **期待効果**: 作業衝突の防止、MINテンプレの公開、リポジトリサイズ/ノイズ削減。
- **難易度**: S〜M（判断待ち項目あり）/ **リスク**: 低（削除系は`git rm --cached`とCDN参照確認で安全確認済みのものに限定）
- **検証**: `git status` クリーン化、`node scripts/check-examples-catalog.js` パス、GAME-RHYTHMをブラウザで開き動作不変（CDN参照のため）。

### T2. `begin()` のエラー経路統一（Promise契約の修正）【Phase 2・Codex担当・実機必須】
- **課題**: 1-3-1の通り、notify開始失敗で永久ハング（SENSOR_VALUES/combined）、成功以外でもundefined resolve。
- **なぜ重要か**: ワークショップで最も起きる「接続に失敗した/途中で切れた」の体験を直接決める。starterのtry/catchパターン（P5_QUICK_START）を「教えられる正しい作法」にするための前提。
- **対象**: `js/ORPHE-CORE.js` L497-551（+ `_reportError` 周辺）
- **推奨方針（後方互換維持）**: (a) 3経路すべてに `.catch` を追加しexecutorを必ずsettleさせる、(b) 既存挙動「最終catchで飲み込みundefined resolve」は**維持**（CoreToolkitや既存アプリが `if (!ret)` に依存）、(c) 失敗理由は `onError` に加えて戻り値で判別可能にする場合は `begin()` の`@return`を「成功: string / 失敗: undefined」と明文化。rejectに変える案は破壊的変更なのでv2まで見送り。
- **期待効果**: ハング撲滅、失敗が常に `onError`+undefinedで観測可能に。
- **難易度**: S（差分は小さい）/ **リスク**: 中（コア接続フロー。全notification typeで実機回帰が必要）
- **検証**: `node --check`、`tests/bridge/integration-test.html` と `physical-reconnect-test.html`、実機で「接続後すぐ電源断」「ダイアログキャンセル」「combined接続中の切断」を3 type × CORE/CORE 2.0で確認。`DEVICE_TEST_PLAN.md` に手順追記。

### T3. 歩容データ仕様（direction/type）の正誤確定とドキュメント統一【Phase 2・実機/ファーム仕様必須】
- **課題**: 1-3-2の3系統矛盾。
- **なぜ重要か**: gait.directionはDDR系・ワークショップ作品の中核入力。CLAUDE.md/SENSOR_RECIPES.mdはAI（Copilot含む）がコード生成する際の一次資料であり、矛盾はそのまま生成コードのバグになる。
- **対象**: `js/ORPHE-CORE.js` L197-198, L1878, L1883-1885(JSDoc)、`CLAUDE.md`、`docs/ai/SENSOR_RECIPES.md`、`api_doc/`再生成
- **期待効果**: 全ドキュメントとAI導線の一貫性。examplesの方向マッピング表の信頼性回復。
- **難易度**: S（ドキュメントのみ。ただし実機確定が先行条件）/ **リスク**: 低（コード変更なし）
- **検証**: 実機で前後左右ステップ→`gotGait`のdirection生値を記録（左右装着両方）。GAME-DDRの`LANE_MAP`と突合。確定表をJSDoc・CLAUDE.md・SENSOR_RECIPESに反映し `npm run generate-docs`。

### T4. CoreToolkit品質パス【Phase 2・Codex担当】
- **課題**: 1-3-4のrange二重変換バグ、1-3-9のtypo/文言/i18n、LEDパターン数の食い違い。
- **なぜ重要か**: CoreToolkitは「推奨経路」（CLAUDE.md Pattern B）であり、感度設定はゲーム系の体験に直結（±2G誤設定はキック検出等を飽和させる）。
- **対象**: `js/CoreToolkit.js` L24-44, L123, L143, L169, L284, L491-504
- **推奨方針**: 変換の責務を `begin()` 側に一本化し、`buildCoreToolkit` はG値をそのまま渡す（L34-44の変換を撤去）。`begin()` 側にインデックス値(0-3)も受け付ける後方互換分岐を足すかは要検討（足せばCoreToolkit経由の既存挙動も全ケース救える）。
- **期待効果**: `options.range` 指定が全パターンで正しく効く。UI文言の信頼性向上。
- **難易度**: S〜M / **リスク**: 中（既存examplesのoptions指定パターンをgrepで全数調査してから変更）
- **検証**: 実機で `{acc:8}` 単独指定→設定モーダルで8Gと表示されること、`getDeviceInformation()` の実値確認。既存22 examplesのbuildCoreToolkit呼び出しを機械的に列挙し回帰対象を特定。

### T5. 初心者セットアップ導線の一元化【Phase 1】
- **課題**: HTTPS/ローカルサーバ/Chrome限定/Bluefy/シューレースマウントの前提が分散し、READMEに無い。tutorial第2章が「準備中」。
- **なぜ重要か**: 「接続できる」までの最初の10分が勝負というプロダクト方針そのもの。LPを薄く保つ方針に沿い、**受け皿はdocs側に作る**。
- **対象**: `README.md`（Requirementsセクション追加）、`docs/getting-started-*.html` 相互リンク、`tutorial/index.html`（準備中の扱い）、必要なら `docs/setup-requirements.html` 新設
- **期待効果**: ワークショップ冒頭の定型トラブル（file://で開く、Safariで開く）の削減。
- **難易度**: S / **リスク**: 低（docsのみ。LPは1リンク追加程度に留める＝Codexプレビュー要件）
- **検証**: リンク切れ機械チェック、初見者1名にREADMEだけで接続してもらうウォークスルー（人間）。

### T6. examples/starterの完成度（ギャラリー・コピー導線）【Phase 1】
- **課題**: サムネイル21/34欠落、`_COPY.txt` が手動同期（乖離リスク。現状4組は同一確認済み）、MIN系未コミット（T1）、p5.js 1.4.1固定。
- **なぜ重要か**: catalog.json主導の公開ギャラリーが「見せられる」状態になる最後のピース。`_COPY.txt` はp5.js Web Editor/Copilot貼り付け用の主要導線。
- **対象**: `examples/_thumbnails/`、`scripts/`（COPY同期スクリプト新設）、`starter-templates/*_COPY.txt`、`examples/catalog.json`（thumbnail欄、Codex管理）
- **期待効果**: ギャラリー完成度62%→100%、テンプレ二重管理の自動化。
- **難易度**: M（サムネイルは実機スクショが理想。まずプレースホルダでも可）/ **リスク**: 低
- **検証**: `node scripts/check-examples-static-quality.js` の thumbnail warning がゼロに。新設 `scripts/sync-starter-copies.js --check` で.htmlと.txtのdiffゼロをCIゲート化（T7と連動）。

### T7. テスト・CI基盤【Phase 3】
- **課題**: CI無し。既存の検証資産（unitテスト1本、catalog/static-qualityスクリプト）が自動実行されない。パーサのテストがCORE 2.0 header 40の1ケースのみ。
- **なぜ重要か**: agents.mdの「人間+Codex+Claude並行開発」では、機械的な安全網が無いとレビュー負荷が人間に集中する。既存資産の接続だけならリスクゼロで導入できる。
- **対象**: `.github/workflows/ci.yml`（新設）、`package.json`（`"test"` スクリプト）、`tests/`（STEP_ANALYSIS header 0/1/2/4、SENSOR_VALUES header 50、range変換、deprecated名変換のテスト追加）
- **期待効果**: 全PRで構文チェック+unit+カタログ整合が自動化。パーサ回帰（PR #117のような修正）の再発防止。
- **難易度**: S（CI導入）+ M（テスト拡充）/ **リスク**: 低（既存スクリプトの実行のみから開始）
- **検証**: 意図的に壊したブランチでCIが赤くなること。既存テストが `tests/core2-header40-parse.test.js` 方式（vm+スタブcontext）でNode単体実行可能なことは確認済み——同方式で拡張可能。
- **備考**: 実機必須領域（BLE挙動）はCI対象外と明記し、`DEVICE_TEST_PLAN.md` をリポジトリにコミットして「実機チェックリスト」として運用（agents.mdの実機検証ルールと接続）。

### T8. バージョニング・リリース衛生【Phase 3】
- **課題**: 手書きLast modified文字列の乖離、git tag停止（v1.2以降無し）、CDN `@main` 直参照、api_doc生成物の鮮度ズレ、npm未公開（かつライセンス確定待ち）。
- **なぜ重要か**: `@main` 参照は「教材が昨日と今日で挙動が変わる」リスク。v1.4.0ライセンス方針（README L64-74）を実効化するにもタグ運用が前提。
- **対象**: `js/ORPHE-CORE.js` L1-3・L13、`README.md`、タグ `v1.3.4`（現状の安定点）、`starter-templates/`・docsのCDN URL（`@main`→`@v1.x`ピン留めの方針決定）、`.github/workflows`（api_doc生成 or 生成チェック）
- **期待効果**: 「ワークショップ前にタグを切り、教材はタグ参照」という運用が可能に。ライブラリ修正が教材を勝手に変えない。
- **難易度**: M / **リスク**: 中（ピン留めはhotfix伝搬を遅らせる副作用。教材=ピン留め、README冒頭スニペット=最新、のように使い分けを決める）
- **検証**: jsDelivrで `@v1.3.4` URLが解決すること、各テンプレをWeb Editorで実機接続確認。
- **依存**: npm公開そのものは license-v2.md の法務確定が先（未確認事項へ）。

### T9. 中長期アーキテクチャ【Phase 4】
- **課題**: (a) パーサがOrpheクラスとBLE/DOM依存に密結合（テストは vm+スタブで回避中）、(b) range変換ロジック3箇所重複（begin L478-485 / onRead L1585-1592・L1705-1712 / CoreToolkit L35-43）、(c) 型定義・ESM無し（グローバル `Orphe` のみ）、(d) `CoreAnalytics.js`/`CoreRecorder.js` がドラフトブランチで停止（in-flight.md P2）、(e) 単一 `dataCharacteristic` スロット+`hashUUID_lastConnected` の暗黙状態（`_gattOperationQueue` で直列化されてはいる）。
- **なぜ重要か**: パーサの純関数化は「実機なしでテストできる範囲」を最大化する一手で、テーマT7の伸びしろを決める。d.tsはVSCode/Copilot補完の質＝AI駆動ワークショップの質。
- **推奨順序**: ①range変換ユーティリティ統一（挙動不変のリファクタ+テスト）→ ②パーサ関数の切り出し（`parseStepAnalysis(dataView)`/`parseSensorValues(dataView, ranges)` を内部利用、公開APIは不変）→ ③手書き `orphe-core.d.ts` 追加（ビルド導入なしで効果が出る）→ ④ESM/UMDビルドとnpm公開（ライセンス確定後）→ ⑤CoreAnalytics/Recorder再始動（agents.mdの分離モジュール方針どおり）。
- **難易度**: L / **リスク**: 中〜高（①②は挙動不変を機械的に担保できるが、Codexレビュー+実機スモーク必須）
- **検証**: 切り出した純関数に対する既知バイト列のスナップショットテスト（現行実装の出力を正として固定）、`tests/bridge/unit-test.html`、実機スモーク。

---

## 3. 優先順位つきロードマップ

### Phase 0: すぐできる安全な改善（〜1週間）
1. `docs/in-flight.md` 棚卸し（stale行の整理、本計画のタスク登録）
2. 未コミット変更の裁き: MINテンプレ2種+_COPY.txtのコミット、PINGPONG修正diffのレビュー、mp3の採否（日本語ファイル名はURLエンコード問題があるためリネーム推奨）
3. worktree 5ブランチ（`codex/fix-ble-shared-bridge-reset`, `codex/readme-install-paths`, `codex/readme-license-v140`, `codex/remove-icc-externalize-pose`, `codex/seo-language-pages`）のマージ/破棄判断リスト作成 → 人間確認
4. デッドファイル除去（GAME-RHYTHMのSDKコピー、.DS_Store、.obsidian のgit rm --cached）
5. `DEVICE_TEST_PLAN.md` を `docs/` へコミット（実機検証の共通チェックリスト化）

### Phase 1: ワークショップ/外部開発者体験（1〜2週間）
6. README Requirementsセクション（HTTPS/Chrome/ローカルサーバ/Bluefy）+ getting-started相互リンク
7. tutorial第2章の解消（執筆 or 「準備中」導線の撤去。人間判断）
8. `_COPY.txt` 同期スクリプト新設（`--check` モード付き）
9. サムネイル21件（プレースホルダ→実機スクショの2段階可）
10. p5.jsバージョン更新の検証（Web Editor実機確認とセットで。急がない）

### Phase 2: 接続安定性・API品質（実機検証日を設定して実施）
11. `begin()` エラー経路修正（T2）
12. CoreToolkit range修正（T4）+ UI文言/typo一括修正
13. direction/type実機確定 → 全ドキュメント統一（T3）
14. `device_information` 未初期化ガード、エラー型統一（文字列→Error）、`interpolation` の表記整理（「未実装・予約」と明記 or シグネチャから除去）

### Phase 3: テスト/CI/リリース品質
15. CI最小導入（node --check 全js + 既存unit + catalogチェック + COPY同期チェック）※効果対リスク比が最良のため**前倒し推奨**（後述）
16. パーサunitテスト拡充（STEP_ANALYSIS各header、header 50、deprecated名、range変換）
17. バージョン規律: v1.3.4タグ、Last modified自動化 or 撤廃、CHANGELOG.md、教材のCDNピン留め方針
18. api_doc生成の自動化（生成物コミット方式を続けるならCIで乖離検知）

### Phase 4: 中長期の設計改善
19. range変換ユーティリティ統一 → パーサ純関数化 → `orphe-core.d.ts` → ESM/UMD+npm（ライセンス確定後）→ CoreAnalytics/Recorder再始動（T9の順序どおり）

---

## 4. PR分割案

> ブランチ名はagents.md規約（codex/=SDK・既存examples・LP、claude/=新規docs・新スクリプト草案）。すべて1PR1目的、PRテンプレ（Summary/Validation/Needs real-device validation/Out of scope/Questions/Next）に従う。

| # | PR名（ブランチ） | 目的 | 主な変更ファイル | 受け入れ条件 | テスト方法 | 依存 |
|---|---|---|---|---|---|---|
| 01 | `codex/inflight-refresh-2026-07` | in-flight棚卸し+worktreeブランチ処遇表 | `docs/in-flight.md` | stale行ゼロ、5ブランチに推奨処置が明記 | レビューのみ | なし |
| 02 | `codex/commit-starter-min-templates` | 未コミットMINテンプレの裁きと公開 | `starter-templates/P5_CORETOOLKIT_MOTION_PINGPONG*`, `*_MIN*` | .htmlと_COPY.txtが同一、starter README表に追記、git statusクリーン | 手元ブラウザ+p5.js Web Editor貼り付けで表示確認（接続は実機日で） | 01 |
| 03 | `codex/repo-hygiene-dead-files` | デッドファイル除去 | `examples/GAME-RHYTHM/ORPHE-CORE.js`・`p5.js`、`.DS_Store`群、`.obsidian` | GAME-RHYTHMの動作不変（CDN参照確認済み: index.html L13）、`git ls-files` に.DS_Store無し | ページをローカルサーバで開き console error ゼロ | 01 |
| 04 | `codex/device-test-plan-commit` | 実機チェックリストのコミット化 | `docs/device-test-plan.md`（.claude/audit から移設・汎用化） | Phase 2各PRから参照可能な手順書になっている | レビューのみ | 01 |
| 05 | `codex/readme-setup-requirements` | セットアップ要件の一元化 | `README.md`, `docs/getting-started-*.html`（相互リンク） | HTTPS/Chrome/ローカルサーバ/Bluefyが1画面に集約、LP変更は最小 | リンク切れチェック、初見者ウォークスルー | なし |
| 06 | `codex/starter-copy-sync-script` | _COPY.txt自動同期 | `scripts/sync-starter-copies.js`, `package.json`(scripts) | `--check` で全組diffゼロ、`--write` で再生成 | スクリプト実行+意図的に壊して検知確認 | 02 |
| 07 | `claude/example-thumbnails-pass1` | サムネイル補完（第1弾: public/public-candidateのみ） | `examples/_thumbnails/*`, catalog.jsonはCodexへ提案 | static-qualityのthumbnail警告が対象分ゼロ | `node scripts/check-examples-static-quality.js` | なし |
| 08 | `codex/ci-minimal` | CI最小導入 | `.github/workflows/ci.yml`, `package.json` | PRごとに: 全js `node --check`→既存unitテスト→catalogチェック→(06後)COPYチェック | 壊したブランチで赤、mainで緑 | なし（06は後付け可） |
| 09 | `codex/fix-begin-notify-error-paths` | begin()永久ハング修正 | `js/ORPHE-CORE.js` L497-551 | 3 type全てでnotify失敗時にonError発火+undefined返却、ハングなし。既存成功経路の戻り値文字列は不変 | unitテスト（startNotifyをスタブしreject注入）+実機（DEVICE_TEST_PLAN該当節） | 04, 08推奨 |
| 10 | `codex/fix-coretoolkit-range-conversion` | range二重変換修正 | `js/CoreToolkit.js` L24-44（+必要ならORPHE-CORE.js begin()に0-3受理を追加） | `{acc:8,gyro:-1}` 等の部分指定が実機で正しく反映 | 既存22examplesの呼び出しgrep一覧を添付+実機で設定値read back | 04, 08 |
| 11 | `codex/gait-direction-docs-truth` | direction/type仕様統一 | `js/ORPHE-CORE.js`(JSDocのみ), `CLAUDE.md`, `docs/ai/SENSOR_RECIPES.md`, `api_doc/`再生成 | 3箇所の記述が実測表と一致、api_doc再生成済み | 実機計測ログをPRに添付 | 実機計測 |
| 12 | `codex/coretoolkit-ui-strings` | typo/文言/i18n修正 | `js/CoreToolkit.js` L46,108,123,143,169,284 | 文言修正のみで挙動不変（L169はselected設定が正しく動くようになる） | ブラウザでモーダル表示確認 | 08 |
| 13 | `codex/parser-unit-tests` | パーサテスト拡充 | `tests/*.test.js`, `package.json` | STEP_ANALYSIS header 0/1/2/4、SENSOR_VALUES header 50/40、deprecated名変換、range変換のテストが緑 | `npm test`（CIで自動） | 08 |
| 14 | `codex/version-and-cdn-pinning` | v1.3.4タグ+教材ピン留め方針 | タグ, `README.md`, `CHANGELOG.md`新設, starter/docsのCDN URL | 教材はタグURL、README冒頭は方針どおり、Last modified文字列の扱い決定 | jsDelivrタグURL解決確認+Web Editor実機 | 09,10,11後（安定点でタグ） |
| 15 | `codex/refactor-range-utils`（Phase 4先鋒） | 変換ロジック統一 | `js/ORPHE-CORE.js`, `js/CoreToolkit.js` | 挙動不変（13のテストが全緑のまま）、重複3→1箇所 | unit+実機スモーク | 10, 13 |

補足: `claude/`系はサムネイル・新規スクリプト草案・docs調査系に限定し、`js/ORPHE-CORE.js`・`CoreToolkit.js`・`index.html`・`catalog.json` 本体はCodex+人間レビュー経由（agents.md準拠）。

---

## 5. 最初に着手すべき3つ

1. **PR-01 in-flight棚卸し（+PR-02 MINテンプレのコミット）** — 効果: 以後の全作業の前提整備と、既に作った初心者向け最重要テンプレの即時公開。リスク: ほぼゼロ。検証: git statusとレビューのみで完結。**未コミットのまま放置されている成果物の救出が最速のリターン。**
2. **PR-08 CI最小導入** — 効果: 既存資産（unitテスト・catalogチェック・node --check）を全PRの安全網に変え、Phase 2のコア修正に進む土台になる。リスク: 低（新規ワークフローのみ、既存ファイル変更は package.json の scripts 追記程度）。検証: 壊したブランチで赤くなることを確認するだけ。
3. **PR-09 begin()エラー経路修正** — 効果: 「接続失敗でハング」というワークショップで最悪の体験を潰す、本計画で最も価値密度の高いコード修正。リスク: コア変更だが差分は局所的で、undefined-resolve互換を維持すれば既存アプリを壊さない。検証: startNotifyスタブのunitテスト+`tests/bridge/`+DEVICE_TEST_PLANで実機手順が既に用意されている。**実機検証日を先に確保してから着手すること（agents.mdルール）。**

---

## 6. 未確認事項

### 人間の判断が必要
- **ライセンス**: v1.4.0利用方針の法務確定と `LICENSE`/`COMMERCIAL_LICENSE` ファイル化（license-v2.mdはPolyForm NCベース推奨で停止中）。npm公開・タグ運用（PR-14）のブロッカー。
- **worktree 5ブランチの処遇**（特に `codex/fix-ble-shared-bridge-reset` はSDK修正を含む可能性→mainとのdiff確認要）。
- **tutorial第2章**: 執筆するか、LP/tutorialから「準備中」導線を外すか。
- **mp3（日本語ファイル名・未追跡）**: 採用するならASCIIリネーム+ライセンス出所確認。
- **サムネイル方針**: プレースホルダ許容か実機スクショ必須か（catalog.jsonのstatus昇格判断と連動）。
- **教材CDNのピン留め**: タグ固定に切り替える範囲（starter全部か、ワークショップ教材のみ27箇所のp5 Web Editorスケッチ側も含むか）。
- **GitHub open issues/PRの突合**: 本調査で未取得。PR-01の際に `gh issue list`/`gh pr list` で本計画の各PRと重複がないか確認。

### ハードウェア実機が必要
- direction/typeの実測確定（左右装着×前後左右ステップ、CORE/CORE 2.0両方）→ PR-11の前提。
- LED発光パターン数の実測（setLED JSDocの0-4 vs CoreToolkitの0-6巡回）。
- PR-09/10/15の回帰確認（3 notification type × 切断/キャンセル/再接続、range設定のread back）。
- header 50（200Hzモード）の実データ取得（現状テストはheader 40のみ。テスト拡充PR-13の入力データ収集）。

### ブラウザ実機検証が必要
- `navigator.bluetooth.getDevices()` がフラグ無しで動くChromeバージョン範囲（autoReconnect/Fast Reconnect/デバイス記憶の前提。動かない環境でのフォールバック挙動確認）。
- p5.js Web Editor上での全p5系テンプレ動作（特にMIN系、iframe内localStorage/BroadcastChannelの挙動＝BleSharedBridgeとデバイス記憶への影響）。
- Bluefy（iOS）での starter 最小テンプレ動作。
- 複数タブbridge（`tests/bridge/` の物理テストページ群）のChrome最新版での再確認。
