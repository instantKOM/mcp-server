/**
 * Sentry error monitoring for the MCP server.
 *
 * The MCP server runs as a stdio process (no HTTP request lifecycle), so there
 * is no framework-level exception filter -- errors must be captured explicitly.
 *
 * Activation is opt-in via env: SENTRY_ENABLED=true + SENTRY_DSN (with the
 * G_SENTRY_* fallback aliases used elsewhere in the repo). The @sentry/node SDK
 * is loaded via dynamic import ONLY when a DSN is configured -- so a customer
 * running the published public package without a DSN pays zero import/parse/
 * memory cost and never reports to our Sentry. Every function here is a strict
 * no-op until init succeeds.
 */

type SentryModule = typeof import('@sentry/node');

let sentry: SentryModule | null = null;

/**
 * Initialize Sentry if (and only if) configured. Safe to call more than once.
 * Async because the SDK is dynamically imported on demand; entry points should
 * `await` it during startup (well before any tool call).
 */
export async function initSentry(): Promise<void> {
  if (sentry) return;

  const dsn = process.env.SENTRY_DSN ?? process.env.G_SENTRY_DSN;
  const flag = process.env.SENTRY_ENABLED ?? process.env.G_SENTRY_ENABLED;
  if (flag !== 'true' || !dsn) return;

  const mod = await import('@sentry/node');
  mod.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    // stdio CLI: keep it lean -- no profiling/tracing, just error capture.
    tracesSampleRate: 0,
    // The HTTP mode attaches the incoming request to events.
    beforeSend: reduceSentryRequest,
    beforeSendTransaction: reduceSentryRequest,
    // Outgoing API calls record their query on breadcrumbs and spans.
    beforeBreadcrumb: stripSentryUrlQueries,
    beforeSendSpan: stripSentryUrlQueries,
  });
  sentry = mod;
}

// Request headers that carry no credentials or message content.
const REQUEST_HEADER_ALLOWLIST = new Set([
  'host',
  'user-agent',
  'accept',
  'content-type',
  'content-length',
]);

/**
 * Reduces the Sentry request interface to an allowlist (#7667).
 *
 * @sentry/node attaches the incoming body (httpIntegration maxRequestBodySize
 * defaults to "medium": JSON-RPC tool arguments), the query string, cookies
 * and every header (the MCP OAuth bearer token). The request is rebuilt
 * instead: URL without query and fragment, method, body and query as a field
 * count only (the rule of the PHP LogScrubber::requestMetadata()), headers
 * outside the allowlist masked, cookies dropped.
 */
export function reduceSentryRequest<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const request = (payload as { request?: unknown }).request;
  if (!request || typeof request !== 'object') return payload;

  const source = request as Record<string, unknown>;
  const reduced: Record<string, unknown> = {};
  if (typeof source.url === 'string') reduced.url = stripUrlQuery(source.url);
  if (typeof source.method === 'string') reduced.method = source.method;
  if (isPresent(source.query_string)) {
    reduced.query_string = countFields(source.query_string);
  }
  if (isPresent(source.data)) reduced.data = countFields(source.data);
  if (source.headers && typeof source.headers === 'object') {
    reduced.headers = Object.fromEntries(
      Object.entries(source.headers).map(([name, value]) => [
        name,
        REQUEST_HEADER_ALLOWLIST.has(name.toLowerCase()) ? value : '[REDACTED]',
      ]),
    );
  }

  return { ...(payload as object), request: reduced } as T;
}

// Breadcrumb and span data fields the SDK fills with the raw query or
// fragment (@sentry/core integrations/http/add-outgoing-request-breadcrumb.js,
// fetch.js, utils/url.js).
const QUERY_DATA_KEYS = new Set(['http.query', 'http.fragment', 'url.query', 'url.fragment']);

// Data fields that carry a whole URL or request target, query included.
const URL_DATA_KEYS = new Set([
  'url',
  'http.url',
  'url.full',
  'http.target',
  'from',
  'to',
  'lcp.url',
  'browser.web_vital.lcp.url',
]);

// Span ops whose description is a URL; resource spans keep the query.
const URL_DESCRIPTION_OPS = /^(?:http|resource)\./;

/**
 * Removes query and fragment from breadcrumbs and spans (#7703).
 *
 * The SDK cuts the query off the breadcrumb URL and the span name only to
 * record it next to them as http.query / url.query, and keeps it inside
 * http.url and http.target. A parameter denylist misses every name nobody
 * listed, so the query leaves entirely.
 */
export function stripSentryUrlQueries<T>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  const source = item as { data?: unknown; op?: unknown; description?: unknown };
  const stripped: Record<string, unknown> = { ...(item as object) };

  if (source.data && typeof source.data === 'object') {
    stripped.data = Object.fromEntries(
      Object.entries(source.data)
        .filter(([key]) => !QUERY_DATA_KEYS.has(key))
        .map(([key, value]) => [key, URL_DATA_KEYS.has(key) ? stripQuery(value) : value]),
    );
  }
  if (typeof source.op === 'string' && URL_DESCRIPTION_OPS.test(source.op)) {
    stripped.description = stripQuery(source.description);
  }

  return stripped as T;
}

function stripQuery(value: unknown): unknown {
  return typeof value === 'string' && /[?#]/.test(value) ? stripUrlQuery(value) : value;
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function stripUrlQuery(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split(/[?#]/, 1)[0];
  }
}

function countFields(value: unknown): { field_count: number } {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return { field_count: Object.keys(parsed).length };
      }
    } catch {
      // Not JSON: count it as form or query fields below.
    }
    return { field_count: [...new URLSearchParams(value).keys()].length };
  }
  if (value && typeof value === 'object') {
    return { field_count: Object.keys(value).length };
  }
  return { field_count: 1 };
}

/** Capture an exception with MCP context. No-op when Sentry is not enabled. */
export function captureMcpException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentry) return;
  sentry.captureException(error, {
    tags: { service: 'mcp-server' },
    ...(context ? { extra: context } : {}),
  });
}

/**
 * Flush buffered events before the process exits. A stdio process terminates
 * immediately on process.exit(), so without flushing the final fatal event is
 * lost. No-op (resolves immediately) when Sentry is not enabled.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!sentry) return;
  try {
    await sentry.flush(timeoutMs);
  } catch {
    // best-effort; never block shutdown on a flush failure
  }
}
