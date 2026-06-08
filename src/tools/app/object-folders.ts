import type { ApiClient } from '@instantkom/api-client';

/**
 * Object Folders Tools
 * Folder organization for objects
 */

export async function listObjectFolders(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.type) params.append('type', args.type);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/object-folders${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getObjectFolder(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/object-folders/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createObjectFolder(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/object-folders', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateObjectFolder(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/object-folders/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteObjectFolder(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/object-folders/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Object folder deleted successfully',
      },
    ],
  };
}

export const objectFolderTools = [
  {
    name: 'list_object_folders',
    description: 'List all object folders',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter by object type' },
      },
    },
  },
  {
    name: 'get_object_folder',
    description: 'Get a specific folder by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Folder ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_object_folder',
    description: 'Create a new object folder',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Folder name' },
        type: { type: 'string', description: 'Object type' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'update_object_folder',
    description: 'Update an existing folder',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Folder ID' },
        name: { type: 'string', description: 'Folder name' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_object_folder',
    description: 'Delete a folder',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Folder ID' },
      },
      required: ['id'],
    },
  },
];
