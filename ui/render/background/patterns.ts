// Background pattern tiles and layers.
const PATTERN_NAMES = new Set(['dots', 'grid', 'stripes', 'checker', 'waves', 'crosses',
  'zigzag', 'triangles', 'hexagons', 'diamonds', 'scallops', 'bricks', 'hearts', 'stars',
  'zellige', 'scales', 'arches']);

import { pageOf } from '../../engine/index.js';
import type { Design, DesignBackground } from '../types.js';
import { num } from '../util.js';
import { resolveColor } from '../colour.js';

/** Pattern settings with the engine defaults (missing = default). */
function patternSettings(bg: DesignBackground): { scale: number; angle: number; weight: number } {
  const scale = num(bg.patternScale, 1);
  const weight = num(bg.patternWeight, 1);
  return {
    scale: scale > 0 ? scale : 1,
    angle: Number.isFinite(num(bg.patternAngle, 0)) ? num(bg.patternAngle, 0) : 0,
    weight: weight > 0 ? weight : 1,
  };
}

/** Scale a rotated background layer needs to still cover the page. */
function patternCover(angleDeg: number, w: number, h: number): number {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a === 0) return 1;
  const q = a % 180;
  const t = (q > 90 ? 180 - q : q) * (Math.PI / 180);
  const ratio = h / Math.max(1, w);
  return Math.abs(Math.cos(t)) + ratio * Math.abs(Math.sin(t));
}

function patternTile(pattern: string, color: string, weight: number): { svg: string; sx: number; sy: number } {
  const c = color;
  const w = weight > 0 ? weight : 1;
  // Line width (or dot size) scaled by the weight; identical to the old
  // tiles when the weight is 1.
  const at = (v: number): string => String(Math.round(v * w * 100) / 100);
  switch (pattern) {
    case 'grid':
      // Tile sizes are design px, chosen by eye: most
      // patterns repeat on a 60 px grid (the page is 1080 wide);
      // checker squares measured at ~28 px, so its tile is 56.
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M60 0H0V60' fill='none' stroke='${c}' stroke-width='${at(2.5)}'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'stripes':
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M-60 60L60 -60M0 60L60 0M0 120L120 0' fill='none'`
          + ` stroke='${c}' stroke-width='${at(11)}'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'checker': {
      // Squares grow about their cell centre: same-colour overlap is
      // invisible, so the tile stays seamless at any weight.
      const s = 28 * w;
      const o = (28 - s) / 2;
      const f = (v: number): string => String(Math.round(v * 100) / 100);
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'>`
          + `<rect x='${f(o)}' y='${f(o)}' width='${f(s)}' height='${f(s)}' fill='${c}'/>`
          + `<rect x='${f(28 + o)}' y='${f(28 + o)}' width='${f(s)}' height='${f(s)}' fill='${c}'/></svg>`,
        sx: 56, sy: 56,
      };
    }
    case 'waves':
      // Waves are sharp chevrons: wavelength 60, one row per tile.
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M-30 20L0 40L30 20L60 40L90 20' fill='none'`
          + ` stroke='${c}' stroke-width='${at(6)}' stroke-linejoin='miter'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'crosses':
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M30 21v18M21 30h18' stroke='${c}' stroke-width='${at(6)}'/>`
          // Quarter plus signs on the corners: neighbouring tiles finish them.
          + `<path d='M0 -9v18M-9 0h18M60 -9v18M51 0h18M0 51v18M-9 60h18M60 51v18M51 60h18'`
          + ` stroke='${c}' stroke-width='${at(6)}'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'zigzag':
      // Two interior vertical zigzags (waves run horizontal): the columns
      // never touch the side edges, and the 30 px period divides the tile,
      // so neighbours continue every stroke.
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M15 -10L25 5L15 20L25 35L15 50L25 65' fill='none'`
          + ` stroke='${c}' stroke-width='${at(6)}' stroke-linejoin='miter'/>`
          + `<path d='M45 -10L55 5L45 20L55 35L45 50L55 65' fill='none'`
          + ` stroke='${c}' stroke-width='${at(6)}' stroke-linejoin='miter'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'triangles':
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M30 18L42 40L18 40Z' fill='none'`
          + ` stroke='${c}' stroke-width='${at(6)}' stroke-linejoin='round'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'hexagons':
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M46 30L38 43.9L22 43.9L14 30L22 16.1L38 16.1Z' fill='none'`
          + ` stroke='${c}' stroke-width='${at(6)}' stroke-linejoin='round'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'diamonds':
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M30 16L44 30L30 44L16 30Z' fill='none'`
          + ` stroke='${c}' stroke-width='${at(6)}' stroke-linejoin='round'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'scallops':
      // Stroked rings on the corners and centre: neighbours complete the
      // edge rings, like the corner plus signs of the crosses.
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' fill='none' stroke='${c}'`
          + ` stroke-width='${at(5)}'>`
          + `<circle cx='0' cy='0' r='18'/><circle cx='60' cy='0' r='18'/>`
          + `<circle cx='0' cy='60' r='18'/><circle cx='60' cy='60' r='18'/>`
          + `<circle cx='30' cy='30' r='18'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'bricks':
      // One running bond per tile: full-width courses, offset joints.
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M0 0H60M0 30H60M0 60H60M30 0V30M15 30V60M45 30V60' fill='none'`
          + ` stroke='${c}' stroke-width='${at(2.5)}'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'hearts':
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M30 46C22 38 14 32 14 24C14 18 18 14 23 14C26 14 29 16 30 19`
          + `C31 16 34 14 37 14C42 14 46 18 46 24C46 32 38 38 30 46Z' fill='${c}'`
          + ` transform='translate(30 32) scale(${at(1)}) translate(-30 -32)'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'stars': {
      const f = (v: number): string => String(Math.round(v * 100) / 100);
      let pts = '';
      for (let k = 0; k < 10; k++) {
        const r = k % 2 === 0 ? 16 : 16 * 0.42;
        const a = -Math.PI / 2 + (Math.PI / 5) * k;
        pts += `${f(30 + r * Math.cos(a))},${f(30 + r * Math.sin(a))} `;
      }
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<polygon points='${pts.trim()}' fill='${c}'`
          + ` transform='translate(30 30) scale(${at(1)}) translate(-30 -30)'/></svg>`,
        sx: 60, sy: 60,
      };
    }
    case 'zellige':
      // Eight-point star (two overlapped squares) with corner diamonds
      // that neighbouring tiles finish.
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' fill='none' stroke='${c}'`
          + ` stroke-width='${at(3)}'>`
          + `<path d='M16 16H44V44H16Z M30 8L38 22L52 30L38 38L30 52L22 38L8 30L22 22Z'/>`
          + `<path d='M0 -6L6 0L0 6L-6 0Z M60 -6L66 0L60 6L54 0Z M0 54L6 60L0 66L-6 60Z`
          + ` M60 54L66 60L60 66L54 60Z'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'scales':
      // Offset scallop rows, one every 30 px: the tile edge cuts
      // mid-pattern so rows continue seamlessly.
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<path d='M-30 15Q-15 -5 0 15Q15 -5 30 15Q45 -5 60 15Q75 -5 90 15`
          + ` M-30 45Q-15 25 0 45Q15 25 30 45Q45 25 60 45Q75 25 90 45' fill='none'`
          + ` stroke='${c}' stroke-width='${at(3.5)}'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'arches':
      // Pointed-arch arcade: half arches on the sides are finished by
      // neighbouring tiles.
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' fill='none' stroke='${c}'`
          + ` stroke-width='${at(3)}'>`
          + `<path d='M12 56V34Q12 16 30 8Q48 16 48 34V56'/>`
          + `<path d='M-18 56V34Q-18 16 0 8Q18 16 18 34V56'/>`
          + `<path d='M42 56V34Q42 16 60 8Q78 16 78 34V56'/></svg>`,
        sx: 60, sy: 60,
      };
    case 'dots':
    default:
      return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'>`
          + `<circle cx='30' cy='30' r='${at(6)}' fill='${c}'/></svg>`,
        sx: 60, sy: 60,
      };
  }
}

