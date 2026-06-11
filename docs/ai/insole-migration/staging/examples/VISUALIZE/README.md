# VISUALIZE — ORPHE INSOLE

ORPHE CORE.js の `examples/VISUALIZE` を INSOLE 向けに移植したサンプルです。
2台までのインソールの圧力(6ch)・加速度・ジャイロ・クォータニオン・オイラー角を
Chart.js でリアルタイム表示します。

## 使い方

1. Chrome / Edge でこのディレクトリの `index.html` を開く（要 HTTPS または localhost）
2. トグルスイッチを ON にして INSOLE デバイス（INS で始まる名前）を選択
3. ストリーミングモードは歯車アイコンから変更可能（デフォルト: mode 4 = 100Hz 全データ）

## CORE 版との違い

| 項目 | CORE 版 | INSOLE 版 |
|---|---|---|
| 接続UI | 独自トグル | InsoleToolkit（自動再接続つき） |
| チャート | acc/gyro/quat/euler | **press(6ch)** + acc/gyro/quat/euler |
| 描画更新 | コールバック毎に update() | requestAnimationFrame で約30fpsにスロットリング |

100Hz×複数チャートの `chart.update()` 連打はタブ全体を固まらせるため、
受信データはバッファに溜めて描画ループでまとめて反映しています。
INSOLE 向けサンプルを新規に書く場合も同じパターンを推奨します。
