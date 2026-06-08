import type { ApiClient } from '@instantkom/api-client';

/**
 * Plans Tools
 * Subscription plans and pricing
 */

export async function listPlans(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.get('/v1/plans');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getPlan(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/plans/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function subscribeToPlan(apiClient: ApiClient, args: { planId: number }): Promise<any> {
  const response = await apiClient.post('/v1/plans/subscribe', { planId: args.planId });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const planTools = [
  {
    name: 'list_plans',
    description: 'List all available subscription plans',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_plan',
    description: 'Get details of a specific plan',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Plan ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'subscribe_to_plan',
    description: 'Subscribe to a plan',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'number', description: 'Plan ID to subscribe to' },
      },
      required: ['planId'],
    },
  },
];
