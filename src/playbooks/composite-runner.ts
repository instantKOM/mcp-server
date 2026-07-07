/**
 * Server-side COMPOSITE playbook runner (Agent-Connect EPIC 2, issue #5197).
 *
 * A `delivery: 'composite'` playbook ships a machine-executable `steps` program
 * (validated by the registry, #5195). This runner executes that program
 * SERVER-SIDE and ENCAPSULATED: the customer LLM only triggers `playbook_<id>`
 * with inputs; the multi-step orchestration, argument templating and domain
 * guardrails live here, never exposed as raw prompt.
 *
 * Each step calls exactly one existing MCP tool (via the shared `executeTool`
 * router) against the per-request tenant `ApiClient`, threading each step's
 * parsed output into the next step's templated args.
 *
 * GUARDRAILS
 *   - Scope PRE-VALIDATION (AK / #5192): before ANY step runs, every step's tool
 *     is checked against the caller's resolved scopes. If a single step needs a
 *     scope the key lacks, the whole run aborts up front -- so no partial
 *     mutation happens because of a scope failure discovered mid-run.
 *   - Tool-call BUDGET (#5204 seam): the number of tool calls per run is capped
 *     (`maxToolCalls`). A program exceeding the cap aborts before running.
 *   - Idempotent mutations (#5193): a `send`-classified step is executed through
 *     an Idempotency-Key-wrapped client (deterministic key), so a retried run
 *     performs each mutation at-most-once. There is NO distributed transaction:
 *     the stance is at-least-once-per-step with idempotent replay, and the run
 *     STOPS on the first failing step (no rollback of already-run steps).
 *
 * Pre-send safety guards (opt-out / template / 24h window) are #5200-5204 and
 * are intentionally NOT reimplemented here: a send step simply calls the
 * existing send tool, whose own guards apply.
 */

import type { ApiClient } from '@instantkom/api-client';
import { executeTool as defaultExecuteTool } from '../tools/tool-router.js';
import {
  isToolAllowedForScopes,
  resolveToolScope,
  grantedScopeLevel,
  maxToolScope,
} from '../tools/tool-scopes.js';
import { resolveIdempotencyKey, withIdempotencyKey } from '../http/idempotency.js';
import { maskPiiValue } from '../http/pii-mask.js';
import {
  type AuditSink,
  NoopAuditSink,
  emitAudit,
  summarizeArgs,
} from '../http/audit-log.js';
import type { CompositePlaybookExecutor } from './serving.js';
import type { Playbook, PlaybookStep } from './types.js';

/** Default cap on the number of tool calls a single composite run may make. */
export const DEFAULT_MAX_TOOL_CALLS = 25;

/** Function shape of the tool router (`executeTool`). Injectable for tests. */
export type ExecuteToolFn = (
  name: string,
  apiClient: ApiClient,
  args: Record<string, unknown>
) => Promise<unknown>;

export interface CompositeRunnerDeps {
  /** Per-request tenant-pinned API client the steps execute against. */
  apiClient: ApiClient;
  /** Resolved tenant/key id for THIS request (used for idempotency keys). */
  tenantId: string;
  /** Per-request resolved fine scopes (`read`|`draft`|`send`). */
  scopes?: string[];
  /** Tool router. Defaults to the real `executeTool`; overridden in tests. */
  executeTool?: ExecuteToolFn;
  /** Max tool calls per run. Defaults to `DEFAULT_MAX_TOOL_CALLS`. */
  maxToolCalls?: number;
  /**
   * Key-attributed audit sink (#5204, AK4). Emits a `composite_step` row per
   * MUTATING step and a `composite_run` row for the terminal run outcome
   * (success/error/budget_exceeded/scope_denied). Defaults to a no-op.
   */
  auditSink?: AuditSink;
  /**
   * Whether the presenting key carries the AGENT_PII_EXPOSURE grant (#5317).
   * DEFAULT-DENY: when not exactly `true`, the data surfaced in the run result
   * (step outputs via `maskPiiValue`, templated step args dropped) is masked
   * before it reaches the external LLM, mirroring the base-tool PII gate in
   * `mcp-server-factory.ts`. Step outputs stay RAW internally so a later step's
   * templating (e.g. a send step using a contact) is unaffected -- only the
   * data handed back to the LLM is masked.
   */
  piiExposureAllowed?: boolean;
}

/** Outcome of a single executed step, surfaced in the structured result. */
interface StepOutcome {
  id: string;
  tool: string;
  status: 'ok' | 'error';
  /** Templated args actually passed to the tool. */
  args: Record<string, unknown>;
  /** Error message when `status === 'error'`. */
  error?: string;
}

