/**
 * Throttled Sentry alerting for a rate-limiter Redis outage (issue #5412).
 *
 * The gateway rate limiter fails OPEN on a Redis outage (availability over
 * perfect enforcement -- see rate-limiter.ts) and only `console.error`s. A
 * SUSTAINED outage therefore silently disables abuse protection with no
 * production-visible signal. This surfaces it to Sentry, but THROTTLED: a
 * flapping/down Redis emits an error per request, so we alert at most once per
 * window to avoid drowning Sentry (the ops signal is "Redis is down", not "N
 * requests failed open").
 */

import { captureMcpException } from './sentry.js';

/** Alert at most once per this window (ms). Overridable via env for tests/ops. */
const DEFAULT_THROTTLE_MS = 5 * 60_000;

function throttleMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MCP_REDIS_ALERT_THROTTLE_MS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_THROTTLE_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THROTTLE_MS;
}

// -Infinity so the FIRST outage always alerts regardless of the clock origin
// (a 0 init would throttle a first call at now=0).
let lastAlertAt = Number.NEGATIVE_INFINITY;

/**
 * Report a Redis outage affecting the rate limiter to Sentry, throttled to one
 * alert per window. No-op (beyond the throttle bookkeeping) when Sentry is not
 * enabled -- `captureMcpException` is itself a no-op then. `now` is injectable
 * for deterministic tests.
 */
export function alertRedisOutage(message: string, now: number = Date.now()): void {
  if (now - lastAlertAt < throttleMs()) return;
  lastAlertAt = now;
  captureMcpException(new Error(message), { subsystem: 'rate-limit-redis' });
}

/** Test helper: reset the throttle window. */
export function __resetRedisOutageAlert(): void {
  lastAlertAt = Number.NEGATIVE_INFINITY;
}
