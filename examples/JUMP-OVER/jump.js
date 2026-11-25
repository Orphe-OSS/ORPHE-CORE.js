/*
 * ORPHE CORE ジャンプ高さ推定器（analysis/jump_model.py の JavaScript 版）
 *
 * 1. 踏み切り: |加速度| が TO_G を超えた最初のサンプル
 * 2. 着地    : 踏み切りから MIN_FLIGHT 秒以上たってから |加速度| が LD_G を超えた最初のサンプル
 *              （空中でも足の振りで ~6G 出るので、着地は 10G の衝撃で判定する）
 * 3. 足の最高点: クォータニオンで加速度をワールド座標に回転 → 踏み切り前の静止区間で測った
 *              重力方向に射影 → 2 回積分（踏み切り・着地の高さ = 0 の拘束でドリフト除去）
 * 4. 教師データ（動画の靴底最高点）で線形補正: cm = a * raw + b
 */
(function (root) {
  const G = 9.80665;

  const DEFAULTS = {
    TO_G: 6.0,          // 踏み切り判定 [G]
    LD_G: 10.0,         // 着地判定 [G]
    MIN_FLIGHT: 0.25,   // [s]
    MAX_FLIGHT: 1.0,    // [s]
    REF_FROM: 1.5,      // 重力基準区間: 踏み切りの 1.5 s 前 〜
    REF_TO: 0.5,        //               0.5 s 前
    REFRACTORY: 0.5,    // 着地後の不応期 [s]
    CAL_A: 0.8628,      // 教師データ 9 本に対する線形補正（analysis/jump_model.py で算出）
    CAL_B: 5.0192,
    BUFFER_SEC: 4.0,
  };

  function rotate(q, v) {
    // v' = v + 2 u × (u × v + w v)
    const ux = q.x, uy = q.y, uz = q.z, w = q.w;
    const cx = uy * v[2] - uz * v[1] + w * v[0];
    const cy = uz * v[0] - ux * v[2] + w * v[1];
    const cz = ux * v[1] - uy * v[0] + w * v[2];
    return [
      v[0] + 2 * (uy * cz - uz * cy),
      v[1] + 2 * (uz * cx - ux * cz),
      v[2] + 2 * (ux * cy - uy * cx),
    ];
  }

  class JumpDetector {
    constructor(opts = {}) {
      this.p = Object.assign({}, DEFAULTS, opts);
      this.buf = [];             // {t, w:[x,y,z], an}
      this.state = 'ground';
      this.takeoff = null;       // buffer entry
      this.refractoryUntil = -Infinity;
    }

    reset() {
      this.buf = [];
      this.state = 'ground';
      this.takeoff = null;
      this.refractoryUntil = -Infinity;
    }

    /**
     * 1 サンプル追加する。
     * @param {number} t 秒
     * @param {{x,y,z}} acc 加速度 [G]
     * @param {{w,x,y,z}} quat クォータニオン（正規化前でも可）
     * @returns {null | {type:'takeoff'|'cancel'|'jump'|'rejected', ...}}
     */
    push(t, acc, quat) {
      const p = this.p;
      const last = this.buf[this.buf.length - 1];
      if (last && t <= last.t) return null;  // 重複・逆行は捨てる

      const n = Math.hypot(quat.w, quat.x, quat.y, quat.z) || 1;
      const q = { w: quat.w / n, x: quat.x / n, y: quat.y / n, z: quat.z / n };
      const a = [acc.x, acc.y, acc.z];
      const s = { t, w: rotate(q, a), an: Math.hypot(a[0], a[1], a[2]) };
      this.buf.push(s);
      while (this.buf.length && this.buf[0].t < t - p.BUFFER_SEC) this.buf.shift();

      if (this.state === 'ground') {
        if (s.an > p.TO_G && t >= this.refractoryUntil) {
          this.state = 'air';
          this.takeoff = s;
          return { type: 'takeoff', t };
        }
        return null;
      }

      // state === 'air'
      const dt = t - this.takeoff.t;
      if (dt > p.MAX_FLIGHT) {
        this.state = 'ground';
        this.takeoff = null;
        return { type: 'cancel', t };
      }
      if (dt >= p.MIN_FLIGHT && s.an > p.LD_G) {
        const res = this._estimate(this.takeoff, s);
        this.state = 'ground';
        this.takeoff = null;
        this.refractoryUntil = t + p.REFRACTORY;
        return res;
      }
      return null;
    }

    _estimate(to, ld) {
      const p = this.p;
      const t0 = to.t, t1 = ld.t, T = t1 - t0;

      // 重力ベクトル（ワールド座標）: 踏み切り前の区間の平均
      let gx = 0, gy = 0, gz = 0, nRef = 0;
      for (const s of this.buf) {
        if (s.t > t0 - p.REF_FROM && s.t < t0 - p.REF_TO) {
          gx += s.w[0]; gy += s.w[1]; gz += s.w[2]; nRef++;
        }
      }
      if (nRef < 20) {
        return { type: 'rejected', reason: '踏み切り前の静止データが足りません', t: t1, flight: T };
      }
      gx /= nRef; gy /= nRef; gz /= nRef;
      const gm = Math.hypot(gx, gy, gz);
      const up = [gx / gm, gy / gm, gz / gm];

      // 踏み切り〜着地を 2 回積分
      const seg = this.buf.filter(s => s.t >= t0 && s.t <= t1);
      const tt = [], z = [];
      let v = 0, zz = 0, prevA = null, prevV = 0;
      for (let i = 0; i < seg.length; i++) {
        const s = seg[i];
        const av = (s.w[0] * up[0] + s.w[1] * up[1] + s.w[2] * up[2] - gm) * G;
        const ti = s.t - t0;
        if (i > 0) {
          const h = ti - tt[i - 1];
          v += (av + prevA) / 2 * h;
          zz += (v + prevV) / 2 * h;
        }
        tt.push(ti); z.push(zz);
        prevA = av; prevV = v;
      }
      const zEnd = z[z.length - 1];
      const traj = z.map((zi, i) => zi - zEnd * tt[i] / T);  // z(T)=0 になるよう初速を補正
      let apex = 0, apexT = 0;
      traj.forEach((zi, i) => { if (zi > apex) { apex = zi; apexT = tt[i]; } });

      const raw = apex * 100;
      const cm = p.CAL_A * raw + p.CAL_B;
      const still = Math.abs(gm - 1) < 0.15;
      if (raw < 3 || raw > 200) {
        return { type: 'rejected', reason: `推定値が範囲外です (${raw.toFixed(1)} cm)`, t: t1, flight: T };
      }
      return {
        type: 'jump', t: t1, takeoffT: t0, landingT: t1, flight: T,
        raw, cm, apexT, still,
        traj: traj.map((zi, i) => [tt[i], zi * 100]),
      };
    }
  }

  /** シリアル番号(uint16, 20 ms/packet) + パケット内番号(0..3, 5 ms) から連続時刻 [s] を作る */
  class SerialClock {
    constructor() { this.base = null; this.prev = null; this.wraps = 0; }
    reset() { this.base = null; this.prev = null; this.wraps = 0; this.aStart = null; }
    /**
     * CORE 2.0 用（シリアル番号もタイムスタンプも無い、約 50 Hz・1 通知 1 サンプル）。
     * 受信回数 × 20 ms を時刻にする（BLE の受信間隔はばらつくので受信時刻はそのまま使わない）。
     * 欠損などで受信が 100 ms 以上遅れたら、その分だけ時刻を進めて合わせる。
     */
    arrival(nowMs) {
      if (this.aStart == null) { this.aStart = nowMs; this.aT = -0.02; }
      this.aT += 0.02;
      const lag = (nowMs - this.aStart) / 1000 - this.aT;
      if (lag > 0.1) this.aT += lag;
      return this.aT;
    }
    time(serial, packet) {
      if (this.prev !== null && serial < this.prev && this.prev - serial > 32768) this.wraps++;
      this.prev = serial;
      const u = serial + this.wraps * 65536;
      if (this.base === null) this.base = u;
      return (u - this.base) * 0.02 + packet * 0.005;
    }
  }

  const api = { JumpDetector, SerialClock, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
