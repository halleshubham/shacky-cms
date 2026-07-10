'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, Newspaper, ChevronDown } from 'lucide-react';
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

type ResolvedItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

function resolveNav(navItems?: NavItem[], categories?: Category[]): ResolvedItem[] {
  if (navItems && navItems.length > 0) {
    return navItems.map((item) => ({
      label: item.label,
      href: navItemHref(item),
      children: item.children?.map((c) => ({ label: c.label, href: navItemHref(c) })),
    }));
  }
  const cat = (categories ?? []).slice(0, 7).map((c) => ({ label: c.name, href: `/category/${c.slug}` }));
  return [{ label: 'Home', href: '/' }, { label: 'Issues', href: '/issues' }, ...cat];
}

function DesktopNavItem({ item }: { item: ResolvedItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-0.5 px-3 py-2 text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {item.label}
        <ChevronDown className={`h-3.5 w-3.5 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 min-w-[180px] bg-background border border-border rounded-md shadow-lg py-1 mt-0.5">
          {item.children.map((child) => (
            <Link
              key={child.href + child.label}
              href={child.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-muted transition-colors whitespace-nowrap"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileNavItem({ item, onClose }: { item: ResolvedItem; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);

  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <div className="flex items-center">
        <Link
          href={item.href}
          onClick={onClose}
          className="flex-1 px-3 py-2 text-sm font-medium hover:bg-muted rounded-l-md"
        >
          {item.label}
        </Link>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="p-2 hover:bg-muted rounded-r-md"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {expanded && (
        <div className="ml-4 border-l-2 border-border pl-3 space-y-0.5 mt-0.5">
          {item.children.map((child) => (
            <Link
              key={child.href + child.label}
              href={child.href}
              onClick={onClose}
              className="block px-3 py-1.5 text-sm hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
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
                {/* Plain <img> preserves PNG transparency — Next.js Image converts to WebP */}
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
        <nav className="hidden md:flex items-center gap-0 pb-0 -mb-px overflow-x-auto">
          {links.map((link) => (
            <DesktopNavItem key={link.href + link.label} item={link} />
          ))}
        </nav>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
          {links.map((link) => (
            <MobileNavItem key={link.href + link.label} item={link} onClose={() => setMenuOpen(false)} />
          ))}
        </div>
      )}
    </header>
  );
}
