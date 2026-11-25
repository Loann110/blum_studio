// Editor background gradients.
import { commitBg, type BackgroundPanelHooks } from './hooks.js';

const GRADIENTS: { name: string; angle: number; stops: { at: number; color: string }[] }[] = [
  { name: 'Sunset', angle: 135, stops: [{ at: 0, color: '#ff6b35' }, { at: 1, color: '#f7c948' }] },
  { name: 'Ocean', angle: 135, stops: [{ at: 0, color: '#0ea5e9' }, { at: 1, color: '#1e3a8a' }] },
  { name: 'Forest', angle: 135, stops: [{ at: 0, color: '#166534' }, { at: 1, color: '#052e16' }] },
  { name: 'Berry', angle: 135, stops: [{ at: 0, color: '#ec4899' }, { at: 1, color: '#4c1d95' }] },
  { name: 'Mono', angle: 135, stops: [{ at: 0, color: '#f5f5f5' }, { at: 1, color: '#a3a3a3' }] },
  { name: 'Night', angle: 135, stops: [{ at: 0, color: '#312e81' }, { at: 1, color: '#020617' }] },
];

export function renderGradients(root: HTMLElement, hooks: BackgroundPanelHooks): void {
  const grad = document.createElement('div');
  grad.innerHTML = '<h3>Gradients</h3>';
  for (const p of GRADIENTS) {
    const card = document.createElement('div');
    card.className = 'swatch-card';
    card.title = p.name;
    const stops = p.stops.map((s) => `${s.color} ${s.at * 100}%`).join(', ');
    card.innerHTML =
      `<div class="swatches"><span style="flex:1;background:linear-gradient(135deg, ${stops})"></span></div>` +
      `<div class="pname">${p.name}</div>`;
    card.addEventListener('click', () => {
      commitBg(hooks, { kind: 'gradient', angle: p.angle, stops: p.stops });
    });
    grad.append(card);
  }
  root.append(grad);
}