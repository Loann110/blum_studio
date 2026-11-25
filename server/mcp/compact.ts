// Compact MCP replies: one line per object, ok + touched ids.
// Full JSON stays available (get_design with compact=false);
// the agent path defaults to short text that costs ~10x fewer tokens.
import type { Design } from "../store.js";
import { pageOf } from "../../ui/engine/index.js";

type Item = Record<string, unknown>;

function propsLine(item: Item): string {
  const props = (item.props ?? {}) as Record<string, unknown>;
  const kind = String(item.type ?? "");
  if (kind === "text") {
    const text = String(props.text ?? "").slice(0, 60).replace(/\n/g, " ");
    let size: unknown = props.size ?? 0;
    try {
      const f = Number(size);
      size = Number.isInteger(f) ? f : size;
    } catch {
      // keep the raw size
    }
    let line = `"${text}" ${String(props.font ?? "Inter")} ${String(size)}`;
    if (props.field) line += ` field:${String(props.field)}`;
    return line;
  }
  if (kind === "photo") {
    return `${String(props.mask ?? "rect")} ${String(props.src ?? `field:${String(props.field ?? "?")}`)}`;
  }
  if (kind === "image") return String(props.src ?? "");
  if (kind === "sticker") return String(props.sticker ?? "");
  if (kind === "vector") return `svg ${String(props.svg ?? "").length} bytes`;
  if (kind === "shape") {
    const fill = typeof props.fill === "object" ? "gradient" : String(props.fill ?? "");
    return `${String(props.shape ?? "rect")} ${fill}`;
  }
  if (kind === "group") {
    const kids = ((item.items as Item[]) ?? []).map((c) => String(c.id ?? "?")).join(" ");
    return `[${kids}]`;
  }
  return "";
}

function num(v: unknown): string {
  try {
    const f = Number(v ?? 0);
    if (Number.isNaN(f)) return "0";
    return Number.isInteger(f) ? String(f) : f.toFixed(1);
  } catch {
    return "0";
  }
}

// One line for the canvas, then one line per top-level object.
export function compactDesign(design: Design): string {
  const d = design as unknown as { format?: string; width?: number; height?: number };
  const fmt = String(d.format ?? "story");
  const page = pageOf(d.format ?? "story", d.width, d.height);
  const size = `${page.width}x${page.height}`;
  const bg = (design.background ?? {}) as Record<string, unknown>;
  let back: string;
  if (bg.kind === "gradient") {
    const stops = ((bg.stops as Array<Record<string, unknown>>) ?? []).map((s) => String(s.color ?? "")).join(" ");
    back = `gradient ${stops}`;
  } else {
    back = String(bg.color ?? "#ffffff");
  }
  const lines = [`${fmt} ${size} bg=${back}`];
  for (const item of ((design.items as Item[]) ?? [])) {
    const flags: string[] = [];
    if (item.locked) flags.push("locked");
    if (item.visible === false) flags.push("hidden");
    let tail = `@${num(item.x)},${num(item.y)} ${num(item.width)}x${num(item.height)}`;
    if (flags.length) tail += ` ${flags.join(",")}`;
    lines.push(`${String(item.id ?? "?")} ${String(item.type ?? "?")} ${propsLine(item)} ${tail}`.trimEnd());
  }
  return lines.map((l) => l.trimEnd()).join("\n");
}

// All item ids, groups included.
export function walkIds(items: unknown): Set<string> {
  const out = new Set<string>();
  for (const item of (items as Item[]) ?? []) {
    if (!item || typeof item !== "object") continue;
    out.add(String(item.id ?? ""));
    for (const sub of walkIds(item.items)) out.add(sub);
  }
  return out;
}

type Op = Record<string, unknown>;

// Ids an op batch touched, in op order (new ids last).
export function touchedIds(ops: Op[], before: Set<string>, after: Set<string>): string[] {
  const touched: string[] = [];
  for (const op of ops ?? []) {
    const kind = String(op.op ?? "");
    if (kind === "add") {
      const item = op.item as Item | undefined;
      if (item?.id && !touched.includes(String(item.id))) touched.push(String(item.id));
    } else if (["update", "remove", "reorder", "lock", "duplicate", "ungroup"].includes(kind)) {
      if (op.id && !touched.includes(String(op.id))) touched.push(String(op.id));
    } else if (["group", "align", "distribute"].includes(kind)) {
      for (const i of ((op.ids as unknown[]) ?? [])) {
        if (!touched.includes(String(i))) touched.push(String(i));
      }
      if (kind === "group" && op.name) touched.push(String(op.name));
    }
  }
  for (const id of [...after].sort()) {
    if (!before.has(id) && !touched.includes(id)) touched.push(id);
  }
  return touched;
}
