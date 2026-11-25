// Session transcript: one line per agent event, with a short label per MCP
// tool. Autoscrolls only when the user already sits at the bottom.
export interface TranscriptEvent {
  time: number;
  kind: string;
  text?: string;
  tool?: string;
}

const TOOL_LABELS: Record<string, string> = {
  create_design: 'Creates a design',
  list_designs: 'Lists the designs',
  get_design: 'Reads the design',
  apply_ops: 'Edits the design',
  undo: 'Undoes the change',
  redo: 'Redoes the change',
  check_design: 'Checks the design',
  polish_score: 'Scores the design',
  list_formats: 'Lists the formats',
  list_resources: 'Lists the resources',
  import_image: 'Adds a photo',
  preview: 'Looks at the design',
  preview_board: 'Looks at the designs',
  export_png: 'Exports as PNG',
  export_pdf: 'Exports as PDF',
  delete_draft: 'Deletes a draft',
  overview: 'Reads the docs',
  api_info: 'Reads the docs',
  style_guide: 'Reads the docs',
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? `Calls ${tool}`;
}

function nearBottom(box: HTMLElement): boolean {
  return box.scrollHeight - box.scrollTop - box.clientHeight < 80;
}

export function appendEvent(box: HTMLElement, event: TranscriptEvent): void {
  const stick = nearBottom(box);
  const line = document.createElement('div');
  if (event.kind === 'text' || event.kind === 'done') {
    line.className = 'line text';
    line.textContent = event.text ?? '';
  } else if (event.kind === 'tool') {
    line.className = 'line tool';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    line.append(dot, document.createTextNode(toolLabel(event.tool ?? '')));
  } else if (event.kind === 'error') {
    line.className = 'line error';
    line.textContent = event.text ?? 'Something went wrong.';
  } else {
    return;
  }
  box.append(line);
  if (stick) box.scrollTop = box.scrollHeight;
}
