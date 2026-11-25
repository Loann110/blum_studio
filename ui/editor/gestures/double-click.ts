// Editor double-click: new text or inline edit.
import { canvasSize, hooks, overlayEl, scale } from '../canvas/stage.js';
import { hitTest } from '../geometry/boxes.js';
import { fromWorkspaceChrome, HIT_SLOP_PX } from '../canvas/workspace.js';
import { freshId, topItems } from '../state.js';

/** Double-click on the page starts a text edit (wired once at boot). */
export function wireDouble(root: HTMLElement): void {
  root.addEventListener('dblclick', (evt) => {
    if (fromWorkspaceChrome(evt as PointerEvent, root)) return;
    onDouble(evt);
  });
}

export function onDouble(evt: MouseEvent): void {
  if (!hooks) return;
  const st = hooks.state;
  const rect = (overlayEl as HTMLElement).getBoundingClientRect();
  const point = {
    x: (evt.clientX - rect.left) / scale,
    y: (evt.clientY - rect.top) / scale,
  };
  const hit = hitTest(topItems(st.design), point.x, point.y, HIT_SLOP_PX / scale);
  if (!hit) {
    // Double-click on the empty page: a new text box right there, ready for typing.
    // Off the page (grey workspace) it does nothing.
    const page = canvasSize(st);
    if (point.x < 0 || point.y < 0 || point.x > page.w || point.y > page.h) return;
    const id = freshId(st.design, 'text');
    const ink = '#111111';
    const item = {
      id,
      name: 'Text',
      type: 'text',
      x: Math.round(point.x),
      y: Math.round(point.y),
      width: 600,
      height: 50,
      props: { text: 'Text', font: 'Inter', size: 36, weight: 400, align: 'center', color: ink },
    };
    void hooks.commit([{ op: 'add', item }]).then((ok) => {
      if (!ok) return;
      hooks?.setSelection([id]);
      requestAnimationFrame(() => hooks?.startTextEdit(id));
    });
    return;
  }
  const it = topItems(st.design).find((t) => t.id === hit);
  if (it && it.type === 'text' && !it.locked) {
    hooks.setSelection([hit]);
    hooks.startTextEdit(hit);
  } else if (!st.selection.includes(hit)) {
    hooks.setSelection([hit]);
  }
}