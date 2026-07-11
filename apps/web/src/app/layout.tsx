import type { Metadata } from 'next';
import { Playfair_Display } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import '@/styles/globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { getSiteSettings } from '@/lib/site-settings';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} font-sans antialiased`}>
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
