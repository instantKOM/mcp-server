/**
 * App Tools - Contacts CRUD Operations
 */

import type { ApiClient } from '@instantkom/api-client';
import type { Contact, PaginationParams } from '../../types/index.js';

export async function listContacts(
  apiClient: ApiClient,
  args: PaginationParams & { channelId?: number }
): Promise<any> {
  const response = await apiClient.get<Contact[]>('/v1/contacts', args);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getContact(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get<Contact>(`/v1/contacts/${args.id}`);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createContact(
  apiClient: ApiClient,
  args: Partial<Contact>
): Promise<any> {
  const response = await apiClient.post<Contact>('/v1/contacts', args);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateContact(
  apiClient: ApiClient,
  args: { id: number } & Partial<Contact>
): Promise<any> {
  const { id, ...updateData } = args;
  const response = await apiClient.put<Contact>(`/v1/contacts/${id}`, updateData);


  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteContact(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/contacts/${args.id}`);


  return {
    content: [
      {
        type: 'text',
        text: 'Contact deleted successfully',
      },
    ],
  };
}

export const contactTools = [
  {
    name: 'list_contacts',
    description: 'List all contacts with optional filtering by channel and pagination',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'number',
          description: 'Filter by channel ID',
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Items per page (default: 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_contact',
    description: 'Get a specific contact by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Contact ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_contact',
    description: 'Create a new contact',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'number',
          description: 'Channel ID this contact belongs to',
        },
        identifier: {
          type: 'string',
          description: 'Unique identifier for this contact (phone number for WhatsApp/SMS, user ID for Telegram, Threema ID for Threema, etc.)',
        },
        name: {
          type: 'string',
          description: 'Contact name',
        },
        optinStatus: {
          type: 'number',
          description: 'Opt-in status (0=not opted in, 1=opted in, 2=opted out, 3=deleted)',
          enum: [0, 1, 2, 3],
        },
        isBlocked: {
          type: 'boolean',
          description: 'Whether the recipient is blocked',
        },
      },
      required: ['channelId', 'identifier'],
    },
  },
  {
    name: 'update_contact',
    description: 'Update an existing contact',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Contact ID',
        },
        identifier: {
          type: 'string',
          description: 'Unique identifier for this contact',
        },
        name: {
          type: 'string',
          description: 'Contact name',
        },
        nickname: {
          type: 'string',
          description: 'Nickname',
        },
        notes: {
          type: 'string',
          description: 'Notes',
        },
        optinStatus: {
          type: 'number',
          description: 'Opt-in status (0=not opted in, 1=opted in, 2=opted out, 3=deleted)',
          enum: [0, 1, 2, 3],
        },
        isBlocked: {
          type: 'boolean',
          description: 'Whether the recipient is blocked',
        },
        tags: {
          type: 'string',
          description: 'Tags (comma-separated)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_contact',
    description: 'Delete a contact by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Contact ID',
        },
      },
      required: ['id'],
    },
  },
];
