// Shared text CSS values: the flat branch and curved text render the same font.
import type { TextProps } from '../types.js';
import { isFontName } from '../../engine/names.js';

export const FONT_FALLBACK = "'Inter', system-ui, sans-serif";

// A hand-edited font never reached validation: fall back to Inter instead of
// emitting it into font-family.
export function fontStack(name: unknown): string {
  const safe = typeof name === 'string' && isFontName(name) ? name : 'Inter';
  return `'${safe}', ${FONT_FALLBACK}`;
}

export function textCaseFilter(textCase: TextProps['textCase']): string {
  if (textCase === 'upper') return 'uppercase';
  if (textCase === 'lower') return 'lowercase';
  if (textCase === 'title') return 'capitalize';
  return 'none';
}
