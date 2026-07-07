/**
 * Playbook SERVING layer (Agent-Connect EPIC 2, issue #5196).
 *
 * Turns the registry's playbooks into MCP protocol surfaces on a per-request,
 * scope-+-tier-gated basis:
 *   - `delivery: 'prompt'`    -> MCP prompts (prompts/list + prompts/get). The
 *                               `skill.md` body becomes the prompt content and
 *                               `meta.inputs` become prompt arguments.
 *   - `delivery: 'composite'` -> callable tools surfaced in tools/list. The
 *                               actual server-side execution is #5197; here we
 *                               only produce the tool DEFINITION and route calls
 *                               to an injectable executor seam.
 *
 * GATING (AK1 EPIC 2): a connected client sees exactly the playbooks its key's
 * SCOPE (read/draft/send via ResolvedAuth.scopes) AND TIER (minTier vs the key's
 * plan tier) allow. Scope reuses `listAllowedForScopes` (#5192 hierarchy); tier
 * reuses `availableForTier` (#5195 TIER_ORDER). Both filters are intersected.
 *
 * TIER SOURCE / conservative default: the tier comes from the resolved auth
 * (`ResolvedAuth.tier`, populated by the introspect seam). When it is absent
 * (the introspect endpoint does not yet return a tier), we DEFAULT CONSERVATIVELY
 * to the lowest tier so an unknown-tier key can only ever see the lowest-tier
 * playbooks -- never accidentally widening visibility. See `resolveTierForGating`.
 *
 * SERVING READS THE REGISTRY LIVE (AK2): every list/get call goes through the
 * registry, so adding/removing a playbook on disk changes what is served with no
 * code deploy.
 */

import type { PlaybookRegistry } from './registry.js';
import { TIER_ORDER, isPastSunset, playbookVersionId, effectiveRequiredScope } from './registry.js';
import type { Playbook } from './types.js';
import type { ToolScope } from '../tools/tool-scopes.js';

/**
 * Prefix for tool names generated from `composite` playbooks. Keeps them in a
 * distinct namespace so they never collide with a real API-backed tool and can
 * be recognized in the CallTool handler for routing to the executor seam.
 */
export const COMPOSITE_TOOL_PREFIX = 'playbook_';

/** True when `name` is a composite-playbook tool name (has the reserved prefix). */
export function isCompositePlaybookTool(name: string): boolean {
  return name.startsWith(COMPOSITE_TOOL_PREFIX);
}

/** Map a composite-playbook tool name back to its playbook id. */
export function toolNameToPlaybookId(name: string): string {
  return name.slice(COMPOSITE_TOOL_PREFIX.length);
}

/** Map a playbook id to its composite-playbook tool name. */
export function playbookIdToToolName(id: string): string {
  return `${COMPOSITE_TOOL_PREFIX}${id}`;
}

/**
 * Resolve the tier used for gating. When the resolved auth carries no tier
 * (introspect seam does not expose one yet), default to the LOWEST tier so an
 * unknown-tier key sees only the lowest-tier playbooks (fail-closed visibility).
 */
export function resolveTierForGating(tier: string | undefined): string {
  return tier && tier.trim() !== '' ? tier : TIER_ORDER[0];
}

/**
 * The playbooks a key is allowed to see for a given delivery mode: intersection
 * of scope-allowed (#5192) and tier-allowed (#5195). Reads the registry live.
 *
 * SUNSET RULE (#5199): a deprecated playbook stays served (marked with a
 * `[DEPRECATED]` description + `_meta.deprecated`) so clients are WARNED, not
 * surprised -- UNTIL its `sunsetAfter` boundary has passed, at which point it is
 * EXCLUDED here. The registry itself keeps listing it (so version/admin tooling
 * still sees it); only the served surface hides it. `now` is injectable for tests.
 */
function listServable(
  registry: PlaybookRegistry,
  delivery: Playbook['meta']['delivery'],
  scopes: string[] | undefined,
  tier: string | undefined,
  now: Date = new Date()
): Playbook[] {
  const gateTier = resolveTierForGating(tier);
  const tierAllowedIds = new Set(registry.availableForTier(gateTier).map((p) => p.meta.id));
  return registry
    .listAllowedForScopes(scopes)
    .filter(
      (p) =>
        p.meta.delivery === delivery &&
        tierAllowedIds.has(p.meta.id) &&
        !isPastSunset(p.meta, now)
    );
}

