# 実機テスト計画 — fix/examples-audit-critical ブランチ

**作成日**: 2026-05-01
**対象ブランチ**: `fix/examples-audit-critical`
**前提デバイス**: ORPHE CORE × 2 (左/右ペア)
**前提環境**: macOS / Chrome 最新版 / Bluetooth 有効
**保存場所**: `.claude/audit/` (ローカル限定、未コミット)

> このファイルは AI/人間共用のテスト手順書です。実機テスト前に一読し、各項目を確認しながら実施してください。
> サンドボックス制約により私 (AI) はローカルサーバ起動による動作確認ができませんでした。明日の実機テストでブラウザ動作・コンソールエラーは人間が確認する必要があります。

---

## 0. 事前準備

### 0-1. ブランチ切替・サーバ起動

```bash
cd /Users/kikukawayuuya/Documents/Development/Cursor/ORPHE-CORE.js
git checkout fix/examples-audit-critical
git status                 # 変更が残ってないか確認 (HURDLE-COOL 以外は clean のはず)

# 静的サーバ起動 (どれか 1 つ)
python3 -m http.server 8888       # http://localhost:8888/
# または
npx serve -p 8888                 # 同上
```

### 0-2. ORPHE CORE デバイスの状態確認

- [X] バッテリー残量 (LED で確認)
- [X] LED が片方ずつ点灯している (片方=ID0=左, もう片方=ID1=右 を物理的に区別)
- [X] Chrome の `chrome://bluetooth-internals/` で Bluetooth が有効か

### 0-3. ブラウザ DevTools 開きっぱなし

- [X] `Cmd+Option+I` で DevTools を開く
- [X] Console タブを表示
- [ ] **赤いエラーが出たら即時テスト中止して報告対象**

---

## 1. starter-templates 動作確認 (最重要・修正の核)

接続→数値表示で動作確認。**EULER と QUATERNION は今回の修正で動くようになったはずの最重要項目**。

| URL                                          | 期待動作                                                       | 修正前                                                                                         | 修正後                                   |
| -------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `/starter-templates/EULER.html`            | connect 後、`pitch / roll / yaw` の 3 行に小数値が流れ続ける | **動かない** (begin() がデフォルトで STEP_ANALYSIS、Euler は SENSOR_VALUES でしか来ない) | 動く                                     |
| `/starter-templates/QUATERNION.html`       | connect 後、`w / x / y / z` の 4 行に値が流れ続ける          | **動かない** (同上)                                                                      | 動く                                     |
| `/starter-templates/ACCELEROMETER.html`    | connect 後、`x / y / z` に値 (-1〜1 の正規化値)              | 動く                                                                                           | 動く (変更なし)                          |
| `/starter-templates/GYRO.html`             | 同上                                                           | 動く                                                                                           | 動く (変更なし)                          |
| `/starter-templates/STEPS.html`            | 歩く度に steps 値が増加                                        | 動く                                                                                           | 動く (begin('STEP_ANALYSIS') 明示化のみ) |
| `/starter-templates/STRIDE.html`           | 歩く度に stride x/y/z が更新                                   | 動く                                                                                           | 動く (同上)                              |
| `/starter-templates/PRONATION.html`        | 歩く度に pronation x/y/z が更新                                | 動く                                                                                           | 動く (同上)                              |
| `/starter-templates/LIGHT.html`            | connect 後、5 つのボタンで LED パターン変化                    | 動く                                                                                           | 動く (同上)                              |
| `/starter-templates/ANALYSIS_AND_RAW.html` | acc x/y/z と steps_number が同時に流れる                       | 動く                                                                                           | 動く (変更なし)                          |

### チェックリスト

- [X] EULER.html で **新たに値が表示される** (修正の主目的)
- [X] QUATERNION.html で **新たに値が表示される** (修正の主目的)
- [ ] 他の 7 ファイルがリグレッションしていない　→リグレッションって何？
- [ ] DevTools Console に赤エラーが出ていない

---

## 2. CORETOOLKIT-STARTER の動作確認

修正の主目的: 「buildCoreToolkit() を呼ばない」「#status0 等が無い」の致命傷を解消。

URL: `/examples/CORETOOLKIT-STARTER/`

### 期待挙動

