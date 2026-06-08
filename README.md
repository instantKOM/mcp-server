# instantKOM MCP-Server

[![npm version](https://img.shields.io/npm/v/@instantkom/mcp-server.svg)](https://www.npmjs.com/package/@instantkom/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![API Documentation](https://img.shields.io/badge/API%20Docs-Swagger-orange)](https://api.instantkom.app/api-docs)

Model Context Protocol (MCP) server for the [instantKOM](https://instantkom.app) REST API.
Lets AI assistants like **Claude Code** and **Claude Desktop** drive your instantKOM
messengerzentrale through structured, type-safe tool calls.

## Features

- **230+ tools** covering full CRUD for Channels, Contacts, Messages, Newsletters, Bots, Flows, Analytics and more
- **Type-safe** — written in TypeScript, runs on Node.js 18+
- **Bearer-token auth** via your instantKOM API key
- **Standardized** — implements the official [Model Context Protocol](https://modelcontextprotocol.io)
- **MIT-licensed** — self-hosted use is welcome

## Quick start

### 1. Get an API key

1. Sign up at [instantkom.app](https://start.instantkom.app)
2. Settings → API Keys → create a new key
3. Copy the key (format: `ik_live_...`)

### 2. Configure your MCP client

Add to your Claude Code / Claude Desktop config:

**Claude Code:** project-local `.mcp.json` or `~/.config/claude/claude_desktop_config.json`
**Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`

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

### 3. Restart your client

Claude will now see the `instantkom` MCP server with all available tools.

## Configuration

| Environment variable | Description | Default |
|----------------------|-------------|---------|
| `INSTANTKOM_API_KEY` | Bearer token for the instantKOM API (**required**) | — |
| `INSTANTKOM_API_URL` | Override API base URL | `https://api.instantkom.app` |
| `LOG_LEVEL` | `error` / `warn` / `info` / `debug` | `info` |

## Tool overview

Tools are grouped by resource type. Each REST endpoint at
[api.instantkom.app/api-docs](https://api.instantkom.app/api-docs) has a corresponding MCP tool.

| Category | Examples | Tools |
|----------|----------|-------|
| Channels | `list_channels`, `create_channel`, `update_channel` | 7 |
| Contacts | `list_contacts`, `create_contact`, `update_contact` | 5 |
| Messaging | `send_message`, `list_messages`, `get_message` | 10 |
| Newsletters / Broadcasts | `list_broadcasts`, `create_broadcast`, `send_broadcast` | 6 |
| Bots & Flows | bot CRUD, flow nodes, flow edges | 38 |
| Templates & Tags | template + tag CRUD, tag assignment | 21 |
| Analytics | dashboard, broadcast, contact, message KPIs | 5 |
| Segmentation & QR | segmentation CRUD, QR codes, shortlinks | 13 |
| Tickets / Webhooks / Polls / Events / Media / Custom Fields / ... | full CRUD | 100+ |

## Examples

Once configured, you can prompt Claude in natural language:

```
> Send a newsletter to all "Premium" segment contacts.

⏺ I'll create the newsletter via WhatsApp.
   ⤷ create_broadcast(channel: "whatsapp", segment: "premium")
   ↳ 247 recipients · sending now.

⏺ Done. Sent to 247 Premium contacts. Show live analytics?
```

## Development

```bash
git clone https://github.com/instantKOM/mcp-server.git
cd mcp-server
npm install
npm run build
INSTANTKOM_API_KEY=ik_live_... node dist/index.public.js
```

To wire up your local build with Claude Code instead of npm:

```json
{
  "mcpServers": {
    "instantkom": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.public.js"],
      "env": {
        "INSTANTKOM_API_KEY": "ik_live_..."
      }
    }
  }
}
```

## Security

- API keys are passed as Bearer tokens. Treat them as secrets.
- All API calls go over HTTPS to `api.instantkom.app` by default.
- The MCP server runs locally on your machine — no instantKOM data passes through any third-party host.
- Audit log of every tool call is recorded server-side in your instantKOM account.

## Resources

- **API Documentation:** https://api.instantkom.app/api-docs
- **MCP Protocol Spec:** https://modelcontextprotocol.io
- **API Code Examples:** https://github.com/instantKOM/api-examples
- **Issues / Feature Requests:** https://github.com/instantKOM/mcp-server/issues

## License

MIT — see [LICENSE](./LICENSE).

## About instantKOM

instantKOM is a multi-channel messenger platform for B2B marketing and customer
communication. WhatsApp, Telegram, Signal, Threema, SMS — DSGVO-compliant, hosted in
Germany. Learn more at [instantkom.app](https://instantkom.app).
