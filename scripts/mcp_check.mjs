// Phase-3 MCP check: drive the Node MCP over stdio with raw JSON-RPC.
// create -> apply_ops -> check -> preview -> export -> undo -> delete.
// Usage: node scripts/mcp_check.mjs [designs-dir]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expectedVersion = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf-8"),
).version;

const dir = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), "blum-mcp-check-"));
process.env.BLUM_DESIGNS = dir;

const child = spawn("node", ["server/dist/mcp.js"], { stdio: ["pipe", "pipe", "inherit"], env: process.env });
let nextId = 1;
const pending = new Map();
let buf = "";
child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

async function call(name, args) {
  const res = await send("tools/call", { name, arguments: args });
  if (res.error) throw new Error(`${name}: ${JSON.stringify(res.error)}`);
  return res.result.content.map((c) => c.text ?? "").join("");
}

const text = (t) => {
  const v = JSON.parse(t);
  if (v.ok === false) throw new Error(`tool error: ${v.error}`);
  return v;
};

const hello = await send("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "phase3-check", version: "0.0.1" },
});
if (hello.error) throw new Error(`initialize: ${JSON.stringify(hello.error)}`);
const announced = hello.result?.serverInfo?.version;
console.log("server", hello.result?.serverInfo?.name, announced);
if (announced !== expectedVersion) throw new Error(`MCP announces ${announced}, package.json says ${expectedVersion}`);
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const created = text(await call("create_design", { name: "Phase3", format: "story" }));
const id = created.id;
console.log("created", id);
const applied = text(await call("apply_ops", { design_id: id, ops: [{ op: "add", item: { id: "t", name: "t", type: "text", x: 540, y: 400, width: 900, height: 200, props: { text: "Hi", font: "Inter", size: 96, color: "#111111" } } }] }));
console.log("applied", JSON.stringify(applied));
const check = JSON.parse(await call("check_design", { design_id: id }));
console.log("score", check.score, "findings", check.findings.length);
const shot = await send("tools/call", { name: "preview", arguments: { design_id: id } });
const part = shot.result.content[0];
if (part.type !== "image" || !part.data) throw new Error("preview did not return an image");
console.log("preview image", part.mimeType, part.data.length);
const out = path.join(dir, "mcp-check.png");
const exported = text(await call("export_png", { design_id: id, out_path: out }));
console.log("exported", exported.path, fs.statSync(out).size, "bytes");
const undone = JSON.parse(await call("undo", { design_id: id }));
console.log("undone", undone.undone, "items", undone.design.items.length);
const deleted = text(await call("delete_draft", { design_id: id }));
console.log("deleted", JSON.stringify(deleted));
child.kill();
process.exit(0);
