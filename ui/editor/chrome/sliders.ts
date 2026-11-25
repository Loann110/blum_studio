// Editor sliders: keep every slider fill in step with its value.
/** Keeps every slider's filled part (`--val`, see theme.css) in step with its value, as built and as dragged. */
export function trackSliderFill(): void {
  const sync = (el: HTMLInputElement): void => {
    const min = Number(el.min || 0);
    const max = Number(el.max || 100);
    const pct = max > min ? ((Number(el.value) - min) / (max - min)) * 100 : 0;
    el.style.setProperty('--val', `${Math.min(100, Math.max(0, pct))}%`);
  };
  const syncAll = (root: ParentNode): void => {
    root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(sync);
  };
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el instanceof HTMLInputElement && el.type === 'range') sync(el);
  });
  // Panels and popovers are rebuilt often: new sliders get their fill as they appear.
  new MutationObserver(() => syncAll(document)).observe(document.body, { childList: true, subtree: true });
  syncAll(document);
}