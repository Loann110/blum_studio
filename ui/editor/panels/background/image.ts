// Editor background image.
import { commitBg, type BackgroundPanelHooks } from './hooks.js';
import { drawPhotoGrid } from '../hooks.js';
import { importUrl, uploadMedia } from '../../api.js';
import { toast } from '../../state.js';

export function renderImage(root: HTMLElement, hooks: BackgroundPanelHooks): void {
  const box = document.createElement('div');
  box.innerHTML = '<h3>Image</h3>';
  const up = document.createElement('input');
  up.type = 'file';
  up.accept = 'image/png,image/jpeg,image/webp,image/gif';
  up.setAttribute('aria-label', 'Upload a background image');
  up.style.marginBottom = '8px';
  up.addEventListener('change', () => {
    const picked = up.files?.[0];
    if (picked) {
      void uploadMedia(hooks.designId, picked).then(
        (got) => commitBg(hooks, { kind: 'image', image: got.src }),
        (err: Error) => toast(`Import failed: ${err.message}`),
      );
    }
    up.value = '';
  });
  box.append(up);

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search photos…';
  search.setAttribute('aria-label', 'Search background photos');
  const grid = document.createElement('div');
  grid.className = 'thumb-grid';
  box.append(search, grid);

  let timer = 0;
  const drawPhotos = (): Promise<void> => drawPhotoGrid(grid, search.value.trim(), 24, (p) => {
    void importUrl(hooks.designId, p.url, p.id).then(
      (got) => commitBg(hooks, { kind: 'image', image: got.src }),
      (err: Error) => toast(`Import failed: ${err.message}`),
    );
  });
  search.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void drawPhotos(), 250);
  });

  root.append(box);
  void drawPhotos();
}