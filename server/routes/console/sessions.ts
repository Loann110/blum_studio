// Console sessions: list, read, rename and delete creation sessions.
import type { IncomingMessage, ServerResponse } from "node:http";
import { fail, sendJson } from "../../http.js";
import {
  UnknownSession,
  deleteSession,
  listSessions,
  readSession,
  saveSession,
  type ConsoleSession,
} from "../../sessions.js";
import { consoleAgents } from "../../agents/console.js";
import { activeRun, bodyOf, guarded } from "./shared.js";

export type Known = ConsoleSession;

export function load(id: string): Known {
  let decoded: string;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    throw new UnknownSession("unknown session");
  }
  return readSession(decoded) as Known;
}

function missing(res: ServerResponse, e: unknown, what = "unknown session"): void {
  if (e instanceof UnknownSession) fail(res, 404, what);
  else fail(res, 500, (e as Error).message);
}

/** Load the session or answer the error: the five session routes share it. */
export async function withSession<T>(
  res: ServerResponse,
  id: string,
  fn: (session: Known) => Promise<T>,
): Promise<T | undefined> {
  let session: Known;
  try {
    session = load(id);
  } catch (e) {
    missing(res, e);
    return undefined;
  }
  return fn(session);
}

export async function consoleAgentsRoute(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  sendJson(res, 200, await consoleAgents());
}

export async function consoleListRoute(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  sendJson(res, 200, listSessions());
}

export async function consoleGetRoute(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  await withSession(res, id, async (session) => {
    sendJson(res, 200, session);
  });
}

export async function consoleRenameRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!guarded(req, res)) return;
  await withSession(res, id, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = await bodyOf(req);
    } catch (e) {
      fail(res, 400, (e as Error).message);
      return;
    }
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    if (!title) {
      fail(res, 400, "title must not be empty");
      return;
    }
    session.title = title;
    saveSession(session);
    sendJson(res, 200, { ok: true });
  });
}

export async function consoleDeleteRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!guarded(req, res)) return;
  await withSession(res, id, async (session) => {
    if (session.status === "running" && activeRun()?.sessionId === session.id) {
      fail(res, 409, "the agent is still running in this session");
      return;
    }
    try {
      deleteSession(session.id);
    } catch (e) {
      missing(res, e);
      return;
    }
    sendJson(res, 200, { ok: true });
  });
}
