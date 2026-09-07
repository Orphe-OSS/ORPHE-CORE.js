'use strict';

// ORPHE-CORE.js と ORPHE-INSOLE.js（実物）を同一ページに両方読み込んだときの共存テスト。
//
// INSOLE 側の tests/insole-coexistence.test.js は CORE を「スタブ」で代用している。ここでは実物の
// js/ORPHE-CORE.js と、リリース済み INSOLE dist を同じ vm コンテキストに読み込み、読み込み順の両方で
//  - グローバル `Orphe` は常に CORE（INSOLE は `OrpheInsole`）
//  - どちらのクラスもインスタンス化でき、機種固有 API（CORE: setLED / INSOLE: gotPress）で識別できる
//  - 補助クラス（FixedSizeArray / OrpheTimestamp）と CoreToolkit が参照するグローバル（orphe_js_version_date）が壊れない
//  - 読み込み時に例外（重複宣言の SyntaxError 等）が出ない
// を検証する。CORE を IIFE 化する際の回帰テスト（Phase 1b）。
//
// INSOLE dist の取得順: 環境変数 ORPHE_INSOLE_DIST（ファイルパス）→ 兄弟ディレクトリ
// ../ORPHE-INSOLE.js/dist/orphe-insole.js → jsDelivr の固定タグ（INSOLE_PIN）。いずれも無ければ SKIP。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const CORE_PATH = process.env.ORPHE_CORE_JS || path.join(ROOT, 'js', 'ORPHE-CORE.js');
const INSOLE_PIN = 'v1.3.4';
const INSOLE_CDN = `https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-INSOLE.js@${INSOLE_PIN}/dist/orphe-insole.js`;

async function loadInsoleSource() {
  // 取得順: 環境変数 → jsDelivr の固定タグ（CI・通常）→ 兄弟ディレクトリ（オフライン時のフォールバック。
  // 手元のコピーは古い版のことがあるので、その場合は警告を出す）
  if (process.env.ORPHE_INSOLE_DIST && fs.existsSync(process.env.ORPHE_INSOLE_DIST)) {
    return { source: fs.readFileSync(process.env.ORPHE_INSOLE_DIST, 'utf8'), from: process.env.ORPHE_INSOLE_DIST };
  }
  if (typeof fetch === 'function') {
    try {
      const res = await fetch(INSOLE_CDN);
      if (res.ok) return { source: await res.text(), from: INSOLE_CDN };
    } catch (_) { /* offline */ }
  }
  const sibling = path.join(ROOT, '..', 'ORPHE-INSOLE.js', 'dist', 'orphe-insole.js');
  if (fs.existsSync(sibling)) {
    console.warn(`core-insole-coexistence: WARNING — offline, using sibling checkout ${sibling} (may not be ${INSOLE_PIN})`);
    return { source: fs.readFileSync(sibling, 'utf8'), from: sibling };
  }
  return null;
}

function createContext() {
  const documentMock = {
    readyState: 'complete',
    currentScript: null,
    scripts: [],
    head: { appendChild() { } },
    createElement: () => ({}),
    addEventListener() { },
  };
  const ctx = vm.createContext({
    console, performance, Date, Math, JSON, Promise, Number, Object, Array, String, Error, TypeError,
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: documentMock,
    navigator: {},
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    DataView, ArrayBuffer, Uint8Array, Int8Array, Int16Array, Uint16Array, Float32Array,
  });
  ctx.globalThis = ctx;
  ctx.window = ctx;
  ctx.self = ctx;
  return ctx;
}

const PROBE = `({
  orpheType: typeof Orphe,
  insoleType: typeof OrpheInsole,
  orpheIsCore: typeof Orphe === 'function' && typeof Orphe.prototype.setLED === 'function' && typeof Orphe.prototype.gotPress !== 'function',
  insoleIsInsole: typeof OrpheInsole === 'function' && typeof OrpheInsole.prototype.gotPress === 'function' && typeof OrpheInsole.prototype.setDataStreamingMode === 'function',
  distinct: typeof Orphe === 'function' && typeof OrpheInsole === 'function' && Orphe !== OrpheInsole,
  coreInstance: (() => { try { const o = new Orphe(0); return o.id === 0 && typeof o.setup === 'function'; } catch (e) { return 'throw:' + e.message; } })(),
  insoleInstance: (() => { try { const i = new OrpheInsole(1); return i.id === 1 && typeof i.setup === 'function'; } catch (e) { return 'throw:' + e.message; } })(),
  helpers: typeof FixedSizeArray === 'function' && typeof OrpheTimestamp === 'function',
  versionDate: typeof orphe_js_version_date === 'string',
  quaternion: typeof Quaternion,
})`;

function run(ctx, source, filename) {
  vm.runInContext(source, ctx, { filename });
}

