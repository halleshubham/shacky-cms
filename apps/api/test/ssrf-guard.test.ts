import { describe, it, expect, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (hostname: string) => {
    if (hostname === 'internal.example.test') return [{ address: '10.0.0.5', family: 4 }];
    if (hostname === 'metadata.rebind.test') return [{ address: '169.254.169.254', family: 4 }];
    if (hostname === 'public.example.test') return [{ address: '93.184.216.34', family: 4 }];
    if (hostname === 'nowhere.invalid') throw new Error('ENOTFOUND');
    return [{ address: '93.184.216.34', family: 4 }];
  }),
}));

import { assertSafeExternalUrl, BlockedTargetError } from '../src/utils/ssrfGuard';

// Regression coverage: webhooks.ts, wordpress.ts (including image URLs
// embedded in imported content), forms.ts's form-webhook, and botsab.ts all
// let an admin-configured (or, for wordpress's image rewriter, content-
// embedded) URL be fetched server-side with no restriction — a live SSRF
// primitive that could reach internal services or cloud metadata.
describe('assertSafeExternalUrl', () => {
  it('rejects a literal private IPv4 address', async () => {
    await expect(assertSafeExternalUrl('http://10.0.0.5/hook')).rejects.toThrow(BlockedTargetError);
    await expect(assertSafeExternalUrl('http://192.168.1.1/hook')).rejects.toThrow(BlockedTargetError);
    await expect(assertSafeExternalUrl('http://172.16.0.1/hook')).rejects.toThrow(BlockedTargetError);
  });

  it('rejects loopback and the cloud metadata address', async () => {
    await expect(assertSafeExternalUrl('http://127.0.0.1/hook')).rejects.toThrow(BlockedTargetError);
    await expect(assertSafeExternalUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(BlockedTargetError);
  });

  it('rejects IPv6 loopback and unique-local addresses', async () => {
    await expect(assertSafeExternalUrl('http://[::1]/hook')).rejects.toThrow(BlockedTargetError);
    await expect(assertSafeExternalUrl('http://[fd00::1]/hook')).rejects.toThrow(BlockedTargetError);
  });

  it('rejects a hostname that resolves to a private address', async () => {
    await expect(assertSafeExternalUrl('http://internal.example.test/hook')).rejects.toThrow(BlockedTargetError);
  });

  it('rejects a hostname that resolves to the cloud metadata address (the DNS-rebinding case)', async () => {
    await expect(assertSafeExternalUrl('http://metadata.rebind.test/hook')).rejects.toThrow(BlockedTargetError);
  });

  it('rejects non-http(s) schemes', async () => {
    await expect(assertSafeExternalUrl('file:///etc/passwd')).rejects.toThrow(BlockedTargetError);
    await expect(assertSafeExternalUrl('ftp://public.example.test/x')).rejects.toThrow(BlockedTargetError);
  });

  it('rejects an unresolvable host rather than letting it through', async () => {
    await expect(assertSafeExternalUrl('http://nowhere.invalid/hook')).rejects.toThrow(BlockedTargetError);
  });

  it('allows an ordinary public hostname', async () => {
    await expect(assertSafeExternalUrl('https://public.example.test/webhook')).resolves.toBeUndefined();
  });

  it('allows an ordinary public literal IP', async () => {
    await expect(assertSafeExternalUrl('http://93.184.216.34/hook')).resolves.toBeUndefined();
  });
});
