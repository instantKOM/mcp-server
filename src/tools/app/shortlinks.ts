import type { ApiClient } from '@instantkom/api-client';

/**
 * ShortLinks Tools
 * CRUD operations for URL shortening and click tracking
 */

export async function listShortLinks(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/short-links${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getShortLink(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/short-links/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createShortLink(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/short-links', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateShortLink(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/short-links/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteShortLink(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/short-links/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Short link deleted successfully',
      },
    ],
  };
}

export const shortLinkTools = [
  {
    name: 'list_short_links',
    description: 'List all short links with click statistics',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Items per page (default: 10)',
        },
      },
    },
  },
  {
    name: 'get_short_link',
    description: 'Get a specific short link by ID with click statistics',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Short link ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_short_link',
    description: 'Create a new short link',
    inputSchema: {
      type: 'object',
      properties: {
        originalUrl: {
          type: 'string',
          description: 'Original/destination URL to shorten',
        },
        referenceType: {
          type: 'string',
          description: 'Reference type (b=broadcast, m=message, o=other)',
        },
        referenceId: {
          type: 'number',
          description: 'Reference ID (broadcast ID, message ID, etc.)',
        },
        folderId: {
          type: 'number',
          description: 'Object folder ID (optional)',
        },
      },
      required: ['originalUrl'],
    },
  },
  {
    name: 'update_short_link',
    description: 'Update an existing short link',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Short link ID',
        },
        originalUrl: {
          type: 'string',
          description: 'Original/destination URL',
        },
        folderId: {
          type: 'number',
          description: 'Object folder ID (optional)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_short_link',
    description: 'Delete a short link by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Short link ID',
        },
      },
      required: ['id'],
    },
  },
];
