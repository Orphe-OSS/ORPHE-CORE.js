var coreToolkit_version_date = `
Last modified: 2023/11/04 23:44:52
`;

var bles = [new Orphe(0), new Orphe(1)];

/**
 * 
 * @param {html element} parent_element 
 * @param {string} title 
 * @param {int} core_id 
 * @param {string} notification 
 */
function buildCoreToolkit(parent_element, title, core_id = 0, notification = 'ANALYSIS_AND_RAW', options = {}) {
    // デフォルト値を設定
    options.range = options.range || { acc: -1, gyro: -1 };

    // console.log(options)
    if (options.range && options.range.acc != -1 && options.range.gyro != -1) {

    }
    else {
        if (options.range.acc == 16) options.range.acc = 3;
        else if (options.range.acc == 8) options.range.acc = 2;
        else if (options.range.acc == 4) options.range.acc = 1;
        else if (options.range.acc == 2) options.range.acc = 0;

        if (options.range.gyro == 2000) options.range.gyro = 3;
        else if (options.range.gyro == 1000) options.range.gyro = 2;
        else if (options.range.gyro == 500) options.range.gyro = 1;
        else if (options.range.gyro == 250) options.range.gyro = 0;
    }

    let div_form_check = CTbuildElement('div', '', 'form-ckeck form-switch d-flex', '', parent_element);
    div_form_check.id = `core_toolkit${core_id}`;
    // toggle and title

    let input = CTbuildElement('input', '', 'form-check-input position-relative', '', div_form_check);
    input.setAttribute('type', 'checkbox');
    input.setAttribute('role', 'switch');
    input.setAttribute('id', `switch_ble${core_id}`);
    input.setAttribute('notification', notification);
    input.setAttribute('value', `${core_id}`);
    input.setAttribute('title', `coreToolkit_version_date: ${coreToolkit_version_date}\norphe_js_version_date: ${orphe_js_version_date}`);
    input.addEventListener('change', function () {
        toggleCoreModule(this, options);
    })
    let label = CTbuildElement('label', title, 'form-check-label ms-1', '', div_form_check);

    let span_group = CTbuildElement('span', '', '', '', div_form_check);
    span_group.id = `ui${core_id}`;
    span_group.style.visibility = 'hidden';

    let span_activity = CTbuildElement('span',
        `<i class="bi bi-activity position-relative">
        <span class="position-absolute top-0 start-50 translate-middle badge text-muted" style="font-size:0.2em;"
          id="freq${core_id}">
        </span>
      </i>`,
        'text-muted ms-1', '', span_group);
    span_activity.setAttribute('id', `freq${core_id}`);
    span_activity.id = `icon_bluetooth${core_id}`

    let span_battery = CTbuildElement('span', `<i class="bi bi-battery"></i>`, 'text-muted ms-1', '', span_group);
    span_battery.id = `icon_battery${core_id}`;
    span_battery.setAttribute('core_id', `${core_id}`);
    span_battery.addEventListener('click', function () {
        updateBatteryInfo(span_battery);
    })

    let span_led = CTbuildElement('span', `<i class="bi bi-brightness-alt-high position-relative"><span class="position-absolute  top-0 start-50 tanslate-middle badge text-muted bg-light" style="font-size:0.2em;" id="led_number${core_id}">
          0
        </span>
      </i>`, 'text-muted ms-1', '', span_group);
    span_led.id = `icon_led${core_id}`;
    span_led.setAttribute('number', '0');
    span_led.setAttribute('value', `${core_id}`);
    span_led.addEventListener('click', function () {
        toggleLED(span_led);
    })

    let span_settings = CTbuildElement('span', `<i
        class="bi bi-gear"></i>`, 'text-muted ms-1', '', span_group);
    span_settings.id = `icon_settings${core_id}`;
    span_settings.setAttribute('value', `${core_id}`);
    span_settings.setAttribute('title', `settings for notification, sensor ranges.`);
    span_settings.setAttribute('data-bs-toggle', 'modal');
    span_settings.setAttribute('data-bs-target', `#settings_modal${core_id}`);
    span_settings.addEventListener('click', function () {
        updateModalParameters(parseInt(core_id));
    })

    // build modal
    let div_modal = CTbuildElement('div', '', 'modal fade', '', span_group);
    div_modal.id = `settings_modal${core_id}`;
    div_modal.setAttribute('tanindex', '-1');
    div_modal.setAttribute('aria-labelledby', 'exampleModalLabel');
    div_modal.setAttribute('aria-hidden', 'true');
    let div_modal_dialog = CTbuildElement('div', '', 'modal-dialog text-dark', '', div_modal);
    let div_modal_content = CTbuildElement('div', '', 'modal-content', '', div_modal_dialog);
    let div_modal_header = CTbuildElement('div', `<h5 class="modal-title" id="exampleModalLabel"><i class="bi bi-gear"></i> CORE0${core_id} Settings</h5 >
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>`, 'modal-header', '', div_modal_content);

    let div_modal_body = CTbuildElement('div', `<div class="form-floating mt-2">
    <select class="form-select text-black" id="select_notify${core_id}" aria-label="Floating label select example"
      onchange="changeNotify(${core_id}, this);">
      <option value="ANALYSIS" selected>ANALYSIS</option>
      <option value="RAW">RAW</option>
      <option value="ANALYSIS_AND_RAW">ANALYSIS_AND_RAW</option>
    </select>
    <label for="select_acc" class="small">Realtime data protocol[not available]</label>
  </div>
  <div class="form-floating mt-2">
    <select class="form-select text-black" id="select_acc${core_id}" aria-label="Floating label select example"
      onchange="changeAccRange(${core_id},this);">
      <option value="0" selected>2</option>
      <option value="1">4</option>
      <option value="2">8</option>
      <option value="3">16</option>
    </select>
    <label for="select_acc${core_id}" class="small">Accelerometer Range [g]</label>
  </div>
  <div class="form-floating mt-2">
    <select class="form-select text-black" id="select_gyro${core_id}" aria-label="Floating label select example"
      onchange="changeGryoRange(${core_id},this);">
      <option value="0" selected>250</option>
      <option value="1">500</option>
      <option value="2">1000</option>
      <option value="3">2000</option>
    </select>
    <label for="select_gyro${core_id}" class="small">Gryorscope Range [g]</label>
  </div>
  <div class="form-floating mt-2">
    <select class="form-select text-black" id="select_lr${core_id}" aria-label="lr"
    onchange="changeLR(${core_id},this);">
      <option value="0" selected>LEFT</option>
      <option value="1">RIGTH</option>
    </select>
    <label for="select_gyro${core_id}" class="small">LEFT/RIGHT</label>
  </div>
  <div class="d-grid gap-2 col-12 mx-auto mt-4">
    <label for="range_brightness${core_id}" class="form-label small">LED Brightness</label>
    <input type="range" class="form-range" min="0" max="255" step="1" id="range_brightness${core_id}" onchange="changeLEDBrightness(${core_id},this);">
  </div>  
  <div class="d-grid gap-2 col-10 mx-auto mt-4">
  <button class="btn btn-warning text-white" type="button" onclick="resetCoreModule(${core_id});">Reset
    Attitude & Gait Analysis</button>
</div>`, 'modal-body', '', div_modal_content);

    // div_modal_bodyにある notificationセレクタを設定値にあわせる
    let select_notify = div_modal_body.querySelector(`#select_notify${core_id}`);
    if (notification == 'ANALYSIS') select_notify.options[0].selected = true;
    else if (notification == 'RAW') select_notify.options[1].selected = true;
    else if (notification == 'ANALYSIS_AND_RAW') select_notify.options[2].selected = true;


    // console.log(div_form_check);
}

