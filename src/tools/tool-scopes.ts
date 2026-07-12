/**
 * Per-tool scope classification + scope-grant checks (Agent-Connect EPIC 1,
 * issue #5192).
 *
 * A remote MCP key resolves (via the AuthResolver, #5191) to a set of fine
 * scopes drawn from `read | draft | send`. Every tool is classified into the
 * single scope STAGE it requires, and the HTTP gateway then gates both
 * `tools/list` (visibility) and `tools/call` (execution) on the per-request
 * resolved scopes -- so a read-only key never even sees a mutating tool, and a
 * key revoked mid-session fails its next call (the gateway re-resolves auth on
 * every request).
 *
 * Classification is deterministic and name-driven, NOT guessed per call:
 *   1. An explicit `requiredScope` on the tool definition always wins.
 *   2. A curated DRAFT allowlist (compose/prepare-without-send tools).
 *   3. A mutation-token scan -> `send` (create/update/delete/send/... are all
 *      mutating per the issue's definition of the `send` stage).
 *   4. A read-token scan -> `read` (get/list/search/download/export/...).
 *   5. Fail-closed default: `send` (most restrictive) + a one-time warning, so
 *      a newly-added tool is never silently downgraded to a weaker scope.
 *
 * Scope hierarchy (trust ordering): read < draft < send. A key's granted level
 * is the MAX rank among its fine scopes; a tool is allowed when its required
 * rank is <= the granted level. Keys that carry NO fine scope at all (e.g. the
 * legacy config/env resolver that only knows coarse tenant scopes, and the
 * stdio server which has full internal access) are treated as unrestricted --
 * scope gating only kicks in once a key actually declares read/draft/send.
 */

export type ToolScope = 'read' | 'draft' | 'send';

export const FINE_SCOPES: readonly ToolScope[] = ['read', 'draft', 'send'];

/** Trust ordering: higher rank = more privileged / more restrictive to grant. */
const SCOPE_RANK: Record<ToolScope, number> = {
  read: 0,
  draft: 1,
  send: 2,
};

/**
 * Curated allowlist of tools that PREPARE or COMPOSE content without dispatching
 * anything to end-recipients. These require `draft` (a read-only key must not
 * call them, but they are strictly less privileged than a real `send`).
 */
const DRAFT_TOOLS = new Set<string>([
  'generate_ai_reply',
]);

/**
 * Tokens that mark a tool as mutating (`send` stage). Per issue #5192 the
 * `send` stage covers all mutations: send/create/update/delete/etc. Scanned
 * across every underscore-separated token in the tool name, so noun-first admin
 * names (`admin_resend_mail`) are classified correctly too.
 */
const MUTATION_TOKENS = new Set<string>([
  'create', 'update', 'delete', 'remove', 'add', 'set', 'send', 'resend',
  'invite', 'publish', 'assign', 'unassign', 'mark', 'apply', 'subscribe',
  'unsubscribe', 'revoke', 'invalidate', 'terminate', 'restart', 'reset',
  'execute', 'run', 'submit', 'sign', 'release', 'retire', 'discard',
  'approve', 'reject', 'refuse', 'confirm', 'reorder', 'unlock', 'lock',
  'clear', 'process', 'provide', 'regenerate', 'change', 'start', 'stop',
  'impersonate', 'hard', 'archive', 'append', 'import', 'bulk', 'generate',
  'password', 'verify', 'prepare', 'reply', 'switch',
]);

/**
 * Tokens that mark a tool as read-only retrieval (`read` stage). Only consulted
 * once the name is known NOT to contain any mutation token.
 */
const READ_TOKENS = new Set<string>([
  'get', 'list', 'search', 'stats', 'statistics', 'download', 'export',
  'poll', 'preview', 'find', 'count', 'show', 'fetch', 'health', 'read',
  'analytics', 'check', 'validate',
]);

/** Tools already warned about (fail-closed default) -- warn once per name. */
const warnedTools = new Set<string>();

/**
 * Classify a tool name into the scope stage it requires. Deterministic and
 * pure; the only side effect is a one-time console warning when a name hits the
 * fail-closed default.
 */
