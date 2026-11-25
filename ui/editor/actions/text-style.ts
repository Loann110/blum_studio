// Editor text style: bold, italic, underline.
import { state } from '../live.js';
import { commit } from '../commits.js';
import { selectedToplevel } from '../state.js';

export function toggleBold(): void {
  const it = selectedToplevel(state)[0];
  if (!it || it.type !== 'text') return;
  const props = (it.props ?? {}) as { weight?: number };
  void commit([
    { op: 'update', id: it.id, patch: { weight: (props.weight ?? 400) >= 700 ? 400 : 700 } },
  ]);
}

export function toggleItalic(): void {
  const it = selectedToplevel(state)[0];
  if (!it || it.type !== 'text') return;
  const props = (it.props ?? {}) as { italic?: boolean };
  void commit([{ op: 'update', id: it.id, patch: { italic: !(props.italic === true) } }]);
}

export function toggleUnderline(): void {
  const it = selectedToplevel(state)[0];
  if (!it || it.type !== 'text') return;
  const props = (it.props ?? {}) as { decoration?: string };
  void commit([
    { op: 'update', id: it.id, patch: { decoration: props.decoration === 'underline' ? 'none' : 'underline' } },
  ]);
}