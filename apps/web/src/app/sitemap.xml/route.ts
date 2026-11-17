import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { siteUrl } from '@/lib/site-url';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

export async function GET() {
  const SITE = siteUrl(headers());
  try {
    const [postsRes, catsRes, authorsRes, tagsRes, pagesRes] = await Promise.all([
      fetch(`${API}/api/public/posts?pageSize=500`, { next: { revalidate: 300 } }),
      fetch(`${API}/api/public/categories`, { next: { revalidate: 300 } }),
      fetch(`${API}/api/public/authors`, { next: { revalidate: 300 } }),
      fetch(`${API}/api/public/tags`, { next: { revalidate: 300 } }),
      fetch(`${API}/api/public/pages`, { next: { revalidate: 300 } }),
    ]);

    const posts = postsRes.ok ? (await postsRes.json()).data || [] : [];
    const cats = catsRes.ok ? await catsRes.json() : [];
    const authors = authorsRes.ok ? await authorsRes.json() : [];
    const tags = tagsRes.ok ? await tagsRes.json() : [];
    const pages = pagesRes.ok ? await pagesRes.json() : [];

    const url = (loc: string, lastmod?: string, priority = '0.7') =>
      `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod.split('T')[0]}</lastmod>` : ''}<priority>${priority}</priority></url>`;

    // CMS pages live at /<slug> (non-ASCII slugs must be percent-encoded in a sitemap)
    const pageUrls = (Array.isArray(pages) ? pages : []).map((p: any) => url(`${SITE}/${encodeURIComponent(p.slug)}`, p.updatedAt, '0.8'));
    const postUrls = posts.map((p: any) => url(`${SITE}/articles/${p.slug}`, p.updatedAt, '0.8'));
    const catUrls = cats.map((c: any) => url(`${SITE}/category/${c.slug}`));
    const authorUrls = authors.map((a: any) => url(`${SITE}/author/${a.slug}`, undefined, '0.5'));
    const tagUrls = tags.filter((t: any) => t.postCount > 0).map((t: any) => url(`${SITE}/tag/${t.slug}`, undefined, '0.5'));

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${url(SITE, undefined, '1.0')}
  ${url(`${SITE}/issues`, undefined, '0.8')}
  ${pageUrls.join('\n  ')}
  ${postUrls.join('\n  ')}
  ${catUrls.join('\n  ')}
  ${authorUrls.join('\n  ')}
  ${tagUrls.join('\n  ')}
</urlset>`;

    return new NextResponse(sitemap, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return new NextResponse('Sitemap unavailable', { status: 500 });
  }
}
