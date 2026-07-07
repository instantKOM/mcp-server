/**
 * Builds an MCP `Server` instance bound to exactly one resolved tenant.
 *
 * Each HTTP request/session gets its own Server + ApiClient pinned to the
 * tenant its bearer token resolved to, so there is no cross-tenant leakage and
 * no runtime tenant switching (the multi-tenant meta tools are intentionally
 * excluded here -- the bearer token IS the tenant selector).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { ApiClient } from '@instantkom/api-client';
import type { TenantConfig } from '../types/index.js';
import { getToolsForTenant } from '../tools/tool-selection.js';
import { executeTool } from '../tools/tool-router.js';
import { resolveToolScope, filterReadXorSend, assertReadXorSend } from '../tools/tool-scopes.js';
import { resolveIdempotencyKey, withIdempotencyKey } from './idempotency.js';
import { maskPiiInToolResult } from './pii-mask.js';
import { captureMcpException } from '../monitoring/sentry.js';
import {
  playbookRegistry as defaultPlaybookRegistry,
  type PlaybookRegistry,
} from '../playbooks/registry.js';
import {
  listPromptPlaybooks,
  listCompositePlaybooks,
  getServablePrompt,
  playbookToPromptDefinition,
  playbookToToolDefinition,
  renderPromptMessages,
  describePlaybook,
  playbookServedMeta,
  isCompositePlaybookTool,
  toolNameToPlaybookId,
  type CompositePlaybookExecutor,
} from '../playbooks/serving.js';
import { PlaybookCompositeExecutor } from '../playbooks/composite-runner.js';
import {
  type AuditSink,
  NoopAuditSink,
  emitAudit,
  summarizeArgs,
} from './audit-log.js';

export interface TenantMcpServerOptions {
  /**
   * Fine-grained per-key scopes (`read` | `draft` | `send`) resolved from the
   * bearer token on THIS request (#5191/#5192). Gates both `tools/list`
   * (visibility) and `tools/call` (execution). Because the gateway re-resolves
   * auth on every request and passes the fresh scopes here, a key that is
   * revoked or downgraded takes effect on the very next call -- no cached
   * snapshot. Omit for full access (stdio / legacy coarse-scope keys).
   */
  scopes?: string[];
  /**
   * Subscription tier of the key's plan, resolved from auth (#5196). Gates
   * playbook visibility (minTier) in prompts/list + tools/list. When omitted the
   * serving layer defaults CONSERVATIVELY to the lowest tier.
   */
  tier?: string;
  /**
   * Playbook registry to serve from. Defaults to the shared shipped registry.
   * Read live on every list/get so playbooks added/removed on disk flow through
   * with no code deploy (AK2). Injectable for tests.
   */
  playbookRegistry?: PlaybookRegistry;
  /**
   * Executor seam for `composite` playbooks (#5197). Defaults to a stub that
   * reports "not yet implemented". #5196 only registers + routes; it does NOT
   * build the runner. Injectable so tests can assert the seam is invoked.
   */
  compositeExecutor?: CompositePlaybookExecutor;
  /**
   * Key-attributed audit sink (#5204, AK4). Every MUTATING tool call and
   * composite step/run is recorded here. Defaults to a no-op (stdio / tests);
   * the HTTP gateway injects an `Apis2AuditSink` bound to this request's token.
   */
  auditSink?: AuditSink;
  /**
   * Per-composite-run tool-call budget (#5204 runaway protection). Overrides the
   * runner default. The gateway sources this from `MCP_MAX_TOOL_CALLS_PER_RUN`.
   */
  maxToolCallsPerRun?: number;
  /**
   * Whether the presenting key carries the AGENT_PII_EXPOSURE grant (#5317),
   * resolved from `ResolvedAuth.piiExposureAllowed`. DEFAULT-DENY: when this is
   * not exactly `true`, base tool results are run through {@link maskPiiInToolResult}
   * so contact PII (phone `identifier`, `name`, `email`) is masked before it
   * reaches the external LLM. Omit for full access (stdio / trusted contexts).
   */
  piiExposureAllowed?: boolean;
}

