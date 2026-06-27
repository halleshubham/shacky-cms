'use client';

import Link from 'next/link';
import type { ThemeFooterProps } from '@/lib/theme-types';

export function MedusaFooter({ categories, siteTitle, siteDescription }: ThemeFooterProps) {
  return (
    <footer className="border-t border-[#E5E7EB] mt-24 bg-[#FAFAFA]">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="md:col-span-2">
            <p className="text-[1.0625rem] font-bold text-[#111111] mb-2">{siteTitle}</p>
            {siteDescription && (
              <p className="text-[0.875rem] text-[#666666] leading-relaxed max-w-xs">
                {siteDescription}
              </p>
            )}
          </div>
          <div>
            <p className="text-[0.6875rem] font-semibold text-[#AAAAAA] uppercase tracking-widest mb-4">Publication</p>
            <ul className="space-y-2.5">
              {[
                { label: 'Home', url: '/' },
                { label: 'All Issues', url: '/issues' },
              ].map((l) => (
                <li key={l.url}>
                  <Link href={l.url} className="text-[0.875rem] text-[#555555] hover:text-[#111111] transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {categories.length > 0 && (
            <div>
              <p className="text-[0.6875rem] font-semibold text-[#AAAAAA] uppercase tracking-widest mb-4">Sections</p>
              <ul className="space-y-2.5">
                {categories.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link href={`/category/${c.slug}`} className="text-[0.875rem] text-[#555555] hover:text-[#111111] transition-colors">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="border-t border-[#E5E7EB] pt-7">
          <p className="text-[0.8125rem] text-[#AAAAAA]">
            © {new Date().getFullYear()} {siteTitle}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
