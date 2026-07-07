/**
 * Auth-resolver seam for the Remote-MCP HTTP gateway.
 *
 * This is the single extension point where a bearer token becomes a resolved
 * tenant + scope context. Issue #5190 ships only the transport + this seam
 * with a minimal config/env-backed default. Issue #5191 will provide the real
 * apis2 scope resolver by implementing `AuthResolver` and injecting it into the
 * HttpGateway -- no transport code needs to change.
 *
 * Contract:
 *   - resolve(token) returns the tenant/scope context for a valid token.
 *   - resolve(token) returns null for an unknown/revoked token (gateway -> 403).
 *   - The gateway itself rejects a missing/malformed Authorization header (401)
 *     BEFORE ever calling resolve(), so implementations may assume a non-empty
 *     token string.
 *   - resolve() is invoked on EVERY request (see HttpGateway), never cached
 *     once-at-startup, so a revoked token fails the very next call.
 */

import type { ConfigLoader } from '../config/config.js';

/**
 * The context a valid bearer token resolves to. Deliberately minimal for
 * #5190; #5191 can enrich `scopes` / `enabledTools` from the real key store
 * without changing the shape consumers already depend on.
 */
export interface ResolvedAuth {
  /** Tenant the request is bound to. Selects the per-tenant ApiClient. */
  tenantId: string;
  /**
   * Coarse permission scopes granted to the token. For the default resolver
   * this mirrors the tenant scope; #5191 may derive finer-grained scopes.
   */
  scopes?: string[];
  /**
   * Optional per-token tool allowlist (glob patterns). When present it further
   * narrows the tenant's own `enabledTools`. Left undefined by the default.
   */
  enabledTools?: string[];
  /**
   * Subscription tier of the key's plan (e.g. `free` | `starter` | `business` |
   * `enterprise`), used to gate playbook visibility (#5196). Comes from the
   * introspect seam. Left undefined when the resolver cannot determine it -- the
   * serving layer then defaults CONSERVATIVELY to the lowest tier, so an
   * unknown-tier key sees only the lowest-tier playbooks.
   */
  tier?: string;
  /**
   * Agent-Connect send gate (issue #5203). True when the key carries the
   * MSG_AGENT_SEND perms2api grant. This is ORTHOGONAL to the `send` scope: an
   * agent send action requires BOTH `scopes` to include 'send' AND this flag.
   * Comes from the introspect seam; left undefined when the resolver cannot
   * determine it, which downstream gating MUST treat as NOT granted (default-deny).
   */
  agentSend?: boolean;
  /**
   * Agent-Connect PII opt-in (issue #5203). True when the key carries the
   * AGENT_PII_EXPOSURE perms2api grant, i.e. it may forward contact PII to the
   * external customer LLM in content-reading playbooks. OFF by default; the PII
   * guard seam (see pii-guard.ts) refuses PII forwarding unless this is true.
   */
  piiExposureAllowed?: boolean;
}

/**
 * Injectable resolver interface. Swap the implementation to change how tokens
 * map to tenants/scopes without touching the HTTP transport.
 */
export interface AuthResolver {
  /**
   * Resolve a bearer token to its auth context, or null if the token is
   * unknown/revoked. Implementations MUST be side-effect free w.r.t. the
   * response and safe to call on every request.
   */
  resolve(token: string): Promise<ResolvedAuth | null>;
}

/**
 * Build the default token -> tenantId map from the environment.
 *
 * Two supported forms (merged, per-tenant vars win on collision):
 *   1. MCP_HTTP_TOKENS = JSON object {"<token>": "<tenantId>", ...}
 *   2. MCP_TOKEN_<TENANT_ID_UPPER_SNAKE> = <token>  (one token per tenant)
 */
export function loadTokenMapFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Map<string, string> {
  const map = new Map<string, string>();

  const json = env.MCP_HTTP_TOKENS;
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, string>;
      for (const [token, tenantId] of Object.entries(parsed)) {
        if (token && tenantId) {
          map.set(token, tenantId);
        }
      }
    } catch (error) {
      console.error(
        `[Auth] Ignoring malformed MCP_HTTP_TOKENS JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  const prefix = 'MCP_TOKEN_';
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(prefix) && value) {
      const tenantId = key.slice(prefix.length).toLowerCase().replace(/_/g, '-');
      map.set(value, tenantId);
    }
  }

  return map;
}

/**
 * Minimal default resolver: maps a bearer token to a tenant via an in-memory
 * token map (seeded from env by default) and validates the tenant exists in
 * the loaded configuration. Returns null when either the token is unknown or
 * the mapped tenant is not configured.
 */
export class ConfigAuthResolver implements AuthResolver {
  private readonly tokenMap: Map<string, string>;
  private readonly configLoader: ConfigLoader;

  constructor(configLoader: ConfigLoader, tokenMap?: Map<string, string>) {
    this.configLoader = configLoader;
    this.tokenMap = tokenMap ?? loadTokenMapFromEnv();
  }

  async resolve(token: string): Promise<ResolvedAuth | null> {
    const tenantId = this.tokenMap.get(token);
    if (!tenantId) {
      return null;
    }

    // Re-validate against config on every call: a tenant removed from config
    // (or a token whose tenant never existed) must not resolve.
    const tenant = this.configLoader.getTenantWithEnvOverrides(tenantId);
    if (!tenant) {
      return null;
    }

    return {
      tenantId: tenant.id,
      scopes: [tenant.scope],
      enabledTools: tenant.enabledTools,
    };
  }
}
