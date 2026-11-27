// Media over HTTP: multipart upload, JSON url upload, serving files.
import test from "node:test";
import assert from "node:assert/strict";
import { liveServer, multipart, tinyPng, useTempDesigns } from "./helpers.js";

useTempDesigns("media");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);

test("media upload roundtrip", async () => {
  const c = await liveServer();
  try {
    const id = ((await (await c.post("/api/designs", { name: "Tour" })).json()) as { id: string }).id;
    const guard = { "X-Blum-Request": "1", origin: c.base };
    const { body, boundary } = multipart("file", "cake.png", PNG, "image/png");
    const res = await c.raw(`/api/designs/${id}/media`, {
      method: "POST",
      headers: { ...guard, "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    assert.equal(res.status, 200);
    assert.ok((res.json() as { src: string }).src.endsWith(".png"));
    const badFile = multipart("file", "note.txt", Buffer.from("hello"), "text/plain");
    const bad = await c.raw(`/api/designs/${id}/media`, {
      method: "POST",
      headers: { ...guard, "content-type": `multipart/form-data; boundary=${badFile.boundary}` },
      body: badFile.body,
    });
    assert.equal(bad.status, 400);
    const missing = multipart("file", "a.png", PNG, "image/png");
    assert.equal(
      (
        await c.raw("/api/designs/nope-123/media", {
          method: "POST",
          headers: { ...guard, "content-type": `multipart/form-data; boundary=${missing.boundary}` },
          body: missing.body,
        })
      ).status,
      404,
    );
  } finally {
    await c.close();
  }
});

test("media serves uploaded files and 404s unknown names", async () => {
  const c = await liveServer();
  try {
    const id = ((await (await c.post("/api/designs", { name: "Tour" })).json()) as { id: string }).id;
    const up = multipart("file", "tiny.png", tinyPng(), "image/png");
    const res = await c.raw(`/api/designs/${id}/media`, {
      method: "POST",
      headers: { "X-Blum-Request": "1", origin: c.base, "content-type": `multipart/form-data; boundary=${up.boundary}` },
      body: up.body,
    });
    const src = (res.json() as { src: string }).src;
    const got = await c.get(`/api/${src}`);
    assert.equal(got.status, 200);
    assert.equal(got.headers.get("content-type"), "image/png");
    assert.equal(got.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await c.get("/api/media/nope.png")).status, 404);
    assert.equal((await c.get("/api/media/../x.png")).status, 404);
  } finally {
    await c.close();
  }
});

test("svg media is served sandboxed with nosniff", async () => {
  const c = await liveServer();
  try {
    const id = ((await (await c.post("/api/designs", { name: "Tour" })).json()) as { id: string }).id;
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#111111"/></svg>',
    );
    const up = multipart("file", "icon.svg", svg, "image/svg+xml");
    const res = await c.raw(`/api/designs/${id}/media`, {
      method: "POST",
      headers: { "X-Blum-Request": "1", origin: c.base, "content-type": `multipart/form-data; boundary=${up.boundary}` },
      body: up.body,
    });
    assert.equal(res.status, 200);
    const src = (res.json() as { src: string }).src;
    const got = await c.get(`/api/${src}`);
    assert.equal(got.status, 200);
    assert.equal(got.headers.get("content-type"), "image/svg+xml");
    assert.equal(got.headers.get("x-content-type-options"), "nosniff");
    assert.equal(
      got.headers.get("content-security-policy"),
      "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    );
  } finally {
    await c.close();
  }
});

test("url upload rejects missing urls", async () => {
  const c = await liveServer();
  try {
    const id = ((await (await c.post("/api/designs", { name: "Tour" })).json()) as { id: string }).id;
    assert.equal((await c.post(`/api/designs/${id}/media`, { filename: "x" })).status, 400);
  } finally {
    await c.close();
  }
});
