// insole.js — play with ORPHE INSOLE instead of ORPHE CORE.
//
// ORPHE INSOLE sits under the foot and has the same IMU callbacks as CORE
// (gotConvertedAcc, gotEuler) plus six pressure channels. This module makes it
// drive the game exactly the way the CORE sensor script in index.html does:
// same thresholds, same cooldowns, same window.devices / window.gameJump() /
// window.setAccelPressed() surface. The CORE script itself is not touched.
//
// The INSOLE SDK and its toolkit are fetched only when INSOLE is selected in the
// connection dock (the page reloads to switch), so with ORPHE CORE selected the
// page loads exactly the same scripts as before.
//
// One real difference: the sensor frames. INSOLE is X = right, Y = toe, Z = up,
// so lifting the toes is a rotation about X, which the shared quaternion library
// reports as `roll` (CORE reports it as a negative `pitch`). The adapter turns
// it into the CORE convention: toe up = negative pitch.

/** 'core' | 'insole': the stored choice, or ?device=insole / ?device=core for a one-off. */
export const DEVICE = (() => {
  let device = 'core';
  try { if (localStorage.getItem('hurdle.device') === 'insole') device = 'insole'; } catch { /* storage unavailable */ }
  const m = /[?&]device=(core|insole)\b/.exec(window.location.search);
  return m ? m[1] : device;
})();

const SDK_BASE = 'https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-INSOLE.js@v1.4.0/src/';
const wantsSimulator = () => /[?&]insoleSim=1\b/.test(window.location.search);

/**
 * Load ORPHE-INSOLE.js and InsoleToolkit.js (pinned release), in order. They are written to share a
 * page with ORPHE-CORE.js: the SDK keeps `Orphe` pointing at CORE and exposes `OrpheInsole`.
 * The toolkit re-points the `bles` / `cores` aliases at the insoles, which is fine here because the
 * CORE toolkit is removed in INSOLE mode. Rejects if a file cannot be fetched in time.
 */
export function loadInsoleSdk(timeoutMs = 12000) {
  const files = ['ORPHE-INSOLE.js', ...(wantsSimulator() ? ['InsoleSimulator.js'] : []), 'InsoleToolkit.js'];
  const one = (file) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_BASE + file;
    s.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error(`timeout loading ${file}`)), timeoutMs);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); reject(new Error(`could not load ${file}`)); };
    document.head.appendChild(s);
  });
  return files.reduce((chain, file) => chain.then(() => one(file)), Promise.resolve());
}

const JUMP_COOLDOWN_MS = 700;   // same values as the CORE sensor script
const ACCEL_COOLDOWN_MS = 100;
const TOE_KEY = 'hurdle.insoleToe';

/**
 * Swap the CORE connection UI for the INSOLE toolkit and wire INSOLE input into the game.
 * Returns null (and leaves the CORE UI alone) if the INSOLE scripts did not load.
 */
