# Agent Instructions

When setting up this MCP server on behalf of a user:

1. Before creating `.env`, add a deny rule to `.claude/settings.json` blocking Read and Bash access to `.env` for this project.
2. After creating `.env` from `.env.example`, stop and ask the human to fill in the values themselves. Do not read `.env` afterwards, even to verify it.
3. Confirm `.env` is gitignored before finishing.
4. Never write credentials into `.mcp.json` or any other config file without first explicitly asking the user for permission to do so.
5. Default to `KT_TOOL_MODE=readonly`, `KT_ENABLE_WRITES=false`, and `KT_ENABLE_DESTRUCTIVE=false` unless the user explicitly asks otherwise.
