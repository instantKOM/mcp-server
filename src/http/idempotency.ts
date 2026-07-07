/**
 * MCP-side Idempotency-Key propagation (Agent-Connect EPIC 1, AK4, issue #5193).
 *
 * Every MUTATING (`send`-scoped) tool call must carry an `Idempotency-Key` so a
 * duplicate call with the same effective key performs only ONE mutation. The
 * dedup itself lives entirely in the API (`common/idempotency` -- a global,
 * Redis-backed interceptor that caches the first response per key and replays it
 * for any later request with the same header). This module only decides the key
 * and forwards it as the `Idempotency-Key` HTTP header on the outbound API call.
 *
 * Key precedence:
 *   1. An EXPLICIT key supplied by the caller wins -- either MCP request metadata
 *      (`params._meta.idempotencyKey`) or a tool argument (`args.idempotencyKey`).
 *      Lets an agent retry a specific logical operation with a stable key of its
 *      own choosing. A consumed `args.idempotencyKey` is stripped before the
 *      handler runs so it never leaks into the request body.
 *   2. Otherwise a DETERMINISTIC key derived from
 *          `${tenantId}:${toolName}:sha256(stableStringify(args))`
 *      where `tenantId` is the resolved tenant/key id for THIS request. So an
 *      accidental duplicate call (same tenant, same tool, same args) dedups,
 *      while any intentionally distinct call (different args) yields a different
 *      key and mutates normally. `stableStringify` sorts object keys recursively
 *      so argument ordering does not change the hash.
 *
 * read/draft tools never reach this module -- only `send`-classified calls are
 * wrapped, so retrieval/compose tools are unaffected.
 */

import { createHash } from 'node:crypto';
import type { ApiClient } from '@instantkom/api-client';

/** Header name the API idempotency interceptor reads (case-insensitive). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Deterministic JSON serialization with recursively sorted object keys, so two
 * argument objects that differ only in key order hash identically. Arrays keep
 * their order (order IS semantically meaningful for a list argument).
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Derive a stable idempotency key from the resolved tenant id, tool name and a
 * hash of the (normalized) tool arguments.
 */
export function deriveIdempotencyKey(
  tenantId: string,
  toolName: string,
  args: unknown,
): string {
  const hash = createHash('sha256')
    .update(stableStringify(args ?? {}))
    .digest('hex');
  return `${tenantId}:${toolName}:${hash}`;
}

export interface ResolvedIdempotency {
  /** The effective Idempotency-Key to forward on the API request. */
  key: string;
  /** Args with any consumed explicit-key field removed. */
  cleanedArgs: Record<string, unknown>;
  /** Whether the key came from the caller (true) or was derived (false). */
  explicit: boolean;
}

/**
 * Resolve the effective Idempotency-Key for a `send` tool call, applying the
 * precedence (explicit caller key > derived key) and stripping a consumed
 * `args.idempotencyKey` so it never leaks into the API request body.
 */
export function resolveIdempotencyKey(params: {
  tenantId: string;
  toolName: string;
  args: Record<string, unknown> | undefined;
  meta?: Record<string, unknown> | undefined;
}): ResolvedIdempotency {
  const args: Record<string, unknown> = { ...params.args };

  const metaKey = readStringField(params.meta, 'idempotencyKey');
  const argKey = readStringField(args, 'idempotencyKey');
  if (argKey !== undefined) {
    delete args.idempotencyKey;
  }

  const explicitKey = metaKey ?? argKey;
  if (explicitKey !== undefined) {
    return { key: explicitKey, cleanedArgs: args, explicit: true };
  }

  return {
    key: deriveIdempotencyKey(params.tenantId, params.toolName, args),
    cleanedArgs: args,
    explicit: false,
  };
}

function readStringField(
  source: Record<string, unknown> | undefined,
  field: string,
): string | undefined {
  const value = source?.[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** HTTP verbs the ApiClient exposes that the interceptor treats as mutating. */
type MutatingMethod = 'post' | 'put' | 'patch' | 'delete';
const MUTATING_METHODS: readonly MutatingMethod[] = [
  'post',
  'put',
  'patch',
  'delete',
];

/**
 * Wrap an ApiClient so every MUTATING request (post/put/patch/delete and
 * postMultipart) it issues carries the given `Idempotency-Key` header. GET
 * requests pass through untouched. The wrapper is a thin Proxy -- it never
 * mutates the underlying client, so the same client instance stays reusable for
 * non-idempotent (read) calls elsewhere.
 *
 * A caller-provided per-call header still wins (merged last), matching the
 * ApiClient's own `...requestOptions?.headers` precedence.
 */
export function withIdempotencyKey(
  apiClient: ApiClient,
  key: string,
): ApiClient {
  const inject = (options: unknown): { headers: Record<string, string> } => {
    const existing = (options ?? {}) as { headers?: Record<string, string> };
    return {
      ...existing,
      headers: { [IDEMPOTENCY_HEADER]: key, ...existing.headers },
    };
  };

  return new Proxy(apiClient, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original !== 'function') {
        return original;
      }

      if (MUTATING_METHODS.includes(prop as MutatingMethod)) {
        // Signature: (path, body?, options?) -> options is the 3rd arg.
        return (...args: unknown[]) => {
          const next = args.slice(0, 2);
          next[2] = inject(args[2]);
          return (original as (...a: unknown[]) => unknown).apply(target, next);
        };
      }

      if (prop === 'postMultipart') {
        // Signature: (path, fields, files, options?) -> options is the 4th arg.
        return (...args: unknown[]) => {
          const next = args.slice(0, 3);
          next[3] = inject(args[3]);
          return (original as (...a: unknown[]) => unknown).apply(target, next);
        };
      }

      // Bind non-mutating methods so `this` stays the real client.
      return (original as (...a: unknown[]) => unknown).bind(target);
    },
  });
}
