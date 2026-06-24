import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
