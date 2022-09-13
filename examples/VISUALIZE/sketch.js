
function windowResized() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16;
    resizeCanvas(canvas_width, canvas_height);
}

var chart = [];
const data = [
    {
        acc: {
            labels: [],
            // Acc
            datasets: [
                {
                    label: "c",
                    backgroundColor: "rgb(69,230, 230)",
                    borderColor: "rgb(69,230,230)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "y",
                    backgroundColor: "rgb(255, 96, 64)",
                    borderColor: "rgb(255, 96, 64)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "z",
                    backgroundColor: "rgb(255,255,255)",
                    borderColor: "rgb(255,255,255)",
                    pointRadius: 1.0,
                    data: [],
                }
            ],
        },
        gyro: {
            labels: [],
            // gyro
            datasets: [
                {
                    label: "c",
                    backgroundColor: "rgb(69,230, 230)",
                    borderColor: "rgb(69,230,230)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "y",
                    backgroundColor: "rgb(255, 96, 64)",
                    borderColor: "rgb(255, 96, 64)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "z",
                    backgroundColor: "rgb(255,255,255)",
                    borderColor: "rgb(255,255,255)",
                    pointRadius: 1.0,
                    data: [],
                }
            ],
        },
        quat: {
            labels: [],
            // Quaternion
            datasets: [
                {
                    label: "W",
                    backgroundColor: "rgb(127, 127, 127)",
                    borderColor: "rgb(127, 127, 127)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "X",
                    backgroundColor: "rgb(69,230, 230)",
                    borderColor: "rgb(69,230,230)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "Y",
                    backgroundColor: "rgb(255, 96, 64)",
                    borderColor: "rgb(255, 96, 64)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "Z",
                    backgroundColor: "rgb(255,255,255)",
                    borderColor: "rgb(255,255,255)",
                    pointRadius: 1.0,
                    data: [],
                }
            ],
        },
        euler: {
            labels: [],
            // Euler
            datasets: [
                {
                    label: "Pitch",
                    backgroundColor: "rgb(69,230, 230)",
                    borderColor: "rgb(69,230,230)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "Roll",
                    backgroundColor: "rgb(255, 96, 64)",
                    borderColor: "rgb(255, 96, 64)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "Yaw",
                    backgroundColor: "rgb(255,255,255)",
                    borderColor: "rgb(255,255,255)",
                    pointRadius: 1.0,
                    data: [],
                }
            ],
        }
    },
    {
        acc: {
            labels: [],
            // Acc
            datasets: [
                {
                    label: "c",
                    backgroundColor: "rgb(69,230, 230)",
                    borderColor: "rgb(69,230,230)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "y",
                    backgroundColor: "rgb(255, 96, 64)",
                    borderColor: "rgb(255, 96, 64)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "z",
                    backgroundColor: "rgb(255,255,255)",
                    borderColor: "rgb(255,255,255)",
                    pointRadius: 1.0,
                    data: [],
                }
            ],
        },
        gyro: {
            labels: [],
            // gyro
            datasets: [
                {
                    label: "c",
                    backgroundColor: "rgb(69,230, 230)",
                    borderColor: "rgb(69,230,230)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "y",
                    backgroundColor: "rgb(255, 96, 64)",
                    borderColor: "rgb(255, 96, 64)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "z",
                    backgroundColor: "rgb(255,255,255)",
                    borderColor: "rgb(255,255,255)",
                    pointRadius: 1.0,
                    data: [],
                }
            ],
        },
        quat: {
            labels: [],
            // Quaternion
            datasets: [
                {
                    label: "W",
                    backgroundColor: "rgb(127, 127, 127)",
                    borderColor: "rgb(127, 127, 127)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "X",
                    backgroundColor: "rgb(69,230, 230)",
                    borderColor: "rgb(69,230,230)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "Y",
                    backgroundColor: "rgb(255, 96, 64)",
                    borderColor: "rgb(255, 96, 64)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "Z",
                    backgroundColor: "rgb(255,255,255)",
                    borderColor: "rgb(255,255,255)",
                    pointRadius: 1.0,
                    data: [],
                }
            ],
        },
        euler: {
            labels: [],
            // Euler
            datasets: [
                {
                    label: "Pitch",
                    backgroundColor: "rgb(69,230, 230)",
                    borderColor: "rgb(69,230,230)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "Roll",
                    backgroundColor: "rgb(255, 96, 64)",
                    borderColor: "rgb(255, 96, 64)",
                    pointRadius: 1.0,
                    data: [],
                },
                {
                    label: "Yaw",
                    backgroundColor: "rgb(255,255,255)",
                    borderColor: "rgb(255,255,255)",
                    pointRadius: 1.0,
                    data: [],
                }
            ],
        }
    }
];


