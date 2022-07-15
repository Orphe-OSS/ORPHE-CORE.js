// 複数orphe coreを利用する場合は配列つかうと便利
const ble = new Orphe(0);

//--------------------------------------------------
//ロード時の処理
//--------------------------------------------------
window.onload = function () {
    // ORPHE COREの初期セットアップ
    ble.setup(['DEVICE_INFORMATION']);
}

async function toggleConnect(dom) {
    console.log("toggleConnect(): ", dom.value);
    // ble
    if (dom.checked) {
        // 初めてつなぐ時はbegin()。beginはawait対応にしといた
        await ble.begin();
        document.querySelector('button').disabled = false;
    }
    else {
        // 解除
        ble.stop();
        document.querySelector('button').disabled = true;
    }
}

function getDeviceInformation() {
    ble.read('DEVICE_INFORMATION').then(() => {
        console.log(ble.device_information)
        document.querySelector('#td_battery').innerText = ble.device_information.battery;
        document.querySelector('#td_lr').innerText = ble.device_information.lr;
        document.querySelector('#td_rec_mode').innerText = ble.device_information.rec_mode;
        document.querySelector('#td_rec_auto_run').innerText = ble.device_information.rec_auto_run;
        document.querySelector('#td_led_brightness').innerText = ble.device_information.led_brightness;
        document.querySelector('#td_range_acc').innerText = ble.device_information.range.acc;
        document.querySelector('#td_range_gyro').innerText = ble.device_information.range.gyro;
    });
}

