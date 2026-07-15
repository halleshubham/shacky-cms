import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';
import { getSiteSettings } from '@/lib/site-settings';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

async function getCategories() {
  try {
    const res = await fetch(`${API}/api/public/categories`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([getCategories(), getSiteSettings()]);
  const siteName = settings.site_title || 'Shacky CMS';
  const editorsList = (settings.newsletter_editors || '').split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader
        navItems={settings.nav_primary}
        categories={categories}
        siteTitle={siteName}
        siteLogo={settings.site_logo}
        showTitle={settings.header_show_title}
        tagline={settings.header_show_tagline ? settings.newsletter_tagline : undefined}
        editors={settings.header_show_editors ? editorsList : undefined}
        settings={settings}
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <PublicFooter
        navItems={settings.nav_secondary}
        categories={categories}
        siteName={siteName}
        settings={settings}
      />
    </div>
  );
}