async function toggleCoreModule(dom, options = {}) {
    // console.log("toggleCoreModule", options);
    let checked = dom.checked;
    let number = parseInt(dom.value);
    let ble = bles[number];
    let notification = dom.getAttribute('notification');

    if (checked == true) {

        let ret = await ble.begin(notification, options);
        if (!ret) {
            document.querySelector(`#switch_ble${number}`).checked = false;
            return;
        }

        document.querySelector(`#ui${number}`).style.visibility = 'visible';
        ble.gotBLEFrequency = function (freq) {
            document.querySelector(`#freq${this.id} `).innerHTML = `${Math.floor(freq)} Hz`;
        };
    }
    else {
        ble.reset();
        document.querySelector(`#ui${number}`).style.visibility = 'hidden';
        //setHeaderStatusOffline(ble.id);

    }
}

// notifyは複数同じものを呼び出せてしまうので，必ずすでに登録したnotificationはストップする
// 必要がある．
function changeNotify(no, dom) {
    if (bles[no].notification_type == 'ANALYSIS') {
        bles[no].stopNotify('STEP_ANALYSIS').then(() => {
            setTimeout(function () {
                bles[no].begin(dom.value);
            }, 500);
        });
    }
    else if (bles[no].notification_type == 'RAW') {
        bles[no].stopNotify('SENSOR_VALUES').then(() => {
            setTimeout(function () {
                bles[no].begin(dom.value);
            }, 500);
        });
    }
    else if (bles[no].notification_type == 'ANALYSIS_AND_RAW') {
        bles[no].stopNotify('STEP_ANALYSIS').then(() => {
            bles[no].stopNotify('SENSOR_VALUES').then(() => {
                setTimeout(function () {
                    bles[no].begin(dom.value);
                }, 500);
            });
        });

    }
}