1. ページ読み込み時に DevTools Console で `> Bluetooth API supported.` 等の SDK 初期化ログが出る
2. ページ上部に CoreToolkit 由来の **接続スイッチが 2 つ並ぶ** (以前は空っぽだった)
3. 1 つ目のスイッチを ON にして ORPHE CORE 1 台目を選択 → デバイス情報のテーブルに quat/euler/gyro/acc/gait/stride/pronation の値が流れる
4. 2 つ目のスイッチも同様に動く
5. **DevTools Console に赤エラーが出ない** (修正前は `#status0` 等で TypeError)

### チェックリスト

- [X] 接続スイッチが 2 つ表示されている
- [X] 1 つ目に接続できる
- [X] テーブルに値が表示される
- [X] 歩くと gait.direction (0/2/4/6) が変化する
- [X] 2 台目も接続できる
- [ ] Console エラーが無い

---

## 3. FOOT ANGLE 動作確認

修正の主目的: `_foot_angle` 未定義によるクラッシュ解消。

URL: `/examples/FOOT ANGLE/` (※ディレクトリ名にスペースがあるので URL エンコードに注意: `/examples/FOOT%20ANGLE/`)

### 期待挙動

1. CoreToolkit のスイッチで接続
2. canvas に左右の足跡画像が表示される
3. **歩行で foot_angle が来るたびに ellipse (オレンジ円) が描画される** ← 修正の主目的
4. 同時にトーン音が鳴る (p5.TriOsc)

### チェックリスト

- [X] 接続できる
- [X] **歩いたら円が描画される** (修正前は `_foot_angle is not defined` エラーで落ちていた)
- [ ] Console エラーが無い

---

## 4. GAME-PINGPONG / GAME-MARIO の動作確認

修正の主目的: `connectedDevices === 3` (永久に成立しない) を `=== 4` に。PINGPONG は通知タイプも修正。

### 4-A. GAME-PINGPONG `/examples/GAME-PINGPONG/`

1. CoreToolkit のスイッチを 2 つとも ON
2. 両 ORPHE CORE 接続成功 → **`mystart()` が呼ばれてゲーム開始** ← 修正の主目的
3. パドルが Euler の roll 等に応じて動く (PINGPONG は SENSOR_VALUES が必要なため `STEP_ANALYSIS_AND_SENSOR_VALUES` に変更済み)

### チェックリスト (PINGPONG)

- [X] 接続後にゲームが開始する (修正前は永久に開始しなかった)
- [X] パドルが足の向きに反応する
- [ ] Console エラーが無い

### 4-B. GAME-MARIO `/examples/GAME-MARIO/`

1. CoreToolkit のスイッチを 2 つとも ON
2. **`mystart()` が呼ばれてゲーム開始** ← 修正の主目的
3. 歩行検知でマリオが動く

### チェックリスト (MARIO)

- [X] 接続後にゲームが開始する
- [X] 歩いたらキャラクタが動く
- [ ] Console エラーが無い

> **トラブルシュート**: もし `=== 4` でも動かない場合、SDK の onConnect 発火タイミングが想定と異なる可能性。Console で `connectedDevices` の値を観察 (各 onConnect 発火点に `console.log(connectedDevices)` を追加) して実際の最大値を確認。

---

## 5. drum_test 動作確認

修正の主目的: `=== 4` を `=== 2` に (SENSOR_VALUES のみのため発火回数 1/device)。

URL: `/examples/drum_test/`

### 期待挙動

1. CoreToolkit のスイッチを 2 つとも ON
2. **`gamepar = 5` がセットされ、p5 ループが開始** ← 修正の主目的
3. 加速度大きい動作で太鼓音が鳴る

### チェックリスト

- [X] 接続後にゲーム状態が変化する (gamepar=5)
- [X] 動かすと音が鳴る
- [X] Console エラーが無い

---

## 6. INFORMATION 動作確認

修正の主目的: ボタンセレクタを `getElementById('btn_get_info')` に修正。

URL: `/examples/INFORMATION/`

### 期待挙動

1. 接続スイッチを ON にして ORPHE CORE と接続
2. 「Get Device Information」ボタンが **disabled → enabled になる** ← 修正の主目的
3. ボタンをクリックすると battery/lr/rec_mode 等が表示される

### チェックリスト

- [X] 接続できる
- [X] ボタンが有効化される
- [X] クリックで情報表示
- [ ] 切断するとボタンが disabled に戻る　　→connectボタンで切断しても特に表示は変わらず disabledという文字列は確認できず

---

