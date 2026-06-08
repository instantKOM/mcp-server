import type { ApiClient } from '@instantkom/api-client';

/**
 * Settings Tools
 * User and application settings
 */

export async function getSettings(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.get('/v1/settings');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateSettings(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.put('/v1/settings', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getSetting(apiClient: ApiClient, args: { key: string }): Promise<any> {
  const response = await apiClient.get(`/v1/settings/${args.key}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateSetting(apiClient: ApiClient, args: { key: string; value: any }): Promise<any> {
  const response = await apiClient.put(`/v1/settings/${args.key}`, { value: args.value });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const settingTools = [
  {
    name: 'get_settings',
    description: 'Get all user settings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_settings',
    description: 'Update multiple settings at once',
    inputSchema: {
      type: 'object',
      properties: {
        settings: {
          type: 'object',
          description: 'Settings object with key-value pairs',
        },
      },
      required: ['settings'],
    },
  },
  {
    name: 'get_setting',
    description: 'Get a specific setting by key',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Setting key' },
      },
      required: ['key'],
    },
  },
  {
    name: 'update_setting',
    description: 'Update a specific setting',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Setting key' },
        value: { description: 'Setting value (any type)' },
      },
      required: ['key', 'value'],
    },
  },
];
