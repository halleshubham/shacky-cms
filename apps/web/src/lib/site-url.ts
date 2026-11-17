/**
 * Canonical public origin of this site, used in sitemap.xml, rss.xml and robots.txt.
 *
 * Order: SITE_URL (runtime env, set from APP_URL in the Coolify compose) →
 * NEXT_PUBLIC_SITE_URL (build-time, if it isn't a localhost default) → the request's
 * forwarded host → http://localhost:3000. The old code only read the build-time variable,
 * which is never set in the Docker image, so every sitemap/feed pointed at localhost.
 */
type HeaderReader = { get(name: string): string | null };

const isLocal = (u: string) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0)/i.test(u);

export function siteUrl(h?: HeaderReader | null): string {
  const strip = (u: string) => u.trim().replace(/\/+$/, '');
  const fromEnv = [process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL]
    .map((v) => strip(v || ''))
    .find((v) => v && !isLocal(v));
  if (fromEnv) return fromEnv;

  const host = (h?.get('x-forwarded-host') || h?.get('host') || '').split(',')[0].trim();
  if (host && /^[A-Za-z0-9.-]+(:\d+)?$/.test(host)) {
    const proto = (h?.get('x-forwarded-proto') || '').split(',')[0].trim() || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return strip(process.env.NEXT_PUBLIC_SITE_URL || '') || 'http://localhost:3000';
}
