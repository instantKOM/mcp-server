import type { ApiClient } from '@instantkom/api-client';

/**
 * Super Widgets Tools
 * CRUD operations for SuperWidgets that combine multiple channel widgets
 */

export async function listSuperWidgets(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.search) params.append('search', args.search);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/super-widgets${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getSuperWidget(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/super-widgets/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createSuperWidget(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/super-widgets', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateSuperWidget(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/super-widgets/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteSuperWidget(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/super-widgets/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'SuperWidget deleted successfully',
      },
    ],
  };
}

export const superWidgetTools = [
  {
    name: 'list_super_widgets',
    description: 'List all SuperWidgets with optional search by name',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search by name' },
      },
    },
  },
  {
    name: 'get_super_widget',
    description: 'Get a specific SuperWidget by ID including linked widgets',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Super Widget ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_super_widget',
    description: 'Create a SuperWidget that combines multiple channel widgets into a single interface',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'SuperWidget name' },
        widgetIds: { type: 'array', items: { type: 'number' }, description: 'Array of widget IDs to combine' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_super_widget',
    description: 'Update SuperWidget configuration and linked widgets',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Super Widget ID' },
        name: { type: 'string', description: 'SuperWidget name' },
        widgetIds: { type: 'array', items: { type: 'number' }, description: 'Array of widget IDs to combine' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_super_widget',
    description: 'Delete a SuperWidget by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Super Widget ID' },
      },
      required: ['id'],
    },
  },
];
