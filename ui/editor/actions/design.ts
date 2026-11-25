// Editor design actions: save, undo, redo, reset, duplicate, delete, export.
import { state } from '../live.js';
import { adopt, commit, enqueue, selectionBeforeCommit } from '../commits.js';
import { renderAll, setDirty, setSelection } from '../render-loop.js';
import { applyOps, createDesign, deleteDesign, exportPdfUrl, exportUrl, renameDesign, syncBaseline, undo, redo, type Op } from '../api.js';
import { findItem, toast, topItems, type DesignItem } from '../state.js';
import { hideBanner } from '../overlays/banner.js';
import { confirmDialog } from '../overlays/dialogs.js';

export async function save(name?: string): Promise<void> {
  try {
    if (typeof name === 'string') {
      const got = await renameDesign(state.id, name);
      state.design = got.design;
      state.updated = got.updated;
    } else {
      const got = await syncBaseline(state.id);
      state.design = got.design;
      state.updated = got.updated;
    }
    setDirty(false);
    hideBanner();
    renderAll();
    toast('Saved.');
  } catch (err) {
    toast(`Save failed: ${(err as Error).message}`);
  }
}

// Undo and redo wait for the commits sent before them, or they would revert the wrong step.
export async function doUndo(): Promise<void> {
  const got = await enqueue(() => undo(state.id));
  if (!got.undone) {
    toast('Nothing to undo.');
    return;
  }
  adopt(got.design, got.updated);
  // Undoing a duplicate or an add removes what was selected: select what was before it.
  if (state.selection.length === 0) {
    const back = selectionBeforeCommit.filter((id) => findItem(state.design, id) !== null);
    if (back.length > 0) setSelection(back);
  }
}

export async function doRedo(): Promise<void> {
  const got = await enqueue(() => redo(state.id));
  if (!got.redone) {
    toast('Nothing to redo.');
    return;
  }
  adopt(got.design, got.updated);
}

/** Clears every item (after confirmation); the empty page stays saved. */
export function resetDesign(): void {
  const count = topItems(state.design).length;
  const name = state.design.name || 'Untitled';
  void confirmDialog(`Reset "${name}"? This removes all ${count} item(s). This cannot be undone.`, {
    title: 'Reset the design',
    confirmLabel: 'Reset',
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    const ops: Op[] = topItems(state.design).map((it) => ({ op: 'remove', id: it.id }));
    ops.push({ op: 'set_background', background: { kind: 'color', color: '#ffffff' } });
    void commit(ops).then((done) => {
      if (done) setSelection([]);
    });
  });
}

/** Copies the whole design into a new one and opens it. */
export async function duplicateDesign(): Promise<void> {
  try {
    const made = await createDesign(`${state.design.name || 'Untitled'} copy`, state.design.format || 'story', state.design.width, state.design.height);
    const items = JSON.parse(JSON.stringify(topItems(state.design))) as DesignItem[];
    if (items.length > 0) {
      await applyOps(made.id, items.map((item) => ({ op: 'add', item })));
    }
    window.location.search = `?id=${encodeURIComponent(made.id)}`;
  } catch (err) {
    toast(`Duplicate failed: ${(err as Error).message}`);
  }
}

export function deleteDesignFlow(): void {
  const name = state.design.name || 'Untitled';
  void confirmDialog(`Delete "${name}"? This cannot be undone.`, {
    title: 'Delete design',
    confirmLabel: 'Delete',
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    void deleteDesign(state.id).then(
      () => {
        window.location.href = '/editor/';
      },
      (err) => toast(`Delete failed: ${(err as Error).message}`),
    );
  });
}

export function exportPng(): void {
  const link = document.createElement('a');
  link.href = exportUrl(state.id);
  link.download = `${state.id}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  toast('Exporting PNG…');
}

export function exportPdf(): void {
  const link = document.createElement('a');
  link.href = exportPdfUrl(state.id);
  link.download = `${state.id}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  toast('Exporting PDF…');
}