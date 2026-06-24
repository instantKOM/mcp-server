/**
 * App Tools - Messages Operations
 */

import type { ApiClient } from '@instantkom/api-client';
import type { Message, PaginationParams } from '../../types/index.js';

export async function listMessages(
  apiClient: ApiClient,
  args: PaginationParams & { channelId?: number; contactId?: number }
): Promise<any> {
  const response = await apiClient.get<Message[]>('/v1/messages', args);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getMessage(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get<Message>(`/v1/messages/${args.id}`);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function sendMessage(
  apiClient: ApiClient,
  args: {
    recipientId: number;
    message: string;
    messageType: string;
    templateId?: number;
    buttons?: any;
    headerFooter?: any;
    isLocked?: boolean;
  }
): Promise<any> {
  const response = await apiClient.post<Message>('/v1/messages', args);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateMessage(
  apiClient: ApiClient,
  args: {
    id: number;
    message?: string;
    messageType?: string;
    buttons?: any;
    headerFooter?: any;
    isLocked?: boolean;
  }
): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put<Message>(`/v1/messages/${id}`, data);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteMessage(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/messages/${args.id}`);


  return {
    content: [
      {
        type: 'text',
        text: 'Message deleted successfully',
      },
    ],
  };
}

export async function getInboxUnreadCount(apiClient: ApiClient, _args: any): Promise<any> {
  const response = await apiClient.get<any>('/v1/messages/inbox/unread-count');


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function bulkSpamMessages(
  apiClient: ApiClient,
  args: { messageIds: number[]; spam: boolean }
): Promise<any> {
  const response = await apiClient.put<any>('/v1/messages/bulk/spam', args);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function markMessageSpam(
  apiClient: ApiClient,
  args: { id: number; spam: boolean }
): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put<any>(`/v1/messages/${id}/spam`, data);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createTicketFromMessage(
  apiClient: ApiClient,
  args: { id: number; subject?: string; priority?: string; assignedTo?: number }
): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.post<any>(`/v1/messages/${id}/create-ticket`, data);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getMessageReactions(
  apiClient: ApiClient,
  args: { id: number; page?: number; limit?: number }
): Promise<any> {
  const params: Record<string, any> = {};
  if (args.page) params.page = args.page;
  if (args.limit) params.limit = args.limit;

  const response = await apiClient.get<any>(`/v1/messages/${args.id}/reactions`, params);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const messageTools = [
  {
    name: 'list_messages',
    description: 'List messages with optional filtering by channel and contact',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'number',
          description: 'Filter by channel ID',
        },
        contactId: {
          type: 'number',
          description: 'Filter by contact ID',
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
    name: 'get_message',
    description: 'Get a specific message by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Message ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'send_message',
    description:
      'Send a message to a contact via a channel. Pass templateId to send an approved WhatsApp template (bypasses 24h messaging window).',
    inputSchema: {
      type: 'object',
      properties: {
        recipientId: {
          type: 'number',
          description: 'Recipient ID',
        },
        message: {
          type: 'string',
          description: 'Message content (max 4096 characters)',
        },
        messageType: {
          type: 'string',
          description: 'Message type',
          enum: ['text', 'image', 'video', 'audio', 'document'],
        },
        templateId: {
          type: 'number',
          description:
            'Optional WhatsApp template ID. When set, the message is sent as an approved template, bypassing the 24-hour messaging window. Must be active (status=3) and belong to the same channel as the recipient.',
        },
        buttons: {
          type: 'array',
          description: 'Content buttons (JSON array)',
        },
        headerFooter: {
          type: 'object',
          description: 'Header/Footer content (JSON object)',
        },
        isLocked: {
          type: 'boolean',
          description: 'Whether the message should be locked',
        },
      },
      required: ['recipientId', 'message', 'messageType'],
    },
  },
  {
    name: 'update_message',
    description: 'Update an existing message',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Message ID',
        },
        message: {
          type: 'string',
          description: 'Message content (max 4096 characters)',
        },
        messageType: {
          type: 'string',
          description: 'Message type',
          enum: ['text', 'image', 'video', 'audio', 'document'],
        },
        buttons: {
          type: 'array',
          description: 'Content buttons (JSON array)',
        },
        headerFooter: {
          type: 'object',
          description: 'Header/Footer content (JSON object)',
        },
        isLocked: {
          type: 'boolean',
          description: 'Whether the message should be locked',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_message',
    description: 'Delete a message',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Message ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_inbox_unread_count',
    description: 'Get the total number of unread received messages (inbox)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'bulk_spam_messages',
    description: 'Bulk mark or unmark messages as spam (max 100 per request)',
    inputSchema: {
      type: 'object',
      properties: {
        messageIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of message IDs to update',
        },
        spam: {
          type: 'boolean',
          description: 'Set to true to mark as spam, false to unmark',
        },
      },
      required: ['messageIds', 'spam'],
    },
  },
  {
    name: 'mark_message_spam',
    description: 'Mark or unmark a single message as spam',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Message ID',
        },
        spam: {
          type: 'boolean',
          description: 'Set to true to mark as spam, false to unmark',
        },
      },
      required: ['id', 'spam'],
    },
  },
  {
    name: 'create_ticket_from_message',
    description: 'Convert an inbox message into a support ticket',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Message ID',
        },
        subject: {
          type: 'string',
          description: 'Ticket subject (optional)',
        },
        priority: {
          type: 'string',
          description: 'Ticket priority (low, normal, high, urgent)',
        },
        assignedTo: {
          type: 'number',
          description: 'Team member ID to assign the ticket to',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_message_reactions',
    description: 'Get all reply messages (reactions) to a specific message',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Message ID',
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
      required: ['id'],
    },
  },
];
