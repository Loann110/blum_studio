// Editor toolbar: contextual bar rebuilt after every commit.
import { iconsIn, refreshIcons } from '../icons.js';
import { colorSwatch } from './colour.js';
import { iconButton, toolGroup } from './controls.js';
import { renderShared, toggleLock } from './shared.js';
import { renderTextTools, textMoreSections } from './text.js';
import { filterMoreSections, shadowMoreSections } from './effects.js';
import { renderShapeTools } from './shape.js';
import { renderGroupTools, renderMulti } from './group.js';
import { renderImageTools, renderPhotoTools, renderStickerTools } from './media.js';
import { resolveColor } from '../../render/render.js';
import { TEXTURE_COLOURS } from '../../engine/lint/texture-colours.js';
import { selectedToplevel, type EditorState } from '../state.js';
import { hooks } from './hooks.js';

let barTail: Promise<void> = Promise.resolve();
let liveSelection = '';


/** Rebuilds the bar, keeping keyboard focus on the same control (Tab from X to Y survives the commit of X). */
export function renderToolbar(
  root: HTMLElement,
  st: EditorState,
): Promise<void> {
  // Built off-screen, icons included, then swapped in one go: emptying the
  // live bar first showed a blank bar while the fonts list loaded (flicker).
  // The focus key is read when the fresh bar swaps in, not when the rebuild
  // starts: a slow build (fonts list) must not yank back a Tab the user
  // pressed while it was building.
  const next = document.createElement('div');
  let key = '';
  const run = barTail.then(() => buildToolbar(next, st)).then(() => {
    const active = document.activeElement as HTMLElement | null;
    key = active && root.contains(active) ? active.getAttribute('aria-label') ?? active.title : '';
    iconsIn(next);
    // The commit this rebuild answers often came from the bar itself (a typed
    // value, a picked colour): swapping identical markup would detach the
    // focused control under a Tab keypress whose focus move Chrome runs
    // after microtasks, stranding focus on <body>. Keep the live nodes then.
    // Bar commits must read live state at click time (never build-time
    // closures): a skipped swap leaves the previous build's controls live.
    // Their closures still hold the ids they were built for, so a new
    // selection always swaps (two groups have identical bars).
    const selection = st.selection.join('\n');
    if (selection === liveSelection && sameBar(root, next)) return;
    liveSelection = selection;
    root.replaceChildren(...Array.from(next.childNodes));
  });
  barTail = run.catch(() => undefined);
  return run.then(() => {
    if (!key) return;
    const again = [...root.querySelectorAll<HTMLElement>('[aria-label], [title]')].find(
      (el) => (el.getAttribute('aria-label') ?? el.title) === key,
    );
    again?.focus();
    // select() only exists on text-like inputs (it throws on number inputs).
    if (again instanceof HTMLInputElement && SELECTABLE_TYPES.has(again.type)) again.select();
  });
}

const SELECTABLE_TYPES = new Set(['hidden', 'text', 'search', 'tel', 'url', 'password']);

/** The bar swatch shows the live colour: flat fill, first gradient stop, or texture mean. */
function pageSwatch(bg: EditorState['design']['background']): string {
  if (!bg || typeof bg !== 'object') return '#ffffff';
  if (bg.kind === 'color' && typeof bg.color === 'string') return bg.color;
  if (bg.kind === 'gradient' && bg.stops && bg.stops.length > 0) {
    return resolveColor(bg.stops[0]?.color ?? '', '#ffffff');
  }
  if (bg.kind === 'image' && typeof bg.image === 'string') {
    return TEXTURE_COLOURS[bg.image] ?? '#ffffff';
  }
  return '#ffffff';
}


/**
 * Whether the fresh bar shows exactly what is live (markup plus control
 * values, which live in properties, not markup): no swap needed then.
 */
function sameBar(live: HTMLElement, fresh: HTMLElement): boolean {
  const fold = (root: HTMLElement): string => {
    const clone = root.cloneNode(true) as HTMLElement;
    const from = root.querySelectorAll('input, select, textarea');
    const to = clone.querySelectorAll('input, select, textarea');
    from.forEach((el, i) => {
      const mirror = to[i] as HTMLInputElement | null;
      if (!mirror) return;
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        if (el.checked) mirror.setAttribute('checked', '');
      } else {
        mirror.setAttribute('data-v', (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value);
      }
    });
    return clone.innerHTML;
  };
  return fold(live) === fold(fresh);
}

async function buildToolbar(
  root: HTMLElement,
  st: EditorState,
): Promise<void> {
  if (!hooks) return;
  root.innerHTML = '';
  const selected = selectedToplevel(st);
  if (selected.length === 0) {
    // Nothing selected: the page itself.
    const label = document.createElement('span');
    label.className = 'bar-label';
    label.textContent = 'Page background';
    root.append(label);
    const bg = st.design.background;
    const current = pageSwatch(bg);
    colorSwatch(root, st, current, 'Page background colour', 'page-bg', (color) => {
      void hooks?.commit([{ op: 'set_background', background: { kind: 'color', color } }]);
    }, (color) => {
      // Preview on a flat page only: dragging the picker must never wash an
      // image or gradient away before a colour is actually chosen.
      const live = st.design.background;
      if (live && live.kind === 'color') st.design.background = { kind: 'color', color };
    });
    refreshIcons();
    return;
  }
  if (selected.length > 1) {
    renderMulti(root, st, selected.map((s) => s.id));
    refreshIcons();
    return;
  }
  const it = selected[0];
  if (it.locked) {
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size:12px;color:var(--muted)';
    badge.textContent = `“${it.name || it.id}” is locked.`;
    root.append(badge);
    toolGroup(root).append(
      iconButton('lock-open', 'Unlock (Ctrl+L)', () => void toggleLock()),
    );
    refreshIcons();
    return;
  }
  if (it.type === 'text') {
    await renderTextTools(root, st, it.id);
    // The text More panel gains the Text and Effects sections.
    renderShared(root, [it.id], (panel) => textMoreSections(panel, st, it.id));
  } else if (it.type === 'shape') {
    renderShapeTools(root, st, it.id);
    renderShared(root, [it.id], (panel) => shadowMoreSections(panel, st, it.id, 'shape-shadow'));
  } else if (it.type === 'sticker' || it.type === 'vector') {
    renderStickerTools(root, st, it.id);
    renderShared(root, [it.id], (panel) => shadowMoreSections(panel, st, it.id, 'sticker-shadow'));
  } else if (it.type === 'image') {
    renderImageTools(root, st, it.id);
    renderShared(root, [it.id], (panel) => filterMoreSections(panel, st, it.id));
  } else if (it.type === 'photo') {
    renderPhotoTools(root, st, it.id);
    renderShared(root, [it.id], (panel) => filterMoreSections(panel, st, it.id));
  } else if (it.type === 'group') {
    renderGroupTools(root, st, it.id);
    renderShared(root, [it.id], (panel) => shadowMoreSections(panel, st, it.id, 'group-shadow'));
  } else {
    renderShared(root, [it.id]);
  }
  refreshIcons();
}