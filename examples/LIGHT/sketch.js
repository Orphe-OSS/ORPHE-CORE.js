// 複数orphe coreを利用する場合は配列つかうと便利
const bles = [new Orphe(0), new Orphe(1)];

//--------------------------------------------------
//ロード時の処理
//--------------------------------------------------
window.onload = function () {
    // ORPHE COREの初期セットアップ
    for (ble of bles) {
        ble.setup(['DEVICE_INFORMATION']);
    }
}


function sendLEDMessage(dom) {
    const json = JSON.parse(dom.value);
    const value = json.value;
    const id = json.id;
    if (value >= 0) {
        bles[id].setLED(1, value);
    }
    else {
        bles[id].setLED(0, value);
    }
}


function toggleConnect(dom) {
    console.log("toggleConnect(): ", dom.value);
    // ble
    if (dom.checked) {
        // 初めてつなぐ時はbegin()で
        bles[dom.value].begin();
        document.querySelector(`#slider${dom.value}`).disabled = false;
        document.querySelector(`#btnradio${dom.value * 6 + 1}`).checked = true;
        for (let i = 0 + 6 * dom.value; i < 6 + 6 * dom.value; i++) {
            document.querySelector(`#btnradio${i}`).disabled = false;
        }
    }
    else {
        // 解除
        bles[dom.value].stop();
        document.querySelector(`#slider${dom.value}`).disabled = true;
        for (let i = 0 + 6 * dom.value; i < 6 + 6 * dom.value; i++) {
            document.querySelector(`#btnradio${i}`).disabled = true;
        }
    }

}

document.querySelector('#slider0').addEventListener('change', function () {
    bles[0].setLEDBrightness(this.value);
});

document.querySelector('#slider1').addEventListener('change', function () {
    bles[1].setLEDBrightness(this.value);
});