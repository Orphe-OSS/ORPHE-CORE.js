const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// GAME-SUPER-ADVENTURE is several ES modules. A browser that keeps an old copy of one of them
// next to new copies of the others breaks in confusing ways, so the page requests every module
// and the stylesheet with one ?v= build id (see index.html). This test keeps them in step:
//   - one id on main.js, style.css and every import-map entry for a local module
//   - every local module reachable from main.js is in the import map
const examples = path.join(__dirname, '../examples');
const dir = path.join(examples, 'GAME-SUPER-ADVENTURE');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const build = /<script type="module" src="main\.js\?v=([\w.-]+)"><\/script>/.exec(html)?.[1];
assert.ok(build, 'main.js is loaded with a ?v= build id');
assert.equal(/<link rel="stylesheet" href="style\.css\?v=([\w.-]+)">/.exec(html)?.[1], build, 'style.css carries the same build id');

/** Every module reachable from `entry` through relative imports. Returns resolved file paths. */
function reachable(entry) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!/import\(\s*['"]\./.test(source), `${path.relative(examples, file)}: dynamic local imports would bypass the import map`);
    for (const m of source.matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) walk(path.resolve(path.dirname(file), m[1]));
  };
  walk(entry);
  seen.delete(entry);
  return seen;
}

const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
const mapped = new Map();
for (const [spec, target] of Object.entries(map)) {
  if (!spec.startsWith('.')) continue;
  assert.equal(target, `${spec}?v=${build}`, `import map entry for ${spec} carries build id ${build}`);
  const file = path.resolve(dir, spec);
  assert.ok(fs.existsSync(file), `${spec} exists`);
  mapped.set(file, spec);
}
const needed = reachable(path.join(dir, 'main.js'));
assert.ok(needed.size >= 6, `found the game modules (${needed.size})`);
for (const file of needed) assert.ok(mapped.has(file), `${path.relative(dir, file)} is imported but missing from the import map`);
for (const file of mapped.keys()) assert.ok(needed.has(file), `${path.relative(dir, file)} is in the import map but not imported`);

// the rules and the course stay loadable by the Node tests: no imports
for (const name of ['rules.js', 'level.js']) {
  assert.ok(!/^\s*import\s/m.test(fs.readFileSync(path.join(dir, name), 'utf8')), `${name} has no imports`);
}

// the sensor script and the game agree on the two inputs
assert.ok(/window\.setAccelPressed\(true\)/.test(html) && /window\.gameJump\(\) !== false/.test(html), 'index.html drives setAccelPressed() and gameJump()');
const main = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
assert.ok(/window\.setAccelPressed = /.test(main) && /window\.gameJump = /.test(main), 'main.js provides them');

console.log(`super-adventure-build-id: ok (build ${build}, ${needed.size} modules)`);
