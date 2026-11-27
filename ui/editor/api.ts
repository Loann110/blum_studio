// Editor API: thin fetch wrappers over the editor endpoints, plus the queue
// that serializes the server calls. Every mutation is validated server-side.
import type { Design } from '../render/render.js';

export interface Op {
  op: string;
  [key: string]: unknown;
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? detail;
    } catch {
      /* keep the status text */
    }
    throw new Error(detail);
  }
  return res;
}

export interface DesignEntry {
  id: string;
  name: string;
  format: string;
  items: number;
  updated: number;
}

export async function listDesigns(): Promise<DesignEntry[]> {
  return (await (await call('/api/designs')).json()) as DesignEntry[];
}

export async function createDesign(
  name: string,
  format: string,
  width?: number,
  height?: number,
): Promise<{ id: string; design: Design }> {
  return (await (
    await call('/api/designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Blum-Request': '1' },
      body: JSON.stringify({ name, format, width, height }),
    })
  ).json()) as { id: string; design: Design };
}

export async function getState(
  id: string,
): Promise<{ design: Design; updated: number }> {
  const got = (await (
    await call(`/api/designs/${encodeURIComponent(id)}/state`)
  ).json()) as { design: Design; updated: number };
  return { design: got.design, updated: got.updated };
}

export async function getMtime(id: string): Promise<number> {
  const got = (await (
    await call(`/api/designs/${encodeURIComponent(id)}/mtime`)
  ).json()) as { updated: number };
  return got.updated;
}

export async function applyOps(
  id: string,
  ops: Op[],
  coalesce?: string,
): Promise<{ design: Design; updated: number }> {
  return (await (
    await call(`/api/designs/${encodeURIComponent(id)}/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Blum-Request': '1' },
      body: JSON.stringify({ ops, coalesce }),
    })
  ).json()) as { design: Design; updated: number };
}

export async function undo(
  id: string,
): Promise<{ design: Design; undone: boolean; updated: number }> {
  return (await (
    await call(`/api/designs/${encodeURIComponent(id)}/undo`, {
      method: 'POST',
      headers: { 'X-Blum-Request': '1' },
    })
  ).json()) as { design: Design; undone: boolean; updated: number };
}

export async function redo(
  id: string,
): Promise<{ design: Design; redone: boolean; updated: number }> {
  return (await (
    await call(`/api/designs/${encodeURIComponent(id)}/redo`, {
      method: 'POST',
      headers: { 'X-Blum-Request': '1' },
    })
  ).json()) as { design: Design; redone: boolean; updated: number };
}

export async function syncBaseline(id: string): Promise<{ design: Design; updated: number }> {
  return (await (
    await call(`/api/designs/${encodeURIComponent(id)}/sync`, {
      method: 'POST',
      headers: { 'X-Blum-Request': '1' },
    })
  ).json()) as { design: Design; updated: number };
}

export async function deleteDesign(id: string): Promise<void> {
  await call(`/api/designs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Blum-Request': '1' },
  });
}

export async function renameDesign(
  id: string,
  name: string,
): Promise<{ design: Design; updated: number }> {
  return (await (
    await call(`/api/designs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Blum-Request': '1' },
      body: JSON.stringify({ name }),
    })
  ).json()) as { design: Design; updated: number };
}

export interface AgentUsage {
  calls: number;
  first: number;
  last: number;
  out: number;
  back: number;
  input: number;
  usd: number;
  active: number;
  /** Real Claude Code figures when the Create console made this design. */
  measured: { tokens: number; cached: number; costUsd: number; ms: number; runs: number; designs: number } | null;
  /** Real over estimated cost on measured designs; corrects the estimate. */
  calibration: { factor: number; samples: number };
}

/** The agent's usage, measured or estimated; {} when no agent touched this design. */
export async function getUsage(id: string): Promise<Partial<AgentUsage>> {
  return (await (
    await call(`/api/designs/${encodeURIComponent(id)}/usage`)
  ).json()) as Partial<AgentUsage>;
}

export async function checkDesign(
  id: string,
): Promise<{ findings: { check: string; level: string; item: string; message: string }[]; score: number }> {
  return (await (
    await call(`/api/designs/${encodeURIComponent(id)}/check`)
  ).json()) as {
    findings: { check: string; level: string; item: string; message: string }[];
    score: number;
  };
}

export async function getResources<T = unknown>(
  kind: string,
  query = '',
  limit = 200,
): Promise<T> {
  const url =
    `/api/resources?kind=${encodeURIComponent(kind)}` +
    `&query=${encodeURIComponent(query)}&limit=${limit}`;
  return (await (await call(url)).json()) as T;
}

export async function uploadMedia(
  id: string,
  file: File,
): Promise<{ src: string; path: string }> {
  const form = new FormData();
  form.append('file', file);
  return (await (
    await call(`/api/designs/${encodeURIComponent(id)}/media`, {
      method: 'POST',
      headers: { 'X-Blum-Request': '1' },
      body: form,
    })
  ).json()) as { src: string; path: string };
}

export async function importUrl(
  id: string,
  url: string,
  filename: string,
): Promise<{ src: string; path: string }> {
  return (await (
    await call(`/api/designs/${encodeURIComponent(id)}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Blum-Request': '1' },
      body: JSON.stringify({ url, filename }),
    })
  ).json()) as { src: string; path: string };
}

export function exportUrl(id: string): string {
  return `/api/designs/${encodeURIComponent(id)}/png`;
}

export function exportPdfUrl(id: string): string {
  return `/api/designs/${encodeURIComponent(id)}/pdf`;
}

/* ---- server-call queue ---- */

// Calls waiting on or talking to the server; the badge reads this.
export let pending = 0;

let chain: Promise<void> = Promise.resolve();

/** Queues a server call after the ones already sent (commits, undo, redo). */
export function enqueue<T>(job: () => Promise<T>): Promise<T> {
  pending += 1;
  const run = chain.then(job).finally(() => {
    pending -= 1;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
