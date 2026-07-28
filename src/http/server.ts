/**
 * Remote-MCP HTTP/SSE transport gateway.
 *
 * Puts an HTTP front door on the existing MCP server so a customer connects
 * with just a URL + Bearer token -- no repo clone, no node install. This module
 * owns ONLY the transport + the bearer-extraction seam (issue #5190). Key ->
 * tenant/scope resolution lives behind the injectable `AuthResolver`
 * (issue #5191 swaps in the real apis2 resolver).
 *
 * Transports:
 *   - StreamableHTTP (modern, preferred) at `${basePath}` -- stateless: every
 *     request builds a fresh tenant-bound MCP server, so the token is
 *     re-validated on every call and there is zero cross-tenant leakage.
 *   - Legacy SSE at `${basePath}/sse` (stream) + `${basePath}/messages` (POST).
 *
 * Non-goals here (left as clean seams, intentionally NOT implemented):
 *   idempotency, rate-limiting, fine-grained scope gating. See #5191+.
 */

import {
  createServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ApiClient } from '@instantkom/api-client';
import { ConfigLoader } from '../config/config.js';
import type { AuthResolver, ResolvedAuth } from './auth-resolver.js';
import { ConfigAuthResolver } from './auth-resolver.js';
import { Apis2AuthResolver } from './apis2-auth-resolver.js';
import { createTenantMcpServer } from './mcp-server-factory.js';
import { type AuditSink, NoopAuditSink, Apis2AuditSink } from './audit-log.js';
import {
  RateLimiter,
  RedisRateLimitStore,
  loadRateLimitConfig,
  buildCredentialRateLimitIdentity,
  buildRateLimitIdentity,
} from './rate-limiter.js';
import { getRateLimitRedis } from './redis-client.js';
import { alertRedisOutage } from '../monitoring/redis-outage-alert.js';
import type { TenantConfig } from '../types/index.js';
import {
  MCP_ENDPOINT_PATH,
  MCP_SERVER_CARD,
  MCP_SERVER_CARD_PATH,
} from '../discovery/server-card.js';
import {
  AGENT_SKILLS_INDEX_PATH,
  getAgentSkillAsset,
} from '../discovery/agent-skills.js';

export interface HttpGatewayOptions {
  host?: string;
  port?: number;
  /** Base path for the StreamableHTTP endpoint. Default: /mcp */
  basePath?: string;
  /** Injected auth resolver. Defaults to the env/config-backed resolver. */
  authResolver?: AuthResolver;
  configLoader?: ConfigLoader;
  /**
   * Injected per-key rate limiter. Defaults to a Redis-backed limiter built
   * from env (REDIS_* + MCP_RATE_LIMIT_*). Pass `null` to disable, or a custom
   * instance (tests). When Redis is not configured, limiting is skipped.
   */
  rateLimiter?: RateLimiter | null;
  /** Owner-gated RFC 9728 metadata/challenge configuration. */
  protectedResource?: {
    enabled: boolean;
    resource: string;
    authorizationServer: string;
    metadataUrl: string;
  };
}

interface SseSession {
  transport: SSEServerTransport;
  close: () => Promise<void>;
  /**
   * Fingerprint of the auth context (scopes + tier + PII grant) the session's
   * `Server` was BUILT with at connect time. The per-session `Server` bakes the
   * scope/tier gating in at connect, so a mid-session scope DOWNGRADE (key stays
   * valid, `send` -> `read`) would otherwise keep acting on the stale, broader
   * scopes until reconnect. Re-checked on every POST leg; a mismatch forces the
   * session closed so the change takes effect on the very next call (#5202).
   */
  authFingerprint: string;
  /** Non-reversible binding to the exact tenant + bearer used at connect. */
  credentialFingerprint: string;
}

/**
 * Stable, order-independent fingerprint of the scope/tier/PII context a session
 * server was built with. Any change (esp. a scope downgrade or PII-grant
 * revocation) yields a different fingerprint -> the SSE POST leg detects the
 * staleness and forces a reconnect.
 */
