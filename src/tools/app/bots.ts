import type { ApiClient } from '@instantkom/api-client';

/**
 * Bots Tools
 * CRUD operations for bots, bot filters, and bot environment variables
 */

// ============================================================================
// Bot CRUD Operations
// ============================================================================

export async function listBots(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.channelId) params.append('channelId', args.channelId.toString());
  if (args.status !== undefined) params.append('status', args.status.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/bots${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getBot(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/bots/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createBot(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/bots', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateBot(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/bots/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteBot(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/bots/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Bot deleted successfully',
      },
    ],
  };
}

// ============================================================================
// Bot Filters Operations
// ============================================================================

export async function listBotFilters(apiClient: ApiClient, args: { botId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/bots/${args.botId}/filters`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getBotFilter(apiClient: ApiClient, args: { botId: number; filterId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/bots/${args.botId}/filters/${args.filterId}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createBotFilter(apiClient: ApiClient, args: any): Promise<any> {
  const { botId, ...data } = args;
  const response = await apiClient.post(`/v1/bots/${botId}/filters`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateBotFilter(apiClient: ApiClient, args: any): Promise<any> {
  const { botId, filterId, ...data } = args;
  const response = await apiClient.put(`/v1/bots/${botId}/filters/${filterId}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteBotFilter(apiClient: ApiClient, args: { botId: number; filterId: number }): Promise<any> {
  await apiClient.delete(`/v1/bots/${args.botId}/filters/${args.filterId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Bot filter deleted successfully',
      },
    ],
  };
}

// ============================================================================
// Bot Environment Variables Operations
// ============================================================================

export async function listBotEnvVars(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.botId) params.append('botId', args.botId.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/bot-env-vars${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getBotEnvVar(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/bot-env-vars/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createBotEnvVar(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/bot-env-vars', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateBotEnvVar(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/bot-env-vars/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteBotEnvVar(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/bot-env-vars/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Bot environment variable deleted successfully',
      },
    ],
  };
}

// ============================================================================
// Bot Env Var Sub-Endpoints (Values + Bots)
// ============================================================================

export async function getBotEnvVarValues(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/bot-env-vars/${args.id}/values${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getBotEnvVarBots(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/bot-env-vars/${args.id}/bots`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateBotEnvVarValue(apiClient: ApiClient, args: any): Promise<any> {
  const { valueId, ...data } = args;
  const response = await apiClient.put(`/v1/bot-env-vars/values/${valueId}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteBotEnvVarValue(apiClient: ApiClient, args: { valueId: number }): Promise<any> {
  await apiClient.delete(`/v1/bot-env-vars/values/${args.valueId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Bot environment variable value deleted successfully',
      },
    ],
  };
}

// ============================================================================
// Bot Tags Operations
// ============================================================================

export async function listBotTags(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/bots/${args.id}/tags`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function addBotTag(apiClient: ApiClient, args: { id: number; tagId: number }): Promise<any> {
  const response = await apiClient.post(`/v1/bots/${args.id}/tags`, { tagId: args.tagId });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function removeBotTag(apiClient: ApiClient, args: { id: number; tagId: number }): Promise<any> {
  await apiClient.delete(`/v1/bots/${args.id}/tags/${args.tagId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Tag removed from bot successfully',
      },
    ],
  };
}

export async function getBotMatches(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.search) params.append('search', args.search);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/bots/${args.id}/matches${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const botTools = [
  // Bot CRUD
  {
    name: 'list_bots',
    description: 'List all bots with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
        channelId: { type: 'number', description: 'Filter by channel ID' },
        status: { type: 'boolean', description: 'Filter by status (true=active, false=inactive)' },
      },
    },
  },
  {
    name: 'get_bot',
    description: 'Get a specific bot by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Bot ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_bot',
    description: 'Create a new bot',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'number', description: 'Channel ID to associate with this bot' },
        name: { type: 'string', description: 'Bot name' },
        response: { type: 'string', description: 'Bot response message' },
        status: { type: 'boolean', description: 'Bot status (true=active, false=inactive)' },
      },
      required: ['channelId', 'name', 'response'],
    },
  },
  {
    name: 'update_bot',
    description: 'Update an existing bot',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Bot ID' },
        name: { type: 'string', description: 'Bot name' },
        response: { type: 'string', description: 'Bot response message' },
        status: { type: 'boolean', description: 'Bot status' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_bot',
    description: 'Delete a bot by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Bot ID' },
      },
      required: ['id'],
    },
  },

  {
    name: 'get_bot_matches',
    description: 'Get bot match history (trigger events) with pagination and search',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Bot ID' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
        search: { type: 'string', description: 'Search in matches' },
      },
      required: ['id'],
    },
  },

  // Bot Filters
  {
    name: 'list_bot_filters',
    description: 'List all filters for a specific bot',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'number', description: 'Bot ID' },
      },
      required: ['botId'],
    },
  },
  {
    name: 'get_bot_filter',
    description: 'Get a specific bot filter',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'number', description: 'Bot ID' },
        filterId: { type: 'number', description: 'Filter ID' },
      },
      required: ['botId', 'filterId'],
    },
  },
  {
    name: 'create_bot_filter',
    description: 'Create a new filter for a bot',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'number', description: 'Bot ID' },
        filterObject: { type: 'string', description: 'Filter object type (message, recipient)' },
        filterAttribute: { type: 'string', description: 'Filter attribute (text, optin, daytime, weekdays)' },
        filterComparator: { type: 'string', description: 'Filter comparator (contains, equals, etc.)' },
        filterValue: { type: 'string', description: 'Filter value to match' },
      },
      required: ['botId', 'filterObject', 'filterAttribute', 'filterComparator', 'filterValue'],
    },
  },
  {
    name: 'update_bot_filter',
    description: 'Update an existing bot filter',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'number', description: 'Bot ID' },
        filterId: { type: 'number', description: 'Filter ID' },
        filterValue: { type: 'string', description: 'Filter value to match' },
      },
      required: ['botId', 'filterId'],
    },
  },
  {
    name: 'delete_bot_filter',
    description: 'Delete a bot filter',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'number', description: 'Bot ID' },
        filterId: { type: 'number', description: 'Filter ID' },
      },
      required: ['botId', 'filterId'],
    },
  },

  // Bot Environment Variables
  {
    name: 'list_bot_env_vars',
    description: 'List bot environment variables',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
        botId: { type: 'number', description: 'Filter by bot ID' },
      },
    },
  },
  {
    name: 'get_bot_env_var',
    description: 'Get a specific bot environment variable',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Environment variable ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_bot_env_var',
    description: 'Create a new bot environment variable',
    inputSchema: {
      type: 'object',
      properties: {
        botId: { type: 'number', description: 'Bot ID' },
        key: { type: 'string', description: 'Variable key/name' },
        value: { type: 'string', description: 'Variable value' },
      },
      required: ['botId', 'key', 'value'],
    },
  },
  {
    name: 'update_bot_env_var',
    description: 'Update a bot environment variable',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Environment variable ID' },
        value: { type: 'string', description: 'New variable value' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_bot_env_var',
    description: 'Delete a bot environment variable',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Environment variable ID' },
      },
      required: ['id'],
    },
  },

  // Bot Env Var Sub-Endpoints
  {
    name: 'get_bot_env_var_values',
    description: 'Get recipient-specific values for a bot environment variable',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Environment variable ID' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 20)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_bot_env_var_bots',
    description: 'Get bots using a specific environment variable',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Environment variable ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_bot_env_var_value',
    description: 'Update a recipient-specific environment variable value',
    inputSchema: {
      type: 'object',
      properties: {
        valueId: { type: 'number', description: 'Value ID' },
        value: { type: 'string', description: 'New value' },
        expiresAt: { type: 'string', description: 'Expiration date (ISO 8601)' },
      },
      required: ['valueId'],
    },
  },
  {
    name: 'delete_bot_env_var_value',
    description: 'Delete a recipient-specific environment variable value',
    inputSchema: {
      type: 'object',
      properties: {
        valueId: { type: 'number', description: 'Value ID' },
      },
      required: ['valueId'],
    },
  },

  // Bot Tags
  {
    name: 'list_bot_tags',
    description: 'List all tags assigned to a bot',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Bot ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_bot_tag',
    description: 'Add a tag to a bot',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Bot ID' },
        tagId: { type: 'number', description: 'Tag ID to add' },
      },
      required: ['id', 'tagId'],
    },
  },
  {
    name: 'remove_bot_tag',
    description: 'Remove a tag from a bot',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Bot ID' },
        tagId: { type: 'number', description: 'Tag ID to remove' },
      },
      required: ['id', 'tagId'],
    },
  },
];
