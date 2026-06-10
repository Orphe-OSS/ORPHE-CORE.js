var insoleToolkit_version_date = `
Last modified: 2026/06/10 00:00:00
`;
// insoleToolkit_version_dateから改行を削除
insoleToolkit_version_date = insoleToolkit_version_date.replace(/\n/g, '');

/**
 * InsoleToolkit.js
 *
 * ORPHE INSOLE 用の接続GUIツールキット。CORE 用 CoreToolkit.js の slim 版で、
 * INSOLE に存在しない機能（LED、左右書き込み、STEP_ANALYSIS通知選択）を削除し、
 * 代わりに INSOLE 固有のデータストリーミングモード選択と
 * 取り付け位置（左右）バッジ、自動再接続ステータス表示を追加しています。
 *
 * 依存: Bootstrap 5 (CSS/JS) + bootstrap-icons + ORPHE-INSOLE.js
 */

/**
 * insoles = [new OrpheInsole(0), new OrpheInsole(1)];
 * INSOLE は最大2足（左右）まで同時接続できます。
 */
var insoles = [new OrpheInsole(0), new OrpheInsole(1)];

/**
 * CORE 系コードからの移植を容易にするためのエイリアス。参照先は insoles と同じ。
 */
var bles = insoles;
var cores = insoles;

/**
 * インソール操作GUIを生成する。ユーザはこれを呼び出すだけでよい。
 * @param {Element} parent_element - InsoleToolkitを追加する親要素
 * @param {string} title - タイトル。トグルボタンの横に表示される
 * @param {number} [insole_id=0]  - 0,1のどちらかを指定する。インソールは最大2つまで
 * @param {object} [options] - {streamingMode: 1|3|4, autoReconnect: boolean}
 */
