'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, Newspaper, ChevronDown } from 'lucide-react';
import { type NavItem, navItemHref, type SiteSettings } from '@/lib/site-settings';

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
  settings?: Pick<SiteSettings, 'social_facebook' | 'social_instagram' | 'social_whatsapp' | 'social_telegram' | 'social_youtube' | 'social_x'>;
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

// Social icon SVGs (inline, no extra dep)
const SocialIcons = {
  facebook:  (p: any) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
  instagram: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>,
  whatsapp:  (p: any) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>,
  telegram:  (p: any) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
  youtube:   (p: any) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  x:         (p: any) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
};

type SocialKey = 'facebook' | 'instagram' | 'whatsapp' | 'telegram' | 'youtube' | 'x';
const SOCIAL_ORDER: SocialKey[] = ['facebook', 'instagram', 'whatsapp', 'telegram', 'youtube', 'x'];

function SocialLinks({ settings, className = '' }: { settings?: PublicHeaderProps['settings']; className?: string }) {
  if (!settings) return null;
  const links: { key: SocialKey; url: string }[] = SOCIAL_ORDER
    .map((key) => ({ key, url: (settings as any)[`social_${key}`] || '' }))
    .filter((l) => l.url);
  if (!links.length) return null;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {links.map(({ key, url }) => {
        const Icon = SocialIcons[key];
        return (
          <a key={key} href={url} target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={key}>
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
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
      <Link href={item.href} className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors whitespace-nowrap">
        {item.label}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="true"
        className="flex items-center gap-0.5 px-3 py-2 text-sm font-medium hover:text-primary transition-colors whitespace-nowrap">
        {item.label}
        <ChevronDown className={`h-3.5 w-3.5 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 min-w-[180px] bg-background border border-border rounded-md shadow-lg py-1 mt-0.5">
          {item.children.map((child) => (
            <Link key={child.href + child.label} href={child.href} onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-muted transition-colors whitespace-nowrap">
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
      <Link href={item.href} onClick={onClose} className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md">
        {item.label}
      </Link>
    );
  }
  return (
    <div>
      <div className="flex items-center">
        <Link href={item.href} onClick={onClose} className="flex-1 px-3 py-2 text-sm font-medium hover:bg-muted rounded-l-md">{item.label}</Link>
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}
          className="p-2 hover:bg-muted rounded-r-md">
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {expanded && (
        <div className="ml-4 border-l-2 border-border pl-3 space-y-0.5 mt-0.5">
          {item.children.map((child) => (
            <Link key={child.href + child.label} href={child.href} onClick={onClose}
              className="block px-3 py-1.5 text-sm hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function PublicHeader({
  navItems, categories,
  siteTitle = 'Shacky CMS',
  siteLogo, showTitle = false, settings,
}: PublicHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (searchOpen) inputRef.current?.focus(); }, [searchOpen]);

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
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight shrink-0">
            {siteLogo ? (
              <>
                {/* Plain <img> preserves PNG transparency */}
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
            <SocialLinks settings={settings} className="hidden md:flex" />
            <button onClick={() => setSearchOpen(!searchOpen)} className="p-2 rounded-md hover:bg-muted transition-colors" aria-label="Toggle search">
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-md hover:bg-muted transition-colors" aria-label="Toggle menu">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="pb-3">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input ref={inputRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search articles, authors, topics…"
                className="w-full pl-9 pr-4 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </form>
          </div>
        )}

        <nav className="hidden md:flex items-center gap-0 pb-0 -mb-px overflow-x-auto">
          {links.map((link) => <DesktopNavItem key={link.href + link.label} item={link} />)}
        </nav>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
          {links.map((link) => <MobileNavItem key={link.href + link.label} item={link} onClose={() => setMenuOpen(false)} />)}
          <SocialLinks settings={settings} className="pt-2 border-t border-border mt-2" />
        </div>
      )}
    </header>
  );
}
