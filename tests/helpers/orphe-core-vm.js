// js/ORPHE-CORE.js はトップレベルで document を参照するため require できない。
// tests/core2-header40-parse.test.js / tests/core-header50-sample-timestamps.test.js と同じく
// vm コンテキストで評価して Orphe クラスを取り出す共通ハーネス。
//
//   const { loadOrphe } = require('./helpers/orphe-core-vm');
//   const { Orphe, context } = loadOrphe({ console: fakeConsole });
//
// options.console を渡すと SDK 内の console.* 呼び出しをそこに向けられる（ログ抑制のテスト用）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');

function loadOrphe(options = {}) {
  const context = {
    console: options.console || console,
    window: {},
    navigator: options.navigator || {},
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    document: {
      readyState: 'complete',
      scripts: [],
      head: { appendChild() {} },
      createElement() { return {}; },
      addEventListener() {},
    },
    setTimeout,
    clearTimeout,
    performance: { now() { return Date.now(); } },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/quaternion.js'), 'utf8'), context);
  vm.runInContext(
    `${fs.readFileSync(path.join(root, 'js/ORPHE-CORE.js'), 'utf8')}\nthis.Orphe = Orphe;\nthis.orpheCoreSerialDistance = orpheCoreSerialDistance;`,
    context
  );
  if (typeof context.Orphe !== 'function') {
    throw new Error('Orphe class was not exposed in the VM context.');
  }
  return { Orphe: context.Orphe, orpheCoreSerialDistance: context.orpheCoreSerialDistance, context };
}

module.exports = { loadOrphe };
