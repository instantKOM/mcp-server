#!/usr/bin/env bash
# MCP Server Launcher with environment-aware credential resolution
#
# Usage in .mcp.json:
#   "command": "bash",
#   "args": ["./services/mcp-server/mcp-run.sh"],
#   "env": { "TENANT_ID": "local" }
#
# Supported TENANT_IDs:
#   local      - Local dev (localhost:3002), API key from DB
#   staging    - Staging (api.staging.instantkom.de), API key from vault
#   production - Production (api.instantkom.app), API key from vault
#
# The script resolves API_KEY and API_URL automatically, then starts the MCP server.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TENANT_ID="${TENANT_ID:-local}"

# Resolve API_URL and API_KEY based on TENANT_ID
case "$TENANT_ID" in
  local|internal)
    export API_URL="http://localhost:3002"
    export TENANT_ID="internal"
    # Read API key from local DB if not already set
    # Prefer the seeded instantkom dev account (uid=363) - matches the local admin user
    if [ -z "${API_KEY:-}" ]; then
      DB_QUERY="$PROJECT_ROOT/dev/db/query.sh"
      if [ -x "$DB_QUERY" ]; then
        API_KEY=$(
          "$DB_QUERY" --raw "SELECT CONCAT(a.user, a.pass) FROM apis2 a JOIN usrs u ON u.id=a.uid WHERE a.sts=1 AND u.usr='instantkom' ORDER BY a.id ASC LIMIT 1" 2>/dev/null \
          | tail -1 \
          | tr -d '\n\r'
        )
        # Fallback: any active API key
        if [ -z "$API_KEY" ]; then
          API_KEY=$(
            "$DB_QUERY" --raw "SELECT CONCAT(user, pass) FROM apis2 WHERE sts=1 LIMIT 1" 2>/dev/null \
            | tail -1 \
            | tr -d '\n\r'
          )
        fi
      fi
      if [ -z "${API_KEY:-}" ]; then
        echo "[mcp-run] WARN: No API key found in local DB. MCP tools requiring auth will fail." >&2
      fi
      export API_KEY
    fi
    # For admin endpoints: resolve JWT credentials.
    # Local dev uses the seeded account (instantkom@instantkom.app / $(vault-get instantkom-test-accounts password))
    # from the CmcomAccountSeeder (services/backend/seeds/, issue #4242) - not a secret.
    # Override via env IKM_ADMIN_USERNAME/PASSWORD or vault entry "local-mcp-admin".
    if [ -z "${IKM_ADMIN_USERNAME:-}" ]; then
      if command -v vault-get &>/dev/null; then
        IKM_ADMIN_USERNAME=$(vault-get local-mcp-admin username 2>/dev/null || true)
        IKM_ADMIN_PASSWORD=$(vault-get local-mcp-admin password 2>/dev/null || true)
      fi
      # Default to seeded local account if still unset
      export IKM_ADMIN_USERNAME="${IKM_ADMIN_USERNAME:-instantkom@instantkom.app}"
      export IKM_ADMIN_PASSWORD="${IKM_ADMIN_PASSWORD:-$(vault-get instantkom-test-accounts password)}"
      echo "[mcp-run] JWT auth configured (user: $IKM_ADMIN_USERNAME)" >&2
    fi
    ;;

  staging)
    export API_URL="https://api.staging.instantkom.de"
    export TENANT_ID="staging"
    if [ -z "${API_KEY:-}" ]; then
      if command -v vault-get &>/dev/null; then
        API_KEY=$(vault-get staging-mcp-api-key password 2>/dev/null || true)
      fi
      if [ -z "${API_KEY:-}" ]; then
        echo "[mcp-run] WARN: No staging API key in vault (staging-mcp-api-key). MCP tools requiring auth will fail." >&2
        echo "[mcp-run] HINT: Add via: vault-add staging-mcp-api-key --user mcp --password <key>" >&2
      fi
      export API_KEY
    fi
    ;;

  production|internal-prod)
    export API_URL="https://api.instantkom.app"
    export TENANT_ID="internal-prod"
    # Production uses JWT auth (admin scope) - API key is optional fallback
    if [ -z "${IKM_ADMIN_USERNAME:-}" ]; then
      if command -v vault-get &>/dev/null; then
        IKM_ADMIN_USERNAME=$(vault-get instantkom-prod-admin username 2>/dev/null || true)
        IKM_ADMIN_PASSWORD=$(vault-get instantkom-prod-admin password 2>/dev/null || true)
      fi
      export IKM_ADMIN_USERNAME="${IKM_ADMIN_USERNAME:-}"
      export IKM_ADMIN_PASSWORD="${IKM_ADMIN_PASSWORD:-}"
      if [ -n "$IKM_ADMIN_USERNAME" ]; then
        echo "[mcp-run] JWT auth configured for production (user: $IKM_ADMIN_USERNAME)" >&2
      else
        echo "[mcp-run] WARN: No production credentials found. Add instantkom-prod-admin to vault." >&2
      fi
    fi
    # API key as optional fallback for v1/* endpoints
    if [ -z "${API_KEY:-}" ]; then
      export API_KEY=""
    fi
    ;;

  *)
    echo "[mcp-run] ERROR: Unknown TENANT_ID '$TENANT_ID'. Use: local, staging, production" >&2
    exit 1
    ;;
