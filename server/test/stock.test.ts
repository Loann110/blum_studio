// Stock photos: keys stay server-side, search merges stock results, and
// import_image stores a stock photo with its credit.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "node:http";
import { createDesignTool } from "../mcp/tools/designs.js";
import { importImageTool } from "../mcp/tools/media.js";
import { listResourcesTool } from "../mcp/tools/resources.js";
import { setStockImageResolver } from "../stock.js";
import { liveServer, tinyPng, useTempDesigns } from "./helpers.js";

useTempDesigns("stock");

function err(reply: string): string {
  return (JSON.parse(reply) as { error: string }).error;
}

type Mode = "ok" | "invalid" | "error";

interface FakeStock {
  base: string;
  close(): Promise<void>;
}

// One local server stands in for both services; the base URL env vars point
// each service at /v1 (Pexels) or /api (Pixabay) on it.
function startFakeStock(pexels: Mode, pixabay: Mode = "ok"): Promise<FakeStock> {
  return new Promise((resolve) => {
    let port = 0;
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      const host = `http://127.0.0.1:${port}`;
      const json = (status: number, body: unknown): void => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (url.pathname === "/img.png") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(tinyPng());
        return;
      }
      if (url.pathname === "/v1/search") {
        if (pexels === "invalid") return json(401, {});
        if (pexels === "error") return json(500, {});
        return json(200, {
          photos: [{ id: 42, width: 1080, height: 720, avg_color: "#336699", photographer: "A. Photographer", url: "https://www.pexels.com/photo/42", alt: "Jazz band", src: { large2x: `${host}/img.png` } }],
        });
      }
      if (url.pathname === "/v1/photos/123") {
        if (pexels === "invalid") return json(401, {});
        return json(200, { id: 123, width: 1080, height: 720, photographer: "A. Photographer", url: "https://www.pexels.com/photo/123", src: { large2x: `${host}/img.png` } });
      }
      if (url.pathname === "/api" || url.pathname === "/api/") {
        if (pixabay === "invalid") return json(401, {});
        if (pixabay === "error") return json(500, {});
        return json(200, { hits: [{ id: 7, imageWidth: 1080, imageHeight: 720, user: "P. Photographer", pageURL: "https://pixabay.com/photos/7", largeImageURL: `${host}/img.png`, tags: "jazz, night" }] });
      }
      json(404, {});
    });
    server.listen(0, "127.0.0.1");
    // Windows may not have the port until the socket is listening: poll like the suite's liveServer helper.
    const ready = (): void => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        port = (addr as { port: number }).port;
        resolve({ base: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) });
      } else {
        setTimeout(ready, 25);
      }
    };
    ready();
  });
}

test("keys are stored but never returned; status reports true/false", async () => {
  const fake = await startFakeStock("invalid");
  process.env.PEXELS_API_BASE = `${fake.base}/v1`;
  const c = await liveServer();
  try {
    assert.deepEqual((await c.get("/api/stock")).json(), { pexels: false, pixabay: false });

    const key = "sekrit-pexels-123";
    const saved = await c.post("/api/stock", { service: "pexels", key });
    const body = saved.json() as { service: string; status: string; pexels: boolean; pixabay: boolean };
    assert.equal(body.status, "invalid key"); // the fake answers 401
    assert.equal(body.pexels, true);
    assert.ok(!saved.text.includes(key), "the key must never appear in an API answer");
    assert.ok(!JSON.stringify(body).includes(key));

    assert.deepEqual((await c.get("/api/stock")).json(), { pexels: true, pixabay: false });
    assert.ok(!(await c.get("/api/stock")).text.includes(key));

    const removed = (await c.post("/api/stock", { service: "pexels", key: "" })).json() as { status: string; pexels: boolean };
    assert.equal(removed.status, "not set");
    assert.equal(removed.pexels, false);
    assert.deepEqual((await c.get("/api/stock")).json(), { pexels: false, pixabay: false });
  } finally {
    await c.close();
    await fake.close();
    delete process.env.PEXELS_API_BASE;
  }
});

test("photo search merges the catalogue with stock and notes a failed service", async () => {
  const fake = await startFakeStock("error", "ok");
  process.env.PEXELS_API_KEY = "bad";
  process.env.PEXELS_API_BASE = `${fake.base}/v1`;
  process.env.PIXABAY_API_KEY = "good";
  process.env.PIXABAY_API_BASE = `${fake.base}/api`;
  try {
    const reply = JSON.parse(await listResourcesTool("photos", "floral")) as Array<Record<string, unknown>>;
    const ids = reply.map((r) => r.id);
    assert.ok(ids.includes("flower-dress-sea"), `local rows kept: ${ids.join(",")}`);
    assert.ok(ids.includes("pixabay:7"), `stock rows added: ${ids.join(",")}`);
    const note = reply.find((r) => typeof r.note === "string");
    assert.ok(note && String(note.note).includes("pexels unavailable: HTTP 500"), JSON.stringify(reply));
  } finally {
    await fake.close();
    delete process.env.PEXELS_API_KEY;
    delete process.env.PIXABAY_API_KEY;
    delete process.env.PEXELS_API_BASE;
    delete process.env.PIXABAY_API_BASE;
  }
});

test("import_image of pexels:<id> stores media and its credit", async () => {
  const fake = await startFakeStock("ok");
  process.env.PEXELS_API_KEY = "good";
  process.env.PEXELS_API_BASE = `${fake.base}/v1`;
  // The same injected resolver the ssrf suite uses: the guard itself stays.
  setStockImageResolver(async (host) => (host === "127.0.0.1" ? ["127.0.0.1"] : []));
  const made = JSON.parse(createDesignTool("Stock import", "story")) as { id: string };
  try {
    const got = JSON.parse(await importImageTool(made.id, "pexels:123", "hero")) as { src: string; path: string };
    assert.ok(got.src.startsWith("media/") && got.src.endsWith(".png"));
    assert.ok(fs.existsSync(got.path));
    const creditFile = `${got.path}.credit.json`;
    assert.ok(fs.existsSync(creditFile), "credit is recorded next to the media");
    const credit = JSON.parse(fs.readFileSync(creditFile, "utf-8")) as { photographer: string; page: string };
    assert.equal(credit.photographer, "A. Photographer");
    assert.equal(credit.page, "https://www.pexels.com/photo/123");
  } finally {
    await fake.close();
    setStockImageResolver(undefined);
    delete process.env.PEXELS_API_KEY;
    delete process.env.PEXELS_API_BASE;
  }
});

test("import_image with an invalid key says invalid key", async () => {
  const fake = await startFakeStock("invalid");
  process.env.PEXELS_API_KEY = "bad";
  process.env.PEXELS_API_BASE = `${fake.base}/v1`;
  const made = JSON.parse(createDesignTool("Bad key", "story")) as { id: string };
  try {
    const reply = await importImageTool(made.id, "pexels:123", "hero");
    assert.ok(err(reply).includes("invalid key"), reply);
  } finally {
    await fake.close();
    delete process.env.PEXELS_API_KEY;
    delete process.env.PEXELS_API_BASE;
  }
});
