// Ops: apply, undo, redo, sync, lint check. Mutations take a per-design
// promise chain and push the pre-change state, so undo reverts the batch.
import type { IncomingMessage, ServerResponse } from "node:http";
import { applyOps } from "../../ui/engine/index.js";
import { lintMeasured } from "../lint.js";
import { fail, needDesign, readJson, sendJson } from "../http.js";
import { historyFor } from "../histories.js";
import { saveDesign, designMtimeMs, withDesignLock } from "../store.js";

type Op = Record<string, unknown>;

export async function opsRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const payload = (await readJson(req)) as Record<string, unknown>;
  const ops = payload.ops;
  if (!Array.isArray(ops) || !ops.length) {
    fail(res, 400, "ops must be a non-empty list");
    return;
  }
  await withDesignLock(id, () => {
    const design = needDesign(res, id);
    if (!design) return;
    let updated: Record<string, unknown>;
    try {
      updated = applyOps(design, ops as Op[]) as Record<string, unknown>;
    } catch (e) {
      fail(res, 400, (e as Error).message);
      return;
    }
    saveDesign(id, updated);
    // Pre-change state, so the first undo reverts this exact batch.
    const coalesce = payload.coalesce;
    historyFor(id).push(design, typeof coalesce === "string" ? coalesce : undefined);
    sendJson(res, 200, { design: updated, updated: designMtimeMs(id) });
  });
}

export async function undoRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  await withDesignLock(id, () => {
    const current = needDesign(res, id);
    if (!current) return;
    const previous = historyFor(id).undo(current);
    if (!previous) {
      sendJson(res, 200, { design: current, undone: false, updated: designMtimeMs(id) });
      return;
    }
    saveDesign(id, previous);
    sendJson(res, 200, { design: previous, undone: true, updated: designMtimeMs(id) });
  });
}

export async function redoRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  await withDesignLock(id, () => {
    const current = needDesign(res, id);
    if (!current) return;
    const following = historyFor(id).redo(current);
    if (!following) {
      sendJson(res, 200, { design: current, redone: false, updated: designMtimeMs(id) });
      return;
    }
    saveDesign(id, following);
    sendJson(res, 200, { design: following, redone: true, updated: designMtimeMs(id) });
  });
}

export async function syncRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const design = needDesign(res, id);
  if (!design) return;
  // Commits already push their pre-change state, so syncing again would add
  // a post-change duplicate and eat one undo. Only seed an empty stack.
  const history = historyFor(id);
  if (!history.canUndo()) history.push(design);
  sendJson(res, 200, { design, updated: designMtimeMs(id) });
}

export async function checkRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const design = needDesign(res, id);
  if (!design) return;
  sendJson(res, 200, await lintMeasured(design));
}
