'use client';

const LANG_LABELS: Record<string, string> = {
  mr: 'मराठी',
  hi: 'हिन्दी',
  en: 'English',
};

function getActiveLang(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/googtrans=\/\w+\/(\w+)/);
  return m ? m[1] : '';
}

function setLang(lang: string) {
  if (lang === '') {
    document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = `googtrans=; path=/; domain=${location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 UTC`;
  } else {
    document.cookie = `googtrans=/auto/${lang}; path=/`;
    document.cookie = `googtrans=/auto/${lang}; path=/; domain=${location.hostname}`;
  }
  location.reload();
}

export function TranslateButtons({ languages }: { languages: string }) {
  const langs = languages.split(',').map((l) => l.trim()).filter(Boolean);
  const active = getActiveLang();

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground">Translate:</span>
      {langs.map((lang) => (
        <button
          key={lang}
          onClick={() => setLang(lang)}
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors border ${
            active === lang
              ? 'bg-primary text-primary-foreground border-primary'
              : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground'
          }`}
        >
          {LANG_LABELS[lang] || lang}
        </button>
      ))}
      {active && (
        <button
          onClick={() => setLang('')}
          className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          Original
        </button>
      )}
    </div>
  );
}
