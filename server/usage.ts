// Per-design agent usage: one small JSON sidecar per design, next to the
// undo history. Every MCP call that names a design adds its estimate here.
import fs from "node:fs";
import path from "node:path";
import { designsDir } from "./paths.js";
import { designPath, readStable, withDesignLock } from "./store.js";
import type { Content } from "./mcp/trust.js";

// shortcut: estimates at a reference Sonnet-class price; the server sees tool
// calls, never the model's real tokens or the agent's own system prompt.
const BASE_INPUT_TOKENS = 20000;
const IMAGE_TOKENS = 1600;
const INPUT_USD_PER_MTOK = 3;
const OUTPUT_USD_PER_MTOK = 15;

export interface Usage {
  calls: number;
  first: number; // seconds since the epoch
  last: number;
  out: number;
  back: number;
  input: number;
  usd: number;
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
  return [u.calls, u.first, u.last, u.out, u.back, u.input, u.usd].every((n) => typeof n === "number") ? u : null;
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
        usd: (input * INPUT_USD_PER_MTOK + writtenTotal * OUTPUT_USD_PER_MTOK) / 1e6,
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
