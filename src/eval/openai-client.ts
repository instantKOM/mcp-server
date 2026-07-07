/**
 * Real OpenAI (GPT) adapter (issue #5208).
 *
 * Behind the `LlmClient` interface. The SDK is a devDependency and imported
 * LAZILY inside `complete`, so importing the eval module without the SDK/key
 * present is safe (only a real run touches it). The model is prompted with the
 * JSON tool-call contract (see `prompt.ts`) and its text answer is normalized by
 * the shared `parseModelAnswer`.
 */

import { parseModelAnswer } from './parse.js';
import type { LlmClient, LlmMessage, LlmResponse } from './types.js';

/** Default GPT model for the eval. Overridable via `OPENAI_EVAL_MODEL`. */
export const DEFAULT_OPENAI_MODEL = 'gpt-4o';

export interface OpenAiClientOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class OpenAiLlmClient implements LlmClient {
  readonly provider = 'openai';
  readonly model: string;
  private readonly apiKey: string;
  private readonly maxTokens: number;

  constructor(opts: OpenAiClientOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_OPENAI_MODEL;
    this.maxTokens = opts.maxTokens ?? 1024;
  }

  async complete(messages: LlmMessage[]): Promise<LlmResponse> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.apiKey });

    const res = await client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = res.choices[0]?.message?.content ?? '';
    return parseModelAnswer(text);
  }
}
