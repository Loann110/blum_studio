// Editor overlay hooks: the shared contract every overlay leaf uses.
// Lives here so the leaves never import the overlay entry back.
import type { EditorState } from '../state.js';

export interface OverlayHooks {
  state: EditorState;
  save(name?: string): void | Promise<void>;
  undo(): void;
  redo(): void;
  exportPng(): void;
  exportPdf(): void;
  setPanel(panel: EditorState['panel']): void;
  commitText(id: string, text: string): void;
  renderAll(): void;
  cut(): void;
  copy(): void;
  paste(): void;
  duplicateSel(): void;
  deleteSel(): void;
  reorder(to: string): void;
  toggleLockSel(): void;
  groupSel(): void;
  ungroupSel(): void;
  selectAll(): void;
  reloadRemote(): void;
  dismissBanner(): void;
  resetDesign(): void;
  duplicateDesign(): Promise<void>;
  deleteDesignFlow(): void;
}

export let hooks: OverlayHooks | null = null;

export function mountOverlays(h: OverlayHooks): void {
  hooks = h;
}

export function closeFloating(): void {
  document.querySelectorAll('.menu, .context-menu, .dialog-back').forEach((el) => {
    if (!el.classList.contains('keep')) el.remove();
  });
}
