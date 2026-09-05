# ORPHE CORE 2D Action Game

> **Status**: `public-candidate` — see [`docs/examples-catalog.md`](https://github.com/Orphe-OSS/ORPHE-CORE.js/blob/main/docs/examples-catalog.md) for the full audit.

1台のORPHE COREを足に装着して、前傾・後傾・振動でキャラクターを操作する2Dアクションゲームです。ゲームとして遊びながら、足の姿勢と動きの変化を入力に使う方法を確認できます。

## このexampleで学べること

- オイラー角と加速度をゲーム入力に変換する基本パターン
- しきい値を画面上のスライダーで調整しながら動きを確認する方法
- 1台のセンサー値でゲーム入力を作る最小構成

## 使うデータ

- オイラー角
- 加速度

ゲーム操作はセンサー値だけで成立します。`index.html` ではCoreToolkitから `SENSOR_VALUES` で通知を開始し、オイラー角と加速度を参照します。

## 必要なORPHE CORE数

- 1 台

## 起動方法

1. ローカルサーバを起動します。
2. ブラウザで `examples/GAME-MARIO/` を開きます。
3. 画面上部のCoreToolkit UIからORPHE COREへ接続します。
4. 接続が完了したら、画面下部のゲーム領域で操作を確認します。

GitHub Pagesでも試せます。

<https://orphe-oss.github.io/ORPHE-CORE.js/examples/GAME-MARIO/>

## 操作の考え方

- 前傾しながら足を動かす: 前進
- 後傾しながら足を動かす: ジャンプ
- 大きく後傾する: 後退
- 画面上のスライダー: 前進・ジャンプ・後退のしきい値や音量を調整

実際の反応は装着位置や動き方に影響されるため、展示やワークショップで使う場合は事前に実機でしきい値を調整してください。

## 実機確認

- **未実機確認** — 静的検証のみ。BLE接続後の挙動はオーナーレビュー待ちです。
- 1台接続、前進、ジャンプ、後退、スライダー調整、BGM/SFXの確認が必要です。

## 実装メモ

- `index.html` はCoreToolkitを使う現在の公開候補です。
- このexampleは1台接続に整理しています。2台対応に戻す場合は、接続完了判定と入力値の集約方法を再設計してください。
- `test.html` は簡易接続テスト用で、ゲーム本体ではありません。
- `scripts.js` には古い通知タイプ表記が残っています。`index.html` から使われているかを確認したうえで、別PRで整理するのが安全です。

## 関連example

- [`examples/GAME-BOXING/`](../GAME-BOXING/README.md) — Boxing Game
