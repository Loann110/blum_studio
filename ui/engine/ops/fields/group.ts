// Engine group field updates.
import type { Item, GroupProps } from '../../model.js';
import { applyShadow } from './common.js';

export function applyGroupField(
  it: Item,
  key: string,
  s: string,
  n: number,
  b: boolean,
  i: number,
  which: number,
): boolean {
    const v = which === 3 ? i : n;
    const g = it.props as GroupProps;
    if (
      key === 'shadowColor' || key === 'shadowX' || key === 'shadowY' ||
      key === 'shadowBlur'
    ) {
      applyShadow(key, s, v, which, g);
      return true;
    }
  return false;
}