export function authFingerprint(auth: ResolvedAuth): string {
  const scopes = [...(auth.scopes ?? [])].sort();
  const enabledTools = [...(auth.enabledTools ?? [])].sort();
  return JSON.stringify({
    tenantId: auth.tenantId,
    scopes,
    enabledTools,
    tier: auth.tier ?? null,
    pii: auth.piiExposureAllowed === true,
    agentSend: auth.agentSend === true,
    oauthClientId: auth.oauthClientId ?? null,
    oauthFamilyId: auth.oauthFamilyId ?? null,
  });
}

export function sessionCredentialFingerprint(
  auth: ResolvedAuth,
  token: string
): string {
  return buildRateLimitIdentity(auth.tenantId, token);
}

export class HttpGateway {
  private readonly host: string;
  private readonly port: number;
  private readonly basePath: string;
  private readonly ssePath: string;
  private readonly messagesPath: string;
  private readonly authResolver: AuthResolver;
  private readonly configLoader: ConfigLoader;
  /** Per-key rate limiter, or null when disabled / no Redis configured. */
  private readonly rateLimiter: RateLimiter | null;
  private readonly protectedResource: HttpGatewayOptions['protectedResource'];

  /** Active legacy-SSE sessions, keyed by transport sessionId. */
  private readonly sseSessions = new Map<string, SseSession>();

  private httpServer: HttpServer | null = null;

  constructor(options: HttpGatewayOptions = {}) {
    this.host = options.host ?? process.env.MCP_HTTP_HOST ?? '0.0.0.0';
    this.port = options.port ?? Number(process.env.MCP_HTTP_PORT ?? 3005);
    this.basePath = normalizePath(
      options.basePath ?? process.env.MCP_HTTP_BASE_PATH ?? MCP_ENDPOINT_PATH
    );
    this.ssePath = `${this.basePath}/sse`;
    this.messagesPath = `${this.basePath}/messages`;
    this.configLoader = options.configLoader ?? ConfigLoader.getInstance();
    this.authResolver = options.authResolver ?? this.buildDefaultResolver();
    this.rateLimiter =
      options.rateLimiter === undefined
        ? this.buildDefaultRateLimiter()
        : options.rateLimiter;
    this.protectedResource = options.protectedResource ?? {
      enabled: process.env.OAUTH_PROTECTED_RESOURCES_ENABLED === 'true',
      resource: process.env.OAUTH_MCP_RESOURCE ?? '',
      authorizationServer: process.env.OAUTH_AUTHORIZATION_SERVER ?? '',
      metadataUrl: process.env.OAUTH_MCP_RESOURCE_METADATA_URL ?? '',
    };
  }

  private oauthChallenge(
    scope = 'read',
    error?: 'invalid_token' | 'insufficient_scope'
  ): Record<string, string> | undefined {
    const resource = this.protectedResource;
    if (!resource?.enabled || !resource.metadataUrl) return undefined;
    const errorParameter = error ? `, error="${error}"` : '';
    return {
      'WWW-Authenticate': `Bearer resource_metadata="${resource.metadataUrl}", scope="${scope}"${errorParameter}`,
    };
  }

  /**
   * Build the default per-key rate limiter from the environment. Returns null
   * (limiting off) when either the feature is disabled (MCP_RATE_LIMIT_MAX <= 0)
   * or no Redis is configured (REDIS_URL / REDIS_HOST absent) -- the gateway
   * must still serve requests without a Redis, so a missing store means skip.
   */
  private buildDefaultRateLimiter(): RateLimiter | null {
    const config = loadRateLimitConfig();
    if (!config.enabled) return null;

    const redis = getRateLimitRedis();
    if (!redis) {
      console.error(
        '[RateLimit] Enabled but no Redis configured (REDIS_URL/REDIS_HOST) -- limiting is OFF.'
      );
      return null;
    }

    return new RateLimiter({
      store: new RedisRateLimitStore(redis),
      config,
      // Fail-open per request logs loudly AND alerts Sentry (throttled) so a
      // sustained Redis outage -- during which the rate cap is silently off --
      // is production-visible instead of buried in stdout (#5412).
      warn: (message) => {
        console.error(message);
        alertRedisOutage(message);
      },
    });
  }

