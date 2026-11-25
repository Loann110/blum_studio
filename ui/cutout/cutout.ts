// Background removal: U²-Net small (u2netp, Apache-2.0) run in the browser
// with onnxruntime-web. Shared by the editor and the MCP's Chromium page.
import type * as Ort from 'onnxruntime-web';

/* ---- model contract ---- */

const SIZE = 320; // u2netp input is 1x3x320x320
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const MAX_SIDE = 2400; // keeps the PNG upload and canvas memory reasonable

export interface CutoutPaths {
  ortBase: string; // folder holding ort.wasm.min.mjs and its .wasm
  model: string; // u2netp.onnx URL
}

export const DEFAULT_PATHS: CutoutPaths = {
  ortBase: '/js/ort/',
  model: '/assets/models/u2netp.onnx',
};

/* ---- session (loaded once) ---- */

let session: Promise<{ ort: typeof Ort; run: Ort.InferenceSession }> | null = null;

function loadSession(paths: CutoutPaths) {
  session ??= (async () => {
    // Runtime URL on purpose: the runtime and its wasm stay out of the bundles.
    const ort = (await import(`${paths.ortBase}ort.wasm.min.mjs`)) as typeof Ort;
    ort.env.wasm.wasmPaths = paths.ortBase;
    ort.env.wasm.numThreads = 1; // pages are not cross-origin isolated
    const run = await ort.InferenceSession.create(paths.model, { executionProviders: ['wasm'] });
    return { ort, run };
  })().catch((err: unknown) => {
    session = null; // let a later call retry
    throw err;
  });
  return session;
}

/* ---- image helpers ---- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load the image'));
    img.src = src;
  });
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  return [c, ctx];
}

// U²-Net preprocessing: scale by the brightest value, then ImageNet mean/std, planar RGB.
function toTensorData(px: Uint8ClampedArray): Float32Array {
  let max = 1;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const plane = SIZE * SIZE;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) out[c * plane + i] = (px[i * 4 + c] / max - MEAN[c]) / STD[c];
  }
  return out;
}

/* ---- public ---- */

/** PNG data URL of `src` with its background made transparent. */
export async function removeBackground(src: string, paths: CutoutPaths = DEFAULT_PATHS): Promise<string> {
  const { ort, run } = await loadSession(paths);
  const img = await loadImage(src);

  const [, small] = canvas(SIZE, SIZE);
  small.drawImage(img, 0, 0, SIZE, SIZE);
  const input = new ort.Tensor('float32', toTensorData(small.getImageData(0, 0, SIZE, SIZE).data), [1, 3, SIZE, SIZE]);
  const result = await run.run({ [run.inputNames[0]]: input });
  const raw = result[run.outputNames[0]].data as Float32Array;

  let lo = Infinity;
  let hi = -Infinity;
  for (const v of raw) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!(hi - lo > 1e-3)) throw new Error('no subject found in the image');
  const [maskCanvas, mask] = canvas(SIZE, SIZE);
  const alpha = mask.createImageData(SIZE, SIZE);
  for (let i = 0; i < raw.length; i++) alpha.data[i * 4 + 3] = Math.round(((raw[i] - lo) / (hi - lo)) * 255);
  mask.putImageData(alpha, 0, 0);

  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const [out, ctx] = canvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(maskCanvas, 0, 0, w, h);
  return out.toDataURL('image/png');
}
