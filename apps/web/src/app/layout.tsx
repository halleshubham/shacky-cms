import type { Metadata } from 'next';
import { Playfair_Display, EB_Garamond, Montserrat, Mukta, Noto_Serif_Devanagari } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import '@/styles/globals.css';
import '@/styles/themes/samvidhan.css';
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

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = s.site_title || 'Shacky CMS';
  return {
    title: { default: title, template: `%s | ${title}` },
    description: s.site_description || '',
    icons: s.site_icon ? { icon: s.site_icon, shortcut: s.site_icon } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  const lang = (settings.site_lang || 'en').trim() || 'en';
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={`${playfair.variable} ${garamond.variable} ${montserrat.variable} ${mukta.variable} ${notoSerifDevanagari.variable} font-sans antialiased`}>
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
