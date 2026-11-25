// Editor side panels: entry and dispatch by panel.
import { refreshIcons } from '../icons.js';
import { renderTextPanel } from './text.js';
import { renderShapesPanel } from './shapes.js';
import { renderStickers } from './stickers.js';
import { renderImages } from './images.js';
import { renderLayers } from './layers.js';
import { renderReview } from './review.js';
import { renderBackgroundPanel } from './background/index.js';
import { type EditorState } from '../state.js';
import { hooks, setHooks, type PanelHooks } from './hooks.js';
import { mountTextPanel } from './text.js';

export function mountPanels(h: PanelHooks): void {
  setHooks(h);
  mountTextPanel(h);
}

export async function renderPanel(root: HTMLElement, st: EditorState): Promise<void> {
  if (!hooks) return;
  root.innerHTML = '';
  const title = document.createElement('h2');
  const names: Record<EditorState['panel'], string> = {
    text: 'Text',
    shapes: 'Shapes',
    stickers: 'Stickers',
    images: 'Images',
    background: 'Background',
    layers: 'Layers',
    review: 'Review',
  };
  title.textContent = names[st.panel];
  const head = document.createElement('div');
  head.className = 'panel-head';
  const close = document.createElement('button');
  close.className = 'btn icon';
  close.title = 'Close panel';
  close.setAttribute('aria-label', 'Close panel');
  close.innerHTML = '<i data-lucide="x"></i>';
  close.addEventListener('click', () => hooks?.closePanel());
  head.append(title, close);
  root.append(head);
  if (st.panel === 'text') renderTextPanel(root, st);
  else if (st.panel === 'shapes') renderShapesPanel(root, st, hooks);
  else if (st.panel === 'stickers') await renderStickers(root, st);
  else if (st.panel === 'images') await renderImages(root, st);
  else if (st.panel === 'background') renderBackgroundPanel(root, st, { ...hooks, designId: st.id });
  else if (st.panel === 'layers') renderLayers(root, st);
  else await renderReview(root, st);
  refreshIcons();
}
