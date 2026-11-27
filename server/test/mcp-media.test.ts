// MCP media: import local files and URLs, evil filenames.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDesignTool } from "../mcp/tools/designs.js";
import { importImageTool } from "../mcp/tools/media.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("mcp-media");

function err(reply: string): string {
  return (JSON.parse(reply) as { error: string }).error;
}

function pngBytes(): Buffer {
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
      "0000000d49444154789c626001000000ffff03000006ff05000000000049454e44ae426082",
    "hex",
  );
}

test("import local file and bad inputs", async () => {
  const made = JSON.parse(createDesignTool("Media", "story")) as { id: string };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blum-mcp-media-"));
  const shot = path.join(dir, "hero.png");
  fs.writeFileSync(shot, pngBytes());
  const got = JSON.parse(await importImageTool(made.id, shot, "hero")) as { src: string };
  assert.ok(got.src.startsWith("media/") && got.src.endsWith(".png"));
  assert.ok(err(await importImageTool(made.id, path.join(dir, "missing.png"))).includes("not found"));
  const note = path.join(dir, "note.txt");
  fs.writeFileSync(note, "not an image", "utf-8");
  assert.ok(err(await importImageTool(made.id, note)).includes("not usable as media"));
  assert.ok(err(await importImageTool("no-such-id", shot)).includes("unknown design"));
  assert.ok(err(await importImageTool(made.id, "")).includes("http"));
});

test("evil filename stays in media", async () => {
  const made = JSON.parse(createDesignTool("Media jail", "story")) as { id: string };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blum-mcp-evil-"));
  const shot = path.join(dir, "hero.png");
  fs.writeFileSync(shot, pngBytes());
  const got = JSON.parse(await importImageTool(made.id, shot, "../../evil")) as { src: string };
  assert.ok(got.src.startsWith("media/"));
  assert.ok(!got.src.includes(".."));
});

test("http source to a private address is refused", async () => {
  const made = JSON.parse(createDesignTool("Remote", "story")) as { id: string };
  const { createServer } = await import("node:http");
  const data = pngBytes();
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "image/png" });
    res.end(data);
  });
  server.listen(0, "127.0.0.1");
  await new Promise((r) => setTimeout(r, 200));
  try {
    const port = (server.address() as { port: number }).port;
    const reply = await importImageTool(made.id, `http://127.0.0.1:${port}/y.png`);
    assert.ok(err(reply).includes("refused") && err(reply).includes("private"), reply);
  } finally {
    server.close();
  }
});
