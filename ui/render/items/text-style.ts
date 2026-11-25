// Shared text CSS values: the flat branch and curved text render the same font.
import type { TextProps } from '../types.js';

export const FONT_FALLBACK = "'Inter', system-ui, sans-serif";

export function textCaseFilter(textCase: TextProps['textCase']): string {
  if (textCase === 'upper') return 'uppercase';
  if (textCase === 'lower') return 'lowercase';
  if (textCase === 'title') return 'capitalize';
  return 'none';
}
