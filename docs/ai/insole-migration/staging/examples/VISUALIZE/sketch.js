/**
 * ORPHE INSOLE — VISUALIZE
 *
 * 2台までのインソールの 圧力(6ch)・加速度・ジャイロ・クォータニオン・オイラー角を
 * Chart.js でリアルタイム表示するサンプル。
 *
 * CORE 版 examples/VISUALIZE からの主な変更点:
 *  - 接続UIを InsoleToolkit に変更（自動再接続つき）
 *  - 圧力6chチャートを追加
 *  - 100Hz/200Hz のデータレートに耐えるよう、チャート更新を
 *    requestAnimationFrame でスロットリング（描画は最大30fps、データは全サンプル保持）
 */

const HISTORY = 100;          // チャートに表示するサンプル数
const RENDER_INTERVAL_MS = 33; // 描画間隔（約30fps）

const SERIES_COLORS = [
    'rgb(69, 230, 230)',
    'rgb(255, 96, 64)',
    'rgb(255, 255, 255)',
    'rgb(127, 127, 127)',
    'rgb(255, 205, 86)',
    'rgb(153, 102, 255)',
];

/**
 * 折れ線チャートを生成するファクトリ
 */
function makeLineChart(canvasId, title, seriesLabels, yMin, yMax) {
    const datasets = seriesLabels.map((label, i) => ({
        label,
        backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
        borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
        pointRadius: 0,
        borderWidth: 1.5,
        data: [],
    }));
    const scales = {};
    if (typeof yMin === 'number' && typeof yMax === 'number') {
        scales.y = { min: yMin, max: yMax };
    }
    return new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: { labels: [], datasets },
        options: {
            animation: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12 } },
                title: { display: true, text: title },
            },
            scales,
        },
    });
}

/**
 * 1チャート分の受信バッファ。コールバック（100Hz〜）で push し、
 * 描画ループ（30fps）でまとめて Chart.js に流し込む。
 */
class ChartFeed {
    constructor(chart) {
        this.chart = chart;
        this.pending = [];
        this.count = 0;
    }
    push(values) {
        this.pending.push(values);
    }
    flush() {
        if (this.pending.length === 0) return false;
        const data = this.chart.data;
        for (const values of this.pending) {
            data.labels.push(this.count++);
            values.forEach((v, i) => data.datasets[i].data.push(v));
        }
        this.pending.length = 0;
        while (data.labels.length > HISTORY) {
            data.labels.shift();
            data.datasets.forEach(ds => ds.data.shift());
        }
        return true;
    }
}

const feeds = []; // feeds[id] = {press, acc, gyro, quat, euler}

window.onload = function () {
    for (let id = 0; id < 2; id++) {
        buildInsoleToolkit(
            document.getElementById(`toolkit${id}`),
            `INSOLE ${id === 0 ? '01' : '02'}`,
            id,
            { streamingMode: 4, autoReconnect: true }
        );

        feeds[id] = {
            press: new ChartFeed(makeLineChart(`chart${id}_press`, 'Pressure (6ch raw)',
                ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'])),
            acc: new ChartFeed(makeLineChart(`chart${id}_acc`, 'Accelerometer (normalized)',
                ['x', 'y', 'z'], -1, 1)),
            gyro: new ChartFeed(makeLineChart(`chart${id}_gyro`, 'Gyro (normalized)',
                ['x', 'y', 'z'], -1, 1)),
            quat: new ChartFeed(makeLineChart(`chart${id}_quat`, 'Quaternion',
                ['w', 'x', 'y', 'z'], -1.2, 1.2)),
            euler: new ChartFeed(makeLineChart(`chart${id}_euler`, 'Euler [rad]',
                ['pitch', 'roll', 'yaw'], -3.2, 3.2)),
        };

        const insole = insoles[id];
        insole.setup();

        insole.gotPress = function (press) {
            feeds[this.id].press.push(press.values);
        };
        insole.gotAcc = function (acc) {
            feeds[this.id].acc.push([acc.x, acc.y, acc.z]);
        };
        insole.gotGyro = function (gyro) {
            feeds[this.id].gyro.push([gyro.x, gyro.y, gyro.z]);
        };
        insole.gotQuat = function (quat) {
            feeds[this.id].quat.push([quat.w, quat.x, quat.y, quat.z]);
        };
        insole.gotEuler = function (euler) {
            feeds[this.id].euler.push([euler.pitch, euler.roll, euler.yaw]);
        };
        insole.lostData = function (serial_number, serial_number_prev) {
            console.warn(`INSOLE${this.id}: lost packets ${serial_number_prev} -> ${serial_number}`);
        };
    }

    // 描画ループ: pending データがあるチャートだけ update する
    let lastRender = 0;
    function renderLoop(now) {
        if (now - lastRender >= RENDER_INTERVAL_MS) {
            lastRender = now;
            for (const feed of feeds) {
                for (const key of Object.keys(feed)) {
                    if (feed[key].flush()) feed[key].chart.update();
                }
            }
        }
        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
};
