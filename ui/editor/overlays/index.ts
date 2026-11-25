// Editor overlays: floating menus, dialogs and the inline editor.
import { refreshRect, toDesign, canvasScale } from '../canvas/stage.js';
import { HIT_SLOP_PX } from '../canvas/workspace.js';
import { hitTest } from '../geometry/boxes.js';
import { topItems } from '../state.js';
import { closeFloating, hooks } from './hooks.js';
import { showContextMenu } from './context-menu.js';

export function wireCanvasMenu(root: HTMLElement): void {
  // Right-click on the canvas opens the editor context menu.
  root.addEventListener('contextmenu', (ev) => {
    if (!hooks) return;
    refreshRect();
    const point = toDesign(ev as unknown as PointerEvent);
    if (!point) return;
    const st = hooks.state;
    const hit = hitTest(topItems(st.design), point.x, point.y, HIT_SLOP_PX / canvasScale());
    if (hit && !st.selection.includes(hit)) {
      // Right-click selects what it touches first.
      st.selection = [hit];
      hooks.renderAll();
    }
    ev.preventDefault();
    showContextMenu(ev.clientX, ev.clientY);
  });
  document.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    if (!target.closest('.menu') && !target.closest('.menu-wrap')) {
      document.querySelectorAll('.menu').forEach((el) => el.remove());
    }
    if (!target.closest('.context-menu')) {
      document.querySelectorAll('.context-menu').forEach((el) => el.remove());
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeFloating();
  });
}