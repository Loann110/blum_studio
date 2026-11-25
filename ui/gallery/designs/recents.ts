// Sidebar recents: the latest creation sessions, with a mini thumbnail of
// the first design. Shared by every gallery page; a no-op without #recents.
import { renderDesign } from '../../render/render.js';

interface RecentSession {
  id: string;
  title: string;
  agent: string;
  designIds: string[];
}

const thumbs = new Map<string, string>();

async function thumbFor(designId: string): Promise<string | null> {
  const cached = thumbs.get(designId);
  if (cached !== undefined) return cached || null;
  try {
    const res = await fetch(`/api/designs/${encodeURIComponent(designId)}`);
    if (!res.ok) throw new Error();
    const body = (await res.json()) as { design?: Parameters<typeof renderDesign>[0] };
    if (!body.design) throw new Error();
    const html = renderDesign(body.design, { assetsBase: '/assets', mediaBase: '/media' });
    thumbs.set(designId, html);
    return html;
  } catch {
    thumbs.set(designId, '');
    return null;
  }
}

function thumbBox(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'recent-thumb';
  box.setAttribute('aria-hidden', 'true');
  return box;
}

async function paintThumb(box: HTMLElement, designId: string): Promise<void> {
  // The row joins the page while the fetch runs: check afterwards.
  const html = await thumbFor(designId);
  if (!box.isConnected) return;
  // Safe: thumbnail markup is renderDesign output, whose strings are escaped.
  if (html) box.innerHTML = html;
}

function recentRow(session: RecentSession): HTMLElement {
  const link = document.createElement('a');
  link.className = 'recent';
  link.href = `/create/${encodeURIComponent(session.id)}`;
  const box = thumbBox();
  if (session.designIds.length) {
    const first = session.designIds[0] as string;
    void paintThumb(box, first);
  }
  const info = document.createElement('div');
  info.className = 'recent-info';
  const title = document.createElement('div');
  title.className = 'recent-title';
  title.textContent = session.title;
  const agent = document.createElement('div');
  agent.className = 'recent-agent';
  agent.textContent = session.agent;
  info.append(title, agent);
  link.append(box, info);
  return link;
}

export async function renderRecents(): Promise<void> {
  const slot = document.getElementById('recents');
  if (!slot) return;
  let sessions: RecentSession[] = [];
  try {
    const res = await fetch('/api/console/sessions');
    if (res.ok) sessions = ((await res.json()) as RecentSession[]).slice(0, 6);
  } catch {
    return; // the sidebar stays on its placeholder
  }
  slot.innerHTML = '';
  if (!sessions.length) {
    const empty = document.createElement('p');
    empty.className = 'recents-empty';
    empty.textContent = 'No sessions yet';
    slot.append(empty);
    return;
  }
  for (const session of sessions) slot.append(recentRow(session));
}
