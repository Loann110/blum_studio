// Designs: list, get, create, delete, rename, duplicate, state, mtime.
import type { IncomingMessage, ServerResponse } from "node:http";
import { fail, needDesign, readJson, sendJson } from "../http.js";
import { historyFor, forget as forgetHistory } from "../histories.js";
import { forgetUsage, readUsage } from "../usage.js";
import {
  InvalidDesign,
  UnknownDesign,
  createDesign,
  deleteDesign,
  duplicateDesign,
  getDesign,
  listDesigns,
  saveDesign,
  designMtimeMs,
  withDesignLock,
} from "../store.js";
import { validateDesign } from "../../ui/engine/index.js";

function read(id: string): { design: unknown } {
  try {
    return { design: getDesign(id) };
  } catch (e) {
    if (e instanceof UnknownDesign) throw { status: 404, detail: "unknown design" };
    throw { status: 500, detail: (e as Error).message };
  }
}

export async function listRoute(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  sendJson(res, 200, listDesigns());
}

export async function getRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  try {
    const { design } = read(id);
    sendJson(res, 200, { id, design });
  } catch (e: unknown) {
    const err = e as { status: number; detail: string };
    fail(res, err.status, err.detail);
  }
}

export async function createRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const payload = (await readJson(req)) as Record<string, unknown>;
  const name = String(payload.name ?? "Untitled") || "Untitled";
  const fmt = String(payload.format ?? "story") || "story";
  const width = payload.width === undefined ? undefined : Number(payload.width);
  const height = payload.height === undefined ? undefined : Number(payload.height);
  try {
    const made = createDesign(name, fmt, width, height);
    sendJson(res, 200, { id: made.id, design: made.design, updated: designMtimeMs(made.id) });
  } catch (e) {
    // Bad input is the caller's fault; a dead disk is ours (500).
    if (e instanceof InvalidDesign) fail(res, 400, (e as Error).message);
    else throw e;
  }
}

export async function deleteRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  await withDesignLock(id, () => {
    try {
      deleteDesign(id);
    } catch (e) {
      if (e instanceof UnknownDesign) {
        fail(res, 404, "unknown design");
        return;
      }
      throw e;
    }
    forgetHistory(id);
    forgetUsage(id);
    sendJson(res, 200, { deleted: id });
  });
}

export async function stateRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  try {
    const { design } = read(id);
    sendJson(res, 200, { id, design, updated: designMtimeMs(id) });
  } catch (e: unknown) {
    const err = e as { status: number; detail: string };
    fail(res, err.status, err.detail);
  }
}

export async function usageRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  // 404-free: a design with no agent call has no record, and answers {}.
  sendJson(res, 200, readUsage(id) ?? {});
}

export async function mtimeRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  try {
    sendJson(res, 200, { id, updated: designMtimeMs(id) });
  } catch {
    fail(res, 404, "unknown design");
  }
}

export async function renameRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const payload = (await readJson(req)) as Record<string, unknown>;
  await withDesignLock(id, () => {
    const design = needDesign(res, id);
    if (!design) return;
    const name = String(payload.name ?? "").trim();
    if (!name) {
      fail(res, 400, "name must not be empty");
      return;
    }
    design.name = name;
    const problems = validateDesign(design);
    if (problems.length) {
      fail(res, 400, problems[0]);
      return;
    }
    historyFor(id).push(JSON.parse(JSON.stringify(getDesign(id))));
    saveDesign(id, design);
    sendJson(res, 200, { design, updated: designMtimeMs(id) });
  });
}

export async function duplicateRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = (await readJson(req)) as Record<string, unknown>;
  } catch {
    // readJson already answers {} for an empty body: anything else is broken JSON.
    fail(res, 400, "body must be valid JSON");
    return;
  }
  const raw = payload.name;
  const name = raw === undefined || raw === null ? null : String(raw).trim() || null;
  await withDesignLock(id, () => {
    try {
      const made = duplicateDesign(id, name);
      sendJson(res, 200, { id: made.id, design: made.design, updated: designMtimeMs(made.id) });
    } catch (e) {
      if (e instanceof UnknownDesign) fail(res, 404, "unknown design");
      else if (e instanceof InvalidDesign) fail(res, 400, (e as Error).message);
      else throw e;
    }
  });
}
