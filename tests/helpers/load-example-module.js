const fs = require('node:fs');
const vm = require('node:vm');

/**
 * Evaluate a dependency-free browser ES module from examples/ in a vm context and
 * return its exports. package.json has no "type": "module", so a plain `import()`
 * of a `.js` file with `export` fails on Node 18 / 20; stripping the `export`
 * keyword keeps the file loadable by the browser as a module and by the tests.
 * The module must not contain `import` statements or `export default`.
 */
function loadExampleModule(file, globals = {}) {
  const source = fs.readFileSync(file, 'utf8');
  if (/^\s*import\s/m.test(source)) throw new Error(`${file}: imports are not supported by this loader`);
  const names = [];
  const body = source.replace(
    /^export\s+(?=(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*))/gm,
    (match, name) => { names.push(name); return ''; }
  );
  if (/^export\s/m.test(body)) throw new Error(`${file}: unsupported export form`);
  const context = vm.createContext({ console, Math, performance: { now: () => 0 }, ...globals });
  const script = new vm.Script(`${body}\n;({ ${names.join(', ')} })`, { filename: file });
  return script.runInContext(context);
}

module.exports = { loadExampleModule };
