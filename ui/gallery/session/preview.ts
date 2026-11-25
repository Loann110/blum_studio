// Session preview: tabs for the session designs, live repaint on change.
// The design polls its mtime and refetches only when the agent touched it.
import { renderDesign } from '../../render/render.js';

interface DesignRow {
  id: string;
  name: string;
  format: string;
  width?: number;
  height?: number;
  updated: number;
}

type Design = Parameters<typeof renderDesign>[0];

const tabsEl = document.getElementById('tabs') as HTMLElement;
const previewEl = document.getElementById('preview') as HTMLElement;

let designIds: string[] = [];
let current: string | null = null;
let timer = 0;
let seenUpdated = -1;

function rowLabel(row: DesignRow): string {
  return String(row.name ?? row.id);
}

export function trackDesigns(ids: string[]): void {
  designIds = [...ids];
  if (!current || !designIds.includes(current)) {
    current = designIds[0] ?? null;
    seenUpdated = -1;
  }
  drawTabs();
  void refresh(true);
}

async function fetchRow(id: string): Promise<DesignRow | null> {
  try {
    const res = await fetch('/api/designs');
    if (!res.ok) return null;
    const rows = (await res.json()) as DesignRow[];
    return rows.find((r) => r.id === id) ?? null;
  } catch {
    return null;
  }
}

function drawTabs(): void {
  tabsEl.innerHTML = '';
  if (designIds.length < 2) return;
  for (const id of designIds) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.role = 'tab';
    tab.className = 'tab' + (id === current ? ' active' : '');
    tab.setAttribute('aria-selected', id === current ? 'true' : 'false');
    tab.dataset.design = id;
    tab.textContent = id.slice(0, 12);
    tab.addEventListener('click', () => {
      current = id;
      seenUpdated = -1;
      drawTabs();
      void refresh(true);
      void labelTabs();
    });
    tabsEl.append(tab);
  }
  void labelTabs();
}

async function labelTabs(): Promise<void> {
  for (const tab of tabsEl.querySelectorAll<HTMLButtonElement>('.tab')) {
    const id = tab.dataset.design ?? '';
    const row = await fetchRow(id);
    if (tab.isConnected && row) tab.textContent = rowLabel(row);
  }
}

async function mtimeOf(id: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/designs/${encodeURIComponent(id)}/mtime`);
    if (!res.ok) return null;
    const body = (await res.json()) as { updated?: number };
    return typeof body.updated === 'number' ? body.updated : null;
  } catch {
    return null;
  }
}

async function paint(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/designs/${encodeURIComponent(id)}`);
  } catch {
    return;
  }
  if (!res.ok) return;
  let design: Design;
  try {
    design = ((await res.json()) as { design?: Design }).design as Design;
  } catch {
    return;
  }
  if (!design || id !== current) return;
  // Safe: renderDesign escapes every design string, including agent-written text.
  previewEl.innerHTML = renderDesign(design, { assetsBase: '/assets', mediaBase: '/media' });
}

async function refresh(force: boolean): Promise<void> {
  if (!current) {
    previewEl.innerHTML = '<p class="preview-empty">The design will appear here once the agent creates it.</p>';
    return;
  }
  if (!force) {
    const updated = await mtimeOf(current);
    if (updated === null || updated === seenUpdated) return;
    seenUpdated = updated;
  }
  await paint(current);
}

export function startPreview(ids: string[]): void {
  trackDesigns(ids);
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    void refresh(false);
  }, 2000);
}

// The studio opens on the design on screen.
export function openHref(): string {
  return current ? `/editor/?id=${encodeURIComponent(current)}` : '/designs';
}
