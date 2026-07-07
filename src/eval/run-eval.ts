/**
 * Eval CLI entry point (issue #5208).
 *
 * Wires the real environment to the pure harness: resolves providers from env
 * keys, looks up each playbook's `skill.md` from the shipped registry, runs the
 * eval, prints the score + gate, and sets the process exit code.
 *
 * EXIT CODES
 *   0  gate === 'pass'          -- aggregate pass-rate met the threshold.
 *   0  gate === 'inconclusive'  -- no provider had a key; SKIPPED, not a false
 *                                  pass. CI gates the real run behind secrets, so
 *                                  a keyless run must not block (non-blocking skip).
 *   1  gate === 'fail'          -- aggregate pass-rate below threshold.
 *
 * Run: `tsx src/eval/run-eval.ts`  (or the built `dist/eval/run-eval.js`).
 * Requires ANTHROPIC_API_KEY and/or OPENAI_API_KEY for a real run; threshold via
 * EVAL_PASS_THRESHOLD (default 0.8).
 */

import { playbookRegistry } from '../playbooks/registry.js';
import { EVAL_CASES } from './cases.js';
import { resolveProviders } from './providers.js';
import { runEval } from './runner.js';
import { resolveThreshold } from './scoring.js';
import type { SkillLookup } from './runner.js';

const skillFor: SkillLookup = (playbookId) => {
  const pb = playbookRegistry.get(playbookId);
  if (!pb) {
    throw new Error(`eval case references unknown playbook '${playbookId}'`);
  }
  return pb.skill;
};

async function main(): Promise<void> {
  const threshold = resolveThreshold(process.env.EVAL_PASS_THRESHOLD);
  const { available, skipped } = resolveProviders(process.env);

  const log = (line: string): void => console.log(line);

  log(`=== Multi-LLM playbook eval (#5208) ===`);
  log(`Threshold: ${(threshold * 100).toFixed(0)}%`);
  log(`Cases: ${EVAL_CASES.length}`);
  log(`Providers available: ${available.map((p) => p.provider).join(', ') || '(none)'}`);
  for (const s of skipped) {
    log(`Provider skipped: ${s.provider} (${s.reason})`);
  }
  log('');

  const report = await runEval({
    cases: EVAL_CASES,
    providers: available,
    skipped,
    skillFor,
    threshold,
    log,
  });

  log('');
  log('--- Per provider ---');
  for (const p of report.perProvider) {
    log(`${p.provider}: ${p.passed}/${p.total} (${(p.passRate * 100).toFixed(1)}%)`);
  }
  log('');
  log(
    `Aggregate: ${report.passed}/${report.total} = ${(report.passRate * 100).toFixed(1)}% ` +
      `(threshold ${(threshold * 100).toFixed(0)}%)`
  );
  if (report.reducedConfidence && report.total > 0) {
    log('NOTE: reduced confidence -- fewer than 2 providers evaluated.');
  }
  log(`GATE: ${report.gate.toUpperCase()}`);

  if (report.gate === 'fail') {
    process.exitCode = 1;
    return;
  }
  if (report.gate === 'inconclusive') {
    log('INCONCLUSIVE: no provider had an API key -- eval SKIPPED (not a pass).');
  }
  process.exitCode = 0;
}

main().catch((err) => {
  console.error('eval run failed:', err);
  process.exitCode = 1;
});
