/* Foot Angle Dashboard — PoC (draft).
 *
 * Reads ORPHE CORE callbacks directly (no analytics or recorder helper).
 * Bins each landing into fore / mid / heel using configurable thresholds.
 */

(function () {
    'use strict';

    var NOTIFICATION = 'STEP_ANALYSIS_AND_SENSOR_VALUES';
    var JOIN_WINDOW_MS = 100;
    var MAX_RECENT_ROWS = 12;

    var thresholds = { fore: 5, mid: 15 };
    var bins = { fore: { count: 0, sumAngle: 0, lastAngle: null },
                 mid:  { count: 0, sumAngle: 0, lastAngle: null },
                 heel: { count: 0, sumAngle: 0, lastAngle: null } };
    var recent = [];
    var pendingLanding = null;

    function $(id) { return document.getElementById(id); }

    function fmtNum(value, digits) {
        if (value == null || isNaN(value)) return '—';
        return Number(value).toFixed(digits != null ? digits : 0);
    }

    function binFor(angle) {
        if (typeof angle !== 'number' || isNaN(angle)) return 'mid';
        if (angle < thresholds.fore) return 'fore';
        if (angle < thresholds.mid) return 'mid';
        return 'heel';
    }

    function commitLanding(landing) {
        if (!landing || typeof landing.angle !== 'number') return;
        var bin = binFor(landing.angle);
        bins[bin].count += 1;
        bins[bin].sumAngle += landing.angle;
        bins[bin].lastAngle = landing.angle;
        landing.bin = bin;
        recent.unshift(landing);
        if (recent.length > MAX_RECENT_ROWS) recent.length = MAX_RECENT_ROWS;
        renderBins();
        renderRecent();
        renderMetrics(landing);
    }

    function maybeFlushPending(now) {
        if (pendingLanding && (now - pendingLanding.t) >= JOIN_WINDOW_MS) {
            commitLanding(pendingLanding);
            pendingLanding = null;
        }
    }

    function attachToPending(now, patch) {
        maybeFlushPending(now);
        if (!pendingLanding) {
            pendingLanding = { t: now };
        }
        Object.assign(pendingLanding, patch);
    }

    function renderMetrics(landing) {
        $('metric-angle').textContent = landing && landing.angle != null ? fmtNum(landing.angle, 1) : '—';
        $('metric-impact').textContent = landing && landing.impact != null ? fmtNum(landing.impact, 2) : '—';
        $('metric-pronation').textContent = landing && landing.pronationMagnitude != null ? fmtNum(landing.pronationMagnitude, 2) : '—';
    }

    function renderBins() {
        var body = $('bin-body');
        var entries = ['fore', 'mid', 'heel'];
        var total = entries.reduce(function (sum, bin) { return sum + bins[bin].count; }, 0);
        if (total === 0) {
            body.innerHTML = '<tr><td colspan="4" class="text-secondary text-center">No landings yet.</td></tr>';
            return;
        }
        body.innerHTML = entries.map(function (bin) {
            var record = bins[bin];
            var mean = record.count > 0 ? (record.sumAngle / record.count) : null;
            return '<tr>' +
                '<td><code>' + bin + '</code></td>' +
                '<td class="text-end">' + record.count + '</td>' +
                '<td class="text-end">' + fmtNum(record.lastAngle, 1) + '</td>' +
                '<td class="text-end">' + fmtNum(mean, 1) + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderRecent() {
        var body = $('recent-body');
        if (recent.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="text-secondary text-center">Walk to populate.</td></tr>';
            return;
        }
        body.innerHTML = recent.map(function (landing, index) {
            return '<tr>' +
                '<td>' + (index + 1) + '</td>' +
                '<td class="text-end">' + fmtNum(landing.angle, 1) + '</td>' +
                '<td class="text-end">' + fmtNum(landing.impact, 2) + '</td>' +
                '<td class="text-end">' + fmtNum(landing.pronationMagnitude, 2) + '</td>' +
                '<td><code>' + landing.bin + '</code></td>' +
                '</tr>';
        }).join('');
    }

    function init() {
        buildCoreToolkit(
            $('toolkit_placeholder'),
            'Foot Angle Dashboard',
            0,
            NOTIFICATION
        );
        guardCoreToolkitBluetooth({ coreIds: [0], messageElement: '#ble-support-message' });

        if (typeof bles === 'undefined' || !bles[0]) {
            console.warn('FOOT-ANGLE-DASHBOARD: bles[0] is not available; CoreToolkit init failed.');
            return;
        }

        var ble = bles[0];
        ble.setup();

        ble.gotFootAngle = function (fa) {
            attachToPending(performance.now(), { angle: fa && typeof fa.value === 'number' ? fa.value : null });
        };
        ble.gotLandingImpact = function (li) {
            attachToPending(performance.now(), { impact: li && typeof li.value === 'number' ? li.value : null });
        };
        ble.gotPronation = function (p) {
            var magnitude = p ? Math.hypot(p.x || 0, p.y || 0, p.z || 0) : null;
            attachToPending(performance.now(), { pronationMagnitude: magnitude });
        };

        var foreInput = $('threshold-fore');
        var midInput = $('threshold-mid');
        function syncThresholds() {
            var fore = Number(foreInput.value);
            var mid = Number(midInput.value);
            if (!isNaN(fore)) thresholds.fore = fore;
            if (!isNaN(mid)) thresholds.mid = mid;
            $('threshold-fore-label').textContent = thresholds.fore;
            $('threshold-mid-label').textContent = thresholds.mid;
            // Re-bin existing recent rows so the table reflects the new thresholds.
            recent.forEach(function (landing) { landing.bin = binFor(landing.angle); });
            // Recompute bin counts from the recent buffer only (best-effort: counts
            // older than MAX_RECENT_ROWS are not retained).
            bins = { fore: { count: 0, sumAngle: 0, lastAngle: null },
                     mid:  { count: 0, sumAngle: 0, lastAngle: null },
                     heel: { count: 0, sumAngle: 0, lastAngle: null } };
            recent.forEach(function (landing) {
                if (typeof landing.angle === 'number') {
                    bins[landing.bin].count += 1;
                    bins[landing.bin].sumAngle += landing.angle;
                    bins[landing.bin].lastAngle = landing.angle;
                }
            });
            renderBins();
            renderRecent();
        }
        foreInput.addEventListener('change', syncThresholds);
        midInput.addEventListener('change', syncThresholds);

        $('btn-reset-bins').addEventListener('click', function () {
            bins = { fore: { count: 0, sumAngle: 0, lastAngle: null },
                     mid:  { count: 0, sumAngle: 0, lastAngle: null },
                     heel: { count: 0, sumAngle: 0, lastAngle: null } };
            recent = [];
            renderBins();
            renderRecent();
            renderMetrics(null);
        });

        // 50 ms tick to flush pending landing rows when the join window expires.
        setInterval(function () { maybeFlushPending(performance.now()); }, 50);

        renderBins();
        renderRecent();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
