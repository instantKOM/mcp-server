import type { ApiClient } from '@instantkom/api-client';

/**
 * Analytics Tools
 * User analytics and statistics
 */

export async function getAnalytics(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.startDate) params.append('startDate', args.startDate);
  if (args.endDate) params.append('endDate', args.endDate);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/analytics${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getAnalyticsDetail(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.startDate) params.append('startDate', args.startDate);
  if (args.endDate) params.append('endDate', args.endDate);
  if (args.channelId) params.append('channelId', args.channelId.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/analytics/${args.type}${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getMessagesAnalytics(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.startDate) params.append('startDate', args.startDate);
  if (args.endDate) params.append('endDate', args.endDate);
  if (args.channelId) params.append('channelId', args.channelId.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/analytics/messages${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getBroadcastsAnalytics(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.startDate) params.append('startDate', args.startDate);
  if (args.endDate) params.append('endDate', args.endDate);
  if (args.channelId) params.append('channelId', args.channelId.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/analytics/broadcasts${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getContactsAnalytics(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.startDate) params.append('startDate', args.startDate);
  if (args.endDate) params.append('endDate', args.endDate);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/analytics/contacts${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const analyticsTools = [
  {
    name: 'get_analytics',
    description: 'Get overall analytics overview with all key metrics',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'get_analytics_detail',
    description: 'Get detailed analytics for a specific type (messages, broadcasts, contacts, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Analytics type (messages, broadcasts, contacts)' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        channelId: { type: 'number', description: 'Filter by channel ID' },
      },
      required: ['type'],
    },
  },
  {
    name: 'get_messages_analytics',
    description: 'Get messages analytics and statistics',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        channelId: { type: 'number', description: 'Filter by channel ID' },
      },
    },
  },
  {
    name: 'get_broadcasts_analytics',
    description: 'Get broadcasts analytics and campaign performance',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        channelId: { type: 'number', description: 'Filter by channel ID' },
      },
    },
  },
  {
    name: 'get_contacts_analytics',
    description: 'Get contacts growth and engagement analytics',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
    },
  },
];
