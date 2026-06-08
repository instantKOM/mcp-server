/**
 * Type definitions for the MCP Server
 */

export interface TenantConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  scope: 'public' | 'app' | 'admin' | 'internal';
  enabledTools?: string[];
  /** Optional credentials for JWT-based auth (required for /admin/* endpoints) */
  username?: string;
  password?: string;
}

export interface TenantsConfig {
  tenants: TenantConfig[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface Channel {
  id: number;
  name: string;
  gatewayType: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contact {
  id: number;
  channelId: number;
  phoneNumber: string;
  name?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id: number;
  channelId: number;
  contactId: number;
  content: string;
  direction: 'inbound' | 'outbound';
  status: string;
  createdAt?: string;
}

export interface Broadcast {
  id: number;
  name: string;
  channelId: number;
  status: string;
  scheduledAt?: string;
  createdAt?: string;
}

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalChannels: number;
}

export interface UserAnalytics {
  newUsers: number;
  activeUsers: number;
  period: string;
}

export interface RevenueStats {
  totalRevenue: number;
  mrr: number;
  currency: string;
  period: string;
}