async function changeAccRange(no, dom) {
    var obj = await bles[no].getDeviceInformation();
    obj.range.acc = parseInt(dom.value);
    obj.lr = 0xFF;
    bles[no].setDeviceInformation(obj);
}

async function changeGryoRange(no, dom) {
    var obj = await bles[no].getDeviceInformation();
    obj.range.gyro = parseInt(dom.value);
    obj.lr = 0xFF;
    bles[no].setDeviceInformation(obj);
}
async function changeLEDBrightness(no, dom) {
    var obj = await bles[no].getDeviceInformation();
    obj.led_brightness = parseInt(dom.value);
    obj.lr = 0xFF;
    bles[no].setDeviceInformation(obj);
}
async function changeLR(no, dom) {
    var obj = await bles[no].getDeviceInformation();
    obj.lr = parseInt(dom.value);
    bles[no].setDeviceInformation(obj);
}

async function updateModalParameters(no) {
    var obj = await bles[no].getDeviceInformation();

    // ACC Range
    {
        let select = document.querySelector(`#select_acc${no} `);
        let options = select.options;
        options[obj.range.acc].selected = true;
    }
    // Gryo Range
    {
        let select = document.querySelector(`#select_gyro${no} `);
        let options = select.options;
        options[obj.range.gyro].selected = true;
    }
    // LED Brightness
    {
        let range = document.querySelector(`#range_brightness${no}`);
        range.value = obj.led_brightness;
    }
    // LR Setting
    {
        let select = document.querySelector(`#select_lr${no}`);
        let options = select.options;
        options[obj.lr].selected = true;
    }
}

function resetCoreModule(id) {
    bles[id].resetMotionSensorAttitude();
    bles[id].resetAnalysisLogs();
}

async function updateBatteryInfo(dom) {
    let number = parseInt(dom.getAttribute('core_id'));
    var obj = await bles[number].getDeviceInformation();
    let str_battery_status;
    if (obj.battery == 0) str_battery_status = 'empty';
    else if (obj.battery == 1) str_battery_status = 'normal';
    else if (obj.battery == 2) str_battery_status = 'full';
    document.querySelector(`#icon_battery${number} `).setAttribute('title', `${str_battery_status} `);

    if (obj.battery == '0') {
        document.querySelector(`#icon_battery${number} `).innerHTML = '<i class="bi bi-battery"></i>';
        document.querySelector(`#icon_battery${number} `).classList = 'text-warning';
    }
    else if (obj.battery == '1') {
        document.querySelector(`#icon_battery${number} `).innerHTML = '<i class="bi bi-battery-half"></i>';
    }
    else if (obj.battery == '2') {
        document.querySelector(`#icon_battery${number} `).innerHTML = '<i class="bi bi-battery-full"></i>';
    }
}

function toggleLED(dom) {

    let number = parseInt(dom.getAttribute('number'));
    let id = parseInt(dom.getAttribute('value'));
    number++;
    if (number > 6) number = 0;
    document.querySelector(`#led_number${id} `).innerText = number;
    if (number == 0) {
        bles[id].setLED(0, 0);
    } else {
        bles[id].setLED(1, number);
    }
    dom.setAttribute('number', number);
}

function setHeaderStatusOffline(id) {
    document.querySelector(`#switch_ble${id} `).checked = false;
}


function CTbuildElement(name_tag, innerHTML, str_class, str_style, element_appended) {
    let element = document.createElement(name_tag);


    element.innerHTML = innerHTML;
    element.classList = str_class;
    if (str_style != '') {
        element.setAttribute('style', str_style);
    }
    element_appended.appendChild(element);
    return element;
}
function buildElement(name_tag, innerHTML, str_class, str_style, element_appended) {
    let element = document.createElement(name_tag);
    element.innerHTML = innerHTML;
    element.classList = str_class;
    if (str_style != '') {
        element.setAttribute('style', str_style);
    }
    element_appended.appendChild(element);
    return element;
}