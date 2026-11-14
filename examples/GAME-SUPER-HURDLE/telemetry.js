// telemetry.js — sensor taps, per-race sensor statistics and the optional raw-data recorder.
//
// The taps chain onto the ORPHE CORE callbacks without replacing what the game
// already installed: every tap records first, then calls the previous handler,
// and a failure inside the recorder can never reach the game's input path.
//
// Two things come out of this module:
//   1. sensorStats(): light per-device statistics for the race in progress
//      (always on; used by the post-race analysis).
//   2. A recording session with every raw value (only while the "record"
//      toggle is on), kept in IndexedDB so a page reload does not lose it,
//      and exportable as JSON or CSV.

const DB_NAME = 'hurdle-telemetry';
const STORE = 'sessions';
const FORMAT = 'orphe-hurdle-session/1';
const round = (v, d) => (Number.isFinite(v) ? +v.toFixed(d) : null);
const STEP_REFRACTORY_MS = 350;   // one foot is counted at most once in this long
const CONTACT_MIN_LOAD = 150;     // INSOLE pressure: ADC counts above rest before the foot counts as down...
const CONTACT_PEAK_SHARE = 0.12;  // ...or this share of the runner's own peak load, whichever is larger

// Columns of every stream in a recorded session. `t` is milliseconds since the
// recording started (performance.now based); `dev` is the CORE id, `p` the runner index.
// ts_ms / serial / pkt are the SDK's own per-sample timestamp, packet serial number and
// position inside the packet, when it provides them (several samples share one `t`).
const STREAMS = {
  acc: ['t', 'dev', 'x_g', 'y_g', 'z_g', 'ts_ms', 'serial', 'pkt'],
  gyro: ['t', 'dev', 'x_dps', 'y_dps', 'z_dps', 'ts_ms', 'serial', 'pkt'],
  quat: ['t', 'dev', 'w', 'x', 'y', 'z', 'ts_ms', 'serial', 'pkt'],
  euler: ['t', 'dev', 'pitch_rad', 'roll_rad', 'yaw_rad'],
  gait: ['t', 'dev', 'type', 'direction', 'calorie', 'distance', 'steps', 'standing_s', 'swing_s'],
  stride: ['t', 'dev', 'x', 'y', 'z', 'steps'],
  pronation: ['t', 'dev', 'x', 'y', 'z'],
  impact: ['t', 'dev', 'value'],
  footAngle: ['t', 'dev', 'value'],
  press: ['t', 'dev', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'ts_ms', 'serial', 'pkt'],   // ORPHE INSOLE only
  steps: ['t', 'dev', 'value'],
  lost: ['t', 'dev', 'serial', 'serial_prev'],
  packets: ['t', 'dev', 'uuid', 'hex'],
  frames: ['t', 'p', 'dist_m', 'lift_m', 'speed_mps', 'stamina', 'exhausted', 'grounded', 'accel_key', 'accel_sensor', 'place'],
  events: ['t', 'p', 'type', 'data'],
};

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbRun(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** One tidy CSV: a row per value, the stream name in the second column. */
export function sessionToCsv(session) {
  const width = Math.max(...Object.values(STREAMS).map((c) => c.length)) - 1;
  const esc = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [`# ${FORMAT} id=${session.id} started=${session.startedAt}`, ['t_ms', 'stream', ...Array.from({ length: width }, (_, i) => `v${i + 1}`)].join(',')];
  const rows = [];
  for (const [name, cols] of Object.entries(STREAMS)) {
    lines.push(`# ${name}: ${cols.join(', ')}`);
    for (const r of session.streams[name] || []) rows.push([r[0], name, ...r.slice(1)]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  for (const r of rows) lines.push(r.map(esc).join(','));
  return lines.join('\n');
}

export function createTelemetry() {
  let recording = false;
  try { recording = localStorage.getItem('hurdle.record') === '1'; } catch { /* storage unavailable */ }
  let session = null;        // raw recording in progress
  let t0 = 0;                // performance.now() when the recording started
  let lastSaved = null;      // most recent finished session (kept in memory for instant export)
  let stats = null;          // per-device race statistics, { 0: {...}, 1: {...} }
  let statsStart = 0;
  let pitchOf = (dev, e) => e.pitch;   // INSOLE replaces this with its toe-up mapping
  const pressBase = { 0: null, 1: null };   // INSOLE: resting level of each pressure channel, per device
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });

  const now = () => performance.now();
  const push = (stream, row) => { if (session) session.streams[stream].push(row); };
  const rel = () => round(now() - t0, 1);
  const src = (v) => [v.timestamp ?? null, v.serial_number ?? null, v.packet_number ?? null];
  const hex = (view) => {
    let s = '';
    for (let i = 0; i < view.byteLength; i++) s += view.getUint8(i).toString(16).padStart(2, '0');
    return s;
  };

  function newStats() {
    return {
      accN: 0, eulerN: 0, packets: 0, lost: 0, first: 0, last: 0,
      steps: 0, lastStepAt: 0, above: false, peak: 0, peaks: [], maxG: 0, sumG: 0,
      loadPeak: 0, contact: false, contactAt: 0, contacts: [],
      toeUp: false, toeMin: 0, toeMins: [],
    };
  }

  // ---------------------------------------------------------------- taps
  /** Chain a recorder in front of ble[name]; the original handler always runs. */
  function tap(ble, name, record) {
    const prev = ble[name];
    ble[name] = function (...args) {
      try { record(this.id, ...args); } catch (e) { tapError(e); }
      if (typeof prev === 'function') return prev.apply(this, args);
      return undefined;
    };
  }
  let tapErrors = 0;
  function tapError(e) { if (tapErrors++ < 3) console.warn('[HURDLE] telemetry tap failed (input is unaffected):', e); }

  function attach(bles) {
    if (!Array.isArray(bles)) return;
    for (const ble of bles) {
      if (!ble || ble.__hurdleTapped) continue;
      ble.__hurdleTapped = true;
      // Raw packets are taken at onRead, NOT gotData: the SDK treats an overridden gotData as
      // "raw monitor mode" and stops calling every parsed callback (gotConvertedAcc, gotEuler, ...).
      tap(ble, 'onRead', (dev, data, uuid) => {
        if (stats?.[dev]) stats[dev].packets++;
        if (session && data && data.byteLength !== undefined) push('packets', [rel(), dev, typeof uuid === 'string' ? uuid : '', hex(data)]);
      });
      tap(ble, 'gotConvertedAcc', (dev, a) => {
        const t = now();
        const s = stats?.[dev];
        if (s) {
          const mag = Math.hypot(a.x, a.y, a.z);
          if (!s.accN) s.first = t;
          s.accN++; s.last = t; s.sumG += mag; if (mag > s.maxG) s.maxG = mag;
          // a "step" = the acceleration magnitude rising through the game's accelerate threshold
          const th = window.accThresholdAccel ?? 1.1;
          if (mag > th) {
            // One strike per foot per STEP_REFRACTORY_MS. With 200 ms the landing and the push-off of the
            // same step were often counted twice: 29-34 "steps" per foot against 20-25 ground contacts
            // on the INSOLE pressure sensors in recorded races. 350 ms brings the two in line.
            if (!s.above && t - s.lastStepAt > STEP_REFRACTORY_MS) { s.steps++; s.lastStepAt = t; s.peak = 0; }
            s.above = true;
            if (mag > s.peak) s.peak = mag;
          } else if (s.above) {
            s.above = false;
            if (s.peak > 0) s.peaks.push(s.peak);
          }
        }
        if (session) push('acc', [round(t - t0, 1), dev, round(a.x, 4), round(a.y, 4), round(a.z, 4), ...src(a)]);
      });
      tap(ble, 'gotEuler', (dev, e) => {
        const s = stats?.[dev];
        if (s) {
          s.eulerN++;
          // toe-up episodes: how far below the jump threshold the pitch goes
          const th = -(window.pitchThresholdJump ?? 0.15);
          const pitch = pitchOf(dev, e);
          if (pitch < th) { if (!s.toeUp) { s.toeUp = true; s.toeMin = pitch; } else if (pitch < s.toeMin) s.toeMin = pitch; }
          else if (s.toeUp) { s.toeUp = false; s.toeMins.push(s.toeMin); }
        }
        if (session) push('euler', [rel(), dev, round(e.pitch, 4), round(e.roll, 4), round(e.yaw, 4)]);
      });
      tap(ble, 'gotConvertedGyro', (dev, g) => { if (session) push('gyro', [rel(), dev, round(g.x, 2), round(g.y, 2), round(g.z, 2), ...src(g)]); });
      tap(ble, 'gotQuat', (dev, q) => { if (session) push('quat', [rel(), dev, round(q.w, 5), round(q.x, 5), round(q.y, 5), round(q.z, 5), ...src(q)]); });
      tap(ble, 'gotGait', (dev, g) => { if (session) push('gait', [rel(), dev, g.type, g.direction, round(g.calorie, 3), round(g.distance, 3), g.steps, round(g.standing_phase_duration, 4), round(g.swing_phase_duration, 4)]); });
      tap(ble, 'gotStride', (dev, s) => { if (session) push('stride', [rel(), dev, round(s.x, 4), round(s.y, 4), round(s.z, 4), s.steps_number ?? s.steps ?? null]); });
      tap(ble, 'gotPronation', (dev, p) => { if (session) push('pronation', [rel(), dev, round(p.x, 4), round(p.y, 4), round(p.z, 4)]); });
      tap(ble, 'gotLandingImpact', (dev, v) => { if (session) push('impact', [rel(), dev, round(v.value, 4)]); });
      tap(ble, 'gotFootAngle', (dev, v) => { if (session) push('footAngle', [rel(), dev, round(v.value, 4)]); });
      tap(ble, 'gotPress', (dev, p) => {
        if (p.values) trackContact(dev, p.values, now());
        if (session) push('press', [rel(), dev, ...Array.from({ length: 6 }, (_, i) => p.values?.[i] ?? null), ...src(p)]);
      });
      tap(ble, 'gotStepsNumber', (dev, v) => { if (session) push('steps', [rel(), dev, v.value]); });
      tap(ble, 'lostData', (dev, serial, prev) => {
        if (stats?.[dev]) stats[dev].lost++;
        if (session) push('lost', [rel(), dev, serial, prev]);
      });
    }
  }

  /**
   * INSOLE ground contact. Load = how far the six pressure channels sit above their resting level
   * (the lowest reading each has shown in this race, so no calibration step is needed); the
   * foot is down while the load is above a threshold that follows the runner's own peak. Uses the
   * sum of all channels only, so it does not depend on which channel sits under which part of the foot.
   */
  function trackContact(dev, values, t) {
    const base = pressBase[dev] || (pressBase[dev] = new Array(6).fill(Infinity));
    let load = 0;
    for (let i = 0; i < 6; i++) {
      const x = values[i];
      if (!(x > 0)) continue;                 // missing reading
      if (x < base[i]) base[i] = x;
      load += x - base[i];
    }
    const s = stats?.[dev];
    if (!s) return;
    if (load > s.loadPeak) s.loadPeak = load;
    const down = Math.max(CONTACT_MIN_LOAD, CONTACT_PEAK_SHARE * s.loadPeak);
    if (!s.contact && load > down) { s.contact = true; s.contactAt = t; }
    else if (s.contact && load < down * 0.6) {
      s.contact = false;
      const ms = t - s.contactAt;
      if (ms >= 40 && ms <= 1500) s.contacts.push(ms);   // shorter is noise, longer is standing still
    }
  }

  // ---------------------------------------------------------------- race statistics (always on)
  function beginStats() {
    stats = { 0: newStats(), 1: newStats() };
    statsStart = now();
    pressBase[0] = pressBase[1] = null;   // resting levels are relearned each race (another runner, a shifted insole)
  }
  /**
   * Statistics for the given CORE ids since beginStats(). `oneFoot` says the runner wears a single
   * CORE (VS), so the step count covers one foot only.
   */
  function sensorStats(devices, seconds, oneFoot) {
    if (!stats) return null;
    const list = devices.map((d) => stats[d]).filter((s) => s && s.accN > 0);
    if (!list.length) return null;
    const steps = list.reduce((a, s) => a + s.steps, 0);
    const peaks = list.flatMap((s) => s.peaks);
    const toe = list.flatMap((s) => s.toeMins);
    const contacts = list.flatMap((s) => s.contacts).sort((a, b) => a - b);
    const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const hz = list.map((s) => (s.last > s.first ? ((s.accN - 1) / (s.last - s.first)) * 1000 : 0));
    const perFoot = devices.map((d) => stats[d]?.steps ?? 0);
    return {
      devices: list.length,
      steps,
      cadence: seconds > 0 ? ((oneFoot ? steps * 2 : steps) / seconds) * 60 : null,   // steps per minute, both feet
      oneFoot: !!oneFoot,
      balance: !oneFoot && devices.length === 2 && steps > 0 ? perFoot[0] / steps : null, // share of steps on CORE 0
      meanPeakG: mean(peaks),
      maxG: Math.max(...list.map((s) => s.maxG)),
      meanG: list.reduce((a, s) => a + s.sumG, 0) / list.reduce((a, s) => a + s.accN, 0),
      toeUpDeg: toe.length ? (-mean(toe) * 180) / Math.PI : null,
      toeUps: toe.length,
      // INSOLE only: median ground contact time from the pressure sensors
      contactMs: contacts.length >= 4 ? Math.round(contacts[contacts.length >> 1]) : null,
      contacts: contacts.length,
      sampleHz: mean(hz),
      packets: list.reduce((a, s) => a + s.packets, 0),
      lost: list.reduce((a, s) => a + s.lost, 0),
      seconds: (now() - statsStart) / 1000,
    };
  }

  // ---------------------------------------------------------------- raw recording
  function start(meta) {
    session = null;
    if (!recording) return;
    t0 = now();
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
    session = {
      format: FORMAT,
      id: `${stamp}-${Math.random().toString(36).slice(2, 6)}`,
      startedAt: d.toISOString(),
      complete: false,
      meta,
      columns: STREAMS,
      streams: Object.fromEntries(Object.keys(STREAMS).map((k) => [k, []])),
      result: null,
    };
    notify();
  }
  function event(player, type, data) { if (session) push('events', [rel(), player, type, data ?? null]); }
  function frame(row) { if (session) push('frames', [rel(), ...row]); }
  /** Close the recording (complete = the race finished) and store it. */
  async function stop(complete, result) {
    const s = session;
    session = null;
    if (!s) return null;
    s.complete = complete;
    s.result = result ?? null;
    s.durationMs = rel();
    lastSaved = s;
    notify();
    try { await dbRun('readwrite', (store) => store.put(s)); } catch (e) { console.warn('[HURDLE] could not store the recording in IndexedDB (it can still be downloaded now):', e); }
    notify();
    return s;
  }

  async function count() { try { return await dbRun('readonly', (store) => store.count()); } catch { return lastSaved ? 1 : 0; } }
  async function all() { try { return await dbRun('readonly', (store) => store.getAll()); } catch { return lastSaved ? [lastSaved] : []; } }
  async function clear() { lastSaved = null; try { await dbRun('readwrite', (store) => store.clear()); } catch { /* ignore */ } notify(); }

  return {
    attach, beginStats, sensorStats, start, stop, event, frame, count, clear,
    setPitchMapper(fn) { pitchOf = fn; },
    get recording() { return recording; },
    get active() { return !!session; },
    get last() { return lastSaved; },
    setRecording(on) {
      recording = !!on;
      try { localStorage.setItem('hurdle.record', recording ? '1' : '0'); } catch { /* ignore */ }
      notify();
    },
    onChange(fn) { listeners.add(fn); },
    exportJson(s = lastSaved) { if (s) download(`hurdle-${s.id}.json`, JSON.stringify(s), 'application/json'); },
    exportCsv(s = lastSaved) { if (s) download(`hurdle-${s.id}.csv`, sessionToCsv(s), 'text/csv'); },
    async exportAll() {
      const sessions = await all();
      if (sessions.length) download(`hurdle-sessions-${sessions.length}.json`, JSON.stringify({ format: `${FORMAT}+list`, exportedAt: new Date().toISOString(), sessions }), 'application/json');
      return sessions.length;
    },
  };
}