export function classifyToolScope(name: string): ToolScope {
  if (DRAFT_TOOLS.has(name)) {
    return 'draft';
  }

  const tokens = name.split('_');

  for (const token of tokens) {
    if (MUTATION_TOKENS.has(token)) {
      return 'send';
    }
  }

  for (const token of tokens) {
    if (READ_TOKENS.has(token)) {
      return 'read';
    }
  }

  // Fail-closed: an unclassified tool requires the most restrictive scope so it
  // is never silently exposed to a weaker key. Warn once so it gets an explicit
  // classification instead of silently defaulting forever.
  if (!warnedTools.has(name)) {
    warnedTools.add(name);
    console.error(
      `[tool-scopes] WARNING: tool '${name}' has no scope classification; ` +
        `defaulting to 'send' (most restrictive). Add an explicit requiredScope ` +
        `or a token rule in tool-scopes.ts.`
    );
  }
  return 'send';
}

/**
 * Resolve the required scope for a tool definition: an explicit `requiredScope`
 * field on the definition wins, otherwise fall back to name classification.
 */
export function resolveToolScope(tool: { name: string; requiredScope?: ToolScope }): ToolScope {
  if (tool.requiredScope && FINE_SCOPES.includes(tool.requiredScope)) {
    return tool.requiredScope;
  }
  return classifyToolScope(tool.name);
}

/**
 * Compute the granted level for a set of key scopes.
 *
 * Returns `null` when the key carries NO fine scope (read/draft/send) at all --
 * meaning scope gating does not apply (legacy coarse-scope keys and the stdio
 * server retain full access). Otherwise returns the max rank the key grants.
 */
export function grantedScopeLevel(scopes: string[] | undefined): number | null {
  if (!scopes || scopes.length === 0) {
    return null;
  }
  let level: number | null = null;
  for (const scope of scopes) {
    if ((FINE_SCOPES as readonly string[]).includes(scope)) {
      const rank = SCOPE_RANK[scope as ToolScope];
      level = level === null ? rank : Math.max(level, rank);
    }
  }
  return level;
}

/**
 * Whether a key with the given scopes may use a tool. Keys without any fine
 * scope are unrestricted (returns true). Otherwise the tool's required rank must
 * be <= the key's granted level.
 */
export function isToolAllowedForScopes(
  tool: { name: string; requiredScope?: ToolScope },
  scopes: string[] | undefined
): boolean {
  const level = grantedScopeLevel(scopes);
  if (level === null) {
    return true;
  }
  return SCOPE_RANK[resolveToolScope(tool)] <= level;
}

/* ------------------------------------------------------------------------- *
 * READ XOR SEND -- hard mutation-isolation boundary (Agent-Connect EPIC 3,
 * issue #5202).
 *
 * SECURITY MODEL (why this holds structurally, not by LLM cooperation):
 * A read-scope playbook processes UNTRUSTED inbound message content inside the
 * customer LLM. A prompt-injection in that content must NOT be able to trigger a
 * send/draft/delete. The guarantee is NOT "the model refuses" -- it is that a
 * read-only session has NO REACHABLE MUTATION SURFACE:
 *   - `tools/list` for a read-only key contains ZERO non-read tools, so a
 *     maximally-injected LLM can only ever name tools that were never exposed.
 *   - `tools/call` is gated against that SAME exposed set (the gateway builds
 *     one allow-set and uses it for both list and call), so naming a mutating
 *     tool directly is rejected -- it is not in the set.
 *   - A `composite` playbook is gated by its EFFECTIVE scope (the max of its
 *     declared `requiredScope` AND every tool its steps call, see
 *     `compositeRequiredScope`), so a composite that mutates in ANY step is
 *     never listed to, nor callable by, a read-only key -- even if its author
 *     mis-declared `requiredScope: read`.
 *   - `prompt` playbooks are inert TEXT handed to the client LLM; they cannot
 *     invoke a tool the session never exposed, so a read-only prompt playbook
 *     has no mutation surface regardless of what its body (or injected content)
 *     asks for.
 *
 * The helpers below make that boundary a single, explicit, testable invariant
 * (`filterReadXorSend` hard-strips at LIST time; `assertReadXorSend` proves the
 * post-condition) instead of an emergent property of several independent gates.
 * Because gating is by exposed-tool-set, the isolation is provable and does not
 * depend on the LLM being uncompromised.
 * ------------------------------------------------------------------------- */

