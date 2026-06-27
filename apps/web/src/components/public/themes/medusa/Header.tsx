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

  const hasCustomNav = navItems && navItems.length > 0;
  const navLinks = hasCustomNav
    ? navItems
    : [
        { label: 'Home', url: '/' },
        { label: 'Issues', url: '/issues' },
        ...categories.slice(0, 5).map((c) => ({ label: c.name, url: `/category/${c.slug}` })),
      ];

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ease-in-out ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-[#E5E7EB]/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="flex items-center h-16 gap-8">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-[1.1rem] tracking-tight shrink-0 text-[#111111] hover:opacity-80 transition-opacity"
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

          {/* Center nav — desktop */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {navLinks.slice(0, 7).map((item, i) => (
              <Link
                key={i}
                href={item.url}
                className="px-3 py-1.5 text-[0.8125rem] font-medium text-[#666666] hover:text-[#111111] rounded-lg hover:bg-[#F5F5F5] transition-all duration-150 whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: search + mobile toggle */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <button
              onClick={() => { setSearchOpen(!searchOpen); if (menuOpen) setMenuOpen(false); }}
              className="p-2 rounded-lg text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5] transition-all"
              aria-label="Toggle search"
            >
              {searchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
            </button>
            <button
              onClick={() => { setMenuOpen(!menuOpen); if (searchOpen) setSearchOpen(false); }}
              className="md:hidden p-2 rounded-lg text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5] transition-all"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {/* Inline search bar */}
        {searchOpen && (
          <div className="pb-3 -mt-1">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[#999999] pointer-events-none" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search articles, authors, topics…"
                className="w-full pl-10 pr-4 h-11 border border-[#E5E7EB] rounded-xl bg-white text-[0.875rem] text-[#111111] placeholder:text-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#111111]/8 focus:border-[#111111]/30 transition-all"
              />
            </form>
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-[#E5E7EB] px-6 py-3 space-y-0.5">
          {navLinks.map((item, i) => (
            <Link
              key={i}
              href={item.url}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 text-[0.875rem] font-medium text-[#444444] hover:text-[#111111] rounded-lg hover:bg-[#F5F5F5] transition-all"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 pb-1">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[#999999] pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-9 pr-4 h-10 border border-[#E5E7EB] rounded-lg bg-[#FAFAFA] text-[0.875rem] text-[#111111] placeholder:text-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#111111]/8 focus:border-[#111111]/30"
              />
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
