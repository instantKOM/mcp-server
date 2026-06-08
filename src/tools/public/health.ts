/**
 * Public Tools - Health Check
 * No authentication required
 */

import type { ApiClient } from '@instantkom/api-client';

export async function getHealth(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.get('/v1/health');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const healthTools = [
  {
    name: 'get_health',
    description: 'Get API health status and uptime information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
