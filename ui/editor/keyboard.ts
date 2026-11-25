// Editor keyboard: shortcuts and bindings.
import { state } from './live.js';
import { renderAll, setSelection } from './render-loop.js';
import { selectedToplevel, topItems } from './state.js';
import { doRedo, doUndo, save } from './actions/design.js';
import { cut, copy, paste, duplicateSel, deleteSel, reorder, toggleLockSel, groupSel, ungroupSel, quickAdd } from './actions/items.js';
import { toggleBold, toggleItalic, toggleUnderline } from './actions/text-style.js';
import { setZoom } from './chrome/zoom.js';
import { showShortcuts } from './overlays/shortcuts.js';
import { nudgeSelection } from './gestures/move.js';

function editingText(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof (el as HTMLElement).closest !== 'function') return false;
  if (el.closest('textarea, select, [contenteditable]')) return true;
  // Sliders, checkboxes and buttons do not take typing: shortcuts still work there (as in the reference).
  const input = el.closest('input');
  return input !== null && !['checkbox', 'radio', 'button', 'range', 'submit'].includes(input.type);
}

export function bindKeys(): void {
  document.addEventListener('keydown', (ev) => {
    if (!state.id || document.getElementById('start-screen')) return;
    // A focused slider steps with arrows, Home, End and Page keys itself: they must not nudge the selection.
    const target = ev.target as HTMLElement | null;
    if (target instanceof HTMLInputElement && target.type === 'range' && /^(Arrow(Left|Right|Up|Down)|Home|End|Page(Up|Down))$/.test(ev.key)) return;
    const inField = editingText(ev.target);
    if (ev.key === 'Escape') {
      if (!inField) setSelection([]);
      return;
    }
    if (inField) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const step = ev.shiftKey ? 10 : 1;
    if (mod && ev.key.toLowerCase() === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      void doUndo();
    } else if ((mod && ev.key.toLowerCase() === 'y') || (mod && ev.shiftKey && ev.key.toLowerCase() === 'z')) {
      ev.preventDefault();
      void doRedo();
    } else if (mod && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void save();
    } else if (mod && ev.key === '0') {
      ev.preventDefault();
      setZoom(1);
      renderAll();
    } else if (mod && ev.key.toLowerCase() === 'd') {
      ev.preventDefault();
      duplicateSel();
    } else if (mod && ev.key.toLowerCase() === 'g' && !ev.shiftKey) {
      ev.preventDefault();
      groupSel();
    } else if (mod && ev.key.toLowerCase() === 'g' && ev.shiftKey) {
      ev.preventDefault();
      ungroupSel();
    } else if (mod && ev.key.toLowerCase() === 'l') {
      ev.preventDefault();
      toggleLockSel();
    } else if (mod && ev.key === ']') {
      ev.preventDefault();
      reorder(ev.shiftKey ? 'front' : 'forward');
    } else if (mod && ev.key === '[') {
      ev.preventDefault();
      reorder(ev.shiftKey ? 'back' : 'backward');
    } else if (mod && ev.key.toLowerCase() === 'a') {
      ev.preventDefault();
      setSelection(topItems(state.design).map((it) => it.id));
    } else if (mod && ev.key.toLowerCase() === 'x') {
      ev.preventDefault();
      cut();
    } else if (mod && ev.key.toLowerCase() === 'c') {
      ev.preventDefault();
      copy();
    } else if (mod && ev.key.toLowerCase() === 'v') {
      ev.preventDefault();
      void paste();
    } else if (mod && ev.key.toLowerCase() === 'b' && selectedToplevel(state)[0]?.type === 'text') {
      ev.preventDefault();
      toggleBold();
    } else if (mod && ev.key.toLowerCase() === 'i' && selectedToplevel(state)[0]?.type === 'text') {
      ev.preventDefault();
      toggleItalic();
    } else if (mod && ev.key.toLowerCase() === 'u' && selectedToplevel(state)[0]?.type === 'text') {
      ev.preventDefault();
      toggleUnderline();
    } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      deleteSel();
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      nudgeSelection(-step, 0);
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      nudgeSelection(step, 0);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      nudgeSelection(0, -step);
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      nudgeSelection(0, step);
    } else if (ev.key === '?') {
      showShortcuts();
    } else if (!mod && ev.key.toLowerCase() === 't') {
      quickAdd('text');
    } else if (!mod && ev.key.toLowerCase() === 'r') {
      quickAdd('rect');
    } else if (!mod && ev.key.toLowerCase() === 'e') {
      quickAdd('ellipse');
    } else if (!mod && ev.key.toLowerCase() === 'l' && !ev.shiftKey) {
      quickAdd('line');
    }
  });
}