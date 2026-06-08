import type { ApiClient } from '@instantkom/api-client';

/**
 * Account Tools
 * Account management and user profile operations
 */

export async function getAccount(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.get('/v1/account');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateAccount(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.put('/v1/account', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteAccount(apiClient: ApiClient): Promise<any> {
  await apiClient.delete('/v1/account');

  return {
    content: [
      {
        type: 'text',
        text: 'Account deleted successfully',
      },
    ],
  };
}

export const accountTools = [
  {
    name: 'get_account',
    description: 'Get current user account information',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_account',
    description: 'Update account information',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address' },
        name: { type: 'string', description: 'Full name' },
        company: { type: 'string', description: 'Company name' },
        phone: { type: 'string', description: 'Phone number' },
      },
    },
  },
  {
    name: 'delete_account',
    description: 'Delete the current user account (irreversible)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
