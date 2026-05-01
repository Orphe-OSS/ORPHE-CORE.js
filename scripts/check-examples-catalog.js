#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(repoRoot, 'examples', 'catalog.json');
const docsPath = path.join(repoRoot, 'docs', 'examples-catalog.md');

const allowedStatus = new Set(['public', 'public-candidate', 'needs-fix', 'needs-review', 'internal', 'overlap']);
const allowedType = new Set(['web-app', 'starter-template', 'guide', 'workshop', 'internal-test', 'tool']);

function existsFromRoot(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse ${path.relative(repoRoot, filePath)}: ${error.message}`);
  }
}

function fail(errors, warnings) {
  if (warnings.length) {
    console.warn(warnings.map((warning) => `WARN: ${warning}`).join('\n'));
  }
  if (errors.length) {
    console.error(errors.map((error) => `ERROR: ${error}`).join('\n'));
    process.exit(1);
  }
}

const catalog = readJson(catalogPath);
const errors = [];
const warnings = [];

if (!fs.existsSync(docsPath)) {
  errors.push('docs/examples-catalog.md does not exist');
} else {
  const docs = fs.readFileSync(docsPath, 'utf8');
  if (!docs.includes('examples/catalog.json')) {
    warnings.push('docs/examples-catalog.md does not mention examples/catalog.json');
  }
}

if (!Array.isArray(catalog.entries)) {
  errors.push('catalog.entries must be an array');
  fail(errors, warnings);
}

const ids = new Set();
const displaySchema = catalog.display_schema || null;
const allowedCategory = new Set(displaySchema?.category || []);
const allowedDifficulty = new Set(displaySchema?.difficulty || []);
const allowedPublicNavigation = new Set(displaySchema?.public_navigation || []);

catalog.entries.forEach((entry, index) => {
  const label = entry.id || `entry[${index}]`;

  if (!entry.id) errors.push(`${label}: missing id`);
  if (entry.id && ids.has(entry.id)) errors.push(`${label}: duplicate id`);
  if (entry.id) ids.add(entry.id);

  if (!entry.title) errors.push(`${label}: missing title`);
  if (!entry.path) errors.push(`${label}: missing path`);
  if (entry.path && !existsFromRoot(entry.path)) errors.push(`${label}: path does not exist: ${entry.path}`);
  if (!allowedType.has(entry.type)) errors.push(`${label}: invalid type: ${entry.type}`);
  if (!allowedStatus.has(entry.status)) errors.push(`${label}: invalid status: ${entry.status}`);

  if (!Array.isArray(entry.audience)) errors.push(`${label}: audience must be an array`);
  if (!Array.isArray(entry.topics)) errors.push(`${label}: topics must be an array`);
  if (!Array.isArray(entry.data)) errors.push(`${label}: data must be an array`);
  if (!Array.isArray(entry.validation)) errors.push(`${label}: validation must be an array`);

  if (displaySchema) {
    if (!allowedCategory.has(entry.category)) errors.push(`${label}: invalid category: ${entry.category}`);
    if (!allowedDifficulty.has(entry.difficulty)) errors.push(`${label}: invalid difficulty: ${entry.difficulty}`);
    if (!allowedPublicNavigation.has(entry.public_navigation)) errors.push(`${label}: invalid public_navigation: ${entry.public_navigation}`);
    if (typeof entry.featured !== 'boolean') errors.push(`${label}: featured must be a boolean`);
    if (entry.featured && !Number.isInteger(entry.sort_order)) errors.push(`${label}: featured entries require integer sort_order`);
    if (entry.public_navigation !== 'hidden' && !Number.isInteger(entry.sort_order)) errors.push(`${label}: listed/featured entries require integer sort_order`);
    if (!Object.prototype.hasOwnProperty.call(entry, 'thumbnail')) errors.push(`${label}: missing thumbnail field`);
    if (entry.thumbnail && !existsFromRoot(entry.thumbnail)) errors.push(`${label}: thumbnail does not exist: ${entry.thumbnail}`);
    if (!entry.links || typeof entry.links !== 'object') errors.push(`${label}: missing links object`);
    if (entry.links?.demo && !existsFromRoot(entry.links.demo)) errors.push(`${label}: links.demo does not exist: ${entry.links.demo}`);
    if (entry.links?.source && !existsFromRoot(entry.links.source)) errors.push(`${label}: links.source does not exist: ${entry.links.source}`);
    if (typeof entry.requires_device !== 'boolean') errors.push(`${label}: requires_device must be a boolean`);
    if (!Number.isInteger(entry.device_count)) errors.push(`${label}: device_count must be an integer`);
    if (typeof entry.needs_real_device_validation !== 'boolean') errors.push(`${label}: needs_real_device_validation must be a boolean`);
  }
});

['recipe_candidates', 'needs_fix'].forEach((section) => {
  const entries = catalog[section] || [];
  if (!Array.isArray(entries)) {
    errors.push(`${section} must be an array when present`);
    return;
  }
  entries.forEach((entry, index) => {
    const target = entry.path || entry.source;
    if (target && !existsFromRoot(target)) errors.push(`${section}[${index}]: referenced path does not exist: ${target}`);
  });
});

console.log(`Catalog OK: ${catalog.entries.length} entries checked`);
fail(errors, warnings);
