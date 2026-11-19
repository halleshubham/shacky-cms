import { describe, it, expect } from 'vitest';
import { gatedFileFromHref, normaliseMobile, validateLead, hasLead, rememberLead, storageKey } from '../src/lib/download-gate';

const ORIGIN = 'https://lokayat.example.org';

describe('gatedFileFromHref', () => {
  it('gates documents hosted on the site, relative or absolute', () => {
    expect(gatedFileFromHref('/books/fdi_eng_3ed.pdf', ORIGIN)).toEqual({ url: `${ORIGIN}/books/fdi_eng_3ed.pdf`, name: 'fdi_eng_3ed.pdf' });
    expect(gatedFileFromHref(`${ORIGIN}/wp-content/uploads/2020/a.DOCX`, ORIGIN)?.name).toBe('a.DOCX');
    for (const ext of ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'epub']) {
      expect(gatedFileFromHref(`/f/x.${ext}`, ORIGIN)).not.toBeNull();
    }
  });
  it('decodes Devanagari file names for display', () => {
    const f = gatedFileFromHref('/wp-content/uploads/2025/11/%E0%A4%AA%E0%A4%A4%E0%A5%8D%E0%A4%B0%E0%A4%95.pdf', ORIGIN);
    expect(f?.name).toBe('पत्रक.pdf');
  });
  it('ignores everything that is not a document on this site', () => {
    for (const h of ['/articles/x', '/', '#top', 'mailto:a@b.co', 'tel:+919000000000', 'javascript:void(0)', '/img/cover.jpg', '/media/talk.mp4', '/a.pdf.html',
                     'https://other.org/x.pdf', '//cdn.example.com/x.pdf', '', null, undefined]) {
      expect(gatedFileFromHref(h as string, ORIGIN)).toBeNull();
    }
  });
  it('ignores the query string when deciding the type', () => {
    expect(gatedFileFromHref('/x.pdf?download=1', ORIGIN)).not.toBeNull();
    expect(gatedFileFromHref('/page?file=x.pdf', ORIGIN)).toBeNull();
  });
});

describe('normaliseMobile', () => {
  it('accepts Indian mobiles in common spellings', () => {
    for (const m of ['9876543210', '98765 43210', '+91 98765-43210', '919876543210', '09876543210', '(98765) 43210']) expect(normaliseMobile(m)).toBe('+919876543210');
  });
  it('rejects landlines, short numbers and junk', () => {
    for (const m of ['', '12345', '5876543210', '98765432', '98765432101234', 'abcdefghij', '000000000']) expect(normaliseMobile(m)).toBeNull();
  });
  it('accepts other countries only with an explicit +', () => {
    expect(normaliseMobile('+44 7911 123456')).toBe('+447911123456');
    expect(normaliseMobile('447911123456')).toBeNull();
    expect(normaliseMobile('+91 12345 67890')).toBeNull();   // +91 must be a valid Indian mobile
  });
});

describe('validateLead', () => {
  const ok = { name: 'Asha Patil', mobile: '9876543210', email: 'asha@example.org', consent: true };
  it('passes a complete entry', () => expect(validateLead(ok)).toEqual({}));
  it('flags each bad field', () => {
    expect(Object.keys(validateLead({ name: ' ', mobile: '1', email: 'x', consent: false })).sort()).toEqual(['consent', 'email', 'mobile', 'name']);
    expect(validateLead({ ...ok, email: 'a@b' }).email).toBe('invalid');
    expect(validateLead({ ...ok, email: ' asha@example.org ' })).toEqual({});
    expect(validateLead({ ...ok, consent: false }).consent).toBe('required');
  });
});

describe('remembering the visitor', () => {
  const mem = () => { const d: Record<string, string> = {}; return { getItem: (k: string) => d[k] ?? null, setItem: (k: string, v: string) => { d[k] = v; }, d }; };
  it('asks once: false before, true after, per form', () => {
    const s = mem();
    expect(hasLead('download-access', s)).toBe(false);
    expect(rememberLead('download-access', { name: 'A', mobile: '+919876543210', email: 'a@b.co', at: '2026-11-19' }, s)).toBe(true);
    expect(hasLead('download-access', s)).toBe(true);
    expect(hasLead('another-form', s)).toBe(false);
    expect(Object.keys(s.d)).toEqual([storageKey('download-access')]);
  });
  it('treats corrupt or incomplete data as "not yet"', () => {
    const s = mem(); s.d[storageKey('f')] = '{not json'; expect(hasLead('f', s)).toBe(false);
    s.d[storageKey('f')] = JSON.stringify({ name: 'x' }); expect(hasLead('f', s)).toBe(false);
  });
  it('never throws when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(hasLead('f', blocked)).toBe(false);
    expect(rememberLead('f', { name: 'A', mobile: '+919876543210', email: 'a@b.co', at: 'x' }, blocked)).toBe(false);
  });
});