  /**
   * Pick the default auth resolver.
   *
   * Production default is the live apis2 resolver (per-customer API-key auth,
   * issue #5191): it validates every bearer token against the NestJS API. The
   * static env/config ConfigAuthResolver is kept for local/dev/test and is
   * selected when `MCP_AUTH_MODE=config` or when no API URL is configured.
   */
  private buildDefaultResolver(): AuthResolver {
    const mode = process.env.MCP_AUTH_MODE;
    const apiUrl =
      process.env.MCP_RESOLVER_API_URL ?? process.env.INSTANTKOM_API_URL;

    if (mode === 'config' || (mode !== 'apis2' && !apiUrl)) {
      return new ConfigAuthResolver(this.configLoader);
    }

    return new Apis2AuthResolver({
      apiUrl: apiUrl ?? 'https://api.instantkom.app',
    });
  }

  /**
   * Build the per-request audit sink (#5204). Bound to THIS request's bearer
   * token so the API attributes the audit row to its resolved key. Falls back to
   * a no-op when no API URL is configured (local/stdio-style config mode), so the
   * gateway still serves requests without an audit backend.
   */
  private buildAuditSink(token: string, auth: ResolvedAuth): AuditSink {
    const apiUrl =
      process.env.MCP_RESOLVER_API_URL ?? process.env.INSTANTKOM_API_URL;
    if (!apiUrl) {
      return new NoopAuditSink();
    }
    return new Apis2AuditSink({
      apiUrl,
      token,
      oauthCredentialId: auth.oauthCredentialId,
      proofSecret: process.env.MCP_AUDIT_PROOF_SECRET, // pragma: allowlist secret -- environment access, not secret material
    });
  }

  private proofCorrelationId(
    req: IncomingMessage,
    res: ServerResponse,
    auth: ResolvedAuth
  ): string | undefined | null {
    const raw = req.headers['x-instantkom-proof-correlation-id'];
    if (raw === undefined) return undefined;
    const value = Array.isArray(raw) ? undefined : raw;
    if (
      !value ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
    ) {
      writeJson(res, 400, {
        error: 'invalid_proof_correlation',
        message: 'Proof correlation must be one UUID v4 header value.',
      });
      return null;
    }
    if (
      !auth.oauthCredentialId ||
      (process.env.MCP_AUDIT_PROOF_SECRET?.length ?? 0) < 32
    ) {
      writeJson(res, 403, {
        error: 'proof_correlation_unavailable',
        message:
          'Proof correlation requires OAuth authentication and configured gateway attestation.',
      });
      return null;
    }
    return value;
  }

  /**
   * Per-composite-run tool-call budget from the environment (#5204 runaway
   * protection). `MCP_MAX_TOOL_CALLS_PER_RUN` overrides the runner default;
   * undefined leaves the runner's built-in default in place.
   */
  private maxToolCallsPerRun(): number | undefined {
    const raw = Number(process.env.MCP_MAX_TOOL_CALLS_PER_RUN);
    return Number.isFinite(raw) && raw > 0 ? raw : undefined;
  }

