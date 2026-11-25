// Editor render loop: repaint, restore focus and track saving.
import { state, contextbar, panelRoot, nameInput, dirtyDot, saveBadge } from './live.js';
import { pending } from './api.js';
import { drawStage } from './canvas/stage.js';
import { drawOverlay } from './canvas/overlay.js';
import { renderToolbar } from './toolbar/index.js';
import { renderPanel } from './panels/index.js';
import { findItem } from './state.js';
import { refreshIcons } from './icons.js';
import { pageOf } from '../engine/index.js';

export let panelToken = 0;
export function bumpPanelToken(): number { return ++panelToken; }

// Panels that mirror the design re-render on every commit; pure insert
// panels (shapes, stickers, images) keep their state and render once.
// The text panel follows too: its curved-text buttons act on the
// selection, so a stale toggle could never switch back off.
export function panelFollowsDesign(): boolean {
  return state.panel === 'layers' || state.panel === 'review' || state.panel === 'background' || state.panel === 'text';
}

export function renderAll(): void {
  drawStage();
  drawOverlay();
  document.title = `${state.design.name || 'Untitled'} — Blum Studio`;
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = state.design.name || '';
  }
  const badge = document.getElementById('format-badge');
  if (badge) badge.textContent = pageOf(state.design.format ?? 'story', state.design.width, state.design.height).label;
  paintSaveBadge();
  void renderToolbar(contextbar, state);
  if (panelFollowsDesign()) {
    // Keep scroll and focus: the panel is patched, not rebuilt from nothing.
    const token = ++panelToken;
    const scroll = panelRoot.scrollTop;
    const focusKey = focusedKey(panelRoot);
    void renderPanel(panelRoot, state).then(() => {
      if (token !== panelToken) return;
      panelRoot.scrollTop = scroll;
      restorePanelFocus(panelRoot, focusKey);
      refreshIcons();
    });
  }
  refreshIcons();
}

/** aria-label (or title) of the focused control inside a root, if any. */
export function focusedKey(root: HTMLElement): string | null {
  const active = document.activeElement as HTMLElement | null;
  if (!active || !root.contains(active)) return null;
  return active.getAttribute('aria-label') ?? active.title ?? null;
}

/**
 * Refocuses the control focused before the rebuild, unless focus already
 * moved inside the fresh panel (a Tab pressed while it built): a stale
 * capture must not yank it back.
 */
export function restorePanelFocus(root: HTMLElement, key: string | null): void {
  const now = document.activeElement as HTMLElement | null;
  if (now && root.contains(now)) return;
  restoreFocus(root, key);
}

export function restoreFocus(root: HTMLElement, key: string | null): void {
  if (!key) return;
  const again = [...root.querySelectorAll<HTMLElement>('[aria-label], [title]')].find(
    (el) => (el.getAttribute('aria-label') ?? el.title) === key,
  );
  again?.focus();
}

export function renderSelection(): void {
  drawOverlay();
  void renderToolbar(contextbar, state).then(() => refreshIcons());
  if (state.panel === 'layers') {
    const token = ++panelToken;
    const scroll = panelRoot.scrollTop;
    const focusKey = focusedKey(panelRoot);
    void renderPanel(panelRoot, state).then(() => {
      if (token !== panelToken) return;
      panelRoot.scrollTop = scroll;
      restorePanelFocus(panelRoot, focusKey);
      refreshIcons();
    });
  }
  paintSaveBadge();
}

/** Saved / Saving / Unsaved: one glanceable word next to the dirty dot. */
export function paintSaveBadge(): void {
  if (dirtyDot) dirtyDot.classList.toggle('on', state.dirty || state.dragging);
  if (!saveBadge) return;
  let text = 'Saved';
  let mode = 'saved';
  if (pending > 0) {
    text = 'Saving…';
    mode = 'saving';
  } else if (state.dirty || state.dragging) {
    text = 'Unsaved changes';
    mode = 'dirty';
  }
  saveBadge.textContent = text;
  saveBadge.dataset.mode = mode;
}

export function setSelection(ids: string[]): void {
  state.selection = ids.filter((id) => findItem(state.design, id) !== null);
  state.dirty = state.dirty || state.dragging;
  renderSelection();
}

export function setDirty(dirty: boolean): void {
  state.dirty = dirty;
  paintSaveBadge();
}