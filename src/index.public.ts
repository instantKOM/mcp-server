#!/usr/bin/env node

/**
 * instantKOM MCP Server - Public Entry Point
 *
 * Simplified standalone server for customers.
 * Reads INSTANTKOM_API_KEY from environment — no tenants.json required.
 *
 * Usage:
 *   npx @instantkom/mcp-server
 *
 * Config in Claude Code (.mcp.json):
 *   {
 *     "mcpServers": {
 *       "instantkom": {
 *         "command": "npx",
 *         "args": ["-y", "@instantkom/mcp-server"],
 *         "env": { "INSTANTKOM_API_KEY": "ik_live_..." }
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { ApiClient } from '@instantkom/api-client';
import { publicTools } from './tools/public/index.js';
import { appTools } from './tools/app/index.js';
import { executeTool } from './tools/tool-router.js';
import { initSentry, captureMcpException } from './monitoring/sentry.js';

// Load optional .env file (development convenience)
config();

// Error monitoring: a strict no-op unless SENTRY_ENABLED + SENTRY_DSN are set,
// so customer installs of this published package never report to our Sentry.
await initSentry();

const API_KEY = process.env.INSTANTKOM_API_KEY || process.env.API_KEY || '';
const API_URL = process.env.INSTANTKOM_API_URL || 'https://api.instantkom.app';

if (!API_KEY) {
  console.error('[instantKOM MCP] Error: INSTANTKOM_API_KEY environment variable is required.');
  console.error('[instantKOM MCP] Get your API key at: https://frontend.instantkom.app/settings/api-keys');
  process.exit(1);
}

const apiClient = new ApiClient({
  id: 'default',
  name: 'instantKOM',
  apiUrl: API_URL,
  apiKey: API_KEY,
  scope: 'app',
});

const allTools = [...publicTools, ...appTools];

const server = new Server(
  {
    name: 'instantkom-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    return await executeTool(name, apiClient, args || {});
  } catch (error) {
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[instantKOM MCP] Server started. ${allTools.length} tools available.`);
console.error(`[instantKOM MCP] API: ${API_URL}`);
