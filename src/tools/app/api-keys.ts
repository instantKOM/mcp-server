import type { ApiClient } from '@instantkom/api-client';

/**
 * API Keys Tools
 * CRUD operations for API keys and IP whitelist management
 */

// ============================================================================
// API Keys CRUD Operations
// ============================================================================

export async function listApiKeys(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/api-keys${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getApiKey(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/api-keys/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createApiKey(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/api-keys', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createScopedApiKey(
  apiClient: ApiClient,
  args: { name: string; scope: string; expires_in?: number },
): Promise<any> {
  const response = await apiClient.post('/v1/api-keys/scoped', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateApiKey(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/api-keys/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteApiKey(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/api-keys/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'API key deleted successfully',
      },
    ],
  };
}

// ============================================================================
// IP Whitelist Operations
// ============================================================================

export async function listIpWhitelist(apiClient: ApiClient, args: { apiKeyId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/api-keys/${args.apiKeyId}/ip-whitelist`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function addIpToWhitelist(apiClient: ApiClient, args: { apiKeyId: number; ip: string }): Promise<any> {
  const response = await apiClient.post(`/v1/api-keys/${args.apiKeyId}/ip-whitelist`, { ip: args.ip });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function removeIpFromWhitelist(apiClient: ApiClient, args: { apiKeyId: number; ipId: number }): Promise<any> {
  await apiClient.delete(`/v1/api-keys/${args.apiKeyId}/ip-whitelist/${args.ipId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'IP removed from whitelist successfully',
      },
    ],
  };
}

export const apiKeyTools = [
  // API Keys CRUD
  {
    name: 'list_api_keys',
    description: 'List all API keys for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
      },
    },
  },
  {
    name: 'get_api_key',
    description: 'Get a specific API key by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'API key ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_api_key',
    description: 'Create a new API key',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'API key name/description' },
        permissions: { type: 'array', items: { type: 'string' }, description: 'Array of permissions' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_scoped_api_key',
    description:
      'Create a scoped CLI/automation token (not channel-bound). ' +
      'Returns the raw access token once. Requires admin scope.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Human-readable token name' },
        scope: {
          type: 'string',
          enum: ['full', 'send', 'read', 'admin'],
          description: 'Token scope',
        },
        expires_in: {
          type: 'number',
          description: 'Token lifetime in seconds (omit for non-expiring)',
        },
      },
      required: ['name', 'scope'],
    },
  },
  {
    name: 'update_api_key',
    description: 'Update an API key',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'API key ID' },
        name: { type: 'string', description: 'API key name/description' },
        active: { type: 'boolean', description: 'Enable/disable the API key' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_api_key',
    description: 'Delete an API key by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'API key ID' },
      },
      required: ['id'],
    },
  },

  // IP Whitelist
  {
    name: 'list_ip_whitelist',
    description: 'List all whitelisted IPs for an API key',
    inputSchema: {
      type: 'object',
      properties: {
        apiKeyId: { type: 'number', description: 'API key ID' },
      },
      required: ['apiKeyId'],
    },
  },
  {
    name: 'add_ip_to_whitelist',
    description: 'Add an IP address to the whitelist',
    inputSchema: {
      type: 'object',
      properties: {
        apiKeyId: { type: 'number', description: 'API key ID' },
        ip: { type: 'string', description: 'IP address to whitelist' },
      },
      required: ['apiKeyId', 'ip'],
    },
  },
  {
    name: 'remove_ip_from_whitelist',
    description: 'Remove an IP address from the whitelist',
    inputSchema: {
      type: 'object',
      properties: {
        apiKeyId: { type: 'number', description: 'API key ID' },
        ipId: { type: 'number', description: 'IP whitelist entry ID' },
      },
      required: ['apiKeyId', 'ipId'],
    },
  },
];
