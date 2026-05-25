// Real MCP smoke test: spawns our server over stdio, lists tools, and calls
// explain_revert with the preset (which hits the live testnet). Run: npm run mcp:smoke
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/mcp/server.ts"],
});
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("Tools:", tools.tools.map((t) => t.name).join(", "));

const res = await client.callTool({
  name: "explain_revert",
  arguments: {
    network: "testnet",
    to: "0x0000000000000000000000000000000000000064",
    data: "0x70a082310000000000000000000000001111111111111111111111111111111111111111",
  },
});
const content = res.content as { type: string; text?: string }[];
console.log("\nexplain_revert result:\n" + (content[0]?.text ?? JSON.stringify(res)));

await client.close();
