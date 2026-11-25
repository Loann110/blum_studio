// Editor inline text edit: type directly on the canvas.
import { hooks } from './hooks.js';
import { findItem } from '../state.js';
import { boxOf } from '../geometry/boxes.js';
import { canvasScale } from '../canvas/stage.js';
import { resolveColor } from '../../render/render.js';

export function startTextEdit(id: string): void {
  if (!hooks) return;
  const st = hooks.state;
  const overlay = document.querySelector('.overlay');
  if (!overlay) return;
  const it = findItem(st.design, id);
  if (!it || it.type !== 'text') return;
  const props = (it.props ?? {}) as Record<string, string | number>;
  const b = boxOf(it);
  const scale = canvasScale();
  const area = document.createElement('textarea');
  area.className = 'inline-edit';
  area.value = String(props.text ?? '');
  area.style.position = 'absolute';
  // Sit exactly on the rendered text when it is not rotated; else fall back to the item box.
  const rendered = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
  const angle = Number(it.angle ?? 0);
  if (rendered && angle === 0) {
    const r = rendered.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    area.style.left = `${r.left - o.left}px`;
    area.style.top = `${r.top - o.top}px`;
    area.style.width = `${r.width}px`;
    area.style.height = `${Math.max(r.height, Number(props.size ?? 32) * scale * 1.3)}px`;
  } else {
    area.style.left = `${(b.x - b.w / 2) * scale}px`;
    area.style.top = `${(b.y - b.h / 2) * scale}px`;
    area.style.width = `${b.w * scale}px`;
    area.style.height = `${Math.max(40, b.h * scale)}px`;
  }
  // Same face, size, colour and alignment as the rendered text: the user types "in" the design.
  const full = props as Record<string, unknown>;
  area.style.fontFamily = `'${String(props.font ?? 'Inter')}', sans-serif`;
  area.style.fontSize = `${Number(props.size ?? 32) * scale}px`;
  area.style.fontWeight = String(props.weight ?? 400);
  area.style.fontStyle = props.italic ? 'italic' : 'normal';
  area.style.lineHeight = String(props.lineHeight ?? 1.2);
  area.style.letterSpacing = `${Number(props.letterSpacing ?? 0) * scale}px`;
  area.style.textAlign = String(props.align ?? 'left');
  const ink = resolveColor(String(props.color ?? '#111111'), '#111111');
  area.style.color = full.hollow === true ? 'transparent' : ink;
  area.style.textTransform = props.textCase === 'upper' ? 'uppercase'
    : props.textCase === 'lower' ? 'lowercase' : props.textCase === 'title' ? 'capitalize' : 'none';
  // Same decorations and effects as the rendered text, in screen px (the
  // renderer draws them in cqw, which is design px at the same scale).
  const deco: string[] = [];
  if (props.decoration === 'underline') deco.push('underline');
  if (full.strikethrough === true) deco.push('line-through');
  if (deco.length > 0) area.style.textDecoration = deco.join(' ');
  if (typeof full.background === 'string' && full.background) {
    area.style.background = resolveColor(full.background, 'transparent');
  }
  const layers: string[] = [];
  if (typeof full.haloColor === 'string' && full.haloColor) {
    const hn = Number(full.haloBlur);
    layers.push(`0px 0px ${(Number.isFinite(hn) ? hn : 14) * scale}px`
      + ` ${resolveColor(full.haloColor, ink)}`);
  }
  if (typeof full.shadowColor === 'string' && full.shadowColor) {
    const sh = (v: unknown, dflt: number): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : dflt;
    };
    layers.push(`${sh(full.shadowX, 0) * scale}px ${sh(full.shadowY, 3) * scale}px`
      + ` ${sh(full.shadowBlur, 8) * scale}px ${resolveColor(full.shadowColor, 'rgba(0,0,0,0.35)')}`);
  }
  if (layers.length > 0) area.style.textShadow = layers.join(',');
  if (full.hollow === true && !(typeof full.stroke === 'string' && full.stroke && Number(full.strokeWidth) > 0)) {
    area.style.setProperty('-webkit-text-stroke', `${2 * scale}px ${ink}`);
  } else if (typeof full.stroke === 'string' && full.stroke && Number(full.strokeWidth) > 0) {
    area.style.setProperty('-webkit-text-stroke',
      `${Number(full.strokeWidth) * scale}px ${resolveColor(full.stroke, '#ffffff')}`);
  }
  // Lists: the rendered markers sit in a 1.2em gutter; a non-editable gutter
  // over the same zone keeps the text start (and unwrapped markers) aligned.
  const listKind = full.list === 'bullet' || full.list === 'numbered' ? full.list : null;
  let gutter: HTMLDivElement | null = null;
  if (listKind) {
    area.style.paddingLeft = '1.2em';
    gutter = document.createElement('div');
    gutter.className = 'list-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    gutter.style.position = 'absolute';
    gutter.style.left = area.style.left;
    gutter.style.top = area.style.top;
    gutter.style.width = '1.2em';
    gutter.style.height = area.style.height;
    gutter.style.overflow = 'hidden';
    gutter.style.pointerEvents = 'none';
    gutter.style.fontFamily = area.style.fontFamily;
    gutter.style.fontSize = area.style.fontSize;
    gutter.style.fontWeight = area.style.fontWeight;
    gutter.style.fontStyle = area.style.fontStyle;
    gutter.style.lineHeight = area.style.lineHeight;
    gutter.style.letterSpacing = area.style.letterSpacing;
    gutter.style.color = area.style.color;
    gutter.style.textAlign = 'center';
    gutter.style.zIndex = '19';
    const paint = (): void => {
      if (!gutter) return;
      gutter.innerHTML = '';
      const lines = area.value.split('\n');
      lines.forEach((line, i) => {
        const mark = document.createElement('div');
        mark.textContent = listKind === 'bullet' ? '•' : `${i + 1}.`;
        if (line === '' && i === lines.length - 1 && lines.length > 1) mark.style.opacity = '0';
        gutter?.append(mark);
      });
    };
    paint();
    area.addEventListener('input', paint);
  }
  // Shrink to fit: while typing, the box stays fixed and the size shrinks down
  // to the minimum. The commit then stores the fitted size (textfit).
  const shrinkOn = full.shrinkToFit === true;
  const shrinkMin = Math.min(Number(props.size ?? 32), Math.max(1, Number(full.minSize ?? 12)));
  let liveSize = Number(props.size ?? 32);
  const fitLive = (): void => {
    if (!shrinkOn) return;
    let guard = 200;
    while (area.scrollHeight > area.clientHeight + 1 && liveSize > shrinkMin && guard-- > 0) {
      liveSize = Math.max(shrinkMin, liveSize - 1);
      area.style.fontSize = `${liveSize * scale}px`;
      if (gutter) gutter.style.fontSize = area.style.fontSize;
    }
  };
  area.addEventListener('input', fitLive);
  area.style.transform = `rotate(${angle}deg)`;
  area.style.zIndex = '20';
  // The rendered text would show through the transparent textarea: hide it while typing.
  // A style rule (not an inline style) survives the canvas re-rendering during the edit.
  const hide = document.createElement('style');
  hide.textContent = `[data-id="${CSS.escape(id)}"]{visibility:hidden}`;
  document.head.append(hide);
  overlay.append(area);
  if (gutter) overlay.append(gutter);
  area.focus();
  area.select();
  let done = false;
  const finish = (save: boolean): void => {
    if (done) return;
    done = true;
    document.removeEventListener('pointerdown', outside, true);
    const value = area.value;
    area.remove();
    gutter?.remove();
    hide.remove();
    // Defer the commit past the click that ends the edit: committing here
    // re-renders the panel at once, detaching the button under the pointer
    // so its click never fires (the user's click is silently eaten). The
    // edit chrome is already gone, so gestures and clicks proceed cleanly.
    window.setTimeout(() => {
      const live = hooks?.state;
      if (save && live && findItem(live.design, id)) hooks?.commitText(id, value);
      else hooks?.renderAll();
    }, 0);
  };
  // Clicking elsewhere ends the edit and commits: canvas pointerdowns
  // (marquee, move, resize) preventDefault, so the textarea would never
  // blur and the edit would stay orphaned behind the new selection.
  const outside = (ev: PointerEvent): void => {
    if (ev.target instanceof Node && !area.contains(ev.target)) finish(true);
  };
  document.addEventListener('pointerdown', outside, true);
  area.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      finish(true);
    }
    if (ev.key === 'Escape') finish(false);
  });
  area.addEventListener('blur', () => finish(true));
  area.addEventListener('pointerdown', (ev) => ev.stopPropagation());
}