import { headers } from 'next/headers';
import { siteUrl } from '@/lib/site-url';

// Uploaded files (/wp-content/uploads, /s3) and all public pages stay crawlable.
export async function GET() {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /login',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl(await headers())}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
