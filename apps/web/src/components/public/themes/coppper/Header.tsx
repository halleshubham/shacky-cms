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
    window.addEventListener('scroll', handleScroll);
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
      setQuery('');
    }
  };

  const navigation = navItems?.length
    ? navItems
    : categories.length
      ? categories.slice(0, 5).map((c) => ({ label: c.name, url: `/category/${c.slug}` }))
      : [{ label: 'Home', url: '/' }, { label: 'Issues', url: '/issues' }];

  return (
    <header className={`sticky top-0 z-50 w-full ${scrolled ? 'bg-[#FAF8F5] shadow-md' : 'bg-[#FAF8F5]/80'} backdrop-blur-sm transition-all`}>
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          {siteLogo ? (
            <Image src={siteLogo} alt={siteTitle ?? 'Logo'} width={40} height={40} />
          ) : (
            <span className="text-2xl font-serif text-[#B87333]">{siteTitle}</span>
          )}
        </Link>

        <nav className="hidden md:flex space-x-6">
          {navigation.map((item) => (
            <Link key={item.url} href={item.url} className="text-[#4A4A4A] hover:text-[#B87333]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-2 rounded-full hover:bg-[#F3EEE8] transition-colors"
            aria-label="Toggle search"
          >
            {searchOpen ? <X className="w-5 h-5 text-[#4A4A4A]" /> : <Search className="w-5 h-5 text-[#4A4A4A]" />}
          </button>
          <button
            className="md:hidden p-2 rounded-full hover:bg-[#F3EEE8] transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5 text-[#4A4A4A]" /> : <Menu className="w-5 h-5 text-[#4A4A4A]" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-[#E8DDD0] bg-[#FAF8F5] px-6 py-3">
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A8A7A]" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles, authors, topics…"
              className="w-full pl-9 pr-4 py-2 border border-[#E8DDD0] rounded-lg bg-white text-sm text-[#1E1E1E] placeholder:text-[#9A8A7A] focus:outline-none focus:ring-2 focus:ring-[#B87333]"
            />
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#FAF8F5] shadow-md md:hidden border-t border-[#E8DDD0]">
          <nav className="py-4 px-6 space-y-3">
            {navigation.map((item) => (
              <Link key={item.url} href={item.url} onClick={() => setMenuOpen(false)} className="block text-[#4A4A4A] hover:text-[#B87333]">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
