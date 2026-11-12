/**
 * ORPHE INSOLE の接続（うどんふみふみ）
 *
 * CORE の接続（scripts.js と CoreToolkit）には手を入れていません。このファイルは、画面上の切り替えで
 * INSOLE をえらんだときに使う、もうひとつの入口です。
 *
 *   OrpheInsole（ORPHE-INSOLE.js）
 *     gotConvertedAcc → UdonGame.pushInsoleAcc(foot, acc)   … 足の動き（CORE を足うらに付けたのと同じ扱い）
 *     gotPress        → UdonGame.pushPress(foot, values)    … 6ch の圧力（足うらの押しぐあい）
 *     gotConvertedGyro → UdonGame.pushInsoleGyro(foot, gyro) … 生データのきろく用（ふみの判定には使わない）
 *
 * 公式の接続 UI（InsoleToolkit.js）は、CoreToolkit.js と同じページには読み込めません
 * （グローバル変数 bles / cores と、スイッチの id がぶつかる）。そのため SDK を直接使う小さな
 * スイッチを自前で持っています。SDK 本体は IIFE で包まれていて、ORPHE-CORE.js と共存できます。
 *
 * 左右について: CORE は「01 = 左、02 = 右」の約束ですが、INSOLE は自分が左右どちら用かを知っています
 * （device_information.mount_position の bit0。0 = 左、1 = 右）。そこで 01・02 のどちらのスイッチで
 * つないでも、左のインソールは左足、右のインソールは右足としてゲームへ渡します。
 */
