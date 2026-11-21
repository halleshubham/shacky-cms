import type { Metadata } from 'next';
import { Playfair_Display, EB_Garamond, Montserrat, Mukta, Noto_Serif_Devanagari } from 'next/font/google';
import localFont from 'next/font/local';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import '@/styles/globals.css';
import '@/styles/themes/samvidhan.css';
import '@/styles/themes/lokayat.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { getSiteSettings } from '@/lib/site-settings';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const garamond = EB_Garamond({
  subsets: ['latin'],
  variable: '--font-garamond',
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

// Devanagari families used by the "samvidhan" theme. `preload: false` keeps them off
// every other site's critical path — the browser only downloads a face when text that
// uses it is actually rendered (the theme CSS is what references these variables).
const mukta = Mukta({
  subsets: ['devanagari', 'latin'],
  variable: '--font-mukta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  preload: false,
});

const notoSerifDevanagari = Noto_Serif_Devanagari({
  subsets: ['devanagari', 'latin'],
  variable: '--font-noto-serif-devanagari',
  display: 'swap',
  preload: false,
});

// Search Console tokens are URL-safe strings; accept several separated by commas/whitespace.
function verificationTokens(raw?: string): string[] {
  return (raw || '').split(/[\s,]+/).filter((t) => /^[A-Za-z0-9_-]{10,100}$/.test(t));
}

// Latin faces for the "lokayat" theme: Archivo (poster-style headlines + UI) and Source Serif 4
// (long-form reading). Loaded lazily like the Devanagari faces above.
// Both self-hosted: Google now serves Archivo from extension-less gstatic URLs that next/font/google (Next 14) cannot parse,
// which fails the production build. Variable font, Latin subset, weights 400–900 (SIL Open Font License).
const archivo = localFont({
  src: '../fonts/Archivo-latin-variable.woff2',
  variable: '--font-archivo',
  weight: '400 900',
  display: 'swap',
  preload: false,
});

const sourceSerif = localFont({
  src: [
    { path: '../fonts/SourceSerif4-latin-normal.woff2', weight: '400 700', style: 'normal' },
    { path: '../fonts/SourceSerif4-latin-italic.woff2', weight: '400 700', style: 'italic' },
  ],
  variable: '--font-source-serif',
  display: 'swap',
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = s.site_title || 'Shacky CMS';
  return {
    title: { default: title, template: `%s | ${title}` },
    description: s.site_description || '',
    icons: s.site_icon ? { icon: s.site_icon, shortcut: s.site_icon } : undefined,
    verification: verificationTokens(s.google_site_verification).length
      ? { google: verificationTokens(s.google_site_verification) }
      : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  const lang = (settings.site_lang || 'en').trim() || 'en';
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={`${playfair.variable} ${garamond.variable} ${montserrat.variable} ${mukta.variable} ${notoSerifDevanagari.variable} ${archivo.variable} ${sourceSerif.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            {children}
            <Toaster position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
