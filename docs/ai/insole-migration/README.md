# INSOLE Migration Staging

`staging/` 配下は [ORPHE-INSOLE.js](https://github.com/Orphe-OSS/ORPHE-INSOLE.js) リポジトリへ
そのままコピーできる形で作成した移植・改修ファイル一式です。
背景と設計判断は [`../insole-migration-plan.md`](../insole-migration-plan.md) を参照してください。

## staging の内容

| staging 内パス | INSOLE リポジトリでの配置先 | 内容 |
|---|---|---|
| `src/ORPHE-INSOLE.js` | `src/ORPHE-INSOLE.js`（置換） | SDK v1.1.0: デバイス記憶・自動再接続・クラス名 `OrpheInsole` 化（`Orphe` エイリアス維持） |
| `src/InsoleToolkit.js` | `src/InsoleToolkit.js`（新規） | slim 接続UIツールキット。`src/CoreToolkit.js` は削除候補（互換ラッパー内蔵のため） |
| `examples/VISUALIZE/` | `examples/VISUALIZE/`（新規） | 圧力6ch+IMU可視化（CORE 版 VISUALIZE の移植） |
| `tests/insole-stability.test.js` | `tests/`（新規） | 安定化機能の単体テスト |
| `tests/insole-coexistence.test.js` | `tests/`（新規） | CORE.js 併用時の識別子衝突の回帰テスト |
| `CLAUDE.md` | リポジトリ直下（新規） | AI 開発ガイド |
| `docs-ai/PRESSURE_RECIPES.md` | `docs/ai/PRESSURE_RECIPES.md`（新規） | 圧力データ処理レシピ集 |

## 適用手順

```bash
git clone https://github.com/Orphe-OSS/ORPHE-INSOLE.js
cd ORPHE-INSOLE.js
git checkout -b feature/stability-and-toolkit

# 本リポジトリの staging からコピー
STAGING=/path/to/ORPHE-CORE.js/docs/ai/insole-migration/staging
cp  $STAGING/src/ORPHE-INSOLE.js        src/
cp  $STAGING/src/InsoleToolkit.js       src/
cp -r $STAGING/examples/VISUALIZE       examples/
cp  $STAGING/tests/insole-stability.test.js tests/
cp  $STAGING/CLAUDE.md                  ./
mkdir -p docs/ai && cp $STAGING/docs-ai/PRESSURE_RECIPES.md docs/ai/

# package.json の test スクリプトに追記:
#   && node --check src/InsoleToolkit.js
#   && node tests/insole-stability.test.js
#   && node tests/insole-coexistence.test.js
# 検証とビルド
npm install
npm test
npm run build
npm run generate-docs
```

## 適用後の確認チェックリスト

- [ ] `npm test` 全パス（既存の insole-parser / hula-detector を含む）
- [ ] `examples/terminal` が従来どおり動作（`Orphe` エイリアス経由）
- [ ] `examples/sensor-dashboard` が従来どおり動作
- [ ] `examples/VISUALIZE` で 2台接続・5チャート描画・モード切替
- [ ] 電源OFF→ONで autoReconnect が復帰する（実機）
- [ ] ページ再読み込み時に選択ダイアログなしで再接続（chrome://flags 依存環境ではフォールバック動作）
- [ ] CORE.js と同一ページで読み込んでも SyntaxError にならず、`OrpheInsole` で利用できる
