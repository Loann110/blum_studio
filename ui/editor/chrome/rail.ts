// Editor rail: panels and selection.
import { panelRoot, state } from '../live.js';
import { setReplaceTarget } from '../panels/hooks.js';
import { bumpPanelToken, panelToken, renderAll } from '../render-loop.js';
import { renderPanel } from '../panels/index.js';
import { refreshIcons } from '../icons.js';
import type { PanelId } from '../state.js';

export const PANELS: { id: PanelId; label: string; icon: string }[] = [
  { id: 'text', label: 'Text', icon: 'type' },
  { id: 'shapes', label: 'Shapes', icon: 'shapes' },
  { id: 'stickers', label: 'Stickers', icon: 'sticker' },
  { id: 'images', label: 'Images', icon: 'image' },
  { id: 'background', label: 'Canvas', icon: 'pipette' },
  { id: 'layers', label: 'Layers', icon: 'layers' },
  { id: 'review', label: 'Review', icon: 'shield' },
];

/** Hides the side panel to give the canvas more room; any rail button opens it again. */
export function closePanel(): void {
  setReplaceTarget(null);
  panelRoot.classList.add('collapsed');
  document.querySelectorAll('.rail button').forEach((b) => b.classList.remove('active'));
  renderAll();
}

/** Marks the rail button for a panel without opening it (boot state). */
export function markRail(panel: PanelId): void {
  document.querySelectorAll('.rail button').forEach((b) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.panel === panel);
  });
}

export function setPanel(panel: PanelId): void {
  const wasCollapsed = panelRoot.classList.contains('collapsed');
  panelRoot.classList.remove('collapsed');
  if (wasCollapsed) renderAll();
  state.panel = panel;
  markRail(panel);
  const token = bumpPanelToken();
  void renderPanel(panelRoot, state).then(() => {
    if (token === panelToken) refreshIcons();
  });
}