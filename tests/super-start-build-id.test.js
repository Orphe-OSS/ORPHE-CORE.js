const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// GAME-SUPER-START and GAME-SUPER-RELAY are held in the stadium of GAME-SUPER-HURDLE: they import
// its world / runner / fx / audio modules, and RELAY imports START's stage / motion / start modules.
// Each page requests every module and stylesheet with one ?v= build id (see the hurdle game's
// index.html for why). This test keeps the three pages in step:
//   - one id per page, on main.js, every stylesheet of the family and every import-map entry
//   - every local module that is imported anywhere is in the page's import map
//   - the id equals the hurdle game's id, so a change to the shared stadium cannot leave these
//     pages on a stale copy of it
const examples = path.join(__dirname, '../examples');
const buildOf = (dir) => /<script type="module" src="main\.js\?v=([\w.-]+)"><\/script>/.exec(fs.readFileSync(path.join(examples, dir, 'index.html'), 'utf8'))?.[1];
const hurdleBuild = buildOf('GAME-SUPER-HURDLE');
assert.ok(hurdleBuild, 'GAME-SUPER-HURDLE has a build id');

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

for (const name of ['GAME-SUPER-START', 'GAME-SUPER-RELAY']) {
  const dir = path.join(examples, name);
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const build = buildOf(name);
  assert.ok(build, `${name}: main.js is loaded with a ?v= build id`);
  assert.equal(build, hurdleBuild, `${name}: same build id as GAME-SUPER-HURDLE, whose stadium it imports`);

  // stylesheets of the family
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="((?:\.\.\/GAME-SUPER-[A-Z]+\/)?style\.css)\?v=([\w.-]+)">/g)];
  assert.ok(sheets.length >= 2, `${name}: links the hurdle stylesheet and its own`);
  for (const [, href, v] of sheets) {
    assert.equal(v, build, `${name}: ${href} carries build id ${build}`);
    assert.ok(fs.existsSync(path.resolve(dir, href)), `${name}: ${href} exists`);
  }

  // import map: every reachable local module, each with the build id
  const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
  const mapped = new Map();
  for (const [spec, target] of Object.entries(map)) {
    if (!spec.startsWith('.')) continue;
    assert.equal(target, `${spec}?v=${build}`, `${name}: import map entry for ${spec} carries build id ${build}`);
    const file = path.resolve(dir, spec);
    assert.ok(fs.existsSync(file), `${name}: ${spec} exists`);
    mapped.set(file, spec);
  }
  const needed = reachable(path.join(dir, 'main.js'));
  assert.ok(needed.size >= 7, `${name}: found the game modules (${needed.size})`);
  for (const file of needed) assert.ok(mapped.has(file), `${name}: ${path.relative(dir, file)} is imported but missing from the import map`);
  for (const [file, spec] of mapped) assert.ok(needed.has(file), `${name}: import map entry ${spec} is not imported any more`);

  // one SDK, from this repository (tests/examples-core-sdk-source.test.js checks the path)
  assert.ok(html.includes('../../js/ORPHE-CORE.js'), `${name}: loads the repository SDK`);
}

console.log(`super-start-build-id.test.js passed (build ${hurdleBuild})`);
