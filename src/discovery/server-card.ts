import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { createRequire } from 'node:module';

const packageJson = createRequire(import.meta.url)('../../package.json') as { version: string };

export const MCP_SERVER_CARD_PATH = '/.well-known/mcp/server-card.json';
export const MCP_CANONICAL_ORIGIN = 'https://mcp.instantkom.app';
export const MCP_ENDPOINT_PATH = '/mcp';
export const MCP_SERVER_INFO = Object.freeze({
  name: 'instantkom-mcp-server',
  title: 'instantKOM Remote MCP',
  version: packageJson.version,
});
export const MCP_SERVER_CAPABILITIES = Object.freeze({
  tools: Object.freeze({}),
  prompts: Object.freeze({}),
});

/** Public, tenant-neutral metadata. Never add credentials or unshipped capabilities. */
export const MCP_SERVER_CARD = Object.freeze({
  $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
  version: '1.0',
  protocolVersion: LATEST_PROTOCOL_VERSION,
  serverInfo: MCP_SERVER_INFO,
  description: 'Tenant-scoped tools and playbooks for the instantKOM messaging platform.',
  transport: Object.freeze({
    type: 'streamable-http',
    endpoint: `${MCP_CANONICAL_ORIGIN}${MCP_ENDPOINT_PATH}`,
  }),
  capabilities: MCP_SERVER_CAPABILITIES,
  authentication: Object.freeze({
    required: true,
    schemes: Object.freeze(['bearer']),
  }),
  tools: Object.freeze(['dynamic']),
  prompts: Object.freeze(['dynamic']),
});
