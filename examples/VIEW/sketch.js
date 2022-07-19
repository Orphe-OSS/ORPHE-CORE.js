let my_model;

function preload() {
    //my_model = loadModel('./ORPHE CORE3.0.obj');
    my_model = loadModel('../../models/orphe.shoe.stl');
}


var mycanvas;
function setup() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16;
    mycanvas = createCanvas(canvas_width, canvas_height, WEBGL);
    document.querySelector('#canvas_placeholder').appendChild(mycanvas.elt);
}

var eulers = [];
function draw() {
    background(200);
    orbitControl()
    if (eulers.length > 0) {
        scale(1);
        //rotateX(3.14 / 2);

        let count = 0;
        for (euler of eulers) {
            push();
            translate(-100 + 200 * count, -2, 0);
            rotateX(euler.pitch);
            rotateY(euler.roll);
            rotateZ(-euler.yaw);

            // 太陽光が手前上から当たる
            directionalLight(255, 255, 255, 0, 1, -1);
            // 黄色のマテリアル
            ambientMaterial(255, 255, 255);
            noStroke();

            model(my_model);
            pop();
            count++;
        }
    }
    else {
        for (let i = 0; i < 2; i++) {
            push();
            // 太陽光が手前上から当たる
            directionalLight(255, 255, 255, 0, 1, -1);
            // 黄色のマテリアル
            ambientMaterial(255, 255, 255);
            translate(-100 + 200 * i, 0, 0);
            noStroke();
            model(my_model);
            pop();
        }
    }

}
function windowResized() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16;
    resizeCanvas(canvas_width, canvas_height);
    console.log("hello")
}

//--------------------------------------------------
//Global変数
//--------------------------------------------------
var bles = [new Orphe(0), new Orphe(1)];

//--------------------------------------------------
//ロード時の処理
//--------------------------------------------------
window.onload = function () {
    for (ble of bles) {
        ble.setup([
            'DEVICE_INFORMATION',
            'SENSOR_VALUES',
            'STEP_ANALYSIS'
        ]);

        ble.onConnectGATT = function (uuid) {
            console.log('> connected GATT!');
            document.getElementById(`uuid_name${this.id + 1}`).innerHTML = uuid;
            document.querySelector(`#startNotifications${this.id}`).classList = 'btn btn-danger';
            document.querySelector(`#button_name${this.id}`).innerHTML = "disconnect";
            document.querySelector(`#char${this.id}`).disabled = true;
        }

        ble.onScan = function (deviceName) {
            document.getElementById(`device_name${this.id}`).innerHTML = deviceName;
        }

        ble.gotQuat = function (quat) {
            document.querySelector(`#sq${this.id}_w`).innerHTML = `${quat.w.toFixed(3)}`;
            document.querySelector(`#sq${this.id}_x`).innerHTML = `${quat.x.toFixed(3)}`;
            document.querySelector(`#sq${this.id}_y`).innerHTML = `${quat.y.toFixed(3)}`;
            document.querySelector(`#sq${this.id}_z`).innerHTML = `${quat.z.toFixed(3)}`;
        }

        ble.gotDelta = function (delta) {
            document.querySelector(`#sd${this.id}_x`).innerHTML = `${delta.x.toFixed(3)}`;
            document.querySelector(`#sd${this.id}_y`).innerHTML = `${delta.y.toFixed(3)}`;
            document.querySelector(`#sd${this.id}_z`).innerHTML = `${delta.z.toFixed(3)}`;
        }

        ble.gotGyro = function (gyro) {
            document.querySelector(`#svg${this.id}_x`).innerHTML = `${gyro.x.toFixed(3)}`;
            document.querySelector(`#svg${this.id}_y`).innerHTML = `${gyro.y.toFixed(3)}`;
            document.querySelector(`#svg${this.id}_z`).innerHTML = `${gyro.z.toFixed(3)}`;
        }

        ble.gotAcc = function (acc) {
            document.querySelector(`#sva${this.id}_x`).innerHTML = `${acc.x.toFixed(3)}`;
            document.querySelector(`#sva${this.id}_y`).innerHTML = `${acc.y.toFixed(3)}`;
            document.querySelector(`#sva${this.id}_z`).innerHTML = `${acc.z.toFixed(3)}`;
        }

        ble.gotEuler = function (euler) {
            eulers[this.id] = euler;
        }

        ble.gotGait = function (gait) {
            document.querySelector(`#gait${this.id}_w`).innerHTML = gait.type;
            document.querySelector(`#gait${this.id}_x`).innerHTML = gait.direction;
            document.querySelector(`#gait${this.id}_y`).innerHTML = gait.calorie.toFixed(3);
            document.querySelector(`#gait${this.id}_z`).innerHTML = gait.distance.toFixed(3);
        }
        ble.gotStride = function (stride) {
            document.querySelector(`#stride${this.id}_w`).innerHTML = stride.foot_angle.toFixed(3);
            document.querySelector(`#stride${this.id}_x`).innerHTML = stride.x.toFixed(3);
            document.querySelector(`#stride${this.id}_y`).innerHTML = stride.y.toFixed(3);
            document.querySelector(`#stride${this.id}_z`).innerHTML = stride.z.toFixed(3);
        }
        ble.gotPronation = function (pronation) {
            document.querySelector(`#pronation${this.id}_w`).innerHTML = pronation.landing_impact.toFixed(3);
            document.querySelector(`#pronation${this.id}_x`).innerHTML = pronation.x.toFixed(3);
            document.querySelector(`#pronation${this.id}_y`).innerHTML = pronation.y.toFixed(3);
            document.querySelector(`#pronation${this.id}_z`).innerHTML = pronation.z.toFixed(3);
        }

        ble.onStartNotify = function (uuid) {
            console.log('> Start Notify!');
            document.getElementById(`uuid_name${this.id}`).innerHTML = uuid;
        }

        ble.onStopNotify = function (uuid) {
            console.log('> Stop Notify!');
            //document.getElementById('uuid_name').innerHTML = uuid;
        }
    }
}


//-------------------------------------------------
//ボタンが押された時のイベント登録
//--------------------------------------------------
function toggleConnect(dom) {
    const checked = dom.checked;

    const id = parseInt(dom.value);
    console.log(id, checked);
    if (!checked) {
        bles[id].reset();
        document.querySelector(`#char${id}`).disabled = false;
        dom.innerHTML = "connect";
        dom.classList = 'form-check-input';
    }
    else {
        const kind = document.querySelector(`#char${id}`).value;
        bles[id].startNotify(kind);
    }
}


