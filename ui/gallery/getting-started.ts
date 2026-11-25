// Getting started: static guide page. Only the theme switch and the
// copy buttons need code; everything else is plain HTML.
export {};


(function initTheme(): void {
  // Light only (the user's choice): clear any dark mode a browser kept from before.
  document.documentElement.dataset.theme = '';
  try {
    localStorage.removeItem('blum-theme');
  } catch {
    /* nothing stored */
  }
})();

import { renderRecents } from './designs/recents.js';

void renderRecents();

for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-copy]',
)) {
  button.addEventListener('click', () => {
    const text = button.dataset.copy ?? '';
    const done = (): void => {
      const label = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(() => {
        button.textContent = label;
      }, 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      done();
    }
  });
}

