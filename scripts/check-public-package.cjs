#!/usr/bin/env node

/**
 * Public Package Sanitization Guard
 *
 * Run before `npm publish` (wired up via `prepublishOnly` hook in package.json).
 * Aborts the publish if the package would contain any internal-only files.
 *
 * Why: the monorepo build emits dist/tools/admin/ and dist/tools/internal/
 * (used by the internal entry point). The `files` whitelist in package.json
 * should already prevent these from being packaged, but this guard is the
 * second line of defense in case files[] is misconfigured or someone
 * accidentally adds an internal artifact under a public path.
 *
 * Exits 0 on clean, 1 on contamination.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Patterns that MUST NOT appear in the npm pack output
const FORBIDDEN_PATTERNS = [
  /^dist\/tools\/admin\//i,
  /^dist\/tools\/internal\//i,
  /^dist\/tools\/meta\//i,
  /^dist\/index\.js(\.map)?$/i,           // internal entry point
  /^dist\/index\.d\.ts(\.map)?$/i,        // internal entry point types
  /^dist\/config\//i,                      // contains tenants.json
  /^src\//i,                               // source files (use dist only)
  /tenants\.json$/i,                       // anywhere
  /^mcp-run\.sh$/i,                        // internal helper
  /^\.env/i,                               // env files
  /^scripts\//i,                           // build/dev scripts
  /^vitest\.config/i,
  /^tsconfig\.json$/i,
  /^\.github\//i,
  /^\.gitignore$/i,
  /^\.npmignore$/i,
];

let packOutput;
try {
  packOutput = execSync('npm pack --dry-run --json', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  console.error('[check-public-package] npm pack --dry-run failed:');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(2);
}

let parsed;
try {
  parsed = JSON.parse(packOutput);
} catch (err) {
  console.error('[check-public-package] could not parse npm pack output');
  process.exit(2);
}

const files = (parsed[0] && parsed[0].files) || [];
if (files.length === 0) {
  console.error('[check-public-package] no files in npm pack output -- something is wrong');
  process.exit(2);
}

const violations = [];
for (const f of files) {
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(f.path)) {
      violations.push({ path: f.path, pattern: re.source });
      break;
    }
  }
}

console.log(`[check-public-package] ${files.length} files in pack:`);
for (const f of files.slice(0, 5)) {
  console.log(`  - ${f.path}`);
}
if (files.length > 5) console.log(`  - ... (${files.length - 5} more)`);

if (violations.length > 0) {
  console.error('');
  console.error('[check-public-package] FAIL -- forbidden files in npm pack:');
  for (const v of violations) {
    console.error(`  X  ${v.path}    (matched: /${v.pattern}/)`);
  }
  console.error('');
  console.error('Fix: review the "files" whitelist in package.json and the build output.');
  console.error('     Internal-only artifacts must not ship in the public npm package.');
  process.exit(1);
}

console.log('');
console.log('[check-public-package] OK -- no forbidden files in npm pack');
process.exit(0);
