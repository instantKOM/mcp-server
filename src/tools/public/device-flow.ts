/**
 * Public Tools - Device Authorization Flow (RFC 8628)
 * No authentication required for start/poll; JWT required for approve
 */

import type { ApiClient } from '@instantkom/api-client';

/**
 * Start a device authorization flow.
 * Returns device_code, user_code and verification_uri for the CLI auth flow.
 */
export async function startDeviceFlow(
  apiClient: ApiClient,
  args: { scope?: string },
): Promise<any> {
  const response = await apiClient.post('/v1/auth/device', {
    scope: args.scope ?? 'read',
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

/**
 * Poll for a device authorization token.
 * Returns access_token when approved, or an RFC 8628 error code otherwise.
 */
export async function pollDeviceToken(
  apiClient: ApiClient,
  args: { device_code: string },
): Promise<any> {
  const response = await apiClient.post('/v1/auth/device/token', {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: args.device_code,
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

/**
 * Approve or deny a device authorization request.
 * Requires JWT authentication (frontend session).
 */
export async function approveDeviceFlow(
  apiClient: ApiClient,
  args: { user_code: string; scope: string; action: 'approve' | 'deny' },
): Promise<any> {
  await apiClient.post('/v1/auth/device/approve', {
    user_code: args.user_code,
    scope: args.scope,
    action: args.action,
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true }, null, 2),
      },
    ],
  };
}

export const deviceFlowTools = [
  {
    name: 'start_device_flow',
    description:
      'Start an RFC 8628 device authorization flow. ' +
      'Returns device_code (for polling) and user_code (for the user to enter at verification_uri).',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['full', 'send', 'read', 'admin'],
          description: 'Requested token scope (default: read)',
        },
      },
      required: [],
    },
  },
  {
    name: 'poll_device_token',
    description:
      'Poll for a device authorization token after starting a device flow. ' +
      'Returns the access_token when approved, or an RFC 8628 error code.',
    inputSchema: {
      type: 'object',
      properties: {
        device_code: {
          type: 'string',
          description: 'Device code from the start_device_flow response',
        },
      },
      required: ['device_code'],
    },
  },
  {
    name: 'approve_device_flow',
    description:
      'Approve or deny a device authorization request (requires JWT authentication). ' +
      'Called by the frontend approval page.',
    inputSchema: {
      type: 'object',
      properties: {
        user_code: {
          type: 'string',
          description: 'User code displayed on the device',
        },
        scope: {
          type: 'string',
          enum: ['full', 'send', 'read', 'admin'],
          description: 'Scope to grant to the device token',
        },
        action: {
          type: 'string',
          enum: ['approve', 'deny'],
          description: 'Whether to approve or deny the request',
        },
      },
      required: ['user_code', 'scope', 'action'],
    },
  },
];
