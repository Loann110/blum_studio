// SVG workshop: the strict allowlist an agent-drawn vector must pass, and the
// clean copy the renderer shows. Only shapes, paint and transforms get
// through: no script, link, image, text, style, url() or entity can reach a page.
import { fail } from './errors.js';
import { isColor } from './names.js';

export const VECTOR_MAX_BYTES = 8192;
const MAX_ELEMENTS = 400;
const MAX_DEPTH = 8;
const SVG_NS = 'http://www.w3.org/2000/svg';

const TAGS = new Set(['svg', 'g', 'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon']);
const PAINT_ATTRS = new Set(['fill', 'stroke']);
const ATTRS = new Set([
  'viewBox', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height',
  'points', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'clip-rule',
  'opacity', 'fill-opacity', 'stroke-opacity',
]);
// Numbers, path commands, keywords, colours and transform calls; never quotes,
// angle brackets, ampersands, colons, semicolons or slashes.
const VALUE_RE = /^[#\w\s.,%()+-]*$/;
const OPEN_RE = /<([a-zA-Z]+)((?:\s+[a-zA-Z:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/y;
const CLOSE_RE = /<\/([a-zA-Z]+)\s*>/y;
const ATTR_RE = /([a-zA-Z:-]+)\s*=\s*"([^"]*)"/g;

export interface VectorNode {
  tag: string;
  attrs: Array<[string, string]>;
  children: VectorNode[];
}

function checkAttr(tag: string, name: string, value: string): void {
  if (name === 'xmlns') {
    if (tag !== 'svg' || value !== SVG_NS) fail(`svg: xmlns must be ${SVG_NS}`);
    return;
  }
  if (!ATTRS.has(name)) fail(`svg: attribute '${name}' is not allowed (shapes, paint and transform only)`);
  if (!VALUE_RE.test(value) || /url\s*\(|expression\s*\(/i.test(value)) {
    fail(`svg: value of '${name}' is not allowed: '${value.slice(0, 40)}'`);
  }
  if (PAINT_ATTRS.has(name) && value !== 'none' && !isColor(value)) {
    fail(`svg: ${name} must be none, #rrggbb or rgba(...), not '${value}'`);
  }
}

function viewBoxOf(node: VectorNode): number[] {
  const raw = node.attrs.find(([name]) => name === 'viewBox')?.[1] ?? '';
  const box = raw.trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || box[2] <= 0 || box[3] <= 0) {
    fail("svg: the root <svg> needs a viewBox like '0 0 24 24'");
  }
  return box;
}

/** Parses an agent's SVG into a tree, or fails with what to fix. */
export function parseVector(svg: string): VectorNode {
  if (typeof svg !== 'string' || svg.trim() === '') fail('svg: empty');
  if (new TextEncoder().encode(svg).length > VECTOR_MAX_BYTES) {
    fail(`svg: larger than ${VECTOR_MAX_BYTES} bytes; draw a simpler shape`);
  }
  const root: VectorNode = { tag: '#root', attrs: [], children: [] };
  const stack = [root];
  let count = 0;
  let at = 0;
  while (at < svg.length) {
    const space = /\s*/y;
    space.lastIndex = at;
    space.exec(svg);
    at = space.lastIndex;
    if (at >= svg.length) break;
    CLOSE_RE.lastIndex = at;
    const close = CLOSE_RE.exec(svg);
    if (close) {
      const open = stack.pop();
      if (!open || open.tag !== close[1]) fail(`svg: </${close[1]}> does not close an open tag`);
      at = CLOSE_RE.lastIndex;
      continue;
    }
    OPEN_RE.lastIndex = at;
    const tagMatch = OPEN_RE.exec(svg);
    if (!tagMatch) fail('svg: only shape elements are allowed (no text, comments, CDATA or entities)');
    const tag = tagMatch[1];
    if (!TAGS.has(tag)) fail(`svg: <${tag}> is not allowed (svg, g, path, circle, rect, ellipse, line, polyline, polygon)`);
    const parent = stack[stack.length - 1];
    if ((tag === 'svg') !== (parent === root)) fail('svg: one root <svg> holding every shape');
    if (parent === root && root.children.length > 0) fail('svg: one root <svg> only');
    if (++count > MAX_ELEMENTS) fail(`svg: more than ${MAX_ELEMENTS} elements; draw a simpler shape`);
    if (stack.length > MAX_DEPTH) fail(`svg: nested deeper than ${MAX_DEPTH} levels`);
    const node: VectorNode = { tag, attrs: [], children: [] };
    for (const [, name, value] of tagMatch[2].matchAll(ATTR_RE)) {
      checkAttr(tag, name, value);
      if (name !== 'xmlns') node.attrs.push([name, value]);
    }
    parent.children.push(node);
    if (tagMatch[3] !== '/') stack.push(node);
    at = OPEN_RE.lastIndex;
  }
  if (stack.length !== 1) fail(`svg: <${stack[stack.length - 1].tag}> is never closed`);
  const svgNode = root.children[0];
  if (!svgNode) fail('svg: needs a root <svg viewBox="...">');
  viewBoxOf(svgNode);
  return svgNode;
}

/** A clean standalone SVG from the checked tree. */
export function serializeVector(node: VectorNode): string {
  const attrs = node.attrs
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');
  const ns = node.tag === 'svg' ? ` xmlns="${SVG_NS}"` : '';
  const inner = node.children.map((child) => serializeVector(child)).join('');
  return `<${node.tag}${ns}${attrs}>${inner}</${node.tag}>`;
}
