import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { format } from 'date-fns';
import { ArticleCard } from '@/components/public/ArticleCard';
import { ChevronRight, Clock, Star } from 'lucide-react';
import { ViewTracker } from './ViewTracker';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getPost(slug: string) {
  try {
    const res = await fetch(`${API}/api/public/posts/${slug}`, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) return { title: 'Not Found' };
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const authors = post.authors || [];
  const categories = post.categories || [];
  const tags = post.tags || [];
  const related = post.related || [];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {categories[0] && (
          <>
            <Link href={`/category/${categories[0].slug}`} className="hover:text-foreground">{categories[0].name}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground font-medium truncate">{post.title}</span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {categories.map((c: any) => (
              <Link key={c.id} href={`/category/${c.slug}`}
                className="text-xs font-semibold text-primary uppercase tracking-wider hover:underline">
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mb-4">{post.title}</h1>

        {post.excerpt && (
          <p className="text-lg text-muted-foreground leading-relaxed mb-4">{post.excerpt}</p>
        )}

        <ViewTracker postId={post.id} />
        <div className="flex items-center gap-4 text-sm text-muted-foreground border-y border-border py-3">
          <div className="flex items-center gap-2">
            {authors.map((a: any, i: number) => (
              <span key={a.id}>
                <Link href={`/author/${a.slug}`} className="font-medium text-foreground hover:text-primary transition-colors">
                  {a.displayName}
                </Link>
                {i < authors.length - 1 && ', '}
              </span>
            ))}
          </div>
          {post.publishedAt && <span>{format(new Date(post.publishedAt), 'MMMM d, yyyy')}</span>}
          {post.readingTime && (
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {post.readingTime} min read</span>
          )}
          {post.isFeatured && (
            <span className="flex items-center gap-1 text-amber-500"><Star className="h-3.5 w-3.5 fill-current" /> Featured</span>
          )}
          {post.issue && (
            <Link href={`/issues/${post.issue.id}`} className="hover:text-foreground transition-colors">
              Vol. {post.issue.volumeNumber}, No. {post.issue.issueNumber}
            </Link>
          )}
        </div>
      </header>

      {/* Featured image */}
      {post.featuredMedia && (
        <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-8 bg-muted">
          <Image
            src={post.featuredMedia.url}
            alt={post.featuredMedia.altText || post.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Article body */}
      <div
        className="prose prose-neutral dark:prose-invert max-w-none
          prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl
          prose-p:leading-relaxed prose-p:text-base
          prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-img:rounded-lg"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
          {tags.map((t: any) => (
            <span key={t.id} className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full">
              #{t.name}
            </span>
          ))}
        </div>
      )}

      {/* Authors bio */}
      {authors.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border space-y-4">
          {authors.map((a: any) => (
            <Link key={a.id} href={`/author/${a.slug}`} className="flex items-start gap-4 group">
              {a.avatarUrl ? (
                <Image src={a.avatarUrl} alt={a.displayName} width={48} height={48} className="rounded-full shrink-0 object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-lg">
                  {a.displayName[0]}
                </div>
              )}
              <div>
                <p className="font-semibold group-hover:text-primary transition-colors">{a.displayName}</p>
                {a.bio && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{a.bio}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Per-post code injection */}
      {post.codeInjectionHead && <Script id="post-head" strategy="afterInteractive">{post.codeInjectionHead}</Script>}
      {post.codeInjectionFoot && <Script id="post-foot" strategy="lazyOnload">{post.codeInjectionFoot}</Script>}

      {/* Related articles */}
      {related.length > 0 && (
        <section className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-bold mb-6">Related Articles</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {related.map((p: any) => (
              <ArticleCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
