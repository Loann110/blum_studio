// The user's .env (next to the designs folder): read at start, the shell wins,
// a missing file is fine, and Settings writes keys into it safely.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { envFile, loadDotEnv } from "../paths.js";
import { migrateLegacyKeys, setStockKey } from "../stock.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("dotenv");

test("loadDotEnv reads .env next to the designs without overriding the shell", () => {
  assert.equal(envFile(), path.join(path.dirname(process.env.BLUM_DESIGNS as string), ".env"));
  try {
    loadDotEnv(); // no .env yet: nothing happens, no throw
    fs.writeFileSync(envFile(), "BLUM_TEST_A=from-file\nBLUM_TEST_B=from-file\n");
    delete process.env.BLUM_TEST_A;
    process.env.BLUM_TEST_B = "from-shell";
    loadDotEnv();
    assert.equal(process.env.BLUM_TEST_A, "from-file");
    assert.equal(process.env.BLUM_TEST_B, "from-shell");
  } finally {
    delete process.env.BLUM_TEST_A;
    delete process.env.BLUM_TEST_B;
    fs.rmSync(envFile(), { force: true });
  }
});

test("Settings keys go into .env, keep other lines, and refuse injection", async () => {
  fs.writeFileSync(envFile(), "# mine\nBLUM_PORT=8100\n");
  await setStockKey("pexels", "abcDEF123456");
  await setStockKey("pixabay", "12345-abcdef0123");
  assert.equal(fs.readFileSync(envFile(), "utf-8"), "# mine\nBLUM_PORT=8100\nPEXELS_API_KEY=abcDEF123456\nPIXABAY_API_KEY=12345-abcdef0123\n");
  assert.equal(process.env.PEXELS_API_KEY, "abcDEF123456"); // live without a restart

  await setStockKey("pexels", "newKey987654");
  await setStockKey("pixabay", "");
  assert.equal(fs.readFileSync(envFile(), "utf-8"), "# mine\nBLUM_PORT=8100\nPEXELS_API_KEY=newKey987654\n");
  assert.equal(process.env.PIXABAY_API_KEY, undefined);

  await assert.rejects(setStockKey("pexels", "abcdefgh\nEVIL=1"), /invalid key format/);
  assert.ok(!fs.readFileSync(envFile(), "utf-8").includes("EVIL"));
  delete process.env.PEXELS_API_KEY;
});

test("keys saved by the first Settings version move into .env once", async () => {
  fs.rmSync(envFile(), { force: true });
  const legacyDir = path.join(process.env.BLUM_DESIGNS as string, ".settings");
  const legacy = path.join(legacyDir, "keys.json");
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(legacy, JSON.stringify({ pexels: "oldPexels12345", pixabay: "oldPixabay67890" }));
  process.env.PIXABAY_API_KEY = "shellPixabay111"; // already set: never overwritten
  await migrateLegacyKeys();
  assert.equal(fs.readFileSync(envFile(), "utf-8"), "PEXELS_API_KEY=oldPexels12345\n");
  assert.equal(process.env.PIXABAY_API_KEY, "shellPixabay111");
  assert.equal(fs.existsSync(legacy), false);

  delete process.env.PEXELS_API_KEY;
  delete process.env.PIXABAY_API_KEY;
  fs.writeFileSync(legacy, JSON.stringify({ pexels: "bad key with spaces" }));
  await migrateLegacyKeys();
  assert.equal(fs.existsSync(legacy), true, "an unexpected key keeps the file: nothing lost");
  fs.rmSync(legacyDir, { recursive: true, force: true });
});
