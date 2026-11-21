'use client';
import { use } from 'react';
import { PublicForm } from '@/components/public/PublicForm';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export default function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const siteSettings = useSiteSettings();
  const siteName = siteSettings.site_title || 'Shacky CMS';

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <p className="text-sm text-muted-foreground">{siteName}</p>
        </div>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <PublicForm slug={slug} />
        </div>
      </main>
    </div>
  );
}
