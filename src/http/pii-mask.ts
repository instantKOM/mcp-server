/**
 * Central PII-masking seam for base MCP tool results (issue #5317).
 *
 * The PII-exposure grant (AGENT_PII_EXPOSURE / perms2api) is resolved onto
 * `ResolvedAuth.piiExposureAllowed` and surfaced by the API introspect
 * endpoint. Composite content-reading playbooks gate on it via
 * {@link file://./pii-guard.ts} (assertPiiExposureAllowed), but the BASE read
 * tools (`get_contact`, `list_contacts`, chats/tickets/messages, ...) returned
 * unmasked contact PII (phone number `identifier`, `name`, `email`) regardless
 * of the grant. This module is the single choke point that masks those fields
 * in a tool result's JSON payload whenever the presenting key was NOT granted
 * PII exposure.
 *
 * DEFAULT-DENY at the call site: the factory only calls this when
 * `piiExposureAllowed !== true`, so an undefined/false grant masks.
 *
 * Design goals:
 *   - Central (not per-tool-duplicated): applied once to every base tool result.
 *   - Non-destructive to non-PII data: `name` is a PII field on a CONTACT but a
 *     harmless label on a broadcast/template. We therefore mask `name`-like
 *     fields ONLY inside an object that also looks like a contact (carries a
 *     contact-identity key such as `identifier` / `phoneNumber`). Unambiguous
 *     PII keys (`identifier`, `email`, phone numbers) are always masked.
 *   - Fail-open on parse errors only: if a tool result is not the expected
 *     `{content:[{type:'text', text: <json>}]}` shape or the text is not JSON,
 *     the result is returned unchanged (there is nothing structured to mask).
 */

/** Replacement token for a masked scalar PII value. */
export const PII_MASK = '[redacted]';

/**
 * Keys whose VALUE is always contact PII, masked wherever they appear.
 * Lower-cased for case-insensitive matching.
 */
const ALWAYS_PII_KEYS = new Set<string>([
  'identifier',
  'phonenumber',
  'phone',
  'mobile',
  'msisdn',
  'email',
  'e_mail',
  'emailaddress',
]);

/**
 * Keys that mark an object as a CONTACT-like record. Their presence makes the
 * context-sensitive PII keys (below) eligible for masking within that object.
 */
const CONTACT_CONTEXT_KEYS = new Set<string>([
  'identifier',
  'phonenumber',
  'phone',
  'mobile',
  'msisdn',
]);

/**
 * Keys masked ONLY inside a contact-like object (see CONTACT_CONTEXT_KEYS), so
 * that a broadcast/template `name` is never touched.
 */
const CONTEXT_PII_KEYS = new Set<string>([
  'name',
  'firstname',
  'lastname',
  'fullname',
  'displayname',
  'contactname',
  'sendername',
]);

function isContactLike(obj: Record<string, unknown>): boolean {
  for (const key of Object.keys(obj)) {
    if (CONTACT_CONTEXT_KEYS.has(key.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function maskScalar(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return value;
  }
  return PII_MASK;
}

/**
 * Recursively mask PII fields in an arbitrary parsed JSON value.
 */
export function maskPiiValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskPiiValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const contactLike = isContactLike(obj);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (ALWAYS_PII_KEYS.has(lower)) {
        out[key] = maskScalar(val);
      } else if (contactLike && CONTEXT_PII_KEYS.has(lower)) {
        out[key] = maskScalar(val);
      } else {
        out[key] = maskPiiValue(val);
      }
    }
    return out;
  }
  return value;
}

interface TextContentBlock {
  type: string;
  text: string;
  [k: string]: unknown;
}

/**
 * Mask contact PII in a base tool result. Returns a NEW result object with
 * masked `text` blocks; non-JSON / unexpected shapes pass through untouched.
 */
export function maskPiiInToolResult<T>(result: T): T {
  if (result === null || typeof result !== 'object') {
    return result;
  }
  const r = result as { content?: unknown; isError?: unknown };
  if (!Array.isArray(r.content)) {
    return result;
  }
  const maskedContent = r.content.map((block) => {
    if (
      block === null ||
      typeof block !== 'object' ||
      (block as TextContentBlock).type !== 'text' ||
      typeof (block as TextContentBlock).text !== 'string'
    ) {
      return block;
    }
    const textBlock = block as TextContentBlock;
    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      // Not JSON -- nothing structured to mask, leave as-is.
      return block;
    }
    const masked = maskPiiValue(parsed);
    return { ...textBlock, text: JSON.stringify(masked, null, 2) };
  });
  return { ...r, content: maskedContent } as T;
}
