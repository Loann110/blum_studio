// Background panel: paper grain over the page background (0..100).
// Template-like pages almost always carry a fine grain: one slider, live.
import { commitBg, current, previewBg, type BackgroundPanelHooks } from './hooks.js';
import type { EditorState } from '../../state.js';

export function renderGrain(root: HTMLElement, st: EditorState, hooks: BackgroundPanelHooks): void {
  const box = document.createElement('div');
  box.innerHTML = '<h3>Paper grain</h3>';
  const row = document.createElement('div');
  row.className = 'row';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.step = '1';
  range.value = String(Math.round(Number(current(st).grain ?? 0)));
  range.setAttribute('aria-label', 'Paper grain');
  const value = document.createElement('span');
  value.className = 'range-value';
  value.textContent = range.value;
  const withGrain = (): ReturnType<typeof current> => ({ ...current(st), grain: Number(range.value) });
  // Live while dragging (page only), one commit on release: one undo step.
  range.addEventListener('input', () => {
    value.textContent = range.value;
    previewBg(st, hooks, withGrain());
  });
  range.addEventListener('change', () => commitBg(hooks, withGrain()));
  row.append(range, value);
  box.append(row);
  root.append(box);
}
