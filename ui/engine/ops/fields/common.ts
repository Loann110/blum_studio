// Engine field helpers shared by several item kinds: every item's own
// fields, plus shadow and filter values reused across kinds.
import type { FilterProps, Item } from '../../model.js';
import { isBlendMode, isColor } from '../../names.js';
import { fail } from '../../errors.js';

/** Value-kind guards for one field update, sharing the failure wording. */
export function needFor(key: string, which: number): {
  need(w: number, what: string): void;
  needNum(): void;
} {
  return {
    need(w, what) {
      if (w !== which) fail(`field '${key}' needs ${what}`);
    },
    needNum() {
      if (which !== 1 && which !== 3) fail(`field '${key}' needs a number`);
    },
  };
}

/** The nine filter keys, handled the same way for images and photos. */
export function applyFilterField(
  key: string,
  s: string,
  v: number,
  which: number,
  b: boolean,
  f: FilterProps,
): boolean {
  if (
    key !== 'filterPreset' && key !== 'brightness' && key !== 'contrast' &&
    key !== 'saturation' && key !== 'hue' && key !== 'blur' &&
    key !== 'vignette' && key !== 'grayscale' && key !== 'sepia'
  ) {
    return false;
  }
  applyFilter(key, s, v, which, b, f);
  return true;
}

export function applyCommonField(
  it: Item,
  key: string,
  s: string,
  n: number,
  b: boolean,
  i: number,
  which: number,
): boolean {
  const { need, needNum } = needFor(key, which);
  const v = which === 3 ? i : n;
  if (key === 'name') {
    need(0, 'text');
    it.name = s;
    return true;
  }
  if (
    key === 'x' || key === 'y' || key === 'width' || key === 'height' ||
    key === 'angle' || key === 'opacity'
  ) {
    needNum();
    if (!Number.isFinite(v)) fail(`field '${key}' must be numeric`);
    if ((key === 'width' || key === 'height') && !(v > 0 && v <= 10000)) {
      fail(`field '${key}' must be within 0..10000`);
    }
    if (key === 'opacity' && (v < 0 || v > 1)) {
      fail('opacity must be within 0..1');
    }
    if (key === 'x') it.x = v;
    else if (key === 'y') it.y = v;
    else if (key === 'width') it.width = v;
    else if (key === 'height') it.height = v;
    else if (key === 'angle') it.angle = v;
    else it.opacity = v;
    return true;
  }
  if (key === 'locked' || key === 'visible') {
    need(2, 'true/false');
    if (key === 'locked') it.locked = b;
    else it.visible = b;
    return true;
  }
  if (key === 'blend') {
    need(0, 'text');
    if (s !== '' && !isBlendMode(s)) {
      fail('blend must be normal|multiply|screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion|hue|saturation|color|luminosity');
    }
    it.blend = s;
    return true;
  }
  return false;
}

/** Props that carry a drop shadow, named as stored (no adapters). */
export interface ShadowProps {
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
}

export function applyShadow(
  key: string,
  s: string,
  v: number,
  which: number,
  target: ShadowProps,
): void {
  if (key === 'shadowColor') {
    if (which !== 0) fail("field 'shadowColor' needs text");
    if (s !== '' && !isColor(s)) fail(`bad color '${s}'`);
    target.shadowColor = s;
    return;
  }
  if (key === 'shadowX' || key === 'shadowY' || key === 'shadowBlur') {
    if (which !== 1 && which !== 3) fail(`field '${key}' needs a number`);
    if (key === 'shadowBlur') {
      if (v < 0 || v > 200) fail('shadowBlur must be within 0..200');
      target.shadowBlur = v;
    } else {
      if (v < -500 || v > 500) {
        fail(`field '${key}' must be within -500..500`);
      }
      if (key === 'shadowX') target.shadowX = v;
      else target.shadowY = v;
    }
    return;
  }
  fail(`unknown field '${key}' for this item type`);
}

export function applyFilter(
  key: string,
  s: string,
  v: number,
  which: number,
  b: boolean,
  f: FilterProps,
): void {
  if (key === 'filterPreset') {
    if (which !== 0) fail("field 'filterPreset' needs text");
    if (
      s !== 'original' && s !== 'vivid' && s !== 'warm' && s !== 'cold' &&
      s !== 'mono' && s !== 'noir' && s !== 'faded' && s !== 'vintage' &&
      s !== 'dramatic'
    ) {
      fail(
        'filterPreset must be original|vivid|warm|cold|mono|noir|faded|vintage|dramatic',
      );
    }
    f.preset = s;
    return;
  }
  if (key === 'brightness' || key === 'contrast' || key === 'saturation') {
    if (which !== 1 && which !== 3) fail(`field '${key}' needs a number`);
    if (v < -100 || v > 100) fail(`field '${key}' must be within -100..100`);
    if (key === 'brightness') f.brightness = v;
    else if (key === 'contrast') f.contrast = v;
    else f.saturation = v;
    return;
  }
  if (key === 'hue' || key === 'blur' || key === 'vignette') {
    if (which !== 1 && which !== 3) fail(`field '${key}' needs a number`);
    const lo = key === 'hue' ? -180 : 0;
    const hi = key === 'hue' ? 180 : 100;
    if (v < lo || v > hi) fail(`field '${key}' must be within ${lo}..${hi}`);
    if (key === 'hue') f.hue = v;
    else if (key === 'blur') f.blur = v;
    else f.vignette = v;
    return;
  }
  if (key === 'grayscale' || key === 'sepia') {
    if (which !== 2) fail(`field '${key}' needs true/false`);
    if (key === 'grayscale') f.grayscale = b;
    else f.sepia = b;
    return;
  }
  fail(`unknown field '${key}' for this item type`);
}
