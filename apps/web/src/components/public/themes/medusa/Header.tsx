'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, Newspaper } from 'lucide-react';
import type { ThemeHeaderProps } from '@/lib/theme-types';

export function MedusaHeader({ categories, siteTitle = 'Shacky CMS', siteLogo, navItems }: ThemeHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ease-in-out ${
        scrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="flex items-center h-16 gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-[1.1rem] tracking-tight shrink-0 text-foreground hover:opacity-80 transition-opacity"
          >
            {siteLogo ? (
              <Image src={siteLogo} alt={siteTitle} width={140} height={40} className="h-8 w-auto object-contain" priority />
            ) : (
              <>
                <Newspaper className="h-[18px] w-[18px] shrink-0" />
                <span>{siteTitle}</span>
              </>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {nav.slice(0, 7).map((item, i) => (
              <Link
                key={i}
                href={item.url}
                className="px-3 py-1.5 text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all duration-150 whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <button
              onClick={() => { setSearchOpen(!searchOpen); if (menuOpen) setMenuOpen(false); }}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              aria-label="Toggle search"
            >
              {searchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
            </button>
            <button
              onClick={() => { setMenuOpen(!menuOpen); if (searchOpen) setSearchOpen(false); }}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="pb-3 -mt-1">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-muted-foreground/60 pointer-events-none" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search articles, authors, topics…"
                className="w-full pl-10 pr-4 h-11 border border-border rounded-xl bg-background text-[0.875rem] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring/30 transition-all"
              />
            </form>
          </div>
        )}
      </div>

      {menuOpen && (
        <div className="md:hidden bg-background border-t border-border px-6 py-3 space-y-0.5">
          {nav.map((item, i) => (
            <Link
              key={i}
              href={item.url}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 text-[0.875rem] font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 pb-1">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-muted-foreground/60 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-9 pr-4 h-10 border border-border rounded-lg bg-muted text-[0.875rem] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring/30"
              />
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
