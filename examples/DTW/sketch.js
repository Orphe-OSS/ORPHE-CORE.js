// 認識にかけるためのリアルタイムデータ入力用
var input = {
    x: [],
    y: []
}

// データを登録する際に利用するオブジェクト
var input_record = {
    x: [],
    y: []
}

// 登録したデータを保存して、参照するオブジェクト
var data = {
    triangle: {
        x: [2, 1, 3, 5, 7, 4, 0, 14, 6, 3, 6, 2, 3, 7, 2, 2, 2, 0, 3, 1, 0, 0, 0, 0, 0, 0, 0, -4, -9, -11, -14, -14, -13, -6, 0, -22, -5, -4, -4, -3, -3, -6, 0, -3, -2, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0, 2, 3, 8, 12, 4, 7, 3, 0, 4, 4, 2, 3, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        y: [-2, -1, -5, -7, -10, -5, 0, -24, -13, -7, -12, -5, -7, -13, -3, -6, -4, 0, -6, -1, -1, -1, -1, 0, -4, 0, -1, 0, 2, 2, 2, 2, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 7, 6, 7, 17, 22, 8, 12, 6, 0, 8, 9, 5, 3, 2, 2, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
    },
    square: {
        x: [0, 0, 1, 0, 0, 0, 0, 0, -2, -1, -2, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, -7, -7, -10, -6, -15, -15, -12, -6, -9, -6, -5, -4, -1, -1, 0, -2, -1, -2, -1, -1, 0, -1, -1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 5, 7, 0, 15, 21, 15, 13, 7, 4, 6, 4, 3, 3, 1, 2, 2, 0, 1, 0, 0, 0, 0, 0, 0, 1],
        y: [-2, -2, -5, -8, -11, -13, 0, -16, -22, -14, -11, -3, -3, -7, -5, -1, -1, -1, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 7, 12, 12, 13, 6, 14, 9, 9, 3, 6, 4, 5, 6, 1, 3, 1, 0, 0, 0, 1, 2, 2, 2, 0, 3, 1, 1, 1, 0, 0, 0, -1, 0, -1, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    circle: {
        x: [1, 3, 7, 8, 4, 0, 12, 5, 3, 2, 1, 0, 3, 0, 0, -1, -1, 0, -11, -6, -5, -2, -2, -7, -8, -6, -4, -8, 0, -15, -4, -5, -5, -3, -7, -6, -2, -2, 0, 0, 0, 0, 2, 2, 1, 0, 5, 3, 4, 5, 0, 5, 10, 6, 5, 0, 10, 2, 2, 0, 1],
        y: [0, 0, -2, -4, -2, 0, -9, -7, -5, -6, -3, 0, -13, -6, -4, -8, -3, 0, -15, -6, -5, -1, -2, -5, -5, -3, -1, -3, 0, -2, 0, 0, 1, 2, 4, 6, 5, 5, 6, 0, 7, 12, 8, 9, 5, 0, 17, 7, 5, 4, 0, 4, 4, 2, 1, 0, 2, 0, 1, 0, 0]
    }
}


var mouse_previous = {
    x: 0,
    y: 0
}

window.addEventListener('DOMContentLoaded', function () {
    let ble = bles[0];
    buildCoreToolkit(
        document.querySelector('#toolkit_placeholder'),
        'ORPHE CORE01', ble.id, 'ANALYSIS_AND_RAW'
    );
})

function setup() {
    var canvas = createCanvas(256, 256);
    canvas.parent('#canvas_placeholder');

    // 20msおきにデータ入力がある、という設定にする。ORPHEがあればそれは gotAcc等のタイミングで更新すればよい
    setInterval(function () {
        // yの相対座標
        input.y.push(mouse_previous.y - mouseY);
        if (input.y.length > 50 * 2) {
            input.y.shift();
        }
        // xの相対座標
        input.x.push(mouse_previous.x - mouseX);
        if (input.x.length > 50 * 2) {
            input.x.shift();
        }
        // スペースキーが押されている間は is_recording がtrueになっている
        if (is_recording) {
            input_record.x.push(mouse_previous.x - mouseX);
            input_record.y.push(mouse_previous.y - mouseY);
        }
        mouse_previous.x = mouseX;
        mouse_previous.y = mouseY;
    }, 20);
    rectMode(CENTER, CENTER);
}

function draw() {
    background(200);
    noFill();
    stroke(0);

    // 学習データ作成時の目安となる○△□をガイドとして描いておく
    circle(width / 2, height / 2, width / 2, height / 2);
    triangle(width / 2, height * 1 / 4, width / 4, height * 3 / 4, width * 3 / 4, height * 3 / 4);
    rect(width / 2, height / 2, width / 2, height / 2);

    // 入力データ
    {
        stroke(0, 255, 0);
        beginShape();
        let x = 0;
        for (let i of input.y) {
            vertex(x, i + height / 2);
            x++;
        }
        endShape();
    }
    {
        stroke(0, 0, 255);
        beginShape();
        let x = 0;
        for (let i of input.x) {
            vertex(x, i + height / 2);
            x++;
        }
        endShape();
    }

    if (input.x.length >= 50 * 2 && input.y.length >= 50 * 2) {
        var distFunc = function (a, b) {
            return Math.abs(a - b);
        };


        var dtw = {
            triangle: {
                x: new DynamicTimeWarping(input.x, data.triangle.x, distFunc),
                y: new DynamicTimeWarping(input.y, data.triangle.y, distFunc)
            },
            square: {
                x: new DynamicTimeWarping(input.x, data.square.x, distFunc),
                y: new DynamicTimeWarping(input.y, data.square.y, distFunc)
            },
            circle: {
                x: new DynamicTimeWarping(input.x, data.circle.x, distFunc),
                y: new DynamicTimeWarping(input.y, data.circle.y, distFunc)
            }


        }
        let distance = [
            {
                id: 'triangle',
                value: dtw.triangle.x.getDistance() + dtw.triangle.y.getDistance()
            },
            {
                id: 'square',
                value: dtw.square.x.getDistance() + dtw.square.y.getDistance()
            },
            {
                id: 'circle',
                value: dtw.circle.x.getDistance() + dtw.circle.y.getDistance()
            },
        ];


        //ソートします。
        let results = distance.sort(function (a, b) {
            return (a.value < b.value) ? -1 : 1;
        });
        let p = document.querySelector('#debug_area');
        p.innerHTML = '';
        for (let r of results) {
            p.innerHTML += `${r.id} DTW distance = ${r.value}<br>`;
        }
        if (results[0].value < 300) {
            fill(0);
            textSize(32);
            textAlign(CENTER, CENTER);
            text(results[0].id, width / 2, height / 2);
        }
    }


}

var is_recording = false;
function keyPressed() {
    if (key == 'p') {
        if (isLooping()) noLoop();
        else loop();
    }
    else if (key == ' ') {
        is_recording = true;

        // 記録用バッファを初期化
        input_record.x = [];
        input_record.y = [];
    }
    else if (key == 'o') {
        console.log(`x:[${input_record.x}],`);
        console.log(`y:[${input_record.y}]`);
    }
}
function keyReleased() {
    if (key == ' ') {
        is_recording = false;
        console.log(is_recording);
    }
}