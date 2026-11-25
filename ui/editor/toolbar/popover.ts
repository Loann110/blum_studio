// Editor toolbar popovers: tool buttons with detail panels.
import { refreshIcons } from '../icons.js';
import { toolGroup } from './controls.js';

export let openPop: string | null = null;
/** A tool button that opens a small panel under it. `build` fills the panel. */
export function popButton(
  root: HTMLElement,
  trigger: HTMLButtonElement,
  key: string,
  build: (panel: HTMLElement) => void,
  alignRight = false,
): void {
  const wrap = document.createElement('span');
  wrap.className = 'pop-wrap';
  trigger.setAttribute('aria-haspopup', 'dialog');
  wrap.append(trigger);
  toolGroup(root).append(wrap);
  const onOutside = (ev: Event): void => {
    if (!wrap.contains(ev.target as Node) && wrap.isConnected) close();
  };
  const close = (): void => {
    wrap.querySelector('.pop-panel')?.remove();
    trigger.setAttribute('aria-expanded', 'false');
    if (openPop === key) openPop = null;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onEscape, true);
  };
  // Escape closes the panel first; the next Escape clears the selection as usual.
  const onEscape = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape' || !wrap.isConnected) return;
    ev.stopPropagation();
    close();
  };
  const open = (): void => {
    const panel = document.createElement('div');
    panel.className = 'pop-panel' + (alignRight ? ' right' : '');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', trigger.title);
    build(panel);
    wrap.append(panel);
    clampPanel(panel);
    trigger.setAttribute('aria-expanded', 'true');
    openPop = key;
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onEscape, true);
    refreshIcons();
  };
  trigger.addEventListener('click', () => (wrap.querySelector('.pop-panel') ? close() : open()));
  if (openPop === key) open();
}

/** Keeps a fresh panel inside the window: right-aligns past the right
edge, and the tall More panel scrolls instead of sliding under short
windows. shortcut: clamps on open only, not on later resizes; re-clamp on
resize if popovers start escaping after a window shrink. */
function clampPanel(panel: HTMLElement): void {
  if (panel.getBoundingClientRect().right > window.innerWidth - 8) {
    panel.classList.add('right');
  }
  // Shrink the content box by the measured overflow: max-height covers
  // the content box only, so shrinking the total height never converges.
  for (let i = 0; i < 4; i++) {
    const over = panel.getBoundingClientRect().bottom - window.innerHeight + 8;
    if (over <= 0) break;
    const cur = panel.style.maxHeight
      ? parseFloat(panel.style.maxHeight)
      : panel.scrollHeight;
    panel.style.maxHeight = `${Math.max(120, cur - over)}px`;
    panel.style.overflowY = 'auto';
  }
}

export function panelLabel(panel: HTMLElement, text: string): void {
  const label = document.createElement('div');
  label.className = 'pop-label';
  label.textContent = text;
  panel.append(label);
}