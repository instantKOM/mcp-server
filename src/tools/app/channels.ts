/**
 * App Tools - Channels CRUD Operations
 */

import type { ApiClient } from '@instantkom/api-client';
import type { Channel, PaginationParams } from '../../types/index.js';

export async function listChannels(
  apiClient: ApiClient,
  args: PaginationParams
): Promise<any> {
  const response = await apiClient.get<Channel[]>('/v1/channels', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getChannel(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get<Channel>(`/v1/channels/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createChannel(
  apiClient: ApiClient,
  args: Partial<Channel>
): Promise<any> {
  const response = await apiClient.post<Channel>('/v1/channels', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateChannel(
  apiClient: ApiClient,
  args: { id: number } & Partial<Channel>
): Promise<any> {
  const { id, ...updateData } = args;
  const response = await apiClient.put<Channel>(`/v1/channels/${id}`, updateData);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getChannelsKpis(apiClient: ApiClient, _args: any): Promise<any> {
  const response = await apiClient.get<any>('/v1/channels/kpis');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getChannelKpis(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get<any>(`/v1/channels/${args.id}/kpis`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const channelTools = [
  {
    name: 'list_channels',
    description: 'List all channels with optional pagination',
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
      required: [],
    },
  },
  {
    name: 'get_channels_kpis',
    description: 'Get aggregated KPIs across all messaging channels',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_channel_kpis',
    description: 'Get KPIs for a specific channel including contacts, messages, newsletters, and engagement metrics',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Channel ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_channel',
    description: 'Get a specific channel by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Channel ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_channel',
    description: 'Create a new messaging channel',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Channel name',
        },
        gatewayType: {
          type: 'number',
          description: 'Gateway type (1=Telegram, 2=WhatsApp, etc.)',
        },
        status: {
          type: 'string',
          description: 'Channel status (active/inactive)',
          enum: ['active', 'inactive'],
        },
      },
      required: ['name', 'gatewayType'],
    },
  },
  {
    name: 'update_channel',
    description: 'Update an existing channel',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Channel ID',
        },
        name: {
          type: 'string',
          description: 'Channel name',
        },
        status: {
          type: 'string',
          description: 'Channel status',
          enum: ['active', 'inactive'],
        },
      },
      required: ['id'],
    },
  },
];
