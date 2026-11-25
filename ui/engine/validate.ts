// Engine validation: item checks and the whole-document check.
import { CUSTOM, CUSTOM_MAX, CUSTOM_MIN, FORMATS, findFormat, validCustom } from './formats.js';
import type {
  Design,
  FilterProps,
  GroupProps,
  ImageProps,
  Item,
  Paint,
  PhotoProps,
  ShapeProps,
  StickerProps,
  TextProps,
  VectorProps,
} from './model.js';
import { parseVector } from './vector.js';
import { EngineError } from './errors.js';
import {
  FILTER_PRESETS,
  isBlendMode,
  isColor,
  isLineCap,
  isMask,
  isPatternName,
  isShapeName,
  validFieldKey,
} from './names.js';

/* ---- item checks ---- */

function checkShadow(
  color: string,
  blur: number,
  where: string,
  out: string[],
): void {
  if (color !== '' && !isColor(color)) {
    out.push(`${where}: bad shadow color '${color}'`);
  }
  if (blur < 0 || blur > 200) {
    out.push(`${where}: shadow blur must be within 0..200`);
  }
}

// Silhouette outline: empty color or zero width = off.
function checkOutline(
  color: string,
  width: number,
  where: string,
  out: string[],
): void {
  if (color !== '' && !isColor(color)) {
    out.push(`${where}: bad outline color '${color}'`);
  }
  if (!Number.isFinite(width) || width < 0 || width > 100) {
    out.push(`${where}: outline width must be within 0..100`);
  }
}

function checkFilter(f: FilterProps, where: string, out: string[]): void {
  if (!FILTER_PRESETS.has(f.preset)) {
    out.push(
      `${where}: filter preset must be original|vivid|warm|cold|mono|noir|faded|vintage|dramatic`,
    );
  }
  if (
    f.brightness < -100 || f.brightness > 100 ||
    f.contrast < -100 || f.contrast > 100 ||
    f.saturation < -100 || f.saturation > 100
  ) {
    out.push(
      `${where}: brightness/contrast/saturation must be within -100..100`,
    );
  }
  if (f.hue < -180 || f.hue > 180) {
    out.push(`${where}: hue must be within -180..180`);
  }
  if (f.blur < 0 || f.blur > 100) {
    out.push(`${where}: blur must be within 0..100`);
  }
  if (f.vignette < 0 || f.vignette > 100) {
    out.push(`${where}: vignette must be within 0..100`);
  }
}

function checkPaint(p: Paint, where: string, out: string[]): void {
  if (p.gradient) {
    if (p.gradient.stops.length < 2) {
      out.push(`${where}: gradient needs at least 2 stops`);
    }
    for (const s of p.gradient.stops) {
      if (s.at < 0 || s.at > 1) {
        out.push(`${where}: gradient stop out of 0..1`);
      }
      if (!isColor(s.color)) {
        out.push(`${where}: bad gradient color '${s.color}'`);
      }
    }
    if (!Number.isFinite(p.gradient.angle)) {
      out.push(`${where}: bad gradient angle`);
    }
  } else if (!isColor(p.color)) {
    out.push(`${where}: bad color '${p.color}'`);
  }
}

