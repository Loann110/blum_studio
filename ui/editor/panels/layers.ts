// Editor layers panel: order, visibility and rename.
import { hooks } from './hooks.js';
import { topItems, type DesignItem, type EditorState } from '../state.js';

export function renderLayers(root: HTMLElement, st: EditorState): void {
  if (!hooks) return;
  const items = [...topItems(st.design)].reverse(); // front row first
  if (items.length === 0) {
    root.innerHTML += '<p style="font-size:12px">No layers yet.</p>';
    return;
  }
  for (const it of items) {
    root.append(layerRow(it.id, it.name || it.id, it.type, it.locked ?? false,
      it.visible !== false, false, textPreview(it)));
    if (it.type === 'group') {
      for (const c of it.items ?? []) {
        root.append(layerRow(c.id, c.name || c.id, c.type, c.locked ?? false,
          c.visible !== false, true, textPreview(c)));
      }
    }
  }
}

/** First words of a text item, so "textbox" rows say what they hold. */
function textPreview(it: DesignItem): string {
  if (it.type !== 'text') return '';
  const props = it.props as Record<string, unknown> | undefined;
  const text = String(props?.text ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 26 ? `${text.slice(0, 25)}…` : text;
}

function layerRow(
  id: string,
  name: string,
  kind: string,
  locked: boolean,
  visible: boolean,
  child: boolean,
  preview = '',
): HTMLElement {
  const st = hooks?.state;
  const row = document.createElement('div');
  row.className = 'layer-row' + (child ? ' child' : '');
  row.draggable = !locked && !child;
  if (st && st.selection.includes(id)) {
    row.classList.add('selected');
  }
  const badge = document.createElement('span');
  badge.className = 'kind';
  badge.textContent = kind;
  const label = document.createElement('span');
  label.className = 'name';
  label.textContent = name;
  label.title = 'Double-click to rename';
  // Beside the name, not inside it: the name stays exactly what it is.
  const peek = document.createElement('span');
  peek.className = 'peek';
  if (preview && preview !== name) peek.textContent = preview;
  const eye = document.createElement('button');
  eye.className = 'btn';
  eye.title = visible ? 'Hide' : 'Show';
  eye.innerHTML = `<i data-lucide="${visible ? 'eye' : 'eye-off'}"></i>`;
  const pad = document.createElement('button');
  pad.className = 'btn';
  pad.title = locked ? 'Unlock' : 'Lock';
  pad.innerHTML = `<i data-lucide="${locked ? 'lock' : 'lock-open'}"></i>`;
  eye.addEventListener('click', (ev) => {
    ev.stopPropagation();
    void hooks?.commit([{ op: 'update', id, patch: { visible: !visible } }]);
  });
  pad.addEventListener('click', (ev) => {
    ev.stopPropagation();
    void hooks?.commit([{ op: 'lock', id, locked: !locked }]);
  });
  label.addEventListener('dblclick', (ev) => {
    ev.stopPropagation();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = name;
    input.className = '';
    label.replaceWith(input);
    input.focus();
    input.select();
    const done = (save: boolean): void => {
      if (save && input.value.trim() && input.value !== name) {
        void hooks?.commit([{ op: 'update', id, patch: { name: input.value.trim() } }]);
      } else {
        hooks?.renderAll();
      }
    };
    input.addEventListener('keydown', (kev) => {
      if (kev.key === 'Enter') done(true);
      if (kev.key === 'Escape') done(false);
      kev.stopPropagation();
    });
    input.addEventListener('blur', () => done(true));
    input.addEventListener('click', (cev) => cev.stopPropagation());
  });
  row.addEventListener('click', (ev) => {
    if (!hooks) return;
    if (ev.shiftKey) {
      const sel = hooks.state.selection.includes(id)
        ? hooks.state.selection.filter((s) => s !== id)
        : [...hooks.state.selection, id];
      hooks.setSelection(sel);
      return;
    }
    hooks.setSelection([id]);
  });
  // Drag to reorder top-level rows (front row = first).
  row.addEventListener('dragstart', (ev) => {
    if (!ev.dataTransfer) return;
    ev.dataTransfer.setData('text/plain', id);
  });
  row.addEventListener('dragover', (ev) => ev.preventDefault());
  row.addEventListener('drop', (ev) => {
    ev.preventDefault();
    if (!hooks || !ev.dataTransfer) return;
    const dragged = ev.dataTransfer.getData('text/plain');
    if (!dragged || dragged === id || child) return;
    const backFirst = topItems(hooks.state.design).map((t) => t.id);
    const from = backFirst.indexOf(dragged);
    const target = backFirst.indexOf(id);
    if (from < 0 || target < 0) return;
    backFirst.splice(from, 1);
    // Drop position: the target row keeps its place, dragged goes there.
    const at = backFirst.indexOf(id);
    backFirst.splice(at, 0, dragged);
    void hooks.commit([{ op: 'reorder', id: dragged, index: at }]);
  });
  row.append(badge, label, peek, eye, pad);
  return row;
}