/** Error thrown internally when a template reference cannot be resolved. */
class TemplateError extends Error {}

/**
 * The real `CompositePlaybookExecutor`: runs a composite playbook's `steps`
 * program server-side with the guardrails documented above.
 */
export class PlaybookCompositeExecutor implements CompositePlaybookExecutor {
  private readonly apiClient: ApiClient;
  private readonly tenantId: string;
  private readonly scopes: string[] | undefined;
  private readonly executeTool: ExecuteToolFn;
  private readonly maxToolCalls: number;
  private readonly auditSink: AuditSink;
  private readonly piiExposureAllowed: boolean;

  constructor(deps: CompositeRunnerDeps) {
    this.apiClient = deps.apiClient;
    this.tenantId = deps.tenantId;
    this.scopes = deps.scopes;
    this.executeTool = deps.executeTool ?? (defaultExecuteTool as ExecuteToolFn);
    this.maxToolCalls =
      deps.maxToolCalls && deps.maxToolCalls > 0 ? deps.maxToolCalls : DEFAULT_MAX_TOOL_CALLS;
    this.auditSink = deps.auditSink ?? new NoopAuditSink();
    this.piiExposureAllowed = deps.piiExposureAllowed === true;
  }

  /**
   * DEFAULT-DENY PII gate for data surfaced in the run result (#5317). Mirrors
   * the base-tool masking in `mcp-server-factory.ts`: without the
   * AGENT_PII_EXPOSURE grant, mask contact PII (step outputs + templated args)
   * before it reaches the external LLM. Applied to a COPY at the output
   * boundary via `maskPiiValue` -- the live `stepOutputs` stays raw so a later
   * step's templating (e.g. a send step using a contact) is unaffected. Note we
   * mask the structured data here, NOT the built result string: the composite
   * result carries a human-readable prefix + JSON, which `maskPiiInToolResult`
   * (pure-JSON only) would fail-open on.
   */
  private maskData<T>(data: T): T {
    return this.piiExposureAllowed ? data : (maskPiiValue(data) as T);
  }

  /**
   * Surfaced form of the step outcomes. A step's `args` are SERVER-RESOLVED via
   * templating from prior read-step outputs, so they can carry contact PII under
   * ARBITRARY key names (`to`, `recipient`, ...) that the key-based
   * `maskPiiValue` cannot catch -- and that the external LLM never saw. Without
   * the grant we therefore drop the resolved arg VALUES from the surfaced
   * outcomes entirely (the id/tool/status still show what each step did); the
   * real args used for the actual tool call are unaffected.
   */
  private surfaceOutcomes(outcomes: StepOutcome[]): StepOutcome[] {
    if (this.piiExposureAllowed) {
      return outcomes;
    }
    return outcomes.map((o) => (o.args ? { ...o, args: {} } : o));
  }

