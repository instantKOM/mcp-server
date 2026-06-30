/**
 * Public Tools - Health Check
 * No authentication required
 */

import type { ApiClient } from '@instantkom/api-client';

export async function getHealth(apiClient: ApiClient): Promise<any> {
  // /v1/health returns HTTP 503 when degraded/unhealthy (#4510); ApiClient.get
  // throws on non-2xx. A degraded API is a valid, reportable state -- not a
  // tool failure -- so surface the status instead of throwing.
  let payload: unknown;
  try {
    payload = await apiClient.get('/v1/health');
  } catch (error) {
    payload = {
      status: 'unavailable',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
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
