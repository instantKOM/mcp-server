import type { ApiClient } from '@instantkom/api-client';

/**
 * Billing Tools
 * Billing, invoices, and subscription management
 */

export async function getBillingInfo(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.get('/v1/billing');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function listInvoices(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/billing/invoices${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getInvoice(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/billing/invoices/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getSubscription(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.get('/v1/billing/subscription');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updatePaymentMethod(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.put('/v1/billing/payment-method', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const billingTools = [
  {
    name: 'get_billing_info',
    description: 'Get billing information and current balance',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_invoices',
    description: 'List all invoices',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
      },
    },
  },
  {
    name: 'get_invoice',
    description: 'Get a specific invoice by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Invoice ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_subscription',
    description: 'Get current subscription details',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_payment_method',
    description: 'Update payment method',
    inputSchema: {
      type: 'object',
      properties: {
        paymentMethodId: { type: 'string', description: 'Payment method ID' },
      },
      required: ['paymentMethodId'],
    },
  },
];
