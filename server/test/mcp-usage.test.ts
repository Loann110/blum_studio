// MCP usage: every registered tool call that names a design is recorded.
import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools, server } from "../mcp/main.js";
import { readUsage } from "../usage.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("mcp-usage");

test("tools record design calls only, and never after a delete", async () => {
  registerTools();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "mcp-usage-test", version: "0.0.1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const textOf = (msg: unknown): string => {
    const content = (msg as { content?: Array<{ type?: unknown; text?: unknown }> }).content;
    if (!Array.isArray(content)) return "";
    return content.map((c) => (c.type === "text" && typeof c.text === "string" ? c.text : "")).join("");
  };
  try {
    // create_design names no design_id: its returned id is the one recorded.
    const created = await client.callTool({ name: "create_design", arguments: { name: "MCP usage", format: "story" } });
    const made = JSON.parse(textOf(created)) as { id: string };
    assert.equal((readUsage(made.id) as NonNullable<ReturnType<typeof readUsage>>).calls, 1);

    // A call that names no design leaves the record alone.
    await client.callTool({ name: "list_formats", arguments: {} });
    await client.callTool({ name: "get_design", arguments: { design_id: made.id } });
    assert.equal((readUsage(made.id) as NonNullable<ReturnType<typeof readUsage>>).calls, 2);

    // The delete call itself must not recreate the sidecar it removed.
    await client.callTool({ name: "delete_draft", arguments: { design_id: made.id } });
    assert.equal(readUsage(made.id), null);
  } finally {
    await client.close();
    await server.close();
  }
});
