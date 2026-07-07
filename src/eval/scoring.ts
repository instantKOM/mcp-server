/**
 * Pure scoring, aggregation and threshold-gate logic (issue #5208).
 *
 * Everything here is a PURE function of its inputs -- no network, no env, no clock
 * -- so it is fully unit-testable with the deterministic `MockLlmClient`. The
 * real-LLM invocation lives in the adapters + runner; this module decides only
 * "did this response satisfy the oracle" and "does the aggregate clear the bar".
 *
 * AGGREGATION RULE (and its justification)
 * ----------------------------------------
 * The gate uses the MEAN pass-rate over EVERY executed (case x provider) run:
 *
 *     passRate = passedRuns / totalRuns        (totalRuns = cases x evaluatedProviders)
 *
 * Rationale: each (case x provider) run is an independent Bernoulli trial of
 * "does a real model drive this playbook correctly"; the mean is the maximum-
 * likelihood estimate of that success probability. Pooling ACROSS providers (not
 * per-provider-then-min) is deliberate: it makes the gate robust to a single-model
 * outlier. One provider fumbling one case moves the mean by only 1/N, so it can
 * never by itself drop a genuinely-good suite below the threshold -- satisfying
 * AK3 EPIC 4 ("does not flake on a single LLM outlier"). Conversely a genuinely
 * bad model/suite fails many runs, the mean collapses, and the gate goes red.
 *
 * We intentionally do NOT use best-of (hides a broken provider) nor
 * per-provider-AND (one flaky model fails the whole gate -- the exact flakiness
 * AK3 forbids). The pooled mean is the middle ground that punishes systematic
 * failure while absorbing noise.
 *
 * ZERO-PROVIDER BEHAVIOR: when no provider has a key, totalRuns === 0. The gate
 * is `inconclusive` (documented, distinct value) -- NEVER a false `pass`. CI
 * treats `inconclusive` as a non-blocking skip (secret-gated), not as green.
 */

import type {
  CaseScore,
  EvalCase,
  EvalReport,
  LlmResponse,
  ProviderOutcome,
  ProviderReportLine,
} from './types.js';

/** Default pass threshold when `EVAL_PASS_THRESHOLD` is unset/invalid. */
export const DEFAULT_PASS_THRESHOLD = 0.8;

/**
 * Parse a threshold from a raw env string. Accepts a fraction in [0, 1]. Returns
 * `DEFAULT_PASS_THRESHOLD` for undefined/empty/NaN/out-of-range input so a
 * fat-fingered env var can never silently disable the gate.
 */
export function resolveThreshold(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PASS_THRESHOLD;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return DEFAULT_PASS_THRESHOLD;
  }
  return value;
}

/**
 * True when `expected` appears as an ordered SUBSEQUENCE of `actual`. Extra
 * elements before/between/after the expected ones are allowed; the expected ones
 * must appear in the given relative order. An empty `expected` is vacuously true.
 */
export function isOrderedSubsequence(expected: string[], actual: string[]): boolean {
  let i = 0;
  for (const name of actual) {
    if (i < expected.length && name === expected[i]) {
      i++;
    }
  }
  return i === expected.length;
}

/**
 * Score a single model response against a case's oracle. PASS iff every expected
 * tool appears as an ordered subsequence of the emitted tool calls AND no
 * forbidden tool was emitted. Pure -- no side effects.
 */
export function scoreCase(
  evalCase: EvalCase,
  provider: string,
  response: LlmResponse
): CaseScore {
  const calledNames = response.toolCalls.map((c) => c.name);

  const forbidden = evalCase.forbiddenTools ?? [];
  const forbiddenHit = forbidden.filter((f) => calledNames.includes(f));
  if (forbiddenHit.length > 0) {
    return {
      caseId: evalCase.id,
      provider,
      pass: false,
      reason: `called forbidden tool(s): ${forbiddenHit.join(', ')}`,
    };
  }

  if (!isOrderedSubsequence(evalCase.expectedTools, calledNames)) {
    return {
      caseId: evalCase.id,
      provider,
      pass: false,
      reason:
        `expected tool sequence [${evalCase.expectedTools.join(' -> ')}] ` +
        `not found as an ordered subsequence of [${calledNames.join(', ') || '(none)'}]`,
    };
  }

  return {
    caseId: evalCase.id,
    provider,
    pass: true,
    reason:
      evalCase.expectedTools.length > 0
        ? `drove expected tool sequence [${evalCase.expectedTools.join(' -> ')}]`
        : 'no specific tools required; oracle satisfied',
  };
}

/**
 * Aggregate per-provider outcomes into the terminal report + threshold gate.
 * Implements the pooled-mean rule documented at the top of this file. Pure.
 */
export function aggregate(outcomes: ProviderOutcome[], threshold: number): EvalReport {
  const evaluated = outcomes.filter((o) => o.status === 'evaluated');
  const skippedProviders = outcomes
    .filter((o) => o.status === 'skipped')
    .map((o) => ({ provider: o.provider, reason: o.skipReason ?? 'no api key' }));

  const perProvider: ProviderReportLine[] = evaluated.map((o) => {
    const total = o.scores.length;
    const passed = o.scores.filter((s) => s.pass).length;
    return {
      provider: o.provider,
      passed,
      total,
      passRate: total > 0 ? passed / total : 0,
    };
  });

  const total = perProvider.reduce((sum, p) => sum + p.total, 0);
  const passed = perProvider.reduce((sum, p) => sum + p.passed, 0);
  const passRate = total > 0 ? passed / total : 0;

  let gate: EvalReport['gate'];
  if (total === 0) {
    gate = 'inconclusive';
  } else {
    gate = passRate >= threshold ? 'pass' : 'fail';
  }

  return {
    threshold,
    gate,
    passRate,
    passed,
    total,
    evaluatedProviders: evaluated.map((o) => o.provider),
    skippedProviders,
    reducedConfidence: evaluated.length < 2,
    perProvider,
  };
}
