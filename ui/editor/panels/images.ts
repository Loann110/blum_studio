// Editor images panel: uploads, library and insert.
import { centerOf, drawPhotoGrid, hooks, liveReplaceTarget, replaceHint, setReplaceTarget } from './hooks.js';
import { importUrl, uploadMedia } from '../api.js';
import { freshId, toast, type EditorState } from '../state.js';
import { pageOf } from '../../engine/index.js';

export async function renderImages(root: HTMLElement, st: EditorState): Promise<void> {
  if (!hooks) return;
  if (liveReplaceTarget('photo')) {
    replaceHint(root, 'Click a photo to replace the selected one.', 'images');
  }
  const up = document.createElement('div');
  up.innerHTML = '<h3>Import</h3>';
  // The native file input stays hidden behind a button in the app's style.
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
  file.hidden = true;
  file.addEventListener('change', () => {
    const picked = file.files?.[0];
    if (picked) void addPhotoFile(picked);
    file.value = '';
  });
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'btn upload-btn';
  pick.innerHTML = '<i data-lucide="upload"></i> Upload an image';
  pick.addEventListener('click', () => file.click());
  up.append(file, pick);

  const lib = document.createElement('div');
  lib.innerHTML = '<h3>Photo library</h3>';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search photos…';
  search.setAttribute('aria-label', 'Search photos');
  const grid = document.createElement('div');
  grid.className = 'thumb-grid';
  lib.append(search, grid);

  let timer = 0;
  const drawPhotos = async (): Promise<void> => {
    if (!hooks) return;
    await drawPhotoGrid(grid, search.value.trim(), 60, (p) => void addPhotoUrl(p));
  };
  search.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void drawPhotos(), 250);
  });

  const addPhotoFile = async (picked: File): Promise<void> => {
    if (!hooks) return;
    try {
      const got = await uploadMedia(st.id, picked);
      await insertPhoto(got.src);
    } catch (err) {
      toast(`Import failed: ${(err as Error).message}`);
    }
  };

  const addPhotoUrl = async (p: { id: string; url: string }): Promise<void> => {
    if (!hooks) return;
    try {
      const got = await importUrl(st.id, p.url, p.id);
      await insertPhoto(got.src);
    } catch (err) {
      toast(`Import failed: ${(err as Error).message}`);
    }
  };

  const insertPhoto = async (src: string): Promise<void> => {
    if (!hooks) return;
    const again = liveReplaceTarget('photo');
    if (again) {
      const ok = await hooks.commit([{ op: 'update', id: again.id, patch: { src } }]);
      if (ok) {
        setReplaceTarget(null);
        hooks.showPanel('images');
      }
      return;
    }
    const size = Math.round((st.design.format === 'post' ? 640 : 700) * (pageOf(st.design.format ?? 'story', st.design.width, st.design.height).width / 1080));
    const c = centerOf(st);
    const id = freshId(st.design, 'photo');
    const ok = await hooks.commit([
      {
        op: 'add',
        item: {
          id,
          name: 'Photo',
          type: 'photo',
          x: c.x,
          y: c.y,
          width: size,
          height: size,
          props: { src, mask: 'rect', fit: 'cover', cornerRadius: 24 },
        },
      },
    ]);
    if (ok) hooks.setSelection([id]);
  };

  root.append(up, lib);
  await drawPhotos();
}