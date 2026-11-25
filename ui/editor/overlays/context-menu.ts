// Editor context menu: selection actions at the pointer.
import { closeFloating, hooks } from './hooks.js';
import { findItem } from '../state.js';

export function showContextMenu(x: number, y: number): void {
  closeFloating();
  if (!hooks) return;
  const h = hooks;
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.setAttribute('role', 'menu');
  const st = h.state;
  const sel = st.selection.filter((id) => findItem(st.design, id) !== null);
  const locked = sel.some((id) => findItem(st.design, id)?.locked);
  const free = sel.length > 0 && !locked;
  type Entry = [label: string, keys: string, run: (() => void) | null] | 'sep';
  // Same list as the reference: nothing selected offers only Paste and Select all.
  const entries: Entry[] =
    sel.length === 0
      ? [
          ['Paste', 'Ctrl+V', () => h.paste()],
          ['Select all', 'Ctrl+A', () => h.selectAll()],
        ]
      : [
          ['Cut', 'Ctrl+X', free ? () => h.cut() : null],
          ['Copy', 'Ctrl+C', () => h.copy()],
          ['Paste', 'Ctrl+V', () => h.paste()],
          ['Duplicate', 'Ctrl+D', free ? () => h.duplicateSel() : null],
          ['Delete', 'Del', free ? () => h.deleteSel() : null],
          'sep',
          ['Bring to front', 'Ctrl+Shift+]', free ? () => void h.reorder('front') : null],
          ['Forward', 'Ctrl+]', free ? () => void h.reorder('forward') : null],
          ['Backward', 'Ctrl+[', free ? () => void h.reorder('backward') : null],
          ['Send to back', 'Ctrl+Shift+[', free ? () => void h.reorder('back') : null],
          'sep',
          ...(sel.length > 1 ? [['Group', 'Ctrl+G', free ? () => h.groupSel() : null] as Entry] : []),
          ...(sel.length === 1 && findItem(st.design, sel[0])?.type === 'group'
            ? [['Ungroup', 'Ctrl+Shift+G', free ? () => h.ungroupSel() : null] as Entry]
            : []),
          [locked ? 'Unlock' : 'Lock', 'Ctrl+L', () => h.toggleLockSel()],
        ];
  for (const entry of entries) {
    if (entry === 'sep') {
      menu.append(document.createElement('hr'));
      continue;
    }
    const [label, keys, run] = entry;
    const btn = document.createElement('button');
    btn.setAttribute('role', 'menuitem');
    const name = document.createElement('span');
    name.textContent = label;
    const hint = document.createElement('kbd');
    hint.className = 'menu-keys';
    hint.textContent = keys;
    btn.append(name, hint);
    if (!run) btn.disabled = true;
    else btn.addEventListener('click', () => {
      closeFloating();
      run();
    });
    menu.append(btn);
  }
  document.body.append(menu);
  // Keep the whole menu on screen, measured after layout.
  const box = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - box.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - box.height - 8))}px`;
}