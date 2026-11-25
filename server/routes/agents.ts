// Agent routes: list installed AI agents, connect or disconnect one of them.
import type { IncomingMessage, ServerResponse } from "node:http";
import { fail, postAllowed, sendJson } from "../http.js";
import { UnknownAgent, cachedAgents, connectAgent, disconnectAgent } from "../agents/index.js";

// ?refresh=1 (the Settings Refresh button) probes again; otherwise the last probe answers at once.
export async function agentsRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const refresh = new URL(req.url ?? "/", "http://x").searchParams.has("refresh");
  sendJson(res, 200, await cachedAgents(refresh));
}

async function guard(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!postAllowed(req)) {
    fail(res, 403, "forbidden: connect from the local Settings page only");
    return false;
  }
  return true;
}

export async function agentConnectRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!(await guard(req, res))) return;
  try {
    await connectAgent(id);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    if (error instanceof UnknownAgent) fail(res, 404, "unknown agent");
    else fail(res, 500, error instanceof Error ? error.message : String(error));
  }
}

export async function agentDisconnectRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!(await guard(req, res))) return;
  try {
    await disconnectAgent(id);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    if (error instanceof UnknownAgent) fail(res, 404, "unknown agent");
    else fail(res, 500, error instanceof Error ? error.message : String(error));
  }
}
