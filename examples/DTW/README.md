# DTW Time Series Match

> **Status**: `public-candidate` — see [`docs/examples-catalog.md`](../../docs/examples-catalog.md) for the full audit.

ORPHE COREの動きから時系列データを取り、Dynamic Time Warping (DTW) で図形パターンとの近さを比較する技術Exampleです。マウス操作でも入力波形を作れるため、実機接続前にDTWの挙動を確認できます。

## このexampleで学べること

- 時系列データを一定長のバッファとして扱う方法
- DTWで三角形・円・四角形のような動きのパターンを比較する方法
- CoreToolkit UIからORPHE COREに接続し、センサーデータを解析に使う構成

## 使うデータ

- センサー値
- マウス入力による代替時系列データ

`index.html` ではCoreToolkitから `STEP_ANALYSIS_AND_SENSOR_VALUES` で通知を開始します。

## 必要なORPHE CORE数

- 1 台

## 起動方法

1. ローカルサーバを起動します。
2. ブラウザで `examples/DTW/` を開きます。
3. 画面上部のCoreToolkit UIからORPHE COREへ接続します。
4. 画面内で動きを作り、DTWの判定結果を確認します。

GitHub Pagesでも試せます。

<https://orphe-oss.github.io/ORPHE-CORE.js/examples/DTW/>

## 実機確認

- **未実機確認** — 静的検証のみ。BLE接続後のセンサーデータ入力はオーナーレビュー待ちです。
- 1台接続、センサー入力、マウス入力、三角形・円・四角形の判定を確認してください。
