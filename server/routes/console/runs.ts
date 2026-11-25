// Console runs: one agent run at a time, with a live transcript stream.
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fail, readJson, sendJson } from "../../http.js";
import { root } from "../../paths.js";
import { consoleDir, newSession, saveSession } from "../../sessions.js";
import { claudeLaunch, consoleAgents, parseStreamLine } from "../../agents/console.js";
import { spawnAgent } from "../../agents/spawn.js";
import { activeRun, bodyOf, guarded, setActiveRun } from "./shared.js";
import { setActiveSessionId } from "../../sessions.js";
import { load, withSession, type Known } from "./sessions.js";

// The Create page asks for a finished design, not a conversation: build it
// right away and fill any missing details with realistic placeholders.
const SYSTEM_PROMPT =
  "You are the designer behind Blum Studio's Create page. Use the Blum Studio MCP tools " +
  "to make the design the user asks for, right away and in full: never ask questions " +
  "first. When details are missing (names, dates, contact, prices), use clear, " +
  "realistic placeholders the user can edit later, and say so in one line at the end. " +
  "Reply briefly, in the user's language.\n\n";
const RUN_TIMEOUT_MS = 10 * 60_000;

function timeoutMs(): number {
  const raw = Number(process.env.BLUM_CONSOLE_TIMEOUT_MS ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : RUN_TIMEOUT_MS;
}

function launch(session: Known, text: string): void {
  session.status = "running";
  session.updatedAt = Date.now();
  saveSession(session);
  const spec = claudeLaunch(`${SYSTEM_PROMPT}${text}`, session.agentSessionId, session.id);
  fs.mkdirSync(consoleDir(), { recursive: true });
  const run = spawnAgent(spec.program, spec.args, {
    cwd: consoleDir(),
    env: { BLUM_ROOT: root() },
    timeoutMs: timeoutMs(),
    onLine: (line) => {
      const event = parseStreamLine(line);
      if (!event) return;
      try {
        const fresh = load(session.id) as Known;
        fresh.transcript.push(event);
        if (event.agentSessionId) fresh.agentSessionId = event.agentSessionId;
        fresh.updatedAt = Date.now();
        saveSession(fresh);
      } catch {
        // the session file is gone (deleted mid-run): keep streaming
      }
    },
    onStderr: (stderr) => {
      const text = stderr.trim();
      if (!text) return;
      try {
        const fresh = load(session.id) as Known;
        fresh.transcript.push({ time: Date.now(), kind: "error", text });
        saveSession(fresh);
      } catch {
        // same as above
      }
    },
  });
  setActiveRun({ sessionId: session.id, stop: run.stop });
  setActiveSessionId(session.id);
  void run.done.then((result) => {
    if (activeRun()?.stop === run.stop) {
      setActiveRun(null);
      setActiveSessionId(null);
    }
    try {
      const fresh = load(session.id) as Known;
      if (result.killed || result.timedOut || result.missing || (result.status ?? 1) !== 0) {
        fresh.transcript.push({
          time: Date.now(),
          kind: "error",
          text: result.timedOut ? "Stopped: the 10 minute limit was reached." : "The agent stopped before finishing.",
        });
        fresh.status = "error";
      } else {
        fresh.status = "idle";
      }
      fresh.updatedAt = Date.now();
      saveSession(fresh);
    } catch {
      // deleted mid-run: nothing to persist
    }
  });
}

export async function consoleCreateRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!guarded(req, res)) return;
  let body: Record<string, unknown>;
  try {
    body = await bodyOf(req);
  } catch (e) {
    fail(res, 400, (e as Error).message);
    return;
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    fail(res, 400, "prompt must not be empty");
    return;
  }
  const agent = typeof body.agent === "string" ? body.agent : "";
  if (agent !== "claude-code") {
    fail(res, 400, "unknown agent");
    return;
  }
  const usable = (await consoleAgents()).find((a) => a.id === agent);
  if (!usable?.usable) {
    fail(res, 400, usable?.reason ?? "this agent is not available in the console");
    return;
  }
  if (activeRun()) {
    fail(res, 409, "another agent is already running");
    return;
  }
  const format = typeof body.format === "string" && body.format ? body.format : "story";
  // Only files staged by the uploads route: a client cannot point the agent elsewhere.
  const staged = Array.isArray(body.attachments)
    ? (body.attachments as unknown[]).filter((p): p is string =>
      typeof p === "string" && path.dirname(path.resolve(p)) === path.resolve(consoleDir())).slice(0, 8)
    : [];
  const isImage = (p: string): boolean => /\.(png|jpe?g|webp|gif|svg)$/i.test(p);
  const photos = staged.filter(isImage);
  const documents = staged.filter((p) => !isImage(p));
  let full = prompt;
  if (photos.length) full += `\n\nAttached photos (import each with import_image before using it):\n${photos.join("\n")}`;
  if (documents.length) full += `\n\nAttached documents (read each with the Read tool and use their content):\n${documents.join("\n")}`;
  const session = newSession(prompt.split("\n")[0] ?? "Untitled", agent, format) as Known;
  session.transcript.push({ time: Date.now(), kind: "text", text: full });
  saveSession(session);
  launch(session, full);
  sendJson(res, 200, { id: session.id });
}

