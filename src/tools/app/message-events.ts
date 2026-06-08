import type { ApiClient } from '@instantkom/api-client';

/**
 * Message Events Tools
 * Message delivery and interaction event tracking
 */

export async function listMessageEvents(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.channelId) params.append('channelId', args.channelId.toString());
  if (args.recipientId) params.append('recipientId', args.recipientId.toString());
  if (args.eventType) params.append('eventType', args.eventType);
  if (args.referenceType) params.append('referenceType', args.referenceType);
  if (args.referenceId) params.append('referenceId', args.referenceId.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/message-events${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getMessageEvent(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/message-events/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const messageEventTools = [
  {
    name: 'list_message_events',
    description: 'List message delivery and interaction events with optional filters. Tracks sent, delivered, read, clicked, received, and queued states.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 50)' },
        channelId: { type: 'number', description: 'Filter by channel ID' },
        recipientId: { type: 'number', description: 'Filter by recipient ID' },
        eventType: { type: 'string', description: 'Filter by event type (sent, delivered, read, clicked, received, queued)' },
        referenceType: { type: 'string', description: 'Filter by reference type (message, broadcast, story, post)' },
        referenceId: { type: 'number', description: 'Filter by reference ID' },
      },
    },
  },
  {
    name: 'get_message_event',
    description: 'Get a specific message event by ID with full details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Message event ID' },
      },
      required: ['id'],
    },
  },
];
