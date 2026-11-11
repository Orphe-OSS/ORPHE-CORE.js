const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Main's CORE 3 fixes do not reach examples loading the older CDN release.
// Audit actual script tags, excluding commented-out alternatives.
const root = path.resolve(__dirname, '..');
const canonical = path.join(root, 'js/ORPHE-CORE.js');
let pages = 0;
for (const dir of fs.readdirSync(path.join(root, 'examples'), { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const file = path.join(root, 'examples', dir.name, 'index.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const sources = Array.from(html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi), match => match[1]);
  const sdks = sources.filter(src => /(?:^|\/)ORPHE-CORE\.js(?:[?#]|$)/.test(src));
  assert.equal(sdks.length, 1, `${dir.name}: load exactly one SDK`);
  for (const src of sdks) {
    assert.ok(!/^(?:[a-z]+:)?\/\//i.test(src), `${dir.name}: use the deployed SDK containing the CORE 3 fix`);
    assert.equal(path.resolve(path.dirname(file), src.split(/[?#]/)[0]), canonical, `${dir.name}: resolve to the tested SDK`);
  }
  pages++;
}
assert.ok(pages > 0);
console.log(`examples-core-sdk-source.test.js passed (${pages} examples)`);
