/**
 * 音（UdonAudio）
 *
 * 元のゲームの音源（puni.wav / pipi.wav / soundA.mp3 / soundB.mp3）をそのまま使い、
 * 足りない効果音（包丁・カウントダウン・できあがりのファンファーレなど）は Web Audio で合成します。
 * ブラウザの自動再生制限のため、最初のクリック／キー操作で unlock() されるまで音は出ません。
 */
(function (root) {
  'use strict';

  var VOL = { puni: 0.35, pipi: 0.3, bgm: 0.1, synth: 0.22 };

  var UdonAudio = {
    enabled: true,
    ctx: null,
    unlocked: false,
    buffers: {},
    pools: {},
    bgmEls: {},
    bgmNow: null,

    /** 最初のユーザー操作で呼ぶ */
    unlock: function () {
      if (this.unlocked) {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      this.unlocked = true;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (AC) {
        try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
      }
      this._loadSample('puni', 'puni.wav');
      this._loadSample('pipi', 'pipi.wav');
      // BGM はストリーミング再生（各 3MB あるので decode しない）
      this.bgmEls.play = this._bgmEl('soundA.mp3');
      this.bgmEls.menu = this._bgmEl('soundB.mp3');
      if (this.bgmNow) this.bgm(this.bgmNow, true);
    },

    _bgmEl: function (src) {
      var el = new Audio(src);
      el.loop = true;
      el.preload = 'auto';
      el.volume = VOL.bgm;
      return el;
    },

    _loadSample: function (name, url) {
      var self = this;
      // file:// で開いたときなど fetch できない環境では <audio> のプールで鳴らす
      var pool = [];
      for (var i = 0; i < 4; i++) {
        var a = new Audio(url);
        a.preload = 'auto';
        pool.push(a);
      }
      this.pools[name] = { els: pool, next: 0 };
      if (!this.ctx || !root.fetch) return;
      root.fetch(url)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (buf) { return self.ctx.decodeAudioData(buf); })
        .then(function (decoded) { self.buffers[name] = decoded; })
        .catch(function () { /* プール再生にフォールバック */ });
    },

    setEnabled: function (on) {
      this.enabled = !!on;
      if (!this.enabled) {
        for (var k in this.bgmEls) this.bgmEls[k].pause();
      } else if (this.bgmNow) {
        this.bgm(this.bgmNow, true);
      }
    },

    /** サンプル再生。rate で高さを変える（ふむたびに少しずつ違う音にする） */
    play: function (name, opts) {
      if (!this.enabled || !this.unlocked) return;
      opts = opts || {};
      var vol = (VOL[name] || 0.3) * (opts.gain === undefined ? 1 : opts.gain);
      var rate = opts.rate || 1;
      var buf = this.buffers[name];
      if (buf && this.ctx && this.ctx.state === 'running') {
        var src = this.ctx.createBufferSource();
        var g = this.ctx.createGain();
        src.buffer = buf;
        src.playbackRate.value = rate;
        g.gain.value = vol;
        src.connect(g).connect(this.ctx.destination);
        src.start();
        return;
      }
      var pool = this.pools[name];
      if (!pool) return;
      var el = pool.els[pool.next];
      pool.next = (pool.next + 1) % pool.els.length;
      try {
        el.pause();
        el.currentTime = 0;
        el.volume = Math.min(1, vol);
        el.playbackRate = rate;
        if ('preservesPitch' in el) el.preservesPitch = false;
        var p = el.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) { /* 音が出なくてもゲームは続ける */ }
    },

    /** BGM を切り替える: 'menu'（soundB）| 'play'（soundA）| null（止める） */
    bgm: function (which, force) {
      if (this.bgmNow === which && !force) return;
      this.bgmNow = which;
      if (!this.unlocked) return;
      for (var k in this.bgmEls) {
        var el = this.bgmEls[k];
        if (k === which && this.enabled) {
          var p = el.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          el.pause();
          if (k !== which) { try { el.currentTime = 0; } catch (e) { /* 読み込み前 */ } }
        }
      }
    },

    // --- 合成音 ---------------------------------------------------------------
    _tone: function (freq, dur, o) {
      if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
      o = o || {};
      var ctx = this.ctx;
      var t0 = ctx.currentTime + (o.delay || 0);
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
      var v = VOL.synth * (o.gain === undefined ? 1 : o.gain);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },

    _noise: function (dur, o) {
      if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
      o = o || {};
      var ctx = this.ctx;
      var n = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, n, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = ctx.createBufferSource();
      var filt = ctx.createBiquadFilter();
      var g = ctx.createGain();
      src.buffer = buf;
      filt.type = o.filter || 'bandpass';
      filt.frequency.value = o.freq || 1800;
      filt.Q.value = o.q || 0.8;
      g.gain.value = VOL.synth * (o.gain === undefined ? 1 : o.gain);
      src.connect(filt).connect(g).connect(ctx.destination);
      src.start(ctx.currentTime + (o.delay || 0));
    },

    /** カウントダウン。last = true で「スタート」の音 */
    tick: function (last) {
      if (last) this._tone(988, 0.34, { type: 'triangle', gain: 1.1 });
      else this._tone(660, 0.12, { type: 'triangle' });
    },
    /** 包丁でトン */
    chop: function () {
      this._noise(0.05, { freq: 2600, gain: 0.9 });
      this._tone(150, 0.09, { to: 70, gain: 1.3 });
    },
    /** 麺棒ころころ */
    roll: function () { this._noise(0.22, { freq: 520, q: 0.6, gain: 0.7 }); },
    /** 生地をたたむ「ぽよん」 */
    fold: function () { this._tone(280, 0.2, { to: 620, gain: 1.0 }); },
    /** いいリズム */
    good: function () {
      this._tone(659, 0.1, { type: 'triangle', gain: 0.8 });
      this._tone(880, 0.16, { type: 'triangle', gain: 0.8, delay: 0.09 });
    },
    /** ボタン */
    tap: function () { this._tone(520, 0.06, { type: 'triangle', gain: 0.6 }); },
    /** できあがり（ヨナ抜き音階の上り） */
    fanfare: function () {
      var notes = [523, 587, 659, 784, 880, 1047];
      for (var i = 0; i < notes.length; i++) {
        this._tone(notes[i], 0.2, { type: 'triangle', delay: i * 0.085, gain: 0.9 });
      }
      this._tone(1047, 0.7, { type: 'triangle', delay: 0.56, gain: 0.9 });
      this._tone(784, 0.7, { type: 'triangle', delay: 0.56, gain: 0.6 });
      this._tone(659, 0.7, { type: 'triangle', delay: 0.56, gain: 0.5 });
    }
  };

  root.UdonAudio = UdonAudio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
