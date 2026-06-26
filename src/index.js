import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { KlickTippClient } from "./klicktipp-client.js";
import { getToolDefinitions } from "./tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const server = new McpServer({
  name: "klicktipp-mcp",
  version: "0.2.0",
});

const client = new KlickTippClient(process.env);

for (const tool of getToolDefinitions(client, process.env)) {
  server.tool(tool.name, tool.description, tool.inputSchema, tool.callback);
}

const transport = new StdioServerTransport();
await server.connect(transport);
