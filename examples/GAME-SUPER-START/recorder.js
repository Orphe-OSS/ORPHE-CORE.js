// recorder.js — keeps the raw sensor data of every run.
//
// The thresholds and speed scales of these games were chosen before anyone's movement had been
// measured. Every run is therefore recorded as it is played: the raw acceleration and gyro
// samples as the SDK delivers them (about 200 Hz), the game state a few times a second and the
// events, with enough context (who ran, the settings, the build) to make sense of it later.
// A finished run is stored in this browser's IndexedDB, so nothing has to be remembered while
// playing; it can be downloaded as JSON afterwards, one run or all of them.
// Recording never gets in the way of the game: every storage error is swallowed.

const DB_NAME = 'super-virtual-sports';
const STORE = 'runs';
const MAX_SAMPLES = 150000;        // about 12 minutes at 200 Hz
const r = (v, digits) => { const m = 10 ** digits; return Math.round(v * m) / m; };

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(out && 'result' in out ? out.result : undefined); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  }));
}
function save(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = (iso) => iso.replace(/[:.]/g, '-');

/** app: a short name stored with every run and used in file names (e.g. 'super-relay'). */
export function createRecorder(app) {
  let cur = null, last = null;
  const listeners = [];
  const changed = () => { for (const fn of listeners) { try { fn(); } catch { /* ignore */ } } };
  const api = {
    get active() { return !!cur; },
    get last() { return last; },
    onChange(fn) { listeners.push(fn); },
    /** Start a run. meta: anything worth knowing later; frameColumns names the values passed to frame(). */
    begin(meta = {}, frameColumns = []) {
      cur = {
        app, startedAt: new Date().toISOString(), t0: performance.now(), meta,
        // times are ms from the start of the recording, on the page clock; samples are dated when measured
        sampleColumns: ['t_ms', 'ax_G', 'ay_G', 'az_G', 'gx_dps', 'gy_dps', 'gz_dps'],
        // every frame row starts with its time, so the column list does too (files saved before
        // 2026-11-17 14:00 lack this first name: their rows have one value more than their columns)
        samples: [], frameColumns: frameColumns.length ? ['t_ms', ...frameColumns] : [], frames: [], events: [], truncated: false,
      };
    },
    /** One sensor sample, as delivered: acc {x,y,z} in G, gyro {x,y,z} in deg/s, t on the page clock. */
    sample(t, acc, gyro) {
      if (!cur || !acc || !gyro) return;
      if (cur.samples.length >= MAX_SAMPLES) { cur.truncated = true; return; }
      cur.samples.push([r(t - cur.t0, 1), r(acc.x, 4), r(acc.y, 4), r(acc.z, 4), r(gyro.x, 2), r(gyro.y, 2), r(gyro.z, 2)]);
    },
    /** One row of game state (values in the order of frameColumns; the time is added in front). */
    frame(t, values) { if (cur && cur.frames.length < MAX_SAMPLES) cur.frames.push([r(t - cur.t0, 1), ...values]); },
    event(t, type, data = {}) { if (cur) cur.events.push({ t_ms: r(t - cur.t0, 1), type, ...data }); },
    /** Throw the current run away (it never started properly). */
    cancel() { cur = null; },
    /** Finish the run and store it. Resolves with the run (also when storing failed). */
    async end(result = {}) {
      if (!cur) return null;
      const run = cur;
      cur = null;
      run.endedAt = new Date().toISOString();
      run.result = result;
      delete run.t0;
      last = run;
      try { run.id = await tx('readwrite', (s) => s.add(run)); } catch (error) { console.warn('[recorder] could not store the run:', error); }
      changed();
      return run;
    },
    async count() { try { return (await tx('readonly', (s) => s.count())) || 0; } catch { return 0; } },
    async all() { try { return (await tx('readonly', (s) => s.getAll())) || []; } catch { return []; } },
    async clear() { try { await tx('readwrite', (s) => s.clear()); } catch { /* ignore */ } last = null; changed(); },
    /** Download one run (the last by default) as JSON. Returns false when there is nothing to save. */
    download(run = last) {
      if (!run) return false;
      save(`${run.app}-${stamp(run.startedAt)}.json`, run);
      return true;
    },
    /** Download every stored run of every game in one file. */
    async downloadAll() {
      const runs = await api.all();
      if (!runs.length) return false;
      save(`super-virtual-sports-${stamp(new Date().toISOString())}-${runs.length}runs.json`, { exportedAt: new Date().toISOString(), runs });
      return true;
    },
  };
  return api;
}
