#!/usr/bin/env node
'use strict';

// Fails when a public file references this repository on jsDelivr without an
// immutable ref. A mutable ref (`@main`, `@dev`, or no ref at all — which
// jsDelivr resolves to the default branch) means everyone who copies the
// snippet executes whatever is on that branch at load time (supply-chain risk).
//
//   node scripts/check-cdn-pins.js
//
// (host = cdn.jsdelivr.net)
// Allowed:  <host>/gh/Orphe-OSS/ORPHE-CORE.js@v1.4.1/js/ORPHE-CORE.js   (release tag)
//           <host>/gh/Orphe-OSS/ORPHE-CORE.js@1140ee7/js/ORPHE-CORE.js  (commit SHA)
// Rejected: <host>/gh/Orphe-OSS/ORPHE-CORE.js@main/js/ORPHE-CORE.js     (branch)
//           <host>/gh/Orphe-OSS/ORPHE-CORE.js/js/ORPHE-CORE.js          (no ref = default branch)
//
// Exit code 1 with one `file:line: <url>` per offender, 0 when clean.
// Runs in CI (.github/workflows/ci.yml). The file scope / exclusion list lives in
// scripts/lib/cdn-self-refs.js and is shared with scripts/pin-cdn-version.js and
// tests/core-version-sync.test.js (which additionally checks that every pinned
// release tag equals package.json's version).

const fs = require('fs');
const { listScanFiles, findSelfRefs, isPinnedRef } = require('./lib/cdn-self-refs');

function findOffenders(text) {
  return findSelfRefs(text)
    .filter(({ ref }) => !isPinnedRef(ref))
    .map(({ line, url, ref }) => ({ line, url, ref: ref || '(no ref → default branch)' }));
}

function main() {
  const files = listScanFiles();
  const report = [];
  for (const file of files) {
    const text = fs.readFileSync(file.abs, 'utf8');
    for (const offender of findOffenders(text)) {
      report.push(`${file.rel}:${offender.line}: ${offender.url}  [${offender.ref}]`);
    }
  }

  if (report.length) {
    console.error(report.join('\n'));
    console.error(`\ncheck-cdn-pins: ${report.length} unpinned jsDelivr self-reference(s) in ${new Set(report.map((r) => r.split(':')[0])).size} file(s). ` +
      'Pin them to a release tag (e.g. @v1.4.1). Scanned ' + files.length + ' files.');
    process.exit(1);
  }
  console.log(`check-cdn-pins: OK — no unpinned jsDelivr self-references (scanned ${files.length} files).`);
}

main();
