// Editor commits: local apply, server sync and reconcile.
import { state } from './live.js';
import { paintSaveBadge, renderAll, setDirty } from './render-loop.js';
import { applyOps, enqueue as enqueueServer, getMtime, getState, pending, syncBaseline, type Op } from './api.js';
import { withFittedText } from './text/fit.js';
import { applyOps as applyLocalOps, EngineError } from '../engine/index.js';
import { findItem, toast, topItems, type Design } from './state.js';
import { hideBanner, showBanner } from './overlays/banner.js';

let localChain: Promise<void> = Promise.resolve();


/** Queues a local fit-and-apply after the ones already queued. */
function enqueueLocal<T>(job: () => Promise<T>): Promise<T> {
  const run = localChain.then(job);
  localChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Queues a server call, painting the save badge while it is in flight. */
export function enqueue<T>(job: () => Promise<T>): Promise<T> {
  paintSaveBadge();
  return enqueueServer(job).finally(() => {
    paintSaveBadge();
  });
}

/**
 * `coalesce`: continuous edits with the same key within 1.2 s are one undo step.
 * The batch applies locally first (the page updates at once), then goes to
 * the server in the background; the promise resolves with the server's
 * answer, so callers waiting on it keep working.
 */
/** Selection just before the last commit: undo falls back to it when its own selection vanished. */
export let selectionBeforeCommit: string[] = [];

export function commit(ops: Op[], coalesce?: string): Promise<boolean> {
  if (ops.length === 0) return Promise.resolve(true);
  selectionBeforeCommit = [...state.selection];
  const fitted = enqueueLocal(() => applyLocal(ops));
  return enqueue(() => sendFitted(fitted, coalesce));
}

/** Takes a server answer, unless newer local changes are still on their way or a drag runs. */
export function adopt(design: Design, updated: number): void {
  state.updated = updated;
  if (pending > 1 || state.dragging) return;
  state.design = design;
  state.selection = state.selection.filter((id) => findItem(state.design, id) !== null);
  setDirty(false);
  renderAll();
}

/**
 * Fits text, applies the batch to the page at once and renders. Local
 * batches run one at a time, in call order, without waiting for the server.
 * Resolves the fitted ops, or null when the local engine refused them (the
 * toast shows at once and nothing is sent).
 */
async function applyLocal(ops: Op[]): Promise<Op[] | null> {
  try {
    return await applyOnPage(ops);
  } catch (err) {
    // An outside writer (MCP) may have changed the file since the last poll
    // (a new item, a background change): with nothing else unsent, catch up and retry once.
    if (err instanceof EngineError && pending <= 1 && !state.dragging && await diskIsNewer()) {
      await reloadRemote();
      try {
        return await applyOnPage(ops);
      } catch (again) {
        err = again;
      }
    }
    const message = err instanceof EngineError
      ? err.message
      : `unexpected local error: ${(err as Error).message}`;
    toast(`Change refused: ${message}`);
    renderAll(); // inputs that hold the refused value show the design again
    return null;
  }
}

async function applyOnPage(ops: Op[]): Promise<Op[]> {
  const fitted = await withFittedText(ops, state.design);
  const next = applyLocalOps(
    state.design as unknown as Record<string, unknown>,
    fitted as unknown as Record<string, unknown>[],
  ) as unknown as Design;
  const prev = state.design;
  state.design = next;
  state.selection = nextSelection(prev, next, state.selection, fitted);
  renderAll();
  return fitted;
}

async function diskIsNewer(): Promise<boolean> {
  try {
    const mtime = await getMtime(state.id);
    return mtime !== state.updated && mtime !== state.ignoredRemote;
  } catch {
    return false;
  }
}

/**
 * Selection after a local apply: created items (add, duplicate, group) are
 * selected at once, as the commit answers used to select them; anything else
 * keeps the selection on what still exists.
 */
function nextSelection(prev: Design, next: Design, sel: string[], ops: Op[]): string[] {
  const kinds = new Set(ops.map((o) => (o as unknown as { op?: unknown }).op));
  if (kinds.has('group') || kinds.has('add') || kinds.has('duplicate')) {
    // The new group or items: top-level ids that did not exist before (a
    // group without a name gets a fresh id, so its name cannot find it).
    const before = new Set(topItems(prev).map((it) => it.id));
    const created = topItems(next).map((it) => it.id).filter((id) => !before.has(id));
    if (created.length > 0) return created;
  }
  return sel.filter((id) => findItem(next, id) !== null);
}

/** Sends fitted ops already applied locally; reconciles the server answer. */
async function sendFitted(ready: Promise<Op[] | null>, coalesce?: string): Promise<boolean> {
  const fitted = await ready;
  if (fitted === null) return false;
  try {
    const got = await applyOps(state.id, fitted, coalesce);
    reconcile(got.design, got.updated);
    return true;
  } catch (err) {
    toast(`Change refused: ${(err as Error).message}`);
    await reloadRemote();
    return false;
  }
}

/**
 * Takes a server answer for ops already applied locally. When it matches the
 * page only the saved mark moves; when it differs the server is the
 * authority, so its design wins (one console warning, no jumps otherwise).
 */
function reconcile(design: Design, updated: number): void {
  state.updated = updated;
  if (pending > 1 || state.dragging) return;
  if (designsEqual(state.design as unknown, design as unknown)) {
    setDirty(false);
    return;
  }
  console.warn('[blum] server design differs from the local result; keeping the server design.');
  state.design = design;
  state.selection = state.selection.filter((id) => findItem(state.design, id) !== null);
  setDirty(false);
  renderAll();
}

/** Key order and formatting aside, the same JSON. */
function designsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => designsEqual(v, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = Object.keys(ao);
  if (keys.length !== Object.keys(bo).length) return false;
  return keys.every((k) =>
    Object.prototype.hasOwnProperty.call(bo, k) && designsEqual(ao[k], bo[k]));
}

export async function reloadRemote(): Promise<void> {
  try {
    const got = await getState(state.id);
    state.design = got.design;
    state.updated = got.updated;
    state.selection = state.selection.filter((id) => findItem(state.design, id) !== null);
    setDirty(false);
    await syncBaseline(state.id);
    hideBanner();
    renderAll();
  } catch (err) {
    toast(`Reload failed: ${(err as Error).message}`);
  }
}

let pollTimer = 0;


export function watchRemote(): void {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(async () => {
    // While a commit, undo or redo is queued or in flight the disk already
    // changed but its answer is not applied yet: polling now would reload a
    // half-applied state, push a duplicate undo baseline and wipe redo.
    if (!state.id || document.hidden || pending > 0) return;
    try {
      const mtime = await getMtime(state.id);
      if (mtime !== state.updated && mtime !== state.ignoredRemote) {
        state.updated = mtime;
        if (state.dirty || state.dragging || document.querySelector('.inline-edit')) {
          showBanner();
        } else {
          await reloadRemote();
          toast('Revised from disk.');
        }
      }
    } catch {
      /* the design may be gone; the next save shows the error */
    }
  }, 2500);
}