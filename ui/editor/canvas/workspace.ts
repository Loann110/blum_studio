// Editor workspace: focus handling and chrome hit-testing.
import { overlayEl } from './stage.js';

/** Thin items (lines) take clicks this many screen px around them, at any zoom. */
export const HIT_SLOP_PX = 7;

/**
 * A canvas press takes focus from the chrome: the slider keeps the arrow
 * keys only until the pointer lands on the page, as in the reference.
 * Never steals focus from the inline text edit living in the overlay.
 */
export function releaseChromeFocus(target: EventTarget | null): void {
  const el = target as HTMLElement | null;
  if (el && typeof el.closest === 'function' &&
    el.closest('input, textarea, select, [contenteditable]') !== null) return;
  const active = document.activeElement as HTMLElement | null;
  if (active && active !== document.body && !overlayEl?.contains(active)) active.blur();
}

/** Workspace parts with their own job: zoom pill, rulers, scrollbars, any control. */
export function fromWorkspaceChrome(evt: PointerEvent, root: HTMLElement): boolean {
  const target = evt.target as HTMLElement;
  if (target.closest('.zoom-pill, .rulers, button, input, select, textarea, .inline-edit')) return true;
  // A press on the scroller's own scrollbar lands on the scroller itself, past its client box.
  return target === root && (evt.offsetX >= root.clientWidth || evt.offsetY >= root.clientHeight);
}