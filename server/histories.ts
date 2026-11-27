// Histories: one bounded undo/redo stack per design, shared by the MCP
// server and the HTTP API so both undo the same way. Stacks persist next
// to the designs (designs/.history/<id>.json), so a restart keeps them.
import fs from "node:fs";
import path from "node:path";
import { readStable, type Design } from "./store.js";
import { designsDir } from "./paths.js";

const CAPACITY = 100;
// Continuous edits with the same key inside this window are one undo step.
const COALESCE_S = 1.2;

function historyDir(): string {
  return path.join(designsDir(), ".history");
}

function historyPath(id: string): string {
  const safe = [...id].map((c) => (/[A-Za-z0-9_-]/.test(c) ? c : "-")).join("");
  return path.join(historyDir(), `${safe}.json`);
}

export class PersistentHistory {
  private past: Design[] = [];
  private future: Design[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;

  constructor(
    private id: string,
    private capacity: number = CAPACITY,
  ) {
    if (this.capacity <= 0) this.capacity = 1;
    this.load();
  }

  private load(): void {
    let raw: unknown;
    try {
      raw = JSON.parse(readStable(historyPath(this.id))) as {
        past?: unknown;
        future?: unknown;
      };
    } catch (e) {
      // No history yet: start empty. Anything else (a torn write, a
      // permission error) is real and the caller must see it.
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        this.past = [];
        this.future = [];
        return;
      }
      throw e;
    }
    // Exact sync, so a re-read under the design lock drops stale entries too.
    if (raw && typeof raw === "object") {
      this.past = Array.isArray((raw as { past?: unknown }).past)
        ? ((raw as { past: unknown }).past as Design[]).slice(-this.capacity)
        : [];
      this.future = Array.isArray((raw as { future?: unknown }).future)
        ? ((raw as { future: unknown }).future as Design[]).slice(-this.capacity)
        : [];
    } else {
      this.past = [];
      this.future = [];
    }
  }

  private save(): void {
    fs.mkdirSync(historyDir(), { recursive: true });
    const tmp = `${historyPath(this.id)}.tmp`;
    fs.writeFileSync(
      tmp,
      JSON.stringify({ past: this.past.slice(-this.capacity), future: this.future.slice(-this.capacity) }),
      "utf-8",
    );
    fs.renameSync(tmp, historyPath(this.id));
  }

  push(doc: Design, coalesce?: string | null): void {
    // Another process may have pushed since we loaded: re-read under the
    // caller's design lock so its entries survive ours.
    this.load();
    const now = Date.now() / 1000;
    if (coalesce && coalesce === this.lastKey && this.past.length && now - this.lastAt <= COALESCE_S) {
      // Same burst (arrow nudges, slider scrub): keep the state from before
      // the burst so one undo reverts all of it.
      this.lastAt = now;
      this.future = [];
      this.save();
      return;
    }
    this.lastKey = coalesce ?? null;
    this.lastAt = now;
    this.past.push(JSON.parse(JSON.stringify(doc)) as Design);
    if (this.past.length > this.capacity) this.past.splice(0, this.past.length - this.capacity);
    this.future = [];
    this.save();
  }

  undo(current: Design): Design | null {
    this.load();
    this.lastKey = null;
    if (!this.past.length) return null;
    this.future.push(JSON.parse(JSON.stringify(current)) as Design);
    const out = this.past.pop() as Design;
    this.save();
    return out;
  }

  redo(current: Design): Design | null {
    this.load();
    this.lastKey = null;
    if (!this.future.length) return null;
    this.past.push(JSON.parse(JSON.stringify(current)) as Design);
    const out = this.future.pop() as Design;
    this.save();
    return out;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.save();
  }

  canUndo(): boolean {
    // Sync gates a push: answer from disk, not from a stale cache.
    this.load();
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  depth(): number {
    return this.past.length;
  }
}

// Keyed by the resolved history file: switching designs directories (tests
// pointing BLUM_DESIGNS elsewhere) never reuses another directory's stack.
const histories = new Map<string, PersistentHistory>();

export function historyFor(id: string): PersistentHistory {
  const key = historyPath(id);
  let h = histories.get(key);
  if (!h) {
    h = new PersistentHistory(id);
    histories.set(key, h);
  }
  return h;
}

// Test hook: drop the in-memory cache (simulates another process / restart).
export function clearHistoryCache(): void {
  histories.clear();
}

export function forget(id: string): void {
  histories.delete(historyPath(id));
  try {
    fs.unlinkSync(historyPath(id));
  } catch {
    // the file stays; it is namespaced by design id
  }
}
