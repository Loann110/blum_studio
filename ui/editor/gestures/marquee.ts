// Editor marquee gesture: drag to select.
import { hooks, overlayEl, scale } from '../canvas/stage.js';
import { session, type Session } from './session.js';
import { topItems, type EditorState } from '../state.js';
import { boxOf, cornersOf } from '../geometry/boxes.js';

let marqueeEl: HTMLElement | null = null;
function marqueeRect(s: Session): { x1: number; y1: number; x2: number; y2: number } {
  const ex = s.endX ?? s.startX;
  const ey = s.endY ?? s.startY;
  return {
    x1: Math.min(s.startX, ex),
    y1: Math.min(s.startY, ey),
    x2: Math.max(s.startX, ex),
    y2: Math.max(s.startY, ey),
  };
}

/** Items the marquee touches: touching is enough, as in the reference. */
function marqueeHits(s: Session): string[] {
  if (!hooks) return [];
  const r = marqueeRect(s);
  return topItems(hooks.state.design)
    .filter((it) => it.visible !== false && !it.locked)
    .filter((it) => {
      const pts = cornersOf(boxOf(it));
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      return Math.min(...xs) <= r.x2 && Math.max(...xs) >= r.x1 && Math.min(...ys) <= r.y2 && Math.max(...ys) >= r.y1;
    })
    .map((it) => it.id);
}

function drawMarquee(): void {
  if (!overlayEl) return;
  if (!session || session.kind !== 'marquee' || !session.moved) {
    marqueeEl?.remove();
    marqueeEl = null;
    return;
  }
  if (!marqueeEl) {
    marqueeEl = document.createElement('div');
    marqueeEl.className = 'marquee';
    overlayEl.append(marqueeEl);
  }
  const r = marqueeRect(session);
  marqueeEl.style.left = `${r.x1 * scale}px`;
  marqueeEl.style.top = `${r.y1 * scale}px`;
  marqueeEl.style.width = `${(r.x2 - r.x1) * scale}px`;
  marqueeEl.style.height = `${(r.y2 - r.y1) * scale}px`;
}

export function startMarquee(
  st: EditorState,
  point: { x: number; y: number },
  evt: PointerEvent,
): Session {
  // Empty page: drag a marquee; a plain click clears the selection.
  overlayEl?.setPointerCapture(evt.pointerId);
  evt.preventDefault();
  return {
    kind: 'marquee',
    startX: point.x,
    startY: point.y,
    origins: new Map(),
    startAngle: 0,
    moved: false,
    keep: evt.shiftKey ? [...st.selection] : [],
  };
}

export function dragMarquee(session: Session, point: { x: number; y: number }): void {
    session.endX = point.x;
    session.endY = point.y;
    drawMarquee();
}

export function finishMarquee(finished: Session): void {
    drawMarquee();
    if (!finished.moved) {
  if (finished.keep?.length === 0) hooks?.setSelection([]);
  return;
    }
    hooks?.setSelection([...new Set([...(finished.keep ?? []), ...marqueeHits(finished)])]);
}