// Agent catalogue over HTTP and the CLI: list every known agent with its
// install and connection state, connect or disconnect one of them by id.
import { ADAPTERS, type AgentAdapter } from "./adapters.js";

export class UnknownAgent extends Error {
  constructor(id: string) {
    super(`unknown agent: ${id}`);
  }
}

export interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  installUrl?: string;
  installed: boolean;
  connected: boolean;
  version?: string;
  error?: string;
}

export function agentIds(): string[] {
  return ADAPTERS.map((agent) => agent.id);
}

export function findAgent(id: string): AgentAdapter | null {
  return ADAPTERS.find((agent) => agent.id === id) ?? null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Every agent is probed at once: each probe launches its CLI (about a second
// each), so one after the other the Settings page waited for the sum.
export async function listAgents(): Promise<AgentInfo[]> {
  return Promise.all(ADAPTERS.map(async (agent): Promise<AgentInfo> => {
    const base = { id: agent.id, name: agent.name, icon: agent.icon, installUrl: agent.installUrl };
    try {
      const found = await agent.detect();
      let connected = false;
      let error = found.error;
      if (found.installed) {
        try {
          connected = await agent.status();
        } catch (error_) {
          error = messageOf(error_);
        }
      }
      return { ...base, installed: found.installed, connected, version: found.version, error };
    } catch (error) {
      return { ...base, installed: false, connected: false, error: messageOf(error) };
    }
  }));
}

// Probing takes seconds (every agent's CLI is launched): the list is kept
// until a connect, a disconnect or an explicit refresh can change it.
let cached: Promise<AgentInfo[]> | null = null;

export function cachedAgents(refresh = false): Promise<AgentInfo[]> {
  if (refresh || !cached) {
    const probe = listAgents();
    cached = probe;
    probe.catch(() => {
      if (cached === probe) cached = null;
    });
  }
  return cached;
}

export async function connectAgent(id: string): Promise<void> {
  const agent = findAgent(id);
  if (!agent) throw new UnknownAgent(id);
  cached = null;
  await agent.connect();
}

export async function disconnectAgent(id: string): Promise<void> {
  const agent = findAgent(id);
  if (!agent) throw new UnknownAgent(id);
  cached = null;
  await agent.disconnect();
}
