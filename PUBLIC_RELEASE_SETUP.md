# Public Release Setup -- instantKOM MCP-Server

This document describes the **one-time setup** needed to publish
`@instantkom/mcp-server` to npm and `instantKOM/mcp-server` to GitHub.

After the one-time setup, every push to `main` that touches
`services/mcp-server/**` will automatically:

1. Sync the sanitized folder to `github.com/instantKOM/mcp-server` (workflow: `sync-public-mcp-server.yml`)
2. Publish to npm if the version bumped (workflow: `publish-mcp-server.yml`)

---

## One-time setup steps (manual)

### Step 1 -- Create the public GitHub repo

```
gh repo create instantKOM/mcp-server \
  --public \
  --description "Model Context Protocol (MCP) Server for the instantKOM REST API" \
  --homepage "https://instantkom.app/mcp/"
```

Initialize with **at least one commit** (e.g. an empty README) so `main` exists --
the sync workflow checks out the existing `main` branch.

```
gh api -X PUT /repos/instantKOM/mcp-server/contents/README.md \
  -f message="initial commit" \
  -f content="$(echo -n '# instantKOM MCP-Server' | base64)"
```

Set repo topics:
```
gh api -X PUT /repos/instantKOM/mcp-server/topics \
  -F 'names[]=mcp' \
  -F 'names[]=model-context-protocol' \
  -F 'names[]=claude' \
  -F 'names[]=anthropic' \
  -F 'names[]=instantkom' \
  -F 'names[]=ai' \
  -F 'names[]=messaging' \
  -F 'names[]=whatsapp' \
  -F 'names[]=typescript'
```

### Step 2 -- Create the sync token

The sync workflow needs to push to `instantKOM/mcp-server` from the monorepo
runner. The same token is shared by all three public-repo sync workflows
(api-examples, cli-examples, mcp-server), stored once as `PUBLIC_SYNC_TOKEN`.

1. Go to https://github.com/settings/personal-access-tokens/new
2. Select **Fine-grained personal access token**
3. Resource owner: `instantKOM`
4. Repository access: ONLY the three public mirror repos --
   `instantKOM/api-examples`, `instantKOM/cli-examples`, `instantKOM/mcp-server`
5. Repository permissions: **Contents: Read and write** (Metadata: Read-only,
   auto-selected)
6. Expiration: per policy (set a renewal reminder)
7. Generate

   Least-privilege: this token can only touch the three mirror repos. A classic
   `public_repo` token also works but is broader (write to every public repo the
   account can reach) and is discouraged for this CI secret.

Add the token as the shared secret on the **monorepo**
(`virtualart-online/instantKOM`):
```
gh secret set PUBLIC_SYNC_TOKEN \
  --repo virtualart-online/instantKOM \
  --body "github_pat_..."
```

### Step 3 -- Configure npm Trusted Publisher (OIDC)

Pre-create the package on npm:
```
cd services/mcp-server
npm install
npm run build
npm publish --access public --provenance --dry-run   # validate
```

Then make a real first publish (or wait for the workflow):
- The package must exist on npm before Trusted Publishing can be configured.
- Either publish manually once via `npm publish --access public --provenance` (logged in as a maintainer of `@instantkom`)
- ...or run the workflow once via `workflow_dispatch` after configuring the publisher.

Configure the trusted publisher:
1. Go to https://www.npmjs.com/package/@instantkom/mcp-server/access (login required)
2. **Settings** -> **Publish Access** -> **Add GitHub Actions publisher**
3. Owner: `virtualart-online`
4. Repository: `instantKOM`
5. Workflow filename: `publish-mcp-server.yml`
6. Environment: leave empty
7. Save

### Step 4 -- Trigger first sync + publish

Once Step 1-3 are done, push any change under `services/mcp-server/` to `main`. Both workflows fire:

```
gh workflow run sync-public-mcp-server.yml --ref main
gh workflow run publish-mcp-server.yml --ref main
```

Monitor:
```
gh run list --workflow=sync-public-mcp-server.yml --limit 3
gh run list --workflow=publish-mcp-server.yml --limit 3
```

Verify:
- https://github.com/instantKOM/mcp-server -- folder content appears
- https://www.npmjs.com/package/@instantkom/mcp-server -- version appears

### Step 5 -- Update the org profile + api-examples

After the public mcp-server repo exists, the org-profile and api-examples
repos can be updated to reference it. See:
- `services/mcp-server/PUBLIC_RELEASE_SETUP.snippets.md` (org profile + api-examples patches)

---

## What gets sanitized in the sync

The sync workflow strips the following before pushing to the public repo:

| Removed | Reason |
|---------|--------|
| `src/config/tenants.json` | Contains internal API keys / tenant config |
| `src/tests/` | Internal integration tests with credentials |
| `src/tools/admin/` | Internal admin tools (platform stats, billing) |
| `src/tools/internal/` | Internal-only operations |
| `.env*` | Local config |
| `README.md` (replaced with `README.public.md`) | Internal README references monorepo paths |

`package.json` is rewritten to point only at `dist/index.public.js` and to drop
internal-only scripts.

The internal Git history is **not** synced -- the public repo gets a single
squashed commit per sync run referencing only the internal SHA. This avoids
leaking PR titles, ticket IDs, contributor emails, etc.

---

## Version bumping

Bump `version` in `services/mcp-server/package.json` on `dev` BEFORE merging the PR to `main`.

The publish workflow checks if the version is already on npm and skips if yes,
so it is safe to run on every main push. If the version is unchanged, only the
sync workflow runs (the GitHub repo always reflects the latest main, even
between version bumps).

---

## Disaster recovery

If the public repo gets corrupted, simply delete it and run Step 1 again. The next
push to main will rehydrate it via the sync workflow.

If the npm package gets unpublished or compromised, deprecate the bad version on
npm and bump to the next patch in the next PR.
