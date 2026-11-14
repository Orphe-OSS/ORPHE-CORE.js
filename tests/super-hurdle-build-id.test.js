const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// GAME-SUPER-HURDLE is several ES modules. Each one, and the stylesheet, is requested with the same
// ?v= build id so that a browser never mixes an old cached module with new ones. The id lives
// only in index.html: on the main.js and style.css tags, and in the import map for the modules
// main.js imports. This test keeps those in step with the imports that actually exist.
const dir = path.join(__dirname, '../examples/GAME-SUPER-HURDLE');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
const mainTag = /<script type="module" src="main\.js\?v=([\w.-]+)"><\/script>/.exec(html);
const cssTag = /<link rel="stylesheet" href="style\.css\?v=([\w.-]+)">/.exec(html);
assert.ok(mainTag, 'main.js is loaded with a ?v= build id');
assert.ok(cssTag, 'style.css is loaded with a ?v= build id');
const build = mainTag[1];
assert.equal(cssTag[1], build, 'style.css and main.js carry the same build id');

// every local module imported anywhere in the game is remapped to the same build id
const localImports = new Set();
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const m of source.matchAll(/^\s*import\s[^'"]*['"](\.\/[^'"]+)['"]/gm)) localImports.add(m[1]);
  assert.ok(!/import\(\s*['"]\.\//.test(source), `${file}: dynamic local imports would bypass the import map`);
}
assert.ok(localImports.size >= 8, 'found the game modules');
for (const spec of localImports) {
  assert.equal(map[spec], `${spec}?v=${build}`, `import map entry for ${spec} carries build id ${build}`);
}
for (const [spec, target] of Object.entries(map)) {
  if (!spec.startsWith('./')) continue;
  assert.ok(localImports.has(spec), `import map entry ${spec} is still imported somewhere`);
  assert.ok(fs.existsSync(path.join(dir, target.split('?')[0])), `${target} exists`);
}

console.log('super-hurdle-build-id.test.js passed');
