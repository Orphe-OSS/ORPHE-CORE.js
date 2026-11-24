const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// GAME-SUPER-JUMP is several ES modules, some of them shared with GAME-SUPER-HURDLE and
// GAME-SUPER-START. A browser that keeps an old copy of one of them next to new copies of the
// others breaks in confusing ways, so the page requests every module and stylesheet with one
// ?v= build id (see index.html). This test keeps them in step:
//   - one id on main.js, the stylesheets and every import-map entry for a local module
//   - every local module reachable from main.js is in the import map, and nothing else is
const examples = path.join(__dirname, '../examples');
const dir = path.join(examples, 'GAME-SUPER-JUMP');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const build = /<script type="module" src="main\.js\?v=([\w.-]+)"><\/script>/.exec(html)?.[1];
assert.ok(build, 'main.js is loaded with a ?v= build id');
const sheets = [...html.matchAll(/<link rel="stylesheet" href="((?:\.\.\/[\w-]+\/)?style\.css)\?v=([\w.-]+)">/g)];
assert.equal(sheets.length, 3, 'the hurdle, start and jump stylesheets');
for (const [, href, id] of sheets) {
  assert.equal(id, build, `${href} carries build id ${build}`);
  assert.ok(fs.existsSync(path.resolve(dir, href)), `${href} exists`);
}

/** Every module reachable from `entry` through relative imports. Returns resolved file paths. */
function reachable(entry) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!/import\(\s*['"]\./.test(source), `${path.relative(examples, file)}: dynamic local imports would bypass the import map`);
    for (const m of source.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/gm)) walk(path.resolve(path.dirname(file), m[1]));
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
assert.ok(needed.size >= 10, `found the game modules (${needed.size})`);
for (const file of needed) assert.ok(mapped.has(file), `${path.relative(examples, file)} is imported but missing from the import map`);
for (const file of mapped.keys()) assert.ok(needed.has(file), `${path.relative(examples, file)} is in the import map but not imported`);

// the rules stay loadable by the Node tests: no imports
for (const f of ['rules.js', 'jumpdetect.js']) assert.ok(!/^\s*import\s/m.test(fs.readFileSync(path.join(dir, f), 'utf8')), `${f} has no imports`);

// the sensor script and the game agree on the two inputs: stamping, and the samples of a real jump
assert.ok(/window\.setAccelPressed\(true\)/.test(html) && /window\.jumpSample\(this\.id, _acc, this\.quat\)/.test(html), 'index.html drives setAccelPressed() and jumpSample()');
const main = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
assert.ok(/window\.setAccelPressed = /.test(main) && /window\.jumpSample = /.test(main) && /window\.gameJump = /.test(main) && /window\.sensorTap = /.test(main), 'main.js provides them (gameJump only for the INSOLE adapter, which still calls it)');
// the landing of a real jump is a 10 G impact: the accelerometer has to be on its ±16 G range
assert.equal((html.match(/range: \{ acc: 16, gyro: 2000 \}/g) || []).length, 2, 'both sensors connect with the ±16 G range');
// the ORPHE CORE SDK comes from this repository, as in the other stadium games
assert.ok(/<script src="\.\.\/\.\.\/js\/ORPHE-CORE\.js"><\/script>/.test(html) && /<script src="\.\.\/\.\.\/js\/CoreToolkit\.js"><\/script>/.test(html), 'the SDK is loaded from ../../js/');

console.log(`super-jump-build-id: ok (build ${build}, ${needed.size} modules)`);
