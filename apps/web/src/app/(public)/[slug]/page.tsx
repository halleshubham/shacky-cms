import { permanentRedirect, notFound } from 'next/navigation';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

async function postExists(slug: string) {
  try {
    const res = await fetch(`${API}/api/public/posts/${slug}`, { next: { revalidate: 3600 } });
    return res.ok;
  } catch {
    return false;
  }
}

// Old WordPress site used flat permalinks (/<slug>/) instead of /articles/<slug>.
// Post slugs were carried over 1:1 during migration (see wp.slug in
// apps/api/src/services/wordpress.ts), so any unmatched single-segment path
// is checked against post slugs and permanently redirected to keep old
// links, bookmarks, and search rankings working.
export default async function LegacySlugRedirect({ params }: { params: { slug: string } }) {
  if (!(await postExists(params.slug))) notFound();
  permanentRedirect(`/articles/${params.slug}`);
}
