// バージョン表記の整合テスト。
//
// リリース時に更新すべき箇所が 1 つでも漏れると CI で落ちる:
//   - package.json の version
//   - js/ORPHE-CORE.js ヘッダの @version
//   - CITATION.cff の version:
//   - README.md の「* vX.Y.Z: Current version」行
//   - 公開ファイル内の全 jsDelivr 自己参照（@vX.Y.Z 固定。@latest / @main / ref 無しへの退行も検出）
//
// リリース手順は CLAUDE.md「リリース手順」を参照:
//   1. package.json の version を上げる
//   2. node scripts/pin-cdn-version.js vX.Y.Z（自己参照を一括更新）
//   3. @version / CITATION.cff / README / CHANGELOG を更新
//   4. npm test（このテストが通ること）
// 自己参照の走査は scripts/check-cdn-pins.js と同じ scope（scripts/lib/cdn-self-refs.js）。
// commit SHA で固定された参照（check-cdn-pins.js が許容する immutable ref）は対象外。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot, listScanFiles, findSelfRefs, isVersionRef } = require('../scripts/lib/cdn-self-refs');

const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const { version } = JSON.parse(read('package.json'));
assert.match(version, /^\d+\.\d+\.\d+$/, `package.json version "${version}" must be X.Y.Z`);

// js/ORPHE-CORE.js ヘッダ @version
{
  const sdk = read('js/ORPHE-CORE.js');
  const match = sdk.match(/^\s*\*?\s*@version\s+(\d+\.\d+\.\d+)\s*$/m);
  assert.ok(match, 'js/ORPHE-CORE.js: @version line not found in the header');
  assert.equal(match[1], version, `js/ORPHE-CORE.js: @version ${match[1]} != package.json version ${version}`);
}

// CITATION.cff version:
{
  const cff = read('CITATION.cff');
  const match = cff.match(/^version:\s*['"]?(\d+\.\d+\.\d+)['"]?\s*$/m);
  assert.ok(match, 'CITATION.cff: "version:" line not found');
  assert.equal(match[1], version, `CITATION.cff: version ${match[1]} != package.json version ${version}`);
}

// README.md「* vX.Y.Z: Current version」行
{
  const readme = read('README.md');
  const match = readme.match(/^\* v(\d+\.\d+\.\d+): Current version/m);
  assert.ok(match, 'README.md: "* vX.Y.Z: Current version" line not found');
  assert.equal(match[1], version, `README.md: Current version v${match[1]} != package.json version ${version}`);
}

// 全 jsDelivr 自己参照
{
  const expected = `@v${version}`;
  const mismatches = [];
  const shaPins = [];
  let pinned = 0;
  for (const file of listScanFiles()) {
    for (const { line, url, ref } of findSelfRefs(fs.readFileSync(file.abs, 'utf8'))) {
      if (ref && !isVersionRef(ref) && /^@[0-9a-f]{7,40}$/.test(ref)) {
        shaPins.push(`${file.rel}:${line}: ${url}`);
        continue;
      }
      if (ref === expected) {
        pinned++;
        continue;
      }
      mismatches.push(`${file.rel}:${line}: ${url}  [${ref || '(no ref → default branch)'}]`);
    }
  }
  assert.ok(pinned > 0, 'no jsDelivr self-reference pinned to a release tag was found (is the scan scope broken?)');
  assert.equal(
    mismatches.length,
    0,
    `${mismatches.length} jsDelivr self-reference(s) do not use ${expected} (run: node scripts/pin-cdn-version.js v${version}):\n${mismatches.join('\n')}`
  );
  console.log(`core-version-sync.test.js passed (version ${version}: ${pinned} pinned CDN references${shaPins.length ? `, ${shaPins.length} commit-SHA pins ignored` : ''})`);
}
