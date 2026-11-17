import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import PublicPageView, { generateMetadata as pageMetadata } from '../pages/[slug]/page';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

async function postExists(slug: string) {
  try {
    const res = await fetch(`${API}/api/public/posts/${slug}`, { next: { revalidate: 3600 } });
    return res.ok;
  } catch {
    return false;
  }
}

// Old WordPress site used flat permalinks (/<slug>/) for both posts and pages. Slugs
// were carried over 1:1 during migration (see wp.slug in apps/api/src/services/wordpress.ts),
// so an unmatched single-segment path is resolved like this:
//   1. a post with that slug  → permanent redirect to /articles/<slug>
//   2. a CMS page with that slug → rendered in place (keeps the clean legacy URL, and
//      is what navigation menu items of type "page" link to: /<slug>)
//   3. otherwise 404 (raised by the page view).
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return pageMetadata({ params });
}

export default async function LegacySlug({ params }: { params: { slug: string } }) {
  if (await postExists(params.slug)) permanentRedirect(`/articles/${params.slug}`);
  return PublicPageView({ params });
}
