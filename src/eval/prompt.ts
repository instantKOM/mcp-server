/**
 * Prompt assembly for the eval (issue #5208).
 *
 * Builds the message list handed to a model for one eval case: a system turn
 * carrying the playbook's authored `skill.md` plus a strict output contract, and
 * a user turn carrying the natural-language task. The output contract asks the
 * model to answer with a single JSON object listing the tool calls it would make
 * (parsed by `parse.ts`), which keeps every adapter to plain text completion --
 * no provider-specific tool-schema wiring -- while still yielding a normalized,
 * oracle-scorable tool sequence.
 */

import type { EvalCase, LlmMessage } from './types.js';

/** The JSON answer contract appended to every system prompt. */
const OUTPUT_CONTRACT = `
---
OUTPUT CONTRACT (follow exactly):
Decide which instantKOM MCP tools you would call, in order, to accomplish the
task using the playbook above. Respond with ONE JSON object and NOTHING else:

{"toolCalls": [{"name": "<tool_name>", "args": { ... }}], "note": "<one line>"}

- Use the exact tool names the playbook references.
- List the tool calls in the order you would perform them.
- Do not wrap the JSON in markdown fences. Do not add prose outside the JSON.
- If the task requires no tool, return {"toolCalls": [], "note": "..."}.
`.trim();

/**
 * Build the message list for one eval case. `skill` is the playbook's `skill.md`
 * body (from the registry).
 */
export function buildEvalMessages(evalCase: EvalCase, skill: string): LlmMessage[] {
  return [
    {
      role: 'system',
      content: `${skill}\n\n${OUTPUT_CONTRACT}`,
    },
    {
      role: 'user',
      content: evalCase.task,
    },
  ];
}