## 7. GAME-HURDLE 新ランキング (frozen + localStorage) 動作確認

修正の主目的: Firebase 連携を**完全撤去**し、`ranking-frozen.json` (legend スナップショット) と `localStorage` (このブラウザのスコア) を merge する自己完結ランキングに置換。ネットワーク無し、credential 無し。

URL: `/examples/GAME-HURDLE/`

### 7-A. ページ読み込み時の確認

1. DevTools Console に **`[HURDLE] Loaded 0 frozen ranking entries.`** が出る (`ranking-frozen.json` を空配列で読み込んだ)
2. Console エラーは出ない (Firebase 関連の SDK fetch / auth エラーが完全消失している)
3. スタート画面に「ランキング / RANKING」ボタンが**常時表示されている** (旧仕様では Firebase 認証なしだと hidden だった)

### 7-B. 接続 + ゲーム動作

1. CoreToolkit で 2 台接続 → ゲーム本体は動く
2. 110m 走をプレイ → 完走 / FINISH 画面
3. 1 秒後に `prompt('ランキングに登録する名前を入力してください')` が出る
4. 名前を入力 (例: `Test1`) → `[HURDLE] Local score saved.` が Console に出る

### 7-C. ランキング画面

1. FINISH 画面の「ランキング / RANKING」ボタンをクリック
2. 自分のスコアが **金色ハイライト + `YOU` バッジ**付きで表示される
3. 別の名前で再度走って同じ手順 → 2 つの自分スコアが両方表示され、time 昇順でソート
4. 「戻る」で FINISH 画面へ

### 7-D. localStorage 永続性

1. DevTools の Application タブ → Local Storage → 該当 origin → `hurdle.localRankings` キーが存在
2. JSON 配列で `[{name, time, hurdles, date(ISO)}, ...]` の形で保存されている
3. ページ reload しても消えない
4. クリアしたい時は localStorage の該当キーを削除すれば全消去可能

### 7-E. frozen データの追加 (オプション)

旧 Firestore のレジェンドデータを表示したい場合、ユーザーが以下を実施:

1. Firebase コンソール → Firestore → `ranking` collection を開く
2. 各 document を export → `name / time / hurdles / date` の 4 フィールドを抽出
3. `examples/GAME-HURDLE/ranking-frozen.json` の `rankings: []` 配列に追記。形式は `_format` フィールドおよび `_example` を参照
4. ページ reload → Console に `[HURDLE] Loaded N frozen ranking entries.` (N = 追加件数) が出る
5. ランキング画面に legend が表示される (your score とは見た目で区別される)

### チェックリスト

- [ ] Console エラーが無い (Firebase 関連の TypeError や fetch error が消えている)
- [ ] 「ランキング / RANKING」ボタンがスタート画面に常時表示
- [ ] 完走 → 名前入力 → Console に `[HURDLE] Local score saved.`
- [ ] ランキング画面に自分のスコアが `YOU` バッジ付きで表示
- [ ] 複数回走ると複数行が time 昇順で並ぶ
- [ ] localStorage に `hurdle.localRankings` が永続化
- [ ] (任意) `ranking-frozen.json` に legend データを入れて表示

> **重要**: 旧 Firebase credential `AIzaSyDimrSblIDOusCS6fXwrTE_qLGN0qjYLRY` (project `orphecorejsgamehurdle`) は git history に残っているため、Firebase コンソールで:
>
> - API key を **rotate (再発行)** または revoke
> - Firestore Security Rules を厳格化
> - `ranking` collection が必要であれば export して `ranking-frozen.json` に貼り付け
> - 不要であれば project ごと削除して終わり

### HURDLE-COOL について

ユーザー指示で `examples/GAME-HURDLE-COOL/` ディレクトリは**完全削除**しました。`.vscode/settings.json` のみサンドボックス制約で残ってしまったので、以下を手動実行してください:

```bash
rm -rf examples/GAME-HURDLE-COOL/
ls examples/ | grep -i hurdle-cool   # 何も出ないことを確認
```

このディレクトリは元から git に追跡されていなかったため、削除はリポジトリ履歴に影響しません。

---

## 8. GAME-BOXING 動作確認

修正の主目的: 古い `js/ORPHE-CORE.js` (2024/06/17) → `../../js/ORPHE-CORE.js` (最新)。

URL: `/examples/GAME-BOXING/`

### 期待挙動

