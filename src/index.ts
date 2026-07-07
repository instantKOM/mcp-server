#!/usr/bin/env node

/**
 * instantKOM MCP Server
 * Model Context Protocol Server for instantKOM REST API
 *
 * Supports runtime tenant switching via meta tools (switch_tenant, get_current_tenant, list_tenants).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { ConfigLoader } from './config/config.js';
import { ApiClient } from '@instantkom/api-client';
import type { TenantConfig } from './types/index.js';

// Import tools
import { executeTool } from './tools/tool-router.js';
import { getToolsForTenant } from './tools/tool-selection.js';
import {
  initSentry,
  captureMcpException,
  flushSentry,
} from './monitoring/sentry.js';

// Load environment variables
config();

// Initialize error monitoring (no-op unless SENTRY_ENABLED + SENTRY_DSN set).
// Top-level await: completes during startup, well before any tool call.
await initSentry();

class InstantKomMcpServer {
  private server: Server;
  private configLoader: ConfigLoader;
  private activeTenantId: string;
  private apiClients: Map<string, ApiClient>;

  private get tenant(): TenantConfig {
    const t = this.configLoader.getTenantWithEnvOverrides(this.activeTenantId);
    if (!t) {
      throw new Error(`Active tenant '${this.activeTenantId}' not found`);
    }
    return t;
  }

  private get apiClient(): ApiClient {
    const client = this.apiClients.get(this.activeTenantId);
    if (!client) {
      throw new Error(`No ApiClient for tenant '${this.activeTenantId}'`);
    }
    return client;
  }

  constructor() {
    // Load tenant configuration
    this.configLoader = ConfigLoader.getInstance();
    this.activeTenantId = process.env.TENANT_ID || 'internal';
    this.apiClients = new Map();

    const tenant = this.configLoader.getTenantWithEnvOverrides(this.activeTenantId);
    if (!tenant) {
      console.error(`[ERROR] Tenant '${this.activeTenantId}' not found in configuration`);
      process.exit(1);
    }

    // Create initial ApiClient
    this.apiClients.set(this.activeTenantId, new ApiClient(tenant));

    console.error(`[Server] Loaded tenant: ${tenant.name} (${tenant.id})`);
    console.error(`[Server] API URL: ${tenant.apiUrl}`);
    console.error(`[Server] Scope: ${tenant.scope}`);

    // Initialize MCP server with listChanged capability
    this.server = new Server(
      {
        name: 'instantkom-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: { listChanged: true },
        },
      }
    );

    this.setupHandlers();
  }

  private switchTenant(tenantId: string): TenantConfig {
    const tenant = this.configLoader.getTenantWithEnvOverrides(tenantId);
    if (!tenant) {
      throw new Error(
        `Unknown tenant: '${tenantId}'. Use list_tenants to see available options.`
      );
    }

    // Create or reset cached ApiClient
    if (this.apiClients.has(tenantId)) {
      this.apiClients.get(tenantId)!.resetAuth();
    } else {
      this.apiClients.set(tenantId, new ApiClient(tenant));
    }

    this.activeTenantId = tenantId;
    console.error(`[Server] Switched to tenant: ${tenant.name} (${tenant.id})`);
    console.error(`[Server] API URL: ${tenant.apiUrl}`);
    console.error(`[Server] Scope: ${tenant.scope}`);
    return tenant;
  }

  private getToolsForTenant(tenant: TenantConfig): any[] {
    return getToolsForTenant(tenant, { includeMeta: true });
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: this.getToolsForTenant(this.tenant) };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Meta tools are handled directly (they don't use ApiClient)
      if (name === 'switch_tenant') {
        return this.handleSwitchTenant(args?.tenant_id as string);
      }
      if (name === 'get_current_tenant') {
        return this.handleGetCurrentTenant();
      }
      if (name === 'list_tenants') {
        return this.handleListTenants();
      }

      // Regular tools - delegate to router with current apiClient
      try {
        console.error(`[Tool] Executing: ${name}`);
        return await executeTool(name, this.apiClient, args || {});
      } catch (error) {
        console.error(`[Tool] Error executing ${name}:`, error);
        captureMcpException(error, { tool: name });
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleSwitchTenant(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: tenant_id is required. Use list_tenants to see available options.',
            },
          ],
          isError: true,
        };
      }

      const tenant = this.switchTenant(tenantId);

      // Notify client that tools have changed (scope may differ)
      await this.server.sendToolListChanged();

      const toolCount = this.getToolsForTenant(tenant).length;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                tenant: {
                  id: tenant.id,
                  name: tenant.name,
                  apiUrl: tenant.apiUrl,
                  scope: tenant.scope,
                },
                toolCount,
                message: `Switched to ${tenant.name}. ${toolCount} tools available.`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private handleGetCurrentTenant(): any {
    const t = this.tenant;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              id: t.id,
              name: t.name,
              apiUrl: t.apiUrl,
              scope: t.scope,
              hasApiKey: !!t.apiKey,
              hasJwtCredentials: !!(t.username && t.password),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private handleListTenants(): any {
    const tenants = this.configLoader.getAllTenants().map((t) => {
      const resolved = this.configLoader.getTenantWithEnvOverrides(t.id);
      return {
        id: t.id,
        name: t.name,
        scope: t.scope,
        apiUrl: resolved?.apiUrl || t.apiUrl,
        isActive: t.id === this.activeTenantId,
        hasCredentials: !!(
          resolved?.apiKey ||
          (resolved?.username && resolved?.password)
        ),
      };
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(tenants, null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Server] instantKOM MCP Server running on stdio');
  }
}

// Start the server
const server = new InstantKomMcpServer();
server.run().catch(async (error) => {
  console.error('[Server] Fatal error:', error);
  captureMcpException(error, { phase: 'startup' });
  // Flush before exit -- a stdio process dies immediately on exit(), losing
  // any unsent event otherwise.
  await flushSentry();
  process.exit(1);
});