export function washColor(design: Design): string {
  const bg = design.background ?? { kind: 'color', color: '#ffffff' };
  if (bg.kind === 'pattern') {
    return bg.patternBackground
      ? resolveColor(bg.patternBackground, '#ffffff')
      : '#ffffff';
  }
  return resolveColor(bg.color, '#ffffff');
}

/** The pattern layer parts, or null when the background is not a drawn pattern. */
export function patternBits(
  design: Design,
  u: (px: number) => string,
): { wash: string; url: string; size: string; tilt: string } | null {
  const bg = design.background ?? { kind: 'color', color: '#ffffff' };
  if (bg.kind !== 'pattern' || !bg.pattern || !PATTERN_NAMES.has(bg.pattern)) return null;
  const color = resolveColor(bg.patternColor, '#111111');
  const wash = bg.patternBackground
    ? resolveColor(bg.patternBackground, '#ffffff')
    : '#ffffff';
  const { scale, angle, weight } = patternSettings(bg);
  const tile = patternTile(bg.pattern, color, weight);
  // A rotated layer is scaled up to still cover the page; the tile size is
  // divided by the same factor so the pattern keeps its size.
  const page = pageOf(design.format ?? 'story', design.width, design.height);
  const cover = Math.round(patternCover(angle, page.width, page.height) * 1000) / 1000;
  const url = `url("data:image/svg+xml,${encodeURIComponent(tile.svg)}")`;
  const size = `${u(tile.sx * scale / cover)} ${u(tile.sy * scale / cover)}`;
  // Rotating the layer (not the tile) keeps every pattern seamless.
  const tilt = cover === 1 ? '' : `;transform:rotate(${angle}deg) scale(${cover});transform-origin:center`;
  return { wash, url, size, tilt };
}