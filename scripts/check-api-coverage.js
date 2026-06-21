#!/usr/bin/env node

/**
 * MCP API Coverage Check
 *
 * Static analysis script that detects discrepancies between NestJS API endpoints
 * and MCP Server tool coverage.
 *
 * Parses:
 *   1. API controller files -> extracts all endpoint paths + HTTP methods
 *   2. MCP tool handler files -> extracts all apiClient calls (covered paths)
 *
 * Reports uncovered endpoints grouped by scope (v1, app, admin, internal).
 *
 * Usage:
 *   node scripts/check-api-coverage.js
 *   npm run check:api-coverage
 *
 * Exit codes:
 *   0 - Full coverage (or only ignored paths uncovered)
 *   1 - Violations found (uncovered endpoints that need MCP tools)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths relative to this script
const API_SRC = join(__dirname, '..', '..', 'api', 'src');
const MCP_TOOLS = join(__dirname, '..', 'src', 'tools');

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Endpoint path prefixes to IGNORE entirely.
 * These are intentionally not exposed via MCP (auth, webhooks, metrics, etc.)
 */
const IGNORED_PREFIXES = [
  'auth/',              // Authentication endpoints (login, refresh, etc.)
  'app/',               // Frontend-specific endpoints (MCP uses v1/ equivalents)
  'webhooks/',          // Inbound webhook receivers
  'internal/metrics',   // Prometheus metrics
  'internal/realtime',  // SSE/realtime internal
  'internal/webhooks',  // PHP->NestJS webhook trigger bridge (not user-facing)
  'internal/push',      // Internal push notifications
  'internal/ai',        // Internal AI costs/insights
  'internal/business-health', // Ops Hub business-health signals (IP+token gated, not user-facing)
  'internal/stripe',    // PHP->NestJS stripe charge bridge (not user-facing)
  'v1/internal/stripe', // Versioned PHP->NestJS stripe charge bridge (not user-facing)
  'internal/instantchat', // PHP->NestJS instantCHAT outbound delivery bridge (not user-facing)
  'contact',            // Legacy contact form endpoint
  'roi-calculator',     // Public ROI calculator lead form, not MCP-relevant
  'api/qr',             // QR code generator (image endpoint)
  'trk',                // Tracking pixel/redirect
  'v1/early-access',    // Public signup form, not user-facing MCP
  'v1/conversion-tracking/webhook', // Inbound webhook, not MCP-relevant
  'v1/channels/',       // Channel-scoped sub-endpoints (duplicates of /v1/tickets etc.)
  'public/instantchat', // Anonymous visitor website-chat endpoints, not integrator MCP tools (Issue #3643)
];

/**
 * Specific endpoint paths to ignore (exact match after normalization).
 * Use this for individual endpoints that intentionally don't need MCP tools.
 */
const IGNORED_ENDPOINTS = [
  // Root info endpoint
  'GET /',
  'GET ',
  // Channel hard-delete is intentionally Admin API only and must not be exposed via MCP.
  'DELETE /admin/channels/:param',
  // One-click unsubscribe is a mail-client callback with an opaque token, not an MCP tool.
  'POST /v1/mail-unsubscribe/:param',
  // Admin demo endpoints: browser-only canary page, media streaming makes no sense as MCP tool.
  'GET /admin/demo/message-types',
  'GET /admin/demo/media/:param',
];

/**
 * Scope mapping: which API path prefixes belong to which MCP scope.
 * Used for grouping the coverage report.
 */
const SCOPE_MAP = [
  { prefix: 'v1/', scope: 'public', label: 'Public API (v1)' },
  { prefix: 'app/', scope: 'app', label: 'App API' },
  { prefix: 'admin/', scope: 'admin', label: 'Admin API' },
  { prefix: 'internal/', scope: 'internal', label: 'Internal API' },
];

// ============================================================
// FILE SCANNING UTILITIES
// ============================================================

function walkDir(dir, ext) {
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...walkDir(fullPath, ext));
      } else if (entry.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or isn't readable
  }
  return results;
}

// ============================================================
// API CONTROLLER PARSING
// ============================================================

/**
 * Extract all endpoints from NestJS controller files.
 * Parses @Controller('path') and @Get/@Post/@Put/@Patch/@Delete decorators.
 *
 * Returns: Array of { method, path, file, line }
 */
