// Group rendering: children placed in the group box.
import type { DesignItem, GroupProps } from '../types.js';
import { esc } from '../util.js';
import { dropShadow } from './shape.js';

export function groupMarkup(
  item: DesignItem,
  u: (px: number) => string,
  base: string,
  renderChild: (child: DesignItem) => string,
): string {
  const props = item.props ?? {};
  // Children are stored relative to the group centre. They are drawn inside
  // the wrapper, which is placed and rotated once: so they are measured from
  // its top-left corner and keep only their own angle.
  const kids = (item.items ?? []).map((c) => renderChild(c)).join('');
  const shadow = dropShadow(props as GroupProps, u);
  const shadowStyle = shadow ? `;filter:${shadow}` : '';
  return `<div class="bGroup" style="${esc(base + shadowStyle)};background:none">${kids}</div>`;
}
