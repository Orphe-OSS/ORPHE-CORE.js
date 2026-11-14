// ui.js — DOM side of the game: HUD panes, overlays, result card, settings drawer and
// the read-only connection / sensor indicators in the CORE dock.
// It never talks to ORPHE CORE itself; it only observes what CoreToolkit and the
// inline sensor script in index.html already expose.

const $ = (id) => document.getElementById(id);
const WORLD_RECORD = 12.8;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Radar chart markup. labels: string[]; series: [{ color, scores: 0-100[] }] */
function radarSvg(labels, series, size = 300) {
  // viewBox is wider than tall so the side labels fit without clipping
  const W = size * 1.5, c = size / 2, cx = W / 2, R = size * 0.37, n = labels.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; };
  const poly = (vals) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' ');
  let out = `<svg viewBox="0 0 ${W} ${size}" role="img" aria-label="レーダーチャート / Radar chart">`;
  for (const g of [0.25, 0.5, 0.75, 1]) out += `<polygon class="radar-grid" points="${poly(labels.map(() => g))}"/>`;
  labels.forEach((_, i) => { const [x, y] = pt(i, 1); out += `<line class="radar-spoke" x1="${cx}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
  for (const s of series) out += `<polygon class="radar-area" style="--c:${s.color}" points="${poly(s.scores.map((v) => Math.max(0.04, v / 100)))}"/>`;
  labels.forEach((label, i) => {
    const [x, y] = pt(i, 1.17);
    const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end';
    out += `<text class="radar-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${esc(label)}`;
    if (series.length === 1) out += `<tspan class="radar-value" dx="5">${series[0].scores[i]}</tspan>`;
    out += '</text>';
  });
  return `${out}</svg>`;
}
const scoreBox = (e, withName) => `<div class="score-box" style="--c:${e.color}"><div class="score-ring" style="--p:${e.analysis.total};--c:${e.color}"><b>${e.analysis.total}</b></div>`
  + `<div class="score-meta"><span>${withName ? esc(e.label) : '総合スコア / SCORE'}</span><b>${e.analysis.grade}</b></div></div>`;

export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
}

/** Fixed-width digits so a proportional display font does not jitter while counting. */
function setDigits(el, str) {
  if (!el || el._s === str) return;
  el._s = str;
  if (!el._spans || el._spans.length !== str.length) {
    el.textContent = '';
    el._spans = [...str].map(() => el.appendChild(document.createElement('span')));
    el._chars = [];
  }
  for (let i = 0; i < str.length; i++) {
    if (el._chars[i] === str[i]) continue;
    el._chars[i] = str[i];
    el._spans[i].textContent = str[i];
    el._spans[i].className = str[i] === '.' ? 'p' : 'd';
  }
}
function setText(el, text) {
  if (el && el._t !== text) { el._t = text; el.textContent = text; }
}

