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
// TODO: add to `npm test` once the test script from PR #124 lands.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const SCAN_EXTENSIONS = new Set(['.html', '.md', '.js', '.json', '.txt']);

// Generated output / dependencies / VCS + editor metadata (mirrors .gitignore).
const IGNORE_DIRS = new Set(['.git', '.claude', '.vscode', '.obsidian', 'node_modules', 'api_doc']);

// Internal (non user-facing) trees.
const IGNORE_PREFIXES = ['docs/ai/'];

// Stale vendored copies of the SDK shipped inside workshop / example folders.
// They are out of scope for pinning (they are not what the CDN serves).
const IGNORE_FILES = new Set([
  'examples/GAME-RHYTHM/ORPHE-CORE.js',
  'ws/tmu2022/demos/YOU_ARE_theBIRD/ORPHE-CORE.js',
  'ws/tmu2025/apps/src/ORPHE-CORE.js',
  'ws/tmu2025/apps/L01/src/ORPHE-CORE.js',
  'ws/tmu2025/apps/9/src/ORPHE-CORE.js',
]);

// Any jsDelivr URL for this repo, capturing the optional `@ref`.
const SELF_REF_RE = /cdn\.jsdelivr\.net\/gh\/Orphe-OSS\/ORPHE-CORE\.js(@[A-Za-z0-9._-]+)?\/[^"'`<>\s)&]*/g;

// Immutable refs: a release tag (vX.Y.Z) or a commit SHA.
const PINNED_REF_RE = /^@(v\d+\.\d+\.\d+|[0-9a-f]{7,40})$/;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, abs).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (IGNORE_PREFIXES.some((prefix) => `${rel}/`.startsWith(prefix))) continue;
      walk(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    if (IGNORE_FILES.has(rel)) continue;
    if (IGNORE_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
    out.push({ abs, rel });
  }
  return out;
}

function findOffenders(text) {
  const offenders = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    SELF_REF_RE.lastIndex = 0;
    let match;
    while ((match = SELF_REF_RE.exec(line))) {
      const ref = match[1];
      if (ref && PINNED_REF_RE.test(ref)) continue;
      offenders.push({ line: index + 1, url: match[0], ref: ref || '(no ref → default branch)' });
    }
  });
  return offenders;
}

function main() {
  const files = walk(repoRoot, []);
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
