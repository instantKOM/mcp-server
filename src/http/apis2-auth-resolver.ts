/**
 * Production auth resolver for the Remote-MCP HTTP gateway (issue #5191,
 * Agent-Connect EPIC 1).
 *
 * Where ConfigAuthResolver maps a token to a tenant from a static env/config
 * map, Apis2AuthResolver validates the bearer token against the live NestJS
 * API: it calls `GET {apiUrl}/auth/mcp/introspect` with the customer's own
 * token as the Bearer credential and receives back the resolved tenant plus the
 * granted Agent-Connect stages (read / draft / send) derived from the key's
 * apis2.token_scope.
 *
 * The API side reuses the exact same apis2 key validation as every other
 * `/v1/*` request (ApiKeyStrategy): a revoked / inactive / unknown key is
 * rejected there with 401, which this resolver maps to `null` (gateway -> 403).
 * This means read/draft/send are RESOLVED accurately here; per-tool 403 gating
 * on the resolved scopes is enforced downstream (#5192).
 *
 * Per-request validation: `resolve()` is called on EVERY gateway request and
 * this resolver performs a fresh HTTP introspection each time (no cross-request
 * cache), so a key revoked between two calls fails the very next call. If a
 * short-TTL cache is ever added it MUST stay well under the revocation SLA and
 * be documented here.
 */

import type { AuthResolver, ResolvedAuth } from './auth-resolver.js';

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface Apis2AuthResolverOptions {
  /** Base URL of the NestJS API, e.g. https://api.instantkom.app (no trailing slash needed). */
  apiUrl: string;
  /** Introspection path. Default: /auth/mcp/introspect */
  introspectPath?: string;
  /** Request timeout in ms. Default: 5000. */
  timeoutMs?: number;
  /** Injectable fetch (tests). Defaults to global fetch. */
  fetchImpl?: FetchLike;
}

/** Shape of the introspect endpoint response (see McpResolveResponseDto). */
interface IntrospectResponse {
  tenantId?: unknown;
  ownerId?: unknown;
  scopes?: unknown;
  tokenScope?: unknown;
  enabledTools?: unknown;
  tier?: unknown;
  agentSend?: unknown;
  piiExposureAllowed?: unknown;
}

export class Apis2AuthResolver implements AuthResolver {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: Apis2AuthResolverOptions) {
    const base = options.apiUrl.replace(/\/+$/, '');
    const path = options.introspectPath ?? '/auth/mcp/introspect';
    this.url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    this.timeoutMs = options.timeoutMs ?? 5000;
    // Cast: the global fetch signature is a superset of FetchLike.
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  async resolve(token: string): Promise<ResolvedAuth | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchImpl(this.url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (error) {
      // Network error, timeout/abort, DNS, etc. -> deny (fail closed).
      console.error(
        `[Auth] Apis2 introspection failed (network): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    } finally {
      clearTimeout(timer);
    }

    // 401 (revoked/inactive/unknown), 403, 5xx, anything non-2xx -> deny.
    if (!response.ok) {
      return null;
    }

    let body: IntrospectResponse;
    try {
      body = (await response.json()) as IntrospectResponse;
    } catch {
      return null;
    }

    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : null;
    if (!tenantId) {
      // A 200 without a usable tenant is treated as invalid rather than trusted.
      return null;
    }

    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((s): s is string => typeof s === 'string')
      : undefined;

    const enabledTools = Array.isArray(body.enabledTools)
      ? body.enabledTools.filter((t): t is string => typeof t === 'string')
      : undefined;

    // Tier gates playbook visibility (#5196). The introspect endpoint MAY expose
    // the plan tier; when it does not (current default), this stays undefined and
    // the serving layer falls back to the lowest tier (conservative visibility).
    const tier =
      typeof body.tier === 'string' && body.tier.trim() !== '' ? body.tier : undefined;

    // Agent-Connect authorization primitives (issue #5203). Both are strict
    // booleans surfaced by the introspect endpoint from the key's perms2api
    // grants. Anything other than an explicit `true` is treated as NOT granted
    // (default-deny) so an old API without these fields, or a malformed value,
    // can never silently enable send or PII forwarding.
    const agentSend = body.agentSend === true;
    const piiExposureAllowed = body.piiExposureAllowed === true;

    const resolved: ResolvedAuth = { tenantId };
    if (scopes) resolved.scopes = scopes;
    if (enabledTools && enabledTools.length > 0) resolved.enabledTools = enabledTools;
    if (tier) resolved.tier = tier;
    resolved.agentSend = agentSend;
    resolved.piiExposureAllowed = piiExposureAllowed;
    return resolved;
  }
}