1. ページ読み込み時に SDK バージョン日付が DevTools Console に出る → **`Last modified: 2026/01/31 23:52:51`** であること
2. ゲーム本体は変更していないので機能差は無いはず

### チェックリスト

- [ ] SDK 日付が 2026/01/31 になっている
- [X] ゲームが起動する
- [X] Console エラーが無い (古い SDK 削除による副作用がないか確認)

> **注意**: BOXING の `game.js` には `new Orphe()` 引数なし、`disconnect()` (SDK にない) など別の High バグが残っています。今夜の修正範囲外。明日の実機テストで「接続できないなど」の症状が出たら確認すること。

---

## 9. p5.ORPHE.FSR_visualise の動作確認

修正の主目的: 未参照のローカル SDK / ライブラリコピーを削除 (約 11.7 万行)。動作影響は無いはず。

URL: `/examples/p5.ORPHE.FSR_visualise_0327_submit/`

### 期待挙動

- ページが従来通り CDN から SDK / p5 / Bootstrap を読み込んで動く
- 接続して FSR ビジュアライザが表示される

### チェックリスト

- [ ] ページが正常に表示される
- [ ] CoreToolkit スイッチで接続できる
- [ ] 歩くとビジュアライザが動く
- [ ] Console エラーが無い

---

## 10. リグレッション確認 (修正していない example)

致命傷以外は今回触っていないが、間接影響が無いか軽くチェック:

| URL                        | 確認項目                                             |
| -------------------------- | ---------------------------------------------------- |
| `/examples/VISUALIZE/`   | チャートが流れる                                     |
| `/examples/GAME-DDR/`    | (DOM の id 重複が残るので動作しない可能性高、要修正) |
| `/examples/GAME-HURDLE/` | (上記 7 で確認済み)                                  |
| `/examples/GAME-PK/`     | (4 種類の HTML が並走しているので index.html を選択) |
| `/examples/AIRWALKER/`   | ダッシュボード表示                                   |

---

## 11. 終了処理

### 結果まとめ

各セクションの結果を以下に書き残す:

```markdown
- [x] starter-templates EULER/QUATERNION 修正確認  (2026-05-XX)
- [ ] CORETOOLKIT-STARTER ...
- [ ] ...
```

### 問題が見つかった場合の対応

1. **コミットされた修正が原因の場合**: `git revert <SHA>` でその修正だけ取り消す。または:

   - `git checkout fix/examples-audit-critical~1` で前のコミットを試す
   - 一段ずつ巻き戻して切り分け
2. **新たに見つかった致命傷**: `.claude/audit/EXAMPLES_AUDIT.md` の「未対応」セクションに追記
3. **ブランチごと放棄したい場合**:

   ```bash
   git checkout codex/lp-start-building-paths   # 元のブランチに戻る
   # fix/examples-audit-critical はそのまま残せる (削除しない)
   ```

### 完了後の next step

明日のテストが通ったら、以下を別 PR で計画:

- High severity 修正 (gotAcc → gotConvertedAcc, バージョンピン, GAME-PK 整理, AIRWALKER dead code 削除, GAME-BOXING ロジック修正)
- Minimal/Standard/Advanced への階層化 (EXAMPLES_AUDIT.md 「Section 5」の構造)
- 共通モジュール `examples/_shared/orphe-input.js` 作成 (compat 判定 + onError)
- README へのトラブルシューティング章追加

---

## 付録: 今夜のコミット履歴

```
ff79744 fix(drum_test): drop duplicate quaternion.js script tag
a2144fc fix(INFORMATION): use specific button id and explicit begin() argument
3915b2a fix(GAME-BOXING, p5.ORPHE.FSR): point at the root SDK, drop stale copies
946e25f fix(GAME-HURDLE): move Firebase credentials to opt-in local config
7df4af7 fix(FOOT ANGLE): correct _foot_angle ReferenceError + remove dead refs
2602db9 fix: correct connectedDevices comparison value per onConnect firing model
79af149 fix(GAME-PINGPONG, GAME-MARIO): connectedDevices === 2 + remove dead callback
0840520 fix(CORETOOLKIT-STARTER): call buildCoreToolkit and remove dead refs
75950d7 fix(starter-templates): explicit begin() notification type
ae99584 chore: gitignore .claude/ for local-only audit notes
```

各コミットメッセージに「なぜ・何を・どう直したか」が書いてあるので、`git log fix/examples-audit-critical -p` で詳細確認可能。
