// The sticker catalogue follows the files on disk: a deleted file disappears
// from the listing and is refused by the MCP, without a restart.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { STICKERS_TTL_MS, searchStickers } from "../resources.js";
import { badSticker } from "../mcp/trust.js";

test("a sticker whose file is deleted leaves the catalogue", async () => {
  const assets = fs.mkdtempSync(path.join(os.tmpdir(), "blum-stickers-"));
  const pack = path.join(assets, "stickers", "pack");
  fs.mkdirSync(pack, { recursive: true });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';
  fs.writeFileSync(path.join(pack, "kept.svg"), svg);
  fs.writeFileSync(path.join(pack, "gone.svg"), svg);
  fs.writeFileSync(path.join(assets, "stickers", "manifest.json"), JSON.stringify([
    { id: "pack/kept", file: "pack/kept.svg", label: "Kept" },
    { id: "pack/gone", file: "pack/gone.svg", label: "Gone" },
    { id: "pack/never", file: "pack/never.svg", label: "Never there" },
  ]));
  const before = process.env.BLUM_ASSETS;
  process.env.BLUM_ASSETS = assets;
  try {
    const ids = (): string[] => searchStickers("", 100).map((e) => String(e.file));
    assert.deepEqual(ids(), ["pack/kept.svg", "pack/gone.svg"]);
    fs.unlinkSync(path.join(pack, "gone.svg"));
    await new Promise((r) => setTimeout(r, STICKERS_TTL_MS + 100));
    assert.deepEqual(ids(), ["pack/kept.svg"]);
    assert.equal(badSticker("pack/kept.svg", 0), null);
    assert.match(String(badSticker("pack/gone.svg", 0)), /unknown sticker/);
  } finally {
    if (before === undefined) delete process.env.BLUM_ASSETS;
    else process.env.BLUM_ASSETS = before;
  }
});
