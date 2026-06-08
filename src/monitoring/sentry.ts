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
  });
  sentry = mod;
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
