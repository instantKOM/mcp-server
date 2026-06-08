import type { ApiClient } from '@instantkom/api-client';

/**
 * Events Tools
 * Event stream and real-time updates
 */

export async function getEventStream(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.types) params.append('types', args.types.join(','));
  if (args.since) params.append('since', args.since);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/events${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getMessageEvents(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.messageId) params.append('messageId', args.messageId.toString());
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

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

export const eventTools = [
  {
    name: 'get_event_stream',
    description: 'Get event stream with real-time updates',
    inputSchema: {
      type: 'object',
      properties: {
        types: { type: 'array', items: { type: 'string' }, description: 'Event types to filter' },
        since: { type: 'string', description: 'Get events since this timestamp' },
      },
    },
  },
  {
    name: 'get_message_events',
    description: 'Get message delivery events and status updates',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'number', description: 'Filter by message ID' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
      },
    },
  },
];
