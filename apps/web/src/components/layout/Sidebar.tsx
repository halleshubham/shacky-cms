'use client';
import Link from 'next/link';
import NextImage from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, BookOpen, Users, Image, Tag, FolderOpen,
  Mail, UserCheck, Settings, LogOut, ChevronRight, Newspaper, ExternalLink, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Issues', href: '/admin/issues', icon: Newspaper },
  { label: 'Posts', href: '/admin/posts', icon: FileText },
  { label: 'Pages', href: '/admin/pages', icon: BookOpen },
  { label: 'Authors', href: '/admin/authors', icon: Users },
  { label: 'Media', href: '/admin/media', icon: Image },
  { label: 'Categories', href: '/admin/categories', icon: FolderOpen },
  { label: 'Tags', href: '/admin/tags', icon: Tag },
  { label: 'Subscribers', href: '/admin/subscribers', icon: UserCheck, roles: ['superadmin', 'editor', 'subscriber_manager'] },
  { label: 'Campaigns', href: '/admin/campaigns', icon: Mail, roles: ['superadmin', 'editor', 'subscriber_manager'] },
  { label: 'Users', href: '/admin/users', icon: Users, roles: ['superadmin'] },
  { label: 'Settings', href: '/admin/settings', icon: Settings, roles: ['superadmin'] },
  { label: 'Migration', href: '/admin/migration', icon: Download, roles: ['superadmin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const siteSettings = useSiteSettings();
  const siteName = siteSettings.site_title || 'Shacky CMS';
  const siteLogo = siteSettings.site_logo;

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <aside className="flex flex-col w-64 h-full overflow-y-auto flex-shrink-0 bg-[#0F172A] text-slate-300">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        {siteLogo ? (
          <NextImage
            src={siteLogo}
            alt={siteName}
            width={160}
            height={48}
            className="h-9 w-auto object-contain brightness-0 invert"
            priority
          />
        ) : (
          <h1 className="text-lg font-bold text-white tracking-wide" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            {siteName}
          </h1>
        )}
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-medium">Editorial Platform</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {isActive && <ChevronRight className="ml-auto h-3 w-3 opacity-70" />}
            </Link>
          );
        })}
      </nav>

      {/* Visit site */}
      <div className="px-3 pb-3">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded text-sm text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors border border-white/10"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          Visit Website
        </a>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
