/**
 * Dynamic Tool Router
 * Auto-registers tool handlers by matching tool names to exported handler functions.
 *
 * Convention: tool name in snake_case maps to handler function in camelCase.
 * Example: 'list_channels' -> listChannels, 'admin_get_plan' -> adminGetPlan
 */

import type { ApiClient } from '@instantkom/api-client';

// Import all tool handlers (namespace imports)
import * as publicHandlers from './public/index.js';
import * as appHandlers from './app/index.js';
import * as adminHandlers from './admin/index.js';
import * as internalHandlers from './internal/index.js';

// Import tool definition arrays
import { publicTools } from './public/index.js';
import { appTools } from './app/index.js';
import { adminTools } from './admin/index.js';
import { internalTools } from './internal/index.js';

/**
 * Tool handler function type
 */
type ToolHandler = (apiClient: ApiClient, args: any) => Promise<any>;

/**
 * Tool registry mapping tool names to handlers
 */
const toolRegistry = new Map<string, ToolHandler>();

/**
 * Tools whose definition exists but no matching handler function was found.
 * Populated during registration; surfaced by the check:tool-handlers gate.
 */
const unregisteredTools: Array<{ name: string; scope: string; tried: string[] }> = [];

/**
 * Convert snake_case tool name to camelCase handler function name.
 * Example: 'list_channels' -> 'listChannels'
 *          'admin_get_plan' -> 'adminGetPlan'
 */
function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Generate candidate handler names for a tool.
 *
 * Tool naming conventions vary across scopes:
 * - app:      'list_channels'           -> listChannels
 * - admin:    'admin_list_plans'        -> listAdminPlans
 * - internal: 'internal_list_companies' -> listCompanies
 *
 * This function returns all plausible camelCase names to try.
 */
function getCandidateNames(toolName: string, scope: string): string[] {
  const direct = snakeToCamel(toolName);
  const candidates = [direct];

  // For prefixed scopes, also try rearranged and stripped variants
  const prefixes = ['admin_', 'internal_'];
  for (const prefix of prefixes) {
    if (toolName.startsWith(prefix)) {
      const withoutPrefix = toolName.slice(prefix.length);
      const prefixCapitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1, -1); // 'Admin' or 'Internal'
      const parts = withoutPrefix.split('_');

      // Try inserting the prefix word after each possible verb position
      // 'admin_bulk_delete_plans' -> try 'bulkAdminDeletePlans', 'bulkDeleteAdminPlans'
      for (let i = 1; i <= parts.length; i++) {
        const verbParts = parts.slice(0, i);
        const restParts = parts.slice(i);
        const verb = verbParts[0] + verbParts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
        const rest = restParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
        candidates.push(verb + prefixCapitalized + rest);
      }

      // 'internal_list_companies' -> 'listCompanies' (strip prefix entirely)
      candidates.push(snakeToCamel(withoutPrefix));
    }
  }

  return candidates;
}

/**
 * Auto-register tools by matching tool definition names to handler functions.
 * Tries multiple naming conventions for flexibility.
 */
function autoRegister(
  tools: Array<{ name: string }>,
  handlers: Record<string, any>,
  scope: string,
) {
  for (const tool of tools) {
    const candidates = getCandidateNames(tool.name, scope);
    let found = false;

    for (const name of candidates) {
      if (typeof handlers[name] === 'function') {
        toolRegistry.set(tool.name, handlers[name] as ToolHandler);
        found = true;
        break;
      }
    }

    if (!found) {
      unregisteredTools.push({ name: tool.name, scope, tried: candidates });
      console.error(
        `[tool-router] WARNING: No handler found for tool '${tool.name}' (tried: ${candidates.join(', ')}) in ${scope} handlers`,
      );
    }
  }
}

/**
 * Register all tool handlers
 */
function registerTools() {
  autoRegister(publicTools, publicHandlers, 'public');
  autoRegister(appTools, appHandlers, 'app');
  autoRegister(adminTools, adminHandlers, 'admin');
  autoRegister(internalTools, internalHandlers, 'internal');
}

// Initialize registry
registerTools();

/**
 * Execute a tool by name
 */
export async function executeTool(name: string, apiClient: ApiClient, args: any): Promise<any> {
  const handler = toolRegistry.get(name);

  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return await handler(apiClient, args);
}

/**
 * Check if a tool exists
 */
export function hasToolHandler(name: string): boolean {
  return toolRegistry.has(name);
}

/**
 * Get count of registered tools (useful for diagnostics)
 */
export function getRegisteredToolCount(): number {
  return toolRegistry.size;
}

/**
 * List tools that have a definition but no registered handler.
 * Used by the check:tool-handlers CI/pre-commit gate to fail on silent
 * wiring gaps (tool listed + advertised, but every call throws "Unknown tool").
 */
export function getUnregisteredTools(): Array<{ name: string; scope: string; tried: string[] }> {
  return unregisteredTools;
}
