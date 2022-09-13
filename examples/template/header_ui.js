var bles = [new Orphe(0), new Orphe(1)];

async function toggleCoreModule(dom) {
    let checked = dom.checked;
    let number = dom.value;
    let ble = bles[number];

    if (checked == true) {
        let ret = await ble.begin('ANALYSIS');
        ble.gotBLEFrequency = function (freq) {
            document.querySelector(`#freq${this.id}`).innerHTML = `${Math.floor(freq)}Hz`;
        };
        setTimeout(async function () {
            var obj = await ble.getDeviceInformation();
            let str_battery_status;
            if (obj.battery == 0) str_battery_status = 'empty';
            else if (obj.battery == 1) str_battery_status = 'normal';
            else if (obj.battery == 2) str_battery_status = 'full';
            document.querySelector(`#icon_battery${number}`).setAttribute('title', `${str_battery_status}`);

            if (obj.battery == '0') {
                document.querySelector(`#icon_battery${number}`).innerHTML = '<i class="bi bi-battery"></i>';
                document.querySelector(`#icon_battery${number}`).classList = 'text-warning';
            }
            else if (obj.battery == '1') {
                document.querySelector(`#icon_battery${number}`).innerHTML = '<i class="bi bi-battery-half"></i>';
                document.querySelector(`#icon_battery${number}`).classList = 'text-primary';
            }
            else if (obj.battery == '2') {
                document.querySelector(`#icon_battery${number}`).innerHTML = '<i class="bi bi-battery-full"></i>';
                document.querySelector(`#icon_battery${number}`).classList = 'text-primary';
            }
        }, 500);
        document.querySelector(`#icon_bluetooth${number}`).classList = 'text-primary';
        document.querySelector(`#icon_settings${number}`).classList = 'text-primary';
        document.querySelector(`#icon_brightness${number}`).classList = 'text-primary';
    }
    else {
        ble.reset();
        setHeaderStatusOffline(ble.id);
    }
}

function resetCoreModule(id) {
    bles[id].resetMotionSensorAttitude();
    bles[id].resetAnalysisLogs();
}

function toggleBrightness(dom) {
    let number = dom.getAttribute('number');
    let id = dom.getAttribute('value');
    number++;
    if (number > 5) number = -1;
    document.querySelector(`#led_number${id}`).innerText = number + 1;

    if (number == -1) {
        bles[id].setLED(0, 0);
        document.querySelector(`#icon_brightness${id}`).classList = 'text-muted';
    } else {
        bles[id].setLED(1, number);
        document.querySelector(`#icon_brightness${id}`).classList = 'text-primary';
    }
    dom.setAttribute('number', number);
}

function setHeaderStatusOffline(id) {
    document.querySelector(`#icon_bluetooth${id}`).classList = 'text-muted';
    document.querySelector(`#icon_battery${id}`).innerHTML = '<i class="bi bi-battery"></i>';
    document.querySelector(`#icon_battery${id}`).classList = 'text-muted';
    document.querySelector(`#icon_settings${id}`).classList = 'text-muted';
    document.querySelector(`#icon_brightness${id}`).classList = 'text-muted';
    document.querySelector(`#switch_ble${id}`).checked = false;

}

