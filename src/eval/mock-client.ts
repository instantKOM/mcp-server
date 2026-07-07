/**
 * Deterministic MOCK LlmClient (issue #5208).
 *
 * Drives the scoring/aggregation/threshold logic in unit tests WITHOUT any
 * network or API key. Two construction modes:
 *   - a fixed `LlmResponse` (or a per-task map), returned verbatim; or
 *   - a `respond(messages)` function for scripted, message-aware behavior.
 *
 * Because it implements the exact same `LlmClient` interface as the real
 * adapters, the runner cannot tell them apart -- so a unit test exercises the
 * real runner + real oracle deterministically.
 */

import type { LlmClient, LlmMessage, LlmResponse } from './types.js';

/** Function form of a scripted mock. */
export type MockResponder = (messages: LlmMessage[]) => LlmResponse | Promise<LlmResponse>;

export class MockLlmClient implements LlmClient {
  readonly provider: string;
  readonly model: string;
  private readonly responder: MockResponder;
  /** Records every prompt the runner sent, for assertions. */
  readonly calls: LlmMessage[][] = [];

  constructor(opts: { provider?: string; model?: string; respond: MockResponder | LlmResponse }) {
    this.provider = opts.provider ?? 'mock';
    this.model = opts.model ?? 'mock-model';
    this.responder =
      typeof opts.respond === 'function' ? opts.respond : () => opts.respond as LlmResponse;
  }

  async complete(messages: LlmMessage[]): Promise<LlmResponse> {
    this.calls.push(messages);
    return this.responder(messages);
  }
}
