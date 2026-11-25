// Gallery home: theme, toolbar and boot (creation lives in create-design.ts).
// Gallery: the home of the app. One cheap list request, then each card
// renders its own thumbnail with the shared renderer, lazily and cached
// by (id, updated), so 80+ designs stay fast. Polling updates cards in
// place and never steals focus.

import { status } from './state.js';
import { renderRecents } from './recents.js';
import { createDesign } from './create-design.js';
import { load } from './list.js';
import { CUSTOM_MAX, CUSTOM_MIN, FORMATS } from '../../engine/index.js';

export function initTheme(): void {
  // Light only (the user's choice): clear any dark mode a browser kept from before.
  document.documentElement.dataset.theme = '';
  try {
    localStorage.removeItem('blum-theme');
  } catch {
    /* nothing stored */
  }
}

/* ---- actions ---- */

export function initToolbar(): void {
  document.getElementById('new-story')?.addEventListener('click', () => {
    void createDesign('story');
  });
  document.getElementById('new-post')?.addEventListener('click', () => {
    void createDesign('post');
  });
  const pick = document.getElementById('new-format');
  const wIn = document.getElementById('new-width');
  const hIn = document.getElementById('new-height');
  if (pick instanceof HTMLSelectElement) {
    for (const f of FORMATS) {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.label;
      pick.append(opt);
    }
    const custom = document.createElement('option');
    custom.value = 'custom';
    custom.textContent = `Custom size (${CUSTOM_MIN}..${CUSTOM_MAX} px)`;
    pick.append(custom);
    const syncCustom = (): void => {
      const on = pick.value === 'custom';
      if (wIn instanceof HTMLInputElement) wIn.hidden = !on;
      if (hIn instanceof HTMLInputElement) hIn.hidden = !on;
    };
    pick.addEventListener('change', syncCustom);
    syncCustom();
  }
  document.getElementById('new-create')?.addEventListener('click', () => {
    const fmt = pick instanceof HTMLSelectElement ? pick.value : 'story';
    if (fmt !== 'custom') {
      void createDesign(fmt);
      return;
    }
    const w = Math.round(Number(wIn instanceof HTMLInputElement ? wIn.value : NaN));
    const h = Math.round(Number(hIn instanceof HTMLInputElement ? hIn.value : NaN));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < CUSTOM_MIN || w > CUSTOM_MAX || h < CUSTOM_MIN || h > CUSTOM_MAX) {
      status.textContent = `Custom size must be ${CUSTOM_MIN}..${CUSTOM_MAX} px each.`;
      return;
    }
    void createDesign('custom', w, h);
  });
}

initTheme();
initToolbar();
void renderRecents();
void load(true);
window.setInterval(() => {
  if (document.hidden) return;
  void load(false);
}, 4000);
