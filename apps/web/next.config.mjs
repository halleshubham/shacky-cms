import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Required for pnpm monorepo standalone builds — traces files from repo root.
    // This Next.js version (14.2.x) still only recognizes it nested under
    // `experimental` — it was a top-level key here, which Next.js was
    // silently ignoring (and warning about) rather than applying.
    outputFileTracingRoot: path.join(__dirname, '../../'),
    // Limit parallel static-page workers so constrained build hosts don't OOM
    cpus: 1,
    // DALL-E 3 and large-batch AI ingest can take >30s; default proxy timeout is 30000
    proxyTimeout: 120000,
  },

  // Proxy /api/* through Next.js so browser cookies are always same-origin.
  // Proxy /s3/* to MinIO so images work from both browser and Next.js server
  // in Docker (MINIO_INTERNAL_URL=http://minio:9000 set in docker-compose).
  // URLs a migrated WordPress site is already known by in search engines and feed readers.
  async redirects() {
    return [
      { source: '/sitemap_index.xml', destination: '/sitemap.xml', permanent: true },
      { source: '/feed', destination: '/rss.xml', permanent: true },
    ];
  },

  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || 'http://localhost:4000';
    const minioUrl = process.env.MINIO_INTERNAL_URL || 'http://localhost:9000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/s3/:path*',
        destination: `${minioUrl}/shacky-media/:path*`,
      },
      // Files imported from WordPress keep their original URLs (/wp-content/uploads/…),
      // so links already shared in print and on WhatsApp keep working.
      {
        source: '/wp-content/uploads/:path*',
        destination: `${minioUrl}/shacky-media/media/wp-content/uploads/:path*`,
      },
      // MCP + OAuth2 token endpoints proxied to the API.
      // /oauth/authorize is intentionally excluded — that's the Next.js consent page.
      {
        source: '/mcp',
        destination: `${apiUrl}/mcp`,
      },
      {
        source: '/oauth/token',
        destination: `${apiUrl}/oauth/token`,
      },
      {
        source: '/oauth/register',
        destination: `${apiUrl}/oauth/register`,
      },
      {
        source: '/oauth/revoke',
        destination: `${apiUrl}/oauth/revoke`,
      },
      {
        source: '/.well-known/:path*',
        destination: `${apiUrl}/.well-known/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      // Direct MinIO (local dev)
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/shacky-media/**',
      },
      // MinIO via Next.js /s3/ proxy (Docker — S3_PUBLIC_URL=http://host:3000/s3)
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/s3/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // A practical first-layer CSP, not a nonce-based strict one — that
          // would need a nonce-generating middleware and testing every
          // existing embed, which is a larger separate effort. script-src
          // keeps 'unsafe-inline'/'unsafe-eval' because Next.js's own
          // hydration bootstrap needs them, AND because codeInjectionHead/
          // Foot is an existing, intentional admin-only (superadmin/editor)
          // "paste arbitrary tracking/embed HTML" feature — this still
          // meaningfully restricts the actual gap server-side sanitization
          // doesn't cover: script-src/connect-src can no longer point at an
          // attacker's own domain, which is what turns a stored-XSS payload
          // into exfiltration or a remote-script payload in the first place.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com",
              "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
