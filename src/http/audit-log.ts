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
 * AUDIT-FAILURE STANCE (best-effort, non-blocking):
 *   An audit write MUST NOT block or fail the customer action -- losing the
 *   mutation because telemetry was down would be worse than a missing audit row.
 *   So `record()` is fire-and-forget from the caller's view and this sink NEVER
 *   throws: a failed write is logged loudly (console.error + Sentry) so an
 *   unaudited mutation is visible as an operational alert, not silent. This is
 *   the deliberate compliance trade-off: keep the action, surface the gap.
 */

import { captureMcpException } from '../monitoring/sentry.js';

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
  /** Minimal input summary: argument key names only, never PII values. */
  detail?: string;
}

/** Injectable audit sink seam. Implementations MUST NOT throw. */
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
}

/**
 * Production sink: POSTs the audit event to the NestJS API with the request's
 * own bearer token. Best-effort -- any failure is logged (never thrown).
 */
export class Apis2AuditSink implements AuditSink {
  private readonly url: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: Apis2AuditSinkOptions) {
    const base = options.apiUrl.replace(/\/+$/, '');
    const path = options.auditPath ?? '/auth/mcp/audit';
    this.url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  async record(event: AgentAuditEvent): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
      if (!response.ok) {
        // An unaudited mutation is a compliance gap -> surface it loudly.
        this.warnFailure(event, `HTTP ${response.status}`);
      }
    } catch (error) {
      this.warnFailure(event, error instanceof Error ? error.message : String(error));
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
export function emitAudit(sink: AuditSink, event: AgentAuditEvent): void {
  void Promise.resolve()
    .then(() => sink.record(event))
    .catch((error) => {
      console.error(
        `[Audit] sink.record threw (should never happen): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });
}
