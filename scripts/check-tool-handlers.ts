/**
 * check:tool-handlers
 *
 * Fails if any MCP tool is advertised (appears in ListTools / tool defs) but has
 * no registered handler function. The tool-router auto-registers handlers by
 * name convention; a mismatch (e.g. handler `resendBroadcast` vs. expected
 * `adminBroadcastsResend`) silently leaves the tool dead -- every call throws
 * "Unknown tool". The path-based check:api-coverage cannot catch this because
 * the source still contains the API path string.
 *
 * Importing the router runs registerTools(), populating the unregistered list.
 */
import { getUnregisteredTools, getRegisteredToolCount } from '../src/tools/tool-router.js';

const unregistered = getUnregisteredTools();

if (unregistered.length === 0) {
  console.log(`[OK] All advertised MCP tools have a registered handler (${getRegisteredToolCount()} tools).`);
  process.exit(0);
}

console.error(`[FAIL] ${unregistered.length} MCP tool(s) advertised without a registered handler:\n`);
for (const t of unregistered) {
  console.error(`  - ${t.name} (${t.scope})`);
  console.error(`      tried handler names: ${t.tried.join(', ')}`);
}
console.error(
  `\nRename the handler function to one of the tried names, or rename the tool.\n` +
    `See src/tools/tool-router.ts (getCandidateNames) for the naming convention.`,
);
process.exit(1);