  async execute(
    playbook: Playbook,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
    const steps = playbook.meta.steps ?? [];
    if (steps.length === 0) {
      return errorResult(
        `Composite playbook '${playbook.meta.id}' has no steps to run.`
      );
    }

    // #5204: the run's effective mutating scope (max over its step tools). A
    // read-only run (`read`) is never audited; a run that mutates in any step
    // gets a `composite_run` terminal row + `composite_step` rows for its
    // mutating steps.
    const runScope = maxToolScope(steps.map((s) => s.tool));
    const mutatingRun = runScope === 'draft' || runScope === 'send';

    // Guardrail 1: tool-call budget. Each step is one tool call. Abort before
    // running anything if the program alone exceeds the cap.
    if (steps.length > this.maxToolCalls) {
      if (mutatingRun) {
        this.auditRun(playbook, runScope as 'draft' | 'send', 'budget_exceeded', {
          errorCode: 'ToolCallBudgetExceeded',
          detail: `steps=${steps.length},max=${this.maxToolCalls}`,
        });
      }
      return errorResult(
        `Composite playbook '${playbook.meta.id}' aborted: tool-call budget ` +
          `exceeded (${steps.length} steps > max ${this.maxToolCalls}). No step was run.`
      );
    }

    // Guardrail 2: scope PRE-VALIDATION across ALL steps, before any execution.
    // A single under-scoped step fails the whole run up front -> no partial
    // mutation because of a scope error discovered mid-run.
    const scopeViolation = this.findScopeViolation(steps);
    if (scopeViolation) {
      // A denied step needs draft/send by definition -> runScope is mutating.
      this.auditRun(playbook, runScope as 'draft' | 'send', 'scope_denied', {
        errorCode: 'ScopeDenied',
        detail: `step=${scopeViolation.stepId},needs=${scopeViolation.requiredScope}`,
      });
      return errorResult(
        `Composite playbook '${playbook.meta.id}' aborted before running: step ` +
          `'${scopeViolation.stepId}' calls tool '${scopeViolation.tool}' which ` +
          `requires scope '${scopeViolation.requiredScope}', not granted by this ` +
          `API key. No step was run.`
      );
    }

    // Build the input context: provided args over declared input defaults.
    const inputs = this.resolveInputs(playbook, args);
    const stepOutputs: Record<string, unknown> = {};
    const outcomes: StepOutcome[] = [];

    for (const step of steps) {
      const context = { inputs, steps: stepOutputs };
      let resolvedArgs: Record<string, unknown>;
      try {
        resolvedArgs = resolveTemplate(step.args ?? {}, context) as Record<string, unknown>;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outcomes.push({
          id: step.id,
          tool: step.tool,
          status: 'error',
          args: {},
          error: message,
        });
        this.auditStep(step, 'error', {}, 'TemplateError');
        if (mutatingRun) {
          this.auditRun(playbook, runScope as 'draft' | 'send', 'error', {
            errorCode: 'TemplateError',
            detail: `failedStep=${step.id}`,
          });
        }
        return failedRunResult(playbook, this.surfaceOutcomes(outcomes), step, message);
      }

      try {
        const raw = await this.runStep(step, resolvedArgs);
        stepOutputs[step.id] = parseStepOutput(raw);
        outcomes.push({ id: step.id, tool: step.tool, status: 'ok', args: resolvedArgs });
        this.auditStep(step, 'success', resolvedArgs);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outcomes.push({
          id: step.id,
          tool: step.tool,
          status: 'error',
          args: resolvedArgs,
          error: message,
        });
        this.auditStep(
          step,
          'error',
          resolvedArgs,
          err instanceof Error ? err.name : 'Error'
        );
        if (mutatingRun) {
          this.auditRun(playbook, runScope as 'draft' | 'send', 'error', {
            errorCode: err instanceof Error ? err.name : 'Error',
            detail: `failedStep=${step.id}`,
          });
        }
        return failedRunResult(playbook, this.surfaceOutcomes(outcomes), step, message);
      }
    }

    if (mutatingRun) {
      this.auditRun(playbook, runScope as 'draft' | 'send', 'success', {
        detail: `steps=${outcomes.length}`,
      });
    }
    return successResult(playbook, this.surfaceOutcomes(outcomes), this.maskData(stepOutputs));
  }

  /**
   * Audit ONE composite step -- only when it is mutating (draft/send). Read
   * steps are not audited. Best-effort (never throws / blocks).
   */
  private auditStep(
    step: PlaybookStep,
    outcome: 'success' | 'error',
    args: Record<string, unknown>,
    errorCode?: string
  ): void {
    const scope = resolveToolScope({ name: step.tool });
    if (scope !== 'draft' && scope !== 'send') {
      return;
    }
    emitAudit(this.auditSink, {
      action: 'composite_step',
      toolName: step.tool,
      scope,
      outcome,
      errorCode,
      detail: summarizeArgs(args),
    });
  }

  /** Audit the terminal run outcome. Caller guarantees `runScope` is mutating. */
  private auditRun(
    playbook: Playbook,
    runScope: 'draft' | 'send',
    outcome: 'success' | 'error' | 'budget_exceeded' | 'scope_denied',
    extra?: { errorCode?: string; detail?: string }
  ): void {
    emitAudit(this.auditSink, {
      action: 'composite_run',
      toolName: playbook.meta.id,
      scope: runScope,
      outcome,
      errorCode: extra?.errorCode,
      detail: extra?.detail,
    });
  }

  /** Execute one step, wrapping mutating (`send`) calls with an Idempotency-Key. */
  private async runStep(step: PlaybookStep, args: Record<string, unknown>): Promise<unknown> {
    if (resolveToolScope({ name: step.tool }) === 'send') {
      const { key, cleanedArgs } = resolveIdempotencyKey({
        tenantId: this.tenantId,
        toolName: step.tool,
        args,
      });
      return this.executeTool(step.tool, withIdempotencyKey(this.apiClient, key), cleanedArgs);
    }
    return this.executeTool(step.tool, this.apiClient, args);
  }

  /**
   * First step whose tool the caller's scopes do not permit, or `undefined`.
   * Keys with no fine scope at all are unrestricted (see #5192).
   */
  private findScopeViolation(
    steps: PlaybookStep[]
  ): { stepId: string; tool: string; requiredScope: string } | undefined {
    if (grantedScopeLevel(this.scopes) === null) {
      return undefined;
    }
    for (const step of steps) {
      if (!isToolAllowedForScopes({ name: step.tool }, this.scopes)) {
        return {
          stepId: step.id,
          tool: step.tool,
          requiredScope: resolveToolScope({ name: step.tool }),
        };
      }
    }
    return undefined;
  }

