// Console route guards: the local Create page gate and shared request bits.
import type { IncomingMessage, ServerResponse } from "node:http";
import { fail, postAllowed, readJson } from "../../http.js";

interface ActiveRun {
  sessionId: string;
  stop: () => void;
}

let active: ActiveRun | null = null;

/** The single agent run at a time, across all sessions. */
export function activeRun(): ActiveRun | null {
  return active;
}

export function setActiveRun(next: ActiveRun | null): void {
  active = next;
}

export function guarded(req: IncomingMessage, res: ServerResponse): boolean {
  if (!postAllowed(req)) {
    fail(res, 403, "forbidden: connect from the local Create page only");
    return false;
  }
  return true;
}

export async function bodyOf(req: IncomingMessage): Promise<Record<string, unknown>> {
  try {
    return (await readJson(req)) as Record<string, unknown>;
  } catch (e) {
    throw new Error((e as Error).message);
  }
}
