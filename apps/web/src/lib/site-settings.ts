import { cache } from 'react';

export interface NavItem {
  label: string;
  url: string;
}

export interface SiteSettings {
  site_title?: string;
  site_description?: string;
  site_logo?: string;
  site_icon?: string;
  nav_primary?: NavItem[];
  nav_secondary?: NavItem[];
  public_theme?: string;
}

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const res = await fetch(`${API_URL}/api/settings/public`, {
      next: { revalidate: 60, tags: ['site-settings'] },
    });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
});
