import type { ApiClient } from '@instantkom/api-client';

/**
 * Media Tools
 * Media file management and operations
 */

export async function getBroadcastMedia(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/media/broadcasts/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function downloadBroadcastMedia(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/media/broadcasts/${args.id}/download`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getBroadcastMediaThumbnail(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/media/broadcasts/${args.id}/thumbnail`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteBroadcastMedia(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/media/broadcasts/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Newsletter media deleted successfully',
      },
    ],
  };
}

export async function getMessageMedia(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/media/messages/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function downloadMessageMedia(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/media/messages/${args.id}/download`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getMessageMediaThumbnail(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/media/messages/${args.id}/thumbnail`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteMessageMedia(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/media/messages/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Message media deleted successfully',
      },
    ],
  };
}

export const mediaTools = [
  {
    name: 'get_broadcast_media',
    description: 'Get newsletter media information',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Newsletter ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'download_broadcast_media',
    description: 'Download newsletter media file',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Newsletter ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_broadcast_media_thumbnail',
    description: 'Get newsletter media thumbnail',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Newsletter ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_broadcast_media',
    description: 'Delete newsletter media',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Newsletter ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_message_media',
    description: 'Get message media information',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Message ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'download_message_media',
    description: 'Download message media file',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Message ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_message_media_thumbnail',
    description: 'Get message media thumbnail',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Message ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_message_media',
    description: 'Delete message media',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Message ID' },
      },
      required: ['id'],
    },
  },
];