export function checkItem(it: Item, where: string, out: string[]): void {
  if (it.id === '') out.push(`${where}: item id is empty`);
  if (
    !Number.isFinite(it.x) || !Number.isFinite(it.y) ||
    !Number.isFinite(it.angle) || !Number.isFinite(it.opacity)
  ) {
    out.push(`${where}: '${it.id}' has a non-numeric field`);
  }
  if (!(it.width > 0) || !(it.height > 0) || it.width > 10000 || it.height > 10000) {
    out.push(`${where}: '${it.id}' needs 0 < w,h <= 10000`);
  }
  if (it.opacity < 0 || it.opacity > 1) {
    out.push(`${where}: '${it.id}' opacity must be 0..1`);
  }
  if (it.blend !== '' && !isBlendMode(it.blend)) {
    out.push(`${where}: '${it.id}' bad blend mode '${it.blend}'`);
  }
  if (it.type === 'text') {
    const t = it.props as TextProps;
    if (t.font === '') out.push(`${where}: '${it.id}' font is empty`);
    if (!(t.size > 0) || t.size > 1000) {
      out.push(`${where}: '${it.id}' font size must be 0..1000`);
    }
    if (!isColor(t.color)) out.push(`${where}: '${it.id}' bad text color`);
    if (t.background !== '' && !isColor(t.background)) {
      out.push(`${where}: '${it.id}' bad highlight color`);
    }
    if (t.align !== 'left' && t.align !== 'center' && t.align !== 'right' && t.align !== 'justify') {
      out.push(`${where}: '${it.id}' bad align`);
    }
    if (t.decoration !== 'none' && t.decoration !== 'underline') {
      out.push(`${where}: '${it.id}' decoration must be none|underline`);
    }
    if (t.list !== 'none' && t.list !== 'bullet' && t.list !== 'numbered') {
      out.push(`${where}: '${it.id}' list must be none|bullet|numbered`);
    }
    if (t.curve !== 'none' && t.curve !== 'up' && t.curve !== 'down') {
      out.push(`${where}: '${it.id}' curve must be none|up|down`);
    }
    if (t.curveAmount < 0 || t.curveAmount > 400) {
      out.push(`${where}: '${it.id}' curve amount must be within 0..400`);
    }
    if (!(t.minSize > 0) || t.minSize > 1000) {
      out.push(`${where}: '${it.id}' minimum size must be 0..1000`);
    }
    if (t.shadowColor !== '' && !isColor(t.shadowColor)) {
      out.push(`${where}: '${it.id}' bad shadow color`);
    }
    if (t.shadowBlur < 0 || t.shadowBlur > 200) {
      out.push(`${where}: '${it.id}' shadow blur must be within 0..200`);
    }
    if (t.stroke !== '' && !isColor(t.stroke)) {
      out.push(`${where}: '${it.id}' bad stroke color`);
    }
    if (t.strokeWidth < 0 || t.strokeWidth > 60) {
      out.push(`${where}: '${it.id}' stroke width must be within 0..60`);
    }
    if (t.gradient) {
      if (t.gradient.stops.length < 2) {
        out.push(`${where}: '${it.id}' gradient needs at least 2 stops`);
      }
      for (const s of t.gradient.stops) {
        if (s.at < 0 || s.at > 1) {
          out.push(`${where}: '${it.id}' gradient stop out of 0..1`);
        }
        if (!isColor(s.color)) {
          out.push(`${where}: '${it.id}' bad gradient color '${s.color}'`);
        }
      }
      if (!Number.isFinite(t.gradient.angle)) {
        out.push(`${where}: '${it.id}' bad gradient angle`);
      }
    }
    if (!Number.isFinite(t.edge) || t.edge < 0 || t.edge > 100) {
      out.push(`${where}: '${it.id}' edge must be within 0..100`);
    }
    if (!validFieldKey(t.field)) {
      out.push(`${where}: '${it.id}' bad visitor field key '${t.field}'`);
    }
  } else if (it.type === 'shape') {
    const s = it.props as ShapeProps;
    if (!isShapeName(s.shape)) {
      out.push(`${where}: '${it.id}' bad shape '${s.shape}'`);
    }
    checkPaint(s.fill, `${where} '${it.id}' fill`, out);
    if (s.stroke !== '' && !isColor(s.stroke)) {
      out.push(`${where}: '${it.id}' bad stroke color`);
    }
    if (!Number.isFinite(s.strokeWidth) || s.strokeWidth < 0 || s.strokeWidth > 500) {
      out.push(`${where}: '${it.id}' stroke width must be 0..500`);
    }
    if (!Number.isFinite(s.bend) || s.bend < -1 || s.bend > 1) {
      out.push(`${where}: '${it.id}' bend must be within -1..1`);
    }
    if (!Number.isFinite(s.headSize) || s.headSize < 0 || s.headSize > 500) {
      out.push(`${where}: '${it.id}' head size must be 0..500`);
    }
    if (!Number.isFinite(s.edge) || s.edge < 0 || s.edge > 100) {
      out.push(`${where}: '${it.id}' edge must be within 0..100`);
    }
    if (s.lineStyle !== 'solid' && s.lineStyle !== 'dashed' && s.lineStyle !== 'dotted') {
      out.push(`${where}: '${it.id}' line style must be solid|dashed|dotted`);
    }
    if (
      (s.startCap !== '' && !isLineCap(s.startCap)) ||
      (s.endCap !== '' && !isLineCap(s.endCap))
    ) {
      out.push(`${where}: '${it.id}' line ends must be none|arrow|triangle|circle|square|bar`);
    }
    if (s.points < 3 || s.points > 12) {
      out.push(`${where}: '${it.id}' points must be within 3..12`);
    }
    if (!Number.isFinite(s.innerRatio) || s.innerRatio < 0.1 || s.innerRatio > 0.95) {
      out.push(`${where}: '${it.id}' inner ratio must be within 0.1..0.95`);
    }
    if (s.sides < 3 || s.sides > 12) {
      out.push(`${where}: '${it.id}' sides must be within 3..12`);
    }
    checkShadow(s.shadowColor, s.shadowBlur, `${where} '${it.id}'`, out);
  } else if (it.type === 'image') {
    const im = it.props as ImageProps;
    if (im.src === '') out.push(`${where}: '${it.id}' image src is empty`);
    checkFilter(im.filter, `${where} '${it.id}'`, out);
  } else if (it.type === 'sticker') {
    const st = it.props as StickerProps;
    if (st.sticker === '') out.push(`${where}: '${it.id}' sticker id is empty`);
    if (st.tint !== '' && !isColor(st.tint)) {
      out.push(`${where}: '${it.id}' bad tint`);
    }
    checkOutline(st.outlineColor, st.outlineWidth, `${where} '${it.id}'`, out);
    checkShadow(st.shadowColor, st.shadowBlur, `${where} '${it.id}'`, out);
  } else if (it.type === 'vector') {
    const v = it.props as VectorProps;
    try {
      parseVector(v.svg);
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      out.push(`${where}: '${it.id}' ${e.message}`);
    }
    if (v.tint !== '' && !isColor(v.tint)) out.push(`${where}: '${it.id}' bad tint`);
    checkOutline(v.outlineColor, v.outlineWidth, `${where} '${it.id}'`, out);
    checkShadow(v.shadowColor, v.shadowBlur, `${where} '${it.id}'`, out);
  } else if (it.type === 'photo') {
    const ph = it.props as PhotoProps;
    if (!isMask(ph.mask)) {
      out.push(`${where}: '${it.id}' mask is rect|circle|arch|star|blob|heart`);
    }
    if (!validFieldKey(ph.field)) {
      out.push(`${where}: '${it.id}' bad visitor field key '${ph.field}'`);
    }
    checkFilter(ph.filter, `${where} '${it.id}'`, out);
    checkOutline(ph.outlineColor, ph.outlineWidth, `${where} '${it.id}'`, out);
    if (!Number.isFinite(ph.edge) || ph.edge < 0 || ph.edge > 100) {
      out.push(`${where}: '${it.id}' edge must be within 0..100`);
    }
  } else if (it.type === 'group') {
    const g = it.props as GroupProps;
    checkShadow(g.shadowColor, g.shadowBlur, `${where} '${it.id}'`, out);
    if (it.children.length < 2) {
      out.push(`${where}: group '${it.id}' needs at least 2 children`);
    }
    for (const c of it.children) {
      checkItem(c, `${where} '${it.id}'/`, out);
    }
  }
}

