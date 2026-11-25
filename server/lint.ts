// Server-side lint: the engine's report, with text overflow re-checked
// against the real fonts (the engine only estimates from character counts).
import { lintDesign } from "../ui/engine/index.js";
import { applyCase } from "../ui/engine/index.js";
import { wrapText } from "./export/measure.js";

type Json = Record<string, unknown>;
type Finding = { check: string; level: string; item: string; message: string };
export type LintReport = { findings: Finding[]; score: number };

function findItem(items: unknown, id: string): Json | null {
  for (const it of (items as Json[]) ?? []) {
    if (it?.id === id) return it;
    if (it?.type === "group") {
      const hit = findItem(it.items ?? it.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

function score(findings: Finding[]): number {
  let s = 100;
  for (const f of findings) s -= f.level === "error" ? 20 : f.level === "warn" ? 8 : 1;
  return Math.max(0, s);
}

// True when the wrapped text is taller than its box or a word is wider; null if unmeasurable.
async function overflows(item: Json): Promise<boolean | null> {
  const p = (item.props ?? {}) as Json;
  const size = Number(p.size ?? 64);
  const width = Number(item.width ?? 0);
  const wrap = await wrapText(
    applyCase(String(p.text ?? ""), String(p.textCase ?? "none")),
    String(p.font ?? "Inter"),
    size,
    Number(p.weight ?? 400),
    Boolean(p.italic),
    Number(p.letterSpacing ?? 0),
    width,
  );
  if (wrap === null) return null;
  const height = wrap.lines * size * Number(p.lineHeight ?? 1.2);
  return wrap.widest > width * 1.02 || height > Number(item.height ?? 0) * 1.05;
}

export async function lintMeasured(design: Json): Promise<LintReport> {
  const report = lintDesign(design) as unknown as LintReport;
  const kept: Finding[] = [];
  for (const f of report.findings) {
    if (f.check !== "text_overflow") {
      kept.push(f);
      continue;
    }
    const item = findItem(design.items, f.item);
    const over = item ? await overflows(item) : null;
    if (over === false) continue;
    kept.push(over ? { ...f, message: `'${f.item}' overflows its box with the real font: enlarge the box or shorten/shrink the text` } : f);
  }
  return { findings: kept, score: score(kept) };
}
