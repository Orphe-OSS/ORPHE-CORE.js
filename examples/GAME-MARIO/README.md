# ORPHE CORE 2D Action Game

> **Status**: `public-candidate` — see [`docs/examples-catalog.md`](../../docs/examples-catalog.md) for the full audit.

2台のORPHE COREを足に装着して、前傾・後傾・振動でキャラクターを操作する2Dアクションゲームです。ゲームとして遊びながら、足の姿勢と動きの変化を入力に使う方法を確認できます。

## このexampleで学べること

- 2台のORPHE COREを同時に接続する構成
- オイラー角と加速度をゲーム入力に変換する基本パターン
- しきい値を画面上のスライダーで調整しながら動きを確認する方法
- 2台のセンサー値を平均して、1つのゲーム操作にまとめる考え方

## 使うデータ

- オイラー角
- 加速度

現在のゲーム操作はセンサー値だけで成立しています。`index.html` ではCoreToolkitから `STEP_ANALYSIS_AND_SENSOR_VALUES` で通知を開始していますが、ゲーム入力として参照しているのは主にオイラー角と加速度です。

## 必要なORPHE CORE数

- 2 台

入力処理自体は有効なデバイス数で平均を取るため1台対応もできそうですが、現在の接続開始フローは2台接続完了を前提にしています。1台対応にする場合は、別PRで接続完了判定とUIを整理してください。

## 起動方法

1. ローカルサーバを起動します。
2. ブラウザで `examples/GAME-MARIO/` を開きます。
3. 画面上部の2つのCoreToolkit UIから、それぞれORPHE COREへ接続します。
4. 両方の接続が完了したら、画面下部のゲーム領域で操作を確認します。

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
- 2台接続、前進、ジャンプ、後退、スライダー調整、BGM/SFXの確認が必要です。

## 実装メモ

- `index.html` はCoreToolkitを使う現在の公開候補です。
- `test.html` は簡易接続テスト用で、ゲーム本体ではありません。
- `scripts.js` には古い通知タイプ表記が残っています。`index.html` から使われているかを確認したうえで、別PRで整理するのが安全です。

## 関連example

- [`examples/GAME-BOXING/`](../GAME-BOXING/README.md) — Boxing Game
