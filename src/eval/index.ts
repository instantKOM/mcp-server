/**
 * Multi-LLM eval harness (Agent-Connect EPIC 4, issue #5208).
 *
 * Public surface: the `LlmClient` interface + adapters (Anthropic, OpenAI, mock),
 * the eval case catalog, the pure scoring/aggregation/threshold logic, and the
 * runner. See `types.ts` for the design overview.
 */

export * from './types.js';
export * from './parse.js';
export * from './scoring.js';
export * from './prompt.js';
export * from './cases.js';
export * from './mock-client.js';
export * from './anthropic-client.js';
export * from './openai-client.js';
export * from './providers.js';
export * from './runner.js';
