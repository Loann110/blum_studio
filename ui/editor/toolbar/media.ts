// Editor toolbar media tools: stickers, images and photos.
import { iconButton, numberStepper, separator, toolGroup } from './controls.js';
import { opacityStepper } from './shared.js';
import { colorSwatch } from './colour.js';
import { hooks } from './hooks.js';
import { previewProps, findItem, toast, type EditorState } from '../state.js';
import { uploadMedia } from '../api.js';
import { resolveSrc } from '../../render/items/photo.js';
import { removeBackground } from '../../cutout/cutout.js';

/* ---- background removal ---- */

let cutting = false;

/** Cuts the photo's subject out, stores it as new media and points the photo at it. */
async function cutOut(st: EditorState, id: string): Promise<void> {
  const src = String((findItem(st.design, id)?.props as Record<string, unknown> | undefined)?.src ?? '');
  if (!src || cutting) return;
  cutting = true;
  toast('Removing the background…');
  try {
    const png = await (await fetch(await removeBackground(resolveSrc(src, '/assets', '/media')))).blob();
    const stored = await uploadMedia(st.id, new File([png], 'cutout.png', { type: 'image/png' }));
    await hooks?.commit([{ op: 'update', id, patch: { src: stored.src, fit: 'contain' } }]);
    toast('Background removed');
  } catch (err) {
    toast(`Background removal failed: ${(err as Error).message}`);
  } finally {
    cutting = false;
  }
}

export function renderStickerTools(root: HTMLElement, st: EditorState, id: string): void {
  if (!hooks) return;
  const item = findItem(st.design, id);
  const tint = String((item?.props as Record<string, unknown> | undefined)?.tint ?? '');
  // One colour for the whole artwork (doodles, icons); the swatch shows the artwork's own colours when untinted.
  colorSwatch(root, st, tint || '#111111', item?.type === 'vector' ? 'Vector colour' : 'Sticker tint', 'sticker-tint', (value) => {
    void hooks?.commit([{ op: 'update', id, patch: { tint: value } }]);
  }, (value) => previewProps(st, id, { tint: value }), (panel) => {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn';
    reset.textContent = 'Original colours';
    reset.disabled = !tint;
    reset.addEventListener('click', () => void hooks?.commit([{ op: 'update', id, patch: { tint: '' } }]));
    panel.append(reset);
  });
  opacityStepper(root, st, [id]);
  // Vectors (draw_svg) share this bar; only catalogue stickers can be swapped.
  if (item?.type === 'sticker') {
    toolGroup(root).append(
      iconButton('images', 'Replace sticker', () => hooks?.openStickers({ kind: 'sticker', id })),
    );
  }
  separator(root);
}

/** Plain images share the photo filters; replace commits `src`, which both kinds accept. */
export function renderImageTools(root: HTMLElement, st: EditorState, id: string): void {
  if (!hooks) return;
  opacityStepper(root, st, [id]);
  toolGroup(root).append(
    iconButton('images', 'Replace image', () => hooks?.openImages({ kind: 'photo', id })),
  );
  separator(root);
}

export function renderPhotoTools(root: HTMLElement, st: EditorState, id: string): void {
  if (!hooks) return;
  const it = findItem(st.design, id);
  const props = (it?.props ?? {}) as Record<string, unknown>;
  const masks = toolGroup(root);
  for (const [icon, value, label] of [
    ['square', 'rect', 'Rectangle'],
    ['circle', 'circle', 'Circle'],
    ['mask-arch', 'arch', 'Arch'],
    ['star', 'star', 'Star'],
    ['heart', 'heart', 'Heart'],
    ['mask-blob', 'blob', 'Blob'],
  ] as const) {
    masks.append(
      iconButton(icon, `${label} mask`, () => {
        void hooks?.commit([{ op: 'update', id, patch: { mask: value } }]);
      }, props.mask === value),
    );
  }
  const fit = toolGroup(root);
  fit.append(
    iconButton('scan', `Fit: ${String(props.fit ?? 'cover')} (toggle)`, () => {
      const next = (props.fit ?? 'cover') === 'cover' ? 'contain' : 'cover';
      void hooks?.commit([{ op: 'update', id, patch: { fit: next } }]);
    }),
  );
  numberStepper(root, Number(props.cornerRadius ?? 24), 4, 0, 400, 'corners', (v) => {
    void hooks?.commit([{ op: 'update', id, patch: { cornerRadius: v } }]);
  });
  opacityStepper(root, st, [id]);
  toolGroup(root).append(
    iconButton('images', 'Choose an image', () => hooks?.openImages({ kind: 'photo', id })),
  );
  if (props.src) {
    toolGroup(root).append(iconButton('scissors', 'Remove background', () => void cutOut(st, id)));
  }
  separator(root);
}