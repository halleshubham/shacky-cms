import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArticleCard } from '@/components/public/ArticleCard';
import { Pagination } from '@/components/public/Pagination';
import { ChevronRight } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getCategory(slug: string) {
  try {
    const res = await fetch(`${API}/api/public/categories`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const cats: any[] = await res.json();
    return cats.find((c) => c.slug === slug) || null;
  } catch { return null; }
}

async function getPosts(slug: string, page = 1) {
  try {
    const res = await fetch(`${API}/api/public/posts?categorySlug=${slug}&page=${page}&pageSize=12`, { next: { revalidate: 60 } });
    if (!res.ok) return { data: [], total: 0, totalPages: 0 };
    return res.json();
  } catch { return { data: [], total: 0, totalPages: 0 }; }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const cat = await getCategory(params.slug);
  return { title: cat ? `${cat.name} — Articles` : 'Category' };
}

export default async function CategoryPage({ params, searchParams }: { params: { slug: string }; searchParams: { page?: string } }) {
  const page = Number(searchParams.page || 1);
  const [cat, { data: posts, total, totalPages }] = await Promise.all([
    getCategory(params.slug),
    getPosts(params.slug, page),
  ]);

  if (!cat) notFound();

  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{cat.name}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold">{cat.name}</h1>
        {cat.description && <p className="text-muted-foreground mt-1">{cat.description}</p>}
        <p className="text-sm text-muted-foreground mt-1">{total} articles</p>
      </header>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No articles in this category yet.</div>
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
