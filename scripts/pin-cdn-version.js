#!/usr/bin/env node
'use strict';

// Rewrites every release-tag-pinned jsDelivr self-reference
// (`<host>/gh/Orphe-OSS/ORPHE-CORE.js@v<old>/...`, host = cdn.jsdelivr.net) in the public
// files to the given release tag, so a release no longer needs a hand-written `sed`
// (as was done for #127 / #131). Same file scope and exclusions as check-cdn-pins.js
// (shared via scripts/lib/cdn-self-refs.js).
//
//   node scripts/pin-cdn-version.js v1.4.2
//
// - Only `@vX.Y.Z` refs are rewritten. Commit-SHA pins and unpinned refs are left
//   untouched (check-cdn-pins.js reports the latter).
// - Refuses anything that is not `vX.Y.Z` (exit code 2).
// - Prints how many references / files were rewritten and how many files were scanned.
//   `tests/core-version-sync.test.js` then verifies the result against package.json.

const fs = require('fs');
const { listScanFiles, SELF_REF_RE, VERSION_TAG_RE, isVersionRef } = require('./lib/cdn-self-refs');

function rewriteText(text, tag) {
  let rewritten = 0;
  const next = text.replace(SELF_REF_RE, (url, ref) => {
    if (!isVersionRef(ref) || ref === `@${tag}`) return url;
    rewritten++;
    return `${url.slice(0, url.indexOf(ref))}@${tag}${url.slice(url.indexOf(ref) + ref.length)}`;
  });
  return { next, rewritten };
}

function main(argv) {
  const tag = argv[2];
  if (!tag || !VERSION_TAG_RE.test(tag)) {
    console.error('usage: node scripts/pin-cdn-version.js vX.Y.Z  (e.g. v1.4.2)');
    if (tag) console.error(`pin-cdn-version: "${tag}" is not a release tag of the form vX.Y.Z.`);
    process.exit(2);
  }

  const files = listScanFiles();
  let refCount = 0;
  let fileCount = 0;
  for (const file of files) {
    const text = fs.readFileSync(file.abs, 'utf8');
    const { next, rewritten } = rewriteText(text, tag);
    if (!rewritten) continue;
    fs.writeFileSync(file.abs, next);
    refCount += rewritten;
    fileCount++;
  }
  console.log(`pin-cdn-version: rewrote ${refCount} jsDelivr self-reference(s) in ${fileCount} file(s) to @${tag} (scanned ${files.length} files).`);
}

if (require.main === module) {
  main(process.argv);
}

module.exports = { rewriteText };
