// Server-side lint: the engine's report, with text overflow re-checked
// against the real fonts (the engine only estimates from character counts).
import { lintDesign } from "../ui/engine/index.js";
import { applyCase, careScore } from "../ui/engine/index.js";
import { wrapText } from "./export/measure.js";

type Json = Record<string, unknown>;
type Finding = { check: string; level: string; item: string; message: string };
export type LintReport = { findings: Finding[]; score: number };

function collectTexts(items: unknown, out: Json[]): void {
  for (const it of (items as Json[]) ?? []) {
    if (!it || it.visible === false) continue;
    if (it.type === "group") collectTexts(it.items ?? it.children, out);
    else if (it.type === "text") out.push(it);
  }
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
  ).catch(() => null); // no browser: keep the engine estimate rather than losing the whole lint
  if (wrap === null) return null;
  const height = wrap.lines * size * Number(p.lineHeight ?? 1.2);
  return wrap.widest > width * 1.02 || height > Number(item.height ?? 0) * 1.05;
}

export async function lintMeasured(design: Json): Promise<LintReport> {
  const report = lintDesign(design) as unknown as LintReport;
  const texts: Json[] = [];
  collectTexts(design.items, texts);
  const measured = new Map<string, boolean | null>();
  for (const item of texts) measured.set(String(item.id), await overflows(item));
  const kept: Finding[] = [];
  const seen = new Set<string>();
  for (const f of report.findings) {
    if (f.check !== "text_overflow") {
      kept.push(f);
      continue;
    }
    seen.add(f.item);
    const over = measured.get(f.item);
    if (over === false) continue;
    kept.push(over ? { ...f, message: `'${f.item}' overflows its box with the real font: enlarge the box or shorten/shrink the text` } : f);
  }
  // The estimate misses short boxes, so texts it cleared still need a finding.
  for (const item of texts) {
    const id = String(item.id);
    if (!seen.has(id) && measured.get(id)) kept.push({ check: "text_overflow", level: "warn", item: id, message: `'${id}' overflows its box with the real font: enlarge the box or shorten/shrink the text` });
  }
  return { findings: kept, score: careScore(kept) };
}