/** Prompt-delivery playbooks a key may see (scope + tier gated). */
export function listPromptPlaybooks(
  registry: PlaybookRegistry,
  scopes: string[] | undefined,
  tier: string | undefined
): Playbook[] {
  return listServable(registry, 'prompt', scopes, tier);
}

/** Composite-delivery playbooks a key may see (scope + tier gated). */
export function listCompositePlaybooks(
  registry: PlaybookRegistry,
  scopes: string[] | undefined,
  tier: string | undefined
): Playbook[] {
  return listServable(registry, 'composite', scopes, tier);
}

/**
 * Look up a prompt-delivery playbook by id, enforcing scope + tier gating. Returns
 * `undefined` when the id is unknown, not a prompt, or not visible to this key --
 * the caller maps that to an MCP error (forbidden/unknown are indistinguishable
 * on purpose, so gating never leaks the existence of a hidden playbook).
 */
export function getServablePrompt(
  registry: PlaybookRegistry,
  id: string,
  scopes: string[] | undefined,
  tier: string | undefined
): Playbook | undefined {
  return listPromptPlaybooks(registry, scopes, tier).find((p) => p.meta.id === id);
}

interface PromptArgument {
  name: string;
  description?: string;
  required: boolean;
}

/**
 * Structured version + deprecation metadata surfaced on every served playbook
 * (prompt or tool) via the MCP `_meta` slot, so a client can programmatically
 * see WHICH version it is running and whether the playbook is deprecated.
 */
export interface PlaybookServedMeta {
  /** `id@version` identity string. */
  playbookId: string;
  /** The semver the client is running. */
  playbookVersion: string;
  /** True when the playbook is deprecated (still served until sunset). */
  deprecated?: boolean;
  /** Replacement playbook id, when deprecated. */
  supersededBy?: string;
  /** Human-readable deprecation reason, when deprecated. */
  deprecationReason?: string;
  /** Sunset boundary (ISO date or semver), when set. */
  sunsetAfter?: string;
}

/** Build the `_meta` version/deprecation descriptor for a served playbook. */
export function playbookServedMeta(playbook: Playbook): PlaybookServedMeta {
  const m = playbook.meta;
  return {
    playbookId: playbookVersionId(m),
    playbookVersion: m.version,
    ...(m.deprecated ? { deprecated: true } : {}),
    ...(m.supersededBy !== undefined ? { supersededBy: m.supersededBy } : {}),
    ...(m.deprecationReason !== undefined ? { deprecationReason: m.deprecationReason } : {}),
    ...(m.sunsetAfter !== undefined ? { sunsetAfter: m.sunsetAfter } : {}),
  };
}

/**
 * Human-visible description for a served playbook: the base description with the
 * running version appended (`... (v1.2.0)`) and, when deprecated, a
 * `[DEPRECATED] ...` prefix that names the replacement so clients are warned in
 * plain text even if they ignore `_meta`.
 */
export function describePlaybook(playbook: Playbook): string {
  const m = playbook.meta;
  let text = `${m.description} (v${m.version})`;
  if (m.deprecated) {
    const suffix = m.supersededBy ? ` -- use '${m.supersededBy}' instead` : '';
    text = `[DEPRECATED] ${text}${suffix}`;
  }
  return text;
}

/**
 * Derive MCP prompt arguments from a playbook's `meta.inputs`. Each input key
 * becomes an argument; `required` is honoured when the input declares it, else
 * an input is required only when it has no `default`.
 */
export function promptArgumentsForPlaybook(playbook: Playbook): PromptArgument[] {
  const inputs = playbook.meta.inputs;
  if (!inputs) {
    return [];
  }
  return Object.entries(inputs).map(([name, spec]) => {
    const s = (spec ?? {}) as Record<string, unknown>;
    const description = typeof s.description === 'string' ? s.description : undefined;
    const required =
      typeof s.required === 'boolean' ? s.required : s.default === undefined;
    return { name, ...(description ? { description } : {}), required };
  });
}