function collectIds(items: Item[], counts: Map<string, number>): void {
  for (const it of items) {
    counts.set(it.id, (counts.get(it.id) ?? 0) + 1);
    if (it.type === 'group') collectIds(it.children, counts);
  }
}

/* ---- document check ---- */

export function validateModel(doc: Design): string[] {
  const out: string[] = [];
  if (doc.version !== 1) out.push('version must be 1');
  if (doc.format === CUSTOM) {
    if (!validCustom(doc.width, doc.height)) {
      out.push(`custom format needs width and height between ${CUSTOM_MIN} and ${CUSTOM_MAX} px`);
    }
  } else if (!findFormat(doc.format)) {
    out.push(`format must be one of ${FORMATS.map((f) => f.id).join('|')}|custom`);
  }
  if (doc.name === '') out.push('name is empty');
  const bg = doc.background;
  if (
    bg.kind !== 'color' && bg.kind !== 'gradient' &&
    bg.kind !== 'pattern' && bg.kind !== 'image'
  ) {
    out.push('background kind must be color|gradient|pattern|image');
  } else if (bg.kind === 'color') {
    if (!isColor(bg.color)) out.push('bad background color');
  } else if (bg.kind === 'gradient') {
    if (bg.stops.length < 2) {
      out.push('background gradient needs at least 2 stops');
    }
    for (const s of bg.stops) {
      if (!isColor(s.color)) out.push('bad background gradient color');
      if (s.at < 0 || s.at > 1) {
        out.push('background gradient stop out of 0..1');
      }
    }
  } else if (bg.kind === 'pattern') {
    if (!isPatternName(bg.pattern)) {
      out.push(
        'background pattern must be dots|grid|stripes|checker|waves|crosses|zigzag|' +
        'triangles|hexagons|diamonds|scallops|bricks|hearts|stars|zellige|scales|arches',
      );
    }
    if (!isColor(bg.patternColor)) {
      out.push('bad background pattern color');
    }
    if (bg.patternBackground !== '' && !isColor(bg.patternBackground)) {
      out.push('bad background pattern background color');
    }
    if (
      !Number.isFinite(bg.patternScale) ||
      bg.patternScale < 0.25 || bg.patternScale > 4
    ) {
      out.push('background pattern scale must be within 0.25..4');
    }
    if (
      !Number.isFinite(bg.patternAngle) ||
      bg.patternAngle < 0 || bg.patternAngle > 360
    ) {
      out.push('background pattern angle must be within 0..360');
    }
    if (
      !Number.isFinite(bg.patternWeight) ||
      bg.patternWeight < 0.25 || bg.patternWeight > 4
    ) {
      out.push('background pattern weight must be within 0.25..4');
    }
  } else if (bg.kind === 'image') {
    if (bg.image === '') out.push('background image needs a source');
  }
  if (!Number.isFinite(bg.grain) || bg.grain < 0 || bg.grain > 100) {
    out.push('background grain must be within 0..100');
  }
  const counts = new Map<string, number>();
  collectIds(doc.items, counts);
  for (const id of [...counts.keys()].sort()) {
    if (id === '') out.push('an item id is empty');
    if ((counts.get(id) ?? 0) > 1) out.push(`duplicate item id '${id}'`);
  }
  for (const it of doc.items) checkItem(it, 'item', out);
  return out;
}
