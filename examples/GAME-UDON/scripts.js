var bles = [new Orphe(0), new Orphe(1)];

bles[0].setup();
buildCoreToolkit(document.querySelector('#toolkit_placeholder1'), '01', 0, 'SENSOR_VALUES');
bles[1].setup();
buildCoreToolkit(document.querySelector('#toolkit_placeholder2'), '02', 1, 'SENSOR_VALUES');
guardCoreToolkitBluetooth({
    coreIds: [0, 1],
    messageElement: '#ble-support-message'
});

// ---------------------------------------------------------------------------
// ここまでが CORE の接続（従来のまま）。ここから下は、届いたセンサー値をゲームへ渡す橋渡しです。
//
// 従来は gotAcc（正規化値）の「連続 2 サンプルの差」が 0.06 を超えたら 1 ふみ、という衝撃ベースの判定で、
// かなり強く踏まないと反応しませんでした。いまは gotConvertedAcc（G 単位）をそのまま
// step-detector.js に流し、感度（しきい値）を画面から選べるようにしています。
//
// 注意: onConnect は「CORE 1 台につき 1 回」ではなく GATT characteristic ごとに呼ばれます。
// 回数を数えて「2 台つながった」と判断すると 1 台で条件を満たしてしまうので、
// 接続状態は「その足のデータが実際に届いているか」で判断しています（game.js の liveFeet()）。
// ---------------------------------------------------------------------------
bles.forEach(function (ble, index) {
    ble.gotConvertedAcc = function (acc) {
        // device_information が読めていない等で G 換算できないときは、正規化値を ±16G とみなして渡す
        if (acc && isFinite(acc.x) && isFinite(acc.y) && isFinite(acc.z)) {
            UdonGame.pushAcc(index, acc);
        } else if (this.acc) {
            UdonGame.pushAcc(index, {
                x: this.acc.x * 16, y: this.acc.y * 16, z: this.acc.z * 16, timestamp: this.acc.timestamp
            });
        }
    };
    // ジャイロは、生データのきろく（画面上の ● ボタン）にだけ使います。ふみの判定には使いません
    ble.gotConvertedGyro = function (gyro) {
        UdonGame.pushGyro(index, gyro);
    };
    ble.onConnect = function () {
        UdonGame.coreEvent(index, 'connect');
    };
    ble.onDisconnect = function () {
        UdonGame.coreEvent(index, 'disconnect');
    };
});
