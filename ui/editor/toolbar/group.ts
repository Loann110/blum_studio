// Editor toolbar group tools: group, multi-select and align.
import { iconButton, separator, toolGroup } from './controls.js';
import { opacityStepper, renderShared } from './shared.js';
import { hooks, type ToolbarHooks } from './hooks.js';
import { findItem, freshGroupName, type EditorState } from '../state.js';
import type { Op } from '../api.js';

export function renderGroupTools(root: HTMLElement, st: EditorState, id: string): void {
  if (!hooks) return;
  opacityStepper(root, st, [id]);
  const members = (findItem(st.design, id)?.items ?? []).map((c) => c.id);
  toolGroup(root).append(
    iconButton('ungroup', 'Ungroup (Ctrl+Shift+G)', () => {
      void hooks?.commit([{ op: 'ungroup', id }]);
    }),
  );
  if (members.length >= 2) alignTools(root, members);
  separator(root);
}

export function renderMulti(root: HTMLElement, st: EditorState, ids: string[]): void {
  const badge = document.createElement('span');
  badge.style.cssText = 'font-size:12px;color:var(--muted)';
  badge.textContent = `${ids.length} selected`;
  root.append(badge);
  alignTools(root, ids);
  const g = toolGroup(root);
  g.append(
    iconButton('group', 'Group (Ctrl+G)', () => {
      if (!hooks) return;
      const h: ToolbarHooks = hooks;
      const name = freshGroupName(st.design);
      void h.commit([{ op: 'group', ids, name }]).then((ok) => {
        if (ok) h.setSelection([name]);
      });
    }),
  );
  separator(root);
  renderShared(root, ids);
}

export function alignTools(root: HTMLElement, ids: string[]): void {
  if (ids.length < 2 || !hooks) return;
  const h: ToolbarHooks = hooks;
  const g = toolGroup(root);
  const buttons: [string, string, Op][] = [
    ['align-start-vertical', 'Align left', { op: 'align', ids, align: 'left' }],
    ['align-center-vertical', 'Align centers', { op: 'align', ids, align: 'center-x' }],
    ['align-end-vertical', 'Align right', { op: 'align', ids, align: 'right' }],
    ['align-start-horizontal', 'Align top', { op: 'align', ids, align: 'top' }],
    ['align-center-horizontal', 'Align middles', { op: 'align', ids, align: 'center-y' }],
    ['align-end-horizontal', 'Align bottom', { op: 'align', ids, align: 'bottom' }],
  ];
  for (const [icon, title, op] of buttons) {
    g.append(iconButton(icon, title, () => void h.commit([op])));
  }
  if (ids.length >= 3) {
    g.append(
      iconButton('align-horizontal-distribute-center', 'Distribute horizontally', () => {
        void h.commit([{ op: 'distribute', ids, align: 'x' }]);
      }),
      iconButton('align-vertical-distribute-center', 'Distribute vertically', () => {
        void h.commit([{ op: 'distribute', ids, align: 'y' }]);
      }),
    );
  }
}