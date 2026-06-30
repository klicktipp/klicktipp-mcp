# KlickTipp MCP Server

Local stdio MCP server for the KlickTipp Management API.

## Current status

This repository is designed for local use with MCP-compatible clients.

It is a tested snapshot of the current KlickTipp API and may not be maintained long-term.

By default, the server starts in a safer mode:

- is read-only by default
- requires explicit feature flags for write tools
- requires separate explicit feature flags for destructive tools
- supports dry-run for write and destructive actions
- requires confirmation parameters for destructive actions
- emits audit logs for write and destructive actions

Validate it carefully in your own environment before using it against real customer data.

### Intended usage levels

- Local demo use: read-only mode
- Internal tool use: read-only mode or explicitly enabled write mode
- Production partner integration: partner auth plus explicit write/destructive controls, testing, and customer-specific rollout validation

## What it does

For supported inputs, examples, and common response shapes, see [TOOLS.md](./TOOLS.md).

### Read-only tools

- `list_tags`
- `get_tag`
- `list_fields`
- `get_field`
- `list_opt_in_processes`
- `get_opt_in_process`
- `get_opt_in_process_redirect`
- `list_contacts`
- `get_contact`
- `search_contact`
- `search_tagged_contacts`

### Write tools

These tools are exposed only when:

- `KT_TOOL_MODE=full`
- `KT_ENABLE_WRITES=true`

- `create_tag`
- `update_tag`
- `create_or_update_contact`
- `update_contact`
- `tag_contact`
- `untag_contact`

### Destructive tools

These tools are exposed only when:

- `KT_TOOL_MODE=full`
- `KT_ENABLE_WRITES=true`
- `KT_ENABLE_DESTRUCTIVE=true`

- `delete_tag`
- `delete_contact`
- `unsubscribe_contact`

Authentication endpoints are handled internally by the server and are not exposed as user-facing MCP tools.

## Authentication

This server supports two authentication modes.

### 1. Developer key + customer key

Use:

- `KT_AUTH_MODE=partner`
- `KT_USERNAME`
- `KT_DEVELOPER_KEY`
- `KT_CUSTOMER_KEY`

This mode sends:

- `X-Un`
- `X-Ci`

`X-Ci` is derived from the developer key and customer key.

### 2. Username + password

Use:

- `KT_AUTH_MODE=session`
- `KT_USERNAME`
- `KT_PASSWORD`

This mode logs in to `/account/login` and reuses the returned session.

For production-ready, partner, and customer-facing integrations, KlickTipp recommends Developer Key + Customer Key authentication.

Username + Password is mainly intended for internal tools, testing, or short-lived integrations.

## OpenAPI spec date used

This project includes the OpenAPI spec used during implementation:

- `openapi/klicktipp-management.openapi.json`

Spec date used:

- `2026-06-04`

Source documentation used:

- [KlickTipp Management API Authentication](https://developers.klicktipp.com/guides/management-api-authentication)
- [KlickTipp Management API Guide](https://developers.klicktipp.com/guides/management-api)

## Requirements

- Node.js 18 or newer
- a KlickTipp account
- one supported authentication mode
- an MCP-compatible client such as Claude Desktop, Codex, or Cursor

## Installation

### 1. Clone the repository

```bash
git clone git@gitlab.com:klicktipp/ktdev/int/klicktipp-mcp-server.git
cd klicktipp-mcp-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the environment file

```bash
cp .env.example .env
```

### 4. Fill in `.env`

Session authentication example read tools only:

```dotenv
KT_BASE_URL=https://api.klicktipp.com
KT_TIMEOUT_MS=30000
KT_AUTH_MODE=session
KT_TOOL_MODE=readonly
KT_ENABLE_WRITES=false
KT_ENABLE_DESTRUCTIVE=false
KT_AUDIT_LOGS=true
KT_USERNAME=your-klicktipp-username
KT_PASSWORD=your-password
```

Partner authentication example read tools only:

```dotenv
KT_BASE_URL=https://api.klicktipp.com
KT_TIMEOUT_MS=30000
KT_AUTH_MODE=partner
KT_TOOL_MODE=readonly
KT_ENABLE_WRITES=false
KT_ENABLE_DESTRUCTIVE=false
KT_AUDIT_LOGS=true
KT_USERNAME=your-klicktipp-username
KT_DEVELOPER_KEY=your-developer-key-hex
KT_CUSTOMER_KEY=your-customer-key
```

To enable write tools:

```dotenv
KT_TOOL_MODE=full
KT_ENABLE_WRITES=true
KT_ENABLE_DESTRUCTIVE=false
```

To enable destructive tools as well:

```dotenv
KT_TOOL_MODE=full
KT_ENABLE_WRITES=true
KT_ENABLE_DESTRUCTIVE=true
```

## Client configuration

Ready-to-copy examples are provided in:

- `examples/claude-desktop.config.example.json`
- `examples/cursor.mcp.example.json`
- `examples/codex.config.example.toml`

### Claude Desktop

Add the server to:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Example:

```json
{
  "mcpServers": {
    "klicktipp": {
      "command": "node",
      "args": [
        "/absolute/path/to/klicktipp-mcp-server/src/index.js"
      ]
    }
  }
}
```

### Codex

Add the server to:

- `~/.codex/config.toml`

Example:

```toml
[mcp_servers.klicktipp]
command = "node"
args = ["/absolute/path/to/klicktipp-mcp-server/src/index.js"]
```

### Cursor

Add the server to one of:

- `~/.cursor/mcp.json`
- `.cursor/mcp.json`

Example:

```json
{
  "mcpServers": {
    "klicktipp": {
      "command": "node",
      "args": [
        "/absolute/path/to/klicktipp-mcp-server/src/index.js"
      ]
    }
  }
}
```

## Restart After Changes

After adding the server to your MCP client (Codex, Claude, Cursor):

1. Fully close the client.
2. Start it again.
3. Open a new chat.

If you change `.env` values later, for example feature flags such as `KT_TOOL_MODE`, `KT_ENABLE_WRITES`, or `KT_ENABLE_DESTRUCTIVE`, restart the MCP client again before testing.

## Testing Recommendations

Start with read-only checks such as:

- `list_tags`
- `list_fields`
- `list_opt_in_processes`

Before any real destructive action, run the same destructive tool first with `dry_run=true` and verify the target carefully.

## Start the server

The server is a stdio MCP server and is normally started by the MCP client. For a manual start:

```bash
npm start
```

## Testing

Run tests:

```bash
npm test
```

The current test suite validates:

- partner auth cipher generation
- KlickTipp grant URL format
- auth mode behavior
- tool exposure in readonly/write/destructive modes
- request payload mapping for MCP tools
- dry-run behavior for write and destructive tools
- structured 406 business error handling

## Quick verification

After configuring the server in your MCP client, try:

- `List my KlickTipp tags`
- `List my KlickTipp fields`
- `List my KlickTipp opt-in processes`

Then try a safe write operation with a test contact:

- `Create or update a KlickTipp contact with email test@example.com and fieldFirstName=Test`
- `Tag test@example.com with tag ID 12345`

## Notes

- Field keys must match KlickTipp field IDs exactly, for example `fieldFirstName`.
- Date and date-time custom fields should use Unix timestamps in seconds.
- Write and destructive tools return dry-run previews when `dry_run=true`.
- Destructive tools require `confirm: true` and `target_summary`.
- Audit logs are written to stderr in JSON format when `KT_AUDIT_LOGS=true`.
- This repository does not include any credentials.
