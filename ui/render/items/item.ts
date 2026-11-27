// Item dispatch: wrap each item by type.
import type { DesignItem, ShapeProps, TextProps } from '../types.js';
import { isBlendMode } from '../../engine/names.js';
import { boxStyle, esc, num } from '../util.js';
import { textMarkup } from './text.js';
import { shapeMarkup } from './shape.js';
import { photoMarkup } from './photo.js';
import { groupMarkup } from './group.js';

/** Every rendered item carries its id, so the editor can find it on the page. */
export function itemHtml(
  item: DesignItem,
  u: (px: number) => string,
  assetsBase: string,
  mediaBase: string,
  parentAngle: number,
  parentX: number,
  parentY: number,
): string {
  const html = itemMarkup(item, u, assetsBase, mediaBase, parentAngle, parentX, parentY);
  return html.replace('<div', `<div data-id="${esc(item.id)}"`);
}

function itemMarkup(
  item: DesignItem,
  u: (px: number) => string,
  assetsBase: string,
  mediaBase: string,
  parentAngle: number,
  parentX: number,
  parentY: number,
): string {
  if (item.visible === false) return '';
  const w = Math.max(1, num(item.width, 100));
  const h = Math.max(1, num(item.height, 100));
  // Absolute placement: rotate the group-relative offset by the parent angle.
  const relX = num(item.x);
  const relY = num(item.y);
  const rad = (parentAngle * Math.PI) / 180;
  const x = parentX + relX * Math.cos(rad) - relY * Math.sin(rad);
  const y = parentY + relX * Math.sin(rad) + relY * Math.cos(rad);
  const angle = num(item.angle) + parentAngle;
  const opacity = num(item.opacity, 1);
  const props = item.props ?? {};
  const parts = boxStyle(u, x, y, w, h, angle, opacity);
  // A hand-edited blend never reached validation: skip unknown modes.
  if (typeof item.blend === 'string' && item.blend !== '' && item.blend !== 'normal' && isBlendMode(item.blend)) {
    parts.push(`mix-blend-mode:${item.blend}`);
  }
  const base = parts.join(';');

  if (item.type === 'text') {
    return textMarkup(item, props as TextProps, u, assetsBase, mediaBase, w, h, base);
  }
  if (item.type === 'shape') {
    return shapeMarkup(item, props as ShapeProps, u, w, h, base);
  }
  if (item.type === 'image' || item.type === 'sticker' || item.type === 'vector' || item.type === 'photo') {
    return photoMarkup(item, u, assetsBase, mediaBase, w, h, base);
  }
  if (item.type === 'group') {
    // The child renderer closes over this box, so group.ts never imports back.
    return groupMarkup(item, u, base, (c) =>
      itemHtml(c, u, assetsBase, mediaBase, 0, w / 2, h / 2));
  }

  return '';
}
