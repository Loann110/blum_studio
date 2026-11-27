// SSRF: import_image checks the design before any download, remote fetches
// refuse non-public destinations, and the render loads only our files.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { downloadImage, isBlockedIp, resolvePublicAddresses, type ResolveFn } from "../download.js";
import { closeBrowser, getOrLaunchBrowser } from "../export/browser.js";
import { guardRenderPage } from "../export/guard.js";
import { fileUrl, renderHtml } from "../export/png.js";
import { importImageTool } from "../mcp/tools/media.js";
import { tmpFile } from "../store.js";
import { tinyPng, useTempDesigns } from "./helpers.js";

useTempDesigns("ssrf");
after(() => closeBrowser());

test("import_image on an unknown design does not download", async () => {
  const reply = await importImageTool("s3-no-such-design", "http://127.0.0.1:9/x.png", "x");
  assert.ok((JSON.parse(reply) as { error: string }).error.includes("unknown design"), reply);
});

test("destination check refuses private ranges and accepts public", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1"]) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  for (const ip of ["::1", "::", "fe80::1", "fc00::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1"]) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"]) {
    assert.equal(isBlockedIp(ip), false, ip);
  }
});

test("host resolution refuses one private record", async () => {
  await assert.rejects(resolvePublicAddresses("[::1]"), /refused: private address/);
  await assert.rejects(resolvePublicAddresses("evil.test", async () => [{ address: "10.0.0.1", family: 4 }]), /refused: private address/);
  const addrs = await resolvePublicAddresses("safe.test", async () => [{ address: "93.184.216.34", family: 4 }]);
  assert.deepEqual(addrs, ["93.184.216.34"]);
});

test("download refuses a private literal without connecting", async () => {
  await assert.rejects(downloadImage("http://127.0.0.1:9/x.png"), /refused: private address/);
  await assert.rejects(downloadImage("https://10.0.0.1/x.png"), /refused: private address/);
});

test("a redirect to a private address is refused", async () => {
  const { createServer } = await import("node:http");
  const server = createServer((_req, res) => {
    res.writeHead(302, { location: "http://evil.test/x.png" });
    res.end();
  });
  server.listen(0, "127.0.0.1");
  await new Promise((r) => setTimeout(r, 200));
  try {
    const port = (server.address() as { port: number }).port;
    const resolve: ResolveFn = async (host) => {
      if (host === "evil.test") throw new Error("refused: private address 10.0.0.1 for 'evil.test'");
      if (host === "127.0.0.1") return ["127.0.0.1"];
      throw new Error(`unexpected host ${host}`);
    };
    await assert.rejects(downloadImage(`http://127.0.0.1:${port}/go`, resolve), /refused: private address/);
  } finally {
    server.close();
  }
});

test("a body over the cap is aborted", async () => {
  const { createServer } = await import("node:http");
  const resolve: ResolveFn = async (host) => {
    if (host === "127.0.0.1") return ["127.0.0.1"];
    throw new Error(`unexpected host ${host}`);
  };
  const big = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "image/png", "content-length": "26000000" });
    res.end(tinyPng());
  });
  big.listen(0, "127.0.0.1");
  await new Promise((r) => setTimeout(r, 200));
  try {
    const port = (big.address() as { port: number }).port;
    await assert.rejects(downloadImage(`http://127.0.0.1:${port}/big.png`, resolve), /larger than 25 MB/);
  } finally {
    big.close();
  }
  const stream = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    for (let i = 0; i < 26; i++) res.write("x".repeat(1_000_000));
    res.end();
  });
  stream.listen(0, "127.0.0.1");
  await new Promise((r) => setTimeout(r, 200));
  try {
    const port = (stream.address() as { port: number }).port;
    await assert.rejects(downloadImage(`http://127.0.0.1:${port}/stream`, resolve), /larger than 25 MB/);
  } finally {
    stream.close();
  }
});

test("a design pointing outside the assets makes no file request", async () => {
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "blum-ssrf-out-")), "outside.png");
  fs.writeFileSync(outside, tinyPng());
  const outsideUrl = fileUrl(outside);
  const design = {
    version: 1,
    name: "SSRF",
    format: "story",
    background: { kind: "color", color: "#ffffff" },
    items: [
      {
        id: "t",
        name: "t",
        type: "text",
        x: 540,
        y: 960,
        width: 900,
        height: 200,
        props: { text: "hi", font: "Inter", size: 64, color: `rgba(0,0,0,1);background:url(${outsideUrl})` },
      },
    ],
  };
  const html = renderHtml(design as never);
  assert.ok(html.includes(outsideUrl), "the file URL reaches the page");
  const page = await (await getOrLaunchBrowser()).newPage();
  const responses: string[] = [];
  page.on("response", (res) => responses.push(res.url()));
  const pageFile = tmpFile(".html");
  fs.writeFileSync(pageFile, html, "utf-8");
  try {
    await guardRenderPage(page, pageFile);
    await page.goto(fileUrl(pageFile), { waitUntil: "load" });
    await page.waitForTimeout(500);
    assert.ok(responses.includes(fileUrl(pageFile)), `the page itself loads: ${responses.join(",")}`);
    assert.ok(!responses.includes(outsideUrl), `outside file loaded: ${responses.join(",")}`);
  } finally {
    await page.close().catch(() => {});
    try {
      fs.unlinkSync(pageFile);
    } catch {
      // same temp-page rule as the export
    }
  }
});