esac

# ── Export active tenant credentials with per-tenant prefix ──────
# The case block above already resolved credentials for the active tenant.
# Re-export them with the per-tenant env prefix so ConfigLoader.getTenantWithEnvOverrides()
# can find them when the same tenant is accessed after a switch cycle.
case "$TENANT_ID" in
  internal)
    export TENANT_INTERNAL_API_URL="${API_URL}"
    export TENANT_INTERNAL_API_KEY="${API_KEY:-}"
    export TENANT_INTERNAL_USERNAME="${IKM_ADMIN_USERNAME:-}"
    export TENANT_INTERNAL_PASSWORD="${IKM_ADMIN_PASSWORD:-}"
    # Customer Public API tenant shares the local API URL and the same API key
    export TENANT_CUSTOMER_LOCAL_API_URL="${API_URL}"
    export TENANT_CUSTOMER_LOCAL_API_KEY="${API_KEY:-}"
    ;;
  staging)
    export TENANT_STAGING_API_URL="${API_URL}"
    export TENANT_STAGING_API_KEY="${API_KEY:-}"
    ;;
  internal-prod)
    export TENANT_INTERNAL_PROD_API_URL="${API_URL}"
    export TENANT_INTERNAL_PROD_USERNAME="${IKM_ADMIN_USERNAME:-}"
    export TENANT_INTERNAL_PROD_PASSWORD="${IKM_ADMIN_PASSWORD:-}"
    ;;
esac

# ── Resolve credentials for OTHER tenants in background ──────
# Writes results to a shared env file that the Node process can reload on tenant switch.
# This avoids blocking startup (~6s per vault-get call).
CRED_FILE="/tmp/mcp-tenant-creds-$$.env"
export MCP_DEFERRED_CREDS_FILE="$CRED_FILE"