async function main() {
  const core = fs.readFileSync(CORE_PATH, 'utf8');
  const insole = await loadInsoleSource();
  if (!insole) {
    console.log('core-insole-coexistence: SKIP (ORPHE-INSOLE.js dist not available offline)');
    return;
  }
  console.log(`core-insole-coexistence: INSOLE from ${insole.from}`);

  // 1. CORE 単独
  {
    const ctx = createContext();
    run(ctx, core, 'ORPHE-CORE.js');
    const r = vm.runInContext(PROBE, ctx);
    assert.equal(r.orpheIsCore, true, 'CORE alone: Orphe is CORE');
    assert.equal(r.coreInstance, true, 'CORE alone: instantiable');
    assert.equal(r.helpers, true, 'CORE alone: FixedSizeArray / OrpheTimestamp exposed');
    assert.equal(r.versionDate, true, 'CORE alone: orphe_js_version_date exposed (CoreToolkit reads it)');
  }

  // 2. CORE → INSOLE
  {
    const ctx = createContext();
    run(ctx, core, 'ORPHE-CORE.js');
    run(ctx, insole.source, 'orphe-insole.js');
    const r = vm.runInContext(PROBE, ctx);
    assert.equal(r.orpheIsCore, true, 'CORE→INSOLE: Orphe must stay CORE');
    assert.equal(r.insoleIsInsole, true, 'CORE→INSOLE: OrpheInsole is INSOLE');
    assert.equal(r.distinct, true);
    assert.equal(r.coreInstance, true);
    assert.equal(r.insoleInstance, true);
    assert.equal(r.helpers, true);
    assert.equal(r.quaternion, 'function', 'CORE→INSOLE: Quaternion available (INSOLE dist bundles it, CORE autoload is a no-op in vm)');
  }

  // 3. INSOLE → CORE（INSOLE が先に Orphe エイリアスを置いても CORE が勝つこと）
  {
    const ctx = createContext();
    run(ctx, insole.source, 'orphe-insole.js');
    run(ctx, core, 'ORPHE-CORE.js');
    const r = vm.runInContext(PROBE, ctx);
    assert.equal(r.orpheIsCore, true, 'INSOLE→CORE: Orphe must resolve to CORE after CORE loads');
    assert.equal(r.insoleIsInsole, true, 'INSOLE→CORE: OrpheInsole is INSOLE');
    assert.equal(r.distinct, true);
    assert.equal(r.coreInstance, true);
    assert.equal(r.insoleInstance, true);
    assert.equal(r.helpers, true);
  }

  // 4. INSOLE 単独（後方互換: Orphe エイリアスは INSOLE）
  {
    const ctx = createContext();
    run(ctx, insole.source, 'orphe-insole.js');
    const r = vm.runInContext(`({ alias: typeof Orphe === 'function' && Orphe === OrpheInsole })`, ctx);
    assert.equal(r.alias, true, 'INSOLE alone: Orphe alias points to OrpheInsole');
  }

  // 5. 同じファイルを 2 回読み込んでも例外にならず、Orphe の参照（既存インスタンスの instanceof）も壊れない
  //    （IIFE 化前はトップレベル class / const の重複宣言で SyntaxError になっていた）
  {
    const ctx = createContext();
    run(ctx, core, 'ORPHE-CORE.js');
    const first = ctx.Orphe;
    const instance = vm.runInContext('new Orphe(0)', ctx);
    run(ctx, core, 'ORPHE-CORE.js (again)');
    assert.equal(ctx.Orphe, first, 'loading CORE twice must keep the first Orphe reference');
    assert.equal(vm.runInContext('(o) => o instanceof Orphe', ctx)(instance), true, 'existing instances stay instanceof Orphe');
    assert.equal(ctx.Orphe.SDK, 'ORPHE-CORE.js', 'Orphe carries the SDK marker');
  }

  // 6. INSOLE → CORE → CORE: INSOLE のエイリアスは CORE に差し替わり、その後の再読み込みでも維持される
  {
    const ctx = createContext();
    run(ctx, insole.source, 'orphe-insole.js');
    run(ctx, core, 'ORPHE-CORE.js');
    const coreRef = ctx.Orphe;
    run(ctx, core, 'ORPHE-CORE.js (again)');
    assert.equal(ctx.Orphe, coreRef);
    assert.equal(ctx.Orphe.SDK, 'ORPHE-CORE.js');
    assert.equal(ctx.OrpheInsole.SDK, undefined, 'OrpheInsole is untouched');
  }

  // 7. Node の require() でも公開される（テスト・ツール用）
  {
    const mod = require(CORE_PATH);
    assert.equal(typeof mod.Orphe, 'function');
    assert.equal(typeof mod.FixedSizeArray, 'function');
    assert.equal(typeof mod.orpheCoreSerialDistance, 'function');
  }

  console.log('core-insole-coexistence: OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
