const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// examples/GAME-UDON/insole-connect.js（ORPHE INSOLE の接続とゲームへの橋渡し）を、Bluetooth なしで実行して確かめる。
//   - CORE の接続（scripts.js・CoreToolkit・グローバルの bles）には触れない
//   - 左右は INSOLE 自身の設定（mount_position の bit0）で決める。01・02 のどちらでつないでも同じ足に届く
//   - 切断・自動再接続・つなげなかったときの状態
const dir = path.join(__dirname, '../examples/GAME-UDON');
const source = fs.readFileSync(path.join(dir, 'insole-connect.js'), 'utf8');

const tick = () => new Promise(resolve => setImmediate(resolve));

/** innerHTML を入れると、スイッチ・左右バッジ・状態表示の 3 つを返す、最小限の DOM */
function makeHost() {
  const parts = {
    input: { checked: false, disabled: false, title: '', listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } },
    '.u-insole-badge': { hidden: true, textContent: '', dataset: {} },
    '.u-insole-note': { textContent: '' },
  };
  return { innerHTML: '', parts, querySelector(sel) { return parts[sel]; } };
}

function boot({ sdk = true, bluetooth = true } = {}) {
  const hosts = { insole_placeholder1: makeHost(), insole_placeholder2: makeHost() };
  const calls = [];
  const instances = [];
  class FakeInsole {
    constructor(id) {
      this.id = id; this.setupCalls = 0; this.resetCalls = 0; this.begins = []; this.device_information = undefined;
      this.plan = { mount: 0, fail: null };
      instances.push(this);
    }
    setup() { this.setupCalls++; }
    begin(type, options) {
      this.begins.push({ type, options });
      return new Promise((resolve, reject) => {
        this.finish = () => {
          if (this.plan.fail) { reject(this.plan.fail); return; }
          if (this.plan.mount !== null) this.device_information = { battery: 2, mount_position: this.plan.mount };
          resolve('done');
        };
      });
    }
    reset() { this.resetCalls++; }
  }
  const context = {
    document: { getElementById(id) { return hosts[id] || null; } },
    navigator: bluetooth ? { bluetooth: {} } : {},
    console: { warn() {} },
    isFinite, Boolean, String,
  };
  context.window = context;
  context.UdonGame = {
    pushInsoleAcc(foot, acc) { calls.push(['acc', foot, acc]); },
    pushPress(foot, values) { calls.push(['press', foot, values]); },
    pushInsoleGyro(foot, gyro) { calls.push(['gyro', foot, gyro]); },
    insoleEvent(foot, type) { calls.push(['event', foot, type]); },
  };
  if (sdk) context.OrpheInsole = FakeInsole;
  vm.runInNewContext(source, context);
  const ui = [hosts.insole_placeholder1.parts, hosts.insole_placeholder2.parts];
  const toggle = async (index, on, { settle = true } = {}) => {
    ui[index].input.checked = on;
    ui[index].input.listeners.change();
    if (on && settle) { instances[index].finish(); await tick(); }
  };
  const events = () => calls.filter(c => c[0] === 'event').map(c => `${c[1]}:${c[2]}`);
  return { context, hosts, ui, instances, calls, toggle, events, api: context.UdonInsole };
}

