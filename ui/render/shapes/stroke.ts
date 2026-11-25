// Shape stroke helpers: line shapes, stroke attrs and dashes.
export const LINE_SHAPES = new Set(['line', 'separator', 'dotted', 'arrow', 'doubleArrow', 'blockArrow']);

export function strokeAttrs(stroke: string, width: number): string {
  if (!stroke || !(width > 0)) return '';
  return ` stroke="${stroke}" stroke-width="${width}"`;
}

/** Dash pattern for a line style, or empty for a solid stroke. */
export function lineDash(style: string, t: number): string {
  if (style === 'dashed') return ` stroke-dasharray="${t * 2.4} ${t * 1.6}"`;
  if (style === 'dotted') {
    return ` stroke-dasharray="0.1 ${t * 2.4}" stroke-linecap="round"`;
  }
  return '';
}