/** Build the MCP prompts/list entry for a prompt-delivery playbook. */
export function playbookToPromptDefinition(playbook: Playbook): {
  name: string;
  description: string;
  arguments: PromptArgument[];
  _meta: PlaybookServedMeta;
} {
  return {
    name: playbook.meta.id,
    description: describePlaybook(playbook),
    arguments: promptArgumentsForPlaybook(playbook),
    _meta: playbookServedMeta(playbook),
  };
}

/**
 * Render the prompt content for prompts/get. The `skill.md` body is returned as
 * a single user message. Provided `arguments` are substituted at `{{name}}`
 * placeholders (the substitution seam), and any provided values are also
 * surfaced as an explicit "Provided inputs" preamble so the model receives the
 * concrete values regardless of whether the author used placeholders.
 */
export function renderPromptMessages(
  playbook: Playbook,
  args: Record<string, unknown> | undefined
): Array<{ role: 'user'; content: { type: 'text'; text: string } }> {
  let body = playbook.skill;
  const provided = args ?? {};
  const entries = Object.entries(provided).filter(([, v]) => v !== undefined && v !== null);

  for (const [name, value] of entries) {
    const placeholder = new RegExp(`\\{\\{\\s*${escapeRegExp(name)}\\s*\\}\\}`, 'g');
    body = body.replace(placeholder, String(value));
  }

  let text = body;
  if (entries.length > 0) {
    const preamble = entries.map(([name, value]) => `- ${name}: ${String(value)}`).join('\n');
    text = `Provided inputs:\n${preamble}\n\n${body}`;
  }

  // Surface the running playbook version in the output itself (#5199), so the
  // model + any transcript records exactly which version produced the result.
  const deprecationNote = playbook.meta.deprecated
    ? ` [DEPRECATED${playbook.meta.supersededBy ? ` -> ${playbook.meta.supersededBy}` : ''}]`
    : '';
  text = `<!-- playbook: ${playbookVersionId(playbook.meta)}${deprecationNote} -->\n${text}`;

  return [{ role: 'user', content: { type: 'text', text } }];
}

/**
 * Build the MCP tools/list definition for a composite playbook. The
 * `requiredScope` is carried on the definition so downstream scope gating
 * (`resolveToolScope`) treats the playbook tool exactly like any other tool.
 */
export function playbookToToolDefinition(playbook: Playbook): {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredScope: ToolScope;
  _meta: PlaybookServedMeta;
} {
  return {
    name: playbookIdToToolName(playbook.meta.id),
    description: describePlaybook(playbook),
    inputSchema: inputSchemaForPlaybook(playbook),
    // EFFECTIVE scope (#5202): declared vs. what the steps actually call, so the
    // exposed tool def never under-declares the mutation a composite performs.
    requiredScope: effectiveRequiredScope(playbook.meta),
    _meta: playbookServedMeta(playbook),
  };
}

/** Derive a JSON-schema `inputSchema` from a playbook's `meta.inputs`. */
function inputSchemaForPlaybook(playbook: Playbook): Record<string, unknown> {
  const inputs = playbook.meta.inputs;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  if (inputs) {
    for (const [name, spec] of Object.entries(inputs)) {
      const s = (spec ?? {}) as Record<string, unknown>;
      const prop: Record<string, unknown> = {};
      if (typeof s.type === 'string') prop.type = s.type;
      if (typeof s.description === 'string') prop.description = s.description;
      if (s.default !== undefined) prop.default = s.default;
      properties[name] = prop;
      if (s.required === true || s.default === undefined) {
        required.push(name);
      }
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * The seam #5197 fills: server-side execution of a composite playbook. #5196
 * only registers the tool + routes calls here; it does NOT build the runner.
 */
export interface CompositePlaybookExecutor {
  execute(
    playbook: Playbook,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;
}

/**
 * Default executor stub for #5196: composite execution is not implemented until
 * #5197. Clearly marks the boundary and returns a non-crashing error result so
 * the tool is callable (and visible) without pretending to run.
 */
export const notImplementedCompositeExecutor: CompositePlaybookExecutor = {
  async execute(playbook) {
    return {
      content: [
        {
          type: 'text',
          text:
            `Composite playbook '${playbook.meta.id}' is not yet executable ` +
            `(server-side execution lands in #5197). Its definition is served ` +
            `here so clients can discover it.`,
        },
      ],
      isError: true,
    };
  },
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
