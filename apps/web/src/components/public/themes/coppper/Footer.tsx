'use client';
import Link from 'next/link';
import type { ThemeFooterProps } from '@/lib/theme-types';

export function CoppperFooter({ categories, siteTitle, siteDescription }: ThemeFooterProps) {
  return (
    <footer className="bg-[#1E1E1E] text-[#7A7A7A] py-12">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <h4 className="text-[#B87333] font-serif text-lg">{siteTitle}</h4>
          {siteDescription && <p className="mt-2">{siteDescription}</p>}
        </div>
        <div>
          <h5 className="text-[#FAF8F5] font-serif mb-2">Categories</h5>
          <ul className="space-y-1">
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link href={`/category/${cat.slug}`} className="hover:text-[#B87333]">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="text-[#FAF8F5] font-serif mb-2">Explore</h5>
          <ul className="space-y-1">
            <li><Link href="/issues" className="hover:text-[#B87333]">All Issues</Link></li>
          </ul>
        </div>
        <div>
          <h5 className="text-[#FAF8F5] font-serif mb-2">Subscribe</h5>
          <p>Join our newsletter for updates.</p>
          <form className="mt-4">
            <input type="email" placeholder="Your email" className="w-full px-3 py-2 rounded border border-[#E8DFD8] focus:ring-[#B87333] focus:border-[#B87333]" />
            <button type="submit" className="mt-2 w-full bg-[#B87333] text-white py-2 rounded hover:bg-[#8C5523]">Subscribe</button>
          </form>
        </div>
      </div>
      <div className="text-center mt-8 text-[#FAF8F5]">
        &copy; {new Date().getFullYear()} {siteTitle}.
      </div>
    </footer>
  );
}
