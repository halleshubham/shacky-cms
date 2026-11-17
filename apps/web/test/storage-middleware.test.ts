import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from '@/middleware';

const req = (method: string, path: string) => new NextRequest(`https://site.test${path}`, { method });

describe('storage proxy middleware', () => {
  it.each(['PUT', 'POST', 'DELETE', 'PATCH'])('rejects %s on /s3 and legacy uploads', (m) => {
    for (const p of ['/s3/media/x.jpg', '/s3', '/wp-content/uploads/2025/a.pdf', '/books/x.pdf', '/pamphlets/y.pdf']) {
      const res = middleware(req(m, p));
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
    }
  });

  it('lets reads through for objects', () => {
    for (const p of ['/s3/media/x.jpg', '/wp-content/uploads/2025/a.pdf']) {
      for (const m of ['GET', 'HEAD']) expect(middleware(req(m, p)).status).toBe(200);
    }
  });

  it('hides the bucket listing', () => {
    expect(middleware(req('GET', '/s3')).status).toBe(404);
    expect(middleware(req('GET', '/s3/')).status).toBe(404);
  });

  it('only runs on the storage paths', () => {
    expect(config.matcher).toEqual([
      '/s3', '/s3/:path*', '/wp-content/uploads/:path*', '/books/:path*', '/pamphlets/:path*', '/social-media-logos/:path*',
    ]);
  });
});
