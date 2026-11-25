// Editor toolbar shape tools.
import { LINE_KINDS } from '../../render/render.js';
import { renderLineTools } from './line.js';
import { colorSwatch, gradientSwatch } from './colour.js';
import { caption, numberStepper, separator } from './controls.js';
import { panelLabel } from './popover.js';
import { opacityStepper } from './shared.js';
import { hooks } from './hooks.js';
import { previewProps, findItem, type EditorState } from '../state.js';

export function renderShapeTools(root: HTMLElement, st: EditorState, id: string): void {
  if (!hooks) return;
  const it = findItem(st.design, id);
  const props = (it?.props ?? {}) as Record<string, unknown>;
  if (it && LINE_KINDS.has(String(props.shape ?? ''))) {
    renderLineTools(root, st, it);
    return;
  }
  colorSwatch(root, st, typeof props.fill === 'string' ? props.fill : '#111111', 'Fill colour', 'shape-fill', (fill) => {
    void hooks?.commit([{ op: 'update', id, patch: { fill } }]);
  }, (fill) => previewProps(st, id, { fill }), (panel) => {
    panelLabel(panel, 'Gradients');
    gradientSwatch(panel, id);
  });
  if (props.shape === 'rect' || props.shape === 'rounded' || props.shape === 'frame') {
    numberStepper(root, Number(props.cornerRadius ?? 0), 4, 0, 200, 'corners', (v) => {
      void hooks?.commit([{ op: 'update', id, patch: { cornerRadius: v } }]);
    });
    caption(root, 'Corners');
  }
  if (props.shape === 'frame' || props.shape === 'ring' || props.shape === 'separator') {
    colorSwatch(root, st, typeof props.stroke === 'string' ? props.stroke : '#111111', 'Stroke colour', 'shape-stroke', (stroke) => {
      void hooks?.commit([{ op: 'update', id, patch: { stroke } }]);
    }, (stroke) => previewProps(st, id, { stroke }));
    numberStepper(root, Number(props.strokeWidth ?? 0), 2, 0, 120, 'stroke', (v) => {
      void hooks?.commit([{ op: 'update', id, patch: { strokeWidth: v } }]);
    });
    caption(root, 'Stroke');
  }
  if (props.shape === 'star') {
    numberStepper(root, Number(props.points ?? 5), 1, 3, 12, 'points', (v) => {
      void hooks?.commit([{ op: 'update', id, patch: { points: v } }]);
    });
    caption(root, 'Points');
    // Spike depth is a ratio in the JSON, a percent in the bar.
    numberStepper(root, Math.round(Number(props.innerRatio ?? 0.42) * 100), 5, 10, 95, 'spikes', (v) => {
      void hooks?.commit([{ op: 'update', id, patch: { innerRatio: v / 100 } }]);
    });
    caption(root, 'Spikes');
  }
  if (props.shape === 'polygon') {
    numberStepper(root, Number(props.sides ?? 6), 1, 3, 12, 'sides', (v) => {
      void hooks?.commit([{ op: 'update', id, patch: { sides: v } }]);
    });
    caption(root, 'Sides');
  }
  opacityStepper(root, st, [id]);
  separator(root);
}