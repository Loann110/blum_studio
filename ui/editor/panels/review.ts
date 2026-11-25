// Editor review panel: checks and care score.
import { findItem, type DesignItem, type EditorState } from '../state.js';
import { hooks, loadNote } from './hooks.js';
import { checkDesign } from '../api.js';

interface PanelFinding {
  check: string;
  level: string;
  item: string;
  message: string;
}

/** What the panel calls an item: its name, else the start of its text, else its id. */
function labelFor(it: DesignItem | null, id: string): string {
  if (!it) return id;
  if (it.name && it.name !== it.id) return it.name;
  if (it.type === 'text') {
    const words = String((it.props as Record<string, unknown> | undefined)?.text ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (words) return words.length > 26 ? `${words.slice(0, 25)}…` : words;
  }
  return it.name || it.id;
}

/** The finding sentence with raw ids swapped for item labels. */
function friendly(f: PanelFinding): string {
  const design = hooks?.state.design;
  if (!design) return f.message;
  return f.message.replace(/'([^']+)'/g, (whole, id: string) => {
    const it = findItem(design, id);
    return it ? `'${labelFor(it, id)}'` : whole;
  });
}

export async function renderReview(root: HTMLElement, st: EditorState): Promise<void> {
  if (!hooks) return;
  const box = document.createElement('div');
  box.className = 'review-head';
  const score = document.createElement('div');
  score.className = 'score-chip';
  score.textContent = 'Score: …';
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.innerHTML = '<i data-lucide="shield"></i> Check design';
  const findings = document.createElement('div');
  btn.addEventListener('click', () => void refresh());
  const refresh = async (): Promise<void> => {
    if (!hooks) return;
    try {
      const report = (await checkDesign(st.id)) as { findings: PanelFinding[]; score: number };
      score.textContent = `Score: ${report.score} / 100`;
      score.dataset.grade = report.score >= 85 ? 'good' : report.score >= 60 ? 'fair' : 'low';
      findings.innerHTML = '';
      const errors = report.findings.filter((f) => f.level === 'error');
      const warns = report.findings.filter((f) => f.level === 'warn');
      const notes = report.findings.filter((f) => f.level !== 'error' && f.level !== 'warn');
      if (report.findings.length === 0) {
        findings.innerHTML = '<p style="font-size:12px">Clean: no findings.</p>';
      }
      const show = (list: PanelFinding[], title: string): void => {
        if (list.length === 0) return;
        const head = document.createElement('h3');
        head.textContent = title;
        findings.append(head);
        for (const f of list) {
          const div = document.createElement('div');
          div.className = `finding ${f.level}`;
          div.textContent = friendly(f);
          div.title = `${f.check} (${f.item || 'design'})`;
          div.addEventListener('click', () => {
            if (f.item) hooks?.setSelection([f.item]);
          });
          findings.append(div);
        }
      };
      show(errors, 'Errors');
      show(warns, 'Warnings');
      if (notes.length > 0) {
        const fold = document.createElement('details');
        const head = document.createElement('summary');
        head.textContent = notes.length === 1 ? '1 note' : `${notes.length} notes`;
        head.style.fontSize = '12px';
        fold.append(head);
        findings.append(fold);
        for (const f of notes) {
          const div = document.createElement('div');
          div.className = `finding ${f.level}`;
          div.textContent = friendly(f);
          div.title = `${f.check} (${f.item || 'design'})`;
          div.addEventListener('click', () => {
            if (f.item) hooks?.setSelection([f.item]);
          });
          fold.append(div);
        }
      }
    } catch (err) {
      score.textContent = 'Score: unavailable';
      findings.innerHTML = '';
      findings.append(loadNote(`Check failed: ${(err as Error).message}`));
    }
  };
  box.append(score, btn);

  root.append(box, findings);
  await refresh();
}
