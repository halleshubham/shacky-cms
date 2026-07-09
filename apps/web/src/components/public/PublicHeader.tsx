'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, Newspaper } from 'lucide-react';
import { type NavItem, navItemHref } from '@/lib/site-settings';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface PublicHeaderProps {
  navItems?: NavItem[];
  categories?: Category[];
  siteTitle?: string;
  siteLogo?: string;
  showTitle?: boolean;
}

// Build nav links: configured items take priority; fall back to Home + Issues + categories
function resolveNav(navItems?: NavItem[], categories?: Category[]): { label: string; href: string }[] {
  if (navItems && navItems.length > 0) {
    return navItems.map((item) => ({ label: item.label, href: navItemHref(item) }));
  }
  const cat = (categories ?? []).slice(0, 7).map((c) => ({ label: c.name, href: `/category/${c.slug}` }));
  return [{ label: 'Home', href: '/' }, { label: 'Issues', href: '/issues' }, ...cat];
}

export function PublicHeader({
  navItems,
  categories,
  siteTitle = 'Shacky CMS',
  siteLogo,
  showTitle = false,
}: PublicHeaderProps) {
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
      setQuery('');
    }
  };

  const links = resolveNav(navItems, categories);

  return (
    <header className="border-b border-border bg-background sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight shrink-0">
            {siteLogo ? (
              <>
                {/* Plain <img> preserves PNG transparency — Next.js Image converts to WebP which can alter rendering */}
                <img src={siteLogo} alt={siteTitle} className="h-9 w-auto max-w-[160px] object-contain" />
                {showTitle && <span>{siteTitle}</span>}
              </>
            ) : (
              <>
                <Newspaper className="h-5 w-5 text-primary shrink-0" />
                <span>{siteTitle}</span>
              </>
            )}
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Toggle search"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="pb-3">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search articles, authors, topics…"
                className="w-full pl-9 pr-4 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </form>
          </div>
        )}

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 pb-0 -mb-px overflow-x-auto">
          {links.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
