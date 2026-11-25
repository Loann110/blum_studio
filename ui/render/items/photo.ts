// Photo rendering: filters, sources and the photo branches.
import type { DesignItem, FilterProps, ImageProps, PhotoProps, StickerProps } from '../types.js';
import { esc, joinUrl, num } from '../util.js';
import { dropShadow } from './shape.js';
import { resolveColor } from '../colour.js';
import { parseVector, serializeVector } from '../../engine/vector.js';

// A vector is shown as an image (data URI): even a missed check could not run
// script or load anything from there. An invalid one shows the empty placeholder.
function vectorSrc(svg: string | undefined): string {
  try {
    const clean = serializeVector(parseVector(svg ?? ''));
    return `data:image/svg+xml,${encodeURIComponent(clean)}`;
  } catch {
    return '';
  }
}

/** One look for a filter preset; our own named mixes. */
const FILTER_PRESETS: Record<string, string> = {
  vivid: 'saturate(1.35) contrast(1.08)',
  warm: 'sepia(0.28) saturate(1.3)',
  cold: 'saturate(1.08) hue-rotate(-14deg)',
  mono: 'grayscale(1) contrast(1.05)',
  noir: 'grayscale(1) contrast(1.28) brightness(0.96)',
  faded: 'contrast(0.85) brightness(1.06) saturate(0.7)',
  vintage: 'sepia(0.45) contrast(0.95) brightness(1.02) saturate(0.85)',
  dramatic: 'contrast(1.3) saturate(1.15) brightness(0.98)',
};

function scale(v: number): string {
  return String(Math.round((1 + v / 100) * 1000) / 1000);
}

/** Full CSS filter chain for a photo or image, or empty when untouched. */
function photoFilter(p: FilterProps, u: (px: number) => string): string {
  const parts: string[] = [];
  const preset = FILTER_PRESETS[String(p.filterPreset ?? 'original')] ?? '';
  if (preset) parts.push(preset);
  if (num(p.brightness)) parts.push(`brightness(${scale(num(p.brightness))})`);
  if (num(p.contrast)) parts.push(`contrast(${scale(num(p.contrast))})`);
  if (num(p.saturation)) parts.push(`saturate(${scale(num(p.saturation))})`);
  if (num(p.hue)) parts.push(`hue-rotate(${num(p.hue)}deg)`);
  if (num(p.blur) > 0) parts.push(`blur(${u(num(p.blur))})`);
  if (p.grayscale === true) parts.push('grayscale(1)');
  if (p.sepia === true) parts.push('sepia(1)');
  return parts.join(' ');
}

/** Darkened corners over the photo, or empty when the vignette is off. */
function vignetteOverlay(p: FilterProps): string {
  const v = num(p.vignette);
  if (!(v > 0)) return '';
  const alpha = Math.min(0.65, Math.max(0, (v / 100) * 0.6));
  return '<div style="position:absolute;inset:0;border-radius:inherit'
    + ';pointer-events:none;background:radial-gradient(ellipse at center,'
    + ` transparent 55%, rgba(0,0,0,${alpha}) 100%)"></div>`;
}

export function resolveSrc(src: string, assetsBase: string, mediaBase: string): string {
  if (src.startsWith('media/')) return joinUrl(mediaBase, src.slice('media/'.length));
  if (src.startsWith('designs/media/')) {
    return joinUrl(mediaBase, src.slice('designs/media/'.length));
  }
  if (/^(https?:|file:|data:|\/)/.test(src)) return src;
  return joinUrl(assetsBase, src);
}

function photoRadius(p: PhotoProps): number {
  return num(p.cornerRadius, p.mask === 'circle' ? 0 : 24);
}

/** Clip shapes for the star/blob/heart masks, in a 0..1 box. */
const CLIP_PATHS: Record<string, string> = {
  star: 'M0.5,0 L0.623,0.33 L0.976,0.345 L0.7,0.565 L0.794,0.905 L0.5,0.71 L0.206,0.905 L0.3,0.565 L0.024,0.345 L0.377,0.33 Z',
  heart: 'M0.5,0.88 C0.2,0.66 0.05,0.48 0.05,0.32 C0.05,0.16 0.17,0.06 0.3,0.06 C0.39,0.06 0.47,0.11 0.5,0.18 C0.53,0.11 0.61,0.06 0.7,0.06 C0.83,0.06 0.95,0.16 0.95,0.32 C0.95,0.48 0.8,0.66 0.5,0.88 Z',
  blob: 'M0.5,0.04 C0.68,0.04 0.78,0.12 0.86,0.24 C0.94,0.36 0.97,0.48 0.93,0.62 C0.89,0.76 0.78,0.86 0.64,0.92 C0.5,0.98 0.34,0.96 0.23,0.87 C0.12,0.78 0.06,0.64 0.07,0.5 C0.08,0.34 0.14,0.2 0.26,0.12 C0.34,0.07 0.4,0.04 0.5,0.04 Z',
};

/** Crisp silhouette outline: stacked drop-shadows follow the alpha (cut-outs
 * included) and scale with the box. Under a clip-path mask the outline is
 * clipped away, so combine it with rect/circle/arch only. */
