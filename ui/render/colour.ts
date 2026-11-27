// Shared color fallback: the engine owns the grammar, the render only picks.
import { isColor } from '../engine/names.js';

export function resolveColor(
  ref: string | undefined,
  fallback: string,
): string {
  const s = String(ref ?? '');
  if (isColor(s)) return s;
  return fallback;
}
