import Link from 'next/link';
import { getSiteSettings } from '@/lib/site-settings';
import { uiStrings } from '@/lib/ui-strings';

// Rendered inside the public layout, so it inherits the active theme's header/footer.
export default async function PublicNotFound() {
  const settings = await getSiteSettings();
  const t = uiStrings(settings.site_lang);
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 py-20 text-center">
      <p className="font-heading text-7xl font-extrabold text-primary" aria-hidden="true">404</p>
      <h1 className="text-2xl font-bold">{t.notFoundTitle}</h1>
      <p className="text-muted-foreground">{t.notFoundText}</p>
      <Link
        href="/"
        data-btn
        data-variant="primary"
        className="mt-2 inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {t.backHome}
      </Link>
    </section>
  );
}