function parseApiControllers() {
  const controllerFiles = walkDir(API_SRC, '.controller.ts');
  const endpoints = [];

  for (const file of controllerFiles) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const relFile = relative(join(__dirname, '..', '..'), file);

    // Find all @Controller declarations with their line ranges
    // A file can have multiple @Controller classes
    const controllerBlocks = [];
    for (let i = 0; i < lines.length; i++) {
      const controllerMatch = lines[i].match(/@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/);
      if (controllerMatch) {
        controllerBlocks.push({ basePath: controllerMatch[1], startLine: i });
      }
    }

    // For files with no @Controller or empty @Controller(), skip
    if (controllerBlocks.length === 0) {
      // Check for @Controller() with no path
      const hasEmptyController = content.match(/@Controller\(\s*\)/);
      if (hasEmptyController) {
        controllerBlocks.push({ basePath: '', startLine: 0 });
      } else {
        continue;
      }
    }

    // Set end lines for each controller block
    for (let i = 0; i < controllerBlocks.length; i++) {
      controllerBlocks[i].endLine = i + 1 < controllerBlocks.length
        ? controllerBlocks[i + 1].startLine
        : lines.length;
    }

    // Extract method decorators within each controller block
    const methodDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete'];

    for (const block of controllerBlocks) {
      for (let i = block.startLine; i < block.endLine; i++) {
        const line = lines[i];

        for (const decorator of methodDecorators) {
          // Match @Get(), @Get('path'), @Get(':id'), @Get(':id/logs')
          const regex = new RegExp(`@${decorator}\\(\\s*(?:['"\`]([^'"\`]*)['"\`])?\\s*\\)`);
          const match = line.match(regex);

          if (match) {
            const subPath = match[1] || '';
            const httpMethod = decorator === 'Patch' ? 'PATCH' : decorator.toUpperCase();

            // Build full path
            let fullPath = block.basePath;
            if (subPath) {
              fullPath = fullPath ? `${fullPath}/${subPath}` : subPath;
            }

            // Normalize: ensure leading slash, normalize params
            fullPath = '/' + fullPath.replace(/^\//, '');
            fullPath = normalizePath(fullPath);

            endpoints.push({
              method: httpMethod,
              path: fullPath,
              key: `${httpMethod} ${fullPath}`,
              file: relFile,
              line: i + 1,
            });
          }
        }
      }
    }
  }

  return endpoints;
}

// ============================================================
// MCP TOOL PARSING
// ============================================================

/**
 * Extract all API paths called by MCP tool handlers.
 * Parses apiClient.get('/path'), apiClient.post(`/path/${var}`), etc.
 *
 * Returns: Set of normalized "METHOD /path" strings
 */
function parseMcpTools() {
  const toolFiles = walkDir(MCP_TOOLS, '.ts');
  const coveredPaths = new Set();

  for (const file of toolFiles) {
    // Skip index.ts files (they only re-export)
    if (file.endsWith('/index.ts')) continue;

    const content = readFileSync(file, 'utf-8');

    // Match apiClient.get('/path') or apiClient.get(`/path/${var}`)
    // Methods: get, getBinary, post, put, patch, delete
    const methodMap = { get: 'GET', getBinary: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE' };

    for (const [jsMethod, httpMethod] of Object.entries(methodMap)) {
      // Match both single-quote strings and template literals
      const patterns = [
        // apiClient.get('/v1/channels')
        new RegExp(`apiClient\\.${jsMethod}(?:<[^>]*>)?\\(\\s*['"]([^'"]+)['"]`, 'g'),
        // apiClient.get(`/v1/channels/${args.id}`)
        new RegExp(`apiClient\\.${jsMethod}(?:<[^>]*>)?\\(\\s*\`([^\`]+)\``, 'g'),
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          let path = match[1];
          // Template vars after '/' are path params -> :param
          // Template vars NOT after '/' are query strings or continuations -> remove
          path = path.replace(/\/\$\{[^}]+\}/g, '/:param');
          path = path.replace(/\$\{[^}]+\}/g, '');
          path = normalizePath(path);

          coveredPaths.add(`${httpMethod} ${path}`);
        }
      }
    }
  }

  return coveredPaths;
}

// ============================================================
// PATH NORMALIZATION
// ============================================================

/**
 * Normalize a path for comparison:
 * - Replace :paramName with :param
 * - Remove query string parts (template vars appended without /)
 * - Remove trailing slashes
 * - Ensure leading slash
 */
function normalizePath(path) {
  return path
    .replace(/\?.*$/, '')                              // remove query strings
    .replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, ':param')    // :id -> :param
    .replace(/\/+/g, '/')                              // double slashes
    .replace(/\/$/, '')                                 // trailing slash
    .replace(/^([^/])/, '/$1');                         // ensure leading slash
}

// ============================================================
// FILTERING
// ============================================================

