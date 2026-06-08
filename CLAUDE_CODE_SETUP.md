# Claude Code Setup Guide

This guide explains how to integrate the instantKOM MCP Server with Claude Code.

## Prerequisites

- Node.js 18 or higher installed
- Claude Code installed on your system
- Access to the instantKOM REST API

## Step 1: Build the MCP Server

```bash
cd services/mcp-server
npm install
npm run build
```

This will compile the TypeScript code to the `dist/` directory.

## Step 2: Locate Claude Code Configuration

The Claude Code configuration file is located at:
- **macOS/Linux**: `~/.config/claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

If the file doesn't exist, create it with an empty JSON object:
```json
{
  "mcpServers": {}
}
```

## Step 3: Add MCP Server Configuration

Edit the configuration file and add the instantKOM MCP server:

```json
{
  "mcpServers": {
    "instantkom": {
      "command": "node",
      "args": [
        "/absolute/path/to/instantkom/services/mcp-server/dist/index.js"
      ],
      "env": {
        "TENANT_ID": "internal"
      }
    }
  }
}
```

**Important:** Replace `/absolute/path/to/instantkom` with the actual absolute path to your instantKOM repository.

### Development Configuration (with Auto-Reload)

For development, you can use `tsx` to run the TypeScript code directly with auto-reload:

```json
{
  "mcpServers": {
    "instantkom": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/instantkom/services/mcp-server/src/index.ts"
      ],
      "env": {
        "TENANT_ID": "internal"
      }
    }
  }
}
```

## Step 4: Configure Tenant

The `TENANT_ID` environment variable determines which tenant configuration to use. Available tenants are defined in `services/mcp-server/src/config/tenants.json`.

Default tenants:
- `internal` - Full admin access to local API
- `internal-prod` - Admin access to production API
- `customer-app` - Customer app-level access
- `customer-readonly` - Customer read-only access

You can also override the API URL and key using environment variables:

```json
{
  "mcpServers": {
    "instantkom": {
      "command": "node",
      "args": [
        "/absolute/path/to/instantkom/services/mcp-server/dist/index.js"
      ],
      "env": {
        "TENANT_ID": "internal",
        "API_URL": "http://localhost:3002",
        "API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Step 5: Restart Claude Code

After editing the configuration, completely restart Claude Code for the changes to take effect.

## Step 6: Verify Installation

Open Claude Code and check the available MCP tools. You should see instantKOM tools listed:

- `get_health`
- `list_channels`
- `get_channel`
- `create_channel`
- And more...

Try running a simple command:
```
Use the get_health tool to check the API status
```

## Usage Examples

### List Channels
```
List all channels using the instantKOM API
```

### Create a Contact
```
Create a new contact in channel 505 with phone number +491701234567 and name "Test Contact"
```

### Send a Message
```
Send a message "Hello World" to contact 123 via channel 505
```

### Get Platform Statistics (Admin Only)
```
Show me the platform statistics
```

## Troubleshooting

### Tools Not Appearing

**Check the log output:**
1. Open Claude Code settings
2. Go to MCP Servers section
3. Check the logs for the instantKOM server

**Common issues:**
- Incorrect path in configuration
- Tenant not found (check `TENANT_ID` matches a tenant in `tenants.json`)
- API key missing or invalid
- Node.js not in PATH

### API Errors

If tools are available but return errors:
1. Verify the API is running (`http://localhost:3002/v1/health`)
2. Check the API key is valid
3. Ensure the tenant has the correct scope for the tool

### Server Won't Start

Check the stderr logs in Claude Code's MCP server output:
- `[ERROR] Tenant 'xyz' not found` - Invalid `TENANT_ID`
- `Failed to load tenant configuration` - Check `tenants.json` syntax
- `ECONNREFUSED` - API server not running

## Advanced Configuration

### Multiple Tenants

You can configure multiple instances of the MCP server with different tenants:

```json
{
  "mcpServers": {
    "instantkom-local": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "TENANT_ID": "internal"
      }
    },
    "instantkom-prod": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "TENANT_ID": "internal-prod"
      }
    }
  }
}
```

### Custom Logging

Enable debug logging:
```json
{
  "mcpServers": {
    "instantkom": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "TENANT_ID": "internal",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Next Steps

- Explore all available tools in Claude Code
- Configure custom tenants for your use case
- Set up production access for your team
- Automate workflows using the MCP tools

For more information, see the main [README.md](README.md).
