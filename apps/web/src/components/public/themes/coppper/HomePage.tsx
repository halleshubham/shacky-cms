'use client';
import Link from 'next/link';
import Image from 'next/image';
import { format, formatDistanceToNow } from 'date-fns';
import type { ThemeHomeProps } from '@/lib/theme-types';

export function CoppperHomePage({ hero, gridPosts, listPosts, issue }: ThemeHomeProps) {
  return (
    <main className="mt-16">
      {hero ? (
        <section className="bg-white shadow rounded-lg mb-12">
          <Image src={hero.featuredMedia?.url || ''} alt={hero.featuredMedia?.altText || hero.title} width={1280} height={720} className="w-full h-auto rounded-t-lg" />
          <div className="p-6">
            <span className="inline-block bg-[#B87333] text-white py-1 px-3 rounded mb-4">Featured</span>
            <h1 className="font-serif text-4xl md:text-6xl mb-4 text-[#1E1E1E]">{hero.title}</h1>
            <p className="text-lg mb-4 text-[#4A4A4A]">{hero.excerpt}</p>
            <div className="text-sm text-[#7A7A7A]">
              <span>{hero.authors?.map(author => author.displayName).join(', ')}</span>
              &nbsp;•&nbsp;
              {hero.publishedAt && <span>{format(new Date(hero.publishedAt), 'MMMM d, yyyy')}</span>}
              &nbsp;•&nbsp;
              <span>{hero.readingTime} min read</span>
            </div>
            <Link href={`/articles/${hero.slug}`} className="mt-4 inline-block text-[#B87333] hover:text-[#8C5523]">Read more</Link>
          </div>
        </section>
      ) : (
        <div className="text-center py-20">
          <p className="text-2xl text-[#7A7A7A]">Stay tuned for our latest features!</p>
        </div>
      )}

      {issue && (
        <section className="bg-[#FAF8F5] py-6 mb-12 text-center">
          <p className="text-[#4A4A4A]">Current Issue: <strong>{issue.title}</strong> Vol. {issue.volumeNumber}, Issue {issue.issueNumber}</p>
          <p className="text-sm text-[#7A7A7A]">Published on {format(new Date(issue.publishDate), 'MMMM d, yyyy')}</p>
          <Link href={`/issues/${issue.id}`} className="text-[#B87333] hover:text-[#8C5523]">View Issue</Link>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-3 mb-12">
        {gridPosts.map(post => (
          <div key={post.id} className="bg-white shadow rounded-lg overflow-hidden">
            <Image src={post.featuredMedia?.url || ''} alt={post.featuredMedia?.altText || post.title} width={400} height={225} className="w-full h-auto" />
            <div className="p-4">
              <h2 className="font-serif text-2xl mb-2 text-[#1E1E1E]">{post.title}</h2>
              <p className="text-sm text-[#7A7A7A] mb-4">{post.excerpt}</p>
              <Link href={`/articles/${post.slug}`} className="text-[#B87333] hover:text-[#8C5523]">Read more</Link>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-6">
        {listPosts.map(post => (
          <div key={post.id} className="flex items-center">
            <Image src={post.featuredMedia?.url || ''} alt={post.featuredMedia?.altText || post.title} width={120} height={68} className="w-[120px] h-auto rounded-lg" />
            <div className="ml-4">
              <h3 className="font-serif text-xl text-[#1E1E1E]">{post.title}</h3>
              <p className="text-sm text-[#7A7A7A]">
                <span>{post.authors?.map(author => author.displayName).join(', ')}</span>
                &nbsp;•&nbsp;
                {post.publishedAt && <span>{formatDistanceToNow(new Date(post.publishedAt))} ago</span>}
              </p>
              <Link href={`/articles/${post.slug}`} className="text-[#B87333] hover:text-[#8C5523]">Read more</Link>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
