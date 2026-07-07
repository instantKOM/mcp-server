/**
 * PII-exposure enforcement seam for the Remote-MCP gateway
 * (issue #5203, Agent-Connect EPIC 3).
 *
 * Content-reading playbooks may forward contact PII (names, phone numbers, chat
 * history) to the EXTERNAL customer LLM. That is only permitted when the
 * presenting key carries the AGENT_PII_EXPOSURE perms2api grant, which the API
 * introspect endpoint surfaces and Apis2AuthResolver maps onto
 * `ResolvedAuth.piiExposureAllowed`.
 *
 * This module is the single documented choke point for that decision. It is
 * DEFAULT-DENY: an undefined / false flag refuses forwarding. Call
 * {@link assertPiiExposureAllowed} at the point where a playbook is about to
 * hand contact PII to the external LLM (the content-reading composite path);
 * #5211 adds the consent UI that lets a customer grant the flag.
 *
 * Kept deliberately minimal and side-effect free so it can be unit-tested in
 * isolation and reused wherever PII would cross the external-LLM boundary.
 */

import type { ResolvedAuth } from './auth-resolver.js';

/**
 * Thrown when a playbook would forward contact PII to the external LLM but the
 * presenting key has not been granted AGENT_PII_EXPOSURE.
 */
export class PiiExposureDeniedError extends Error {
  readonly code = 'PII_EXPOSURE_DENIED';
  readonly playbookId?: string;

  constructor(playbookId?: string) {
    super(
      'This action would forward contact PII to the external LLM, which ' +
        'requires the AGENT_PII_EXPOSURE permission. The presenting key has ' +
        'not been granted it.' +
        (playbookId ? ` (playbook: ${playbookId})` : ''),
    );
    this.name = 'PiiExposureDeniedError';
    this.playbookId = playbookId;
  }
}

/**
 * Whether the resolved auth is allowed to forward contact PII to the external
 * LLM. Strict: only an explicit `true` grants; undefined/false deny.
 */
export function isPiiExposureAllowed(
  auth: Pick<ResolvedAuth, 'piiExposureAllowed'> | null | undefined,
): boolean {
  return auth?.piiExposureAllowed === true;
}

/**
 * Guard point: throw {@link PiiExposureDeniedError} unless the presenting key is
 * allowed to forward PII. No-op (returns) when allowed.
 *
 * @param auth - The per-request resolved auth context.
 * @param playbookId - Optional id of the playbook attempting the forward,
 *   included in the error for observability.
 */
export function assertPiiExposureAllowed(
  auth: Pick<ResolvedAuth, 'piiExposureAllowed'> | null | undefined,
  playbookId?: string,
): void {
  if (!isPiiExposureAllowed(auth)) {
    throw new PiiExposureDeniedError(playbookId);
  }
}
