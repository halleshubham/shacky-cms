import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

async function getPage(slug: string) {
  try {
    const res = await fetch(`${API}/api/public/pages/${slug}`, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page) return { title: 'Not Found' };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.excerpt,
  };
}

export default async function PublicPage({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page) notFound();

  return (
    <div className="max-w-3xl mx-auto">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate">{page.title}</span>
      </nav>

      <article>
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">{page.title}</h1>
          {page.excerpt && (
            <p className="text-lg text-muted-foreground leading-relaxed">{page.excerpt}</p>
          )}
        </header>

        {page.featuredMedia && (
          <div className="relative aspect-video mb-8 rounded-lg overflow-hidden">
            <Image
              src={page.featuredMedia.url}
              alt={page.featuredMedia.altText || page.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div
          className="prose prose-neutral dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content || '' }}
        />
      </article>
    </div>
  );
}
