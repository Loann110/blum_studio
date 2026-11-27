// Session transcript: one line per agent event, with a short label per MCP
// tool. Autoscrolls only when the user already sits at the bottom.
export interface TranscriptUsage {
  tokens?: number;
  costUsd?: number;
  ms?: number;
  turns?: number;
}

export interface TranscriptEvent {
  time: number;
  kind: string;
  text?: string;
  tool?: string;
  usage?: TranscriptUsage;
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

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// "42.1k tokens · $0.03 · 1m 12s", only the numbers the run reported.
function usageLabel(usage: TranscriptUsage): string {
  const parts: string[] = [];
  if (usage.tokens !== undefined) {
    parts.push(usage.tokens >= 1000 ? `${(usage.tokens / 1000).toFixed(1)}k tokens` : `${usage.tokens} tokens`);
  }
  if (usage.costUsd !== undefined) {
    parts.push(`$${usage.costUsd.toFixed(usage.costUsd > 0 && usage.costUsd < 0.01 ? 3 : 2)}`);
  }
  if (usage.ms !== undefined) parts.push(duration(usage.ms));
  return parts.join(' · ');
}

// Running session total per transcript box: the box is filled once per page load.
const totals = new WeakMap<HTMLElement, { runs: number; usage: TranscriptUsage }>();

function addUsage(box: HTMLElement, usage: TranscriptUsage): { runs: number; usage: TranscriptUsage } {
  const total = totals.get(box) ?? { runs: 0, usage: {} };
  total.runs += 1;
  for (const key of ['tokens', 'costUsd', 'ms', 'turns'] as const) {
    if (usage[key] !== undefined) total.usage[key] = (total.usage[key] ?? 0) + (usage[key] as number);
  }
  totals.set(box, total);
  return total;
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
  if ((event.kind === 'done' || event.kind === 'error') && event.usage) {
    const total = addUsage(box, event.usage);
    let label = usageLabel(event.usage);
    if (label && total.runs > 1) label += ` (session: ${usageLabel(total.usage)})`;
    if (label) {
      const meta = document.createElement('div');
      meta.className = 'line usage';
      meta.textContent = label;
      box.append(meta);
    }
  }
  if (stick) box.scrollTop = box.scrollHeight;
}
