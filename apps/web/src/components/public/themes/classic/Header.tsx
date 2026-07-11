'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, BookOpen } from 'lucide-react';
import type { ThemeHeaderProps } from '@/lib/theme-types';

export function ClassicHeader({ categories, siteTitle = 'Shacky CMS', siteLogo, navItems }: ThemeHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setMenuOpen(false);
      setQuery('');
    }
  };

  const nav = navItems?.length
    ? navItems
    : categories.length
      ? categories.slice(0, 5).map((c) => ({ label: c.name, url: `/category/${c.slug}` }))
      : [{ label: 'Home', url: '/' }, { label: 'Issues', url: '/issues' }];

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0 font-serif font-bold text-lg text-foreground hover:opacity-80 transition-opacity">
          {siteLogo ? (
            <Image src={siteLogo} alt={siteTitle} width={120} height={40} className="h-8 w-auto object-contain" priority />
          ) : (
            <>
              <BookOpen className="h-5 w-5 text-primary shrink-0" />
              <span>{siteTitle}</span>
            </>
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1">
          {nav.slice(0, 7).map((item, i) => (
            <Link
              key={i}
              href={item.url}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Toggle search"
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <button
            onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }}
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-border bg-background px-4 py-3">
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles, authors, topics…"
              className="w-full pl-9 pr-4 h-10 border border-input rounded-md bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-2 space-y-0.5">
          {nav.map((item, i) => (
            <Link
              key={i}
              href={item.url}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