resolve_other_tenant_creds() {
  local TMPDIR
  TMPDIR=$(mktemp -d)

  if command -v vault-get &>/dev/null; then
    # Only resolve tenants NOT already resolved by the case block
    case "$TENANT_ID" in
      internal)
        # Need: staging + production
        ( vault-get staging-mcp-api-key password    > "$TMPDIR/staging_key" 2>/dev/null || true ) &
        ( vault-get instantkom-prod-admin username   > "$TMPDIR/prod_user"  2>/dev/null || true ) &
        ( vault-get instantkom-prod-admin password   > "$TMPDIR/prod_pass"  2>/dev/null || true ) &
        ;;
      staging)
        # Need: internal + production
        ( vault-get local-mcp-admin username         > "$TMPDIR/int_user"   2>/dev/null || true ) &
        ( vault-get local-mcp-admin password         > "$TMPDIR/int_pass"   2>/dev/null || true ) &
        ( vault-get instantkom-prod-admin username   > "$TMPDIR/prod_user"  2>/dev/null || true ) &
        ( vault-get instantkom-prod-admin password   > "$TMPDIR/prod_pass"  2>/dev/null || true ) &
        ;;
      internal-prod)
        # Need: internal + staging
        ( vault-get local-mcp-admin username         > "$TMPDIR/int_user"   2>/dev/null || true ) &
        ( vault-get local-mcp-admin password         > "$TMPDIR/int_pass"   2>/dev/null || true ) &
        ( vault-get staging-mcp-api-key password    > "$TMPDIR/staging_key" 2>/dev/null || true ) &
        ;;
    esac
  fi

  # Also resolve local Public API key from apis2 table (always - for customer-local tenant)
  # Prefer the seeded instantkom dev account (uid=363, usr='instantkom')
  local DB_QUERY="$PROJECT_ROOT/dev/db/query.sh"
  if [ -x "$DB_QUERY" ]; then
    ( "$DB_QUERY" --raw "SELECT CONCAT(a.user, a.pass) FROM apis2 a JOIN usrs u ON u.id=a.uid WHERE a.sts=1 AND u.usr='instantkom' ORDER BY a.id ASC LIMIT 1" 2>/dev/null \
      | tail -1 | tr -d '\n\r' > "$TMPDIR/local_api_key" || true ) &
  fi

  wait

  # Default to seeded local account if vault lookup yielded nothing
  if [ ! -s "$TMPDIR/int_user" ]; then
    printf 'instantkom@instantkom.app' > "$TMPDIR/int_user"
  fi
  if [ ! -s "$TMPDIR/int_pass" ]; then
    printf '$(vault-get instantkom-test-accounts password)' > "$TMPDIR/int_pass"
  fi

  # Write all resolved credentials to env file
  {
    echo "TENANT_INTERNAL_API_URL=http://localhost:3002"
    echo "TENANT_STAGING_API_URL=https://api.staging.instantkom.de"
    echo "TENANT_INTERNAL_PROD_API_URL=https://api.instantkom.app"
    echo "TENANT_CUSTOMER_LOCAL_API_URL=http://localhost:3002"
    [ -s "$TMPDIR/local_api_key" ] && echo "TENANT_INTERNAL_API_KEY=$(cat "$TMPDIR/local_api_key" | tr -d '\n\r')"
    [ -s "$TMPDIR/local_api_key" ] && echo "TENANT_CUSTOMER_LOCAL_API_KEY=$(cat "$TMPDIR/local_api_key" | tr -d '\n\r')"
    [ -f "$TMPDIR/int_user" ]      && echo "TENANT_INTERNAL_USERNAME=$(cat "$TMPDIR/int_user" | tr -d '\n\r')"
    [ -f "$TMPDIR/int_pass" ]      && echo "TENANT_INTERNAL_PASSWORD=$(cat "$TMPDIR/int_pass" | tr -d '\n\r')"
    [ -f "$TMPDIR/staging_key" ]   && echo "TENANT_STAGING_API_KEY=$(cat "$TMPDIR/staging_key" | tr -d '\n\r')"
    [ -f "$TMPDIR/prod_user" ]     && echo "TENANT_INTERNAL_PROD_USERNAME=$(cat "$TMPDIR/prod_user" | tr -d '\n\r')"
    [ -f "$TMPDIR/prod_pass" ]     && echo "TENANT_INTERNAL_PROD_PASSWORD=$(cat "$TMPDIR/prod_pass" | tr -d '\n\r')"
  } > "$CRED_FILE"

  rm -rf "$TMPDIR"
  echo "[mcp-run] Deferred tenant credentials resolved -> $CRED_FILE" >&2
}

# Run in background - server starts immediately, creds arrive later
resolve_other_tenant_creds &

echo "[mcp-run] Starting MCP server: TENANT_ID=$TENANT_ID API_URL=$API_URL API_KEY=${API_KEY:+SET}" >&2

exec node "$SCRIPT_DIR/dist/index.js"
