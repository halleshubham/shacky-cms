'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowRight, BookOpen, Clock, Star } from 'lucide-react';
import type { ThemeHomeProps } from '@/lib/theme-types';

type Post = NonNullable<ThemeHomeProps['hero']>;

function MedusaCard({ post }: { post: Post }) {
  const author = post.authors?.[0];
  const category = post.categories?.[0];
  const timeAgo = post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : null;

  return (
    <Link href={`/articles/${post.slug}`} className="medusa-card group flex flex-col rounded-2xl border border-[#E5E7EB] overflow-hidden bg-white h-full">
      {post.featuredMedia ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-[#F5F5F5] shrink-0">
          <Image
            src={post.featuredMedia.url}
            alt={post.featuredMedia.altText || post.title}
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
          />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-gradient-to-br from-[#F5F5F5] to-[#EBEBEB] shrink-0" />
      )}
      <div className="p-5 flex-1 flex flex-col">
        {category && (
          <span className="text-[0.6875rem] font-semibold text-[#4f46e5] uppercase tracking-widest mb-1.5">
            {category.name}
          </span>
        )}
        <h3 className="text-[1.0625rem] font-bold text-[#111111] leading-[1.35] group-hover:text-[#333333] transition-colors line-clamp-2 flex-1">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-[0.875rem] text-[#666666] mt-2 line-clamp-2 leading-relaxed">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center gap-2 mt-4 text-[0.75rem] text-[#8A8A8A]">
          {post.isFeatured && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
          {author && <span>{author.displayName}</span>}
          {author && timeAgo && <span className="text-[#CCCCCC]">·</span>}
          {timeAgo && <span>{timeAgo}</span>}
          {post.readingTime && (
            <>
              <span className="text-[#CCCCCC]">·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {post.readingTime} min
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function MedusaCompactCard({ post }: { post: Post }) {
  const author = post.authors?.[0];
  const category = post.categories?.[0];
  const timeAgo = post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : null;

  return (
    <Link href={`/articles/${post.slug}`} className="medusa-card group flex gap-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 items-start">
      {post.featuredMedia && (
        <div className="relative w-24 h-20 shrink-0 rounded-xl overflow-hidden bg-[#F5F5F5]">
          <Image
            src={post.featuredMedia.url}
            alt={post.featuredMedia.altText || post.title}
            fill
            className="object-cover group-hover:scale-[1.05] transition-transform duration-300"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {category && (
          <span className="text-[0.6875rem] font-semibold text-[#4f46e5] uppercase tracking-widest">
            {category.name}
          </span>
        )}
        <h3 className="text-[0.9375rem] font-bold text-[#111111] leading-snug mt-0.5 group-hover:text-[#333333] transition-colors line-clamp-2">
          {post.title}
        </h3>
        <div className="flex items-center gap-2 mt-2 text-[0.75rem] text-[#8A8A8A]">
          {author && <span>{author.displayName}</span>}
          {author && timeAgo && <span className="text-[#CCCCCC]">·</span>}
          {timeAgo && <span>{timeAgo}</span>}
        </div>
      </div>
    </Link>
  );
}

export function MedusaHomePage({ hero, gridPosts, listPosts, issue }: ThemeHomeProps) {
  return (
    <div className="max-w-[1180px] mx-auto py-12 space-y-20">
      {/* Latest issue pill */}
      {issue && (
        <div className="flex">
          <Link
            href={`/issues/${issue.id}`}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#E5E7EB] bg-[#FAFAFA] text-[0.8125rem] text-[#666666] hover:border-[#BBBBBB] hover:text-[#111111] transition-all group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5] shrink-0" />
            <span className="font-medium text-[#111111]">
              Vol. {issue.volumeNumber}, No. {issue.issueNumber}
            </span>
            <span className="text-[#CCCCCC]">—</span>
            <span className="truncate max-w-[240px]">{issue.title}</span>
            <span className="text-[#999999] ml-0.5">{format(new Date(issue.publishDate), 'MMM d, yyyy')}</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#999999] group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      )}

      {/* Hero post */}
      {hero && (
        <section>
          <Link href={`/articles/${hero.slug}`} className="group block">
            {hero.featuredMedia && (
              <div className="relative aspect-[21/9] rounded-2xl overflow-hidden bg-[#F5F5F5] mb-8">
                <Image
                  src={hero.featuredMedia.url}
                  alt={hero.featuredMedia.altText || hero.title}
                  fill
                  className="object-cover group-hover:scale-[1.015] transition-transform duration-700 ease-out"
                  priority
                />
              </div>
            )}
          </Link>
          <div className="max-w-3xl">
            {hero.categories?.[0] && (
              <span className="text-[0.75rem] font-semibold text-[#4f46e5] uppercase tracking-widest">
                {hero.categories[0].name}
              </span>
            )}
            <h1 className="text-[2.5rem] md:text-[3.25rem] font-bold text-[#111111] leading-[1.12] tracking-[-0.03em] mt-2 mb-4">
              <Link href={`/articles/${hero.slug}`} className="hover:opacity-75 transition-opacity duration-200">
                {hero.title}
              </Link>
            </h1>
            {hero.excerpt && (
              <p className="text-[1.125rem] text-[#555555] leading-[1.65]">{hero.excerpt}</p>
            )}
            <div className="flex items-center gap-3 mt-5 text-[0.875rem] text-[#8A8A8A]">
              {hero.isFeatured && (
                <span className="flex items-center gap-1 text-amber-500 text-[0.8125rem]">
                  <Star className="h-3.5 w-3.5 fill-current" /> Featured
                </span>
              )}
              {hero.authors?.[0] && <span className="text-[#555555] font-medium">{hero.authors[0].displayName}</span>}
              {hero.authors?.[0] && hero.publishedAt && <span className="text-[#CCCCCC]">·</span>}
              {hero.publishedAt && (
                <span>{formatDistanceToNow(new Date(hero.publishedAt), { addSuffix: true })}</span>
              )}
              {hero.readingTime && (
                <>
                  <span className="text-[#CCCCCC]">·</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {hero.readingTime} min read
                  </span>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Latest articles grid */}
      {gridPosts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[1.5rem] font-bold text-[#111111] tracking-[-0.025em]">Latest Articles</h2>
            <Link
              href="/issues"
              className="flex items-center gap-1.5 text-[0.8125rem] text-[#666666] hover:text-[#111111] transition-colors group"
            >
              Browse all issues
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {gridPosts.map((p) => (
              <MedusaCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {/* Compact article list */}
      {listPosts.length > 0 && (
        <section>
          <h2 className="text-[1.25rem] font-bold text-[#111111] tracking-[-0.025em] mb-8">More Articles</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {listPosts.map((p) => (
              <MedusaCompactCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!hero && (
        <div className="text-center py-28">
          <div className="w-14 h-14 rounded-2xl border border-[#E5E7EB] flex items-center justify-center mx-auto mb-5">
            <BookOpen className="h-6 w-6 text-[#AAAAAA]" />
          </div>
          <p className="text-[1.0625rem] font-semibold text-[#111111]">No published articles yet</p>
          <p className="text-[0.875rem] text-[#8A8A8A] mt-1.5">Check back soon for new content.</p>
        </div>
      )}
    </div>
  );
}
