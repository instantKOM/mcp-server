import type { ApiClient } from '@instantkom/api-client';

/**
 * Dashboard Tools
 * Dashboard overview statistics
 *
 * NOTE: Dashboard widget CRUD is in dashboard-widgets.ts
 * This file provides the dashboard overview endpoint.
 */

export async function getDashboardStats(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.get('/v1/dashboard');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const dashboardTools = [
  {
    name: 'get_dashboard_stats',
    description: 'Get dashboard overview with widgets and widget types',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
