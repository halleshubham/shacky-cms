import { getSiteSettings } from '@/lib/site-settings';
import { getTheme } from '@/lib/theme-registry';

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
  const theme = getTheme(settings.public_theme);
  const { Header, Footer, wrapperClass, mainClass, dataTheme } = theme;

  return (
    <div className={wrapperClass} {...(dataTheme ? { 'data-theme': dataTheme } : {})}>
      <Header
        categories={categories}
        siteTitle={siteName}
        siteLogo={settings.site_logo}
        navItems={settings.nav_primary}
      />
      <main className={mainClass}>
        {children}
      </main>
      <Footer
        categories={categories}
        siteTitle={siteName}
        siteDescription={settings.site_description}
      />
    </div>
  );
}
