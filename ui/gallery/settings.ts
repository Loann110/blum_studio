// Settings: detect the AI agents on this PC and connect them in one click.
// The list comes from the server (it runs the CLIs); connect and disconnect
// POST back with the Settings-only header the server requires.
export {};

interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  installUrl?: string;
  installed: boolean;
  connected: boolean;
  version?: string;
  error?: string;
}

/* ---- theme (same switch as the other gallery pages) ---- */

(function initTheme(): void {
  // Light only (the user's choice): clear any dark mode a browser kept from before.
  document.documentElement.dataset.theme = '';
  try {
    localStorage.removeItem('blum-theme');
  } catch {
    /* nothing stored */
  }
})();

/* ---- icons (Lucide, ISC, see THIRD_PARTY_NOTICES.md): inline SVG, no bundler ---- */

const ICONS: Record<string, string> = {
  terminal: '<path d="M12 19h8" /><path d="m4 17 6-6-6-6" />',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />',
};

function iconSvg(key: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[key] ?? ICONS.terminal ?? '';
  return svg;
}

/* ---- page ---- */

import { renderRecents } from './designs/recents.js';

void renderRecents();

const list = document.getElementById('agents') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const refreshButton = document.getElementById('refresh') as HTMLButtonElement;

refreshButton.addEventListener('click', () => void load(true));

async function load(refresh = false): Promise<void> {
  list.innerHTML = '';
  statusEl.textContent = 'Detecting agents…';
  let agents: AgentInfo[];
  try {
    const res = await fetch(refresh ? '/api/agents?refresh=1' : '/api/agents');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    agents = (await res.json()) as AgentInfo[];
  } catch {
    statusEl.textContent = 'Could not detect the agents. ';
    list.append(retryButton());
    return;
  }
  statusEl.textContent = '';
  for (const agent of agents) list.append(agentCard(agent));
}

function retryButton(): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mini';
  button.textContent = 'Retry';
  button.addEventListener('click', () => void load());
  return button;
}

/* ---- one card per agent ---- */

function agentCard(agent: AgentInfo): HTMLElement {
  const card = document.createElement('div');
  card.className = 'agent' + (agent.installed ? '' : ' off');
  card.dataset.id = agent.id;

  const badge = document.createElement('div');
  badge.className = 'agent-icon';
  badge.append(iconSvg(agent.icon));
  card.append(badge);

  const info = document.createElement('div');
  info.className = 'agent-info';
  const name = document.createElement('div');
  name.className = 'agent-name';
  name.textContent = agent.name;
  if (agent.installed && agent.version) {
    const version = document.createElement('span');
    version.className = 'version';
    version.textContent = agent.version;
    name.append(version);
  }
  const state = document.createElement('div');
  state.className = 'agent-state' + (agent.installed && agent.connected ? ' on' : '');
  state.textContent = !agent.installed ? 'Not installed' : agent.connected ? 'Connected' : 'Not connected';
  info.append(name, state);
  if (agent.error) {
    const error = document.createElement('div');
    error.className = 'agent-note';
    error.textContent = agent.error;
    info.append(error);
  }
  card.append(info);

  const action = document.createElement('div');
  action.className = 'agent-action';
  if (!agent.installed) {
    if (agent.installUrl) action.append(installLink(agent));
  } else {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = agent.connected ? 'ghost' : 'primary';
    button.textContent = agent.connected ? 'Disconnect' : 'Connect';
    button.addEventListener('click', () => void runAction(agent, button, state, info));
    action.append(button);
  }
  card.append(action);
  return card;
}

function installLink(agent: AgentInfo): HTMLElement {
  const link = document.createElement('a');
  link.className = 'mini go-link';
  link.href = agent.installUrl ?? '';
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = `Get ${agent.name}`;
  return link;
}

/* ---- connect / disconnect ---- */

