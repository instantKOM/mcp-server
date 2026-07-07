/**
 * check:playbook-drift  (Agent-Connect EPIC 4, #5209)
 *
 * Nightly DRIFT DETECTOR for the self-heal loop. It runs the SAME
 * `checkPlaybookContract` FORM oracle (#5206) that gates PRs, but as a
 * standalone, deterministic CLI over the CURRENT tool registry (advertised tool
 * definitions + wired handlers). "Drift" = a shipped playbook step now
 * references a tool that no longer exists, an arg key the tool's `inputSchema`
 * no longer declares, a template ref that no longer resolves, or a scope that no
 * longer matches -- i.e. the API/tool surface moved out from under a playbook.
 *
 * Exit codes (this is the trigger the nightly workflow is built on -- AK4):
 *   0 - no drift: every shipped playbook still satisfies the tool contract
 *   1 - drift detected: a structured report is printed to stdout naming
 *       playbook -> step -> tool/arg for each violation; the workflow opens/updates
 *       a triage issue from this output so the self-heal fleet can pick it up.
 *   2 - the shipped catalog failed to even LOAD (registry meta contract broke);
 *       surfaced distinctly because that is a harder break than surface drift.
 *
 * The fix (author/agent edits the playbook step or the tool) is validated by the
 * existing contract (#5206) + golden (#5207) required checks; the self-heal PR
 * merges ONLY when those go green (AK5). This detector does NOT merge anything.
 *
 * Run locally: npm run check:playbook-drift
 * See scripts/PLAYBOOK_DRIFT.md for the full detect -> report -> fix -> gate -> merge loop.
 */

import { playbookRegistry } from '../src/playbooks/registry.js';
import { checkPlaybookContract } from '../src/tests/contract/contract-check.js';
import type { Playbook } from '../src/playbooks/types.js';

interface DriftEntry {
  playbookId: string;
  version: string;
  dir: string;
  violations: string[];
}

/**
 * Pure core: load the shipped catalog and run the FORM contract over every
 * playbook. Exported so the self-proof test can call it directly with an
 * injected registry-like list and assert exit-code semantics without a subprocess.
 */
export function detectDrift(playbooks: Playbook[]): DriftEntry[] {
  const drift: DriftEntry[] = [];
  for (const pb of playbooks) {
    const violations = checkPlaybookContract(pb);
    if (violations.length > 0) {
      drift.push({
        playbookId: pb.meta.id,
        version: pb.meta.version,
        dir: pb.dir,
        violations,
      });
    }
  }
  return drift;
}

/** Render a stable, human- and issue-readable Markdown drift report. */
export function formatDriftReport(drift: DriftEntry[]): string {
  const lines: string[] = [];
  lines.push('# Playbook drift detected');
  lines.push('');
  lines.push(
    `${drift.length} shipped playbook(s) drifted from the current MCP tool surface.`
  );
  lines.push('');
  lines.push(
    'A step references a tool/arg/template/scope that no longer matches the ' +
      'advertised tool registry. Fix the playbook step (or the tool) and let the ' +
      'contract (#5206) + golden (#5207) checks validate the fix before merge.'
  );
  lines.push('');
  for (const entry of drift) {
    lines.push(`## \`${entry.playbookId}\` (v${entry.version})`);
    lines.push('');
    lines.push(`Dir: \`${entry.dir}\``);
    lines.push('');
    for (const v of entry.violations) {
      lines.push(`- ${v}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function main(): void {
  let playbooks: Playbook[];
  try {
    // reload() forces a fresh scan + revalidates the meta contract; a malformed
    // shipped playbook throws here and is a distinct (harder) failure than drift.
    playbookRegistry.reload();
    playbooks = playbookRegistry.list();
  } catch (err) {
    console.error('[DRIFT] Shipped playbook catalog failed to load (meta contract broke):');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
    return;
  }

  const drift = detectDrift(playbooks);

  if (drift.length === 0) {
    console.log(
      `[OK] No playbook drift: all ${playbooks.length} shipped playbook(s) satisfy the current tool contract.`
    );
    process.exit(0);
    return;
  }

  console.log(formatDriftReport(drift));
  const totalViolations = drift.reduce((n, d) => n + d.violations.length, 0);
  console.error(
    `\n[DRIFT] ${drift.length} playbook(s), ${totalViolations} violation(s). ` +
      `See report above; a fix PR is required (contract + golden gate must pass before merge).`
  );
  process.exit(1);
}

// Only run when invoked as a script, not when imported by the self-proof test.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
