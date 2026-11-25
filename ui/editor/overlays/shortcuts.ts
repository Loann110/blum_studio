// Editor shortcuts dialog.
import { closeFloating } from './hooks.js';

export function showShortcuts(): void {
  closeFloating();
  const back = document.createElement('div');
  back.className = 'dialog-back';
  const box = document.createElement('div');
  box.className = 'dialog';
  box.innerHTML = '<h2>Shortcuts</h2>';
  const rows: [string, string][] = [
    ['Arrows', 'Move 1 px (Shift: 10 px)'],
    ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'],
    ['Ctrl+X, Ctrl+C, Ctrl+V', 'Cut, copy, paste'],
    ['Ctrl+D', 'Duplicate'],
    ['Delete', 'Delete selection'],
    ['Ctrl+G / Ctrl+Shift+G', 'Group / ungroup'],
    ['Ctrl+L', 'Lock / unlock'],
    ['Ctrl+] / Ctrl+[', 'Forward / backward'],
    ['Ctrl+A', 'Select all'],
    ['Esc', 'Deselect'],
    ['Ctrl+S', 'Save'],
    ['T / R / E / L', 'Add text, rectangle, ellipse, line'],
    ['Double-click', 'Edit text on the canvas'],
    ['Shift+click', 'Add to the selection'],
    ['Ctrl+wheel', 'Zoom around the pointer'],
    ['Ctrl+0', 'Fit to screen'],
    ['?', 'This dialog'],
  ];
  const table = document.createElement('table');
  for (const [keys, what] of rows) {
    const tr = document.createElement('tr');
    const a = document.createElement('td');
    const kbd = document.createElement('kbd');
    kbd.textContent = keys;
    a.append(kbd);
    const b = document.createElement('td');
    b.textContent = what;
    tr.append(a, b);
    table.append(tr);
  }
  const close = document.createElement('button');
  close.className = 'btn primary';
  close.textContent = 'Close';
  close.addEventListener('click', () => back.remove());
  back.addEventListener('click', (ev) => {
    if (ev.target === back) back.remove();
  });
  box.append(table, close);
  back.append(box);
  document.body.append(back);
}