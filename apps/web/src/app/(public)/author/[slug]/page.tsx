import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArticleCard } from '@/components/public/ArticleCard';
import { Pagination } from '@/components/public/Pagination';
import { ChevronRight } from 'lucide-react';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

async function getAuthor(slug: string, page = 1) {
  try {
    const res = await fetch(`${API}/api/public/authors/${slug}?page=${page}&pageSize=12`, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await getAuthor(params.slug);
  return { title: data ? `${data.author.displayName} — Author` : 'Author' };
}

export default async function AuthorPage({ params, searchParams }: { params: { slug: string }; searchParams: { page?: string } }) {
  const page = Number(searchParams.page || 1);
  const data = await getAuthor(params.slug, page);
  if (!data) notFound();

  const { author, posts: { data: posts, total, totalPages } } = data;

  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{author.displayName}</span>
      </nav>

      {/* Author profile */}
      <div className="flex items-start gap-6 mb-10 pb-8 border-b border-border">
        {author.avatarUrl ? (
          <Image src={author.avatarUrl} alt={author.displayName} width={80} height={80} className="rounded-full shrink-0 object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-3xl">
            {author.displayName[0]}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-extrabold">{author.displayName}</h1>
          {author.bio && <p className="text-muted-foreground mt-2 leading-relaxed">{author.bio}</p>}
          <p className="text-sm text-muted-foreground mt-2">{total} articles published</p>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No published articles yet.</div>
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
