import type { ApiClient } from '@instantkom/api-client';

/**
 * Custom Fields Tools
 * CRUD operations for custom field definitions and contact custom field values
 */

// ============================================================================
// Custom Field Definitions
// ============================================================================

export async function listCustomFields(apiClient: ApiClient, _args: any): Promise<any> {
  const response = await apiClient.get('/v1/custom-fields');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getCustomField(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/custom-fields/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createCustomField(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/custom-fields', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateCustomField(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/custom-fields/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteCustomField(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/custom-fields/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Custom field deleted successfully',
      },
    ],
  };
}

export async function reorderCustomFields(apiClient: ApiClient, args: { fieldIds: number[] }): Promise<any> {
  const response = await apiClient.put('/v1/custom-fields/reorder', { fieldIds: args.fieldIds });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function bulkDeleteCustomFields(apiClient: ApiClient, args: { ids: number[] }): Promise<any> {
  const response = await apiClient.post('/v1/custom-fields/bulk-delete', { ids: args.ids });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

// ============================================================================
// Contact Custom Field Values
// ============================================================================

export async function getContactCustomFields(apiClient: ApiClient, args: { contactId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/contacts/${args.contactId}/custom-fields`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function setContactCustomFields(apiClient: ApiClient, args: any): Promise<any> {
  const { contactId, ...data } = args;
  const response = await apiClient.put(`/v1/contacts/${contactId}/custom-fields`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function setContactCustomFieldValue(apiClient: ApiClient, args: { contactId: number; fieldId: number; value: string | null }): Promise<any> {
  const response = await apiClient.put(`/v1/contacts/${args.contactId}/custom-fields/${args.fieldId}`, { value: args.value });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteContactCustomFieldValue(apiClient: ApiClient, args: { contactId: number; fieldId: number }): Promise<any> {
  await apiClient.delete(`/v1/contacts/${args.contactId}/custom-fields/${args.fieldId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Contact custom field value deleted successfully',
      },
    ],
  };
}

export const customFieldTools = [
  // Custom Field Definitions
  {
    name: 'list_custom_fields',
    description: 'List all custom field definitions sorted by display order',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_custom_field',
    description: 'Get a specific custom field definition by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Custom field definition ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_custom_field',
    description: 'Create a new custom field definition. The field key must be unique within the account.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Unique field key (e.g. customer_id)' },
        name: { type: 'string', description: 'Display name' },
        type: { type: 'string', description: 'Field type (text, number, date, boolean, select)' },
        options: { type: 'array', items: { type: 'string' }, description: 'Options for select type fields' },
      },
      required: ['key', 'name', 'type'],
    },
  },
  {
    name: 'update_custom_field',
    description: 'Update a custom field definition. The field key cannot be changed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Custom field definition ID' },
        name: { type: 'string', description: 'Display name' },
        options: { type: 'array', items: { type: 'string' }, description: 'Options for select type fields' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_custom_field',
    description: 'Delete a custom field definition and all its values across all contacts',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Custom field definition ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'reorder_custom_fields',
    description: 'Reorder custom field definitions. Provide all field IDs in desired order.',
    inputSchema: {
      type: 'object',
      properties: {
        fieldIds: { type: 'array', items: { type: 'number' }, description: 'Array of field IDs in desired display order' },
      },
      required: ['fieldIds'],
    },
  },
  {
    name: 'bulk_delete_custom_fields',
    description: 'Delete multiple custom field definitions at once (max 100)',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'number' }, description: 'Array of custom field IDs to delete' },
      },
      required: ['ids'],
    },
  },

  // Contact Custom Field Values
  {
    name: 'get_contact_custom_fields',
    description: 'Get all custom field values for a specific contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact/Recipient ID' },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'set_contact_custom_fields',
    description: 'Set multiple custom field values for a contact at once',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact/Recipient ID' },
        values: { type: 'object', description: 'Key-value pairs of field keys and their values' },
      },
      required: ['contactId', 'values'],
    },
  },
  {
    name: 'set_contact_custom_field_value',
    description: 'Set a single custom field value for a contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact/Recipient ID' },
        fieldId: { type: 'number', description: 'Custom field definition ID' },
        value: { type: 'string', description: 'Value to set (use null to clear)' },
      },
      required: ['contactId', 'fieldId'],
    },
  },
  {
    name: 'delete_contact_custom_field_value',
    description: 'Remove the value of a custom field for a specific contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact/Recipient ID' },
        fieldId: { type: 'number', description: 'Custom field definition ID' },
      },
      required: ['contactId', 'fieldId'],
    },
  },
];