function outlineShadows(
  props: StickerProps | PhotoProps,
  u: (px: number) => string,
): string {
  const w = num((props as PhotoProps).outlineWidth);
  if (!(w > 0)) return '';
  const color = resolveColor((props as PhotoProps).outlineColor, '');
  if (!color) return '';
  const d = u(w);
  const z = u(0);
  const o = (dx: string, dy: string): string => `drop-shadow(${dx} ${dy} 0 ${esc(color)})`;
  return [
    o(d, z), o(`-${d}`, z), o(z, d), o(z, `-${d}`),
    o(d, d), o(d, `-${d}`), o(`-${d}`, d), o(`-${d}`, `-${d}`),
  ].join(' ');
}

export function photoMarkup(
  item: DesignItem,
  u: (px: number) => string,
  assetsBase: string,
  mediaBase: string,
  w: number,
  h: number,
  base: string,
): string {
  const props = item.props ?? {};
    // Stickers and vectors share the look: tint, outline and drop shadow.
    const sticker = item.type === 'sticker' || item.type === 'vector';
    const raw =
      item.type === 'vector'
        ? vectorSrc((props as StickerProps).svg)
        : item.type === 'sticker'
        ? `stickers/${(props as StickerProps).sticker ?? ''}`
        : item.type === 'photo'
          ? ((props as PhotoProps).src ?? '')
          : ((props as ImageProps).src ?? '');
    // No source: placeholder, never a bare `/assets/` request that 404s
    // and logs a console error.
    const src = item.type === 'vector' ? raw : raw ? resolveSrc(raw, assetsBase, mediaBase) : '';
    const fit = item.type === 'vector' || (props as ImageProps).fit === 'contain' ? 'contain' : 'cover';
    if (!src) {
      // Empty photo placeholder: soft dashed box.
      return `<div class="bPhotoEmpty" style="${esc(base + ';border-radius:' + u(photoRadius(props as PhotoProps)))}"></div>`;
    }
    const photo = props as PhotoProps;
    let extra: string;
    let clipDefs = '';
    if (item.type === 'photo' && photo.mask === 'circle') {
      extra = `border-radius:50%`;
    } else if (item.type === 'photo' && photo.mask === 'arch') {
      // Arch: fully rounded top, slightly rounded foot.
      const top = u(Math.min(w, h) / 2);
      const foot = u(num(photo.cornerRadius, 24));
      extra = `border-radius:${top} ${top} ${foot} ${foot}`;
    } else if (item.type === 'photo' && (photo.mask === 'star' || photo.mask === 'blob' || photo.mask === 'heart')) {
      // Vector masks: a 0..1 clip path scales with the box.
      const clipId = `bClip-${String(item.id ?? '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
      clipDefs = `<svg width="0" height="0" style="position:absolute"><clipPath id="${clipId}" clipPathUnits="objectBoundingBox"><path d="${CLIP_PATHS[photo.mask]}"/></clipPath></svg>`;
      extra = `clip-path:url(#${clipId})`;
    } else {
      extra = `border-radius:${u(photoRadius(photo as PhotoProps))}`;
    }
    // Photos and plain images share the filter chain; stickers and groups
    // take the drop shadow instead (their panels offer no filters).
    // A tinted sticker is one colour: an SVG filter floods its opaque pixels
    // (a CSS mask would need CORS, which file:// export pages do not pass).
    const tint = sticker ? resolveColor((props as StickerProps).tint, '') : '';
    const tintId = `bTint-${String(item.id ?? '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const tintDefs = tint
      ? `<svg width="0" height="0" style="position:absolute"><filter id="${tintId}">`
        + `<feFlood flood-color="${esc(tint)}"/><feComposite in2="SourceAlpha" operator="in"/></filter></svg>`
      : '';
    // Torn edge: fixed-seed turbulence displaces the rim (deterministic).
    const edgeAmt = item.type === 'photo' ? num((props as PhotoProps).edge) : 0;
    const edgeId = `bEdge-${String(item.id ?? '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const edgeDefs = edgeAmt > 0
      ? `<svg width="0" height="0" style="position:absolute"><filter id="${edgeId}" x="-30%" y="-30%" width="160%" height="160%">`
        + `<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="7" result="n"/>`
        + `<feDisplacementMap in="SourceGraphic" in2="n" scale="${edgeAmt}" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`
      : '';
    const shade = sticker
      ? dropShadow(props as StickerProps, u)
      : photoFilter(props as FilterProps, u);
    const line = sticker || item.type === 'photo'
      ? outlineShadows(props as StickerProps & PhotoProps, u)
      : '';
    const fx = [tint ? `url(#${tintId})` : '', shade, line, edgeAmt > 0 ? `url(#${edgeId})` : ''].filter(Boolean).join(' ');
    const fxStyle = fx ? `;filter:${fx}` : '';
    const veil = sticker ? '' : vignetteOverlay(props as FilterProps);
    return `${tintDefs}${clipDefs}${edgeDefs}<div class="bPhoto" style="${esc(base + ';background-size:' + fit + ';' + extra + fxStyle)}`
      + `;background-image:url(&quot;${esc(src)}&quot;)">${veil}</div>`;
}
