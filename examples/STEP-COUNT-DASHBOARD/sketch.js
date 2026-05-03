/* Step Count Dashboard — PoC (draft).
 *
 * Wires CoreToolkit's bles[0] callbacks to the draft CoreAnalytics
 * (js/CoreAnalytics.js) and renders steps / cadence / stride / CMJ /
 * baseline-comparison panels.
 */

(function () {
    'use strict';

    var NOTIFICATION = 'STEP_ANALYSIS_AND_SENSOR_VALUES';
    var refreshTimer = null;

    function $(id) { return document.getElementById(id); }

    function fmtNum(value, digits) {
        if (value == null || isNaN(value)) return '—';
        return Number(value).toFixed(digits != null ? digits : 0);
    }

    function fmtSigned(value, digits) {
        if (value == null || isNaN(value)) return '—';
        var formatted = Number(value).toFixed(digits != null ? digits : 2);
        return Number(value) > 0 ? '+' + formatted : formatted;
    }

    function init() {
        buildCoreToolkit(
            $('toolkit_placeholder'),
            'Step Dashboard',
            0,
            NOTIFICATION
        );
        guardCoreToolkitBluetooth({ coreIds: [0], messageElement: '#ble-support-message' });

        if (typeof bles === 'undefined' || !bles[0]) {
            console.warn('STEP-COUNT-DASHBOARD: bles[0] is not available; CoreToolkit init failed.');
            return;
        }

        var ble = bles[0];
        ble.setup();

        var analytics = new CoreAnalytics();

        ble.gotConvertedAcc = function (acc) { analytics.feedAcc(acc); };
        ble.gotGait = function (gait) { analytics.feedGait(gait); };
        ble.gotStride = function (stride) { analytics.feedStride(stride); };
        ble.gotPronation = function (pronation) { analytics.feedPronation(pronation); };
        ble.gotStepsNumber = function (steps) { analytics.feedStepsNumber(steps); };
        ble.gotLandingImpact = function (impact) { analytics.feedLandingImpact(impact); };

        var btnStart = $('btn-start');
        var btnEnd = $('btn-end');
        var btnReset = $('btn-reset');
        var btnCaptureBaseline = $('btn-capture-baseline');
        var btnClearBaseline = $('btn-clear-baseline');
        var sessionLabel = $('session-label');

        var sessionActive = false;

        function refreshButtons() {
            var hasBaseline = analytics.getBaseline() != null;
            var hasSummary = analytics.getSessionSummary() != null;
            btnStart.disabled = sessionActive;
            btnEnd.disabled = !sessionActive;
            btnReset.disabled = sessionActive;
            btnCaptureBaseline.disabled = !hasSummary;
            btnClearBaseline.disabled = !hasBaseline;
        }

        function renderMetrics() {
            var summary = analytics.getSessionSummary();
            var cadence = analytics.getRollingCadence(10);
            var stride = analytics.getStrideStats(20);
            var cmj = analytics.getLastCMJ();

            $('metric-steps').textContent = summary ? summary.steps : analytics.getStepsAccumulated().steps;
            $('metric-cadence').textContent = fmtNum(cadence, 0);
            $('metric-stride').textContent = stride ? fmtNum(stride.meanMeters, 2) : '0.00';
            $('session-duration').textContent = (summary ? (summary.durationSec).toFixed(1) : '0.0') + ' s';
            $('cmj-flight').textContent = cmj ? fmtNum(cmj.flightSec, 3) + ' s' : '—';
            $('cmj-height').textContent = cmj ? fmtNum(cmj.heightMeters * 100, 1) + ' cm' : '—';

            var compare = analytics.compareToBaseline();
            var body = $('baseline-compare-body');
            if (!compare) {
                body.innerHTML = '<tr><td colspan="4" class="text-secondary text-center">No baseline captured yet.</td></tr>';
            } else {
                var rows = [
                    {
                        label: 'Steps',
                        baseline: compare.baseline.steps,
                        current: compare.current.steps,
                        delta: compare.delta.steps,
                        digits: 0,
                    },
                    {
                        label: 'Cadence (steps/min)',
                        baseline: compare.baseline.cadenceStepsPerMin,
                        current: compare.current.cadenceStepsPerMin,
                        delta: compare.delta.cadenceStepsPerMin,
                        digits: 1,
                    },
                    {
                        label: 'Stride mean (m)',
                        baseline: compare.baseline.stride && compare.baseline.stride.meanMeters,
                        current: compare.current.stride && compare.current.stride.meanMeters,
                        delta: compare.delta.strideMeanMeters,
                        digits: 2,
                    },
                    {
                        label: 'Acc max (G)',
                        baseline: compare.baseline.acc && compare.baseline.acc.maxG,
                        current: compare.current.acc && compare.current.acc.maxG,
                        delta: compare.delta.accMaxG,
                        digits: 2,
                    },
                ];
                body.innerHTML = rows.map(function (row) {
                    return '<tr>' +
                        '<td>' + row.label + '</td>' +
                        '<td class="text-end">' + fmtNum(row.baseline, row.digits) + '</td>' +
                        '<td class="text-end">' + fmtNum(row.current, row.digits) + '</td>' +
                        '<td class="text-end">' + fmtSigned(row.delta, row.digits) + '</td>' +
                        '</tr>';
                }).join('');
            }
        }

        btnStart.addEventListener('click', function () {
            analytics.startSession(sessionLabel.value || 'session');
            sessionActive = true;
            refreshButtons();
            renderMetrics();
        });

        btnEnd.addEventListener('click', function () {
            analytics.endSession();
            sessionActive = false;
            refreshButtons();
            renderMetrics();
        });

        btnReset.addEventListener('click', function () {
            analytics.reset();
            sessionActive = false;
            $('baseline-label').textContent = '—';
            refreshButtons();
            renderMetrics();
        });

        btnCaptureBaseline.addEventListener('click', function () {
            var baseline = analytics.captureBaseline();
            $('baseline-label').textContent = baseline ? (baseline.label + ' · ' + baseline.steps + ' steps') : '—';
            refreshButtons();
            renderMetrics();
        });

        btnClearBaseline.addEventListener('click', function () {
            analytics.setBaseline(null);
            $('baseline-label').textContent = '—';
            refreshButtons();
            renderMetrics();
        });

        refreshTimer = setInterval(function () {
            renderMetrics();
            refreshButtons();
        }, 250);

        renderMetrics();
        refreshButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
