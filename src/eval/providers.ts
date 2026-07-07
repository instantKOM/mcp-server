/**
 * Provider resolution from env (issue #5208).
 *
 * Decides, from the environment, which real providers can run. A provider whose
 * API key is ABSENT is SKIPPED (not failed) with a logged reason -- so a fork or
 * a no-key CI run degrades gracefully to "inconclusive" instead of a hard error.
 * Pure over its `env` argument (injectable for tests); constructs no client for a
 * missing key and never reads the network.
 */

import { AnthropicLlmClient, DEFAULT_ANTHROPIC_MODEL } from './anthropic-client.js';
import { OpenAiLlmClient, DEFAULT_OPENAI_MODEL } from './openai-client.js';
import type { LlmClient } from './types.js';

/** A provider that has a key and a ready client. */
export interface AvailableProvider {
  provider: string;
  client: LlmClient;
}

/** A provider that was skipped (no key). */
export interface SkippedProvider {
  provider: string;
  reason: string;
}

export interface ResolvedProviders {
  available: AvailableProvider[];
  skipped: SkippedProvider[];
}

type Env = Record<string, string | undefined>;

/** One provider's env contract: key var + optional model override var + factory. */
interface ProviderSpec {
  provider: string;
  keyVar: string;
  modelVar: string;
  defaultModel: string;
  make(apiKey: string, model: string): LlmClient;
}

const SPECS: readonly ProviderSpec[] = [
  {
    provider: 'anthropic',
    keyVar: 'ANTHROPIC_API_KEY',
    modelVar: 'ANTHROPIC_EVAL_MODEL',
    defaultModel: DEFAULT_ANTHROPIC_MODEL,
    make: (apiKey, model) => new AnthropicLlmClient({ apiKey, model }),
  },
  {
    provider: 'openai',
    keyVar: 'OPENAI_API_KEY',
    modelVar: 'OPENAI_EVAL_MODEL',
    defaultModel: DEFAULT_OPENAI_MODEL,
    make: (apiKey, model) => new OpenAiLlmClient({ apiKey, model }),
  },
];

/**
 * Resolve providers from `env` (defaults to `process.env`). A key present and
 * non-empty yields an available provider; otherwise it is skipped with a reason.
 */
export function resolveProviders(env: Env = process.env): ResolvedProviders {
  const available: AvailableProvider[] = [];
  const skipped: SkippedProvider[] = [];

  for (const spec of SPECS) {
    const key = env[spec.keyVar];
    if (typeof key === 'string' && key.trim() !== '') {
      const model = env[spec.modelVar]?.trim() || spec.defaultModel;
      available.push({ provider: spec.provider, client: spec.make(key, model) });
    } else {
      skipped.push({
        provider: spec.provider,
        reason: `${spec.keyVar} not set`,
      });
    }
  }

  return { available, skipped };
}
