// Gallery delete: a two-step delete button on each card (sample designs excluded).
import type { Row } from './state.js';

const CONFIRM_MS = 4000;

/** Called after a design is gone so the list can redraw. */
type AfterDelete = (id: string) => void;

/**
 * A trash button: the first press asks ("Delete?"), the second deletes for
 * good. It falls back to idle after a few seconds, on blur or on Escape.
 * Samples (`template` rows) are read-only and get no button.
 */
export function deleteButton(row: Row, after: AfterDelete): HTMLButtonElement | null {
  if (row.template) return null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'card-delete';
  let timer = 0;

  const idle = (): void => {
    window.clearTimeout(timer);
    btn.classList.remove('confirm');
    btn.innerHTML = TRASH_ICON;
    btn.setAttribute('aria-label', `Delete ${row.name}`);
    btn.title = 'Delete';
  };
  const ask = (): void => {
    btn.classList.add('confirm');
    btn.textContent = 'Delete?';
    btn.setAttribute('aria-label', `Press again to delete ${row.name} for good`);
    btn.title = 'Press again to delete for good';
    timer = window.setTimeout(idle, CONFIRM_MS);
  };

  btn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (!btn.classList.contains('confirm')) {
      ask();
      return;
    }
    window.clearTimeout(timer);
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    try {
      const res = await fetch(`/api/designs/${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
        headers: { 'X-Blum-Request': '1' },
      });
      if (!res.ok && res.status !== 404) throw new Error(`server answered ${res.status}`);
      after(row.id);
    } catch (err) {
      btn.disabled = false;
      idle();
      announce(`Could not delete ${row.name}: ${(err as Error).message}`);
    }
  });
  btn.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') idle();
  });
  btn.addEventListener('blur', () => {
    if (!btn.disabled) idle();
  });
  idle();
  return btn;
}

function announce(text: string): void {
  const status = document.getElementById('status');
  if (status) status.textContent = text;
}

const TRASH_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
