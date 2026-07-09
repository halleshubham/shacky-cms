import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

async function getPage(slug: string) {
  try {
    const res = await fetch(`${API}/api/public/pages/${slug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await getPage(params.slug);
  if (!page) return {};
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.excerpt || undefined,
  };
}

export default async function PublicPageView({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page) notFound();

  return (
    <article className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">{page.title}</h1>
      {page.excerpt && (
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{page.excerpt}</p>
      )}
      <div
        className="prose prose-neutral dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </article>
  );
}
