// Editor panel hooks: the shared contract and helpers every panel leaf uses.
// Lives here so the leaves never import the panel entry back.
import { getResources, type Op } from '../api.js';
import { findItem, type EditorState, type ReplaceTarget } from '../state.js';
import { pageOf } from '../../engine/index.js';

export interface PanelHooks {
  state: EditorState;
  commit(ops: Op[], coalesce?: string): Promise<boolean>;
  renderAll(): void;
  setSelection(ids: string[]): void;
  showPanel(panel: EditorState['panel']): void;
  startTextEdit(id: string): void;
  closePanel(): void;
  /** Redraws the page only (live colour previews). */
  redraw(): void;
}

export let hooks: PanelHooks | null = null;
/** Set by the toolbar replace buttons; the next pick swaps this item. */
export let replaceTarget: ReplaceTarget | null = null;

/** The entry calls this once at boot, then mounts the text panel. */
export function setHooks(h: PanelHooks): void {
  hooks = h;
}

export function setReplaceTarget(t: ReplaceTarget | null): void {
  replaceTarget = t;
}

/** The target when it still exists and is still selected, else null. */
export function liveReplaceTarget(kind: 'photo' | 'sticker'): ReplaceTarget | null {
  if (!hooks || replaceTarget?.kind !== kind) return null;
  const it = findItem(hooks.state.design, replaceTarget.id);
  if (!it || it.type !== kind) return null;
  if (!hooks.state.selection.includes(replaceTarget.id)) return null;
  return replaceTarget;
}

/** Short hint bar shown on top of a panel opened in replace mode. */
export function replaceHint(
  root: HTMLElement,
  label: string,
  panel: EditorState['panel'],
): void {
  const bar = document.createElement('div');
  bar.className = 'replace-hint';
  const msg = document.createElement('span');
  msg.textContent = label;
  const cancel = document.createElement('button');
  cancel.className = 'btn';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => {
    setReplaceTarget(null);
    hooks?.showPanel(panel);
  });
  bar.append(msg, cancel);
  root.append(bar);
}

let addCounter = 0;

/** Staggered page centre for a fresh item: the nth add lands 24 px off. */
export function staggerCenter(state: EditorState, count: number): { x: number; y: number } {
  const page = pageOf(state.design.format ?? 'story', state.design.width, state.design.height);
  const step = (count % 5) * 24;
  return { x: page.width / 2 + step, y: page.height / 2 + step };
}

/** Shared adds behind images and stickers; shapes and text stagger on their own counters. */
export function centerOf(state: EditorState): { x: number; y: number } {
  addCounter += 1;
  return staggerCenter(state, addCounter);
}

/** Error note for failed loads: the message is outside data, kept as text. */
export function loadNote(text: string): HTMLElement {
  const note = document.createElement('p');
  note.style.fontSize = '12px';
  note.textContent = text;
  return note;
}

export interface PhotoEntry {
  id: string;
  url: string;
  description: string;
}

/** Shared photo-library grid behind the images and background panels. */
export async function drawPhotoGrid(
  grid: HTMLElement,
  query: string,
  limit: number,
  onPick: (photo: PhotoEntry) => void,
): Promise<void> {
  grid.innerHTML = '<p style="font-size:12px">Loading…</p>';
  try {
    const photos = (await getResources<PhotoEntry[]>('photos', query, limit));
    grid.innerHTML = '';
    if (photos.length === 0) {
      grid.innerHTML = '<p style="font-size:12px">No photos found.</p>';
      return;
    }
    for (const p of photos.slice(0, limit)) {
      const fig = document.createElement('figure');
      fig.className = 'photo';
      fig.title = p.description || p.id;
      const img = document.createElement('img');
      img.src = p.url;
      img.alt = p.description || p.id;
      img.loading = 'lazy';
      img.addEventListener('click', () => onPick(p));
      fig.append(img);
      grid.append(fig);
    }
  } catch (err) {
    grid.innerHTML = '';
    grid.append(loadNote(`Could not load: ${(err as Error).message}`));
  }
}