  /**
   * Extract + validate the bearer token for a request. Returns the resolved
   * auth on success, or null after having already written the 401/403 response.
   * Validation runs on EVERY request (never cached), so a revoked token fails
   * its next call.
   */
  private async authenticate(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<ResolvedAuth | null> {
    const header = req.headers['authorization'];
    const token = extractBearerToken(header);

    if (!token) {
      writeJson(
        res,
        401,
        {
          error: 'unauthorized',
          message: 'Missing or malformed Authorization: Bearer <token> header.',
        },
        this.oauthChallenge()
      );
      return null;
    }

    const resolved = await this.authResolver.resolve(token);
    if (!resolved) {
      const oauthEnabled = this.protectedResource?.enabled === true;
      writeJson(
        res,
        oauthEnabled ? 401 : 403,
        {
          error: oauthEnabled ? 'invalid_token' : 'forbidden',
          message: 'The provided token is not valid for any tenant.',
        },
        oauthEnabled ? this.oauthChallenge('read', 'invalid_token') : undefined
      );
      return null;
    }

    // Per-key rate limit (AK5, #5194): enforced AFTER a valid key is resolved
    // and BEFORE any tool dispatch, so an over-limit key is stopped early. Keyed
    // by tenant + stable credential (OAuth token family, else hashed API key)
    // so the cap is truly per credential and survives token rotation. Fails open on a
    // Redis outage (see RateLimiter) -- availability over perfect enforcement.
    if (this.rateLimiter) {
      const identity = buildCredentialRateLimitIdentity(
        resolved.tenantId,
        token,
        resolved.oauthFamilyId
      );
      const decision = await this.rateLimiter.check(identity);
      if (!decision.allowed) {
        writeJson(
          res,
          429,
          {
            error: 'rate_limited',
            message: `Rate limit exceeded: max ${decision.limit} requests per window. Retry after ${decision.retryAfterSeconds}s.`,
          },
          {
            'Retry-After': String(decision.retryAfterSeconds),
            'X-RateLimit-Limit': String(decision.limit),
            'X-RateLimit-Remaining': String(decision.remaining),
          }
        );
        return null;
      }
    }

    return resolved;
  }

  /**
   * Base URL of the API the gateway authenticates against. Shared with the
   * introspection/audit seams so a synthesized apis2 tenant talks to the SAME
   * API that validated its key.
   */
  private resolverApiUrl(): string {
    return (
      process.env.MCP_RESOLVER_API_URL ??
      process.env.INSTANTKOM_API_URL ??
      'https://api.instantkom.app'
    );
  }

  private resolveTenant(
    auth: ResolvedAuth,
    res: ServerResponse,
    token: string
  ): TenantConfig | null {
    // apis2 (real per-account) mode: the resolver returns tenantId = ownerId,
    // which is NOT a pre-registered named tenant. Synthesize a TenantConfig from
    // the resolved auth so real Agent-Connect keys work end-to-end (#5314). The
    // static/named ConfigAuthResolver path below is left untouched.
    if (this.authResolver instanceof Apis2AuthResolver) {
      return synthesizeApis2Tenant(auth, token, this.resolverApiUrl());
    }

    const tenant = this.configLoader.getTenantWithEnvOverrides(auth.tenantId);
    if (!tenant) {
      writeJson(res, 403, {
        error: 'forbidden',
        message: `Resolved tenant '${auth.tenantId}' is not configured.`,
      });
      return null;
    }
    // Apply an optional per-token tool allowlist on top of the tenant's own.
    if (auth.enabledTools && auth.enabledTools.length > 0) {
      return { ...tenant, enabledTools: auth.enabledTools };
    }
    return tenant;
  }

  private async handleStreamable(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const auth = await this.authenticate(req, res);
    if (!auth) return;

    const token = extractBearerToken(req.headers['authorization']) ?? '';
    const proofCorrelationId = this.proofCorrelationId(req, res, auth);
    if (proofCorrelationId === null) return;
    const tenant = this.resolveTenant(auth, res, token);
    if (!tenant) return;

    // Credentials can rotate on every OAuth delegation window. Keep no raw
    // bearer or ephemeral ApiClient in a process-global cache.
    const apiClient = new ApiClient(tenant);
    const server = createTenantMcpServer(tenant, apiClient, {
      scopes: auth.scopes,
      tier: auth.tier,
      piiExposureAllowed: auth.piiExposureAllowed,
      agentSend: auth.agentSend,
      auditSink: this.buildAuditSink(token, auth),
      proofCorrelationId,
      maxToolCallsPerRun: this.maxToolCallsPerRun(),
    });

    // Stateless: no session id generator -> a fresh server per request.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      writeJson(res, 400, {
        error: 'bad_request',
        message: 'Request body is not valid JSON.',
      });
      return;
    }

    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  private async handleSseConnect(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const auth = await this.authenticate(req, res);
    if (!auth) return;

    const token = extractBearerToken(req.headers['authorization']) ?? '';
    const proofCorrelationId = this.proofCorrelationId(req, res, auth);
    if (proofCorrelationId === null) return;
    const tenant = this.resolveTenant(auth, res, token);
    if (!tenant) return;

    const apiClient = new ApiClient(tenant);
    const server = createTenantMcpServer(tenant, apiClient, {
      scopes: auth.scopes,
      tier: auth.tier,
      piiExposureAllowed: auth.piiExposureAllowed,
      agentSend: auth.agentSend,
      auditSink: this.buildAuditSink(token, auth),
      proofCorrelationId,
      maxToolCallsPerRun: this.maxToolCallsPerRun(),
    });

    const transport = new SSEServerTransport(this.messagesPath, res);
    const sessionId = transport.sessionId;

    const close = async () => {
      this.sseSessions.delete(sessionId);
      await transport.close();
      await server.close();
    };
    this.sseSessions.set(sessionId, {
      transport,
      close,
      authFingerprint: authFingerprint(auth),
      credentialFingerprint: sessionCredentialFingerprint(auth, token),
    });

    res.on('close', () => {
      void close();
    });

    await server.connect(transport);
  }

  private async handleSseMessage(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL
  ): Promise<void> {
    // Re-authenticate the POST leg too -- a token revoked mid-session must fail.
    const auth = await this.authenticate(req, res);
    if (!auth) return;

    const sessionId = url.searchParams.get('sessionId');
    const session = sessionId ? this.sseSessions.get(sessionId) : undefined;
    if (!session) {
      writeJson(res, 404, {
        error: 'not_found',
        message: 'Unknown or expired SSE session.',
      });
      return;
    }

    const token = extractBearerToken(req.headers['authorization']) ?? '';
    if (
      sessionCredentialFingerprint(auth, token) !==
      session.credentialFingerprint
    ) {
      writeJson(res, 403, {
        error: 'session_credential_mismatch',
        message: 'This SSE session belongs to a different bearer credential.',
      });
      return;
    }

    // #5202: the session's Server baked in the scope/tier/PII context at connect.
    // If it has changed since (e.g. a scope downgrade send -> read, or a revoked
    // PII grant -- the key still authenticates, so the check above passes), the
    // baked-in gating is now stale. Close the session and refuse this call so the
    // downgrade takes effect on the very next call; the client must reconnect to
    // get a Server rebuilt with the reduced scopes.
    if (authFingerprint(auth) !== session.authFingerprint) {
      await session.close().catch(() => undefined);
      writeJson(res, 409, {
        error: 'auth_changed',
        message:
          'The API key scopes changed since this SSE session was established. ' +
          'The session has been closed; reconnect to continue with the updated scopes.',
      });
      return;
    }

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      writeJson(res, 400, {
        error: 'bad_request',
        message: 'Request body is not valid JSON.',
      });
      return;
    }

    await session.transport.handlePostMessage(req, res, body);
  }

  private async route(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`
    );
    const path = url.pathname;
    const method = req.method ?? 'GET';

    if (path === '/health' && method === 'GET') {
      writeJson(res, 200, { status: 'ok' });
      return;
    }

    if (path === MCP_SERVER_CARD_PATH && method === 'GET') {
      writeJson(res, 200, MCP_SERVER_CARD, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600',
      });
      return;
    }

    if (path === '/.well-known/oauth-protected-resource' && method === 'GET') {
      const metadata = this.protectedResource;
      if (
        !metadata?.enabled ||
        !metadata.resource ||
        !metadata.authorizationServer
      ) {
        writeJson(res, 404, { error: 'not_found' });
        return;
      }
      writeJson(
        res,
        200,
        {
          resource: metadata.resource,
          authorization_servers: [metadata.authorizationServer],
          bearer_methods_supported: ['header'],
          scopes_supported: ['read', 'draft', 'send'],
        },
        { 'Cache-Control': 'no-store' }
      );
      return;
    }

    if (
      (path === AGENT_SKILLS_INDEX_PATH ||
        path.startsWith('/.well-known/agent-skills/')) &&
      (method === 'GET' || method === 'HEAD')
    ) {
      const asset = getAgentSkillAsset(path);
      if (!asset) {
        writeJson(res, 404, {
          error: 'not_found',
          message: `No route for ${method} ${path}.`,
        });
        return;
      }
      const headers = {
        'Content-Type': asset.contentType,
        'Content-Length': String(Buffer.byteLength(asset.content)),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      };
      res.writeHead(200, headers);
      res.end(method === 'HEAD' ? undefined : asset.content);
      return;
    }

    if (path === this.ssePath && method === 'GET') {
      await this.handleSseConnect(req, res);
      return;
    }

    if (path === this.messagesPath && method === 'POST') {
      await this.handleSseMessage(req, res, url);
      return;
    }

    if (path === this.basePath) {
      await this.handleStreamable(req, res);
      return;
    }

    writeJson(res, 404, {
      error: 'not_found',
      message: `No route for ${method} ${path}.`,
    });
  }

  async start(): Promise<void> {
    this.httpServer = createServer((req, res) => {
      this.route(req, res).catch((error) => {
        console.error('[HTTP] Unhandled request error:', error);
        if (!res.headersSent) {
          writeJson(res, 500, { error: 'internal_error' });
        } else {
          res.end();
        }
      });
    });

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(this.port, this.host, () => resolve());
    });

    const addr = this.httpServer.address();
    const boundPort = typeof addr === 'object' && addr ? addr.port : this.port;
    console.error(
      `[HTTP] Remote-MCP gateway listening on http://${this.host}:${boundPort} (base ${this.basePath})`
    );
  }

  /** Actual bound port (useful when started on an ephemeral port 0). */
  get address(): { host: string; port: number } | null {
    const addr = this.httpServer?.address();
    if (addr && typeof addr === 'object') {
      return { host: this.host, port: addr.port };
    }
    return null;
  }

  async stop(): Promise<void> {
    // Tear down any live SSE sessions first.
    for (const session of this.sseSessions.values()) {
      await session.close().catch(() => undefined);
    }
    this.sseSessions.clear();

    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      this.httpServer = null;
    }
  }
}

