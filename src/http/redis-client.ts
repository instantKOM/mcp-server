/**
 * Lazy ioredis client for the Remote-MCP gateway rate limiter (issue #5194).
 *
 * Reuses the SAME connection env the rest of the platform uses (REDIS_HOST /
 * REDIS_PORT / REDIS_PASSWORD, or a full REDIS_URL). Kept in its own module so
 * `rate-limiter.ts` stays ioredis-free and trivially unit-testable against an
 * in-memory fake; only the gateway wires the real client in.
 *
 * The connection is lazy + non-blocking: a Redis outage must not crash the
 * gateway (the limiter fails open, see rate-limiter.ts). ioredis buffers/rejects
 * commands while disconnected, which surfaces as a store error -> fail-open.
 */

import { Redis } from 'ioredis';
import type { RedisLike } from './rate-limiter.js';
import { alertRedisOutage } from '../monitoring/redis-outage-alert.js';

let singleton: Redis | null = null;

/**
 * Whether to enable TLS for a host/port Redis connection (issue #5412). A
 * `rediss://` REDIS_URL already negotiates TLS in ioredis by itself; this flag
 * covers the host/port form, where a non-localhost Redis would otherwise run
 * UNENCRYPTED. Set `REDIS_TLS=true` for a managed/remote Redis.
 */
function tlsEnabled(env: NodeJS.ProcessEnv): boolean {
  return (env.REDIS_TLS ?? '').trim().toLowerCase() === 'true';
}

/**
 * Build (once) the shared ioredis client from the environment, or return null
 * when no Redis is configured (rate limiting then has no backing store and the
 * caller should skip enforcement).
 */
export function getRateLimitRedis(
  env: NodeJS.ProcessEnv = process.env,
): RedisLike | null {
  if (singleton) return singleton;

  const url = env.REDIS_URL;
  const host = env.REDIS_HOST;
  if (!url && !host) return null;

  const common = {
    // Backoff, but never let a down Redis wedge the gateway.
    retryStrategy: (times: number) => Math.min(times * 50, 3000),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  };

  singleton = url
    ? // `rediss://` in the URL turns on TLS in ioredis on its own; REDIS_TLS is
      // the host/port knob below and does not apply to the URL form.
      new Redis(url, common)
    : new Redis({
        host,
        port: Number.parseInt(env.REDIS_PORT ?? '6379', 10) || 6379,
        password: env.REDIS_PASSWORD || undefined,
        // Enforce TLS for a remote host/port Redis so credentials + rate-limit
        // keys are not sent in clear. `{}` uses Node's default trust store.
        ...(tlsEnabled(env) ? { tls: {} } : {}),
        ...common,
      });

  singleton.on('error', (err: Error) => {
    // Logged once here; the limiter also logs the fail-open per request.
    console.error(`[RateLimit] Redis connection error: ${err.message}`);
    // Surface a SUSTAINED outage to Sentry (throttled) -- fail-open otherwise
    // hides that abuse protection is off. See redis-outage-alert.ts (#5412).
    alertRedisOutage(`[RateLimit] Redis connection error: ${err.message}`);
  });

  return singleton;
}

/** Testing helper: reset the memoized client. */
export function __resetRateLimitRedis(): void {
  if (singleton) {
    void singleton.quit().catch(() => undefined);
  }
  singleton = null;
}
