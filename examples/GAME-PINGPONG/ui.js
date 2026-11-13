// ui.js — everything in the DOM except the result report (report.js): lobby, calibration
// panels, in-match HUD, settings drawer, help, toasts. main.js owns the state; this module
// only reflects it and reports what the player pressed through `actions`.
import { EXERCISES } from './analysis.js';
import { CHARACTERS } from './characters.js';
import { PLAYER_NAMES } from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SIZE_WORDS = ['とても小さい', '小さい', 'ふつう', '大きい', 'とても大きい'];
const RING = 2 * Math.PI * 52;

/** Side-view pictogram of the exercise; the group with data-move turns with the measured tilt. */
function figureSvg(exercise) {
  if (exercise === 'thigh') {
    return `<svg viewBox="0 0 210 168" aria-hidden="true">
      <line class="fig-floor" x1="14" y1="156" x2="196" y2="156"/>
      <rect class="fig-seat" x="34" y="98" width="72" height="12" rx="4"/><rect class="fig-seat" x="34" y="40" width="11" height="70" rx="4"/>
      <rect class="fig-seat" x="40" y="108" width="8" height="48"/><rect class="fig-seat" x="92" y="108" width="8" height="48"/>
      <circle class="fig-fill" cx="72" cy="20" r="14"/><path class="fig-limb" d="M72 42 L72 92"/>
      <path class="fig-arc" d="M150 86 A 76 76 0 0 0 132 44"/>
      <g data-move="76 92"><path class="fig-limb" d="M76 92 L142 92 L142 140"/><path class="fig-limb" d="M140 146 L162 146"/>
        <rect class="fig-core" x="94" y="75" width="30" height="12" rx="4"/></g></svg>`;
  }
  return `<svg viewBox="0 0 210 168" aria-hidden="true">
    <line class="fig-floor" x1="14" y1="156" x2="196" y2="156"/>
    <path class="fig-limb" d="M82 14 L94 112"/>
    <path class="fig-arc" d="M182 132 A 86 86 0 0 0 166 88"/>
    <g data-move="94 124"><path class="fig-fill" d="M76 134 Q76 150 92 150 L160 150 Q174 150 169 138 Q154 120 114 113 L92 113 Q78 116 76 134 Z"/>
      <rect class="fig-core" x="118" y="103" width="30" height="12" rx="4" transform="rotate(13 133 109)"/></g></svg>`;
}

