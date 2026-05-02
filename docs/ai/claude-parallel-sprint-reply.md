# Reply Prompt for Claude: Parallel Development Sprint

Use this prompt when asking Claude to proceed from the IMU competitor research and sprint proposal.

```text
ORPHE-CORE.js の並行開発方針を Codex 側と相談しました。

結論として、Claude には新規追加・教材・分析/録画ヘルパーの初稿を進めてもらい、Codex は ORPHE-CORE.js ライブラリ本体の品質維持、既存 examples の整理、公開品質化、BLE/CoreToolkit/catalog/index 周りを優先します。

作業前に必ず以下を読んでください。

- docs/agents.md
- docs/in-flight.md
- docs/examples-roadmap.md
- docs/examples-catalog.md
- docs/public-candidate-validation.md

重要な方針:

1. main へ直接 push しない
2. 1 PR = 1 目的
3. Claude は原則として以下を担当
   - 新規 examples/<new>/ の追加
   - docs/lessons/ の授業案
   - docs/ai/ の調査/設計ドキュメント
   - js/CoreAnalytics.js の初稿
   - js/CoreRecorder.js の初稿
4. Claude は原則として以下を直接編集しない
   - js/ORPHE-CORE.js
   - js/CoreToolkit.js
   - index.html
   - examples/catalog.json
   - 既存 examples のゲームロジックやBLE処理
5. catalog 追加が必要な場合は、PR本文に proposed catalog metadata として提案してください。Codex が取り込みます。
6. 新規 example は実機未確認なら public と断定せず、public-candidate または needs-review 前提で提案してください。
7. BLE、通知タイプ、歩容指標、CMJ計算、左右差計算などの仕様判断は、Assumptions / Questions for human に明記してください。

Codex側の優先順位:

- ORPHE-CORE.js 本体の信頼性
- BLE接続、共有接続、再接続、CoreToolkit UIの安定性
- 既存 examples を全て公開品質に近づけること
- examples/catalog.json と index.html の整合性
- 実機確認が必要なものを正直に分けること

Claudeにお願いしたい次の作業:

まずは以下の順で、衝突しにくいPRを作ってください。

PR 1: docs/lessons/ の構成案
- Tier 1 example 6本に対する45分授業プランのテンプレートを作成
- 実装は不要
- 論文引用は候補として記載し、事実確認が必要なものは明記

PR 2: js/CoreAnalytics.js API draft
- 新規ファイルのみ
- ORPHE-CORE.js 本体には触らない
- gotGait / gotStride / gotPronation / gotConvertedAcc など既存callbackからデータを受け取れる形にする
- session summary, baseline, symmetry, CMJ計算の関数名と入力/出力を明確にする
- 実装は最小でもよいが、API設計とJSDocを重視

PR 3: js/CoreRecorder.js API draft
- 新規ファイルのみ
- examples/SENSOR-CALIBRATION/recorder.js を参考にする
- 既存 SENSOR-CALIBRATION はまだ変更しない
- CSV/JSON schema と replay 互換性を説明

PR 4以降: 新規 Tier 1 example の小さなPoC
- まずは Step Count Dashboard または CSV Recorder のどちらか1本
- 既存 example を壊さない
- 実機未確認ならREADMEに Needs real-device validation と書く
- catalog.json には直接触らず、PR本文に proposed catalog metadata を書く

各PR本文には必ず以下を入れてください。

- Summary
- Validation
- Assumptions
- Needs real-device validation
- Out of scope
- Proposed catalog metadata if relevant
- Questions for human
- Next PR candidates

作業開始時と終了時には docs/in-flight.md を更新してください。
もし Codex が触るべきファイルに変更が必要だと思った場合は、直接編集せず、docs/in-flight.md またはPR本文に Codex follow-up として書いてください。
```
