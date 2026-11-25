// Shared HTML renderer: draws the design as scalable HTML/CSS.
import type { Design, RenderOptions } from './types.js';
import { esc, unitsFor } from './util.js';
import { backgroundStyle, grainOverlay } from './background/background.js';
import { patternBits, washColor } from './background/patterns.js';
import { itemHtml } from './items/item.js';
import { pageOf } from '../engine/index.js';

export function renderDesign(design: Design, opts: RenderOptions = {}): string {
  const { width, height } = pageOf(design.format ?? 'story', design.width, design.height);
  const u = unitsFor(width);
  const assetsBase = opts.assetsBase ?? '';
  const mediaBase = opts.mediaBase ?? '';
  const items = (design.items ?? [])
    .map((it) => itemHtml(it, u, assetsBase, mediaBase, 0, 0, 0))
    .join('');
  // The page background lives on its own layer, not on the stage box: the
  // stage is the query container, and a container's own cqw lengths resolve
  // against the *outer* page (viewport in the editor, capture width in the
  // export). A child's cqw resolves against the stage, so pattern tiles
  // scale with the page and zoom in both the editor and the PNG export.
  // The stage keeps the flat wash underneath (broken images show it, and
  // readers of the stage style still see the page colour).
  const bg = backgroundStyle(design, assetsBase, mediaBase, u);
  const wash = washColor(design);
  // The stage mirrors the pattern layer (hidden behind the opaque .bBg
  // wash): readers of the stage style still see the page, pattern included.
  const bits = patternBits(design, u);
  const style = `aspect-ratio:${width} / ${height};background:${wash}`
    + (bits ? `;background-image:${bits.url};background-size:${bits.size}` : '');
  return `<div class="blum-stage" style="${esc(style)}">`
    + `<div class="bBg" style="${esc(bg)}"></div>${grainOverlay(design, u)}${items}</div>`;
}

export { LINE_KINDS, lineCaps, lineGeometry } from './shapes/lines.js';
export type { LineCap, LineGeometry } from './shapes/lines.js';
export { resolveColor } from './colour.js';
export { curvedTextHeight } from './items/curved-text.js';
export type { Design, DesignBackground, DesignItem, ShapeProps, TextProps } from './types.js';
export { FORMATS, pageOf, type PageFormat } from '../engine/index.js';
