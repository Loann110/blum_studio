// Editor item actions: clipboard, order, lock, group, insert.
import { state } from '../live.js';
import { commit } from '../commits.js';
import { setSelection } from '../render-loop.js';
import { deepCopyWithIds, findItem, freshGroupName, freshId, selectedToplevel, toast, type DesignItem } from '../state.js';
import { SHAPE_DEFAULT_FILL } from '../panels/shapes.js';
import { pageOf } from '../../engine/index.js';

export function copy(): void {
  const items = selectedToplevel(state).filter((it) => !it.locked);
  if (items.length === 0) {
    toast('Nothing to copy.');
    return;
  }
  state.clipboard = JSON.parse(JSON.stringify(items)) as DesignItem[];
  state.cutMode = false;
  toast(`${items.length} copied.`);
}

export function cut(): void {
  copy();
  if (!state.clipboard || state.clipboard.length === 0) return;
  const ids = state.clipboard.map((c) => c.id);
  state.cutMode = true;
  void commit(ids.map((id) => ({ op: 'remove', id })));
}

export async function paste(): Promise<void> {
  if (!state.clipboard || state.clipboard.length === 0) {
    toast('Clipboard is empty.');
    return;
  }
  const copies = state.clipboard.map((c) => deepCopyWithIds(state.design, c, 24, 24));
  const ok = await commit(copies.map((item) => ({ op: 'add', item })));
  if (ok) {
    setSelection(copies.map((c) => c.id));
    if (state.cutMode) {
      state.clipboard = null;
      state.cutMode = false;
    }
  }
}

export function duplicateSel(): void {
  const ids = selectedToplevel(state)
    .filter((it) => !it.locked)
    .map((it) => it.id);
  if (ids.length === 0) {
    toast('Locked items cannot be duplicated.');
    return;
  }
  void commit(ids.map((id) => ({ op: 'duplicate', id })));
}

export function deleteSel(): void {
  const ids = state.selection.filter((id) => {
    const it = findItem(state.design, id);
    return it && !it.locked;
  });
  if (ids.length === 0) {
    if (state.selection.length > 0) toast('Locked items cannot be deleted.');
    return;
  }
  void commit(ids.map((id) => ({ op: 'remove', id }))).then((ok) => {
    if (ok) setSelection([]);
  });
}

export function reorder(to: string): void {
  const ids = selectedToplevel(state)
    .filter((it) => !it.locked)
    .map((it) => it.id);
  if (ids.length === 0) return;
  void commit(ids.map((id) => ({ op: 'reorder', id, to })));
}

export function toggleLockSel(): void {
  const ids = state.selection.filter((id) => findItem(state.design, id) !== null);
  if (ids.length === 0) return;
  const anyUnlocked = ids.some((id) => !findItem(state.design, id)?.locked);
  void commit(ids.map((id) => ({ op: 'lock', id, locked: anyUnlocked })));
}

export function commitText(id: string, text: string): void {
  void commit([{ op: 'update', id, patch: { text } }]);
}

export function quickAdd(kind: 'text' | 'rect' | 'ellipse' | 'line'): void {
  const page = pageOf(state.design.format ?? 'story', state.design.width, state.design.height);
  const cx = page.width / 2;
  const cy = page.height / 2;
  const k = page.width / 1080;
  if (kind === 'text') {
    const id = freshId(state.design, 'title');
    void commit([
      {
        op: 'add',
        item: {
          id,
          name: 'Title',
          type: 'text',
          x: cx,
          y: cy,
          width: Math.round(900 * k),
          height: Math.round(120 * k),
          props: { text: 'New title', font: 'Fraunces', size: Math.round(72 * k), weight: 700, align: 'center', color: '#111111' },
        },
      },
    ]).then((ok) => {
      if (ok) setSelection([id]);
    });
    return;
  }
  const shapes: Record<string, { w: number; h: number; shape: string }> = {
    rect: { w: 320, h: 320, shape: 'rect' },
    ellipse: { w: 320, h: 320, shape: 'ellipse' },
    line: { w: 360, h: 24, shape: 'line' },
  };
  const spec = shapes[kind];
  const id = freshId(state.design, kind);
  void commit([
    {
      op: 'add',
      item: {
        id,
        name: kind,
        type: 'shape',
        x: cx,
        y: cy,
        width: Math.round(spec.w * k),
        height: Math.round(spec.h * k),
        props: { shape: spec.shape, fill: SHAPE_DEFAULT_FILL },
      },
    },
  ]).then((ok) => {
    if (ok) setSelection([id]);
  });
}

export function groupSel(): void {
  const ids = selectedToplevel(state)
    .filter((it) => !it.locked)
    .map((it) => it.id);
  if (ids.length < 2) {
    toast('Select at least two items to group.');
    return;
  }
  const name = freshGroupName(state.design);
  void commit([{ op: 'group', ids, name }]).then((ok) => {
    if (ok) setSelection([name]);
  });
}

export function ungroupSel(): void {
  const groups = selectedToplevel(state).filter((it) => it.type === 'group');
  if (groups.length === 0) {
    toast('Select a group to ungroup.');
    return;
  }
  void commit(groups.map((g) => ({ op: 'ungroup', id: g.id })));
}