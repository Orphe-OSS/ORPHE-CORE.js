# ORPHE-CORE.js Landing Page / DX Improvement Plan

Last updated: 2026-04-30

このドキュメントは、ORPHE-CORE.js のランディングページ改善とデベロッパー体験改善を、人間とAIが同じ前提で進めるための作業方針です。

## Decision

短期実装は、現ページに対する具体的な改善提案をベースに進める。

- まずは「初回ユーザーが価値を理解し、迷わず最初の接続に到達できること」を優先する。
- 大規模なデザイン刷新、3Dヒーロー、A/Bテスト、静的サイトジェネレーター移行は中長期の理想像として扱う。
- 既存ページの技術情報はすぐに削除せず、まず冒頭導線と事実関係を直してから段階的に整理する。

## Why

現ページには、CDN導入、Web Bluetooth接続、CoreToolkit.js、Examples、Starter Templates、Electron など価値ある情報が多い。一方で、ページ全体はワークショップ資料やREADMEに近く、初回ユーザーが最初に知りたい以下の情報が冒頭で整理されていない。

- ORPHE CORE.js で何ができるのか
- ORPHE CORE がどのようなハードウェアなのか
- どのブラウザで動くのか
- 何を作りたい人がどのExampleを見るべきか
- 最初にコピーすべきコードはどれか

そのため、初手では「情報を増やす」よりも「導線を明確にする」「壊れたリンクや古い表記を直す」ことを優先する。

## Short-Term Scope

短期実装では、次を優先する。

1. 事実と導線の修正
   - 壊れている `git clone` URL を修正する。
   - 実コード、APIドキュメント、ページ内説明、AI向け資料でバージョン表記のズレを確認し、正しい表記に寄せる。
   - 古い通知タイプ名 `ANALYSIS` / `RAW` が残っている箇所は、現行API名 `STEP_ANALYSIS` / `SENSOR_VALUES` に置き換える。
   - `ORPHE CORE.js`, `ORPHE CORE`, `CoreToolkit.js` の表記をできる範囲で統一する。

2. ファーストビュー改善
   - ORPHE CORE.js の価値を1文で示す。
   - ORPHE CORE が足元に装着するモーションセンサーであることを短く説明する。
   - `Start in 3 minutes`, `View Examples`, `API Reference` など、最初の行動を明確化する。

3. 目的別導線
   - Creative coding
   - App prototyping
   - Research / engineering
   - Desktop apps with Electron

4. 互換性情報の整理
   - Web Bluetooth API が必要であることを明示する。
   - Chrome / Edge / Android Chrome を主対象として扱う。
   - Safari / Firefox では通常動作しないことを注意として示す。
   - iOS は Bluefy などWeb BLE対応ブラウザが必要であることを補足する。

## Mid-Term Scope

短期修正後に、Deep Research の結果も踏まえて次を検討する。

- Examples をカード型ギャラリーに再編する。
- Tutorial / How-to / Reference / Examples を分離する。
- CoreToolkit.js を独立した導入経路として見せる。
- センサー値と歩容解析値の取得データを、用途別に見える化する。
- p5.js Web Editor やCodePenなど、ローカル環境なしで試せる導線を強化する。
- 英日併記を、言語切替または `/ja/` `/en/` 構成へ分離する。

## Long-Term Vision

長期的には、ORPHE-CORE.js のトップページを単なるドキュメントではなく、開発者ポータルに近づける。

- インタラクティブなセンサーデモ、または軽量な可視化ヒーローを検証する。
- ORPHE のスマートフットウェア技術基盤としての信頼シグナルを整理する。
- GitHub Issues、Examples、API Reference、製品購入導線を接続する。
- アクセス解析やコピー計測を導入し、実際の行動データに基づいて改善する。

## Content Architecture Principle

Diataxis に近い考え方で、情報の役割を混ぜすぎない。

- Landing page: 価値理解と最初の行動
- Tutorial: 初学者が順番に学ぶ教材
- How-to: 目的別の実装手順
- Reference: APIやデータ構造の詳細
- Examples: 作れるものから逆引きする入口

トップページはすべてを説明する場所ではなく、ユーザーを正しい次のページへ送る入口として設計する。

## Implementation Rule

- 既存の技術情報を壊さない。
- 初回導入に関係する修正を優先する。
- 事実確認が必要な実績や数値は、公式ソースまたはリポジトリ内の実コードを確認してから掲載する。
- ORPHE INSOLE など他製品の受賞・実績は、ORPHE CORE.js そのものの実績として誤認されないよう慎重に扱う。
- 大きな構造変更は、短期修正の効果を確認してから行う。