(async () => {
  // 1) 起動: スイッチを 2 つ作り、SDK のインスタンスを 2 つ用意する。CORE 側のグローバルは作らない
  {
    const { context, hosts, ui, instances, api } = boot();
    assert.equal(instances.length, 2);
    assert.deepEqual(instances.map(i => i.setupCalls), [1, 1], 'setup() once per INSOLE');
    assert.deepEqual(instances.map(i => i.begins.length), [0, 0], 'nothing connects until the switch is turned on');
    assert.match(hosts.insole_placeholder1.innerHTML, /id="switch_insole0"/);
    assert.match(hosts.insole_placeholder2.innerHTML, /id="switch_insole1"/);
    assert.doesNotMatch(hosts.insole_placeholder1.innerHTML, /switch_ble/, 'does not reuse the CoreToolkit switch ids');
    assert.equal(ui[0].input.disabled, false);
    assert.equal(api.available, true);
    for (const name of ['bles', 'cores', 'insoles', 'buildCoreToolkit', 'buildInsoleToolkit']) {
      assert.equal(name in context, false, `does not define the global ${name}`);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(api.status())), [
      { state: 'off', side: null, foot: 0, hz: 0 },
      { state: 'off', side: null, foot: 1, hz: 0 },
    ]);
  }

  // 2) つなぐ: 圧力つき・200Hz のモードで、自動再接続を有効にして begin() する
  {
    const { ui, instances, toggle, events, api, calls } = boot();
    await toggle(0, true, { settle: false });
    assert.equal(instances[0].begins.length, 1);
    assert.equal(instances[0].begins[0].type, 'SENSOR_VALUES');
    assert.equal(instances[0].begins[0].options.streamingMode, 3);
    assert.equal(instances[0].begins[0].options.autoReconnect, true);
    assert.equal(api.status()[0].state, 'connecting');
    assert.equal(ui[0].input.disabled, true, 'the switch is locked while connecting');
    assert.equal(ui[0]['.u-insole-note'].textContent, '接続中…');
    instances[0].finish();
    await tick();
    assert.equal(api.status()[0].state, 'on');
    assert.equal(ui[0].input.disabled, false);
    assert.equal(ui[0].input.checked, true);
    assert.deepEqual(events(), ['0:connect']);

    // 左のインソール: 加速度と圧力が左足（0）へ届く
    const acc = { x: 0.1, y: 0, z: 1 };
    instances[0].gotConvertedAcc(acc);
    instances[0].gotPress({ values: [220, 222, 220, 256, 222, 221] });
    assert.deepEqual(calls.at(-2), ['acc', 0, acc]);
    assert.deepEqual(calls.at(-1), ['press', 0, [220, 222, 220, 256, 222, 221]]);
    assert.equal(ui[0]['.u-insole-badge'].hidden, false);
    assert.equal(ui[0]['.u-insole-badge'].textContent, '左');
    instances[0].gotPress(null);
    instances[0].gotPress({});
    instances[0].gotConvertedAcc(undefined);
    assert.equal(calls.filter(c => c[0] !== 'event').length, 2, 'empty samples are dropped');
    instances[0].gotBLEFrequency(187);
    assert.equal(api.status()[0].hz, 187);

    // ジャイロは、生データのきろく用にそのまま渡す
    const gyro = { x: 1, y: -2, z: 3 };
    instances[0].gotConvertedGyro(gyro);
    assert.deepEqual(calls.at(-1), ['gyro', 0, gyro]);
    instances[0].gotConvertedGyro(null);
    assert.equal(calls.filter(c => c[0] === 'gyro').length, 1);

    // きろくの先頭に書く「つないだ INSOLE のようす」: 左右・実測 Hz・落ちたパケット数・電池など
    instances[0].lostData(120, 117);
    instances[0].lostData(130, 128);
    instances[0].firmware_version = '1.0.1';
    instances[0].generation = 1;
    assert.equal(api.describe(0),
      'on foot=L side=L hz=187 lost_packets=2 generation=1 firmware=1.0.1 battery=2 mount_position=0 range_acc=n/a range_gyro=n/a');
    assert.equal(api.describe(1), 'off');
    assert.equal(api.describe(7), 'off');
  }

  // 3) 左右は INSOLE が知っている: 01 に右のインソールをつないでも、右足（1）として届く
  {
    const { ui, instances, toggle, events, api, calls } = boot();
    instances[0].plan.mount = 1;       // 01 のスイッチ = 右のインソール
    instances[1].plan.mount = 0;       // 02 のスイッチ = 左のインソール
    await toggle(0, true);
    assert.equal(api.status()[0].foot, 1);
    assert.equal(ui[0]['.u-insole-badge'].textContent, '右');
    assert.deepEqual(events(), ['0:remap', '1:connect'], 'the game is told that the feet were reassigned');
    await toggle(1, true);
    assert.equal(api.status()[1].foot, 0);
    assert.equal(ui[1]['.u-insole-badge'].textContent, '左');
    instances[0].gotPress({ values: [1, 2, 3, 4, 5, 6] });
    instances[1].gotPress({ values: [6, 5, 4, 3, 2, 1] });
    assert.deepEqual(calls.at(-2).slice(0, 2), ['press', 1]);
    assert.deepEqual(calls.at(-1).slice(0, 2), ['press', 0]);
    // mount_position の bit1（足底 / 足背）は左右に関係しない
    instances[0].device_information.mount_position = 3;
    instances[0].gotPress({ values: [1, 2, 3, 4, 5, 6] });
    assert.deepEqual(calls.at(-1).slice(0, 2), ['press', 1]);
  }

  // 4) 同じ側が 2 枚、または左右が読めないときは、CORE と同じく 01 = 左・02 = 右
  {
    const same = boot();
    same.instances[0].plan.mount = 1;
    same.instances[1].plan.mount = 1;
    await same.toggle(0, true);
    await same.toggle(1, true);
    assert.deepEqual(Array.from(same.api.status(), s => s.foot), [0, 1]);

    const unknown = boot();
    unknown.instances[0].plan.mount = null;
    unknown.instances[1].plan.mount = null;
    await unknown.toggle(0, true);
    await unknown.toggle(1, true);
    assert.deepEqual(Array.from(unknown.api.status(), s => s.foot), [0, 1]);
    assert.equal(unknown.ui[0]['.u-insole-badge'].hidden, true, 'no L/R badge when the side is unknown');

    // 片方だけ読めたら、もう片方はその反対側
    const half = boot();
    half.instances[0].plan.mount = null;
    half.instances[1].plan.mount = 0;
    await half.toggle(0, true);
    await half.toggle(1, true);
    assert.deepEqual(Array.from(half.api.status(), s => s.foot), [1, 0]);
  }

  // 5) 電波切れ → 自動再接続 → 復帰。あきらめたらスイッチが戻る
  {
    const { ui, instances, toggle, events, api } = boot();
    await toggle(0, true);
    instances[0].onDisconnect();
    assert.equal(api.status()[0].state, 'retry');
    assert.equal(ui[0]['.u-insole-note'].textContent, '再接続中…');
    assert.equal(ui[0].input.checked, true, 'the switch stays on while reconnecting');
    assert.equal(events().at(-1), '0:disconnect');
    instances[0].onDisconnect();
    assert.equal(events().filter(e => e === '0:disconnect').length, 1, 'a repeated callback is not reported twice');
    instances[0].onReconnectSuccess({ attempt: 2 });
    assert.equal(api.status()[0].state, 'on');
    assert.equal(events().at(-1), '0:connect');

    instances[0].onDisconnect();
    instances[0].onReconnectFailed({ maxAttempts: 120 });
    assert.equal(api.status()[0].state, 'off');
    assert.equal(ui[0].input.checked, false);
    assert.equal(instances[0].resetCalls, 1);
  }

  // 6) スイッチを切る: reset() して、ゲームに知らせる。そのあとの SDK のコールバックでは状態を変えない
  {
    const { ui, instances, toggle, events, api, calls } = boot();
    await toggle(0, true);
    await toggle(0, false);
    assert.equal(instances[0].resetCalls, 1);
    assert.equal(api.status()[0].state, 'off');
    assert.equal(ui[0]['.u-insole-badge'].hidden, true);
    assert.equal(events().at(-1), '0:disconnect');
    const before = events().length;
    instances[0].onDisconnect();
    instances[0].onReconnectSuccess({});
    instances[0].onReconnectFailed({});
    assert.equal(api.status()[0].state, 'off');
    assert.equal(events().length, before);
    assert.equal(instances[0].resetCalls, 1);
    // スイッチを切ったあとに遅れて届いたデータは、ゲームへ渡さない
    const forwarded = () => calls.filter(c => c[0] !== 'event').length;
    const n = forwarded();
    instances[0].gotConvertedAcc({ x: 0, y: 0, z: 1 });
    instances[0].gotConvertedGyro({ x: 0, y: 0, z: 0 });
    instances[0].gotPress({ values: [220, 222, 220, 256, 222, 221] });
    assert.equal(forwarded(), n, 'late packets after switching off are dropped');
    // もう一度つなげる
    await toggle(0, true);
    assert.equal(instances[0].begins.length, 2);
    assert.equal(api.status()[0].state, 'on');
    instances[0].gotPress({ values: [220, 222, 220, 256, 222, 221] });
    assert.equal(forwarded(), n + 1);
  }

  // 6b) つながったあと、ゲーム側の処理で例外が出ても、接続は切らない（スイッチも戻さない）
  {
    const { context, ui, instances, toggle, api } = boot();
    context.UdonGame.insoleEvent = () => { throw new Error('boom'); };
    await toggle(0, true);
    assert.equal(api.status()[0].state, 'on');
    assert.equal(ui[0].input.checked, true);
    assert.equal(instances[0].resetCalls, 0, 'a game-side error must not reset a connected INSOLE');
    assert.doesNotThrow(() => instances[0].onDisconnect());
    assert.equal(api.status()[0].state, 'retry');
  }

  // 7) つなげなかったとき: 選択ダイアログを閉じただけなら何も言わない。ほかの失敗はゲームに知らせる
  {
    const cancelled = boot();
    cancelled.instances[0].plan.fail = Object.assign(new Error('User cancelled the requestDevice() chooser.'), { name: 'NotFoundError' });
    await cancelled.toggle(0, true);
    assert.equal(cancelled.api.status()[0].state, 'off');
    assert.equal(cancelled.ui[0].input.checked, false);
    assert.deepEqual(cancelled.events(), []);
    assert.equal(cancelled.instances[0].resetCalls, 1);
    assert.doesNotThrow(() => cancelled.instances[0].onError(cancelled.instances[0].plan.fail));

    const failed = boot();
    failed.instances[1].plan.fail = new Error('GATT Server is disconnected.');
    await failed.toggle(1, true);
    assert.equal(failed.api.status()[1].state, 'off');
    assert.deepEqual(failed.events(), ['1:error']);
  }

  // 8) SDK を読み込めなかった・Web Bluetooth が無い: スイッチは押せないが、ページは壊れない
  {
    const none = boot({ sdk: false });
    assert.equal(none.api.available, false);
    assert.equal(none.ui[0].input.disabled, true);
    assert.match(none.ui[0].input.title, /SDK を読み込めませんでした/);
    assert.equal(none.api.status().length, 2);

    const noBle = boot({ bluetooth: false });
    assert.equal(noBle.api.available, true);
    assert.equal(noBle.api.bluetooth, false);
    assert.equal(noBle.ui[1].input.disabled, true);
    assert.match(noBle.ui[1].input.title, /Web Bluetooth/);
  }

  // 9) index.html: CORE の接続がすべて済んでから INSOLE の SDK を読み込む。バージョンと中身を固定する
  {
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const tags = Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g), m => ({ src: m[1], tag: m[0] }));
    const order = name => tags.findIndex(t => t.src === name || t.src.endsWith('/' + name));
    const sdk = tags.find(t => /ORPHE-INSOLE\.js@/.test(t.src));
    assert.ok(sdk, 'the INSOLE SDK is loaded');
    assert.match(sdk.src, /^https:\/\/cdn\.jsdelivr\.net\/gh\/Orphe-OSS\/ORPHE-INSOLE\.js@v\d+\.\d+\.\d+\/dist\/orphe-insole\.min\.js$/,
      'pinned to a release tag (never @latest / @main)');
    assert.match(sdk.tag, /\bintegrity="sha384-[A-Za-z0-9+/=]{64}"/, 'with a subresource integrity hash');
    assert.match(sdk.tag, /\bcrossorigin="anonymous"/);
    assert.match(sdk.tag, /\bdefer\b/);
    assert.ok(order('scripts.js') >= 0 && order('scripts.js') < tags.indexOf(sdk), 'after the CORE bridge has run');
    assert.ok(tags.indexOf(sdk) < order('insole-connect.js'));
    assert.ok(order('game.js') < order('insole-connect.js'), 'UdonGame is defined before the INSOLE bridge runs');
    assert.ok(order('insole-pressure.js') >= 0 && order('insole-pressure.js') < order('game.js'));
    // 公式の InsoleToolkit.js は CoreToolkit.js とグローバル変数・DOM の id がぶつかるので、読み込まない
    assert.equal(tags.some(t => /InsoleToolkit/i.test(t.src)), false);
    for (const id of ['insole_placeholder1', 'insole_placeholder2', 'deviceSwitch', 'tabSole', 'soleReport', 'tryMap0', 'tryMap1']) {
      assert.ok(html.includes(`id="${id}"`), `#${id} exists`);
    }
    assert.match(html, /data-device="core"/);
    assert.match(html, /data-device="insole"/);
    // CORE の接続口はそのまま
    for (const id of ['toolkit_placeholder1', 'toolkit_placeholder2']) assert.ok(html.includes(`id="${id}"`));
    assert.ok(order('../../js/CoreToolkit.js') < order('scripts.js'));
  }

  console.log('udon-insole-bridge.test.js passed');
})().catch((error) => { console.error(error); process.exit(1); });
