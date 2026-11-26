// Ops: apply_ops, undo, redo. Same trust boundary as the HTTP routes,
// plus silent-shape rejection (a batch that changes nothing must say so).
import { applyOps } from "../../../ui/engine/index.js";
import { historyFor } from "../../histories.js";
import { saveDesign } from "../../store.js";
import { touchedIds, walkIds } from "../compact.js";
import { badSticker, loadDesign, refuseTemplate, toolError, withDesignLock } from "../trust.js";

type Op = Record<string, unknown>;

function rejectSilentShapes(ops: Op[]): string | null {
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!op || typeof op !== "object" || typeof op.op !== "string") {
      return toolError(`ops[${i}] must be an object with an 'op' name (see api_info('ops') for shapes)`);
    }
    const kind = op.op as string;
    if (kind === "add") {
      const item = op.item as Record<string, unknown> | undefined;
      if (!item || typeof item !== "object" || !item.id) {
        return toolError(`ops[${i}] 'add' needs an item object with an id (see api_info('ops') for shapes)`);
      }
      if (item.type === "sticker" && item.props && typeof item.props === "object") {
        const problem = badSticker((item.props as Record<string, unknown>).sticker, i);
        if (problem) return toolError(problem);
      }
      if ((item.type === "photo" || item.type === "image") && item.props && typeof item.props === "object") {
        const fit = (item.props as Record<string, unknown>).fit ?? "cover";
        if (fit !== "cover" && fit !== "contain") {
          return toolError(`ops[${i}] fit must be cover|contain, got ${JSON.stringify(fit)}`);
        }
      }
    } else if (kind === "update") {
      const patch = op.patch as unknown;
      if (!patch || typeof patch !== "object" || Array.isArray(patch) || !Object.keys(patch).length) {
        return toolError(`ops[${i}] 'update' needs a patch object of fields to change (e.g. {'x': 100})`);
      }
      if ("sticker" in (patch as Record<string, unknown>)) {
        const problem = badSticker((patch as Record<string, unknown>).sticker, i);
        if (problem) return toolError(problem);
      }
    } else if (["remove", "duplicate", "lock", "reorder", "ungroup"].includes(kind)) {
      if (typeof op.id !== "string" || !op.id) {
        return toolError(`ops[${i}] '${kind}' needs an 'id' (see api_info('ops') for shapes)`);
      }
      if (kind === "lock" && typeof op.locked !== "boolean") {
        return toolError(`ops[${i}] 'lock' needs a locked true|false value`);
      }
    } else if (kind === "set_background") {
      const bg = op.background as unknown;
      if (!bg || typeof bg !== "object") {
        return toolError(`ops[${i}] 'set_background' needs a background object (see api_info('ops') for shapes)`);
      }
      const b = bg as Record<string, unknown>;
      if ((b.kind ?? "color") === "color" && !b.color) {
        return toolError(`ops[${i}] 'set_background' needs a color (e.g. {'kind': 'color', 'color': '#ffffff'})`);
      }
    }
  }
  return null;
}

export async function applyOpsTool(id: unknown, ops: unknown): Promise<string> {
  const refused = refuseTemplate(id);
  if (refused) return refused;
  const { err } = loadDesign(id);
  if (err) return err;
  if (!Array.isArray(ops) || !ops.length) {
    return toolError("ops must be a non-empty list of op objects (see api_info('ops'))");
  }
  const rejected = rejectSilentShapes(ops as Op[]);
  if (rejected) return rejected;
  return withDesignLock(id as string, () => {
    // Re-read inside the lock: the editor may have saved since loadDesign.
    const fresh = loadDesign(id);
    if (fresh.err) return fresh.err;
    const before = walkIds((fresh.design as Record<string, unknown>).items);
    let updated: Record<string, unknown>;
    try {
      updated = applyOps(fresh.design as Record<string, unknown>, ops as Op[]) as Record<string, unknown>;
    } catch (e) {
      return toolError(`${(e as Error).message} (nothing was applied)`);
    }
    try {
      saveDesign(id as string, updated);
    } catch (e) {
      return toolError(`could not save: ${(e as Error).message}`);
    }
    // Push the pre-change state so the first undo reverts this batch.
    historyFor(id as string).push(fresh.design as Record<string, unknown>);
    const after = walkIds(updated.items);
    return JSON.stringify({ ok: true, ids: touchedIds(ops as Op[], before, after) });
  });
}

export async function undoTool(id: unknown): Promise<string> {
  const refused = refuseTemplate(id);
  if (refused) return refused;
  const { err } = loadDesign(id);
  if (err) return err;
  return withDesignLock(id as string, () => {
    const fresh = loadDesign(id);
    if (fresh.err) return fresh.err;
    const previous = historyFor(id as string).undo(fresh.design as Record<string, unknown>);
    if (!previous) return JSON.stringify({ design: fresh.design, undone: false });
    try {
      saveDesign(id as string, previous);
    } catch (e) {
      return toolError(`could not save: ${(e as Error).message}`);
    }
    return JSON.stringify({ design: previous, undone: true });
  });
}

export async function redoTool(id: unknown): Promise<string> {
  const refused = refuseTemplate(id);
  if (refused) return refused;
  const { err } = loadDesign(id);
  if (err) return err;
  return withDesignLock(id as string, () => {
    const fresh = loadDesign(id);
    if (fresh.err) return fresh.err;
    const following = historyFor(id as string).redo(fresh.design as Record<string, unknown>);
    if (!following) return JSON.stringify({ design: fresh.design, redone: false });
    try {
      saveDesign(id as string, following);
    } catch (e) {
      return toolError(`could not save: ${(e as Error).message}`);
    }
    return JSON.stringify({ design: following, redone: true });
  });
}
