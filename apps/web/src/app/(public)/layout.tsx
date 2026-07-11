import { getSiteSettings, navItemHref } from '@/lib/site-settings';
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

function buildCustomThemeCss(vars: Record<string, string>): string {
  const lines = Object.entries(vars)
    .filter(([, v]) => v)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
  return `:root {\n${lines}\n}`;
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([getCategories(), getSiteSettings()]);
  const siteName = settings.site_title || 'Shacky CMS';

  const theme = getTheme(settings.public_theme);

  // Normalize complex NavItem[] → flat {label, url}[] for theme components
  const navLinks = (settings.nav_primary || []).map((item) => ({
    label: item.label,
    url: navItemHref(item),
  }));

  // Custom CSS vars injection (legacy 'custom' mode — CSS-only, uses classic theme layout)
  const customCss =
    settings.public_theme === 'custom' && settings.theme_custom_vars
      ? buildCustomThemeCss(settings.theme_custom_vars)
      : '';

  const { Header, Footer, wrapperClass, mainClass, dataTheme } = theme;

  return (
    <div className={wrapperClass} {...(dataTheme ? { 'data-theme': dataTheme } : {})}>
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}
      <Header
        categories={categories}
        siteTitle={siteName}
        siteLogo={settings.site_logo}
        navItems={navLinks}
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
