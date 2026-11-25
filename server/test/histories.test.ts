// Histories: file-backed undo/redo shared across processes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PersistentHistory, clearHistoryCache, forget, historyFor } from "../histories.js";
import type { Design } from "../store.js";
import { useTempDesigns } from "./helpers.js";

useTempDesigns("histories");

function doc(rev: number): Design {
  return { version: 1, name: `rev ${rev}`, format: "story", items: [] };
}

test("second instance sees pushed state", () => {
  const first = new PersistentHistory("shared-history");
  first.push(doc(1));
  first.push(doc(2));
  const second = new PersistentHistory("shared-history"); // another process re-reads the file
  assert.ok(second.canUndo());
  assert.equal((second.undo(doc(3)) as Design).name, "rev 2");
});

test("undo redo round trip", () => {
  const history = new PersistentHistory("round-trip");
  history.push(doc(1));
  assert.equal((history.undo(doc(2)) as Design).name, "rev 1");
  assert.equal((history.redo(doc(1)) as Design).name, "rev 2");
  assert.ok(!history.canRedo());
});

test("empty history reports nothing", () => {
  const history = new PersistentHistory("empty");
  assert.ok(!history.canUndo());
  assert.ok(!history.canRedo());
  assert.equal(history.undo(doc(9)), null);
  assert.equal(history.redo(doc(9)), null);
});

test("history_for is shared and bounded", () => {
  clearHistoryCache();
  try {
    const history = historyFor("cached");
    history.clear();
    history.push(doc(1));
    history.push(doc(2));
    history.push(doc(3));
    assert.equal(historyFor("cached"), history);
    assert.ok(history.depth() <= 100);
  } finally {
    forget("cached");
  }
});

test("burst with same key is one undo step", () => {
  const history = new PersistentHistory("coalesce");
  history.push(doc(1), "nudge:a");
  history.push(doc(2), "nudge:a"); // same burst: still one step
  history.push(doc(3), "nudge:b"); // other key: new step
  assert.equal(history.depth(), 2);
  assert.equal((history.undo(doc(4)) as Design).name, "rev 3");
  assert.equal((history.undo(doc(3)) as Design).name, "rev 1");
});

test("forget drops the stack", () => {
  const history = historyFor("doomed");
  history.push(doc(1));
  forget("doomed");
  assert.ok(!historyFor("doomed").canUndo());
});

test("corrupt history fails loudly instead of looking empty", () => {
  const dir = process.env.BLUM_DESIGNS as string;
  fs.mkdirSync(path.join(dir, ".history"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".history", "torn.json"), "{torn", "utf-8");
  assert.throws(() => new PersistentHistory("torn"), /torn|Unexpected|JSON/);
  forget("torn");
});

test("unwritable history fails the push instead of going memory-only", () => {
  const dir = process.env.BLUM_DESIGNS as string;
  const history = new PersistentHistory("blocked-write");
  history.push(doc(1));
  fs.rmSync(path.join(dir, ".history"), { recursive: true, force: true });
  fs.writeFileSync(path.join(dir, ".history"), "blocker", "utf-8");
  try {
    assert.throws(() => history.push(doc(2)));
  } finally {
    fs.rmSync(path.join(dir, ".history"), { force: true });
  }
});

test("the cache is keyed by directory, not design id", () => {
  const first = process.env.BLUM_DESIGNS as string;
  const other = fs.mkdtempSync(path.join(os.tmpdir(), "blum-histories-"));
  try {
    historyFor("shared-id").push(doc(1));
    assert.ok(historyFor("shared-id").canUndo());
    process.env.BLUM_DESIGNS = other;
    assert.ok(!historyFor("shared-id").canUndo());
  } finally {
    process.env.BLUM_DESIGNS = first;
    clearHistoryCache();
    fs.rmSync(other, { recursive: true, force: true });
  }
});
