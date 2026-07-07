/**
 * Eval runner (issue #5208).
 *
 * Orchestrates: for each available provider x each eval case, build the prompt
 * from the playbook's `skill.md`, call the model via its `LlmClient`, score the
 * response against the case oracle, and aggregate into the threshold-gated report.
 *
 * The orchestration is pure over its injected deps (clients, skill lookup) -- no
 * env, no clock -- so a unit test drives it end-to-end with `MockLlmClient` and a
 * stub skill lookup, deterministically and without network.
 */

import { buildEvalMessages } from './prompt.js';
import { aggregate, scoreCase } from './scoring.js';
import type {
  CaseScore,
  EvalCase,
  EvalReport,
  LlmClient,
  ProviderOutcome,
} from './types.js';

/** Looks up a playbook's `skill.md` body by id; throws if unknown. */
export type SkillLookup = (playbookId: string) => string;

export interface RunEvalDeps {
  cases: readonly EvalCase[];
  /** Providers with a ready client (from `resolveProviders`). */
  providers: ReadonlyArray<{ provider: string; client: LlmClient }>;
  /** Providers skipped for a missing key (surfaced in the report). */
  skipped?: ReadonlyArray<{ provider: string; reason: string }>;
  /** Resolves a playbook id to its `skill.md` body. */
  skillFor: SkillLookup;
  threshold: number;
  /** Optional structured logger (defaults to no-op); receives per-run lines. */
  log?: (line: string) => void;
}

/**
 * Run one provider across all cases, scoring each response. A thrown error from a
 * single case (network/model error) is caught and scored as a FAIL for THAT run
 * only -- one flaky call must not abort the provider or the gate (AK3).
 */
async function runProvider(
  provider: string,
  client: LlmClient,
  cases: readonly EvalCase[],
  skillFor: SkillLookup,
  log: (line: string) => void
): Promise<ProviderOutcome> {
  const scores: CaseScore[] = [];
  for (const evalCase of cases) {
    let score: CaseScore;
    try {
      const messages = buildEvalMessages(evalCase, skillFor(evalCase.playbookId));
      const response = await client.complete(messages);
      score = scoreCase(evalCase, provider, response);
    } catch (err) {
      score = {
        caseId: evalCase.id,
        provider,
        pass: false,
        reason: `run error: ${(err as Error).message}`,
      };
    }
    log(`[${provider}] ${evalCase.id}: ${score.pass ? 'PASS' : 'FAIL'} - ${score.reason}`);
    scores.push(score);
  }
  return { provider, status: 'evaluated', scores };
}

/**
 * Run the full eval and return the aggregated, threshold-gated report. Providers
 * run sequentially (deterministic ordering; keeps API rate-limit pressure low).
 */
export async function runEval(deps: RunEvalDeps): Promise<EvalReport> {
  const log = deps.log ?? (() => {});
  const outcomes: ProviderOutcome[] = [];

  for (const { provider, client } of deps.providers) {
    outcomes.push(await runProvider(provider, client, deps.cases, deps.skillFor, log));
  }

  for (const s of deps.skipped ?? []) {
    outcomes.push({ provider: s.provider, status: 'skipped', skipReason: s.reason, scores: [] });
  }

  return aggregate(outcomes, deps.threshold);
}
