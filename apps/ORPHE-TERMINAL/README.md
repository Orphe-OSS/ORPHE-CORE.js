# ORPHE TERMINAL

ORPHE COREのDevice Information、Date Time、Sensor Values / Step Analysis通知を確認するためのWebターミナルです。アプリ開発中のデバッグ、フィールド計測前の接続確認、取得データのCSV保存に使います。

> **Status**: `public-candidate` — 初学者向けのexampleではなく、開発者・研究者・メンテナー向けの確認ツールです。

## このツールでできること

- CoreToolkitでORPHE COREへ接続する
- Device Information characteristicへHexコマンドを送信し、応答を確認する
- Date Time characteristicへHexコマンドを送信し、応答を確認する
- Sensor Values / Step Analysis通知の生データを確認する
- 受信ログをCSVとして保存する
- lost dataの発生を確認する

## 必要なORPHE CORE数

- 1 台

## 起動方法

1. ローカルサーバを起動します。
2. ブラウザで `apps/ORPHE-TERMINAL/` を開きます。
3. 画面上部のCoreToolkit UIからORPHE COREへ接続します。
4. 必要に応じてHexコマンドを入力し、`Send` または `Read` を押します。

GitHub Pagesでも開けます。

<https://orphe-oss.github.io/ORPHE-CORE.js/apps/ORPHE-TERMINAL/>

## 使うデータ

- Device Information
- Date Time
- Sensor Values
- Step Analysis

`index.js` ではCoreToolkitを使い、`SENSOR_VALUES` で通知を開始します。

## 実機確認

- **未実機確認** — 静的検証のみ。BLE接続後の挙動はオーナーレビュー待ちです。
- 接続、Device Informationのread/write、Date Timeのread/write、Sensor Values表示、CSV download、pause/play、lost data表示を確認してください。

## 実装メモ

- このツールは一般的なデモではなく、低レイヤー確認用の補助アプリです。
- LPに目立つ形で載せるより、Examples一覧や開発者向けドキュメントから参照するのが適しています。
- Hexコマンドを直接送るため、ワークショップ初学者向けには `INFORMATION` や `LIGHT` の方が安全です。
