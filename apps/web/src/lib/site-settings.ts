export interface SiteSettings {
  site_title?: string;
  site_description?: string;
  site_logo?: string;
  site_icon?: string;
}

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(`${API_URL}/api/settings/public`, {
      next: { revalidate: 60, tags: ['site-settings'] },
    });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}
