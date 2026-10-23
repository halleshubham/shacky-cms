const INDEPENDENT_VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e',
};

const MATRAS: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e',
};

const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ळ': 'l', 'क्ष': 'ksh', 'ज्ञ': 'dny',
};

const SIGNS: Record<string, string> = { 'ं': 'n', 'ँ': 'n', 'ः': 'h' };
const DIGITS = '०१२३४५६७८९';
const VIRAMA = '्';
const NUKTA = '़';

/** Transliterate Devanagari (Marathi/Hindi/Sanskrit) to ASCII; other characters pass through. */
export function transliterateDevanagari(input: string): string {
  const chars = Array.from(input.normalize('NFC'));
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (INDEPENDENT_VOWELS[ch] !== undefined) { out += INDEPENDENT_VOWELS[ch]; continue; }
    if (SIGNS[ch] !== undefined) { out += SIGNS[ch]; continue; }
    const digit = DIGITS.indexOf(ch);
    if (digit >= 0) { out += String(digit); continue; }
    if (CONSONANTS[ch] === undefined) {
      if (ch === VIRAMA || ch === NUKTA) continue;
      out += ch;
      continue;
    }
    out += CONSONANTS[ch];
    if (chars[i + 1] === NUKTA) i++;
    const next = chars[i + 1];
    if (next === VIRAMA) { i++; continue; }
    if (next !== undefined && MATRAS[next] !== undefined) { out += MATRAS[next]; i++; continue; }
    // Inherent 'a'; dropped at word end (schwa deletion).
    const following = chars[i + 1];
    const atWordEnd = following === undefined || !/[ऀ-ॿ]/.test(following);
    if (!atWordEnd) out += 'a';
  }
  return out;
}

export function slugify(text: string): string {
  return transliterateDevanagari(text.toString())
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    // keep letters, combining marks, digits, underscore, hyphen (other scripts are left as-is)
    .replace(/[^\p{L}\p{M}\p{N}_\-]+/gu, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}