  /** Merge provided input args over the playbook's declared input defaults. */
  private resolveInputs(
    playbook: Playbook,
    args: Record<string, unknown>
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    const declared = playbook.meta.inputs;
    if (declared) {
      for (const [name, spec] of Object.entries(declared)) {
        const s = (spec ?? {}) as Record<string, unknown>;
        if (s.default !== undefined) {
          merged[name] = s.default;
        }
      }
    }
    for (const [name, value] of Object.entries(args)) {
      if (value !== undefined) {
        merged[name] = value;
      }
    }
    return merged;
  }
}

/**
 * Recursively resolve `{{...}}` templates in a value against `context`. A value
 * that is EXACTLY one placeholder keeps the referenced value's native type; a
 * placeholder embedded in a larger string is stringified. Throws `TemplateError`
 * for an unresolved reference so a broken program fails clearly instead of
 * silently sending `undefined`.
 */
export function resolveTemplate(value: unknown, context: unknown): unknown {
  if (typeof value === 'string') {
    return resolveStringTemplate(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplate(v, context));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveTemplate(v, context);
    }
    return out;
  }
  return value;
}

const FULL_PLACEHOLDER = /^\{\{\s*([^}]+?)\s*\}\}$/;
const EMBEDDED_PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;

function resolveStringTemplate(value: string, context: unknown): unknown {
  const full = value.match(FULL_PLACEHOLDER);
  if (full) {
    return resolvePath(context, full[1]);
  }
  return value.replace(EMBEDDED_PLACEHOLDER, (_m, path: string) => {
    const resolved = resolvePath(context, path);
    return resolved === undefined || resolved === null ? '' : stringifyScalar(resolved);
  });
}

function stringifyScalar(value: unknown): string {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Walk a dotted path (with numeric array indices) through `context`. */
function resolvePath(context: unknown, path: string): unknown {
  const segments = path.trim().split('.');
  let current: unknown = context;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      throw new TemplateError(`unresolved template reference '${path}'`);
    }
    if (Array.isArray(current)) {
      const idx = Number(segment);
      if (!Number.isInteger(idx)) {
        throw new TemplateError(`invalid array index '${segment}' in '${path}'`);
      }
      current = current[idx];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      throw new TemplateError(`cannot descend into '${segment}' of '${path}'`);
    }
  }
  if (current === undefined) {
    throw new TemplateError(`unresolved template reference '${path}'`);
  }
  return current;
}

/**
 * Parse a tool result into the value threaded to later steps: the JSON of the
 * first text content item when parseable, else the raw result. Tool handlers
 * return `{ content: [{ type:'text', text: JSON.stringify(response) }] }`, so
 * this recovers the structured API response for `{{steps.<id>.<path>}}` refs.
 */
export function parseStepOutput(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && Array.isArray((raw as { content?: unknown }).content)) {
    const content = (raw as { content: Array<Record<string, unknown>> }).content;
    const first = content.find((c) => c && c.type === 'text' && typeof c.text === 'string');
    if (first) {
      try {
        return JSON.parse(first.text as string);
      } catch {
        return first.text;
      }
    }
  }
  return raw;
}

function errorResult(text: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return { content: [{ type: 'text', text }], isError: true };
}

function failedRunResult(
  playbook: Playbook,
  outcomes: StepOutcome[],
  failedStep: PlaybookStep,
  message: string
): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const summary = {
    playbook: playbook.meta.id,
    playbookVersion: playbook.meta.version,
    status: 'error' as const,
    failedStep: failedStep.id,
    failedTool: failedStep.tool,
    error: message,
    steps: outcomes,
  };
  const text =
    `Composite playbook '${playbook.meta.id}' failed at step '${failedStep.id}' ` +
    `(tool '${failedStep.tool}'): ${message}\n\n` +
    JSON.stringify(summary, null, 2);
  return { content: [{ type: 'text', text }], isError: true };
}

function successResult(
  playbook: Playbook,
  outcomes: StepOutcome[],
  stepOutputs: Record<string, unknown>
): { content: Array<{ type: 'text'; text: string }> } {
  const summary = {
    playbook: playbook.meta.id,
    playbookVersion: playbook.meta.version,
    status: 'ok' as const,
    stepsRun: outcomes.length,
    steps: outcomes,
    outputs: stepOutputs,
  };
  const text =
    `Composite playbook '${playbook.meta.id}@${playbook.meta.version}' completed ` +
    `${outcomes.length} step(s).\n\n` +
    JSON.stringify(summary, null, 2);
  return { content: [{ type: 'text', text }] };
}
