/* CSV Recorder — PoC (draft).
 *
 * Wires CoreToolkit's bles[0] callbacks to the draft CoreRecorder (js/CoreRecorder.js).
 * Status: 0.0.1-draft. Not yet listed in examples/catalog.json.
 */

(function () {
    'use strict';

    var NOTIFICATION = 'STEP_ANALYSIS_AND_SENSOR_VALUES';
    var counters = {};
    var lastKind = '—';
    var stateTimer = null;

    function $(id) { return document.getElementById(id); }

    function setSchemaVersionLabel() {
        var label = $('schema-version');
        if (label && typeof CoreRecorder !== 'undefined') {
            label.textContent = CoreRecorder.SCHEMA_VERSION;
        }
    }

    function bumpCounter(kind) {
        counters[kind] = (counters[kind] || 0) + 1;
        lastKind = kind;
    }

    function renderCounters() {
        var body = $('counters-body');
        if (!body) return;
        var kinds = Object.keys(counters).sort();
        if (kinds.length === 0) {
            body.innerHTML = '<tr><td colspan="2" class="text-secondary text-center">No samples yet.</td></tr>';
            return;
        }
        body.innerHTML = kinds.map(function (kind) {
            return '<tr><td><code>' + kind + '</code></td><td class="text-end">' + counters[kind] + '</td></tr>';
        }).join('');
    }

    function updateState(recorder) {
        $('state-count').textContent = recorder.size();
        $('state-duration').textContent = (recorder.durationMs() / 1000).toFixed(1) + ' s';
        $('state-status').textContent = recorder.isRecording() ? 'recording' : (recorder.size() > 0 ? 'stopped' : 'idle');
        $('state-last').textContent = lastKind;
        renderCounters();
    }

    function downloadBlob(filename, mime, content) {
        var blob = new Blob([content], { type: mime });
        var url = URL.createObjectURL(blob);
        var a = Object.assign(document.createElement('a'), { href: url, download: filename });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function timestampSuffix() {
        var d = new Date();
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
            pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    }

    function init() {
        setSchemaVersionLabel();

        buildCoreToolkit(
            $('toolkit_placeholder'),
            'CSV Recorder',
            0,
            NOTIFICATION
        );
        guardCoreToolkitBluetooth({ coreIds: [0], messageElement: '#ble-support-message' });

        if (typeof bles === 'undefined' || !bles[0]) {
            console.warn('CSV-RECORDER: bles[0] is not available; CoreToolkit init failed.');
            return;
        }

        var ble = bles[0];
        ble.setup();

        var recorder = new CoreRecorder({ session: 'lesson-04' });

        // Wire ORPHE CORE callbacks → recorder feeds. We intentionally own these
        // callbacks because this PoC is a single-purpose page.
        ble.gotConvertedAcc = function (acc) { bumpCounter('acc'); recorder.feedAcc(acc); };
        ble.gotConvertedGyro = function (gyro) { bumpCounter('gyro'); recorder.feedGyro(gyro); };
        ble.gotEuler = function (euler) { bumpCounter('euler'); recorder.feedEuler(euler); };
        ble.gotQuat = function (quat) { bumpCounter('quat'); recorder.feedQuat(quat); };
        ble.gotGait = function (gait) { bumpCounter('gait'); recorder.feedGait(gait); };
        ble.gotStride = function (stride) { bumpCounter('stride'); recorder.feedStride(stride); };
        ble.gotPronation = function (pronation) { bumpCounter('pronation'); recorder.feedPronation(pronation); };
        ble.gotLandingImpact = function (impact) { bumpCounter('landingImpact'); recorder.feedLandingImpact(impact); };
        ble.gotFootAngle = function (footAngle) { bumpCounter('footAngle'); recorder.feedFootAngle(footAngle); };
        ble.gotStepsNumber = function (steps) { bumpCounter('stepsNumber'); recorder.feedStepsNumber(steps); };

        var btnStart = $('btn-start');
        var btnStop = $('btn-stop');
        var btnReset = $('btn-reset');
        var btnCsv = $('btn-download-csv');
        var btnJson = $('btn-download-json');
        var sessionLabel = $('session-label');
        var metaDevice = $('meta-device');

        function refreshButtons() {
            var hasSamples = recorder.size() > 0;
            btnStart.disabled = recorder.isRecording();
            btnStop.disabled = !recorder.isRecording();
            btnReset.disabled = recorder.isRecording() || !hasSamples;
            btnCsv.disabled = recorder.isRecording() || !hasSamples;
            btnJson.disabled = recorder.isRecording() || !hasSamples;
        }

        btnStart.addEventListener('click', function () {
            counters = {};
            lastKind = '—';
            recorder = new CoreRecorder({
                session: sessionLabel.value || 'session',
                meta: { device: metaDevice.value || 'unspecified', notification: NOTIFICATION },
            });
            // Re-bind feeds because we swapped the recorder instance.
            ble.gotConvertedAcc = function (acc) { bumpCounter('acc'); recorder.feedAcc(acc); };
            ble.gotConvertedGyro = function (gyro) { bumpCounter('gyro'); recorder.feedGyro(gyro); };
            ble.gotEuler = function (euler) { bumpCounter('euler'); recorder.feedEuler(euler); };
            ble.gotQuat = function (quat) { bumpCounter('quat'); recorder.feedQuat(quat); };
            ble.gotGait = function (gait) { bumpCounter('gait'); recorder.feedGait(gait); };
            ble.gotStride = function (stride) { bumpCounter('stride'); recorder.feedStride(stride); };
            ble.gotPronation = function (pronation) { bumpCounter('pronation'); recorder.feedPronation(pronation); };
            ble.gotLandingImpact = function (impact) { bumpCounter('landingImpact'); recorder.feedLandingImpact(impact); };
            ble.gotFootAngle = function (footAngle) { bumpCounter('footAngle'); recorder.feedFootAngle(footAngle); };
            ble.gotStepsNumber = function (steps) { bumpCounter('stepsNumber'); recorder.feedStepsNumber(steps); };

            recorder.start();
            refreshButtons();
        });

        btnStop.addEventListener('click', function () {
            recorder.stop();
            refreshButtons();
        });

        btnReset.addEventListener('click', function () {
            counters = {};
            lastKind = '—';
            recorder = new CoreRecorder({
                session: sessionLabel.value || 'session',
                meta: { device: metaDevice.value || 'unspecified', notification: NOTIFICATION },
            });
            updateState(recorder);
            refreshButtons();
        });

        btnCsv.addEventListener('click', function () {
            var name = (sessionLabel.value || 'session') + '-' + timestampSuffix() + '.csv';
            downloadBlob(name, 'text/csv', recorder.toCSV());
        });

        btnJson.addEventListener('click', function () {
            var name = (sessionLabel.value || 'session') + '-' + timestampSuffix() + '.json';
            downloadBlob(name, 'application/json', JSON.stringify(recorder.toJSON(), null, 2));
        });

        stateTimer = setInterval(function () {
            updateState(recorder);
            refreshButtons();
        }, 250);

        updateState(recorder);
        refreshButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
