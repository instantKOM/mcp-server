import type { ApiClient } from '@instantkom/api-client';

/**
 * Exports Tools
 * Data export operations
 */

export async function listExports(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/exports${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getExport(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/exports/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createExport(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/exports', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function downloadExport(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/exports/${args.id}/download`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteExport(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/exports/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Export deleted successfully',
      },
    ],
  };
}

export const exportTools = [
  {
    name: 'list_exports',
    description: 'List all data exports',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
      },
    },
  },
  {
    name: 'get_export',
    description: 'Get export status and details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Export ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_export',
    description: 'Create a new data export',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Export type (contacts, messages, broadcasts)' },
        format: { type: 'string', description: 'Export format (csv, json, xlsx)' },
        filters: { type: 'object', description: 'Optional filters' },
      },
      required: ['type', 'format'],
    },
  },
  {
    name: 'download_export',
    description: 'Download an export file',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Export ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_export',
    description: 'Delete an export',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Export ID' },
      },
      required: ['id'],
    },
  },
];
