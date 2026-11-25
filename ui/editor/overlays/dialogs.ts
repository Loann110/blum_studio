// House confirm and prompt dialogs: the same questions window.confirm and
// window.prompt used to ask, in the app's own style (.dialog-back).
import { closeFloating } from './hooks.js';

let seq = 0;

// Builds the backdrop and the labelled box, then hands them to build, which
// wires one finish(value) call per exit. Escape and backdrop clicks resolve
// with cancelValue; focus goes back where it was. The backdrop keeps the
// 'keep' class so the global overlay handler never drops it without settling.
function shell<T>(
  title: string,
  cancelValue: T,
  build: (box: HTMLElement, finish: (value: T) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve) => {
    closeFloating();
    const previous = document.activeElement;
    const back = document.createElement('div');
    back.className = 'dialog-back keep';
    const box = document.createElement('div');
    box.className = 'dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const titleId = `dialog-title-${++seq}`;
    box.setAttribute('aria-labelledby', titleId);
    const heading = document.createElement('h2');
    heading.id = titleId;
    heading.textContent = title;
    box.append(heading);
    let settled = false;
    const finish = (value: T): void => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
      resolve(value);
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        finish(cancelValue);
      }
    };
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('click', (ev) => {
      if (ev.target === back) finish(cancelValue);
    });
    back.append(box);
    document.body.append(back);
    build(box, finish);
  });
}

/**
 * House confirm: resolves true on confirm, false on cancel, Escape or
 * backdrop click. Replaces window.confirm with the same message.
 */
export function confirmDialog(
  message: string,
  opts: { title: string; confirmLabel: string; danger?: boolean },
): Promise<boolean> {
  return shell<boolean>(opts.title, false, (box, finish) => {
    const text = document.createElement('p');
    text.className = 'message';
    const textId = `dialog-message-${++seq}`;
    text.id = textId;
    text.textContent = message;
    box.setAttribute('aria-describedby', textId);
    const actions = document.createElement('div');
    actions.className = 'actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'Cancel';
    const confirm = document.createElement('button');
    confirm.className = opts.danger ? 'btn danger' : 'btn primary';
    confirm.textContent = opts.confirmLabel;
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    actions.append(cancel, confirm);
    box.append(text, actions);
    confirm.focus();
  });
}

/**
 * House prompt: resolves the typed text, null on cancel, Escape or backdrop
 * click. Enter validates. Replaces window.prompt with the same initial text.
 */
export function promptDialog(opts: {
  title: string;
  label: string;
  initial?: string;
  confirmLabel: string;
}): Promise<string | null> {
  return shell<string | null>(opts.title, null, (box, finish) => {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    const inputId = `dialog-input-${++seq}`;
    label.htmlFor = inputId;
    label.textContent = opts.label;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.value = opts.initial ?? '';
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        finish(input.value);
      }
    });
    const actions = document.createElement('div');
    actions.className = 'actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'Cancel';
    const confirm = document.createElement('button');
    confirm.className = 'btn primary';
    confirm.textContent = opts.confirmLabel;
    cancel.addEventListener('click', () => finish(null));
    confirm.addEventListener('click', () => finish(input.value));
    field.append(label, input);
    actions.append(cancel, confirm);
    box.append(field, actions);
    input.focus();
    input.select();
  });
}
