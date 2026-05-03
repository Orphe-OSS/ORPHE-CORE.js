/* Replay Player — PoC (draft).
 *
 * Plays a recorded ORPHE CORE session through the same callback shapes the
 * SDK fires live, using CoreRecorder.fromJSON + replay (js/CoreRecorder.js).
 * Boots without hardware via window.SAMPLE_SESSION (sample-session.js).
 *
 * The optional CoreToolkit panel is included so guardCoreToolkitBluetooth
 * disables it cleanly on browsers without Web Bluetooth, but the primary UX
 * is replay.
 */

(function () {
    'use strict';

    var NOTIFICATION = 'STEP_ANALYSIS_AND_SENSOR_VALUES';
    var MAX_LOG_LINES = 60;

    var currentRecorder = null;
    var currentSource = 'none';
    var activePlayback = null;
    var counters = {};

    function $(id) { return document.getElementById(id); }

    function fmtNum(value, digits) {
        if (value == null || isNaN(value)) return '—';
        return Number(value).toFixed(digits != null ? digits : 0);
    }

    function renderCounters() {
        var body = $('counters-body');
        if (!body) return;
        var kinds = Object.keys(counters).sort();
        if (kinds.length === 0) {
            body.innerHTML = '<tr><td colspan="2" class="text-secondary text-center">No events yet.</td></tr>';
            return;
        }
        body.innerHTML = kinds.map(function (kind) {
            return '<tr><td><code>' + kind + '</code></td><td class="text-end">' + counters[kind] + '</td></tr>';
        }).join('');
    }

    function logEvent(kind, payload, timestampMs) {
        var log = $('event-log');
        if (!log) return;
        var line = '+' + (timestampMs / 1000).toFixed(3) + 's  ' + kind.padEnd(13) + ' ' + JSON.stringify(payload);
        var lines = log.textContent === 'Waiting for playback…' ? [] : log.textContent.split('\n');
        lines.push(line);
        if (lines.length > MAX_LOG_LINES) lines.splice(0, lines.length - MAX_LOG_LINES);
        log.textContent = lines.join('\n');
        log.scrollTop = log.scrollHeight;
    }

    function describeRecorder(recorder, label, schema) {
        $('source-label').textContent = label;
        $('source-count').textContent = recorder.size();
        $('source-duration').textContent = (recorder.durationMs() / 1000).toFixed(1) + ' s';
        $('source-schema').textContent = schema || (typeof CoreRecorder !== 'undefined' ? CoreRecorder.SCHEMA_VERSION : '—');
    }

    function setRecorder(recorder, sourceLabel, schema) {
        if (activePlayback) {
            activePlayback.stop();
            activePlayback = null;
        }
        currentRecorder = recorder;
        currentSource = sourceLabel;
        counters = {};
        renderCounters();
        $('event-log').textContent = 'Loaded ' + sourceLabel + '. Press Play.';
        describeRecorder(recorder, sourceLabel, schema);
        $('btn-play').disabled = recorder.size() === 0;
        $('btn-stop').disabled = true;
    }

    function makeHandler(kind) {
        return function (payload) {
            counters[kind] = (counters[kind] || 0) + 1;
            renderCounters();
            // Use the recorder's wall-clock-ish timestamp via a closure: each call
            // does not have direct access, so use Date.now relative to playback start.
            logEvent(kind, payload, Date.now() - activePlaybackStart);
        };
    }

    var activePlaybackStart = 0;

    function play() {
        if (!currentRecorder || currentRecorder.size() === 0) return;
        var speed = parseFloat($('playback-speed').value);
        counters = {};
        renderCounters();
        $('event-log').textContent = '';
        activePlaybackStart = Date.now();

        var handlers = {
            acc: makeHandler('acc'),
            gyro: makeHandler('gyro'),
            euler: makeHandler('euler'),
            quat: makeHandler('quat'),
            gait: makeHandler('gait'),
            stride: makeHandler('stride'),
            pronation: makeHandler('pronation'),
            landingImpact: makeHandler('landingImpact'),
            footAngle: makeHandler('footAngle'),
            stepsNumber: makeHandler('stepsNumber'),
        };

        activePlayback = currentRecorder.replay({ handlers: handlers, speed: speed });
        $('btn-play').disabled = true;
        $('btn-stop').disabled = false;

        // Schedule a "playback finished" hint a little after the predicted end.
        var predictedEndMs = speed > 0 ? (currentRecorder.durationMs() / speed) : 0;
        setTimeout(function () {
            if (activePlayback) {
                activePlayback = null;
                $('btn-play').disabled = false;
                $('btn-stop').disabled = true;
                logEvent('done', { source: currentSource, speed: speed }, predictedEndMs);
            }
        }, predictedEndMs + 50);
    }

    function stop() {
        if (activePlayback) {
            activePlayback.stop();
            activePlayback = null;
        }
        $('btn-play').disabled = !currentRecorder || currentRecorder.size() === 0;
        $('btn-stop').disabled = true;
    }

    function loadShippedSample() {
        if (typeof window.SAMPLE_SESSION === 'undefined') {
            console.warn('REPLAY-PLAYER: window.SAMPLE_SESSION is not defined. sample-session.js failed to load.');
            return;
        }
        var recorder = CoreRecorder.fromJSON(window.SAMPLE_SESSION);
        setRecorder(recorder, 'shipped sample (synthetic)', window.SAMPLE_SESSION.schema);
    }

    function loadJsonFile(file) {
        var reader = new FileReader();
        reader.onload = function (event) {
            try {
                var json = JSON.parse(event.target.result);
                var recorder = CoreRecorder.fromJSON(json);
                setRecorder(recorder, file.name, json.schema);
            } catch (error) {
                console.error('REPLAY-PLAYER: failed to parse JSON', error);
                $('event-log').textContent = 'Failed to load ' + file.name + ': ' + error.message;
            }
        };
        reader.readAsText(file);
    }

    function init() {
        // Optional CoreToolkit live panel; we still call the guard to satisfy the
        // static audit and to disable the switch in browsers without Web Bluetooth.
        if (typeof buildCoreToolkit === 'function') {
            buildCoreToolkit(
                $('toolkit_placeholder'),
                'Replay Player (live mirror)',
                0,
                NOTIFICATION
            );
            guardCoreToolkitBluetooth({ coreIds: [0], messageElement: '#ble-support-message' });
        }

        $('btn-load-sample').addEventListener('click', loadShippedSample);
        $('file-input').addEventListener('change', function (event) {
            var file = event.target.files && event.target.files[0];
            if (file) loadJsonFile(file);
        });
        $('btn-play').addEventListener('click', play);
        $('btn-stop').addEventListener('click', stop);
        $('playback-speed').addEventListener('input', function (event) {
            $('speed-label').textContent = event.target.value + '×';
        });

        // Auto-load the shipped sample so the page is meaningful at first paint.
        loadShippedSample();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