function buildInsoleToolkit(parent_element, title, insole_id = 0, options = {}) {
    if (typeof options.streamingMode === 'undefined') options.streamingMode = 4;
    if (typeof options.autoReconnect === 'undefined') options.autoReconnect = true;
    insoles[insole_id]._insoleToolkitOptions = options;

    let div_form_check = ITbuildElement('div', '', 'form-check form-switch d-flex', '', parent_element);
    div_form_check.id = `insole_toolkit${insole_id}`;

    // toggle and title
    let input = ITbuildElement('input', '', 'form-check-input position-relative', '', div_form_check);
    input.setAttribute('type', 'checkbox');
    input.setAttribute('role', 'switch');
    input.setAttribute('id', `switch_ble${insole_id}`);
    input.setAttribute('value', `${insole_id}`);
    input.setAttribute('title', `insoleToolkit_version_date: ${insoleToolkit_version_date}\norphe_js_version_date: ${orphe_js_version_date}`);
    input.addEventListener('change', function () {
        toggleInsoleModule(this, options);
    })
    ITbuildElement('label', title, 'form-check-label ms-1', '', div_form_check);

    let span_group = ITbuildElement('span', '', '', '', div_form_check);
    span_group.id = `ui${insole_id}`;
    span_group.style.visibility = 'hidden';

    // 実測周波数
    let span_activity = ITbuildElement('span',
        `<i class="bi bi-activity position-relative">
        <span class="position-absolute top-0 start-50 translate-middle badge text-muted" style="font-size:0.2em;"
          id="freq${insole_id}">
        </span>
      </i>`,
        'text-muted ms-1', '', span_group);
    span_activity.id = `icon_bluetooth${insole_id}`;

    // 左右バッジ（device_information.mount_position bit0 から自動表示）
    let span_lr = ITbuildElement('span', `<span class="badge bg-secondary" id="lr_badge${insole_id}">-</span>`, 'ms-1', '', span_group);
    span_lr.id = `icon_lr${insole_id}`;
    span_lr.setAttribute('title', 'mount position (L/R)');

    // バッテリー
    let span_battery = ITbuildElement('span', `<i class="bi bi-battery"></i>`, 'text-muted ms-1', '', span_group);
    span_battery.id = `icon_battery${insole_id}`;
    span_battery.setAttribute('insole_id', `${insole_id}`);
    span_battery.addEventListener('click', function () {
        updateInsoleBatteryInfo(span_battery);
    })

    // 自動再接続ステータス（再接続試行中のみ表示）
    let span_reconnect = ITbuildElement('span',
        `<i class="bi bi-arrow-repeat"></i><span class="small" id="reconnect_text${insole_id}"></span>`,
        'text-warning ms-1', '', span_group);
    span_reconnect.id = `icon_reconnect${insole_id}`;
    span_reconnect.style.display = 'none';
    span_reconnect.setAttribute('title', 'auto reconnecting...');

    // 設定モーダル
    let span_settings = ITbuildElement('span', `<i class="bi bi-gear"></i>`, 'text-muted ms-1', '', span_group);
    span_settings.id = `icon_settings${insole_id}`;
    span_settings.setAttribute('value', `${insole_id}`);
    span_settings.setAttribute('title', `settings for streaming mode.`);
    span_settings.setAttribute('data-bs-toggle', 'modal');
    span_settings.setAttribute('data-bs-target', `#settings_modal${insole_id}`);
    span_settings.addEventListener('click', function () {
        updateInsoleModalParameters(parseInt(insole_id));
    })

    let div_modal = ITbuildElement('div', '', 'modal fade', '', span_group);
    div_modal.id = `settings_modal${insole_id}`;
    div_modal.setAttribute('tabindex', '-1');
    div_modal.setAttribute('aria-hidden', 'true');
    let div_modal_dialog = ITbuildElement('div', '', 'modal-dialog text-dark', '', div_modal);
    let div_modal_content = ITbuildElement('div', '', 'modal-content', '', div_modal_dialog);
    ITbuildElement('div', `<h5 class="modal-title"><i class="bi bi-gear"></i> INSOLE0${insole_id} Settings</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>`, 'modal-header', '', div_modal_content);

    ITbuildElement('div', `<div class="form-floating mt-2">
    <select class="form-select text-black" id="select_streaming_mode${insole_id}"
      onchange="changeInsoleStreamingMode(${insole_id}, this);">
      <option value="1">1: quat + gyro + acc (200Hz)</option>
      <option value="3">3: gyro + acc + press (200Hz)</option>
      <option value="4" selected>4: gyro + acc + press + quat (100Hz)</option>
    </select>
    <label for="select_streaming_mode${insole_id}" class="small">Data Streaming Mode</label>
  </div>
  <div class="row mt-3 small text-muted">
    <div class="col-6">Accelerometer Range: <span id="info_acc_range${insole_id}">-</span> g</div>
    <div class="col-6">Gyroscope Range: <span id="info_gyro_range${insole_id}">-</span> °/s</div>
  </div>
  <div class="row mt-1 small text-muted">
    <div class="col-12">Mount Position: <span id="info_mount_position${insole_id}">-</span></div>
  </div>
  <div class="d-grid gap-2 col-10 mx-auto mt-4">
    <button class="btn btn-warning text-white" type="button" onclick="resetInsoleModule(${insole_id});">Reset
      Analysis Logs</button>
  </div>`, 'modal-body', '', div_modal_content);

    // 設定モーダルのストリーミングモード初期値を options に合わせる
    let select_mode = div_modal_content.querySelector(`#select_streaming_mode${insole_id}`);
    for (const opt of select_mode.options) {
        opt.selected = (parseInt(opt.value) === options.streamingMode);
    }
}

/**
 * CoreToolkit 互換ラッパー。
 * CORE 用コードからの移植を容易にするために残してあります。
 * notification 引数は INSOLE では SENSOR_VALUES 固定のため無視されます。
 * @deprecated buildInsoleToolkit を利用してください
 */
function buildCoreToolkit(parent_element, title, core_id = 0, notification = 'SENSOR_VALUES', options = {}) {
    if (notification && notification !== 'SENSOR_VALUES') {
        console.warn(`InsoleToolkit: notification '${notification}' is ignored. ORPHE INSOLE only supports SENSOR_VALUES.`);
    }
    return buildInsoleToolkit(parent_element, title, core_id, options);
}

