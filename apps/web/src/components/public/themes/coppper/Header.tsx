'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Menu, X, Search } from 'lucide-react';
import type { ThemeHeaderProps } from '@/lib/theme-types';

export function CoppperHeader({ categories, siteTitle, siteLogo, navItems }: ThemeHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <header className={`sticky top-0 z-50 w-full transition-all ${scrolled ? 'bg-background shadow-md' : 'bg-background/80'} backdrop-blur-sm`}>
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          {siteLogo ? (
            <Image src={siteLogo} alt={siteTitle ?? 'Logo'} width={40} height={40} className="h-10 w-auto object-contain" />
          ) : (
            <span className="text-2xl font-serif text-primary">{siteTitle}</span>
          )}
        </Link>

        <nav className="hidden md:flex space-x-6">
          {nav.map((item, i) => (
            <Link key={i} href={item.url} className="text-foreground hover:text-primary transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Toggle search"
          >
            {searchOpen ? <X className="w-5 h-5 text-foreground" /> : <Search className="w-5 h-5 text-foreground" />}
          </button>
          <button
            className="md:hidden p-2 rounded-full hover:bg-muted transition-colors"
            onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5 text-foreground" /> : <Menu className="w-5 h-5 text-foreground" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-border bg-background px-6 py-3">
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles, authors, topics…"
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-background shadow-md md:hidden border-t border-border">
          <nav className="py-4 px-6 space-y-3">
            {nav.map((item, i) => (
              <Link key={i} href={item.url} onClick={() => setMenuOpen(false)} className="block text-foreground hover:text-primary transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
