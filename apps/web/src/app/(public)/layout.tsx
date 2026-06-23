import Link from 'next/link';
import { PublicHeader } from '@/components/public/PublicHeader';
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

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader
        categories={categories}
        siteTitle={siteName}
        siteLogo={settings.site_logo}
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div>
              <h3 className="font-semibold text-sm mb-3">Publication</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
                <li><Link href="/issues" className="hover:text-foreground transition-colors">All Issues</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3">Sections</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {categories.slice(0, 5).map((c: any) => (
                  <li key={c.id}>
                    <Link href={`/category/${c.slug}`} className="hover:text-foreground transition-colors">{c.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} {siteName}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
