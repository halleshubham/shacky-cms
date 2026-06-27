'use client';

import Link from 'next/link';
import type { ThemeFooterProps } from '@/lib/theme-types';

export function ClassicFooter({ categories, siteTitle }: ThemeFooterProps) {
  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div>
            <h3 className="font-semibold text-sm mb-3">Publication</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li><Link href="/issues" className="hover:text-foreground transition-colors">All Issues</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-3">Sections</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {categories.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`/category/${c.slug}`} className="hover:text-foreground transition-colors">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} {siteTitle}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
