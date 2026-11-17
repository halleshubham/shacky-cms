import { describe, it, expect } from 'vitest';
import { uiStrings } from '@/lib/ui-strings';

describe('uiStrings', () => {
  it('returns English by default and for unknown languages', () => {
    expect(uiStrings().home).toBe('Home');
    expect(uiStrings('fr').home).toBe('Home');
  });

  it('resolves Marathi and Hindi, including regional subtags and case', () => {
    expect(uiStrings('mr').followUs).toBe('आम्हाला फॉलो करा');
    expect(uiStrings('MR-IN').followUs).toBe('आम्हाला फॉलो करा');
    expect(uiStrings('hi').home).toBe('मुख्य पृष्ठ');
  });

  it('defines every key in every language (no silent English fallbacks)', () => {
    const en = Object.keys(uiStrings('en'));
    for (const lang of ['mr', 'hi']) expect(Object.keys(uiStrings(lang))).toEqual(en);
  });
});
