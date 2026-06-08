import type { ApiClient } from '@instantkom/api-client';

/**
 * Templates Tools
 * CRUD operations for message templates
 */

export async function listTemplates(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.channelId) params.append('channelId', args.channelId.toString());
  if (args.templateType) params.append('templateType', args.templateType);
  if (args.search) params.append('search', args.search);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/templates${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getTemplate(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/templates/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createTemplate(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/templates', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateTemplate(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/templates/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteTemplate(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/templates/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Template deleted successfully',
      },
    ],
  };
}

export async function exportTemplates(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.format) params.append('format', args.format);
  if (args.channelId) params.append('channelId', args.channelId.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/templates/export/download${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function validateTemplatesImport(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/templates/import/validate', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function importTemplates(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/templates/import', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const templateTools = [
  {
    name: 'list_templates',
    description: 'List all message templates with optional filters',
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
        channelId: {
          type: 'number',
          description: 'Filter by channel ID',
        },
        templateType: {
          type: 'string',
          description: 'Filter by template type (text, image, video, audio, document)',
        },
        search: {
          type: 'string',
          description: 'Search in template name and content',
        },
      },
    },
  },
  {
    name: 'get_template',
    description: 'Get a specific template by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Template ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_template',
    description: 'Create a new message template',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'number',
          description: 'Channel ID to associate with this template',
        },
        name: {
          type: 'string',
          description: 'Template name',
        },
        message: {
          type: 'string',
          description: 'Template message content',
        },
        templateType: {
          type: 'string',
          description: 'Template type (text, image, video, audio, document)',
        },
        buttonText: {
          type: 'string',
          description: 'Optional button text',
        },
        buttonUrl: {
          type: 'string',
          description: 'Optional button URL',
        },
      },
      required: ['channelId', 'name', 'message', 'templateType'],
    },
  },
  {
    name: 'update_template',
    description: 'Update an existing template',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Template ID',
        },
        name: {
          type: 'string',
          description: 'Template name',
        },
        message: {
          type: 'string',
          description: 'Template message content',
        },
        buttonText: {
          type: 'string',
          description: 'Optional button text',
        },
        buttonUrl: {
          type: 'string',
          description: 'Optional button URL',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_template',
    description: 'Delete a template by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Template ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'export_templates',
    description: 'Export all templates to CSV or JSON format, optionally filtered by channel',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: 'Export format (csv or json)', enum: ['csv', 'json'] },
        channelId: { type: 'number', description: 'Filter by channel ID' },
      },
    },
  },
  {
    name: 'validate_templates_import',
    description: 'Validate templates data before importing. Returns validation errors and duplicate count.',
    inputSchema: {
      type: 'object',
      properties: {
        templates: { type: 'array', items: { type: 'object' }, description: 'Array of template objects to validate' },
        channelId: { type: 'number', description: 'Target channel ID for import' },
      },
      required: ['templates'],
    },
  },
  {
    name: 'import_templates',
    description: 'Import templates from JSON data. Returns summary with imported count, skipped duplicates, and errors.',
    inputSchema: {
      type: 'object',
      properties: {
        templates: { type: 'array', items: { type: 'object' }, description: 'Array of template objects to import' },
        channelId: { type: 'number', description: 'Target channel ID for import' },
      },
      required: ['templates'],
    },
  },
];
