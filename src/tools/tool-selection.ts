/**
 * Shared tool-selection logic.
 *
 * Central place that maps a resolved tenant (scope + optional enabledTools
 * allowlist) to the concrete set of tool definitions it may see. Used by both
 * the stdio server (src/index.ts) and the HTTP gateway (src/http/*) so the two
 * transports never drift apart in what a tenant is allowed to call.
 */

import { publicTools } from './public/index.js';
import { appTools } from './app/index.js';
import { adminTools } from './admin/index.js';
import { internalTools } from './internal/index.js';
import { metaTools } from './meta/index.js';
import { isToolAllowedForScopes } from './tool-scopes.js';
import type { TenantConfig } from '../types/index.js';

export const META_TOOL_NAMES = new Set(metaTools.map((t) => t.name));

export interface ToolSelectionOptions {
  /**
   * Include the runtime meta tools (switch_tenant, ...). Only meaningful for
   * the multi-tenant stdio server. The HTTP gateway pins one tenant per
   * bearer token, so meta tools are omitted there.
   */
  includeMeta?: boolean;
  /**
   * Fine-grained per-key scopes (`read` | `draft` | `send`) resolved from the
   * bearer token (#5191). When present, `tools/list` is gated so the key only
   * sees tools whose required scope stage it is granted (read-only keys never
   * see mutating tools). Absent/legacy coarse-scope keys (and the stdio server)
   * are unrestricted. Meta tools are transport plumbing and never scope-gated.
   */
  scopes?: string[];
}

/**
 * Resolve the list of tool definitions a tenant is allowed to see, honouring
 * both its scope and its optional `enabledTools` allowlist.
 */
export function getToolsForTenant(
  tenant: TenantConfig,
  options: ToolSelectionOptions = {}
): any[] {
  const { includeMeta = true, scopes } = options;

  const tools: any[] = [];
  if (includeMeta) {
    tools.push(...metaTools);
  }
  tools.push(...publicTools);

  if (tenant.scope === 'app' || tenant.scope === 'admin') {
    tools.push(...appTools);
  }

  if (tenant.scope === 'admin') {
    tools.push(...adminTools);
  }

  if (tenant.scope === 'internal' || tenant.scope === 'admin') {
    tools.push(...internalTools);
  }

  // Filter by enabledTools allowlist if configured. Meta tools are never
  // filtered out -- they are transport plumbing, not business tools.
  const enabledPatterns =
    tenant.enabledTools && tenant.enabledTools.length > 0
      ? tenant.enabledTools.map(
          (pattern) => new RegExp('^' + pattern.replace('*', '.*') + '$')
        )
      : null;

  return tools.filter((tool) => {
    // Meta tools bypass both scope and allowlist gating.
    if (META_TOOL_NAMES.has(tool.name)) {
      return true;
    }
    // enabledTools allowlist (tenant + per-key, applied by the gateway).
    if (
      enabledPatterns &&
      !enabledPatterns.some((pattern) => pattern.test(tool.name))
    ) {
      return false;
    }
    // Fine-scope gating: a read-only key must not even SEE mutating tools.
    if (!isToolAllowedForScopes(tool, scopes)) {
      return false;
    }
    return true;
  });
}
