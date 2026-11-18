# Self-hosted fonts

`Archivo-latin-variable.woff2` — Archivo (Omnibus-Type), variable weight 400–900, Latin subset, downloaded from Google Fonts. Licensed under the SIL Open Font License 1.1. Used by the `lokayat` theme via `next/font/local` in `src/app/layout.tsx`.

`SourceSerif4-latin-{normal,italic}.woff2` — Source Serif 4 (Adobe), variable weight 400–700 (with optical size), Latin subset, from Google Fonts. SIL Open Font License 1.1. Self-hosted for the same reason: `next/font/google` (Next 14) fails the production build when Google returns font URLs without a file extension.
