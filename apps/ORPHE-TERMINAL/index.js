var di_data_textarea_buffer = [];
var di_data_buffer = [];

var ar_data_textarea_buffer = [];
var ar_data_buffer = [];
var is_connected = false;
var is_playing = false;
window.onload = function () {

    // ORPHE CORE Init; bles[0] and bles[1] are used by CoreToolkit.js
    bles[0].setup(['DEVICE_INFORMATION', 'SENSOR_VALUES', 'STEP_ANALYSIS'], { is_raw_data_monitoring: true });
    buildCoreToolkit(document.querySelector('#toolkit_placeholder'), 'CORE', 0, 'SENSOR_VALUES');
    bles[0].onConnect = function () {
        is_connected = true;
        is_playing = true;
    }
    bles[0].onDisconnect = function () {
        is_connected = false;
        is_playing = false;
        alert('ORPHE COREとの接続が切れました');
    }
    bles[0].lostData = function (num, num_prev) {
        console.error("lostdata: " + num_prev + "<->" + num);
    }
    bles[0].gotData = function (data, uuid) {

        if (uuid == 'DEVICE_INFORMATION') {
            document.querySelector('#di_textarea_recv').innerHTML = '';
            for (let i = 0; i < data.byteLength; i++) {
                di_data_textarea_buffer.push(data.getUint8(i).toString(16).toUpperCase());
                di_data_buffer.push(data.getUint8(i).toString(16).toUpperCase());
            }
            di_data_textarea_buffer.push('\n');
            di_data_buffer.push('\n');
            while (di_data_textarea_buffer.length > 1024) { // 1KB
                di_data_textarea_buffer.shift();
            }
            while (di_data_buffer.length > 1024 * 1000 * 10) { //10MB
                di_data_buffer.shift();
            }
            let str = '';
            for (d of di_data_textarea_buffer) {
                if (d != '\n') {
                    str += `${d},`
                }
                else {
                    str += `${d}`
                }
            }
            document.querySelector('#di_textarea_recv').innerHTML = str;
            document.querySelector("#di_textarea_recv").scrollTop = document.querySelector("#di_textarea_recv").scrollHeight;

            document.querySelector('#di_textarea_buffer_size').innerHTML = di_data_textarea_buffer.length;
            document.querySelector('#di_buffer_size').innerHTML = di_data_buffer.length;
        }
        else {
            if (is_playing) {
                document.querySelector('#ar_textarea_recv').innerHTML = '';
                for (let i = 0; i < data.byteLength; i++) {
                    ar_data_textarea_buffer.push(data.getUint8(i).toString(16).toUpperCase());
                    ar_data_buffer.push(data.getUint8(i).toString(16).toUpperCase());
                }
                ar_data_textarea_buffer.push('\n');
                ar_data_buffer.push('\n');
                while (ar_data_textarea_buffer.length > 1024) {
                    ar_data_textarea_buffer.shift();
                }
                while (ar_data_buffer.length > 1024 * 1000 * 10) { // 10MB
                    ar_data_buffer.shift();
                }

                let str = '';
                for (d of ar_data_textarea_buffer) {
                    if (d != '\n') {
                        str += `${d},`
                    }
                    else {
                        str += `${d}`
                    }
                }

                document.querySelector('#ar_textarea_recv').innerHTML = str;
                document.querySelector("#ar_textarea_recv").scrollTop = document.querySelector("#ar_textarea_recv").scrollHeight;
                document.querySelector('#ar_textarea_buffer_size').innerHTML = ar_data_textarea_buffer.length;
                document.querySelector('#ar_buffer_size').innerHTML = ar_data_buffer.length;
            }
        }
    }

    document.querySelector('#send_message').addEventListener('keydown', function (e) {
        if (e.key == 'Enter') {
            send();
        }
    });

    // device informationのバッファやdom無いテキストのクリア
    document.querySelector('#button_di_clear').addEventListener('click', function () {
        di_data_buffer = [];
        di_data_textarea_buffer = [];
        document.querySelector('#di_textarea_recv').innerHTML = '';
        document.querySelector('#di_textarea_buffer_size').innerHTML = di_data_textarea_buffer.length;
        document.querySelector('#di_buffer_size').innerHTML = di_data_buffer.length;
    })

    // analysis/raw notify のバッファやdom内テキストのクリア
    document.querySelector('#button_ar_clear').addEventListener('click', function () {
        ar_data_buffer = [];
        ar_data_textarea_buffer = [];
        document.querySelector('#ar_textarea_recv').innerHTML = '';
        document.querySelector('#ar_textarea_buffer_size').innerHTML = ar_data_textarea_buffer.length;
        document.querySelector('#ar_buffer_size').innerHTML = ar_data_buffer.length;
    })

    // device informationのバッファをCSV形式でダウンロード
    document.querySelector('#button_di_download').addEventListener('click', function () {
        let str = '';
        for (d of di_data_buffer) {
            if (d != '\n') {
                str += `${d},`
            }
            else {
                str += `${d}`
            }
        }
        let blob = new Blob([str], { "type": "text/csv" });
        let a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.setAttribute('download', `device_information.csv`);
        a.click();
    });

    // analysis / raw notifyのバッファをCSV形式でダウンロード
    document.querySelector('#button_ar_download').addEventListener('click', function () {
        let str = '';
        for (d of ar_data_buffer) {
            if (d != '\n') {
                str += `${d},`
            }
            else {
                str += `${d}`
            }
        }
        let blob = new Blob([str], { "type": "text/csv" });
        let a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.setAttribute('download', `analysis_raw_notify.csv`);
        a.click();
    });

    document.querySelector('#button_ar_pause').addEventListener('click', function () {
        is_playing = !is_playing;
        if (is_playing) {
            this.innerHTML = 'pause';
        }
        else {
            this.innerHTML = 'play';
        }
    });
}

function send(dom) {
    if (is_connected == false) {
        alert('ORPHE COREに接続してください');
        return;
    }
    //0x02, 1, 0
    let message = document.querySelector('#send_message').value;
    let list = message.split(',');
    let commands = []
    for (let l of list) {
        commands.push(parseInt(l, 16));
    }
    console.log(commands);
    let senddata = new Uint8Array(commands);
    bles[0].write('DEVICE_INFORMATION', senddata);
}