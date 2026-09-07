'use strict';

// Shared file walker / matcher for this repository's jsDelivr self-references
// (`<host>/gh/Orphe-OSS/ORPHE-CORE.js@<ref>/...`, host = cdn.jsdelivr.net).
//
// Used by:
//   scripts/check-cdn-pins.js      — fail on mutable refs (@main, no ref, ...)
//   scripts/pin-cdn-version.js     — rewrite every @vX.Y.Z self-reference to a new release tag
//   tests/core-version-sync.test.js — assert every @vX.Y.Z self-reference equals package.json version
//
// Keep the scope / exclusion lists here so the three tools always agree on which files are "public".

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

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

// A release tag ref (`@vX.Y.Z`) and a bare release tag (`vX.Y.Z`).
const VERSION_REF_RE = /^@v\d+\.\d+\.\d+$/;
const VERSION_TAG_RE = /^v\d+\.\d+\.\d+$/;

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

/** All public files in scope, as `{ abs, rel }` (rel uses `/` separators). */
function listScanFiles() {
  return walk(repoRoot, []);
}

/**
 * Every self-reference in `text`, as `{ line, url, ref }` (line is 1-based;
 * `ref` is the captured `@...` including the `@`, or `undefined` when absent).
 */
function findSelfRefs(text) {
  const refs = [];
  text.split('\n').forEach((line, index) => {
    SELF_REF_RE.lastIndex = 0;
    let match;
    while ((match = SELF_REF_RE.exec(line))) {
      refs.push({ line: index + 1, url: match[0], ref: match[1] });
    }
  });
  return refs;
}

function isPinnedRef(ref) {
  return !!ref && PINNED_REF_RE.test(ref);
}

function isVersionRef(ref) {
  return !!ref && VERSION_REF_RE.test(ref);
}

module.exports = {
  repoRoot,
  SCAN_EXTENSIONS,
  IGNORE_DIRS,
  IGNORE_PREFIXES,
  IGNORE_FILES,
  SELF_REF_RE,
  PINNED_REF_RE,
  VERSION_REF_RE,
  VERSION_TAG_RE,
  walk,
  listScanFiles,
  findSelfRefs,
  isPinnedRef,
  isVersionRef,
};
