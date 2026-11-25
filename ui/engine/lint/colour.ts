// Engine color math.
/* ---- color ---- */

function hexVal(c: string): number {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'a' && c <= 'f') return c.charCodeAt(0) - 87;
  if (c >= 'A' && c <= 'F') return c.charCodeAt(0) - 55;
  return 0;
}

function channel(hex: string, i: number): number {
  let v: number;
  if (hex.length === 4) {
    v = hexVal(hex[1 + i]) * 17;
  } else {
    v = hexVal(hex[1 + 2 * i]) * 16 + hexVal(hex[1 + 2 * i + 1]);
  }
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  if (hex.length !== 4 && hex.length !== 7) return 0;
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
