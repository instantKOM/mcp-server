/**
 * Meta Tools - Server management (tenant switching, diagnostics)
 * These tools are always available regardless of tenant scope.
 * Handlers live in index.ts (different signature than API tools).
 */

export const metaTools = [
  {
    name: 'switch_tenant',
    description:
      'Switch the active tenant/environment at runtime. Changes which API endpoint, credentials, and tools are available. Use list_tenants to see available options.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description:
            'The tenant ID to switch to (e.g., "internal", "staging", "internal-prod")',
        },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'get_current_tenant',
    description:
      'Show the currently active tenant/environment, including ID, name, API URL, and scope.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_tenants',
    description:
      'List all available tenants/environments with their scope and credential status.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
