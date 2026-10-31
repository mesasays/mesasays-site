// Only web links are rendered as links. Anything else found in the data
// (a typo, an odd scheme) is dropped at render time rather than trusted.

export function isPublicUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function publicUrl(value: string | null | undefined): string | null {
  return isPublicUrl(value) ? value : null;
}
