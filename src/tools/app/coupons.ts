import type { ApiClient } from '@instantkom/api-client';

/**
 * Coupons Tools
 * Discount coupons and promotions
 */

export async function validateCoupon(apiClient: ApiClient, args: { code: string }): Promise<any> {
  const response = await apiClient.post('/v1/coupons/validate', { code: args.code });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function applyCoupon(apiClient: ApiClient, args: { code: string }): Promise<any> {
  const response = await apiClient.post('/v1/coupons/apply', { code: args.code });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function removeCoupon(apiClient: ApiClient): Promise<any> {
  const response = await apiClient.delete('/v1/coupons/current');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const couponTools = [
  {
    name: 'validate_coupon',
    description: 'Validate a coupon code',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Coupon code' },
      },
      required: ['code'],
    },
  },
  {
    name: 'apply_coupon',
    description: 'Apply a coupon code to the account',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Coupon code' },
      },
      required: ['code'],
    },
  },
  {
    name: 'remove_coupon',
    description: 'Remove currently applied coupon',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
