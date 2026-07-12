import type { ApiClient } from '@instantkom/api-client';

/**
 * QR Codes Tools
 * CRUD operations for QR code generation and management
 */

export async function listQrCodes(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.channelId) params.append('channelId', args.channelId.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/qr-codes${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getQrCode(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/qr-codes/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createQrCode(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/qr-codes', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateQrCode(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/qr-codes/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteQrCode(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/qr-codes/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'QR code deleted successfully',
      },
    ],
  };
}

export const qrCodeTools = [
  {
    name: 'list_qr_codes',
    description: 'List all QR codes with optional filters',
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
      },
    },
  },
  {
    name: 'get_qr_code',
    description: 'Get a specific QR code by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'QR code ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_qr_code',
    description: 'Generate a new QR code for a channel',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'number',
          description: 'Channel ID to associate with this QR code',
        },
        name: {
          type: 'string',
          description: 'QR code name for identification',
        },
        keyword: {
          type: 'string',
          description: 'Tracking keyword to track QR code scans',
        },
      },
      required: ['channelId', 'name'],
    },
  },
  {
    name: 'update_qr_code',
    description: 'Update an existing QR code',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'QR code ID',
        },
        name: {
          type: 'string',
          description: 'QR code name',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_qr_code',
    description: 'Delete a QR code by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'QR code ID',
        },
      },
      required: ['id'],
    },
  },
];
