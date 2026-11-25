// Editor toolbar shared tools: opacity, more panel, geometry, lock.
import { iconButton, toolGroup } from './controls.js';
import { popButton, panelLabel } from './popover.js';
import { findItem, toast, type EditorState } from '../state.js';
import { hooks, type ToolbarHooks } from './hooks.js';
import type { Op } from '../api.js';

export function opacityStepper(root: HTMLElement, st: EditorState, ids: string[]): void {
  if (!hooks) return;
  const value = Math.round(Number(findItem(st.design, ids[0])?.opacity ?? 1) * 100);
  popButton(root, iconButton('contrast', 'Opacity', () => undefined), 'opacity', (panel) => {
    const title = document.createElement('div');
    title.className = 'pop-label';
    title.textContent = `Opacity ${value} %`;
    panel.append(title);
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '10';
    range.max = '100';
    range.value = String(value);
    range.setAttribute('aria-label', 'Opacity');
    // Live while scrubbing (local only), one commit on release: one undo step.
    range.addEventListener('input', () => {
      const next = Number(range.value) / 100;
      title.textContent = `Opacity ${range.value} %`;
      for (const id of ids) {
        const it = findItem(st.design, id);
        if (it) it.opacity = next;
      }
      hooks?.redraw();
    });
    range.addEventListener('change', () => {
      const next = Number(range.value) / 100;
      void hooks?.commit(ids.map((id) => ({ op: 'update', id, patch: { opacity: next } })), `opacity:${ids.join(',')}`);
    });
    panel.append(range);
  });
}

export function renderShared(root: HTMLElement, ids: string[], extra?: (panel: HTMLElement) => void): void {
  if (!hooks) return;
  const h: ToolbarHooks = hooks;
  const edit = toolGroup(root);
  edit.append(
    iconButton('lock', 'Lock (Ctrl+L)', () => void toggleLock()),
    iconButton('copy', 'Duplicate (Ctrl+D)', () => {
      void h.commit(ids.map((id) => ({ op: 'duplicate', id })));
    }),
    iconButton('trash', 'Delete', () => {
      if (ids.every((id) => findItem(h.state.design, id)?.locked)) {
        toast('Locked items cannot be deleted.');
        return;
      }
      void h.commit(ids.filter((id) => !findItem(h.state.design, id)?.locked)
        .map((id) => ({ op: 'remove', id })));
    }),
  );
  popButton(root, iconButton('ellipsis', 'More', () => undefined), 'more', (panel) => {
    if (extra) extra(panel);
    if (ids.length === 1) {
      panelLabel(panel, 'Position and size');
      geometryFields(panel, h.state, ids[0]);
    }
    panelLabel(panel, 'Layer order');
    const order = toolGroup(panel);
    const moves: [string, string, Record<string, string | number>][] = [
      ['bring-to-front', 'Bring to front', { to: 'front' }],
      ['chevron-up', 'Forward', { to: 'forward' }],
      ['chevron-down', 'Backward', { to: 'backward' }],
      ['send-to-back', 'Send to back', { to: 'back' }],
    ];
    for (const [icon, title, to] of moves) {
      order.append(iconButton(icon, title, () => void h.commit(ids.map((id) => ({ op: 'reorder', id, ...to })))));
    }
  }, true);
}

export function geometryFields(root: HTMLElement, st: EditorState, id: string): void {
  if (!hooks) return;
  const h: ToolbarHooks = hooks;
  const it = findItem(st.design, id);
  if (!it) return;
  const g = document.createElement('div');
  g.className = 'geometry-grid';
  g.title = 'Position and size (design px, degrees)';
  root.append(g);
  const fields: [string, string, number, number, number][] = [
    ['X', 'x', it.x ?? 0, -5000, 5000],
    ['Y', 'y', it.y ?? 0, -5000, 5000],
    ['W', 'width', it.width ?? 0, 1, 10000],
    ['H', 'height', it.height ?? 0, 1, 10000],
    ['Angle', 'angle', it.angle ?? 0, -360, 360],
  ];
  for (const [label, key, value, min, max] of fields) {
    const tag = document.createElement('span');
    tag.textContent = label;
    tag.style.fontSize = '11px';
    tag.style.color = 'var(--muted)';
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(Math.round(value * 10) / 10);
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.style.width = '58px';
    input.setAttribute('aria-label', `Item ${key}`);
    input.addEventListener('change', () => {
      const next = Number(input.value);
      if (!Number.isFinite(next)) return;
      void h.commit([{ op: 'update', id, patch: { [key]: next } }]);
    });
    g.append(tag, input);
  }
}

export function toggleLock(): void {
  if (!hooks) return;
  const st = hooks.state;
  const ids = st.selection;
  if (ids.length === 0) return;
  const anyUnlocked = ids.some((id) => !findItem(st.design, id)?.locked);
  const ops: Op[] = ids
    .filter((id) => findItem(st.design, id) !== null)
    .map((id) => ({ op: 'lock', id, locked: anyUnlocked }));
  void hooks.commit(ops);
}