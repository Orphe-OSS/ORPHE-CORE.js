# Ping Pong Game

> **Status**: `public` — see [`docs/examples-catalog.md`](https://github.com/Orphe-OSS/ORPHE-CORE.js/blob/main/docs/examples-catalog.md) for the full audit.

Simple competitive game concept using ORPHE input. 2人対戦のピンポン。各プレイヤーが1台のORPHE COREを持ち、センサーの傾き（ピッチ）でパドルを上下に動かします。

## このexampleで学べること

- 2台のORPHE COREをプレイヤーごとに割り当てる（`new Orphe(0)` / `new Orphe(1)`）
- `SENSOR_VALUES` 通知の `gotEuler` から1軸（`pitch`）だけを取り出してゲーム入力にする
- 両方のプレイヤーからデータが届いたことを確認してからカウントダウンを始める（接続回数ではなく、実際にEulerを受信した事実で開始）
- 切断時にゲームを止める

## 使うデータ

- オイラー角 `gotEuler`（`pitch` をパドルの位置に写像。感度スライダーで倍率を調整）

`gotQuat` / `gotGait` / `gotStride` / `gotFootAngle` / `gotPronation` も受け取って保持していますが、現在のゲーム処理では使っていません。歩行解析の値は、足に装着しない遊び方では意味を持ちません。

## 必要なORPHE CORE数

- 2 台（プレイヤーA・Bに1台ずつ）

## 通知タイプ

- `SENSOR_VALUES`

## 装着位置

- 実装は「ピッチ（前後の傾き）」だけを使うので、足の甲・手の甲のどちらでも動きます。
- 2026-08-14 の実機確認では装着位置が記録されていません（下記）。会場で使う装着位置は別途確認してください。

## 想定読者

- ゲームプレイヤー

## 実機確認

- **実機確認済み** — 2026-08-14、SAKA hyuga（PR #119）。Chrome、2台のORPHE COREを接続し、両方からEulerを受信してカウントダウンが始まること、ボールの移動とパドル操作を確認。
- 未記録: ORPHE CORE の世代（2.0 / 3.0）、FW版、OS、装着位置。詳細と追記は [`docs/device-validation-log.md`](../../docs/device-validation-log.md)。
- `examples/catalog.json` の `validation` / `needs_real_device_validation` もこの記録に合わせています（2026-10-09）。

## 既知の課題

- （なし）`test.html` の SDK パスは PR #40 で修正済み。

## 関連example

- (関連 example なし — [`docs/examples-catalog.md`](https://github.com/Orphe-OSS/ORPHE-CORE.js/blob/main/docs/examples-catalog.md) の Overlap Families を参照)

## 元データ

このREADMEは `examples/catalog.json` の `game-pingpong` エントリから自動生成された最小スケルトンを元に加筆したものです。
