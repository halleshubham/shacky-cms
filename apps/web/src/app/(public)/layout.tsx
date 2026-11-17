import Script from 'next/script';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';
import { getSiteSettings } from '@/lib/site-settings';
import { uiStrings } from '@/lib/ui-strings';

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

  const tagId = /^[A-Za-z]{1,3}-[A-Za-z0-9]{4,20}$/.test((settings.google_tag_id || '').trim()) ? settings.google_tag_id!.trim() : '';

  return (
    <div
      className="min-h-screen flex flex-col bg-background text-foreground"
      data-theme={settings.site_theme || 'default'}
    >
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {uiStrings(settings.site_lang).skipToContent}
      </a>
      <PublicHeader
        navItems={settings.nav_primary}
        categories={categories}
        siteTitle={siteName}
        siteLogo={settings.site_logo}
        showTitle={settings.header_show_title}
        tagline={settings.header_show_tagline ? settings.newsletter_tagline : undefined}
        editors={settings.header_show_editors ? editorsList : undefined}
        settings={settings}
        lang={settings.site_lang}
      />

      <main id="main-content" data-site-main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      {tagId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${tagId}`} strategy="afterInteractive" />
          <Script id="google-tag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${tagId}');`}
          </Script>
        </>
      )}

      <PublicFooter
        navItems={settings.nav_secondary}
        categories={categories}
        siteName={siteName}
        settings={settings}
        lang={settings.site_lang}
        footerText={settings.footer_text}
        showPublication={settings.footer_show_publication}
      />
    </div>
  );
}
