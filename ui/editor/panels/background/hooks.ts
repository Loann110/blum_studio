// Background panel hooks: the shared contract every background leaf uses.
// Lives here so the leaves never import the background entry back.
import { type Op } from '../../api.js';
import type { DesignBackground } from '../../../render/render.js';
import { type EditorState } from '../../state.js';

export interface BackgroundPanelHooks {
  commit(ops: Op[], coalesce?: string): Promise<boolean>;
  /** Redraws the page only (live colour previews). */
  redraw(): void;
  designId: string;
}

/** New patterns are drawn in red (the user's choice). */
export const PATTERN_DEFAULT_COLOUR = '#e5484d';

export function current(st: EditorState): DesignBackground {
  const bg = st.design.background;
  return bg && typeof bg === 'object' ? bg : { kind: 'color', color: '#ffffff' };
}

export function commitBg(hooks: BackgroundPanelHooks, bg: DesignBackground): void {
  void hooks.commit([{ op: 'set_background', background: bg }]);
}

export function toHex(ref: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(ref)) return ref;
  if (/^#[0-9a-fA-F]{3}$/.test(ref)) {
    return `#${ref[1]}${ref[1]}${ref[2]}${ref[2]}${ref[3]}${ref[3]}`;
  }
  return '#ffffff';
}

export function previewBg(st: EditorState, hooks: BackgroundPanelHooks, bg: DesignBackground): void {
  st.design.background = bg;
  hooks.redraw();
}
