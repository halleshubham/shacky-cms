/**
 * "Download gate": before a visitor downloads a document (PDF, Word, PowerPoint …) the site can ask for name, mobile
 * and email once per browser. Opt-in: nothing happens unless the site setting `download_gate_form` names a CMS form.
 * This file holds the pure logic (which links are gated, validation, remembering the visitor) so it can be tested.
 */

/** Document types that are gated. Images, audio/video and web pages are never gated. */
export const GATED_EXT = /\.(pdf|docx?|pptx?|xlsx?|odt|ods|odp|zip|epub)$/i;

export interface GatedFile {
  /** Absolute URL of the file. */
  url: string;
  /** File name for display, e.g. "pamphlet-black-is-beautiful.pdf". */
  name: string;
}

/** The document a link points to, when it is a gated type hosted on this site; otherwise null. */
export function gatedFileFromHref(href: string | null | undefined, pageOrigin: string): GatedFile | null {
  if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return null;
  let u: URL;
  try { u = new URL(href, pageOrigin); } catch { return null; }
  if (u.origin !== pageOrigin) return null;          // only files this site hosts
  let path = u.pathname;
  try { path = decodeURIComponent(path); } catch { /* keep encoded */ }
  if (!GATED_EXT.test(path)) return null;
  return { url: u.href, name: path.split('/').filter(Boolean).pop() || path };
}

export interface LeadInput { name: string; mobile: string; email: string; consent: boolean }
export type LeadErrors = Partial<Record<keyof LeadInput, string>>;

/**
 * Canonical mobile number, or null if it is not one.
 * Indian mobiles (10 digits starting 6–9, optionally with +91 / 91 / 0 in front) become "+91XXXXXXXXXX";
 * other countries are accepted only with an explicit "+" and 8–15 digits.
 */
export function normaliseMobile(raw: string): string | null {
  const s = raw.trim();
  const international = s.startsWith('+');
  let d = s.replace(/[^\d]/g, '');
  if (!d) return null;
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (international && d.length >= 8 && d.length <= 15 && !s.startsWith('+91')) return `+${d}`;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateLead(v: LeadInput): LeadErrors {
  const e: LeadErrors = {};
  if (v.name.trim().length < 2) e.name = 'required';
  if (!normaliseMobile(v.mobile)) e.mobile = 'invalid';
  if (!EMAIL.test(v.email.trim())) e.email = 'invalid';
  if (!v.consent) e.consent = 'required';
  return e;
}

// ── remembering the visitor (per browser) ───────────────────────────────────────

export const storageKey = (formSlug: string) => `dlgate:v1:${formSlug}`;

export interface StoredLead { name: string; mobile: string; email: string; at: string }

/** True once this browser has already given its details for this form. Never throws (private mode, blocked storage). */
export function hasLead(formSlug: string, storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    const s = storage ?? window.localStorage;
    const raw = s.getItem(storageKey(formSlug));
    if (!raw) return false;
    const v = JSON.parse(raw) as Partial<StoredLead>;
    return !!(v && v.email && v.mobile);
  } catch { return false; }
}

export function rememberLead(formSlug: string, lead: StoredLead, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    (storage ?? window.localStorage).setItem(storageKey(formSlug), JSON.stringify(lead));
    return true;
  } catch { return false; }
}
