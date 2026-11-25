// Editor background flat colour.
import { current, commitBg, toHex, previewBg, type BackgroundPanelHooks } from './hooks.js';
import type { EditorState } from '../../state.js';

const FLAT_SWATCHES = [
  '#2f4f3e', '#ffffff', '#b03060', '#3a2a2a', '#6c5ce7', '#b9a7f2',
  '#f4a7c3', '#fbe4e6', '#f6e3b4', '#bfe3c0', '#e4572e', '#f58518',
  '#f2a007', '#7fbf3f', '#2ca58d', '#1f9bf0', '#2f7cf6', '#111111',
];

export function renderFlat(root: HTMLElement, st: EditorState, hooks: BackgroundPanelHooks): void {
  const flat = document.createElement('div');
  flat.innerHTML = '<h3>Flat color</h3>';
  const swatches = document.createElement('div');
  swatches.className = 'swatch-grid';
  for (const hex of FLAT_SWATCHES) {
    const chip = document.createElement('button');
    chip.className = 'swatch-chip';
    chip.title = hex;
    chip.setAttribute('aria-label', `Background ${hex}`);
    chip.style.background = hex;
    chip.addEventListener('click', () => {
      commitBg(hooks, { kind: 'color', color: hex });
    });
    swatches.append(chip);
  }
  flat.append(swatches);
  const row = document.createElement('div');
  row.className = 'row';
  const pick = document.createElement('input');
  pick.type = 'color';
  pick.value = toHex(typeof current(st).color === 'string' ? String(current(st).color) : '#ffffff');
  const hex = document.createElement('input');
  hex.type = 'text';
  hex.value = typeof current(st).color === 'string' ? String(current(st).color) : '#ffffff';
  hex.setAttribute('aria-label', 'Background color');
  const apply = document.createElement('button');
  apply.className = 'btn primary';
  apply.textContent = 'Apply';
  apply.addEventListener('click', () => {
    commitBg(hooks, { kind: 'color', color: hex.value });
  });
  // Live while the picker is open, one commit when it closes.
  pick.addEventListener('input', () => {
    hex.value = pick.value;
    previewBg(st, hooks, { kind: 'color', color: pick.value });
  });
  pick.addEventListener('change', () => {
    commitBg(hooks, { kind: 'color', color: pick.value });
  });
  row.append(pick, hex, apply);
  flat.append(row);
  root.append(flat);
}