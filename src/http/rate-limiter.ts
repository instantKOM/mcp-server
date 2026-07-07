/**
 * Per-key rate limiting for the Remote-MCP HTTP gateway (Agent-Connect EPIC 1,
 * AK5, issue #5194 -- final auth-chain item).
 *
 * A customer connects to the gateway with a single Bearer key (#5190/#5191).
 * This module caps how many gateway requests that key may make inside a rolling
 * fixed window, so one key cannot exhaust the shared API. It reuses the SAME
 * Redis the rest of the platform throttles against (the NestJS API's
 * `ThrottlerStorageRedisService` uses the identical `INCR` + `PEXPIRE`
 * fixed-window scheme -- see services/api/src/common/throttler), just from the
 * standalone Node gateway which cannot host a NestJS `ThrottlerGuard`.
 *
 * Key scheme (Redis):
 *   `mcp:ratelimit:{identity}` where identity is the resolved key/tenant id (the
 *   gateway passes `${tenantId}:${sha256(token).slice(0,32)}` so the limit is
 *   truly PER KEY, not merely per customer). An optional per-endpoint suffix can
 *   be appended by the caller for finer buckets; the AK5 must is the per-key
 *   global limit.
 *
 * Window algorithm (fixed window):
 *   `INCR key` (atomic) then `PEXPIRE key windowMs` only on the FIRST hit
 *   (count === 1). Concurrent requests all observe a correct, monotonically
 *   increasing count; the TTL is set once so the window does not slide on every
 *   request. `count > max` is rejected.
 *
 * Fail-open: if Redis is unavailable / errors, the request is ALLOWED and a
 * warning is logged. Rationale: a limiter outage must not take the whole gateway
 * down (availability > perfect enforcement for a best-effort abuse guard). The
 * authenticate/authorize chain still runs, so a bad key is still rejected; only
 * the *rate* cap is skipped while Redis is down.
 */

import { createHash } from 'node:crypto';

/** Minimal Redis surface the store needs -- keeps this module ioredis-free and unit-testable. */
export interface RedisLike {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  pttl(key: string): Promise<number>;
}

/** Outcome of a single increment against the window. */
export interface IncrementResult {
  /** Current request count inside the active window (this request included). */
  count: number;
  /** Remaining time-to-live of the window in ms, or the full window on the first hit. */
  ttlMs: number;
}

/** Storage abstraction so the limiter can be unit-tested with an in-memory fake. */
export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<IncrementResult>;
}

/**
 * Redis-backed fixed-window store. Mirrors the API throttler's INCR+PEXPIRE
 * scheme so both layers count identically against the shared Redis.
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: RedisLike) {}

  async increment(key: string, windowMs: number): Promise<IncrementResult> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      // First hit opens the window; set the TTL exactly once (fixed window).
      await this.redis.pexpire(key, windowMs);
      return { count, ttlMs: windowMs };
    }
    const ttl = await this.redis.pttl(key);
    // pttl returns -1 (no expiry) / -2 (missing) on edge races: re-arm the window.
    if (ttl < 0) {
      await this.redis.pexpire(key, windowMs);
      return { count, ttlMs: windowMs };
    }
    return { count, ttlMs: ttl };
  }
}

export interface RateLimitConfig {
  /** Whether limiting is active. Disabled when max <= 0. */
  enabled: boolean;
  /** Max requests per key per window. */
  max: number;
  /** Window length in ms. */
  windowMs: number;
  /** Redis key prefix. */
  prefix: string;
}

const DEFAULT_MAX = 120;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_PREFIX = 'mcp:ratelimit:';

/**
 * Load the rate-limit configuration from the environment.
 *
 * Env knobs:
 *   - MCP_RATE_LIMIT_MAX       (default 120) -- max requests per key per window.
 *                              <= 0 disables limiting entirely.
 *   - MCP_RATE_LIMIT_WINDOW_MS (default 60000) -- window length in ms.
 *   - MCP_RATE_LIMIT_PREFIX    (default "mcp:ratelimit:") -- Redis key prefix.
 */
export function loadRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
): RateLimitConfig {
  const max = parseIntOr(env.MCP_RATE_LIMIT_MAX, DEFAULT_MAX);
  const windowMs = parseIntOr(env.MCP_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS);
  const prefix = env.MCP_RATE_LIMIT_PREFIX || DEFAULT_PREFIX;
  return {
    enabled: max > 0,
    max,
    windowMs: windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS,
    prefix,
  };
}

function parseIntOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Decision returned for a single request. */
export interface RateLimitDecision {
  /** Whether the request may proceed. */
  allowed: boolean;
  /** Configured max for the window (for the `X-RateLimit-Limit` header). */
  limit: number;
  /** Requests left in the window (never negative). */
  remaining: number;
  /** Seconds until the window resets (for the `Retry-After` header). */
  retryAfterSeconds: number;
  /** True when the decision was made blind because the store failed (fail-open). */
  failedOpen: boolean;
}

/**
 * Build a stable per-key identity from the resolved tenant id and the raw bearer
 * token. The token is hashed (never stored raw in Redis) so the limit is per
 * KEY, while the tenant prefix keeps the Redis key human-readable in ops.
 */
export function buildRateLimitIdentity(tenantId: string, token: string): string {
  const hash = createHash('sha256').update(token).digest('hex').slice(0, 32);
  return `${tenantId}:${hash}`;
}

/**
 * Fixed-window per-key rate limiter. Construct once, call `check(identity)` per
 * request. Fails open (allows + warns) on any store error.
 */
export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly store: RateLimitStore;
  private readonly warn: (message: string) => void;

  constructor(options: {
    store: RateLimitStore;
    config?: RateLimitConfig;
    warn?: (message: string) => void;
  }) {
    this.store = options.store;
    this.config = options.config ?? loadRateLimitConfig();
    this.warn = options.warn ?? ((m) => console.error(m));
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Account one request for `identity`. Returns the decision. When disabled,
   * always allows. On store error, allows (fail-open) and logs a warning.
   *
   * @param identity Per-key identity (see buildRateLimitIdentity).
   * @param bucket   Optional endpoint/tool suffix for finer per-endpoint buckets.
   */
  async check(identity: string, bucket?: string): Promise<RateLimitDecision> {
    const { enabled, max, windowMs, prefix } = this.config;
    if (!enabled) {
      return {
        allowed: true,
        limit: max,
        remaining: max,
        retryAfterSeconds: 0,
        failedOpen: false,
      };
    }

    const key = `${prefix}${identity}${bucket ? `:${bucket}` : ''}`;

    let result: IncrementResult;
    try {
      result = await this.store.increment(key, windowMs);
    } catch (error) {
      this.warn(
        `[RateLimit] Store unavailable, failing open: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        allowed: true,
        limit: max,
        remaining: max,
        retryAfterSeconds: 0,
        failedOpen: true,
      };
    }

    const allowed = result.count <= max;
    const remaining = Math.max(0, max - result.count);
    const retryAfterSeconds = allowed
      ? 0
      : Math.max(1, Math.ceil(result.ttlMs / 1000));

    return { allowed, limit: max, remaining, retryAfterSeconds, failedOpen: false };
  }
}
