# ORPHE CORE JS
Happy hacking for ORPHE CORE module on javascript.

Please go to [the github page](https://orphe-oss.github.io/ORPHE-CORE.js/) for document and Demos.
ドキュメントとデモは[githubページ](https://orphe-oss.github.io/ORPHE-CORE.js/)をご覧ください。

Please go to [the github page](https://orphe-oss.github.io/ORPHE-CORE.js/tutorial/) for tutorial.
チュートリアルは[githubページ](https://orphe-oss.github.io/ORPHE-CORE.js/tutorial/)をご覧ください。

## Use ORPHE-CORE.js in your app

You do not need to clone this whole repository just to use ORPHE-CORE.js.
For most web prototypes, start from the CDN snippet below.

ORPHE-CORE.jsを使うだけなら、このリポジトリ全体をcloneする必要はありません。
多くのWebプロトタイプでは、まず以下のCDN読み込みから始めるのが簡単です。

### Use via CDN

This is the shortest path for trying ORPHE CORE from a browser.

ブラウザからORPHE COREを試す最短の導入方法です。

```html
<button onclick="connectOrphe()">Connect ORPHE</button>

<script src="https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js/js/ORPHE-CORE.js"></script>
<script>
  const core = new Orphe(0);

  window.onload = function () {
    core.setup();
  };

  async function connectOrphe() {
    await core.begin('STEP_ANALYSIS_AND_SENSOR_VALUES');
    core.setLED(1, 0);
  }
</script>
```

### Download minimal files

If you want to keep the library files inside your own project, copy only the files you need from `js/`.

自分のプロジェクト内にライブラリファイルを置きたい場合は、`js/` から必要なファイルだけをコピーしてください。

| Use case | Files |
| --- | --- |
| Basic ORPHE CORE connection | `js/ORPHE-CORE.js` |
| Use CoreToolkit connection UI | `js/ORPHE-CORE.js`, `js/CoreToolkit.js`, `js/BleSharedBridge.js` |
| Fully offline use | Add `js/float16.min.js` and `js/quaternion.js` as well |

`ORPHE-CORE.js` can load `float16.min.js` and `quaternion.js` from the CDN when they are not already present.
If your app must work without internet access, include those two dependency files locally too.

`ORPHE-CORE.js` は、`float16.min.js` と `quaternion.js` が未読み込みの場合にCDNから自動で読み込みます。
インターネット接続なしで動かしたい場合は、この2つの依存ファイルもローカルに置いてください。

## Usage policy and commercial use

ORPHE-CORE.js is developed as a JavaScript library for people using ORPHE CORE.

For ORPHE-CORE.js v1.4.0 and later, the library is free to use, modify, and study for:

* education and workshops
* academic and non-commercial research
* personal creative projects
* prototypes and internal experiments
* free apps and non-commercial services built with ORPHE CORE

If you use ORPHE-CORE.js to build a paid app, paid service, commercial SDK integration, commissioned product, or business service, please contact ORPHE for a separate commercial agreement.

This usage policy applies to ORPHE-CORE.js v1.4.0 and later. Previously released versions up to v1.3.x remain available under the terms that applied at the time of their release.

## 利用方針と商用利用について

ORPHE-CORE.js は、ORPHE COREを使う人のためのJavaScriptライブラリです。

ORPHE-CORE.js v1.4.0以降では、以下の用途について、改変を含めて無償で利用できます。

* 教育・ワークショップ
* 大学・研究機関などでの非商用研究
* 個人制作
* 試作・社内検証
* ORPHE COREを使った無償アプリ・非商用サービス

ORPHE-CORE.jsを使って、有料アプリ、有料サービス、商用SDK連携、受託開発、事業として提供するサービスを作る場合は、別途ORPHEとの商用契約が必要です。

この利用方針は、ORPHE-CORE.js v1.4.0以降に適用されます。v1.3.xまでの既存公開済みバージョンは、その公開時点で適用されていた条件に従って利用できます。

## Version
機能追加でマイナーバージョンアップを行います。バグフィックスやリファクタリングはパッチバージョンアップとします。

* v1.4.0: Current version（2026/08/30）。詳細は [CHANGELOG.md](./CHANGELOG.md)。
  * `gotConvertedGyro` / `converted_gyro` の deg/s 換算を、理想フルスケール（raw/32768×range）から LSM6DSOX データシートのレンジ別代表感度（±250/500/1000/2000 dps → 8.75/17.5/35/70 mdps/LSB）に修正しました。±2000 dps では従来より約12.8%大きい値になります（ORPHE-INSOLE.js v1.3.2 と同じ修正）。正規化値（`gotGyro`）と加速度の換算は変更ありません。
  * 上記の利用方針（v1.4.0以降）が適用される最初のバージョンです。
* v1.3.4: `js/ORPHE-CORE.js` のJSDoc `@version` に合わせたバージョン（2026/01/31）。
* v1.3: Date Timeキャラクタリスティック対応
  * COREモジュールの時刻を取得，設定する setDateTime(), getDateTime() を追加しました。この機能を利用して，begin()メソッドを利用した際に必ず最初にコアモジュールの時刻合わせが実行されます．PCの現在時刻にgetDateTime()にかかった時間の1/2を加算して，コアモジュールに時刻設定します．ただしgetDataTime()は3回取得し，その取得時間平均値/2としています．
* [v1.2](https://github.com/Orphe-OSS/ORPHE-CORE.js/tree/v1.2): ES6 class based version.
  * プロトタイプだけでなく、プロダクトとして利用されることが多くなったため、本格的なリファクタリングを行いました。ES6のクラスベースの構造に変更し、より理解しやすく読みやすいコードになりました。v1.1互換なので、従来どおりの記述でコアモジュールにアクセスできます。
* [v1.1](https://github.com/Orphe-OSS/ORPHE-CORE.js/tree/v1.1): bug fixes, last update 29th/May/2024
  * 最初のリリースからシステムの安定性、バグフックス、最低限必要な機能追加などを継続してきました。いくつかのアプリケーション等でも利用されるようになりました。生データを取得可能な gotData() が利用可能となりました。"RAW", "ANALYSIS"としていたコア内での名称をCharacteristicsと同じ"SENSOR_VALUES"、"STEP_ANALYSIS"に統一しました。
* v1.0: First release on 13rd/Sep/2022
  * 最初のリリース（https://orphe.io/news/orphe-releases-orphe-core-javascript-library）このversionではブランチを切っていません。

# 開発者向け情報

## ブランチ
開発用は dev ブランチを利用します。

## 環境構築
Node.jsのインストール後、以下のコマンドを実行して環境を構築してください。
```bash
npm install
```

### jsdocのドキュメント生成
ORPHE-CORE.jsのAPIドキュメントを生成するには、以下のコマンドを実行してください。ORPHE-CORE.jsファイルを直接jsdoc方式でコメントインして、以下のコマンドを実行するとapi_docにドキュメントが生成されます。jsdocの設定は、`jsdoc.json`に記述されています。
```
npm run generate-docs
```

## Requirements
 * float16.js, https://github.com/petamoriken/float16
 * quaternion.js, https://github.com/infusion/Quaternion.js


## Acknowledgments
[API Document page](https://orphe-oss.github.io/ORPHE-CORE.js/api_doc/) is generated by jsdoc and [clearn jsdoc theme](https://www.npmjs.com/package/clean-jsdoc-theme).

## Copyright and licensing
 * Copyright (C) 2022-2024, Tetsuaki BABA and ORPHE.inc.
 * See the usage policy above for ORPHE-CORE.js v1.4.0 and later. Previously released versions up to v1.3.x remain available under the terms that applied at the time of their release.
