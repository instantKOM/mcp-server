import type { ApiClient } from '@instantkom/api-client';

/**
 * Segmentations Tools
 * CRUD operations for contact segmentations and filters
 */

export async function listSegmentations(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/segments${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getSegmentation(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/segments/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createSegmentation(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/segments', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateSegmentation(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/segments/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteSegmentation(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/segments/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Segmentation deleted successfully',
      },
    ],
  };
}

export async function listSegmentationTags(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/segments/${args.id}/tags`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function addSegmentationTag(apiClient: ApiClient, args: { id: number; tagId: number }): Promise<any> {
  const response = await apiClient.post(`/v1/segments/${args.id}/tags`, { tagId: args.tagId });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function removeSegmentationTag(apiClient: ApiClient, args: { id: number; tagId: number }): Promise<any> {
  await apiClient.delete(`/v1/segments/${args.id}/tags/${args.tagId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Tag removed from segmentation successfully',
      },
    ],
  };
}

export const segmentationTools = [
  {
    name: 'list_segmentations',
    description: 'List all contact segmentations',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Items per page (default: 10)',
        },
      },
    },
  },
  {
    name: 'get_segmentation',
    description: 'Get a specific segmentation by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Segmentation ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_segmentation',
    description: 'Create a new contact segmentation',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Segmentation name',
        },
        description: {
          type: 'string',
          description: 'Segmentation description',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_segmentation',
    description: 'Update an existing segmentation',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Segmentation ID',
        },
        name: {
          type: 'string',
          description: 'Segmentation name',
        },
        description: {
          type: 'string',
          description: 'Segmentation description',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_segmentation',
    description: 'Delete a segmentation by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Segmentation ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_segmentation_tags',
    description: 'List all tags for a segmentation',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Segmentation ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_segmentation_tag',
    description: 'Add a tag to a segmentation',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Segmentation ID',
        },
        tagId: {
          type: 'number',
          description: 'Tag ID to add',
        },
      },
      required: ['id', 'tagId'],
    },
  },
  {
    name: 'remove_segmentation_tag',
    description: 'Remove a tag from a segmentation',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Segmentation ID',
        },
        tagId: {
          type: 'number',
          description: 'Tag ID to remove',
        },
      },
      required: ['id', 'tagId'],
    },
  },
];
