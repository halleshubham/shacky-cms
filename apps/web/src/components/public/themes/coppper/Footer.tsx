'use client';

import Link from 'next/link';
import type { ThemeFooterProps } from '@/lib/theme-types';

export function CoppperFooter({ categories, siteTitle, siteDescription }: ThemeFooterProps) {
  return (
    <footer className="bg-secondary text-secondary-foreground py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-8">
          <div className="md:col-span-2">
            <h4 className="text-primary font-serif text-lg mb-2">{siteTitle}</h4>
            {siteDescription && (
              <p className="text-secondary-foreground/70 text-sm leading-relaxed max-w-xs">{siteDescription}</p>
            )}
          </div>

          {categories.length > 0 && (
            <div>
              <h5 className="text-secondary-foreground font-serif mb-3 text-sm font-semibold uppercase tracking-wider">Categories</h5>
              <ul className="space-y-2">
                {categories.slice(0, 6).map((cat) => (
                  <li key={cat.id}>
                    <Link href={`/category/${cat.slug}`} className="text-secondary-foreground/70 hover:text-primary text-sm transition-colors">
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h5 className="text-secondary-foreground font-serif mb-3 text-sm font-semibold uppercase tracking-wider">Explore</h5>
            <ul className="space-y-2">
              <li><Link href="/" className="text-secondary-foreground/70 hover:text-primary text-sm transition-colors">Home</Link></li>
              <li><Link href="/issues" className="text-secondary-foreground/70 hover:text-primary text-sm transition-colors">All Issues</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-secondary-foreground/20 pt-6 text-center text-secondary-foreground/50 text-sm">
          © {new Date().getFullYear()} {siteTitle}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
