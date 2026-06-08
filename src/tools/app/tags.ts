import type { ApiClient } from '@instantkom/api-client';

/**
 * Tags Tools
 * CRUD operations for tags and tag assignments
 */

export async function listTags(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.search) params.append('search', args.search);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/tags${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getTag(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/tags/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createTag(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/tags', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateTag(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/tags/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteTag(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/tags/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Tag deleted successfully',
      },
    ],
  };
}

export async function assignTagToRecipients(apiClient: ApiClient, args: any): Promise<any> {
  const { id, recipientIds } = args;
  const response = await apiClient.post(`/v1/tags/${id}/recipients`, { recipientIds });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function removeTagFromRecipients(apiClient: ApiClient, args: any): Promise<any> {
  const { id, recipientIds } = args;
  const response = await apiClient.delete(`/v1/tags/${id}/recipients`, { recipientIds });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function exportTags(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.format) params.append('format', args.format);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/tags/export/download${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function validateTagsImport(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/tags/import/validate', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function importTags(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/tags/import', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getContactTags(apiClient: ApiClient, args: { contactId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/contacts/${args.contactId}/tags`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function addContactTag(apiClient: ApiClient, args: { contactId: number; tagId: number }): Promise<any> {
  const response = await apiClient.post(`/v1/contacts/${args.contactId}/tags`, { tagId: args.tagId });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function removeContactTag(apiClient: ApiClient, args: { contactId: number; tagId: number }): Promise<any> {
  await apiClient.delete(`/v1/contacts/${args.contactId}/tags/${args.tagId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Tag removed from contact successfully',
      },
    ],
  };
}

export const tagTools = [
  {
    name: 'list_tags',
    description: 'List all tags with optional search',
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
        search: {
          type: 'string',
          description: 'Search in tag name',
        },
      },
    },
  },
  {
    name: 'get_tag',
    description: 'Get a specific tag by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Tag ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_tag',
    description: 'Create a new tag',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Tag name',
        },
        color: {
          type: 'string',
          description: 'Tag color (hex code, e.g. #FF5733)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_tag',
    description: 'Update an existing tag',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Tag ID',
        },
        name: {
          type: 'string',
          description: 'Tag name',
        },
        color: {
          type: 'string',
          description: 'Tag color (hex code)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_tag',
    description: 'Delete a tag by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Tag ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'assign_tag_to_recipients',
    description: 'Assign a tag to multiple recipients (contacts)',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Tag ID',
        },
        recipientIds: {
          type: 'array',
          items: {
            type: 'number',
          },
          description: 'Array of recipient IDs to assign this tag to',
        },
      },
      required: ['id', 'recipientIds'],
    },
  },
  {
    name: 'export_tags',
    description: 'Export all tags to CSV or JSON format',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: 'Export format (csv or json)', enum: ['csv', 'json'] },
      },
    },
  },
  {
    name: 'validate_tags_import',
    description: 'Validate tags data before importing. Returns validation errors and duplicate count.',
    inputSchema: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'object' }, description: 'Array of tag objects to validate' },
      },
      required: ['tags'],
    },
  },
  {
    name: 'import_tags',
    description: 'Import tags from JSON data. Returns summary with imported count, skipped duplicates, and errors.',
    inputSchema: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'object' }, description: 'Array of tag objects to import' },
      },
      required: ['tags'],
    },
  },
  {
    name: 'get_contact_tags',
    description: 'Get all tags assigned to a specific contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact/Recipient ID' },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'add_contact_tag',
    description: 'Add a tag to a specific contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact/Recipient ID' },
        tagId: { type: 'number', description: 'Tag ID to add' },
      },
      required: ['contactId', 'tagId'],
    },
  },
  {
    name: 'remove_contact_tag',
    description: 'Remove a tag from a specific contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact/Recipient ID' },
        tagId: { type: 'number', description: 'Tag ID to remove' },
      },
      required: ['contactId', 'tagId'],
    },
  },
  {
    name: 'remove_tag_from_recipients',
    description: 'Remove a tag from multiple recipients (contacts)',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Tag ID',
        },
        recipientIds: {
          type: 'array',
          items: {
            type: 'number',
          },
          description: 'Array of recipient IDs to remove this tag from',
        },
      },
      required: ['id', 'recipientIds'],
    },
  },
];
