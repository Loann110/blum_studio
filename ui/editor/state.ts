// Editor state: the open design, selection, view flags, dirty tracking.
// The server holds the saved truth; `dirty` means local-only edits exist
// (an in-progress drag, a text edit, or a failed commit).
import type { Design, DesignItem } from '../render/render.js';
import type { Op } from './api.js';

export type { Design, DesignItem };

/** The editor surface every toolbar and panel talks to: state, ops, repaint. */
export interface EditorHooks {
  state: EditorState;
  commit(ops: Op[], coalesce?: string): Promise<boolean>;
  renderAll(): void;
  setSelection(ids: string[]): void;
}

export type PanelId =
  | 'text'
  | 'shapes'
  | 'stickers'
  | 'images'
  | 'background'
  | 'layers'
  | 'review';

export interface ViewFlags {
  grid: boolean;
  safeZones: boolean;
  snap: boolean;
  zoom: number;
  /** Pixel rulers along the canvas, following zoom and scroll. */
  rulers: boolean;
  /** Pink snap guides drawn while a drag snaps. */
  guides: boolean;
  /** Stronger borders and text for low-vision users. */
  contrast: boolean;
  /** 3 mm bleed edge outside print pages. */
  bleed: boolean;
}

/** A photo/sticker the next library or upload pick replaces instead of adding. */
export interface ReplaceTarget {
  kind: 'photo' | 'sticker';
  id: string;
}

export interface EditorState {
  id: string;
  design: Design;
  updated: number;
  selection: string[];
  panel: PanelId;
  dirty: boolean;
  dragging: boolean;
  ignoredRemote: number;
  view: ViewFlags;
  clipboard: DesignItem[] | null;
  cutMode: boolean;
}

export function blankState(): EditorState {
  return {
    id: '',
    design: { version: 1, name: '', format: 'story', items: [] },
    updated: 0,
    selection: [],
    panel: 'text',
    dirty: false,
    dragging: false,
    ignoredRemote: 0,
    view: { grid: false, safeZones: false, snap: true, zoom: 1, rulers: false, guides: true, contrast: false, bleed: false },
    clipboard: null,
    cutMode: false,
  };
}

/* ---- items ---- */

export function topItems(design: Design): DesignItem[] {
  return design.items ?? [];
}

export function findItem(design: Design, id: string): DesignItem | null {
  for (const it of topItems(design)) {
    if (it.id === id) return it;
    if (it.type === 'group') {
      for (const c of it.items ?? []) if (c.id === id) return c;
    }
  }
  return null;
}

/** Local-only change for a live preview; the commit that follows makes it real. */
export function previewProps(state: EditorState, id: string, props: Record<string, unknown>): void {
  const it = findItem(state.design, id);
  if (it) it.props = { ...(it.props ?? {}), ...props };
}

export function selectedItems(state: EditorState): DesignItem[] {
  return state.selection
    .map((id) => findItem(state.design, id))
    .filter((it): it is DesignItem => it !== null);
}

export function selectedToplevel(state: EditorState): DesignItem[] {
  const ids = new Set(state.selection);
  return topItems(state.design).filter((it) => ids.has(it.id));
}

/** A free default group name (`Group 1`, `Group 2`, …): the count alone can
reuse a live id after an ungroup, which the engine refuses as a duplicate. */
export function freshGroupName(design: Design): string {
  const count = topItems(design).filter((t) => t.type === 'group').length;
  for (let n = count + 1; ; n++) {
    const name = `Group ${n}`;
    if (findItem(design, name) === null) return name;
  }
}

export function freshId(design: Design, base: string): string {
  const taken = new Set<string>();
  const walk = (items: DesignItem[] | undefined): void => {
    for (const it of items ?? []) {
      taken.add(it.id);
      walk(it.items);
    }
  };
  walk(design.items);
  const root = base || 'item';
  if (!taken.has(root)) return root;
  for (let i = 2; i < 10000; i++) {
    if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  }
  return `${root}-copy`;
}

export function deepCopyWithIds(
  design: Design,
  item: DesignItem,
  dx: number,
  dy: number,
): DesignItem {
  const copy = JSON.parse(JSON.stringify(item)) as DesignItem;
  // Assign fresh ids without touching the passed design: collect first.
  const taken = new Set<string>();
  const collect = (items: DesignItem[] | undefined): void => {
    for (const it of items ?? []) {
      taken.add(it.id);
      collect(it.items);
    }
  };
  collect(design.items);
  const make = (base: string): string => {
    if (!taken.has(base)) {
      taken.add(base);
      return base;
    }
    for (let i = 2; i < 10000; i++) {
      if (!taken.has(`${base}-${i}`)) {
        taken.add(`${base}-${i}`);
        return `${base}-${i}`;
      }
    }
    taken.add(`${base}-copy`);
    return `${base}-copy`;
  };
  const rename = (node: DesignItem, isRoot: boolean): void => {
    node.id = make(node.id || 'item');
    if (isRoot) {
      // Group children stay relative to their group center.
      node.x = (node.x ?? 0) + dx;
      node.y = (node.y ?? 0) + dy;
    }
    for (const c of node.items ?? []) rename(c, false);
  };
  rename(copy, true);
  return copy;
}

/* ---- local favorites and recents (per browser) ---- */

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, items: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* favorites just do not persist */
  }
}

export function favorites(): string[] {
  return readList('blum-favs');
}

/** View flags remembered per browser (guarded: private mode, old shapes). */
export function loadViewFlags(): Partial<ViewFlags> {
  try {
    const raw = localStorage.getItem('blum-view');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<ViewFlags> = {};
    for (const key of ['grid', 'safeZones', 'snap', 'rulers', 'guides', 'contrast', 'bleed'] as const) {
      if (typeof parsed[key] === 'boolean') out[key] = parsed[key] as boolean;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveViewFlags(view: ViewFlags): void {
  try {
    // Zoom is session state, not a saved flag: exclude it from the stored view.
    const { zoom: _excluded, ...flags } = view;
    localStorage.setItem('blum-view', JSON.stringify(flags));
  } catch {
    /* view flags just do not persist */
  }
}

export function toggleFavorite(id: string): string[] {
  const favs = readList('blum-favs');
  const at = favs.indexOf(id);
  if (at >= 0) favs.splice(at, 1);
  else favs.unshift(id);
  writeList('blum-favs', favs.slice(0, 500));
  return favs;
}

export function recents(): string[] {
  return readList('blum-recent');
}

export function pushRecent(id: string): void {
  const items = readList('blum-recent').filter((x) => x !== id);
  items.unshift(id);
  writeList('blum-recent', items.slice(0, 24));
}

/* ---- toast ---- */

let toastTimer = 0;

export function toast(message: string): void {
  document.querySelector('.toast')?.remove();
  window.clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.append(el);
  toastTimer = window.setTimeout(() => el.remove(), 2600);
}
