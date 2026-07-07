/**
 * Shared response parser (issue #5208).
 *
 * The real adapters ask the model to answer with a single JSON object of the
 * shape `{ "toolCalls": [{ "name": string, "args": object }], "note"?: string }`.
 * This keeps the adapters thin (plain text completion, no provider-specific
 * tool-schema wiring) while the eval abstraction still exposes a normalized
 * `LlmResponse` with parsed `toolCalls`. This parser is tolerant of markdown code
 * fences and of surrounding prose: it extracts the first balanced JSON object and
 * reads its `toolCalls`. On any parse failure it returns an empty tool-call list
 * with the raw text preserved -- a malformed answer simply scores as "no tools
 * driven" rather than throwing.
 */

import type { LlmResponse, LlmToolCall } from './types.js';

/** The JSON contract the model is instructed to emit (see `prompt.ts`). */
interface RawAnswer {
  toolCalls?: unknown;
  note?: unknown;
}

/** Extract the first balanced `{...}` JSON substring, or `null`. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

/** Coerce an unknown value into a normalized `LlmToolCall[]`. */
function normalizeToolCalls(raw: unknown): LlmToolCall[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const calls: LlmToolCall[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const rec = entry as Record<string, unknown>;
    const name = rec.name;
    if (typeof name !== 'string' || name.trim() === '') {
      continue;
    }
    const args =
      typeof rec.args === 'object' && rec.args !== null && !Array.isArray(rec.args)
        ? (rec.args as Record<string, unknown>)
        : {};
    calls.push({ name, args });
  }
  return calls;
}

/**
 * Parse a raw model text answer into a normalized `LlmResponse`. Never throws:
 * unparseable text yields `{ text, toolCalls: [] }`.
 */
export function parseModelAnswer(text: string): LlmResponse {
  const json = extractJsonObject(text);
  if (json === null) {
    return { text, toolCalls: [] };
  }
  try {
    const parsed = JSON.parse(json) as RawAnswer;
    return { text, toolCalls: normalizeToolCalls(parsed.toolCalls) };
  } catch {
    return { text, toolCalls: [] };
  }
}