export function createUI({ audio, courseLen, hurdleDistances, maxRivals, handlers }) {
  const stage = $('stage');
  const layers = { title: $('start-layer'), finish: $('finish-layer'), ranking: $('ranking-layer') };
  const $countdown = $('countdown-layer'), $countNum = $('countdown-number'), $countCap = $('countdown-caption'), $lights = $('count-lights');
  const $card = $('result-card'), $banner = $('finish-banner');
  const hudRoot = $('hud-root'), hudTemplate = $('hud-template');
  let mode = 'solo';
  let device = 'core';
  let rules = { jump: 'coast', stamina: 'pace', guard: 'on' };

  // ------------------------------------------------------------ HUD panes (one per human runner)
  function makeHud(slot) {
    const pane = hudTemplate.content.firstElementChild.cloneNode(true);
    pane.dataset.slot = String(slot);
    hudRoot.appendChild(pane);
    const el = {};
    pane.querySelectorAll('[data-el]').forEach((n) => { el[n.dataset.el] = n; });
    const pipEls = hurdleDistances.map((d) => {
      const i = document.createElement('i');
      i.style.left = `${(d / courseLen) * 100}%`;
      el.pips.appendChild(i);
      return i;
    });
    const rivalEls = Array.from({ length: maxRivals }, () => el.rivals.appendChild(document.createElement('i')));
    const cfg = { pace: false, markAt: 0.08, markAlways: true };
    const hud = {
      pane, _place: 0,
      /** Per-race setup: labels, runner count and which stamina aids to show. */
      configure(c) {
        Object.assign(cfg, c);
        setText(el.tag, c.tag); setText(el.lane, c.lane); setText(el.placeOf, `/ ${c.total}`);
        setText(el.warn, c.warn);
        el.mark.style.left = `${cfg.markAt * 100}%`;
        el.staminaWrap.classList.toggle('show-pace', cfg.pace);
        el.speedWrap.classList.toggle('show-tick', c.cruiseRatio != null);
        if (c.cruiseRatio != null) {
          // tick on the speed arc where stamina starts to burn
          const a = Math.PI * (1 - c.cruiseRatio);
          const pt = (r) => [100 + r * Math.cos(a), 104 - r * Math.sin(a)];
          const [x1, y1] = pt(73), [x2, y2] = pt(95);
          el.tick.setAttribute('x1', x1.toFixed(1)); el.tick.setAttribute('y1', y1.toFixed(1));
          el.tick.setAttribute('x2', x2.toFixed(1)); el.tick.setAttribute('y2', y2.toFixed(1));
        }
      },
      reset() {
        pipEls.forEach((p) => { p.className = ''; });
        setText(el.hits, '0'); setText(el.clear, '0');
        el.hitStat.classList.add('zero');
        el.staminaWrap.classList.remove('blocked', 'low');
        el.jumpCue.classList.remove('on');
        el.popups.textContent = '';
        pane.classList.remove('done');
        this._place = 0;
        this.update({ time: 0, remaining: courseLen, progress: 0, speed: 0, speedRatio: 0, stamina: 1, blocked: false, pace: cfg.pace ? 1 : null, burning: false, place: 1, rivals: [] });
      },
      update(s) {
        setDigits(el.timer, s.time.toFixed(2));
        setText(el.dist, s.remaining.toFixed(1));
        el.fill.style.transform = `scaleX(${s.progress.toFixed(4)})`;
        el.me.style.left = `${(s.progress * 100).toFixed(2)}%`;
        for (let i = 0; i < rivalEls.length; i++) {
          const v = s.rivals[i];
          rivalEls[i].style.display = v == null ? 'none' : '';
          if (v != null) rivalEls[i].style.left = `${(Math.min(1, v) * 100).toFixed(2)}%`;
        }
        setDigits(el.speed, s.speed.toFixed(1));
        setText(el.kmh, String(Math.round(s.speed * 3.6)));
        el.arc.style.strokeDashoffset = (264 * (1 - Math.min(1, s.speedRatio))).toFixed(1);
        el.speedWrap.classList.toggle('burn', !!s.burning);
        el.staminaBar.style.transform = `scaleX(${s.stamina.toFixed(3)})`;
        el.staminaBar.style.filter = s.blocked ? 'grayscale(1)' : 'none';
        setText(el.staminaPct, `${Math.floor(s.stamina * 100)}%`);
        el.staminaWrap.classList.toggle('blocked', s.blocked);
        el.staminaWrap.classList.toggle('low', s.stamina < 0.2);
        el.staminaWrap.classList.toggle('show-mark', cfg.markAlways || s.blocked);
        if (s.pace != null) {
          // how far ahead of / behind an even "empty exactly on the line" pace the runner is
          el.pace.style.left = `${(s.pace * 100).toFixed(1)}%`;
          const diff = Math.round((s.stamina - s.pace) * 100);
          const text = s.blocked ? '' : diff >= 5 ? `余力 +${diff}` : diff <= -5 ? `飛ばしすぎ ${diff}` : 'ペース良好';
          setText(el.delta, text);
          el.delta.classList.toggle('over', diff <= -5);
        } else setText(el.delta, '');
        if (s.place !== this._place) {
          const improved = this._place && s.place < this._place;
          this._place = s.place;
          setText(el.place, String(s.place));
          setText(el.placeSuffix, ordinal(s.place));
          el.placeWrap.dataset.place = String(s.place);
          if (improved) { el.placeWrap.classList.add('bump'); setTimeout(() => el.placeWrap.classList.remove('bump'), 260); }
        }
      },
      hurdle(index, hit, hits, cleared) {
        if (pipEls[index]) pipEls[index].className = hit ? 'hit' : 'clear';
        setText(el.hits, String(hits)); setText(el.clear, String(cleared));
        el.hitStat.classList.toggle('zero', hits === 0);
      },
      jumpCue(on) { el.jumpCue.classList.toggle('on', on); },
      setDone(done) { pane.classList.toggle('done', done); },
      popup(text, kind = 'info', small = '') {
        const p = document.createElement('div');
        p.className = `popup ${kind}`;
        p.textContent = text;
        if (small) { const s = document.createElement('small'); s.textContent = small; p.appendChild(s); }
        el.popups.appendChild(p);
        p.addEventListener('animationend', () => p.remove());
        while (el.popups.children.length > 3) el.popups.firstElementChild.remove();
      },
    };
    return hud;
  }
  const huds = [makeHud(0), makeHud(1)];

  // ------------------------------------------------------------ mode + rule dependent copy
  function renderCopy() {
    const vs = mode === 'vs';
    stage.classList.toggle('vs', vs);
    huds[1].pane.style.display = vs ? '' : 'none';
    document.querySelectorAll('.mode-btn').forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    setText($('howto-accel'), rules.stamina === 'pace' ? '足踏み → 加速（速いほどスタミナ消費）' : '足踏み → 加速（スタミナ消費）');
    setText($('howto-jump'), rules.jump === 'coast' ? 'つま先を上げる → ジャンプ（空中は少し失速）' : 'つま先を上げる → ジャンプ');
    $('howto-vs').hidden = !vs;
    $('howto-keys').innerHTML = vs
      ? '<span class="howto-head">KEYBOARD</span><span>P1　<kbd>A</kbd> 加速　<kbd>D</kbd> ジャンプ</span><span>P2　<kbd>←</kbd> 加速　<kbd>→</kbd> ジャンプ　<kbd>Esc</kbd> リセット</span>'
      : '<span class="howto-head">KEYBOARD</span><span><kbd>←</kbd> 長押しで加速 / Hold to accelerate</span><span><kbd>→</kbd> ジャンプ / Jump　<kbd>Esc</kbd> リセット</span>';
    const chip = (id, b, label) => { const c = $(id); c.firstElementChild.textContent = b; c.lastElementChild.textContent = label; };
    chip('foot-chip-0', vs ? '1' : 'L', vs ? 'PLAYER 1' : '左足');
    chip('foot-chip-1', vs ? '2' : 'R', vs ? 'PLAYER 2' : '右足');
    const insole = device === 'insole';
    setText($('dock-title'), insole ? 'ORPHE INSOLE' : 'ORPHE CORE');
    setText(document.querySelector('.howto-col .howto-head'), insole ? 'ORPHE INSOLE' : 'ORPHE CORE');
    setText(document.querySelector('.mode-btn[data-mode="solo"] small'), insole ? 'INSOLE を両足に' : 'CORE 2個を両足に');
    setText(document.querySelector('.mode-btn[data-mode="vs"] small'), insole ? 'INSOLE を1枚ずつ' : 'CORE 1個ずつ・足の甲に');
    document.querySelectorAll('#device-switch button').forEach((b) => { const on = b.dataset.device === device; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    $('insole-config').hidden = !insole;
    setText($('howto-vs'), '');
    $('howto-vs').innerHTML = `<i class="bi bi-people-fill"></i> PLAYER 1 = ${insole ? 'INSOLE' : 'CORE'} 01　PLAYER 2 = ${insole ? 'INSOLE' : 'CORE'} 02`;
    setText($('dock-hint'), vs
      ? (insole ? '1人1枚ずつINSOLEを入れます。01がPLAYER 1（左画面）、02がPLAYER 2（右画面）。' : '1人1個ずつ、足の甲にCOREを着けます。01がPLAYER 1（左画面）、02がPLAYER 2（右画面）。')
      : (insole ? 'スイッチをONにしてINSOLEを選択。足踏みで加速、つま先上げでジャンプ。' : 'スイッチをONにしてCOREを選択。キーボードだけでも遊べます。'));
    $('rule-jump').value = rules.jump;
    $('rule-stamina').value = rules.stamina;
    $('rule-guard').value = rules.guard === 'off' ? 'off' : 'on';
    setText($('rule-note'), (rules.stamina === 'pace'
      ? 'ペース配分：速度メーターの白い目盛りを超えるとスタミナが減り始め、速いほど激しく減ります。0になると息切れで最高速が半分になり、35%まで回復すると復帰。バー下の PACE 印に合わせて、ゴールでちょうど使い切るのが最速です。'
      : '従来：加速している間だけスタミナが減り、止めると回復します。8%を切ると加速できません。')
      + (rules.guard === 'off' ? '' : '　ジャンプ補助：早すぎるつま先上げは踏み切り位置まで待ってから跳び、ハードルが遠いときの足踏みはジャンプになりません。スタート直前に足を静止していると、その角度をつま先上げの基準にします（センサー入力のみ）。'));
  }
  document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => handlers.onMode(b.dataset.mode)));
  document.querySelectorAll('#device-switch button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.device !== device) handlers.onDevice(b.dataset.device); }));
  $('insole-toe').addEventListener('change', (e) => handlers.onInsoleToe(e.target.value));
  const onRule = () => handlers.onRules({ jump: $('rule-jump').value, stamina: $('rule-stamina').value, guard: $('rule-guard').value });
  for (const id of ['rule-jump', 'rule-stamina', 'rule-guard']) $(id).addEventListener('change', onRule);

  // ------------------------------------------------------------ screens
  let countHideTimer = 0;
  function setScreen(name) {
    stage.dataset.screen = name;
    for (const [key, node] of Object.entries(layers)) node.style.display = key === name ? '' : 'none';
    if (name !== 'countdown' && name !== 'race') { clearTimeout(countHideTimer); $countdown.style.display = 'none'; }
    if (name === 'countdown') $countdown.style.display = '';
    if (name !== 'finish') { $card.classList.remove('show'); $banner.classList.remove('show'); $('analysis-layer').style.display = 'none'; stage.classList.remove('analysis-open'); }
  }
  const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  // ------------------------------------------------------------ settings drawer / top bar
  const drawer = $('settings-drawer');
  const setDrawer = (open) => { drawer.classList.toggle('open', open); drawer.setAttribute('aria-hidden', open ? 'false' : 'true'); };
  $('btn-settings').addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
  $('open-settings').addEventListener('click', () => setDrawer(true));
  $('close-settings').addEventListener('click', () => setDrawer(false));

  const soundBtn = $('btn-sound');
  const syncSound = () => {
    soundBtn.classList.toggle('off', audio.muted);
    soundBtn.firstElementChild.className = audio.muted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill';
  };
  soundBtn.addEventListener('click', () => { audio.setMuted(!audio.muted); syncSound(); });
  syncSound();
  const vol = $('volume-slider'), volValue = $('volume-value');
  vol.value = String(audio.volume);
  volValue.textContent = `${Math.round(audio.volume * 100)}%`;
  vol.addEventListener('input', () => { audio.setVolume(parseFloat(vol.value)); volValue.textContent = `${Math.round(audio.volume * 100)}%`; });

  const fsBtn = $('btn-fullscreen');
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    fsBtn.firstElementChild.className = document.fullscreenElement ? 'bi bi-fullscreen-exit' : 'bi bi-arrows-fullscreen';
  });
  $('quality-select').addEventListener('change', (e) => handlers.onQuality(e.target.value));

  // UI blips
  const CLICKABLE = '.hx-btn, .icon-btn, .dock-link, .back-button, .mode-btn';
  let lastHover = null;
  stage.addEventListener('pointerover', (e) => {
    const b = e.target.closest?.(CLICKABLE);
    if (b && b !== lastHover) audio.ui('hover');
    lastHover = b;
  });
  stage.addEventListener('click', (e) => {
    const b = e.target.closest?.(CLICKABLE);
    if (b && b.id !== 'start-btn' && b.id !== 'retry') audio.ui('click');
  });

  // CoreToolkit nests its Bootstrap settings modal inside the toolkit element.
  // Re-parent it to <body> so the dock's own stacking context cannot trap it
  // behind the modal backdrop.
  for (const id of [0, 1]) {
    const modal = $(`settings_modal${id}`);
    if (modal) document.body.appendChild(modal);
  }

  // ------------------------------------------------------------ dock indicators (read-only)
  const checkAccel = $('check-accel'), checkJump = $('check-jump');
  function pollDock() {
    for (const id of [0, 1]) {
      const sw = $(`switch_ble${id}`), group = $(`ui${id}`);
      const connected = !!(sw && sw.checked && group && group.style.visibility === 'visible');
      const connecting = !!(sw && sw.disabled && window.bles?.[id]?._coreToolkitConnecting);
      $(`dock-row-${id}`).classList.toggle('connected', connected);
      setText($(`dock-state-${id}`), connected ? '接続済 ✓' : connecting ? '接続中…' : '未接続');
    }
  }
  setInterval(pollDock, 300);
  function pollSensors(keys) {
    let accel = !!keys?.accel, jump = !!keys?.jump;
    const devices = window.devices;
    if (devices) {
      for (const id of [0, 1]) {
        const d = devices[id];
        if (!d) continue;
        if (d.acc && Math.hypot(d.acc.x, d.acc.y, d.acc.z) > window.accThresholdAccel) accel = true;
        if (d.eulers && d.eulers.pitch < -window.pitchThresholdJump) jump = true;
      }
    }
    checkAccel.classList.toggle('on', accel);
    checkJump.classList.toggle('on', jump);
  }

  // ------------------------------------------------------------ countdown
  const CAPTIONS = { 3: 'ON YOUR MARKS', 2: 'SET', 1: '' };
  function countdown(n) {
    $countdown.style.display = '';
    $lights.classList.remove('go');
    $countNum.className = '';
    setText($countCap, CAPTIONS[n] ?? '');
    $countCap.style.visibility = CAPTIONS[n] ? 'visible' : 'hidden';
    $countNum.textContent = String(n);
    restart($countNum, 'tick');
    [...$lights.children].forEach((l, i) => l.classList.toggle('on', i < 4 - n));
  }
  function countdownGo() {
    $countCap.style.visibility = 'hidden';
    $countNum.textContent = 'GO!';
    $countNum.className = '';
    restart($countNum, 'go');
    $lights.classList.add('go');
    clearTimeout(countHideTimer);
    countHideTimer = setTimeout(() => { $countdown.style.display = 'none'; }, 750);
  }

  // ------------------------------------------------------------ finish / result
  const nameInputs = [$('player-name'), $('player-name-2')];
  const saveBtn = $('save-score'), saveStatus = $('save-status');
  let cardTimer = 0, countRaf = 0, boardSig = '';
  $('name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (saveBtn.disabled) return;
    const names = nameInputs.map((n) => (n.hidden || n.disabled ? '' : n.value.trim()));
    if (!names.some(Boolean)) { nameInputs[0].focus(); return; }
    try {
      if (names[0]) localStorage.setItem('hurdle.playerName', names[0]);
      if (names[1]) localStorage.setItem('hurdle.playerName2', names[1]);
    } catch { /* ignore */ }
    const ranks = handlers.onSave(names);
    if (ranks.some(Boolean)) {
      saveBtn.disabled = true; nameInputs.forEach((n) => { n.disabled = true; });
      saveStatus.textContent = mode === 'vs'
        ? `登録しました ✓ ${ranks.map((r, i) => (r ? `P${i + 1} ${r}位` : '')).filter(Boolean).join(' / ')}`
        : `登録しました ✓ ランキング ${ranks[0]}位 / Saved`;
    }
  });
  // typing a name must not drive the game
  nameInputs.forEach((n) => { n.addEventListener('keydown', (e) => e.stopPropagation()); n.addEventListener('keyup', (e) => e.stopPropagation()); });

  function prepareCard(vs) {
    clearTimeout(cardTimer); cancelAnimationFrame(countRaf);
    $card.classList.toggle('is-vs', vs);
    openAnalysis(false);
    restart($banner, 'show');
    $card.classList.remove('show');
    stage.classList.remove('settled');
    $('result-vs').hidden = !vs;
    $('result-solo-main').style.display = vs ? 'none' : '';
    $('result-solo-stats').style.display = vs ? 'none' : '';
    let saved = ['Player', 'Player 2'];
    try { saved = [localStorage.getItem('hurdle.playerName') || 'Player', localStorage.getItem('hurdle.playerName2') || 'Player 2']; } catch { /* ignore */ }
    nameInputs.forEach((n, i) => { n.value = saved[i]; n.disabled = false; });
    nameInputs[0].placeholder = vs ? 'PLAYER 1 の名前' : '名前 / Name';
    nameInputs[1].hidden = !vs;
    saveBtn.disabled = false; saveStatus.textContent = '';
  }
  function showFinish(r) {
    prepareCard(false);
    const medal = r.place === 1 ? 'gold' : r.place === 2 ? 'silver' : r.place === 3 ? 'bronze' : 'none';
    $('result-medal').dataset.medal = medal;
    setText($('result-place'), String(r.place));
    setText($('result-place-suffix'), ordinal(r.place));
    setText($('result-medal-label'), { gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE', none: 'FINALIST' }[medal]);
    setText($('final-hits'), String(r.hits));
    setText($('result-clean'), `${r.clean}/${hurdleDistances.length}`);
    setText($('result-top'), r.top.toFixed(1));
    setText($('result-stamina'), String(Math.round(r.staminaLeft * 100)));
    setText($('result-exhaust'), r.exhaustCount ? ` 息切れ${r.exhaustCount}回` : '');
    $('result-badge').classList.toggle('show', !!r.isPB);
    renderAnalysis(r.analysis);
    const diff = r.time - WORLD_RECORD;
    $('result-wr').innerHTML = diff <= 0
      ? `現実の世界記録 <b>12.80</b> を上回りました！ / Faster than the real-world record`
      : `現実の世界記録 <b>12.80</b> まで あと <b>+${diff.toFixed(2)}</b> 秒`;
    const $time = $('final-time');
    $time.textContent = '0.00';
    cardTimer = setTimeout(() => {
      $card.classList.add('show');
      stage.classList.add('settled');
      const t0 = performance.now(), dur = 900;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        $time.textContent = (r.time * e).toFixed(2);
        if (k < 1) countRaf = requestAnimationFrame(step); else $time.textContent = r.time.toFixed(2);
      };
      countRaf = requestAnimationFrame(step);
    }, 1350);
  }
  /** r: { winner: 0 | 1 | -1 (draw), players: [{ time | null, hits, clean, top, staminaLeft, exhaustCount, place }] } */
  function showFinishVs(r) {
    prepareCard(true);
    $('result-badge').classList.remove('show');
    renderAnalysis(r.analysis);
    setText($('vs-winner'), r.winner < 0 ? 'DRAW' : `PLAYER ${r.winner + 1} WINS`);
    r.players.forEach((pl, i) => {
      const col = $(`vs-col-${i}`);
      col.classList.toggle('win', r.winner === i);
      setText(col.querySelector('.vs-time'), pl.time == null ? 'DNF' : pl.time.toFixed(2));
      setText(col.querySelector('.vs-meta'), pl.time == null
        ? '完走できず / Did not finish'
        : `${pl.place}位 · 接触 ${pl.hits}回 · 最高速 ${pl.top.toFixed(1)} m/s · スタミナ残 ${Math.round(pl.staminaLeft * 100)}%${pl.exhaustCount ? ` · 息切れ${pl.exhaustCount}回` : ''}`);
      nameInputs[i].disabled = pl.time == null;
    });
    cardTimer = setTimeout(() => { $card.classList.add('show'); stage.classList.add('settled'); }, 1350);
  }
  /** rows: [{ lane, time | null, who: 'YOU' | 'P1' | 'P2' | 'RIVAL' }] already sorted */
  function updateBoard(rows) {
    const sig = rows.map((r) => `${r.lane}:${r.time ?? '-'}`).join('|');
    if (sig === boardSig) return;
    boardSig = sig;
    const board = $('result-board');
    board.textContent = '';
    rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = `board-row${r.who === 'YOU' || r.who === 'P1' ? ' me' : ''}${r.who === 'P2' ? ' p2' : ''}${r.time == null ? ' pending' : ''}`;
      const cell = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; row.appendChild(s); };
      cell('pos', r.time == null ? '-' : String(i + 1));
      cell('lane', `LANE ${r.lane}`);
      cell('who', r.who);
      cell('time', r.time == null ? '…' : r.time.toFixed(2));
      board.appendChild(row);
    });
  }

  // ------------------------------------------------------------ score, radar, analysis overlay
  const $analysis = $('analysis-layer');
  /** entries: [{ label, color, analysis }] — one per human runner (analysis from analysis.js) */
  function renderAnalysis(entries) {
    const list = (entries || []).filter((e) => e && e.analysis);
    $('result-analysis').style.display = list.length ? '' : 'none';
    if (!list.length) return;
    const labels = list[0].analysis.axes.map((a) => a.label);
    const series = list.map((e) => ({ color: e.color, scores: e.analysis.axes.map((a) => a.score) }));
    const duo = list.length > 1;
    $('score-row').innerHTML = list.map((e) => scoreBox(e, duo)).join('');
    $('result-radar').innerHTML = radarSvg(labels, series);
    $('result-comment').textContent = duo ? '' : `${list[0].analysis.comment.strength}${list[0].analysis.comment.weakness}`;

    // full overlay
    $('analysis-scores').innerHTML = list.map((e) => {
      const c = e.analysis.comment;
      return `<div class="analysis-score" style="--c:${e.color}"><h3>${esc(e.label)}</h3>${scoreBox(e, false)}`
        + `<p><b>強み</b>　${esc(c.strength)}</p><p><b>課題</b>　${esc(c.weakness)}</p><p class="tip"><b>次の一歩</b>　${esc(c.tip)}</p></div>`;
    }).join('');
    $('analysis-radar').innerHTML = radarSvg(labels, series)
      + (duo ? `<div class="radar-legend">${list.map((e) => `<span style="--c:${e.color}">${esc(e.label)}</span>`).join('')}</div>` : '');
    const stats = $('analysis-stats');
    stats.classList.toggle('duo', duo);
    let html = '', group = '';
    const names = { RUN: 'RUN 走り', HURDLE: 'HURDLE ハードル', BODY: 'BODY 体の動き', SENSOR: 'SENSOR' };
    list[0].analysis.stats.forEach((st, i) => {
      if (st.group !== group) { group = st.group; html += `<div class="grp">${names[group] || group}</div>`; }
      html += `<div class="k">${esc(st.label)}</div>` + list.map((e, j) => `<div class="v${j ? ' p2' : ''}">${esc(e.analysis.stats[i].value)}</div>`).join('');
    });
    stats.innerHTML = html;
    const max = Math.max(0.1, ...list.flatMap((e) => e.analysis.splits.map((sp) => sp.split)));
    $('analysis-splits').innerHTML = '<div class="splits-title">HURDLE SPLITS　ハードルごとの区間タイム（1台目はスタートから）</div>' + list.map((e) => {
      const byIndex = new Map(e.analysis.splits.map((sp) => [sp.i, sp]));
      let row = `<div class="splits-row" style="--c:${e.color}"><span class="who">${duo ? esc(e.label) : 'TIME'}</span>`;
      for (let i = 0; i < hurdleDistances.length; i++) {
        const sp = byIndex.get(i);
        row += sp
          ? `<div class="split${sp.hit ? ' hit' : ''}"><b>${sp.split.toFixed(2)}</b><i style="height:${Math.round((sp.split / max) * 62)}%"></i><span>H${i + 1}${sp.hit ? ' ✕' : ''}</span></div>`
          : `<div class="split none"><b>—</b><i></i><span>H${i + 1}</span></div>`;
      }
      return `${row}</div>`;
    }).join('');
  }
  const openAnalysis = (open) => { $analysis.style.display = open ? '' : 'none'; stage.classList.toggle('analysis-open', open); };
  $('btn-analysis').addEventListener('click', () => openAnalysis(true));
  $('close-analysis').addEventListener('click', () => openAnalysis(false));
  $('export-json').addEventListener('click', () => handlers.onExport('json'));
  $('export-csv').addEventListener('click', () => handlers.onExport('csv'));

  // ------------------------------------------------------------ raw data recording controls
  const recToggles = [$('rec-toggle'), $('rec-toggle-2')];
  recToggles.forEach((t) => t.addEventListener('change', () => handlers.onRecord(t.checked)));
  $('rec-last-json').addEventListener('click', () => handlers.onExport('json'));
  $('rec-last-csv').addEventListener('click', () => handlers.onExport('csv'));
  $('rec-all').addEventListener('click', () => handlers.onExport('all'));
  $('rec-clear').addEventListener('click', () => { if (window.confirm('保存済みの記録をすべて消去しますか？ / Delete every stored recording?')) handlers.onExport('clear'); });
  /** st: { recording, active, count, hasLast } */
  function setRecState(st) {
    recToggles.forEach((t) => { t.checked = st.recording; });
    stage.classList.toggle('recording', st.active);
    setText($('rec-count'), `保存済み ${st.count} 件`);
    setText($('rec-count-dock'), st.count ? `${st.count} 件` : '');
    for (const id of ['rec-last-json', 'rec-last-csv', 'export-json', 'export-csv']) $(id).disabled = !st.hasLast;
    for (const id of ['rec-all', 'rec-clear']) $(id).disabled = !st.count;
  }

  renderCopy();
  return {
    setRecState,
    huds, setScreen, countdown, countdownGo, showFinish, showFinishVs, updateBoard, pollSensors, setDrawer,
    setMode(m) { mode = m; renderCopy(); },
    /** type: 'core' | 'insole'. failed: INSOLE was chosen but its scripts did not load. */
    setDevice(type, failed) {
      device = type; renderCopy();
      if (failed) { const n = $('ble-support-message'); n.textContent = 'ORPHE INSOLE のライブラリを読み込めませんでした（ネットワークを確認してください）。ORPHE CORE で動作しています。'; n.style.display = 'block'; }
    },
    setInsoleToe(mode2, state) { $('insole-toe').value = mode2; setText($('insole-toe-state'), state); },
    setRules(r) { rules = { ...r }; renderCopy(); },
    setCinema(on) { stage.classList.toggle('cinema', on); },
    setBest(time) { setText($('best-time'), time ? time.toFixed(2) : '--.--'); },
    setFps(fps, label) { setText($('fps-value'), `${Math.round(fps)} fps${label ? ` · ${label}` : ''}`); },
    setLogo(dataUrl) { const img = $('brand-logo'); img.src = dataUrl; img.hidden = false; },
    loadingDone() { $('loading').classList.add('done'); },
    loadingError(message) { const l = $('loading'); l.classList.add('error'); l.querySelector('.loading-text').textContent = message; },
  };
}