export function createUI({ settings, actions, cpuCharacters = [] }) {
  const layers = { lobby: $('#lobby'), calib: $('#calib'), hud: $('#hud'), result: $('#result') };
  const drawer = $('#settings');
  const help = $('#help');

  // ------------------------------------------------------------------ helpers
  /** Radio-style segmented control: buttons carrying data-<attr>. */
  function bindSeg(root, attr, read, write) {
    const buttons = $$(`[data-${attr}]`, root);
    const sync = () => buttons.forEach((b) => b.setAttribute('aria-checked', String(String(read()) === b.dataset[attr])));
    buttons.forEach((b) => b.addEventListener('click', () => { write(b.dataset[attr]); actions.tap(); syncAll(); }));
    syncers.push(sync);
    return sync;
  }
  function bindSwitch(el, read, write) {
    const sync = () => el.setAttribute('aria-checked', String(!!read()));
    el.addEventListener('click', () => { write(!read()); actions.tap(); syncAll(); });
    syncers.push(sync);
  }
  function bindRange(el, out, read, write, format) {
    const sync = () => { el.value = read(); if (out) out.textContent = format(read()); };
    el.addEventListener('input', () => { write(parseFloat(el.value)); if (out) out.textContent = format(read()); actions.changed(); });
    syncers.push(sync);
  }
  const syncers = [];
  syncers.push(() => refreshCharacters());
  function syncAll() { syncers.forEach((fn) => fn()); refreshLobby(); actions.changed(); }

  // ------------------------------------------------------------------ lobby
  const modeCards = $$('.mode-card');
  modeCards.forEach((card) => card.addEventListener('click', () => { settings.mode = card.dataset.mode; actions.select(); syncAll(); }));
  syncers.push(() => modeCards.forEach((c) => c.setAttribute('aria-checked', String(c.dataset.mode === settings.mode))));
  for (const side of [0, 1]) {
    bindSeg($(`#setup-${side}`), 'exercise', () => settings.players[side].exercise, (v) => { settings.players[side].exercise = v; actions.exerciseChanged(side); });
  }
  bindSeg($('#points-seg'), 'points', () => settings.points, (v) => { settings.points = Number(v); });
  bindSeg($('#speed-seg'), 'speed', () => (settings.ballSpeed <= 3 ? 2 : settings.ballSpeed <= 5 ? 4 : 6), (v) => { settings.ballSpeed = Number(v); });
  bindSeg($('#cpu-seg'), 'cpu', () => settings.cpuLevel, (v) => { settings.cpuLevel = Number(v); });
  $('#btn-start').addEventListener('click', () => actions.start());
  $('#btn-lobby-settings').addEventListener('click', () => actions.openSettings('game'));
  $('#btn-lobby-help').addEventListener('click', () => api.help(true));

  // ------------------------------------------------------------------ character picker
  const charSheet = $('#charselect');
  const charGrid = $('#char-grid');
  let portraits = null;     // portraits[kind][side] = data URL, rendered from the 3D models by main.js
  let charSide = 0;
  const characterName = (kind) => (CHARACTERS.find((c) => c.key === kind) || CHARACTERS[0]).name;
  function paintCharButton(button, kind, side) {
    const img = $('img', button);
    const url = portraits && portraits[kind] ? portraits[kind][side] : '';
    if (url) img.src = url;
    img.style.visibility = url ? 'visible' : 'hidden';
    $('span', button).textContent = characterName(kind);
  }
  function refreshCharacters() {
    const solo = settings.mode === 'solo';
    for (const button of $$('.char-btn[data-char-side]')) {
      const side = Number(button.dataset.charSide);
      const cpu = solo && side === 1;
      paintCharButton(button, cpu ? cpuCharacters[settings.cpuLevel] : settings.players[side].character, side);
      button.disabled = cpu;
    }
    // the drawer's buttons follow the same rule: in solo mode the right-hand character is the computer's
    for (const side of [0, 1]) {
      const button = $(`#tab-p${side} .char-btn`);
      const cpu = solo && side === 1;
      paintCharButton(button, cpu ? cpuCharacters[settings.cpuLevel] : settings.players[side].character, side);
      button.disabled = cpu;
    }
    for (const card of $$('.char-card', charGrid)) card.setAttribute('aria-checked', String(card.dataset.char === settings.players[charSide].character));
  }
  function openCharacters(side) {
    charSide = side;
    $('.char-sheet', charSheet).dataset.side = String(side);
    $('#char-title-text').textContent = `${PLAYER_NAMES[side]}のキャラクター`;
    charGrid.replaceChildren(...CHARACTERS.map((c) => {
      const card = document.createElement('button');
      card.className = 'char-card'; card.setAttribute('role', 'radio'); card.dataset.char = c.key;
      const img = document.createElement('img');
      img.alt = ''; img.width = 150; img.height = 150;
      if (portraits && portraits[c.key]) img.src = portraits[c.key][side]; else img.style.visibility = 'hidden';
      const name = document.createElement('b'); name.textContent = c.name;
      const line = document.createElement('small'); line.textContent = c.line;
      card.append(img, name, line);
      card.addEventListener('click', () => { settings.players[charSide].character = c.key; actions.select(); syncAll(); });
      return card;
    }));
    refreshCharacters();
    charSheet.hidden = false;
    actions.tap();
  }
  for (const button of $$('.char-btn[data-char-side]')) button.addEventListener('click', () => openCharacters(Number(button.dataset.charSide)));
  $('#btn-char-close').addEventListener('click', () => { charSheet.hidden = true; actions.tap(); });
  charSheet.addEventListener('click', (e) => { if (e.target === charSheet) charSheet.hidden = true; });

  function refreshLobby() {
    const solo = settings.mode === 'solo';
    $('#setup-1').classList.toggle('dim', solo);
    $('#cpu-opt').hidden = !solo;
    $('#points-label').textContent = settings.mode === 'coop' ? `目標 ${settings.points * 6}回` : '点数';
    if (solo) $('#setup-src-1').textContent = 'コンピューター';
  }

  // ------------------------------------------------------------------ settings drawer
  const tabs = $$('.tabs [role="tab"]');
  const panes = {};
  const liveEls = [];
  for (const side of [0, 1]) {
    const pane = $('#player-tab-template').content.firstElementChild.cloneNode(true);
    $(`#tab-p${side}`).replaceWith(pane);
    pane.id = `tab-p${side}`;
    pane.dataset.side = String(side);
    panes[`p${side}`] = pane;
    const p = settings.players[side];
    bindSeg(pane, 'exercise', () => p.exercise, (v) => { p.exercise = v; actions.exerciseChanged(side); });
    bindSeg(pane, 'assist', () => p.assist, (v) => { p.assist = Number(v); });
    bindRange($('[data-key="gain"]', pane), $('[data-out="gain"]', pane), () => p.gain, (v) => { p.gain = v; }, (v) => `${Math.round(v * 100)}%`);
    bindRange($('[data-key="smooth"]', pane), $('[data-out="smooth"]', pane), () => p.smooth, (v) => { p.smooth = v; }, (v) => `${Math.round(v * 100)}%`);
    bindRange($('[data-key="paddle"]', pane), $('[data-out="paddle"]', pane), () => p.paddle, (v) => { p.paddle = v; }, (v) => SIZE_WORDS[v - 1]);
    bindSwitch($('[data-key="invert"]', pane), () => p.invert, (v) => { p.invert = v; });
    $('[data-action="character"]', pane).addEventListener('click', () => openCharacters(side));
    $('[data-action="zero"]', pane).addEventListener('click', () => actions.zero(side));
    $('[data-action="recalib"]', pane).addEventListener('click', () => actions.recalibrate(side));
    $('[data-action="clear"]', pane).addEventListener('click', () => actions.clearCalibration(side));
    liveEls[side] = { deg: $('[data-el="deg"]', pane), src: $('[data-el="src"]', pane), range: $('[data-el="range"]', pane), dot: $('[data-el="dot"]', pane), paddle: $('[data-el="paddle"]', pane) };
  }
  panes.game = $('#tab-game');
  panes.av = $('#tab-av');
  function selectTab(name) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    for (const [key, pane] of Object.entries(panes)) pane.hidden = key !== name;
  }
  tabs.forEach((t) => t.addEventListener('click', () => { selectTab(t.dataset.tab); actions.tap(); }));
  selectTab('p0');
  bindSeg($('#set-points'), 'points', () => settings.points, (v) => { settings.points = Number(v); });
  bindSeg($('#set-cpu'), 'cpu', () => settings.cpuLevel, (v) => { settings.cpuLevel = Number(v); });
  bindRange($('#set-ballSpeed'), $('#out-ballSpeed'), () => settings.ballSpeed, (v) => { settings.ballSpeed = v; }, (v) => String(v));
  bindRange($('#set-ballSize'), $('#out-ballSize'), () => settings.ballSize, (v) => { settings.ballSize = v; }, (v) => SIZE_WORDS[v - 1]);
  bindSeg($('#set-pace'), 'pace', () => settings.rallyPace, (v) => { settings.rallyPace = Number(v); });
  bindSwitch($('#set-items'), () => settings.items, (v) => { settings.items = v; });
  bindSwitch($('#set-guide'), () => settings.guide, (v) => { settings.guide = v; });
  bindSeg($('#set-bgm'), 'bgm', () => settings.bgm, (v) => { settings.bgm = v; });
  bindRange($('#set-bgmVolume'), $('#out-bgmVolume'), () => settings.bgmVolume, (v) => { settings.bgmVolume = v; }, (v) => `${Math.round(v * 100)}%`);
  bindRange($('#set-sfxVolume'), $('#out-sfxVolume'), () => settings.sfxVolume, (v) => { settings.sfxVolume = v; }, (v) => `${Math.round(v * 100)}%`);
  bindSwitch($('#set-record'), () => settings.record, (v) => { settings.record = v; });
  bindSeg($('#set-season'), 'season', () => settings.season, (v) => { settings.season = v; });
  $('#btn-clear-history').addEventListener('click', () => actions.clearHistory());
  $('#btn-settings').addEventListener('click', () => (drawer.hidden ? actions.openSettings() : actions.closeSettings()));
  $('#btn-settings-close').addEventListener('click', () => actions.closeSettings());
  $('#btn-resume').addEventListener('click', () => actions.closeSettings());
  $('#btn-quit').addEventListener('click', () => actions.quit());

  // ------------------------------------------------------------------ top bar, help
  $('#btn-help').addEventListener('click', () => api.help(help.hidden));
  $('#btn-help-close').addEventListener('click', () => api.help(false));
  help.addEventListener('click', (e) => { if (e.target === help) api.help(false); });
  $('#btn-sound').addEventListener('click', () => actions.toggleSound());
  $('#btn-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {});
  });

  // ------------------------------------------------------------------ calibration, result buttons
  $('#btn-calib-back').addEventListener('click', () => actions.calibBack());
  $('#btn-calib-retry').addEventListener('click', () => actions.calibRetry());
  $('#btn-calib-skip').addEventListener('click', () => actions.calibSkip());
  $('#btn-calib-go').addEventListener('click', () => actions.calibGo());
  $('#btn-again').addEventListener('click', () => actions.again());
  $('#btn-title').addEventListener('click', () => actions.quit());
  $('#btn-csv').addEventListener('click', () => actions.csv());
  $('#btn-print').addEventListener('click', () => window.print());

  const calibMove = [null, null];
  const popups = $('#popups');
  let bannerTimer = 0, hintTimer = 0;
  const last = { score: [-1, -1], rally: -1, reps: [-1, -1], deg: ['', ''] };

  const api = {
    /** Show one of lobby | calib | hud, or none of them with 'result' (the result layer follows its banner / sheet). */
    show(name) {
      for (const [key, el] of Object.entries(layers)) if (key !== 'result') el.hidden = key !== name;
    },
    sync() { syncers.forEach((fn) => fn()); refreshLobby(); },
    /** Portraits for the character picker: { kind: [dataUrlForSide0, dataUrlForSide1] }. */
    setPortraits(map) { portraits = map; refreshCharacters(); },
    setLoading(done) { $('#loading').classList.toggle('done', done); },
    setMuted(muted) { const b = $('#btn-sound'); b.classList.toggle('off', muted); b.firstElementChild.className = muted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill'; },

    /** Connection chip in the top bar and the matching line in the lobby. */
    setCoreState(side, { live, hz, cpu }) {
      const chip = $(`.core-chip[data-side="${side}"]`);
      chip.classList.toggle('live', live);
      $(`#core-state-${side}`).textContent = live ? `受信中 ${Math.round(hz)}Hz` : '未接続';
      const src = $(`#setup-src-${side}`);
      src.classList.toggle('live', live && !cpu);
      src.textContent = cpu ? 'コンピューター' : live ? 'ORPHE CORE ✓' : side === 0 ? 'キーボード W / S' : 'キーボード ↑ / ↓';
      const panelSrc = $(`#panel-src-${side}`);
      panelSrc.textContent = cpu ? 'CPU' : live ? 'CORE' : side === 0 ? 'W / S' : '↑ / ↓';
    },

    // ---------------- drawer
    get drawerOpen() { return !drawer.hidden; },
    openDrawer(tab) { drawer.hidden = false; if (tab) selectTab(tab); },
    closeDrawer() { drawer.hidden = true; },
    /** Live preview in a player's settings tab. */
    setLive(side, { deg, pos, up, down, source }) {
      const el = liveEls[side];
      if (drawer.hidden) return;
      el.deg.textContent = `${deg >= 0 ? '↑' : '↓'} ${Math.abs(deg).toFixed(0)}°`;
      el.src.textContent = source === 'core' ? 'ORPHE CORE' : 'キーボード';
      const span = 120;
      el.range.style.left = `${clamp(((-down + 60) / span) * 100, 0, 100)}%`;
      el.range.style.width = `${clamp(((up + down) / span) * 100, 0, 100)}%`;
      el.dot.style.left = `${clamp(((deg + 60) / span) * 100, 0, 100)}%`;
      el.paddle.style.left = `${((pos + 1) / 2) * 100}%`;
    },
    help(open) { help.hidden = !open; if (open) actions.tap(); },
    /** During a match the choices that define it (points, opponent, exercise) cannot be changed. */
    setMatchLock(locked) {
      for (const el of $$('#set-points button, #set-cpu button, .drawer [data-exercise]')) { el.disabled = locked; el.title = locked ? '試合中は変えられません' : ''; }
    },

    // ---------------- calibration
    calibSetup(sides) {
      for (const side of [0, 1]) {
        const cfg = sides.find((s) => s.side === side);
        const panel = $(`#calib-${side}`);
        panel.hidden = !cfg;
        if (!cfg) continue;
        const ex = EXERCISES[cfg.exercise];
        $(`#calib-ex-${side}`).textContent = `${ex.label}（${ex.place}に装着）`;
        $(`#calib-figure-${side}`).innerHTML = figureSvg(cfg.exercise);
        calibMove[side] = $(`#calib-figure-${side} [data-move]`);
        $$(`#calib-steps-${side} li`).forEach((li, i) => { li.textContent = ['じっとする', ex.upHint, ex.downHint][i]; });
      }
    },
    /** state: { phase, progress, liveDeg, tiltDeg, result, reason, exercise } */
    calibUpdate(side, state) {
      const panel = $(`#calib-${side}`);
      const ex = EXERCISES[state.exercise];
      const idx = { rest: 0, up: 1, down: 2 }[state.phase];
      const stepsDone = state.phase === 'done' ? 3 : idx ?? 0;
      $$(`#calib-steps-${side} li`).forEach((li, i) => { li.classList.toggle('on', i === idx); li.classList.toggle('done', i < stepsDone); });
      $(`#calib-ring-${side}`).style.strokeDashoffset = String(RING * (1 - (state.phase === 'done' ? 1 : state.progress)));
      $(`#calib-step-${side}`).textContent = state.phase === 'done' ? 'できました' : state.phase === 'failed' ? '' : `${(idx ?? 0) + 1} / 3`;
      const shown = state.phase === 'done' && state.result ? state.result.up + state.result.down : Math.abs(state.liveDeg);
      $(`#calib-deg-${side}`).textContent = `${shown.toFixed(0)}°`;
      const say = {
        idle: 'まもなく はじまります', rest: 'らくな姿勢で、じっとして',
        up: `${ex.upHint.replace('を', 'を ゆっくり ')}`, down: `${ex.downHint.replace('を', 'を ゆっくり ')}`,
        done: state.reason === 'no-sensor' ? 'キーボードで操作します' : 'はかれました！',
        failed: state.reason === 'small' ? '動きが小さいようです。もう一度' : 'CORE の信号がとぎれました',
      }[state.phase];
      $(`#calib-say-${side}`).textContent = say;
      panel.classList.toggle('failed', state.phase === 'failed');
      const res = $(`#calib-result-${side}`);
      if (state.phase === 'done' && state.result && state.reason !== 'no-sensor') {
        res.hidden = false;
        res.innerHTML = `${ex.up} <b>${state.result.up.toFixed(0)}°</b>　${ex.down} <b>${state.result.down.toFixed(0)}°</b>　あわせて <b>${(state.result.up + state.result.down).toFixed(0)}°</b>`;
      } else if (state.phase === 'done') {
        res.hidden = false; res.textContent = side === 0 ? 'W で上、S で下に動きます' : '↑ で上、↓ で下に動きます';
      } else res.hidden = true;
      const move = calibMove[side];
      if (move) move.setAttribute('transform', `rotate(${(-clamp(state.tiltDeg, -55, 70)).toFixed(1)} ${move.dataset.move})`);
    },
    calibReady(ready, label = '試合開始') { const b = $('#btn-calib-go'); b.disabled = !ready; b.textContent = label; },

    // ---------------- HUD
    hudSetup({ mode, names, points, goal, lives, exercises }) {
      const coop = mode === 'coop';
      $('#scorebar').hidden = coop;
      $('#coopbar').hidden = !coop;
      for (const side of [0, 1]) {
        $(`#score-name-${side}`).textContent = names[side];
        $(`#panel-name-${side}`).textContent = names[side];
        $(`#tilt-label-${side}`).textContent = exercises[side] === 'thigh' ? '太もも' : exercises[side] === 'ankle' ? 'つま先' : '';
        $(`#panel-${side}`).classList.toggle('cpu', !exercises[side]);
        $(`#panel-${side} .panel-body`).hidden = !exercises[side];
        $(`#score-pips-${side}`).innerHTML = coop ? '' : Array.from({ length: Math.min(points, 11) }, () => '<i></i>').join('');
      }
      $('#coop-goal').textContent = String(goal);
      $('#coop-lives').innerHTML = Array.from({ length: lives }, () => '<span class="on">♨</span>').join('');
      last.score = [-1, -1]; last.rally = -1; last.reps = [-1, -1];
      api.score(0, 0); api.rally(0); api.coop(0, goal, lives); api.slow(false);
      for (const side of [0, 1]) { api.effects(side, []); api.reps(side, 0); }
    },
    score(a, b) {
      [a, b].forEach((v, side) => {
        if (last.score[side] === v) return;
        const el = $(`#score-${side}`);
        el.textContent = String(v);
        if (last.score[side] >= 0) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
        $$(`#score-pips-${side} i`).forEach((pip, i) => pip.classList.toggle('on', i < v));
        last.score[side] = v;
      });
    },
    coop(total, goal, lives) {
      $('#coop-count').textContent = String(total);
      $('#coop-fill').style.width = `${clamp((total / goal) * 100, 0, 100)}%`;
      $$('#coop-lives span').forEach((s, i) => s.classList.toggle('on', i < lives));
    },
    rally(n) {
      if (last.rally === n) return;
      const box = $('#rally'), num = $('#rally-count');
      box.classList.toggle('on', n >= 2);
      box.classList.toggle('hot', n >= 10);
      num.textContent = String(n);
      if (n > last.rally && n >= 2) { num.classList.remove('bump'); void num.offsetWidth; num.classList.add('bump'); }
      last.rally = n;
    },
    slow(on) { $('#slow-chip').hidden = !on; },
    tilt(side, pos, deg) {
      $(`#tilt-knob-${side}`).style.top = `${clamp(50 - pos * 44, 6, 94)}%`;
      const text = `${deg >= 0.5 ? '↑' : deg <= -0.5 ? '↓' : ''}${Math.abs(deg).toFixed(0)}°`;
      if (last.deg[side] !== text) { $(`#tilt-deg-${side}`).textContent = text; last.deg[side] = text; }
    },
    reps(side, n) { if (last.reps[side] !== n) { $(`#reps-${side}`).textContent = String(n); last.reps[side] = n; } },
    effects(side, list) { $(`#effects-${side}`).innerHTML = list.map((t) => `<span>${t}</span>`).join(''); },

    /** A word that pops at a screen position (x, y in 0..1). kind: '' | smash | kanji | soft | item */
    popup(text, x, y, kind = '') {
      const el = document.createElement('span');
      el.className = `popup ${kind}`;
      el.textContent = text;
      el.style.left = `${clamp(x, 0.08, 0.92) * 100}%`;
      el.style.top = `${clamp(y, 0.16, 0.86) * 100}%`;
      popups.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    },
    banner(text, ms = 1600) {
      const el = $('#banner');
      clearTimeout(bannerTimer);
      if (!text) { el.hidden = true; return; }
      el.hidden = true; void el.offsetWidth;
      el.textContent = text; el.hidden = false;
      bannerTimer = setTimeout(() => { el.hidden = true; }, ms);
    },
    countdown(text, go = false) {
      const el = $('#countdown');
      if (text === null) { el.hidden = true; return; }
      el.hidden = false;
      el.textContent = text;
      el.classList.toggle('go', go);
      el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
    },
    hint(text, ms = 0) {
      const el = $('#hint');
      clearTimeout(hintTimer);
      el.hidden = !text;
      if (text) { el.textContent = text; if (ms) hintTimer = setTimeout(() => { el.hidden = true; }, ms); }
    },
    toast(text) {
      const el = document.createElement('div');
      el.className = 'toast-msg';
      el.textContent = text;
      $('#toasts').appendChild(el);
      setTimeout(() => el.remove(), 3500);
    },

    // ---------------- result
    winBanner(sub, title) {
      const el = $('#win-banner');
      if (!title) { el.hidden = true; layers.result.hidden = $('#sheet').hidden; return; }
      $('#win-sub').textContent = sub; $('#win-title').textContent = title;
      layers.result.hidden = false;
      el.hidden = true; void el.offsetWidth; el.hidden = false;
    },
    showSheet(show) {
      $('#sheet').hidden = !show;
      layers.result.hidden = !show && $('#win-banner').hidden;
      if (show) $('#sheet').scrollTop = 0;
    },
    names: PLAYER_NAMES,
  };
  return api;
}
