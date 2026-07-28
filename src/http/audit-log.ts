/**
 * Agent-Connect audit sink for the Remote-MCP gateway (issue #5204, AK4).
 *
 * Every MUTATING agent action -- a send/draft-classified tool call and every
 * composite-playbook step/run -- is recorded in a key-attributed audit log so
 * "which key did what, when, with what outcome" is answerable (AK4). The gateway
 * is a DB-less HTTP process, so it POSTs the action metadata to the NestJS API
 * (`POST /auth/mcp/audit`) using the SAME bearer token the request carried; the
 * API stamps the owner uid + api key id from that token itself, making
 * attribution spoof-proof. Read-only tool calls are NOT audited.
 *
 * AUDIT-FAILURE STANCE:
 *   An audit write MUST NOT block or fail the customer action -- losing the
 *   mutation because telemetry was down would be worse than a missing audit row.
 *   Ordinary audit writes therefore remain best-effort. Proof-correlated calls
 *   are the exception: their caller awaits the write and fails closed when it
 *   cannot be persisted. Every failed write is logged loudly (console.error + Sentry), so an
 *   unaudited mutation is visible as an operational alert, not silent. This is
 *   the deliberate compliance trade-off: keep the action, surface the gap.
 */

import { captureMcpException } from '../monitoring/sentry.js';
import { createHash, createHmac } from 'node:crypto';

/** The dimensions recorded per mutating agent action. Mirrors CreateAgentAuditDto. */
export interface AgentAuditEvent {
  action: 'tool' | 'composite_step' | 'composite_run';
  /** Tool name or composite playbook id. */
  toolName: string;
  /** Mutating scope of the action. Read is never audited. */
  scope: 'draft' | 'send';
  outcome: 'success' | 'error' | 'budget_exceeded' | 'scope_denied';
  /** Short error code/class when outcome is not success. */
  errorCode?: string;
  /** Minimal origin/correlation plus argument key names, never PII values. */
  detail?: string;
  /** Proof-only UUID bound to an explicit gateway header + tool argument. */
  proofCorrelationId?: string;
}

/** Injectable audit sink seam. Proof-correlated writes may reject. */
export interface AuditSink {
  record(event: AgentAuditEvent): Promise<void>;
}

/** No-op sink (default / stdio / tests without an API). */
export class NoopAuditSink implements AuditSink {
  async record(): Promise<void> {
    // intentionally empty
  }
}

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{ ok: boolean; status: number }>;

export interface Apis2AuditSinkOptions {
  /** Base URL of the NestJS API (no trailing slash needed). */
  apiUrl: string;
  /** The bearer token of THIS request -- the API attributes the row to its key. */
  token: string;
  /** Audit write path. Default: /auth/mcp/audit */
  auditPath?: string;
  /** Request timeout in ms. Default: 5000. */
  timeoutMs?: number;
  /** Injectable fetch (tests). Defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Server-resolved SHA-256 OAuth credential identifier. */
  oauthCredentialId?: string;
  /** Shared gateway/API secret used only to attest proof correlations. */
  proofSecret?: string;
}

/**
 * Production sink: POSTs the audit event to the NestJS API with the request's
 * own bearer token. Ordinary failures are logged and swallowed; proof failures
 * reject so the gateway can return a fail-closed proof result.
 */
export class Apis2AuditSink implements AuditSink {
  private readonly url: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly oauthCredentialId?: string;
  private readonly proofSecret?: string;

  constructor(options: Apis2AuditSinkOptions) {
    const base = options.apiUrl.replace(/\/+$/, '');
    const path = options.auditPath ?? '/auth/mcp/audit';
    this.url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.oauthCredentialId = options.oauthCredentialId;
    this.proofSecret = options.proofSecret; // pragma: allowlist secret -- runtime option, not secret material
  }

