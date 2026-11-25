// Console sessions: one JSON file per creation session, under
// designs/.sessions/ (designs/ is git-ignored). Renaming or deleting a
// session never touches the designs it produced.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { designsDir } from "./paths.js";
import type { ConsoleEvent } from "./agents/console.js";

export interface ConsoleSession {
  id: string;
  title: string;
  agent: string;
  agentSessionId?: string;
  designIds: string[];
  format: string;
  status: "running" | "idle" | "error";
  createdAt: number;
  updatedAt: number;
  transcript: ConsoleEvent[];
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

// Thrown for missing sessions (404); anything else (unreadable or
// undeletable files) propagates to the 500 handler.
export class UnknownSession extends Error {}

export function checkSessionId(id: string): void {
  if (!ID_PATTERN.test(id)) throw new UnknownSession("unknown session");
}

export function sessionsDir(): string {
  return path.join(designsDir(), ".sessions");
}

export function consoleDir(): string {
  return path.join(designsDir(), ".console");
}

function fileOf(id: string): string {
  checkSessionId(id);
  return path.join(sessionsDir(), `${id}.json`);
}

export function readSession(id: string): ConsoleSession {
  let raw: string;
  try {
    raw = fs.readFileSync(fileOf(id), "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new UnknownSession("unknown session");
    throw e;
  }
  try {
    return JSON.parse(raw) as ConsoleSession;
  } catch (e) {
    throw new Error(`session '${id}' is corrupt: ${(e as Error).message}`);
  }
}

function writeSession(session: ConsoleSession): void {
  fs.mkdirSync(sessionsDir(), { recursive: true });
  const file = fileOf(session.id);
  const tmp = path.join(sessionsDir(), `.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, JSON.stringify(session, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

export function newSession(title: string, agent: string, format: string): ConsoleSession {
  const now = Date.now();
  const session: ConsoleSession = {
    id: `${now.toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    title: title.trim().slice(0, 80) || "Untitled",
    agent,
    designIds: [],
    format,
    status: "running",
    createdAt: now,
    updatedAt: now,
    transcript: [],
  };
  writeSession(session);
  return session;
}

export function saveSession(session: ConsoleSession): void {
  session.updatedAt = Date.now();
  writeSession(session);
}

/** The session whose agent run is currently active, if any. */
let activeSessionId: string | null = null;

export function setActiveSessionId(id: string | null): void {
  activeSessionId = id;
}

/** Attribute a fresh design id to the running session (best effort). */
export function noteDesignCreated(id: string): void {
  // In the MCP process a Create run starts, the session comes from its env.
  const sessionId = activeSessionId ?? process.env.BLUM_SESSION ?? null;
  if (!sessionId) return;
  try {
    const session = readSession(sessionId);
    if (!session.designIds.includes(id)) {
      session.designIds.push(id);
      saveSession(session);
    }
  } catch {
    // attribution is auxiliary: the design itself is already stored
  }
}

export function listSessions(): ConsoleSession[] {
  if (!fs.existsSync(sessionsDir())) return [];
  const out: ConsoleSession[] = [];
  for (const file of fs.readdirSync(sessionsDir())) {
    if (!file.endsWith(".json")) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(sessionsDir(), file), "utf-8")) as ConsoleSession);
    } catch {
      continue; // a torn write never breaks the list
    }
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

export function deleteSession(id: string): void {
  checkSessionId(id);
  const file = fileOf(id);
  if (!fs.existsSync(file)) throw new UnknownSession("unknown session");
  fs.unlinkSync(file);
}
