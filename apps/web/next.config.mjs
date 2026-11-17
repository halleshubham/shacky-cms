import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Top-level folders served from imported legacy files (media/legacy-root/<dir>/…). Public paths
// that proxy to object storage must also be listed in src/middleware.ts so they stay read-only.
const LEGACY_STATIC_DIRS = ['books', 'pamphlets', 'social-media-logos'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Required for pnpm monorepo standalone builds — traces files from repo root
  outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
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
      // WordPress post permalinks were /<year>/<slug>/
      { source: '/:year(\\d{4})/:slug', destination: '/articles/:slug', permanent: true },
      // Child pages on WordPress sites lived under their parent's path (e.g. /media/c-videos)
      { source: '/media/:slug', destination: '/:slug', permanent: true },
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
      // Files that sat loose in an old site's web root (see LEGACY_STATIC_DIRS) keep their URLs too.
      ...LEGACY_STATIC_DIRS.map((dir) => ({
        source: `/${dir}/:path+`, // :path+ so a page at the bare /${dir} (e.g. /pamphlets) is not swallowed
        destination: `${minioUrl}/shacky-media/media/legacy-root/${dir}/:path*`,
      })),
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
        protocol: 'http',
        hostname: '192.168.1.12',
        port: '9000',
        pathname: '/shacky-media/**',
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
        ],
      },
    ];
  },
};

export default nextConfig;
