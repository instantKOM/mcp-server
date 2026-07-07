# Multi-stage Dockerfile for the instantKOM Remote-MCP HTTP gateway.
#
# Runtime entrypoint: `node dist/index.http.js` (the StreamableHTTP/SSE gateway,
# NOT the stdio server). A customer connects with a URL + Bearer token; the
# gateway introspects the key against the NestJS API (apis2 resolver) and serves
# the tenant-bound MCP tool set.
#
# Build context: the REPO ROOT (`context: .`). The gateway depends on the
# workspace package `@instantkom/api-client` (file:../../packages/api-client),
# which has NO committed dist -- it MUST be built inside the image. The builder
# reproduces the repo's relative layout (/build/packages/api-client +
# /build/services/mcp-server) so npm's `file:` link resolves, and the runtime
# stage keeps the SAME absolute paths so that link still resolves at runtime.

# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:22-alpine AS builder

# Reproduce the repo-relative layout the `file:` dependency expects.
WORKDIR /build

# tsconfig.base.json is extended by packages/api-client/tsconfig.json.
COPY tsconfig.base.json ./tsconfig.base.json

# Build the workspace dependency first (pure TS, no runtime deps -> just needs
# its own devDeps: typescript + @types/node). Without this the api-client `main`
# (dist/index.js) is missing and the mcp-server build fails to resolve it.
# Surgical COPYs (not the whole dir) so a local node_modules/dist in the root
# build context is never dragged in -- keeps the build hermetic + fast.
COPY packages/api-client/package.json packages/api-client/package-lock.json packages/api-client/tsconfig.json ./packages/api-client/
COPY packages/api-client/src ./packages/api-client/src
WORKDIR /build/packages/api-client
RUN npm ci --no-audit --no-fund && npm run build

# Build the gateway. `npm ci` resolves file:../../packages/api-client to the
# freshly built package above (npm creates the node_modules/@instantkom link).
WORKDIR /build/services/mcp-server
COPY services/mcp-server/package.json services/mcp-server/package-lock.json services/mcp-server/tsconfig.json ./
COPY services/mcp-server/src ./src
# `scripts/` holds the post-tsc asset copier (copy-playbook-assets.mjs, #5319)
# that mirrors src/playbooks/**/{meta.json,skill.md} into dist -- the `build`
# script invokes it, so it must be present in the builder context.
COPY services/mcp-server/scripts ./scripts
RUN npm ci --no-audit --no-fund && npm run build

# =============================================================================
# Stage 2: Runtime
# =============================================================================
FROM node:22-alpine

# Version metadata (set by CI/CD; surfaced to Sentry release tagging).
ARG BRANCH_NAME=local
ARG VERSION_NUMBER=0.0.0
ENV APP_VERSION=$VERSION_NUMBER
ENV APP_ENVIRONMENT=$BRANCH_NAME

# Upgrade Alpine packages to pick up OS-level CVE fixes, add dumb-init for
# proper PID-1 signal handling (the gateway installs SIGINT/SIGTERM handlers).
RUN apk upgrade --no-cache && apk add --no-cache dumb-init

# Keep the EXACT builder paths so the npm `file:` symlink
# (services/mcp-server/node_modules/@instantkom/api-client -> packages/api-client)
# still resolves at runtime.
WORKDIR /build/services/mcp-server
COPY --from=builder /build/packages/api-client /build/packages/api-client
COPY --from=builder /build/services/mcp-server /build/services/mcp-server

# Drop privileges: run as the built-in unprivileged `node` user. The gateway
# never writes to the filesystem, so read-only root-owned files are fine.
USER node

ENV NODE_ENV=production
# Bind to Caddy's staging convention port so `mcp.staging -> mcp.internal:8080`
# routes without extra config. Override via MCP_HTTP_PORT if needed.
ENV MCP_HTTP_PORT=8080
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_BASE_PATH=/mcp

EXPOSE 8080

# Liveness: the gateway serves an unauthenticated GET /health -> {"status":"ok"}.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.MCP_HTTP_PORT||8080)+'/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.http.js"]
