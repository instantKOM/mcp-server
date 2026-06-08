import type { ApiClient } from '@instantkom/api-client';

/**
 * E-Commerce Tools
 * Read-only access to e-commerce orders and contact order history
 */

export async function listEcommerceOrders(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.search) params.append('search', args.search);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/ecommerce/orders${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getEcommerceOrder(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/ecommerce/orders/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getContactOrders(apiClient: ApiClient, args: { contactId: number; limit?: number }): Promise<any> {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/contacts/${args.contactId}/orders${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getContactOrderStats(apiClient: ApiClient, args: { contactId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/contacts/${args.contactId}/orders/stats`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const ecommerceTools = [
  {
    name: 'list_ecommerce_orders',
    description: 'List all e-commerce orders with optional pagination and search',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 20)' },
        search: { type: 'string', description: 'Search orders' },
      },
    },
  },
  {
    name: 'get_ecommerce_order',
    description: 'Get a specific e-commerce order by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Order ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_contact_orders',
    description: 'Get all orders for a specific contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        limit: { type: 'number', description: 'Number of orders to return (default: 20)' },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'get_contact_order_stats',
    description: 'Get order statistics for a specific contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
      },
      required: ['contactId'],
    },
  },
];
