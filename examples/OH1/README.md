# OH1 Heart Rate

> **Status**: `public` — see [`docs/examples-catalog.md`](https://github.com/Orphe-OSS/ORPHE-CORE.js/blob/main/docs/examples-catalog.md) for the full audit.

Polar OH1などのBLE心拍センサーとORPHE COREを同じ画面で扱う統合exampleです。心拍数と足のモーションデータを並べて確認したい研究・実験用途に向いています。

## このexampleで学べること

- ORPHE CORE以外のBLEデバイスを同じWebアプリに組み込む方法
- 心拍数と足のセンサーデータを同じUIで表示する構成
- CoreToolkitを使ってORPHE COREの接続UIを用意する方法
- 外部BLE連携を含むexampleを、ORPHE CORE単体exampleと分けて考える理由

## 使うデータ

- 心拍数
- 加速度 (acc, 正規化)
- クォータニオン (quat)
- ストライド (stride)

## 必要なORPHE CORE数

- 1-2 台

現在の画面には `CORE01` と `CORE02` の2枠があります。最低1台でも確認できますが、2台接続の実験にも使える構成です。別途、BLE心拍センサーが必要です。

## 起動方法

1. ローカルサーバを起動します。
2. ブラウザで `examples/OH1/` を開きます。
3. `OH1 Connect` から心拍センサーへ接続します。
4. `CORE01` / `CORE02` のCoreToolkit UIからORPHE COREへ接続します。

GitHub Pagesでも試せます。

<https://orphe-oss.github.io/ORPHE-CORE.js/examples/OH1/>

## 実機確認

- **未実機確認** — 静的検証のみ。BLE接続後の挙動はオーナーレビュー待ちです。
- 心拍センサー接続、1台/2台のORPHE CORE接続、心拍数表示、acc/quat/stride表示を確認してください。

## 実装メモ

- ORPHE CORE単体のexampleではありません。外部BLEデバイスが必要です。
- OH1側は `bluejelly.js`、ORPHE CORE側はCoreToolkitを使っています。
- CoreToolkit化の見本というより、外部BLE連携の見本として扱うのが安全です。

## 関連example

- (関連 example なし — [`docs/examples-catalog.md`](https://github.com/Orphe-OSS/ORPHE-CORE.js/blob/main/docs/examples-catalog.md) の Overlap Families を参照)