/** Fine scopes that represent a MUTATION capability (everything above `read`). */
export const NON_READ_SCOPES: readonly ToolScope[] = ['draft', 'send'];

/** Scope for a given rank (inverse of `SCOPE_RANK`). Indexed by 0=read..2=send. */
const SCOPE_BY_RANK: readonly ToolScope[] = ['read', 'draft', 'send'];

/** Numeric trust rank of a single scope (read=0 < draft=1 < send=2). */
export function scopeRank(scope: ToolScope): number {
  return SCOPE_RANK[scope];
}

/**
 * The MAX required scope across a set of tool NAMES (each classified via
 * `classifyToolScope`). Returns `read` for an empty set. Used to derive a
 * composite playbook's effective scope from the tools its steps call.
 */
export function maxToolScope(toolNames: string[]): ToolScope {
  let rank = SCOPE_RANK.read;
  for (const name of toolNames) {
    rank = Math.max(rank, SCOPE_RANK[classifyToolScope(name)]);
  }
  return SCOPE_BY_RANK[rank];
}

/**
 * EFFECTIVE required scope of a COMPOSITE playbook: the MAX of its DECLARED
 * `requiredScope` and the scope of every tool its steps call. This closes the
 * trust gap where an authored `meta.requiredScope` could under-declare what the
 * steps actually do -- a composite that mutates in any step effectively requires
 * (at least) that mutating scope, no matter what it declared. Downstream gating
 * (list + call) uses this so a read-only key can neither SEE nor RUN a composite
 * with a mutating step.
 */
export function compositeRequiredScope(
  declared: ToolScope,
  stepToolNames: string[]
): ToolScope {
  const rank = Math.max(SCOPE_RANK[declared], SCOPE_RANK[maxToolScope(stepToolNames)]);
  return SCOPE_BY_RANK[rank];
}

/**
 * True when the key resolves to a READ-ONLY grant: it carries fine scopes and
 * its granted level is exactly `read`. Keys without any fine scope (unrestricted
 * legacy/stdio) and keys granting draft/send are NOT read-only.
 */
export function isReadOnlyKey(scopes: string[] | undefined): boolean {
  return grantedScopeLevel(scopes) === SCOPE_RANK.read;
}

/**
 * LIST-time read-XOR-send guard (defense-in-depth). For a read-only key, HARD-
 * STRIP every tool whose required scope is not `read`, so the exposed tool set
 * is provably mutation-free. A no-op for non-read-only keys (draft/send and
 * unrestricted keys keep their scope-appropriate set from the primary filter).
 * This runs ON TOP OF the primary `isToolAllowedForScopes` filter -- a redundant
 * final gate so a future regression in the primary filter cannot silently leak a
 * mutating tool into a read-only session.
 */
export function filterReadXorSend<T extends { name: string; requiredScope?: ToolScope }>(
  tools: T[],
  scopes: string[] | undefined
): T[] {
  if (!isReadOnlyKey(scopes)) {
    return tools;
  }
  return tools.filter((tool) => resolveToolScope(tool) === 'read');
}

/** Raised when the read-XOR-send invariant is violated (a mutation tool leaked). */
export class ReadXorSendViolation extends Error {
  constructor(public readonly leakedTools: string[]) {
    super(
      `read-XOR-send invariant violated: a read-only key would be exposed ` +
        `mutating tool(s): ${leakedTools.join(', ')}`
    );
    this.name = 'ReadXorSendViolation';
  }
}

/**
 * Assert the read-XOR-send post-condition for a resolved set of exposed tools.
 * For a read-only key, throws `ReadXorSendViolation` if ANY exposed tool
 * resolves to a non-read scope. A no-op for non-read-only keys. Given correct
 * filtering this can never fire in production -- it is a hard belt-and-suspenders
 * check (used in the gateway after filtering, and as the explicit contract in
 * the hardening tests) that converts a filtering regression into a fail-closed
 * error instead of a silent mutation-surface leak.
 */
export function assertReadXorSend(
  scopes: string[] | undefined,
  tools: Array<{ name: string; requiredScope?: ToolScope }>
): void {
  if (!isReadOnlyKey(scopes)) {
    return;
  }
  const leaked = tools.filter((tool) => resolveToolScope(tool) !== 'read').map((t) => t.name);
  if (leaked.length > 0) {
    throw new ReadXorSendViolation(leaked);
  }
}
