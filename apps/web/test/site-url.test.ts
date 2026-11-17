import { describe, it, expect, afterEach } from 'vitest';
import { siteUrl } from '@/lib/site-url';

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe('siteUrl', () => {
  it('prefers the runtime SITE_URL and trims trailing slashes', () => {
    process.env.SITE_URL = 'https://samvidhanjagar.org/';
    expect(siteUrl(h({ host: 'internal:3000' }))).toBe('https://samvidhanjagar.org');
  });
  it('ignores a localhost NEXT_PUBLIC_SITE_URL and uses the forwarded host', () => {
    delete process.env.SITE_URL; process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
    expect(siteUrl(h({ 'x-forwarded-host': 'example.org', 'x-forwarded-proto': 'https' }))).toBe('https://example.org');
  });
  it('defaults to https for real hosts and http for localhost', () => {
    delete process.env.SITE_URL; delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl(h({ host: 'example.org' }))).toBe('https://example.org');
    expect(siteUrl(h({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
  });
  it('rejects a malformed host header and falls back to localhost', () => {
    delete process.env.SITE_URL; delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl(h({ host: 'evil.com/<script>' }))).toBe('http://localhost:3000');
  });
});
