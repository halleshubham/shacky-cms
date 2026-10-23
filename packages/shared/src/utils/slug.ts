export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    // keep letters, combining marks (needed for Devanagari etc.), digits, underscore, hyphen
    .replace(/[^\p{L}\p{M}\p{N}_\-]+/gu, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}
