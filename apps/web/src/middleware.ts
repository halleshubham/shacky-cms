import { NextResponse, type NextRequest } from 'next/server';

/**
 * /s3/* and /wp-content/uploads/* are rewrites to the object-storage gateway (see
 * next.config.mjs). The gateway accepts unauthenticated requests, so without this the
 * public could create buckets and upload, overwrite or delete media straight through the
 * website. All legitimate writes go through the authenticated API (server → storage over
 * the internal network), so the public side only needs to read.
 */
const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

export function middleware(req: NextRequest) {
  if (!READ_ONLY.has(req.method)) {
    return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS' } });
  }
  // The bucket root would return an anonymous listing of every stored object.
  const { pathname } = req.nextUrl;
  if (pathname === '/s3' || pathname === '/s3/') {
    return new NextResponse('Not Found', { status: 404 });
  }
  return NextResponse.next();
}

// Keep in sync with LEGACY_STATIC_DIRS in next.config.mjs.
export const config = {
  matcher: ['/s3', '/s3/:path*', '/wp-content/uploads/:path*', '/books/:path*', '/pamphlets/:path*', '/social-media-logos/:path*'],
};
