export interface NavItem {
  label: string;
  type: 'url' | 'category' | 'tag' | 'page';
  value: string;
}

export interface SiteSettings {
  site_title?: string;
  site_description?: string;
  site_logo?: string;
  site_icon?: string;
  nav_primary?: NavItem[];
  nav_secondary?: NavItem[];
}

export function navItemHref(item: NavItem): string {
  switch (item.type) {
    case 'category': return `/category/${item.value}`;
    case 'tag':      return `/tag/${item.value}`;
    case 'page':     return `/${item.value}`;
    default:         return item.value;
  }
}

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(`${API_URL}/api/settings/public`, {
      next: { revalidate: 60, tags: ['site-settings'] },
    });
    if (!res.ok) return {};
    const raw = await res.json();
    return raw as SiteSettings;
  } catch {
    return {};
  }
}
