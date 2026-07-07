/**
 * App Tools - Broadcasts CRUD Operations
 */

import type { ApiClient } from '@instantkom/api-client';
import type { Broadcast, PaginationParams } from '../../types/index.js';

export async function listBroadcasts(
  apiClient: ApiClient,
  args: PaginationParams & { channelId?: number }
): Promise<any> {
  const response = await apiClient.get<Broadcast[]>('/v1/broadcasts', args);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getBroadcast(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get<Broadcast>(`/v1/broadcasts/${args.id}`);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createBroadcast(
  apiClient: ApiClient,
  args: Partial<Broadcast>
): Promise<any> {
  const response = await apiClient.post<Broadcast>('/v1/broadcasts', args);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateBroadcast(
  apiClient: ApiClient,
  args: {
    id: number;
    channelId?: number;
    message?: string;
    broadcastType?: string;
    scheduledAt?: number;
    sendStatus?: number;
    test?: boolean;
    autoApprove?: boolean;
  }
): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/broadcasts/${id}`, data);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function sendBroadcast(
  apiClient: ApiClient,
  args: { id: number }
): Promise<any> {
  const response = await apiClient.post(`/v1/broadcasts/${args.id}/send`, {});


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteBroadcast(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/broadcasts/${args.id}`);


  return {
    content: [
      {
        type: 'text',
        text: 'Newsletter deleted successfully',
      },
    ],
  };
}

export const broadcastTools = [
  {
    name: 'list_broadcasts',
    description: 'List all newsletters with optional filtering by channel',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'number',
          description: 'Filter by channel ID',
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Items per page (default: 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_broadcast',
    description: 'Get a specific newsletter by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Newsletter ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_broadcast',
    description: 'Create a new newsletter campaign',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'number',
          description: 'Channel ID to send through',
        },
        message: {
          type: 'string',
          description: 'Newsletter message content (max 4096 characters)',
        },
        broadcastType: {
          type: 'string',
          description: 'Newsletter type (default: text)',
          enum: ['text', 'image', 'video', 'audio', 'document'],
        },
        scheduledAt: {
          type: 'number',
          description: 'Schedule newsletter for future send (Unix timestamp)',
        },
        test: {
          type: 'boolean',
          description: 'Test newsletter flag',
        },
        autoApprove: {
          type: 'boolean',
          description: 'Auto-approve newsletter (requires permission)',
        },
        sendStatus: {
          type: 'number',
          description: 'Send status (0=draft, 1=pending, 2=processing, 3=sent, 4=failed)',
        },
      },
      required: ['channelId', 'message'],
    },
  },
  {
    name: 'update_broadcast',
    description: 'Update an existing newsletter',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Newsletter ID',
        },
        channelId: {
          type: 'number',
          description: 'Channel ID to send through',
        },
        message: {
          type: 'string',
          description: 'Newsletter message content (max 4096 characters)',
        },
        broadcastType: {
          type: 'string',
          description: 'Newsletter type',
          enum: ['text', 'image', 'video', 'audio', 'document'],
        },
        scheduledAt: {
          type: 'number',
          description: 'Schedule newsletter for future send (Unix timestamp)',
        },
        test: {
          type: 'boolean',
          description: 'Test newsletter flag',
        },
        autoApprove: {
          type: 'boolean',
          description: 'Auto-approve newsletter (requires permission)',
        },
        sendStatus: {
          type: 'number',
          description: 'Send status (0=draft, 1=pending, 2=processing, 3=sent, 4=failed)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'send_broadcast',
    description: 'Send a newsletter immediately',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Newsletter ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_broadcast',
    description: 'Delete a newsletter by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Newsletter ID',
        },
      },
      required: ['id'],
    },
  },
];