/**
 * BLE接続のトグルボタンが切り替わったときに呼び出される関数
 * @param {Element} dom
 * @param {object} options
 *
 */
async function toggleInsoleModule(dom, options = {}) {
    let checked = dom.checked;
    let number = parseInt(dom.value);
    let insole = insoles[number];
    if (checked == true) {
        let ret;
        try {
            ret = await insole.begin('SENSOR_VALUES', options);
        } catch (error) {
            ret = null;
        }
        if (!ret) {
            document.querySelector(`#switch_ble${number}`).checked = false;
            return;
        }

        document.querySelector(`#ui${number}`).style.visibility = 'visible';
        updateInsoleLRBadge(number);

        // ツールキットUI用コールバック。ユーザ側の上書きと共存できるよう、
        // 既存のユーザコールバックがあれば チェーンして呼び出す。
        const userGotBLEFrequency = insole.gotBLEFrequency;
        insole.gotBLEFrequency = function (freq) {
            const el = document.querySelector(`#freq${this.id}`);
            if (el) el.innerHTML = `${Math.floor(freq)} Hz`;
            if (typeof userGotBLEFrequency === 'function') userGotBLEFrequency.call(this, freq);
        };

        const userOnReconnectAttempt = insole.onReconnectAttempt;
        insole.onReconnectAttempt = function (info) {
            const icon = document.querySelector(`#icon_reconnect${this.id}`);
            const text = document.querySelector(`#reconnect_text${this.id}`);
            if (icon) icon.style.display = '';
            if (text) text.innerText = `${info.attempt}/${info.maxAttempts}`;
            if (typeof userOnReconnectAttempt === 'function') userOnReconnectAttempt.call(this, info);
        };
        const userOnReconnectSuccess = insole.onReconnectSuccess;
        insole.onReconnectSuccess = function (info) {
            const icon = document.querySelector(`#icon_reconnect${this.id}`);
            if (icon) icon.style.display = 'none';
            updateInsoleLRBadge(this.id);
            if (typeof userOnReconnectSuccess === 'function') userOnReconnectSuccess.call(this, info);
        };
        const userOnReconnectFailed = insole.onReconnectFailed;
        insole.onReconnectFailed = function (info) {
            const icon = document.querySelector(`#icon_reconnect${this.id}`);
            if (icon) icon.style.display = 'none';
            setInsoleHeaderStatusOffline(this.id);
            document.querySelector(`#ui${this.id}`).style.visibility = 'hidden';
            if (typeof userOnReconnectFailed === 'function') userOnReconnectFailed.call(this, info);
        };
    }
    else {
        insole.reset();
        document.querySelector(`#ui${number}`).style.visibility = 'hidden';
    }
}

/**
 * device_information.mount_position から左右バッジを更新する
 * bit0: 0=LEFT, 1=RIGHT
 * @param {number} no - insole_id(0,1)
 */
function updateInsoleLRBadge(no) {
    const badge = document.querySelector(`#lr_badge${no}`);
    if (!badge) return;
    const info = insoles[no].device_information;
    if (!info || typeof info.mount_position === 'undefined') {
        badge.innerText = '-';
        return;
    }
    const isRight = (info.mount_position & 0b1) === 1;
    badge.innerText = isRight ? 'R' : 'L';
    badge.classList.remove('bg-secondary');
    badge.classList.add(isRight ? 'bg-primary' : 'bg-success');
}

/**
 * InsoleToolkitからデータストリーミングモードが変更された場合に呼び出される関数
 * @param {number} no (0,1)
 * @param {Element} dom セレクタ
 */
async function changeInsoleStreamingMode(no, dom) {
    const mode = parseInt(dom.value);
    try {
        await insoles[no].setDataStreamingMode(mode);
        if (insoles[no]._insoleToolkitOptions) {
            insoles[no]._insoleToolkitOptions.streamingMode = mode;
        }
    } catch (error) {
        console.error('changeInsoleStreamingMode failed:', error);
    }
}