/**
 * Synthesize a TenantConfig from an apis2-resolved auth (#5314).
 *
 * In real per-account mode the auth resolver returns `tenantId = ownerId`
 * (numeric) plus the granted scopes/tools -- there is NO pre-registered named
 * tenant to look up. This builds a minimal, well-formed tenant on the fly:
 *   - `id` = ownerId, so the ApiClient cache + audit attribute to the owner.
 *   - `apiKey` = the caller's own scoped bearer token. The ApiClient uses it as
 *     `Authorization: Bearer <key>` against the Public API (`/v1/*`), which the
 *     NestJS ApiKeyStrategy validates to exactly this owner -- so the client
 *     acts AS ownerId with no separate service credentials.
 *   - `scope` = 'app' (Agent-Connect is the customer Public API, never admin/JWT).
 *   - `apiUrl` = the gateway's configured API base (same API that validated it).
 *   - `enabledTools` = the resolved per-key allowlist, when present.
 */
export function synthesizeApis2Tenant(
  auth: ResolvedAuth,
  token: string,
  apiUrl: string
): TenantConfig {
  const tenant: TenantConfig = {
    id: auth.tenantId,
    name: `apis2-owner-${auth.tenantId}`,
    apiUrl,
    apiKey: auth.delegationToken ?? token, // pragma: allowlist secret -- runtime credential reference, not literal material
    scope: 'app',
  };
  if (auth.enabledTools && auth.enabledTools.length > 0) {
    tenant.enabledTools = auth.enabledTools;
  }
  return tenant;
}

/** Normalize a base path: leading slash, no trailing slash. */
function normalizePath(path: string): string {
  let p = path.startsWith('/') ? path : `/${path}`;
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
}

/**
 * Extract the token from an `Authorization: Bearer <token>` header. Returns
 * null when the header is absent or malformed (wrong scheme, empty token).
 */
export function extractBearerToken(
  header: string | string[] | undefined
): string | null {
  if (!header) return null;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;

  const match = /^Bearer[ ]+(.+)$/i.exec(value.trim());
  if (!match) return null;

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;

  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (raw.length === 0) return undefined;

  return JSON.parse(raw);
}

function writeJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>
): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}
