#!/usr/bin/env node

/**
 * instantKOM Remote-MCP HTTP gateway entrypoint.
 *
 * Additive to the stdio server (src/index.ts): same tool registry, same
 * executeTool router, same Sentry. A customer connects with a URL + Bearer
 * token over StreamableHTTP (or legacy SSE) instead of a local stdio process.
 */

import { config } from 'dotenv';
import { HttpGateway } from './http/server.js';
import { initSentry, captureMcpException, flushSentry } from './monitoring/sentry.js';

config();

await initSentry();

const gateway = new HttpGateway();

async function shutdown(signal: string): Promise<void> {
  console.error(`[HTTP] Received ${signal}, shutting down gracefully...`);
  try {
    await gateway.stop();
  } catch (error) {
    console.error('[HTTP] Error during shutdown:', error);
  }
  await flushSentry();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

gateway.start().catch(async (error) => {
  console.error('[HTTP] Fatal startup error:', error);
  captureMcpException(error, { phase: 'http-startup' });
  await flushSentry();
  process.exit(1);
});
