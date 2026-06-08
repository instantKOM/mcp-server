import type { ApiClient } from '@instantkom/api-client';

/**
 * Flows Tools
 * CRUD operations for visual bot workflow orchestration
 */

export async function listFlows(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.search) params.append('search', args.search);
  if (args.channelId) params.append('channelId', args.channelId.toString());
  if (args.status) params.append('status', args.status);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/flows${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getFlow(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/flows/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createFlow(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/flows', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateFlow(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/flows/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteFlow(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/flows/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Flow deleted successfully',
      },
    ],
  };
}

export const flowTools = [
  {
    name: 'list_flows',
    description: 'List all flows with optional filters for channel, status, and search',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 20)' },
        search: { type: 'string', description: 'Search by name or description' },
        channelId: { type: 'number', description: 'Filter by channel ID' },
        status: { type: 'string', description: 'Filter by status' },
      },
    },
  },
  {
    name: 'get_flow',
    description: 'Get a specific flow by ID including all nodes and edges',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Flow ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_flow',
    description: 'Create a new flow for orchestrating bots in a visual workflow',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Flow name' },
        description: { type: 'string', description: 'Flow description' },
        channelId: { type: 'number', description: 'Channel ID the flow belongs to' },
        color: { type: 'string', description: 'Flow color (hex)' },
        status: { type: 'string', description: 'Flow status' },
      },
      required: ['name', 'channelId'],
    },
  },
  {
    name: 'update_flow',
    description: 'Update flow properties like name, description, color, or status',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Flow ID' },
        name: { type: 'string', description: 'Flow name' },
        description: { type: 'string', description: 'Flow description' },
        color: { type: 'string', description: 'Flow color (hex)' },
        status: { type: 'string', description: 'Flow status' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_flow',
    description: 'Delete a flow and all its nodes and edges. Referenced bots are not deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Flow ID' },
      },
      required: ['id'],
    },
  },
];
