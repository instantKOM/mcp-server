/**
 * MCP-side Idempotency-Key propagation (issue #5193).
 *
 * The shared resolver preserves explicit retry keys and deterministic defaults
 * for content-addressed operations. Repeatable admin ticket state commands get
 * a fresh default identity per invocation. Deduplication remains in the API's
 * Redis-backed interceptor; this module only forwards headers.
 */

import { createHash } from 'node:crypto';
import type { ApiClient } from '@instantkom/api-client';

export {
  deriveIdempotencyKey,
  resolveIdempotencyKey,
  stableStringify,
} from '@instantkom/api-client/idempotency.cjs';
export type { ResolvedIdempotency } from '@instantkom/api-client/idempotency.cjs';

/** Header name the API idempotency interceptor reads (case-insensitive). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
/** PII-safe correlation shared by the Remote-MCP tool and its REST hop. */
export const MCP_AUDIT_CORRELATION_HEADER = 'X-InstantKOM-MCP-Correlation-Id';

export function deriveRestAuditCorrelationId(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
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
  correlationId?: string
): ApiClient {
  return withRestAuditCorrelation(
    apiClient,
    correlationId ?? deriveRestAuditCorrelationId(key),
    key,
    correlationId === undefined
  );
}

/**
 * Mark Remote-MCP REST mutations with a PII-safe correlation. The marker is
 * observability metadata only: credential attribution still comes exclusively
 * from the API guard. Reads are deliberately untouched.
 */
export function withRestAuditCorrelation(
  apiClient: ApiClient,
  correlationId: string,
  idempotencyKey?: string,
  correlateEffectiveIdempotencyKey = false
): ApiClient {
  const inject = (options: unknown): { headers: Record<string, string> } => {
    const existing = (options ?? {}) as { headers?: Record<string, string> };
    const headers = {
      ...(idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {}),
      ...existing.headers,
    };
    const effectiveIdempotencyKey = headers[IDEMPOTENCY_HEADER];
    return {
      ...existing,
      headers: {
        ...headers,
        [MCP_AUDIT_CORRELATION_HEADER]:
          correlateEffectiveIdempotencyKey && effectiveIdempotencyKey
            ? deriveRestAuditCorrelationId(effectiveIdempotencyKey)
            : correlationId,
      },
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