(function () {
  'use strict';

  var PLACEHOLDERS = ['insole_placeholder1', 'insole_placeholder2'];
  // mode 3 = gyro + acc + press（200Hz）。姿勢（クォータニオン）は使わないので、いちばん細かく届くモードにする。
  // insole15 は INSOLE 1.5 だけに効く設定: 表示が遅れてきたら、古いデータを飛ばして最新に追いつく
  var BEGIN_OPTIONS = { streamingMode: 3, autoReconnect: true, reconnectIntervalMs: 2000, insole15: { maxLagMs: 300 } };
  var NOTE = { off: '', connecting: '接続中…', on: '', retry: '再接続中…' };

  var available = typeof OrpheInsole === 'function';
  var bluetooth = typeof navigator !== 'undefined' && !!navigator.bluetooth;
  var insoles = available ? [new OrpheInsole(0), new OrpheInsole(1)] : [];
  var slots = [0, 1].map(function (i) {
    return { index: i, state: 'off', side: null, foot: i, hz: 0, lost: 0, input: null, badge: null, note: null };
  });

  function game() { return window.UdonGame; }

  /** ゲームへ知らせる。ゲーム側で何か起きても、接続の状態（スイッチ）は巻きこまない */
  function notify(foot, type) {
    try {
      if (game()) game().insoleEvent(foot, type);
    } catch (error) {
      console.warn('[ORPHE INSOLE]', error);
    }
  }

  /** 0 = 左, 1 = 右, null = まだ分からない */
  function sideOf(index) {
    var info = insoles[index] && insoles[index].device_information;
    var mp = info ? info.mount_position : null;
    return (typeof mp === 'number' && isFinite(mp)) ? (mp & 1) : null;
  }

  /** どちらの足のデータとしてゲームへ渡すかを決め直す */
  function remap() {
    slots.forEach(function (s) { s.side = s.state === 'off' ? null : sideOf(s.index); });
    var a = slots[0].side, b = slots[1].side;
    var feet = [0, 1];
    if (a !== null && b !== null) {
      // 左右がそろっていればそのとおりに。同じ側が 2 枚のときは、01 = 左、02 = 右として扱う
      if (a !== b) feet = [a, b];
    } else if (a !== null) {
      feet = [a, 1 - a];
    } else if (b !== null) {
      feet = [1 - b, b];
    }
    var changed = feet[0] !== slots[0].foot || feet[1] !== slots[1].foot;
    slots[0].foot = feet[0];
    slots[1].foot = feet[1];
    if (changed) notify(0, 'remap');
    render();
  }

  function setState(index, state) {
    slots[index].state = state;
    if (state === 'off') { slots[index].hz = 0; slots[index].lost = 0; }
    render();
  }

  function render() {
    slots.forEach(function (s) {
      if (!s.input) return;
      s.input.checked = s.state !== 'off';
      s.input.disabled = !available || !bluetooth || s.state === 'connecting';
      s.note.textContent = NOTE[s.state];
      var known = s.state !== 'off' && s.side !== null;
      s.badge.hidden = !known;
      s.badge.textContent = known ? (s.foot === 0 ? '左' : '右') : '';
      s.badge.dataset.foot = s.foot;
    });
  }

  function isCancel(error) {
    var message = error && error.message ? error.message : String(error);
    return Boolean(error && error.name === 'NotFoundError') || /cancel|chooser/i.test(message);
  }

  function connect(index) {
    var s = slots[index], insole = insoles[index];
    if (!insole || s.state !== 'off') return;
    setState(index, 'connecting');
    // then の 2 つめに失敗時の処理を渡す（つながったあとの処理で何か起きても、接続を切らないため）
    insole.begin('SENSOR_VALUES', BEGIN_OPTIONS).then(function () {
      if (slots[index].state !== 'connecting') return;   // 待っている間にスイッチを切った
      setState(index, 'on');
      remap();
      notify(slots[index].foot, 'connect');
    }, function (error) {
      var was = slots[index].state;
      try { insole.reset(); } catch (e) { /* つながる前に失敗したときは、切るものがない */ }
      setState(index, 'off');
      remap();
      if (was === 'connecting' && !isCancel(error)) notify(slots[index].foot, 'error');
    });
  }

  function disconnect(index) {
    var foot = slots[index].foot;
    setState(index, 'off');
    try { insoles[index].reset(); } catch (e) { /* すでに切れている */ }
    remap();
    notify(foot, 'disconnect');
  }

  function build(index) {
    var s = slots[index];
    var host = document.getElementById(PLACEHOLDERS[index]);
    if (!host) return;
    var id = 'switch_insole' + index;
    var no = '0' + (index + 1);
    host.innerHTML =
      '<div class="form-check form-switch u-insole">' +
      '<input class="form-check-input" type="checkbox" role="switch" id="' + id + '" aria-label="ORPHE INSOLE ' + no + ' をつなぐ">' +
      '<label class="form-check-label" for="' + id + '">' + no + '</label>' +
      '<span class="u-insole-badge" hidden></span>' +
      '<span class="u-insole-note" aria-live="polite"></span>' +
      '</div>';
    s.input = host.querySelector('input');
    s.badge = host.querySelector('.u-insole-badge');
    s.note = host.querySelector('.u-insole-note');
    if (!available) s.input.title = 'ORPHE INSOLE の SDK を読み込めませんでした。インターネット接続をたしかめて、ページを開き直してください';
    else if (!bluetooth) s.input.title = 'このブラウザは Web Bluetooth に対応していません。Chrome で開いてください';
    s.input.addEventListener('change', function () {
      if (s.input.checked) connect(index);
      else disconnect(index);
    });
  }

  function wire(index) {
    var s = slots[index], insole = insoles[index];
    insole.setup();

    insole.gotConvertedAcc = function (acc) {
      // スイッチを切ったあとに遅れて届いたデータは捨てる（もう片方の足に割り当て直されているかもしれない）
      if (s.state === 'off') return;
      // begin() が終わる前にデータが届きはじめる。左右が読めたら、すぐに割り当てる
      if (s.side === null && sideOf(index) !== null) remap();
      if (acc && game()) game().pushInsoleAcc(s.foot, acc);
    };
    insole.gotConvertedGyro = function (gyro) {
      if (s.state === 'off') return;
      if (gyro && game()) game().pushInsoleGyro(s.foot, gyro);
    };
    insole.gotPress = function (press) {
      if (s.state === 'off') return;
      if (press && press.values && game()) game().pushPress(s.foot, press.values);
    };
    // 届かなかったパケットの数（生データのきろくの先頭に書く。通信の落ち方の目安）
    insole.lostData = function () { s.lost++; };
    insole.gotBLEFrequency = function (hz) { s.hz = hz; };

    insole.onDisconnect = function () {
      // 自分でスイッチを切ったときは disconnect() が後始末をする。ここは電池切れ・電波切れのとき
      if (s.state !== 'on') return;
      setState(index, 'retry');
      notify(s.foot, 'disconnect');
    };
    insole.onReconnectSuccess = function () {
      if (s.state === 'off') return;
      setState(index, 'on');
      remap();
      notify(s.foot, 'connect');
    };
    insole.onReconnectFailed = function () {
      if (s.state === 'off') return;
      try { insole.reset(); } catch (e) { /* すでに切れている */ }
      setState(index, 'off');
      remap();
    };
    insole.onError = function (error) {
      // 選択ダイアログを閉じただけのときは、何も言わない
      if (!isCancel(error)) console.warn('[ORPHE INSOLE 0' + (index + 1) + ']', error);
    };
  }

  build(0);
  build(1);
  if (available) { wire(0); wire(1); }
  render();

  window.UdonInsole = {
    /** SDK を読み込めたか（CDN に届かなかったときは false。CORE とおためしモードは使える） */
    available: available,
    bluetooth: bluetooth,
    insoles: insoles,
    /** 表示用: スイッチごとの状態。foot = ゲームに渡している足（0 = 左, 1 = 右） */
    status: function () {
      return slots.map(function (s) { return { state: s.state, side: s.side, foot: s.foot, hz: s.hz }; });
    },
    /** 生データのきろく用: そのスイッチにつないだ INSOLE のようす（1 行の文字列） */
    describe: function (index) {
      var s = slots[index], insole = insoles[index];
      if (!s || !insole || s.state === 'off') return 'off';
      var info = insole.device_information || {};
      var val = function (v) { return (v === null || v === undefined || v === '') ? 'n/a' : String(v); };
      return [
        s.state, 'foot=' + (s.foot === 0 ? 'L' : 'R'), 'side=' + (s.side === null ? 'unknown' : (s.side === 0 ? 'L' : 'R')),
        'hz=' + val(s.hz), 'lost_packets=' + s.lost, 'generation=' + val(insole.generation),
        'firmware=' + val(insole.firmware_version), 'battery=' + val(info.battery), 'mount_position=' + val(info.mount_position),
        'range_acc=' + val(info.range && info.range.acc), 'range_gyro=' + val(info.range && info.range.gyro)
      ].join(' ');
    }
  };
})();
