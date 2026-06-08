/**
 * Configuration loader for the MCP Server
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { TenantConfig, TenantsConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ConfigLoader {
  private static instance: ConfigLoader;
  private tenants: Map<string, TenantConfig>;
  private deferredCredsLoaded = false;

  private constructor() {
    this.tenants = new Map();
    this.loadTenants();
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  private loadTenants(): void {
    try {
      const tenantsPath = join(__dirname, 'tenants.json');
      const tenantsData = readFileSync(tenantsPath, 'utf-8');
      const config: TenantsConfig = JSON.parse(tenantsData);

      for (const tenant of config.tenants) {
        this.tenants.set(tenant.id, tenant);
      }

      console.error(`[Config] Loaded ${this.tenants.size} tenant(s)`);
    } catch (error) {
      console.error('[Config] Error loading tenants:', error);
      throw new Error('Failed to load tenant configuration');
    }
  }

  public getTenant(tenantId: string): TenantConfig | undefined {
    return this.tenants.get(tenantId);
  }

  public getAllTenants(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }

  /**
   * Load deferred credentials from the env file written by mcp-run.sh background process.
   * Called lazily on first tenant switch to a tenant whose credentials aren't in process.env yet.
   */
  private loadDeferredCredentials(): void {
    if (this.deferredCredsLoaded) return;
    this.deferredCredsLoaded = true;

    const credsFile = process.env.MCP_DEFERRED_CREDS_FILE;
    if (!credsFile || !existsSync(credsFile)) return;

    try {
      const content = readFileSync(credsFile, 'utf-8');
      for (const line of content.split('\n')) {
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = line.slice(0, eqIdx);
        const value = line.slice(eqIdx + 1);
        // Only set if not already in env (don't override active tenant's credentials)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      console.error(`[Config] Loaded deferred credentials from ${credsFile}`);
    } catch (error) {
      console.error(`[Config] Could not load deferred credentials: ${error}`);
    }
  }

  public getTenantWithEnvOverrides(tenantId: string): TenantConfig | undefined {
    const tenant = this.getTenant(tenantId);
    if (!tenant) {
      return undefined;
    }

    // Derive per-tenant env var prefix: e.g. "internal-prod" → TENANT_INTERNAL_PROD
    const tenantEnvPrefix = `TENANT_${tenantId.replace(/-/g, '_').toUpperCase()}`;

    // Try loading deferred credentials if per-tenant vars are missing
    if (!process.env[`${tenantEnvPrefix}_USERNAME`] && !process.env[`${tenantEnvPrefix}_API_KEY`]) {
      this.loadDeferredCredentials();
    }

    // Priority: per-tenant env var > global override > value from tenants.json
    const apiKey = process.env[`${tenantEnvPrefix}_API_KEY`] || process.env.API_KEY || tenant.apiKey;
    const username = process.env[`${tenantEnvPrefix}_USERNAME`] || process.env.IKM_ADMIN_USERNAME || tenant.username;
    const password = process.env[`${tenantEnvPrefix}_PASSWORD`] || process.env.IKM_ADMIN_PASSWORD || tenant.password;

    return {
      ...tenant,
      apiUrl: process.env[`${tenantEnvPrefix}_API_URL`] || tenant.apiUrl,
      apiKey,
      username,
      password,
    };
  }
}
