import type { ApiClient } from '@instantkom/api-client';

/**
 * REST Hooks Tools
 * Dynamic webhook subscription management for native Zapier/Make apps.
 */

export async function subscribeWebhook(apiClient: ApiClient, args: { event: string; target_url: string }): Promise<any> {
  const response = await apiClient.post('/v1/webhooks/subscribe', {
    event: args.event,
    target_url: args.target_url,
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function listWebhookSubscriptions(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.get('/v1/webhooks/subscriptions');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function unsubscribeWebhook(apiClient: ApiClient, args: { id: string }): Promise<any> {
  const response = await apiClient.delete(`/v1/webhooks/subscribe/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const webhookTools = [
  {
    name: 'subscribe_webhook',
    description: 'Subscribe to a webhook event. Returns a one-time HMAC secret — store it immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        event: {
          type: 'string',
          description: 'Event type to subscribe to (e.g. new_contact, new_message, broadcast_sent, contact_updated, contact_opted_out)',
          enum: ['new_contact', 'new_message', 'broadcast_sent', 'contact_updated', 'contact_opted_out'],
        },
        target_url: {
          type: 'string',
          description: 'HTTPS URL that receives the webhook POST (max 500 chars)',
        },
      },
      required: ['event', 'target_url'],
    },
  },
  {
    name: 'list_webhook_subscriptions',
    description: 'List all active webhook subscriptions for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'unsubscribe_webhook',
    description: 'Delete a webhook subscription by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Subscription UUID',
        },
      },
      required: ['id'],
    },
  },
];
