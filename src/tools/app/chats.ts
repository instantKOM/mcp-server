import type { ApiClient } from '@instantkom/api-client';

/**
 * Chats Tools
 * Operations for chat management and messaging
 */

export async function listChats(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.channelId) params.append('channelId', args.channelId.toString());
  if (args.status) params.append('status', args.status);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/chats${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getChat(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/chats/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function markChatAsRead(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.put(`/v1/chats/${args.id}/read`, {});

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function sendChatMessage(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.post(`/v1/chats/${id}/messages`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteChat(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/chats/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Chat deleted successfully',
      },
    ],
  };
}

export const chatTools = [
  {
    name: 'list_chats',
    description: 'List all chats with optional filters',
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
        channelId: {
          type: 'number',
          description: 'Filter by channel ID',
        },
        status: {
          type: 'string',
          description: 'Filter by status (open, closed)',
        },
      },
    },
  },
  {
    name: 'get_chat',
    description: 'Get a specific chat by ID with message history',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Chat ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'mark_chat_as_read',
    description: 'Mark a chat as read',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Chat ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'send_chat_message',
    description: 'Send a message in a chat',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Chat ID',
        },
        message: {
          type: 'string',
          description: 'Message text',
        },
        messageType: {
          type: 'string',
          description: 'Message type (text, image, video, audio, document)',
        },
      },
      required: ['id', 'message', 'messageType'],
    },
  },
  {
    name: 'delete_chat',
    description: 'Delete a chat by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Chat ID',
        },
      },
      required: ['id'],
    },
  },
];
