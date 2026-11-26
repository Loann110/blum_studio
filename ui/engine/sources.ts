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
  if (src === '' || src.includes('\\')) return false;
  if (/^https?:\/\//i.test(src) || src.toLowerCase().startsWith('data:image/')) return true;
  for (const folder of ASSET_FOLDERS) {
    if (src.startsWith(folder)) return safeRelative(src.slice(folder.length));
  }
  return false;
}
