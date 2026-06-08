import type { ApiClient } from '@instantkom/api-client';

/**
 * Users Tools
 * User management operations
 */

export async function getCurrentUser(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.get('/v1/users/me');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateCurrentUser(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.put('/v1/users/me', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function changePassword(apiClient: ApiClient, args: { currentPassword: string; newPassword: string }): Promise<any> {
  const response = await apiClient.post('/v1/users/change-password', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const userTools = [
  {
    name: 'get_current_user',
    description: 'Get current user profile',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_current_user',
    description: 'Update current user profile',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
      },
    },
  },
  {
    name: 'change_password',
    description: 'Change user password',
    inputSchema: {
      type: 'object',
      properties: {
        currentPassword: { type: 'string', description: 'Current password' },
        newPassword: { type: 'string', description: 'New password' },
      },
      required: ['currentPassword', 'newPassword'],
    },
  },
];