  async record(event: AgentAuditEvent): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (event.proofCorrelationId) {
        if (!this.oauthCredentialId || !this.proofSecret || this.proofSecret.length < 32) {
          const error = new Error(
            'proof correlation requested without an OAuth identity or proof secret'
          );
          this.warnFailure(event, error.message);
          throw error;
        }
        const timestamp = String(Math.floor(Date.now() / 1000));
        headers['X-InstantKOM-MCP-Proof-Timestamp'] = timestamp;
        headers['X-InstantKOM-MCP-Proof-Signature'] = createMcpProofSignature({
          secret: this.proofSecret, // pragma: allowlist secret -- runtime option, not secret material
          timestamp,
          credentialId: this.oauthCredentialId,
          event,
        });
      }
      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await this.fetchImpl(this.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(event),
          signal: controller.signal,
        });
      } catch (error) {
        this.warnFailure(event, error instanceof Error ? error.message : String(error));
        if (event.proofCorrelationId) throw error;
        return;
      }
      if (!response.ok) {
        // An unaudited mutation is a compliance gap -> surface it loudly.
        const error = new Error(`HTTP ${response.status}`);
        this.warnFailure(event, error.message);
        if (event.proofCorrelationId) throw error;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private warnFailure(event: AgentAuditEvent, reason: string): void {
    const message =
      `[Audit] FAILED to record agent action (unaudited mutation!): ` +
      `${event.action}/${event.toolName} outcome=${event.outcome} -- ${reason}`;
    console.error(message);
    captureMcpException(new Error(message), {
      auditAction: event.action,
      auditTool: event.toolName,
      auditOutcome: event.outcome,
    });
  }
}

interface McpProofSignatureInput {
  secret: string;
  timestamp: string;
  credentialId: string;
  event: Pick<
    AgentAuditEvent,
    | 'action'
    | 'toolName'
    | 'scope'
    | 'outcome'
    | 'proofCorrelationId'
    | 'detail'
  > & { argsSha256?: string };
}

/** Stable HMAC contract shared with the API verifier (no raw input or PII). */
export function createMcpProofSignature(input: McpProofSignatureInput): string {
  const correlationId = input.event.proofCorrelationId ?? '';
  const argsSha256 =
    input.event.argsSha256 ??
    (input.event.detail
      ? createMcpProofArgsDigest(input.event.detail)
      : '');
  const payload = JSON.stringify([
    'instantkom-mcp-proof-v1',
    input.timestamp,
    input.credentialId,
    correlationId,
    input.event.action,
    input.event.toolName,
    input.event.scope,
    input.event.outcome,
    argsSha256,
  ]);
  return `v1=${createHmac('sha256', input.secret).update(payload, 'utf8').digest('base64url')}`;
}

export function createMcpProofArgsDigest(detail: string): string {
  return createHash('sha256').update(detail, 'utf8').digest('hex');
}

/**
 * Minimal, PII-safe input summary: the SORTED argument key names only (never the
 * values), comma-joined and truncated. Enough to know "which fields were passed"
 * for a compliance trail without ever leaking recipient PII or message bodies.
 */
export function summarizeArgs(args: Record<string, unknown> | undefined): string {
  if (!args || typeof args !== 'object') {
    return '';
  }
  const keys = Object.keys(args).sort();
  const joined = keys.join(',');
  return joined.length > 512 ? joined.slice(0, 512) : joined;
}

/** Best-effort emit: fire-and-forget, swallow any sink error at the boundary. */
export function emitAudit(sink: AuditSink, event: AgentAuditEvent): Promise<void> {
  return Promise.resolve()
    .then(() => sink.record(event))
    .catch((error) => {
      console.error(
        `[Audit] sink.record threw (should never happen): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });
}

export class ProofAuditPersistenceError extends Error {
  constructor(cause: unknown) {
    super('Proof audit persistence failed', { cause });
    this.name = 'ProofAuditPersistenceError';
  }
}

/** Awaited proof boundary: unlike ordinary audit emission, errors propagate. */
export async function emitProofAudit(
  sink: AuditSink,
  event: AgentAuditEvent
): Promise<void> {
  try {
    await sink.record(event);
  } catch (error) {
    throw new ProofAuditPersistenceError(error);
  }
}
