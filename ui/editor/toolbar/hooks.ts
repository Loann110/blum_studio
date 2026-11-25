// Editor toolbar hooks: the shared contract every toolbar leaf uses.
// Lives here so the leaves never import the toolbar entry back.
import type { EditorHooks, ReplaceTarget } from '../state.js';

export interface ToolbarHooks extends EditorHooks {
  openImages(replace?: ReplaceTarget): void;
  openStickers(replace?: ReplaceTarget): void;
  /** Redraws the page only (live previews: the bar and its open picker stay put). */
  redraw(): void;
}

export let hooks: ToolbarHooks | null = null;
export function mountToolbar(h: ToolbarHooks): void {
  hooks = h;
}
