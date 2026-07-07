/**
 * copy-playbook-assets  (Agent-Connect EPIC 2, issue #5319)
 *
 * The `PlaybookRegistry` (src/playbooks/registry.ts) discovers playbooks by
 * scanning its module directory for `<id>/{meta.json,skill.md}` subfolders. At
 * runtime that module directory is `dist/playbooks`. Those asset files are NOT
 * TypeScript, so `tsc` never emits them into `dist/`, which left the built
 * artifact with zero playbook definitions -> `prompts/list` always empty in any
 * deployed/containerized gateway (#5319, found by #5309 T11).
 *
 * This script mirrors every NON-`.ts` asset under `src/playbooks/**` into
 * `dist/playbooks/**`, preserving directory structure. It is invoked by the
 * `build` (and `build:public`) npm scripts right after `tsc`. Globbing all
 * non-source files (rather than hardcoding `meta.json`/`skill.md`) keeps future
 * assets -- goldens, additional docs the registry may read -- copied
 * automatically.
 *
 * Reusable: `copyPlaybookAssets(srcRoot, destRoot)` is exported so a regression
 * test can exercise the exact copy the build performs.
 */

import { readdirSync, mkdirSync, copyFileSync, existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** Source files that `tsc` already emits -- never copy these as raw assets. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

function isSourceFile(name) {
  return SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Recursively copy every non-source file from `srcRoot` into `destRoot`,
 * preserving the relative directory structure. Returns the list of relative
 * paths copied (useful for logging + assertions).
 */
export function copyPlaybookAssets(srcRoot, destRoot) {
  const copied = [];

  const walk = (relDir) => {
    const absSrcDir = join(srcRoot, relDir);
    for (const entry of readdirSync(absSrcDir).sort()) {
      const relPath = relDir ? join(relDir, entry) : entry;
      const absSrc = join(absSrcDir, entry);
      if (statSync(absSrc).isDirectory()) {
        walk(relPath);
        continue;
      }
      if (isSourceFile(entry)) {
        continue;
      }
      const absDest = join(destRoot, relPath);
      mkdirSync(dirname(absDest), { recursive: true });
      copyFileSync(absSrc, absDest);
      copied.push(relPath);
    }
  };

  if (!existsSync(srcRoot)) {
    throw new Error(`copy-playbook-assets: source root not found: ${srcRoot}`);
  }
  mkdirSync(destRoot, { recursive: true });
  walk('');
  return copied;
}

// CLI entrypoint: copy the real src/playbooks -> dist/playbooks.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const srcRoot = join(MODULE_DIR, '..', 'src', 'playbooks');
  const destRoot = join(MODULE_DIR, '..', 'dist', 'playbooks');
  const copied = copyPlaybookAssets(srcRoot, destRoot);
  // eslint-disable-next-line no-console
  console.log(
    `copy-playbook-assets: copied ${copied.length} asset(s) into dist/playbooks`,
  );
}
