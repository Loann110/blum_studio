// Editor start screen: open or create a design.
import { deleteDesign, renameDesign } from '../api.js';
import { closeFloating } from './hooks.js';
import { confirmDialog, promptDialog } from './dialogs.js';
import { toast } from '../state.js';
import { refreshIcons } from '../icons.js';
import { CUSTOM_MAX, CUSTOM_MIN, FORMATS } from '../../engine/index.js';

export function showStart(
  designs: { id: string; name: string; format: string; items: number; updated: number }[],
  onOpen: (id: string) => void,
  onCreate: (format: string, width?: number, height?: number) => void,
): void {
  closeFloating();
  const back = document.createElement('div');
  back.className = 'dialog-back keep';
  back.id = 'start-screen';
  const box = document.createElement('div');
  box.className = 'dialog';
  box.innerHTML = '<h2>Open a design</h2>';
  const row = document.createElement('div');
  row.className = 'row';
  for (const fmt of ['story', 'post'] as const) {
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.innerHTML = `<i data-lucide="file-plus"></i> New ${fmt} <span style="opacity:.7">1080×${fmt === 'story' ? '1920' : '1350'}</span>`;
    btn.addEventListener('click', () => onCreate(fmt));
    row.append(btn);
  }
  const more = document.createElement('div');
  more.className = 'row';
  const pick = document.createElement('select');
  pick.setAttribute('aria-label', 'Page format');
  for (const f of FORMATS) {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.label;
    pick.append(opt);
  }
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = `Custom size (${CUSTOM_MIN}..${CUSTOM_MAX} px)`;
  pick.append(customOpt);
  const go = document.createElement('button');
  go.className = 'btn primary';
  go.innerHTML = '<i data-lucide="file-plus"></i> New design';
  const wIn = document.createElement('input');
  wIn.type = 'number';
  wIn.min = String(CUSTOM_MIN);
  wIn.max = String(CUSTOM_MAX);
  wIn.value = '1080';
  wIn.setAttribute('aria-label', 'Custom width in pixels');
  wIn.hidden = true;
  const hIn = document.createElement('input');
  hIn.type = 'number';
  hIn.min = String(CUSTOM_MIN);
  hIn.max = String(CUSTOM_MAX);
  hIn.value = '1920';
  hIn.setAttribute('aria-label', 'Custom height in pixels');
  hIn.hidden = true;
  pick.addEventListener('change', () => {
    const custom = pick.value === 'custom';
    wIn.hidden = !custom;
    hIn.hidden = !custom;
  });
  go.addEventListener('click', () => {
    if (pick.value !== 'custom') {
      onCreate(pick.value);
      return;
    }
    const w = Math.round(Number(wIn.value));
    const h = Math.round(Number(hIn.value));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < CUSTOM_MIN || w > CUSTOM_MAX || h < CUSTOM_MIN || h > CUSTOM_MAX) {
      toast(`Custom size must be ${CUSTOM_MIN}..${CUSTOM_MAX} px each.`);
      return;
    }
    onCreate('custom', w, h);
  });
  more.append(pick, wIn, hIn, go);
  box.append(row, more);
  const list = document.createElement('div');
  list.className = 'start-list';
  const ordered = [...designs].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  for (const d of ordered) {
    const line = document.createElement('div');
    line.className = 'rowline';
    const btn = document.createElement('button');
    btn.className = 'open';
    btn.setAttribute('aria-label', `Open ${d.name}`);
    const name = document.createElement('span');
    name.textContent = d.name;
    const meta = document.createElement('span');
    const date = d.updated ? new Date(d.updated * 1000).toLocaleDateString() : '';
    meta.textContent = `${d.format} · ${d.items ?? 0} items${date ? ` · ${date}` : ''}`;
    meta.style.color = 'var(--muted)';
    btn.append(name, meta);
    btn.addEventListener('click', () => onOpen(d.id));
    const ren = document.createElement('button');
    ren.className = 'del rename';
    ren.title = `Rename ${d.name}`;
    ren.setAttribute('aria-label', `Rename ${d.name}`);
    ren.innerHTML = '<i data-lucide="pencil"></i>';
    ren.addEventListener('click', (ev) => {
      ev.stopPropagation();
      void promptDialog({
        title: 'Rename design',
        label: 'Name',
        initial: d.name,
        confirmLabel: 'Rename',
      }).then((next) => {
        if (next === null || !next.trim() || next.trim() === d.name) return;
        void renameDesign(d.id, next.trim()).then(
          () => {
            d.name = next.trim();
            name.textContent = d.name;
            btn.setAttribute('aria-label', `Open ${d.name}`);
            ren.title = `Rename ${d.name}`;
            ren.setAttribute('aria-label', `Rename ${d.name}`);
            del.title = `Delete ${d.name}`;
            del.setAttribute('aria-label', `Delete ${d.name}`);
          },
          (err) => toast(`Rename failed: ${(err as Error).message}`),
        );
      });
    });
    const del = document.createElement('button');
    del.className = 'del';
    del.title = `Delete ${d.name}`;
    del.setAttribute('aria-label', `Delete ${d.name}`);
    del.innerHTML = '<i data-lucide="trash"></i>';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      void confirmDialog(`Delete "${d.name}"? This cannot be undone.`, {
        title: 'Delete design',
        confirmLabel: 'Delete',
        danger: true,
      }).then((ok) => {
        if (!ok) return;
        void deleteDesign(d.id).then(
          () => line.remove(),
          (err) => toast(`Delete failed: ${(err as Error).message}`),
        );
      });
    });
    line.append(btn, ren, del);
    list.append(line);
  }
  if (designs.length === 0) {
    list.innerHTML = '<p style="font-size:13px">No designs yet: create one above.</p>';
  }
  box.append(list);
  back.append(box);
  document.body.append(back);
  refreshIcons();
}

export function hideStart(): void {
  document.getElementById('start-screen')?.remove();
}