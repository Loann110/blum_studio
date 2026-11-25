// Editor viewport: scroll, zoom and space handling.
import { boxEl, hooks, refreshRect, scale, scrollEl } from './stage.js';
import { queueRulers } from './rulers.js';
import { ZOOM_MAX, ZOOM_MIN } from '../chrome/zoom.js';

/** The scroller moved: refresh the cached stage position and the rulers. */
export function onScroll(): void {
  refreshRect();
  queueRulers();
}

/** Space outside fields and buttons does nothing: no scroll, no pan. */
export function onSpaceIdle(evt: KeyboardEvent): void {
  if (evt.code !== 'Space') return;
  const el = evt.target as HTMLElement | null;
  if (el && typeof el.closest === 'function' &&
    (el.closest('input, textarea, select, [contenteditable], button') !== null)) return;
  evt.preventDefault();
}

/** Canvas scroll, zoom and space bindings (wired once at boot). */
export function wireViewport(root: HTMLElement): void {
  root.addEventListener('scroll', onScroll, { passive: true });
  // Ctrl+wheel (or Cmd+wheel) zooms around the pointer.
  root.addEventListener('wheel', onWheel, { passive: false });
  // Space stays inert: no scroll, no pan.
  window.addEventListener('keydown', onSpaceIdle);
}

/** Ctrl+wheel zooms around the pointer; plain wheels keep scrolling. */
export function onWheel(evt: WheelEvent): void {
  if ((!evt.ctrlKey && !evt.metaKey) || !hooks || !boxEl || !scrollEl) return;
  evt.preventDefault();
  zoomAt(evt.clientX, evt.clientY, Math.pow(1.0015, -evt.deltaY));
}

/**
 * Zooms keeping the design point under the cursor where it is: measure
 * the stage, apply the zoom, then shift the scroll by the drift.
 */
export function zoomAt(clientX: number, clientY: number, factor: number): void {
  if (!hooks || !boxEl || !scrollEl) return;
  const before = boxEl.getBoundingClientRect();
  const px = (clientX - before.left) / scale;
  const py = (clientY - before.top) / scale;
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(hooks.state.view.zoom * factor * 100) / 100));
  if (next === hooks.state.view.zoom) return;
  hooks.setZoom(next);
  const after = boxEl.getBoundingClientRect();
  scrollEl.scrollLeft += after.left + px * scale - clientX;
  scrollEl.scrollTop += after.top + py * scale - clientY;
  refreshRect();
  queueRulers();
}