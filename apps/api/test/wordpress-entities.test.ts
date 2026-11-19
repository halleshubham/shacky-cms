import { describe, it, expect } from 'vitest';
import { decodeEntities } from '../src/services/wordpress';

describe('decodeEntities', () => {
  it('still decodes the entities the old hand-rolled list covered', () => {
    expect(decodeEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeEntities('&lt;b&gt;bold&lt;/b&gt;')).toBe('<b>bold</b>');
    expect(decodeEntities('&quot;quoted&quot;')).toBe('"quoted"');
    expect(decodeEntities('It&apos;s')).toBe("It's");
    expect(decodeEntities('a&nbsp;b')).toBe('a b');
    expect(decodeEntities('2020&ndash;2021')).toBe('2020–2021');
    expect(decodeEntities('note &mdash; aside')).toBe('note — aside');
    expect(decodeEntities('&lsquo;quoted&rsquo;')).toBe('‘quoted’');
    expect(decodeEntities('&ldquo;quoted&rdquo;')).toBe('“quoted”');
  });

  it('decodes numeric and hex character references', () => {
    expect(decodeEntities('&#65;&#66;&#67;')).toBe('ABC');
    expect(decodeEntities('&#x41;&#x42;&#x43;')).toBe('ABC');
  });

  it('decodes the named entities the old list was missing (the actual bug)', () => {
    expect(decodeEntities('Read more&hellip;')).toBe('Read more…');
    expect(decodeEntities('&copy; 2026 Shacky')).toBe('© 2026 Shacky');
    expect(decodeEntities('45&deg;C')).toBe('45°C');
    expect(decodeEntities('caf&eacute;')).toBe('café');
    expect(decodeEntities('Shacky&trade;')).toBe('Shacky™');
    expect(decodeEntities('1&frac12; cups')).toBe('1½ cups');
  });

  it('leaves plain text with no entities untouched', () => {
    expect(decodeEntities('Plain headline, no entities.')).toBe('Plain headline, no entities.');
  });
});