export function createTenantMcpServer(
  tenant: TenantConfig,
  apiClient: ApiClient,
  options: TenantMcpServerOptions = {}
): Server {
  const registry = options.playbookRegistry ?? defaultPlaybookRegistry;
  const auditSink = options.auditSink ?? new NoopAuditSink();
  // #5197: real server-side composite runner, bound to THIS request's tenant
  // client + resolved scopes (so its per-step scope guard matches the gateway).
  // #5204: the same audit sink + per-run tool-call budget are threaded in.
  const compositeExecutor =
    options.compositeExecutor ??
    new PlaybookCompositeExecutor({
      apiClient,
      tenantId: tenant.id,
      scopes: options.scopes,
      auditSink,
      maxToolCalls: options.maxToolCallsPerRun,
      // #5317: same default-deny PII gate as the base-tool path -- without the
      // AGENT_PII_EXPOSURE grant, the composite run's surfaced result is masked.
      piiExposureAllowed: options.piiExposureAllowed,
    });

  const server = new Server(
    {
      name: 'instantkom-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  const baseTools = getToolsForTenant(tenant, {
    includeMeta: false,
    scopes: options.scopes,
  });

  // Composite-delivery playbooks (#5196) surface as callable tools alongside the
  // regular tools, scope + tier gated. Their execution is the #5197 seam. Read
  // the registry live so on-disk playbook changes flow through with no deploy.
  const compositeTools = listCompositePlaybooks(registry, options.scopes, options.tier).map(
    playbookToToolDefinition
  );
  // READ XOR SEND (#5202): the primary scope filter (getToolsForTenant /
  // listCompositePlaybooks) already excludes mutating tools for a read-only key.
  // `filterReadXorSend` is a redundant final hard-strip so a regression in the
  // primary filter can never leak a mutation surface into a read-only session;
  // `assertReadXorSend` then proves the post-condition (fail-closed if violated).
  const tools = filterReadXorSend([...baseTools, ...compositeTools], options.scopes);
  assertReadXorSend(options.scopes, tools);

  // Authoritative allow-set for THIS request: exactly the tools the resolved
  // key may see. tools/call is gated against the same set so a key can never
  // invoke a tool it is not scoped for (403-equivalent), even though tools are
  // dispatched by name. Built from the scope/allowlist-filtered list above.
  const allowedToolNames = new Set<string>(tools.map((tool) => tool.name));

  // Resolved required scope per tool -- used to decide which calls are MUTATING
  // (`send`) and therefore need an Idempotency-Key propagated to the API (AK4).
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // prompts/list: prompt-delivery playbooks the key's scope + tier allow. Read
  // live from the registry so added/removed playbooks flow through with no deploy.
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const prompts = listPromptPlaybooks(registry, options.scopes, options.tier).map(
      playbookToPromptDefinition
    );
    return { prompts };
  });

  // prompts/get: return the skill.md body (with argument substitution) for an
  // allowed prompt id. An unknown OR forbidden id -> InvalidParams (the two are
  // indistinguishable on purpose so gating never leaks a hidden playbook).
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const playbook = getServablePrompt(registry, name, options.scopes, options.tier);
    if (!playbook) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown or forbidden prompt '${name}'.`
      );
    }
    return {
      description: describePlaybook(playbook),
      messages: renderPromptMessages(playbook, args as Record<string, unknown> | undefined),
      _meta: { ...playbookServedMeta(playbook) } as Record<string, unknown>,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Per-call scope/allowlist gate. Runs on the per-request resolved auth
    // (never a cached snapshot), so revoke/downgrade takes effect immediately.
    if (!allowedToolNames.has(name)) {
      return {
        content: [
          {
            type: 'text',
            text:
              `Error: forbidden -- tool '${name}' is not permitted for this ` +
              `API key's scope. Required a higher scope (read < draft < send) ` +
              `or the tool is excluded by the key's allowlist.`,
          },
        ],
        isError: true,
      };
    }

    try {
      // Composite playbook tool -> route to the #5197 executor seam. It is
      // already in the allow-set (scope + tier gated at build time), so no extra
      // gating here. #5196 ships a stub executor; #5197 replaces it.
      if (isCompositePlaybookTool(name)) {
        const playbook = registry.get(toolNameToPlaybookId(name));
        if (!playbook) {
          throw new Error(`Composite playbook '${name}' is no longer available.`);
        }
        return await compositeExecutor.execute(playbook, (args || {}) as Record<string, unknown>);
      }

      // MUTATING (`send`) tools carry an Idempotency-Key so a duplicate call
      // with the same effective key performs only ONE mutation (the API's global
      // idempotency interceptor caches + replays the first response). read/draft
      // tools are left untouched. Explicit caller key (tool arg or MCP _meta)
      // wins; otherwise a deterministic key derived from tenant+tool+args.
      const tool = toolByName.get(name);
      const callArgs = (args || {}) as Record<string, unknown>;
      // #5204: a draft/send call is a MUTATING agent action -> audited (with its
      // outcome) after execution. read tools are never audited.
      const scope = tool ? resolveToolScope(tool) : 'read';
      const mutating = scope === 'draft' || scope === 'send';

      let result: Awaited<ReturnType<typeof executeTool>>;
      if (tool && scope === 'send') {
        const { key, cleanedArgs } = resolveIdempotencyKey({
          tenantId: tenant.id,
          toolName: name,
          args: callArgs,
          meta: (request.params as { _meta?: Record<string, unknown> })._meta,
        });
        result = await executeTool(
          name,
          withIdempotencyKey(apiClient, key),
          cleanedArgs,
        );
      } else {
        result = await executeTool(name, apiClient, callArgs);
      }

      // #5317: default-deny PII gate for BASE tools. Without the
      // AGENT_PII_EXPOSURE grant, mask contact PII (phone `identifier`, `name`,
      // `email`) in the result before it reaches the external LLM. Composite
      // playbooks enforce the same boundary via assertPiiExposureAllowed.
      if (options.piiExposureAllowed !== true) {
        result = maskPiiInToolResult(result);
      }

      if (mutating) {
        const isErr = !!(
          result &&
          typeof result === 'object' &&
          (result as { isError?: unknown }).isError
        );
        emitAudit(auditSink, {
          action: 'tool',
          toolName: name,
          scope: scope as 'draft' | 'send',
          outcome: isErr ? 'error' : 'success',
          errorCode: isErr ? 'ToolError' : undefined,
          detail: summarizeArgs(callArgs),
        });
      }

      return result;
    } catch (error) {
      // #5204: a thrown mutating call is still an audited (error) agent action.
      // Composite tools are excluded here -- their audit is the runner's job.
      const tool = toolByName.get(name);
      const scope = tool ? resolveToolScope(tool) : 'read';
      if (!isCompositePlaybookTool(name) && (scope === 'draft' || scope === 'send')) {
        emitAudit(auditSink, {
          action: 'tool',
          toolName: name,
          scope: scope as 'draft' | 'send',
          outcome: 'error',
          errorCode: error instanceof Error ? error.name : 'Error',
          detail: summarizeArgs((args || {}) as Record<string, unknown>),
        });
      }
      captureMcpException(error, { tool: name, tenant: tenant.id });
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
