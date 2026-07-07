/**
 * Multi-LLM eval harness types (Agent-Connect EPIC 4, issue #5208).
 *
 * The #5206 FORM contract and #5207 OUTCOME oracle are DETERMINISTIC gates that
 * run on every PR: they prove a shipped playbook references real tools and, when
 * driven by the real composite runner with a mocked tool layer, produces the
 * pinned tool sequence. Neither says anything about whether a REAL model, handed
 * the playbook's `skill.md` plus a natural-language task, actually drives it to
 * the right tool sequence.
 *
 * This module closes that gap with a NON-deterministic, threshold-gated eval:
 * each eval case (a playbook + a NL task + an outcome oracle) is sent to one or
 * more real models behind a pluggable `LlmClient`, the model's response is scored
 * pass/fail by the oracle, and the aggregate pass-rate is checked against a
 * configurable threshold. A single case/provider outlier must NOT fail the gate;
 * a genuinely bad pass-rate must.
 *
 * Because it is non-deterministic, costs money and needs API keys, this eval runs
 * only nightly + on the dev->main release PR (see `.github/workflows/ci-mcp-eval.yml`),
 * NEVER on the per-PR fast path. The SCORING + AGGREGATION + THRESHOLD logic is
 * pure and unit-tested with the deterministic `MockLlmClient` (no network); the
 * real-LLM invocation is integration-only and env-gated.
 */

/** A conversational role in an LLM request. */
export type LlmRole = 'system' | 'user' | 'assistant';

/** One message in an LLM request. */
export interface LlmMessage {
  role: LlmRole;
  content: string;
}

/**
 * A tool call the model decided to make. The eval harness does NOT execute these
 * (no side effects) -- the oracle only inspects the SEQUENCE + names the model
 * chose, mirroring the #5207 outcome idea (right tool sequence == success).
 */
export interface LlmToolCall {
  name: string;
  args: Record<string, unknown>;
}

/** A model's normalized response: free text plus the tool calls it emitted. */
export interface LlmResponse {
  /** The raw text portion of the response (may be empty). */
  text: string;
  /** Tool calls the model emitted, in order. */
  toolCalls: LlmToolCall[];
}

/**
 * Pluggable model client. Two REAL adapters (`anthropic`, `openai`) and one
 * deterministic `mock` implement this. `complete` sends the messages to the model
 * and returns a normalized `LlmResponse` (text + parsed tool calls).
 */
export interface LlmClient {
  /** Stable provider id, e.g. `anthropic` | `openai` | `mock`. */
  readonly provider: string;
  /** The concrete model id this client targets (for logging/reporting). */
  readonly model: string;
  complete(messages: LlmMessage[]): Promise<LlmResponse>;
}

/**
 * One eval case: a playbook, a natural-language task, and an OUTCOME oracle.
 * The oracle is expressed declaratively as the tool sequence the model is
 * expected to drive (an ORDERED SUBSEQUENCE -- extra tool calls between the
 * expected ones are allowed) plus optional tools that must NOT be called (e.g.
 * a mutation on a read-only playbook).
 */
export interface EvalCase {
  /** Unique case id. */
  id: string;
  /** Id of the shipped playbook whose `skill.md` seeds the model prompt. */
  playbookId: string;
  /** The natural-language task handed to the model as the user turn. */
  task: string;
  /**
   * Tool names the model must drive, as an ORDERED SUBSEQUENCE of the tool calls
   * it emits. Empty means "no specific tools required" (text-only oracle).
   */
  expectedTools: string[];
  /** Tool names that must NOT appear in the response (hard fail if present). */
  forbiddenTools?: string[];
}

/** Score of a single (case x provider) run. */
export interface CaseScore {
  caseId: string;
  provider: string;
  pass: boolean;
  /** Human-readable explanation of the pass/fail decision. */
  reason: string;
}

/** Per-provider outcome: either evaluated (with scores) or skipped (no key). */
export interface ProviderOutcome {
  provider: string;
  status: 'evaluated' | 'skipped';
  /** Present when `status === 'skipped'`. */
  skipReason?: string;
  /** Case scores; empty when skipped. */
  scores: CaseScore[];
}

/** Per-provider aggregate line in the final report. */
export interface ProviderReportLine {
  provider: string;
  passed: number;
  total: number;
  passRate: number;
}

/**
 * The terminal eval report. `gate` is the threshold decision:
 *   - `pass`         aggregate pass-rate >= threshold (>=1 provider evaluated).
 *   - `fail`         aggregate pass-rate < threshold  (>=1 provider evaluated).
 *   - `inconclusive` ZERO providers evaluated (no keys) -- explicitly NOT a pass.
 */
export interface EvalReport {
  threshold: number;
  gate: 'pass' | 'fail' | 'inconclusive';
  /** Aggregate pass-rate over all executed (case x provider) runs; 0 when none ran. */
  passRate: number;
  passed: number;
  total: number;
  evaluatedProviders: string[];
  skippedProviders: Array<{ provider: string; reason: string }>;
  /** True when fewer than 2 providers were evaluated (single-model confidence). */
  reducedConfidence: boolean;
  perProvider: ProviderReportLine[];
}
