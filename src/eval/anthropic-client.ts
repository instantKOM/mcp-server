/**
 * Real Anthropic (Claude) adapter (issue #5208).
 *
 * Behind the `LlmClient` interface. The SDK is a devDependency and is imported
 * LAZILY (dynamic `import()`) inside `complete`, so merely importing the eval
 * module -- e.g. from a unit test that only uses the mock -- never requires the
 * SDK to be installed or a key to be present. Only an actual real-LLM run (env-
 * gated, integration-only) touches the SDK.
 *
 * The model is prompted to answer with the JSON tool-call contract (see
 * `prompt.ts`); the returned text is normalized by the shared `parseModelAnswer`.
 */

import { parseModelAnswer } from './parse.js';
import type { LlmClient, LlmMessage, LlmResponse } from './types.js';

/** Default Claude model for the eval. Overridable via `ANTHROPIC_EVAL_MODEL`. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export interface AnthropicClientOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class AnthropicLlmClient implements LlmClient {
  readonly provider = 'anthropic';
  readonly model: string;
  private readonly apiKey: string;
  private readonly maxTokens: number;

  constructor(opts: AnthropicClientOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.maxTokens = opts.maxTokens ?? 1024;
  }

  async complete(messages: LlmMessage[]): Promise<LlmResponse> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: this.apiKey });

    // Anthropic takes the system prompt as a top-level field, not a message.
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const turns = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      }));

    const res = await client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system,
      messages: turns,
    });

    const text = res.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
    return parseModelAnswer(text);
  }
}