function isIgnored(endpoint) {
  const pathWithoutSlash = endpoint.path.replace(/^\//, '');

  // Check prefix ignores
  for (const prefix of IGNORED_PREFIXES) {
    if (pathWithoutSlash.startsWith(prefix)) return true;
  }

  // Check exact ignores
  if (IGNORED_ENDPOINTS.includes(endpoint.key)) return true;

  return false;
}

function getScope(endpoint) {
  const pathWithoutSlash = endpoint.path.replace(/^\//, '');

  for (const { prefix, scope, label } of SCOPE_MAP) {
    if (pathWithoutSlash.startsWith(prefix)) {
      return { scope, label };
    }
  }

  return { scope: 'other', label: 'Other' };
}

// ============================================================
// MAIN
// ============================================================

function main() {
  console.log('MCP API Coverage Check');
  console.log('======================\n');

  // 1. Parse API controllers
  const apiEndpoints = parseApiControllers();
  console.log(`API endpoints found: ${apiEndpoints.length}`);

  // 2. Parse MCP tools
  const mcpCoveredPaths = parseMcpTools();
  console.log(`MCP tool paths found: ${mcpCoveredPaths.size}`);
  console.log('');

  // 3. Find uncovered endpoints
  const uncovered = [];
  const covered = [];
  const ignored = [];

  for (const endpoint of apiEndpoints) {
    if (isIgnored(endpoint)) {
      ignored.push(endpoint);
      continue;
    }

    // Check if this endpoint path is covered by any MCP tool
    // We check both exact match and PATCH->PUT fallback (some tools use PUT for PATCH)
    const isCovered =
      mcpCoveredPaths.has(endpoint.key) ||
      (endpoint.method === 'PATCH' && mcpCoveredPaths.has(`PUT ${endpoint.path}`)) ||
      (endpoint.method === 'PUT' && mcpCoveredPaths.has(`PATCH ${endpoint.path}`));

    if (isCovered) {
      covered.push(endpoint);
    } else {
      uncovered.push(endpoint);
    }
  }

  // 4. Group uncovered by scope
  const scopeGroups = {};
  for (const endpoint of uncovered) {
    const { scope, label } = getScope(endpoint);
    if (!scopeGroups[scope]) {
      scopeGroups[scope] = { label, endpoints: [] };
    }
    scopeGroups[scope].endpoints.push(endpoint);
  }

  // 5. Count totals per scope (for coverage percentage)
  const scopeTotals = {};
  for (const endpoint of apiEndpoints) {
    if (isIgnored(endpoint)) continue;
    const { scope } = getScope(endpoint);
    if (!scopeTotals[scope]) scopeTotals[scope] = { total: 0, covered: 0 };
    scopeTotals[scope].total++;
  }
  for (const endpoint of covered) {
    const { scope } = getScope(endpoint);
    if (scopeTotals[scope]) scopeTotals[scope].covered++;
  }

  // 6. Print coverage summary
  console.log('Coverage Summary');
  console.log('----------------');

  const scopeOrder = ['public', 'app', 'admin', 'internal', 'other'];
  for (const scope of scopeOrder) {
    if (!scopeTotals[scope]) continue;
    const { total, covered: cov } = scopeTotals[scope];
    const pct = total > 0 ? ((cov / total) * 100).toFixed(1) : '100.0';
    const scopeLabel = SCOPE_MAP.find(s => s.scope === scope)?.label || 'Other';
    const status = cov === total ? '[OK]' : '[GAP]';
    console.log(`  ${status} ${scopeLabel}: ${cov}/${total} endpoints covered (${pct}%)`);
  }
  console.log(`  [---] Ignored: ${ignored.length} endpoints`);
  console.log('');

  // 7. Print violations
  if (uncovered.length === 0) {
    console.log('[OK] All API endpoints are covered by MCP tools.');
    process.exit(0);
  }

  console.log(`[FAIL] ${uncovered.length} API endpoint(s) have no MCP tool coverage:\n`);

  for (const scope of scopeOrder) {
    const group = scopeGroups[scope];
    if (!group) continue;

    console.log(`  ${group.label} (${group.endpoints.length} missing):`);
    for (const ep of group.endpoints) {
      console.log(`    - ${ep.key}`);
      console.log(`      ${ep.file}:${ep.line}`);
    }
    console.log('');
  }

  console.log('To fix: Add MCP tool handlers for the missing endpoints,');
  console.log('or add them to IGNORED_PREFIXES/IGNORED_ENDPOINTS in this script');
  console.log('if they intentionally should not be exposed via MCP.');

  process.exit(1);
}

main();
