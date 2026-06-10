// ORPHE-CORE.js と同一ページに読み込んでも識別子衝突しないことの回帰テスト。
// CORE 本体には依存せず、CORE がトップレベルに宣言するクラス群をスタブで再現する。
// （トップレベルの class 宣言はグローバルなレキシカル束縛を作るため、
//   同名宣言が2スクリプトにあると後勝ち側全体が SyntaxError で死ぬ）
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INSOLE_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'ORPHE-INSOLE.js'), 'utf8');

// ORPHE-CORE.js がトップレベルで宣言する識別子のスタブ
const CORE_STUB = `
var orphe_js_version_date = 'core-stub';
function loadScript(src) {}
class FixedSizeArray { constructor(size) { this.size = size; } }
class OrpheTimestamp { }
class Orphe { constructor(id = 0) { this.id = id; this.isCore = true; } }
`;

function createContext() {
  const documentMock = {
    readyState: 'complete',
    scripts: [],
    head: { appendChild() { } },
    createElement: () => ({}),
    addEventListener() { },
  };
  const ctx = vm.createContext({
    console, performance, Date, Math, JSON, Promise, Number, Object, Array,
    setTimeout, clearTimeout,
    document: documentMock,
    navigator: {},
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    DataView, ArrayBuffer, Uint8Array,
  });
  ctx.globalThis = ctx;
  ctx.window = ctx;
  return ctx;
}

async function main() {
  // ── CORE(スタブ) → INSOLE の順 ──────────────────────────────
  {
    const ctx = createContext();
    vm.runInContext(CORE_STUB, ctx, { filename: 'ORPHE-CORE.js (stub)' });
    vm.runInContext(INSOLE_SRC, ctx, { filename: 'ORPHE-INSOLE.js' });
    const r = vm.runInContext(`({
      orpheIsCore: (new Orphe(0)).isCore === true,
      insoleName: OrpheInsole.name,
      distinct: Orphe !== OrpheInsole,
    })`, ctx);
    assert.equal(r.orpheIsCore, true, 'Orphe must remain CORE when both loaded');
    assert.equal(r.insoleName, 'OrpheInsole');
    assert.equal(r.distinct, true);
  }

  // ── INSOLE → CORE(スタブ) の順 ──────────────────────────────
  {
    const ctx = createContext();
    vm.runInContext(INSOLE_SRC, ctx, { filename: 'ORPHE-INSOLE.js' });
    vm.runInContext(CORE_STUB, ctx, { filename: 'ORPHE-CORE.js (stub)' });
    const r = vm.runInContext(`({
      orpheIsCore: (new Orphe(0)).isCore === true,
      insoleName: OrpheInsole.name,
    })`, ctx);
    assert.equal(r.orpheIsCore, true, 'CORE lexical binding must shadow INSOLE alias');
    assert.equal(r.insoleName, 'OrpheInsole');
  }

  // ── INSOLE 単独（後方互換: Orphe エイリアス） ─────────────────
  {
    const ctx = createContext();
    vm.runInContext(INSOLE_SRC, ctx, { filename: 'ORPHE-INSOLE.js' });
    const r = vm.runInContext(`({
      aliasWorks: Orphe === OrpheInsole,
      canInstantiate: (new Orphe(1)).id === 1,
      helpersExposed: typeof FixedSizeArray === 'function'
        && typeof OrpheTimestamp === 'function'
        && typeof parseInsoleSensorValues === 'function',
    })`, ctx);
    assert.equal(r.aliasWorks, true, 'Orphe alias must point to OrpheInsole when alone');
    assert.equal(r.canInstantiate, true);
    assert.equal(r.helpersExposed, true);
  }

  console.log('insole-coexistence.test.js passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
