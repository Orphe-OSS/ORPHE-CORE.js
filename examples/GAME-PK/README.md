# Penalty Kick Game

> **Status**: `public-candidate` — see [`docs/examples-catalog.md`](../../docs/examples-catalog.md) for the full audit.

1台のORPHE COREを足に装着して、キック動作の強さと向きでシュートを操作するペナルティキックゲームです。マウス操作でも遊べるため、センサー接続前にゲーム内容を確認できます。

## このexampleで学べること

- 加速度の大きさをキックの強さとして使う方法
- オイラー角の変化をシュート方向に変換する方法
- CoreToolkit UIから1台のORPHE COREに接続する構成

## 使うデータ

- 加速度 (gotConvertedAcc, 実Gスケール)
- オイラー角 (euler)

## 必要なORPHE CORE数

- 1 台

## 起動方法

1. ローカルサーバを起動します。
2. ブラウザで `examples/GAME-PK/` を開きます。
3. 画面上部のCoreToolkit UIからORPHE COREへ接続します。
4. STARTを押し、カウントダウン後に足を振ってキックします。

GitHub Pagesでも試せます。

<https://orphe-oss.github.io/ORPHE-CORE.js/examples/GAME-PK/>

## 実機確認

- **未実機確認** — CoreToolkitの接続構造は整理済みですが、BLE接続後のキック判定はオーナーレビュー待ちです。
- 1台接続、START、キック検出、スコア更新、RESTARTを確認してください。

## 関連example

- [`examples/GAME-SHOOTING2/`](../GAME-SHOOTING2/README.md) — 3D Shooting Game

## 元データ

このREADMEは公開候補としての確認観点を残しています。実機確認後に `examples/catalog.json` の status を更新してください。
