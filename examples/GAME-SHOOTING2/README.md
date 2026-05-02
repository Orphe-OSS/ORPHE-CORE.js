# ORPHE CORE 3D Shooting Game

> **Status**: `public-candidate` — see [`docs/examples-catalog.md`](../../docs/examples-catalog.md) for the full audit.

ORPHE COREの傾きで移動し、足の動きでショットを撃つ3Dシューティングゲームです。キーボード操作にも対応しているため、実機接続前に画面やゲーム進行を確認できます。

## このexampleで学べること

- CoreToolkitを使って1台のORPHE COREを接続する構成
- オイラー角をプレイヤーの移動に使う考え方
- 加速度の変化をショット操作に使う考え方
- Three.jsを使った3DゲームにORPHE CORE入力を組み込む方法

## 使うデータ

- オイラー角
- 加速度

`index.html` では `SENSOR_VALUES` で通知を開始します。

## 必要なORPHE CORE数

- 1 台

## 起動方法

1. ローカルサーバを起動します。
2. ブラウザで `examples/GAME-SHOOTING2/` を開きます。
3. 画面右上のCoreToolkit UIからORPHE COREへ接続します。
4. 接続前はキーボードでも操作を確認できます。

GitHub Pagesでも試せます。

<https://orphe-oss.github.io/ORPHE-CORE.js/examples/GAME-SHOOTING2/>

## 操作の考え方

- ORPHE CORE: 傾きで移動、強い動きでショット
- キーボード: 矢印キーで移動、スペースキーでショット
- `C` キー: 現在のORPHE COREの角度をニュートラルとして再設定
- `S` キーまたはSETTINGSボタン: 設定パネル表示
- `B` キー: bot mode切り替え
- `RESTART` ボタン: BLE接続を維持したままゲームを再開

## 実機確認

- **未実機確認** — 静的検証のみ。BLE接続後の挙動はオーナーレビュー待ちです。
- 1台接続、傾き移動、ショット判定、設定パネル、BGM/SFXの確認が必要です。

## 実装メモ

- 現在の `index.html` は1台のORPHE COREをCoreToolkitで接続します。
- `GAME-SHOOTING` との役割分担はまだ整理中です。LPへ追加する前に、2つの違いを説明できる状態にするのが安全です。

## 関連example

- [`examples/GAME-PK/`](../GAME-PK/README.md) — Penalty Kick Game
- [`examples/GAME-SHOOTING/`](../GAME-SHOOTING/README.md) — Shooting Game