/**
 * 設定モーダルのパラメータを更新する関数
 * @param {number} no (0,1)
 */
async function updateInsoleModalParameters(no) {
    var obj = await insoles[no].getDeviceInformation();

    // ACC/GYRO Range（読み取り専用表示。INSOLE は setDeviceInformation 未対応）
    const ACC_RANGE = { 0: 2, 1: 4, 2: 8, 3: 16 };
    const GYRO_RANGE = { 0: 250, 1: 500, 2: 1000, 3: 2000 };
    const acc_el = document.querySelector(`#info_acc_range${no}`);
    const gyro_el = document.querySelector(`#info_gyro_range${no}`);
    const mount_el = document.querySelector(`#info_mount_position${no}`);
    if (acc_el) acc_el.innerText = ACC_RANGE[obj.range.acc] ?? obj.range.acc;
    if (gyro_el) gyro_el.innerText = GYRO_RANGE[obj.range.gyro] ?? obj.range.gyro;
    if (mount_el) {
        const isRight = (obj.mount_position & 0b1) === 1;
        const isInstep = (obj.mount_position & 0b10) === 0b10;
        mount_el.innerText = `${isRight ? 'RIGHT' : 'LEFT'} / ${isInstep ? 'instep(足背)' : 'plantar(足底)'}`;
    }

    // Streaming mode セレクタ
    const select = document.querySelector(`#select_streaming_mode${no}`);
    if (select && insoles[no].streaming_mode) {
        for (const opt of select.options) {
            opt.selected = (parseInt(opt.value) === insoles[no].streaming_mode);
        }
    }

    updateInsoleLRBadge(no);
}

/**
 * インソールの解析ログをリセットする関数
 * @param {number} id - インソールのID(0,1)
 */
function resetInsoleModule(id) {
    insoles[id].resetAnalysisLogs();
}

/**
 * バッテリー情報を更新する関数。device_informationの3段階に応じてアイコンを変更する
 * @param {Element} dom セレクタ
 */
async function updateInsoleBatteryInfo(dom) {
    let number = parseInt(dom.getAttribute('insole_id'));
    var obj = await insoles[number].getDeviceInformation();
    let str_battery_status;
    if (obj.battery == 0) str_battery_status = 'empty';
    else if (obj.battery == 1) str_battery_status = 'normal';
    else if (obj.battery == 2) str_battery_status = 'full';
    const el = document.querySelector(`#icon_battery${number}`);
    el.setAttribute('title', `${str_battery_status}`);

    if (obj.battery == 0) {
        el.innerHTML = '<i class="bi bi-battery"></i>';
        el.classList.add('text-warning');
    }
    else if (obj.battery == 1) {
        el.innerHTML = '<i class="bi bi-battery-half"></i>';
    }
    else if (obj.battery == 2) {
        el.innerHTML = '<i class="bi bi-battery-full"></i>';
    }
}

/**
 * InsoleToolkitのトグルボタンをオフに変更する
 * @param {number} id - (0,1)
 */
function setInsoleHeaderStatusOffline(id) {
    const el = document.querySelector(`#switch_ble${id}`);
    if (el) el.checked = false;
}

/**
 * InsoleToolkit.js内でUIを生成するのに利用するbuildElementのラッパー関数
 * @param {string} name_tag - タグ名
 * @param {string} innerHTML - タグ内のテキスト
 * @param {string} str_class - タグ内に適応するクラス
 * @param {string} str_style - タグ内に適応するスタイル
 * @param {Element} element_appended - 親要素
 *
 */
function ITbuildElement(name_tag, innerHTML, str_class, str_style, element_appended) {
    let element = document.createElement(name_tag);
    element.innerHTML = innerHTML;
    element.classList = str_class;
    if (str_style != '') {
        element.setAttribute('style', str_style);
    }
    element_appended.appendChild(element);
    return element;
}
