// Per-design agent usage: one small JSON sidecar per design, next to the
// undo history. Every MCP call that names a design adds its estimate here.
import fs from "node:fs";
import path from "node:path";
import { designsDir } from "./paths.js";
import { designPath, readStable, withDesignLock } from "./store.js";
import { listSessions } from "./sessions.js";
import type { Content } from "./mcp/trust.js";

// shortcut: estimates at reference Sonnet-class prices; the server sees tool
// calls, never the model's real tokens or the agent's own system prompt.
// Measured console runs correct it (see calibration).
const BASE_INPUT_TOKENS = 20000;
const IMAGE_TOKENS = 1600;
// The context an agent re-reads is cached: read at the cache price, and each
// returned token is written to the cache once.
const CACHE_READ_USD_PER_MTOK = 0.3;
const CACHE_WRITE_USD_PER_MTOK = 3.75;
const OUTPUT_USD_PER_MTOK = 15;
// A longer gap between two calls is a pause, not work.
const IDLE_CAP_S = 300;

export interface Usage {
  calls: number;
  first: number; // seconds since the epoch
  last: number;
  out: number;
  back: number;
  input: number;
  usd: number;
  active: number; // seconds of work, pauses capped
}

/** What Claude Code itself reported for the console runs that made a design. */
export interface Measured {
  tokens: number;
  cached: number;
  costUsd: number;
  ms: number;
  runs: number;
  designs: number; // designs the session made: the figures cover them all
}

function usageDir(): string {
  return path.join(designsDir(), ".usage");
}

function usagePath(id: string): string {
  const safe = [...id].map((c) => (/[A-Za-z0-9_-]/.test(c) ? c : "-")).join("");
  return path.join(usageDir(), `${safe}.json`);
}

/** The design's record, or null when there is none (a torn file counts as none). */
export function readUsage(id: string): Usage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(readStable(usagePath(id))) as unknown;
  } catch {
    return null;
  }
  const u = raw as Usage;
  if (!u || typeof u !== "object") return null;
  if (![u.calls, u.first, u.last, u.out, u.back, u.input, u.usd].every((n) => typeof n === "number")) return null;
  // Priced at read time, so old and new records follow the same formula;
  // records written before active time existed count their whole span.
  return {
    ...u,
    usd: estimateUsd(u.input, u.back, u.out),
    active: typeof u.active === "number" ? u.active : u.last - u.first,
  };
}

function estimateUsd(input: number, back: number, out: number): number {
  return (input * CACHE_READ_USD_PER_MTOK + back * CACHE_WRITE_USD_PER_MTOK + out * OUTPUT_USD_PER_MTOK) / 1e6;
}

function measure(out: string | Content[]): { chars: number; images: number } {
  if (typeof out === "string") return { chars: out.length, images: 0 };
  let chars = 0;
  let images = 0;
  for (const part of out) {
    if (part.type === "text") chars += part.text.length;
    else images += 1;
  }
  return { chars, images };
}

/** Adds one tool call to the design's estimate. Never fails: usage is not the edit. */
export async function recordUsage(id: string, args: unknown, out: string | Content[]): Promise<void> {
  try {
    const written = Math.round(JSON.stringify(args).length / 4);
    const { chars, images } = measure(out);
    const returned = Math.round(chars / 4) + images * IMAGE_TOKENS;
    await withDesignLock(id, () => {
      // A delete that ran just before this write must not bring a sidecar back.
      if (!fs.existsSync(designPath(id))) return;
      const prev = readUsage(id);
      const now = Date.now() / 1000;
      // Each turn re-reads the system prompt plus everything returned so far.
      const input = (prev?.input ?? 0) + BASE_INPUT_TOKENS + (prev?.back ?? 0);
      const writtenTotal = (prev?.out ?? 0) + written;
      const record: Usage = {
        calls: (prev?.calls ?? 0) + 1,
        first: prev?.first ?? now,
        last: now,
        out: writtenTotal,
        back: (prev?.back ?? 0) + returned,
        input,
        usd: estimateUsd(input, (prev?.back ?? 0) + returned, writtenTotal),
        active: (prev?.active ?? 0) + (prev ? Math.min(now - prev.last, IDLE_CAP_S) : 0),
      };
      fs.mkdirSync(usageDir(), { recursive: true });
      const tmp = `${usagePath(id)}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(record), "utf-8");
      fs.renameSync(tmp, usagePath(id));
    });
  } catch {
    // usage is a visible estimate, never a reason to fail a tool call
  }
}

export function forgetUsage(id: string): void {
  try {
    fs.unlinkSync(usagePath(id));
  } catch {
    // no sidecar to remove
  }
}

/** Real figures of the console runs that made this design, or null. */
export function measuredUsage(id: string): Measured | null {
  const found: Measured = { tokens: 0, cached: 0, costUsd: 0, ms: 0, runs: 0, designs: 0 };
  for (const session of listSessions()) {
    if (!session.designIds.includes(id)) continue;
    for (const event of session.transcript) {
      const u = event.usage;
      if (!u || typeof u.costUsd !== "number") continue;
      found.tokens += u.tokens ?? 0;
      found.cached += u.cached ?? 0;
      found.costUsd += u.costUsd;
      found.ms += u.ms ?? 0;
      found.runs += 1;
    }
    found.designs = Math.max(found.designs, session.designIds.length);
  }
  return found.runs ? found : null;
}

/**
 * Real cost over estimated cost, on designs that have both: it corrects the
 * estimate of agents Blum cannot measure. factor 1 and samples 0 without data.
 */
export function calibration(): { factor: number; samples: number } {
  let real = 0;
  let estimated = 0;
  let samples = 0;
  for (const session of listSessions()) {
    // A session that made one design maps its whole cost to that design.
    if (session.designIds.length !== 1) continue;
    const measured = measuredUsage(session.designIds[0]);
    const record = readUsage(session.designIds[0]);
    if (!measured || !record || record.usd <= 0) continue;
    real += measured.costUsd;
    estimated += record.usd;
    samples += 1;
  }
  return samples ? { factor: real / estimated, samples } : { factor: 1, samples: 0 };
}