//--------------------------------------------------
//Global変数
//--------------------------------------------------
var bles = [new Orphe(0), new Orphe(1)];
var count = 0;
//--------------------------------------------------
//ロード時の処理
//--------------------------------------------------
window.onload = function () {
    chart = [
        {
            acc: new Chart(document.getElementById("chart01_acc"),
                {
                    type: "line",
                    data: data[0].acc,
                    options: {
                        animation: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Accelerometer'
                            }
                        },
                        scales: {
                            y: {
                                min: -2,
                                max: 2,
                            },
                        },
                    },
                }
            ),
            gyro: new Chart(document.getElementById("chart01_gyro"),
                {
                    type: "line",
                    data: data[0].gyro,
                    options: {
                        animation: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Gyro'
                            }
                        },
                        scales: {
                            y: {
                                min: -2,
                                max: 2,
                            },
                        },
                    },
                }
            ),
            quat: new Chart(document.getElementById("chart01_quat"),
                {
                    type: "line",
                    data: data[0].quat,
                    options: {
                        animation: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Quaternion'
                            }
                        },
                        scales: {
                            y: {
                                min: -2,
                                max: 2,
                            },
                        },
                    },
                }
            ),
            euler: new Chart(document.getElementById("chart01_euler"),
                {
                    type: "line",
                    data: data[0].euler,
                    options: {
                        animation: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Euler'
                            }
                        },
                        scales: {
                            y: {
                                min: -3.14,
                                max: 3.14,
                            },
                        },
                    },
                }
            ),
        },
        {
            acc: new Chart(document.getElementById("chart02_acc"),
                {
                    type: "line",
                    data: data[1].acc,
                    options: {
                        animation: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Accelerometer'
                            }
                        },
                        scales: {
                            y: {
                                min: -2,
                                max: 2,
                            },
                        },
                    },
                }
            ),
            gyro: new Chart(document.getElementById("chart02_gyro"),
                {
                    type: "line",
                    data: data[1].gyro,
                    options: {
                        animation: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Gyro'
                            }
                        },
                        scales: {
                            y: {
                                min: -2,
                                max: 2,
                            },
                        },
                    },
                }
            ),
            quat: new Chart(document.getElementById("chart02_quat"),
                {
                    type: "line",
                    data: data[1].quat,
                    options: {
                        animation: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Quaternion'
                            }
                        },
                        scales: {
                            y: {
                                min: -2,
                                max: 2,
                            },
                        },
                    },
                },
            ),
            euler: new Chart(document.getElementById("chart02_euler"),
                {
                    type: "line",
                    data: data[1].euler,
                    options: {
                        animation: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Euler'
                            }
                        },
                        scales: {
                            y: {
                                min: -3.14,
                                max: 3.14,
                            },
                        },
                    },
                }
            ),
        }
    ];



    for (ble of bles) {
        ble.setup();

        ble.onConnectGATT = function (uuid) {
            console.log('> connected GATT!');
        }

        ble.onScan = function (deviceName) {
        }

        ble.gotQuat = function (quat) {
            while (chart[this.id].quat.data.labels.length > 100) {
                chart[this.id].quat.data.labels.shift();
            }
            chart[this.id].quat.data.labels.push(count);

            while (chart[this.id].quat.data.datasets[0].data.length > 100) {
                chart[this.id].quat.data.datasets[0].data.shift();
                chart[this.id].quat.data.datasets[1].data.shift();
                chart[this.id].quat.data.datasets[2].data.shift();
                chart[this.id].quat.data.datasets[3].data.shift();
            }
            chart[this.id].quat.data.datasets[0].data.push(quat.w);
            chart[this.id].quat.data.datasets[1].data.push(quat.x);
            chart[this.id].quat.data.datasets[2].data.push(quat.y);
            chart[this.id].quat.data.datasets[3].data.push(quat.z);
            chart[this.id].quat.update();
            count++;
        }

        ble.gotDelta = function (delta) {
        }

        ble.gotGyro = function (gyro) {
            while (chart[this.id].gyro.data.labels.length > 100) {
                chart[this.id].gyro.data.labels.shift();
            }
            chart[this.id].gyro.data.labels.push(count);

            while (chart[this.id].gyro.data.datasets[0].data.length > 100) {
                chart[this.id].gyro.data.datasets[0].data.shift();
                chart[this.id].gyro.data.datasets[1].data.shift();
                chart[this.id].gyro.data.datasets[2].data.shift();
            }
            chart[this.id].gyro.data.datasets[0].data.push(gyro.x);
            chart[this.id].gyro.data.datasets[1].data.push(gyro.y);
            chart[this.id].gyro.data.datasets[2].data.push(gyro.z);
            chart[this.id].gyro.update();
        }

        ble.gotAcc = function (acc) {
            while (chart[this.id].acc.data.labels.length > 100) {
                chart[this.id].acc.data.labels.shift();
            }
            chart[this.id].acc.data.labels.push(count);

            while (chart[this.id].acc.data.datasets[0].data.length > 100) {
                chart[this.id].acc.data.datasets[0].data.shift();
                chart[this.id].acc.data.datasets[1].data.shift();
                chart[this.id].acc.data.datasets[2].data.shift();
            }
            chart[this.id].acc.data.datasets[0].data.push(acc.x);
            chart[this.id].acc.data.datasets[1].data.push(acc.y);
            chart[this.id].acc.data.datasets[2].data.push(acc.z);
            chart[this.id].acc.update();
        }

        ble.gotEuler = function (euler) {
            while (chart[this.id].euler.data.labels.length > 100) {
                chart[this.id].euler.data.labels.shift();
            }
            chart[this.id].euler.data.labels.push(count);

            while (chart[this.id].euler.data.datasets[0].data.length > 100) {
                chart[this.id].euler.data.datasets[0].data.shift();
                chart[this.id].euler.data.datasets[1].data.shift();
                chart[this.id].euler.data.datasets[2].data.shift();
            }
            chart[this.id].euler.data.datasets[0].data.push(euler.pitch);
            chart[this.id].euler.data.datasets[1].data.push(euler.roll);
            chart[this.id].euler.data.datasets[2].data.push(euler.yaw);
            chart[this.id].euler.update();
        }

        ble.gotGait = function (gait) {
        }
        ble.gotStride = function (stride) {
        }
        ble.gotFootAngle = function (foot_angle) {
        }
        ble.gotPronation = function (pronation) {
        }
        ble.gotLandingImpact = function (landing_impact) {
        }

        ble.onStartNotify = function (uuid) {
            console.log('> Start Notify!');
        }

        ble.onStopNotify = function (uuid) {
            console.log('> Stop Notify!');
        }
    }
}


//-------------------------------------------------
//ボタンが押された時のイベント登録
//--------------------------------------------------
function toggleConnect(dom) {
    const checked = dom.checked;

    const id = parseInt(dom.value);

    if (!checked) {
        bles[id].reset();
    }
    else {
        const kind = document.querySelector(`#char${id}`).value;
        console.log(id, checked, kind);
        bles[id].begin(kind);
    }
}


