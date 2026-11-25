// Editor dropdown menus: file and view.
import { closeFloating, hooks } from './hooks.js';
import { promptDialog } from './dialogs.js';
import { showShortcuts } from './shortcuts.js';
import { setRulersVisible } from '../canvas/rulers.js';
import { saveViewFlags, toast } from '../state.js';

export type ViewKey = 'grid' | 'safeZones' | 'bleed' | 'snap' | 'rulers' | 'guides' | 'contrast';

export function toggleMenu(anchor: HTMLElement, name: 'file' | 'view'): void {
  const open = anchor.parentElement?.querySelector('.menu');
  closeFloating();
  if (open) return;
  if (!hooks) return;
  const st = hooks.state;
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  const viewEntry = (label: string, key: ViewKey, hint = ''): { label: string; hint: string; run: () => void } => ({
    label: st.view[key] ? `✓ ${label}` : label,
    hint,
    run: () => flipView(key),
  });
  const items: { label: string; hint: string; run: () => void }[] =
    name === 'file'
      ? [
          { label: 'Rename…', hint: '', run: () => renameFlow() },
          { label: 'Save', hint: 'Ctrl+S', run: () => hooks?.save() },
          { label: 'Reset the design…', hint: '', run: () => hooks?.resetDesign() },
          { label: 'Duplicate design', hint: '', run: () => void hooks?.duplicateDesign() },
          { label: 'Delete design…', hint: '', run: () => hooks?.deleteDesignFlow() },
          { label: 'Export PNG', hint: '', run: () => hooks?.exportPng() },
          { label: 'Export PDF', hint: '', run: () => hooks?.exportPdf() },
        ]
      : [
          viewEntry('Rulers', 'rulers'),
          viewEntry('Grid', 'grid'),
          viewEntry('Guides', 'guides'),
          viewEntry('Safe zones', 'safeZones'),
          viewEntry('Bleed edge (print)', 'bleed'),
          viewEntry('Snapping', 'snap'),
          viewEntry('High contrast', 'contrast'),
          { label: 'Shortcuts…', hint: '?', run: () => showShortcuts() },
        ];
  for (const item of items) {
    const btn = document.createElement('button');
    // Plain buttons, not menuitem roles: older scenarios click them by role.
    const span = document.createElement('span');
    span.textContent = item.label;
    const kbd = document.createElement('kbd');
    kbd.textContent = item.hint;
    btn.append(span, kbd);
    btn.addEventListener('click', () => {
      closeFloating();
      item.run();
    });
    menu.append(btn);
  }
  anchor.parentElement?.append(menu);
}

export function flipView(key: ViewKey): void {
  if (!hooks) return;
  hooks.state.view[key] = !hooks.state.view[key];
  if (key === 'rulers') setRulersVisible(hooks.state.view.rulers);
  if (key === 'contrast') applyContrast(hooks.state.view.contrast);
  saveViewFlags(hooks.state.view);
  hooks.renderAll();
}

/** High contrast wins over the theme: stronger text, lines and frames. */
export function applyContrast(on: boolean): void {
  document.documentElement.dataset.contrast = on ? 'high' : '';
}

export function renameFlow(): void {
  if (!hooks) return;
  const st = hooks.state;
  void promptDialog({
    title: 'Rename design',
    label: 'Name',
    initial: st.design.name ?? '',
    confirmLabel: 'Rename',
  }).then((next) => {
    if (next === null) return;
    if (!next.trim()) {
      toast('The name must not be empty.');
      return;
    }
    void hooks?.save(next.trim());
  });
}