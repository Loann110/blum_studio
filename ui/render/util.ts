// Shared render helpers: escaping, numbers, urls, units and boxes.
export function esc(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Page width -> story, so the design scales with its box.
export function unitsFor(width: number): (px: number) => string {
  const w = num(width, 1080) || 1080;
  return (px: number): string => `${(num(px) * 100 / w).toFixed(4)}cqw`;
}

// Placement of one box: center-based, clockwise rotation.
export function boxStyle(
  u: (px: number) => string,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  opacity: number,
): string[] {
  const style = [
    `left:${u(x - w / 2)}`,
    `top:${u(y - h / 2)}`,
    `width:${u(w)}`,
    `height:${u(h)}`,
    `transform:rotate(${num(angle)}deg)`,
  ];
  if (num(opacity, 1) !== 1) style.push(`opacity:${num(opacity, 1)}`);
  return style;
}

export function joinUrl(base: string, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}