async function runAction(agent: AgentInfo, button: HTMLButtonElement, state: HTMLElement, info: HTMLElement): Promise<void> {
  const action = agent.connected ? 'disconnect' : 'connect';
  button.disabled = true;
  button.textContent = action === 'connect' ? 'Connecting…' : 'Disconnecting…';
  let detail: string | null = null;
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/${action}`, {
      method: 'POST',
      headers: { 'X-Blum-Request': '1' },
    });
    if (!res.ok) detail = await readDetail(res);
  } catch {
    detail = 'the server did not answer';
  }
  if (detail !== null) {
    statusEl.textContent = `${agent.name}: ${detail}`;
    button.disabled = false;
    button.textContent = action === 'connect' ? 'Connect' : 'Disconnect';
    return;
  }
  agent.connected = action === 'connect';
  state.textContent = agent.connected ? 'Connected' : 'Not connected';
  state.classList.toggle('on', agent.connected);
  button.className = agent.connected ? 'ghost' : 'primary';
  button.textContent = agent.connected ? 'Disconnect' : 'Connect';
  button.disabled = false;
  info.querySelector('.agent-note')?.remove();
  const note = document.createElement('div');
  note.className = 'agent-note';
  note.textContent = `Restart ${agent.name} to use it.`;
  info.append(note);
  statusEl.textContent = '';
}

async function readDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    if (body.detail) return body.detail;
  } catch {
    /* fall through to the status */
  }
  return `the server answered HTTP ${res.status}`;
}

/* ---- stock photos ---- */

const STOCK_SERVICES = ['pexels', 'pixabay'] as const;

function stockStateEl(service: string): HTMLElement | null {
  return document.querySelector(`.stock-card[data-service="${service}"] .stock-state`);
}

function setStockState(service: string, text: string): void {
  const state = stockStateEl(service);
  if (!state) return;
  state.textContent = text;
  state.classList.toggle('on', text === 'Connected' || text === 'Key saved');
  // The key never comes back from the server, so the empty field says whether one is saved.
  const card = state.closest<HTMLElement>('.stock-card');
  const input = card?.querySelector<HTMLInputElement>('.stock-key');
  const save = card?.querySelector<HTMLButtonElement>('.stock-save');
  const remove = card?.querySelector<HTMLButtonElement>('.stock-remove');
  if (!input || !save || !remove) return;
  const saved = text === 'Connected' || text === 'Key saved' || text === 'Invalid key';
  input.placeholder = saved ? 'Key saved · paste to replace' : `${service === 'pexels' ? 'Pexels' : 'Pixabay'} API key`;
  remove.disabled = !saved;
  save.disabled = !input.value.trim();
}

async function loadStock(): Promise<void> {
  let status: { pexels: boolean; pixabay: boolean };
  try {
    const res = await fetch('/api/stock');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    status = (await res.json()) as { pexels: boolean; pixabay: boolean };
  } catch {
    return; // a saved key still works; the fields stay editable
  }
  for (const service of STOCK_SERVICES) {
    setStockState(service, status[service] ? 'Key saved' : 'Not set');
  }
}

async function runStock(service: string, key: string, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  let status = 'the server did not answer';
  try {
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Blum-Request': '1' },
      body: JSON.stringify({ service, key }),
    });
    if (!res.ok) {
      status = await readDetail(res);
    } else {
      const body = (await res.json()) as { status?: string };
      const s = body.status ?? '';
      status = s === 'connected' ? 'Connected' : s === 'invalid key' ? 'Invalid key' : s === 'not set' ? 'Not set' : s || 'Saved';
    }
  } catch {
    /* status already set above */
  }
  button.disabled = false;
  const input = button.closest('.stock-card')?.querySelector<HTMLInputElement>('.stock-key');
  if (input && status !== 'the server did not answer') input.value = ''; // never leave a key on screen
  setStockState(service, status);
}

for (const card of Array.from(document.querySelectorAll<HTMLElement>('.stock-card'))) {
  const service = card.dataset.service;
  if (service !== 'pexels' && service !== 'pixabay') continue;
  const input = card.querySelector<HTMLInputElement>('.stock-key');
  const save = card.querySelector<HTMLButtonElement>('.stock-save');
  const remove = card.querySelector<HTMLButtonElement>('.stock-remove');
  if (!input || !save || !remove) continue;
  save.disabled = true;
  remove.disabled = true;
  input.addEventListener('input', () => {
    save.disabled = !input.value.trim();
  });
  save.addEventListener('click', () => void runStock(service, input.value, save));
  remove.addEventListener('click', () => {
    input.value = '';
    void runStock(service, '', remove);
  });
}

void loadStock();

void load();
