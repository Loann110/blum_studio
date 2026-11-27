// Engine image sources: the one rule for photo, image, textFill and
// background pictures. Design media, bundled assets, remote files and image
// data URIs only: anything else could pull a local file into the render.
// 'designs/media/' is the older spelling of media/: saved designs still use it.
const ASSET_FOLDERS = ['media/', 'designs/media/', 'textures/', 'stickers/'];

// A path inside one asset folder: no way out, however encoded.
function safeRelative(rest: string): boolean {
  if (rest === '') return false;
  let decoded = rest;
  try {
    decoded = decodeURIComponent(rest);
  } catch {
    return false;
  }
  if (decoded.includes('\\') || decoded.includes(':')) return false;
  return !decoded.split('/').includes('..');
}

export function isSafeImageSrc(src: string): boolean {
  if (src === '') return false;
  // The render always writes url("..."): only a double quote, a backslash or a
  // control character can break out of it (parentheses and ' are fine inside).
  if (/["\\\x00-\x1F\x7F]/.test(src)) return false;
  if (/^https?:\/\//i.test(src) || src.toLowerCase().startsWith('data:image/')) return true;
  for (const folder of ASSET_FOLDERS) {
    if (src.startsWith(folder)) return safeRelative(src.slice(folder.length));
  }
  return false;
}

// A local file can never render: the agent must import it first.
function isLocalPath(src: string): boolean {
  return src.startsWith('/') || src.startsWith('\\') || /^[A-Za-z]:/.test(src) || /^file:/i.test(src);
}

export function localSrcHint(src: string): string {
  return isLocalPath(src) ? ' (import the file with import_image first, then use its media/... src)' : '';
}
