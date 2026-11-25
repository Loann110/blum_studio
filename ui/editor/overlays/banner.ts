// Editor live banner: disk changes during local edits.
import { hooks } from './hooks.js';

export function showBanner(): void {
  if (document.querySelector('.banner.live')) return;
  const zone = document.querySelector('.canvas-zone');
  if (!zone) return;
  const bar = document.createElement('div');
  bar.className = 'banner live';
  bar.innerHTML =
    '<span>This design changed on disk (MCP). Reload to see it, or keep editing — saving overwrites it.</span>';
  const reload = document.createElement('button');
  reload.className = 'btn';
  reload.textContent = 'Reload';
  reload.addEventListener('click', () => void hooks?.reloadRemote());
  const keep = document.createElement('button');
  keep.className = 'btn';
  keep.textContent = 'Keep editing';
  keep.addEventListener('click', () => {
    hooks?.dismissBanner();
    bar.remove();
  });
  bar.append(reload, keep);
  zone.prepend(bar);
}

export function hideBanner(): void {
  document.querySelector('.banner.live')?.remove();
}