'use client';

import Link from 'next/link';
import { ArticleCard } from '../../ArticleCard';
import { BookOpen, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import type { ThemeHomeProps } from '@/lib/theme-types';

export function ClassicHomePage({ hero, gridPosts, listPosts, issue }: ThemeHomeProps) {
  return (
    <div className="space-y-12">
      {issue && (
        <div className="flex items-center justify-between border border-border rounded-lg px-5 py-3 bg-muted/40">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary shrink-0" />
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Latest Issue</span>
              <p className="font-semibold text-sm">
                Vol. {issue.volumeNumber}, No. {issue.issueNumber} — {issue.title}
                <span className="text-muted-foreground font-normal ml-2">
                  {format(new Date(issue.publishDate), 'MMMM d, yyyy')}
                </span>
              </p>
            </div>
          </div>
          <Link href={`/issues/${issue.id}`} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {hero && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ArticleCard post={hero} size="large" />
          </div>
          <div className="space-y-6">
            {gridPosts.map((p) => (
              <ArticleCard key={p.id} post={p} size="default" />
            ))}
          </div>
        </div>
      )}

      {listPosts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">More Articles</h2>
            <Link href="/issues" className="text-sm text-primary hover:underline flex items-center gap-1">
              Browse all issues <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {listPosts.map((p) => (
              <ArticleCard key={p.id} post={p} />
            ))}
          </div>
        </div>
      )}

      {!hero && (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No published articles yet</p>
          <p className="text-sm mt-1">Check back soon.</p>
        </div>
      )}
    </div>
  );
}
