import type { ApiClient } from '@instantkom/api-client';

/**
 * Feeds Tools
 * CRUD operations for RSS/Atom feed monitoring and automation
 */

export async function listFeeds(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/feeds${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getFeed(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/feeds/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createFeed(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/feeds', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateFeed(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/feeds/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteFeed(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/feeds/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Feed deleted successfully',
      },
    ],
  };
}

export const feedTools = [
  {
    name: 'list_feeds',
    description: 'List all RSS/Atom feeds',
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
    name: 'get_feed',
    description: 'Get a specific feed by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Feed ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_feed',
    description: 'Create a new RSS/Atom feed monitor',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Feed URL',
        },
        name: {
          type: 'string',
          description: 'Feed name',
        },
        channelId: {
          type: 'number',
          description: 'Channel ID to post feed updates to',
        },
        interval: {
          type: 'number',
          description: 'Check interval in minutes',
        },
      },
      required: ['url', 'name', 'channelId'],
    },
  },
  {
    name: 'update_feed',
    description: 'Update an existing feed',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Feed ID',
        },
        url: {
          type: 'string',
          description: 'Feed URL',
        },
        name: {
          type: 'string',
          description: 'Feed name',
        },
        interval: {
          type: 'number',
          description: 'Check interval in minutes',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_feed',
    description: 'Delete a feed by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Feed ID',
        },
      },
      required: ['id'],
    },
  },
];
