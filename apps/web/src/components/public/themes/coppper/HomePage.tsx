'use client';
import Link from 'next/link';
import Image from 'next/image';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { ThemeHomeProps } from '@/lib/theme-types';

export function CoppperHomePage({ hero, gridPosts, listPosts, issue }: ThemeHomeProps) {
  return (
    <div className="space-y-12 mt-8">
      {issue && (
        <section className="bg-card rounded-lg px-6 py-4 text-center border border-border">
          <p className="text-foreground text-sm">
            Current Issue: <strong>{issue.title}</strong> — Vol. {issue.volumeNumber}, No. {issue.issueNumber}
          </p>
          <p className="text-muted-foreground text-xs mt-1">{format(new Date(issue.publishDate), 'MMMM d, yyyy')}</p>
          <Link href={`/issues/${issue.id}`} className="mt-2 inline-flex items-center gap-1 text-primary hover:text-primary/80 text-sm font-medium transition-colors">
            View Issue <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      {hero ? (
        <section className="bg-card shadow-sm rounded-xl overflow-hidden border border-border">
          {hero.featuredMedia?.url && (
            <div className="relative aspect-[16/7] w-full overflow-hidden">
              <Image
                src={hero.featuredMedia.url}
                alt={hero.featuredMedia.altText || hero.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          <div className="p-6 md:p-8">
            {hero.isFeatured && (
              <span className="inline-block bg-primary text-primary-foreground py-0.5 px-3 rounded text-xs font-semibold mb-3 uppercase tracking-wide">Featured</span>
            )}
            <h1 className="font-serif text-3xl md:text-5xl mb-4 text-foreground leading-tight">{hero.title}</h1>
            {hero.excerpt && <p className="text-muted-foreground text-lg mb-4 leading-relaxed">{hero.excerpt}</p>}
            <div className="text-sm text-muted-foreground mb-4 flex flex-wrap gap-x-3">
              {hero.authors?.length ? <span>{hero.authors.map(a => a.displayName).join(', ')}</span> : null}
              {hero.publishedAt && <span>{format(new Date(hero.publishedAt), 'MMMM d, yyyy')}</span>}
              {hero.readingTime && <span>{hero.readingTime} min read</span>}
            </div>
            <Link href={`/articles/${hero.slug}`} className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium transition-colors">
              Read more <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        <div className="text-center py-20">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground text-lg">Stay tuned for our latest features!</p>
        </div>
      )}

      {gridPosts.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl text-foreground mb-6">Latest Articles</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {gridPosts.map((post) => (
              <div key={post.id} className="bg-card border border-border rounded-xl overflow-hidden group">
                {post.featuredMedia?.url && (
                  <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                    <Image
                      src={post.featuredMedia.url}
                      alt={post.featuredMedia.altText || post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-serif text-xl mb-2 text-foreground group-hover:text-primary transition-colors">{post.title}</h2>
                  {post.excerpt && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{post.excerpt}</p>}
                  <Link href={`/articles/${post.slug}`} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
                    Read more →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {listPosts.length > 0 && (
        <section>
          <h2 className="font-serif text-xl text-foreground mb-5">More Articles</h2>
          <div className="space-y-5">
            {listPosts.map((post) => (
              <div key={post.id} className="flex items-start gap-4 group">
                {post.featuredMedia?.url && (
                  <div className="relative w-28 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                    <Image
                      src={post.featuredMedia.url}
                      alt={post.featuredMedia.altText || post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-serif text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {post.authors?.map(a => a.displayName).join(', ')}
                    {post.publishedAt && ` · ${formatDistanceToNow(new Date(post.publishedAt))} ago`}
                  </p>
                  <Link href={`/articles/${post.slug}`} className="text-primary hover:text-primary/80 text-sm font-medium transition-colors mt-1 inline-block">
                    Read more →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
