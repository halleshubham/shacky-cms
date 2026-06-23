import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function GET() {
  try {
    const [postsRes, catsRes, authorsRes, tagsRes] = await Promise.all([
      fetch(`${API}/api/public/posts?pageSize=500`, { next: { revalidate: 300 } }),
      fetch(`${API}/api/public/categories`, { next: { revalidate: 300 } }),
      fetch(`${API}/api/public/authors`, { next: { revalidate: 300 } }),
      fetch(`${API}/api/public/tags`, { next: { revalidate: 300 } }),
    ]);

    const posts = postsRes.ok ? (await postsRes.json()).data || [] : [];
    const cats = catsRes.ok ? await catsRes.json() : [];
    const authors = authorsRes.ok ? await authorsRes.json() : [];
    const tags = tagsRes.ok ? await tagsRes.json() : [];

    const url = (loc: string, lastmod?: string, priority = '0.7') =>
      `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod.split('T')[0]}</lastmod>` : ''}<priority>${priority}</priority></url>`;

    const postUrls = posts.map((p: any) => url(`${SITE}/articles/${p.slug}`, p.updatedAt, '0.8'));
    const catUrls = cats.map((c: any) => url(`${SITE}/category/${c.slug}`));
    const authorUrls = authors.map((a: any) => url(`${SITE}/author/${a.slug}`, undefined, '0.5'));
    const tagUrls = tags.filter((t: any) => t.postCount > 0).map((t: any) => url(`${SITE}/tag/${t.slug}`, undefined, '0.5'));

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${url(SITE, undefined, '1.0')}
  ${url(`${SITE}/issues`, undefined, '0.8')}
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
