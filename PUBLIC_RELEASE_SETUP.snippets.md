# Public Release Setup -- Snippets for Sister Repos

These snippets need to be applied **manually** to the two existing public
repos (`instantKOM/.github` and `instantKOM/api-examples`) once the
`instantKOM/mcp-server` repo is live.

---

## 1. Org-profile README (`instantKOM/.github/profile/README.md`)

Add a new entry to the **Quick Links** table and a new section for MCP.

### Quick Links table

Find this table in the existing `profile/README.md`:

```markdown
| Resource | Description |
|----------|-------------|
| [API Documentation](https://api.instantkom.app/api-docs) | Interactive Swagger/OpenAPI documentation |
| [Code Examples](https://github.com/instantKOM/api-examples) | Ready-to-use examples in multiple languages |
| ...
```

Add a row:

```markdown
| [MCP-Server](https://github.com/instantKOM/mcp-server) | Model Context Protocol server for Claude / AI assistants |
```

### New section (insert after "Features")

```markdown
## AI Integration

Use **[@instantkom/mcp-server](https://github.com/instantKOM/mcp-server)** to let
Claude Code, Claude Desktop, and other [MCP-compatible](https://modelcontextprotocol.io)
AI assistants drive your instantKOM messengerzentrale via natural language.

```json
{
  "mcpServers": {
    "instantkom": {
      "command": "npx",
      "args": ["-y", "@instantkom/mcp-server"],
      "env": {
        "INSTANTKOM_API_KEY": "ik_live_..."
      }
    }
  }
}
```

230+ tools, type-safe, MIT-licensed. See [the package on npm](https://www.npmjs.com/package/@instantkom/mcp-server).
```

---

## 2. api-examples Repo (`instantKOM/api-examples`)

### a) Add MCP folder

Create `mcp/README.md`:

```markdown
# MCP-Server example

[Model Context Protocol](https://modelcontextprotocol.io) configuration for
Claude Code / Claude Desktop.

## Quick start

1. Get your API key from [instantkom.app](https://start.instantkom.app) → Settings → API Keys.
2. Copy [.mcp.json](./.mcp.json) into your project (Claude Code) or merge it into
   `claude_desktop_config.json` (Claude Desktop).
3. Replace `ik_live_...` with your real key.
4. Restart your AI client.

The instantkom MCP server now exposes 230+ tools to Claude.

## Documentation

- Server source: https://github.com/instantKOM/mcp-server
- npm package: https://www.npmjs.com/package/@instantkom/mcp-server
- API reference: https://api.instantkom.app/api-docs
```

Create `mcp/.mcp.json`:

```json
{
  "mcpServers": {
    "instantkom": {
      "command": "npx",
      "args": ["-y", "@instantkom/mcp-server"],
      "env": {
        "INSTANTKOM_API_KEY": "ik_live_..."
      }
    }
  }
}
```

### b) Update top-level README

Find the language table:

```markdown
| Language | Folder | Prerequisites |
|----------|--------|---------------|
| PHP | [`/php`](./php) | PHP 7.4+ |
| JavaScript/Node.js | [`/javascript`](./javascript) | Node.js 14+ |
| Python | [`/python`](./python) | Python 3.7+ |
| .NET/C# | [`/dotnet`](./dotnet) | .NET 6.0+ |
| cURL | [`/curl`](./curl) | curl |
```

Add:

```markdown
| MCP (Claude / AI) | [`/mcp`](./mcp) | Node.js 18+ |
```

---

## How to apply

```
# In a temp dir on your local machine:
git clone https://github.com/instantKOM/.github.git
git clone https://github.com/instantKOM/api-examples.git

# Apply the changes above, then:
cd .github && git add -A && git commit -m "Add MCP-Server section" && git push
cd ../api-examples && git add -A && git commit -m "Add MCP example" && git push
```
