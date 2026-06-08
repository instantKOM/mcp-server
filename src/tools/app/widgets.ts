import type { ApiClient } from '@instantkom/api-client';

/**
 * Widgets Tools
 * Widget and superwidget management
 */

export async function listWidgets(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/widgets${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getWidget(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/widgets/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createWidget(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/widgets', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateWidget(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/widgets/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteWidget(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/widgets/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Widget deleted successfully',
      },
    ],
  };
}

export const widgetTools = [
  {
    name: 'list_widgets',
    description: 'List all widgets',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
      },
    },
  },
  {
    name: 'get_widget',
    description: 'Get a specific widget by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Widget ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_widget',
    description: 'Create a new widget',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Widget name' },
        type: { type: 'string', description: 'Widget type' },
        config: { type: 'object', description: 'Widget configuration' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'update_widget',
    description: 'Update an existing widget',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Widget ID' },
        name: { type: 'string', description: 'Widget name' },
        config: { type: 'object', description: 'Widget configuration' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_widget',
    description: 'Delete a widget',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Widget ID' },
      },
      required: ['id'],
    },
  },
];