export async function consoleMessageRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!guarded(req, res)) return;
  await withSession(res, id, async (session) => {
    if (activeRun()) {
      fail(res, 409, "another agent is already running");
      return;
    }
    await startRun(session, req, res);
  });
}

async function startRun(session: Known, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: Record<string, unknown>;
  try {
    body = await bodyOf(req);
  } catch (e) {
    fail(res, 400, (e as Error).message);
    return;
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    fail(res, 400, "text must not be empty");
    return;
  }
  session.transcript.push({ time: Date.now(), kind: "text", text });
  saveSession(session);
  launch(session, text);
  sendJson(res, 200, { ok: true });
}

export async function consoleStopRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!guarded(req, res)) return;
  await withSession(res, id, async (session) => {
    const run = activeRun();
    if (run && run.sessionId !== session.id) {
      fail(res, 409, "another session's agent is running");
      return;
    }
    run?.stop();
    sendJson(res, 200, { ok: true });
  });
}

export async function consoleStreamRoute(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!guarded(req, res)) return;
  let session = await withSession(res, id, async (s) => s);
  if (!session) return;
  // The page already rendered the first events: replay only what is new.
  let after = 0;
  try {
    const body = (await readJson(req)) as { after?: unknown };
    if (typeof body.after === "number" && body.after >= 0) after = Math.floor(body.after);
  } catch {
    fail(res, 400, "body must be valid JSON");
    return;
  }
  res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8" });
  let sent = Math.min(after, session.transcript.length);
  for (; sent < session.transcript.length; sent += 1) {
    res.write(`${JSON.stringify(session.transcript[sent])}\n`);
  }
  // While the agent runs, hold the stream and forward new events as they
  // land in the session file, so the page follows the run live.
  if (session.status === "running") {
    const started = Date.now();
    let closed = false;
    req.on("close", () => {
      closed = true;
    });
    for (;;) {
      await new Promise((r) => setTimeout(r, 400));
      if (closed) return;
      if (Date.now() - started > RUN_TIMEOUT_MS + 60_000) break;
      let fresh: Known;
      try {
        fresh = load(id);
      } catch {
        break; // deleted mid-run
      }
      for (; sent < fresh.transcript.length; sent += 1) {
        res.write(`${JSON.stringify(fresh.transcript[sent])}\n`);
      }
      session = fresh;
      if (session.status !== "running") break;
    }
  }
  let status = session.status;
  try {
    status = load(id).status;
  } catch {
    // deleted mid-run: report the last status we saw
  }
  res.write(`${JSON.stringify({ time: Date.now(), kind: "end", status })}\n`);
  res.end();
}
