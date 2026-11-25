// Editor background panel: entry and dispatch by background kind.
import { renderFlat } from './flat.js';
import { renderGradients } from './gradients.js';
import { renderImage } from './image.js';
import { renderPatterns } from './patterns.js';
import { renderGrain } from './grain.js';
import type { BackgroundPanelHooks } from './hooks.js';
import type { EditorState } from '../../state.js';

export function renderBackgroundPanel(
  root: HTMLElement,
  st: EditorState,
  hooks: BackgroundPanelHooks,
): void {
  renderFlat(root, st, hooks);
  renderGradients(root, hooks);
  renderPatterns(root, st, hooks);
  renderGrain(root, st, hooks);
  renderImage(root, hooks);
}