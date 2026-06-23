import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArticleCard } from '@/components/public/ArticleCard';
import { Pagination } from '@/components/public/Pagination';
import { ChevronRight, Tag } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getTag(slug: string, page = 1) {
  try {
    const res = await fetch(`${API}/api/public/tags/${slug}?page=${page}&pageSize=12`, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await getTag(params.slug);
  return { title: data ? `#${data.tag.name} — Articles` : 'Tag' };
}

export default async function TagPage({ params, searchParams }: { params: { slug: string }; searchParams: { page?: string } }) {
  const page = Number(searchParams.page || 1);
  const data = await getTag(params.slug, page);
  if (!data) notFound();

  const { tag, posts: { data: posts, total, totalPages } } = data;

  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">#{tag.name}</span>
      </nav>

      <header className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold">#{tag.name}</h1>
          {tag.description && <p className="text-muted-foreground mt-0.5">{tag.description}</p>}
          <p className="text-sm text-muted-foreground mt-0.5">{total} articles</p>
        </div>
      </header>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No articles with this tag yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((p: any) => (
            <ArticleCard key={p.id} post={p} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
