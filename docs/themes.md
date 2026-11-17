# Public-site themes

Shacky CMS ships with the original **Default** look and opt-in themes. A theme is
selected per site in **Admin → Settings → Site & Branding → Appearance** (stored as the
`site_theme` setting) and applied as `data-theme="<id>"` on the public layout wrapper
(`apps/web/src/app/(public)/layout.tsx`). Nothing outside `[data-theme='<id>']` changes,
so installing a theme never affects sites that don't select it.

| Id | Look |
|---|---|
| `default` | Neo Classic — cobalt on powder-blue, Playfair headings |
| `samvidhan` | संविधान जागर अभियान — terracotta header with a tricolour keyline, parchment page, saffron accents, Noto Serif Devanagari headings + Mukta body |

## How a theme is built

1. **Tokens** — HSL CSS variables (`--background`, `--primary`, `--card`, …) as already used by
   Tailwind, plus chrome tokens `--header`, `--header-foreground`, `--header-hover`,
   `--footer`, `--footer-foreground`. Override them under `[data-theme='x']` (and
   `.dark [data-theme='x']` for dark mode). The defaults in `globals.css` reproduce the
   original look exactly.
2. **Fonts** — load with `next/font` in `app/layout.tsx` (`preload: false` so other sites don't
   pay for them) and reference the CSS variable from the theme file.
3. **Structure hooks** — the header, footer and page-builder blocks expose stable `data-*`
   attributes instead of theme-specific classes:
   `data-site-header`, `data-header-inner|row|brand|tools|nav|social|search`, `data-nav-link`,
   `data-nav-dropdown`, `data-mobile-menu`, `data-site-main`, `data-site-footer`,
   `data-footer-legal`, and per block `data-block="heading|button-row|file-downloads|gallery|
   columns|image|rich-text|download-banner"`, `data-btn` + `data-variant`, `data-file`,
   `data-file-badge`, `data-column="card|nested"`.
4. **Stylesheet** — `apps/web/src/styles/themes/<id>.css`, imported once in `app/layout.tsx`.
5. **Register** — add the option to the Theme `<select>` in `app/admin/settings/page.tsx`.

## Related site settings

| Setting | Purpose |
|---|---|
| `site_theme` | theme id (`default` when empty) |
| `site_lang` | `en` / `mr` / `hi` — sets `<html lang>` and the shell labels (`lib/ui-strings.ts`) |
| `footer_text` | replaces the "© year Site. All rights reserved." line |
| `footer_show_publication` | `false` hides the "Home / All Issues" footer column |

## Applying the Samvidhan theme with sample content

```bash
pnpm --filter api exec tsx --env-file=.env scripts/seed-samvidhan-demo.ts
```

Sets the theme/language/nav/social settings, the homepage blocks, and the *Posters &
Banners* and *Contact* pages. Idempotent; never deletes anything. Content lives in
`apps/api/scripts/samvidhan-content.ts` and references the live WordPress uploads until the
media migration (Admin → Migration) has run.

## Page URLs

`/<slug>` resolves to a CMS page when no post has that slug (posts still 301 to
`/articles/<slug>`), so navigation items of type *Page* and legacy WordPress page URLs such
as `/posters/` work.
