// Shared color validation: a colour string is kept as-is when valid.
export function resolveColor(
  ref: string | undefined,
  fallback: string,
): string {
  const s = String(ref ?? '');
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s)) return s;
  // Translucent accents are valid colors too (designs mix them in).
  if (s.startsWith('rgba')) return s;
  return fallback;
}