export function setupInsole() {
  if (typeof window.buildInsoleToolkit !== 'function' || typeof window.OrpheInsole !== 'function') {
    console.error('[HURDLE] ORPHE-INSOLE.js / InsoleToolkit.js did not load; staying on ORPHE CORE.');
    return null;
  }
  const simulator = wantsSimulator() && typeof window.OrpheInsoleSimulator !== 'undefined';

  // Both toolkits use the same element ids (switch_ble0, ui0, settings_modal0, ...),
  // so the CORE one has to leave the page before the INSOLE one is built.
  for (const id of [0, 1]) document.getElementById(`core_toolkit${id}`)?.remove();
  for (const id of [0, 1]) {
    if (!simulator) window.insoles[id].setup();
    window.buildInsoleToolkit(document.getElementById(`toolkit_placeholder${id + 1}`), `0${id + 1}`, id, {
      streamingMode: 4,          // acc + gyro + pressure + quaternion at 100 Hz (Euler needs the quaternion)
      autoReconnect: true,
      ...(simulator ? { simulator: true } : {}),
    });
  }
  const devices = window.insoles;   // read after the build: the simulator option swaps the slots

  // ---- which way is "toe up"?
  // Expected: +roll. If a unit reports the opposite, gravity tells us: with the foot held
  // still and tilted, the accelerometer's tilt atan2(y, z) is positive when the toe is up,
  // whatever the quaternion convention is. 'auto' follows that evidence.
  const cal = { mode: 'auto', sign: 1, evidence: 0, tilt: [null, null], gyro: [0, 0] };
  try { const m = localStorage.getItem(TOE_KEY); if (m === 'normal' || m === 'invert') cal.mode = m; } catch { /* storage unavailable */ }
  const sign = () => (cal.mode === 'normal' ? 1 : cal.mode === 'invert' ? -1 : cal.sign);
  /** CORE-convention pitch for an INSOLE Euler sample: toe up is negative. */
  const zero = [0, 0];   // resting pitch found during the countdown (set by the game), per insole
  const gamePitch = (dev, e) => -sign() * e.roll - (zero[dev] || 0);

  let lastJumpTime = 0;
  let lastAccelTime = 0;
  for (const insole of devices) {
    insole.gotConvertedGyro = function (g) {
      cal.gyro[this.id] = Math.hypot(g.x, g.y, g.z);
    };
    insole.gotConvertedAcc = function (acc) {
      window.devices[this.id].acc = acc;
      const mag = Math.hypot(acc.x, acc.y, acc.z);
      // only trust the tilt when the foot is still (about 1 G and hardly rotating)
      cal.tilt[this.id] = mag > 0.93 && mag < 1.07 && cal.gyro[this.id] < 40 ? Math.atan2(acc.y, acc.z) : null;

      // either foot moving hard enough = accelerate (mirrors the CORE sensor script)
      let maxAccel = 0;
      for (let i = 0; i < 2; i++) {
        const a = window.devices[i].acc;
        maxAccel = Math.max(maxAccel, Math.hypot(a.x, a.y, a.z));
      }
      if (window.setAccelPressed) {
        const now = performance.now();
        const shouldAccel = maxAccel > window.accThresholdAccel;
        if (shouldAccel && (now - lastAccelTime) > ACCEL_COOLDOWN_MS) {
          window.setAccelPressed(true);
          lastAccelTime = now;
        } else if (!shouldAccel) {
          window.setAccelPressed(false);
        }
      }
    };
    insole.gotEuler = function (euler) {
      if (cal.mode === 'auto') {
        const tilt = cal.tilt[this.id];
        if (tilt != null && Math.abs(tilt) > 0.1 && Math.abs(euler.roll) > 0.1) {
          cal.evidence = Math.max(-200, Math.min(200, cal.evidence + Math.sign(tilt * euler.roll)));
          if (cal.evidence <= -25) cal.sign = -1; else if (cal.evidence >= 25) cal.sign = 1;
        }
      }
      const pitch = gamePitch(this.id, euler);
      window.devices[this.id].eulers = { pitch, roll: euler.pitch, yaw: euler.yaw };
      const now = performance.now();
      // toe up past the threshold = jump (mirrors the CORE sensor script). A trigger the game's
      // jump guard ignored (no hurdle coming up) does not start the cooldown, so it cannot
      // swallow the real take-off that follows.
      if (pitch < -window.pitchThresholdJump && (now - lastJumpTime) > JUMP_COOLDOWN_MS) {
        if (window.gameJump && window.gameJump() !== false) lastJumpTime = now;
      }
    };
    insole.gotPress = function (press) {
      window.devices[this.id].press = press.values;
    };
  }

  return {
    devices, simulator, gamePitch,
    get toeMode() { return cal.mode; },
    setPitchZero(id, value) { zero[id] = Number.isFinite(value) ? value : 0; },
    setToeMode(mode) {
      cal.mode = mode === 'normal' || mode === 'invert' ? mode : 'auto';
      try { localStorage.setItem(TOE_KEY, cal.mode); } catch { /* ignore */ }
    },
    /** Short status line for the settings drawer. */
    toeState() {
      const dir = sign() > 0 ? '標準' : '反転';
      if (cal.mode !== 'auto') return dir;
      return Math.abs(cal.evidence) >= 25 ? `${dir}（判定済み）` : `${dir}（未判定）`;
    },
  };
}
