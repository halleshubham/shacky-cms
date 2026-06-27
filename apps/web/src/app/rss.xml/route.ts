import { NextResponse } from 'next/server';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function GET() {
  try {
    const [settingsRes, postsRes] = await Promise.all([
      fetch(`${API}/api/public/settings`, { next: { revalidate: 300 } }),
      fetch(`${API}/api/public/posts?pageSize=50`, { next: { revalidate: 60 } }),
    ]);

    const settings = settingsRes.ok ? await settingsRes.json() : {};
    const posts = postsRes.ok ? (await postsRes.json()).data || [] : [];

    const title = settings.site_title || 'Shacky CMS';
    const description = settings.site_description || '';

    const items = posts.map((p: any) => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${SITE}/articles/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/articles/${p.slug}</guid>
      <pubDate>${new Date(p.publishedAt || p.createdAt).toUTCString()}</pubDate>
      ${p.excerpt ? `<description><![CDATA[${p.excerpt}]]></description>` : ''}
      ${p.categories?.[0] ? `<category><![CDATA[${p.categories[0].name}]]></category>` : ''}
      ${p.authors?.[0] ? `<author>${p.authors[0].displayName}</author>` : ''}
      ${p.featuredMedia ? `<enclosure url="${p.featuredMedia.url}" type="image/jpeg" />` : ''}
    </item>`).join('');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title><![CDATA[${title}]]></title>
    <link>${SITE}</link>
    <description><![CDATA[${description}]]></description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

    return new NextResponse(rss, {
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return new NextResponse('Feed unavailable', { status: 500 });
  }
}
