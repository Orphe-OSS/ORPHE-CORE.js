# Fireball Action

> **Status**: `public-candidate` — see [`docs/examples-catalog.md`](../../docs/examples-catalog.md) for the full audit.

足踏み、キック、ジャンプの動きを使って操作する2Dアクションゲームです。

## このexampleで学べること

- 足踏み、キック、ジャンプの動きをゲーム入力に変換する方法
- Gait Analysisと加速度を組み合わせてアクションを作る方法
- 1台のORPHE COREで複数の操作を割り当てる考え方

## 使うデータ

- 加速度 (gotConvertedAcc, 実Gスケール)
- 歩行 (gait)
- 接地衝撃 (landingImpact)

## 必要なORPHE CORE数

- 1 台

## 起動方法

1. ローカルサーバを起動します。
2. ブラウザで `examples/GAME-FIREBALL-MARIO/` を開きます。
3. 画面上部のCoreToolkit UIからORPHE COREへ接続します。
4. 接続後、足踏み、キック、ジャンプ操作を確認します。

## 実機確認

- **未実機確認** — 静的検証 (パス・参照) のみ。BLE 接続後の挙動はオーナーレビュー待ち。
- 接続、足踏み、キック、ジャンプ、ゲームのリスタートを確認してください。

## 関連example

- [`examples/GAME-PK/`](../GAME-PK/README.md) — Penalty Kick Game

## 元データ

ディレクトリ名は互換性維持のため `GAME-FIREBALL-MARIO` のままですが、公開表示名は `Fireball Action` に整理しています。
