# Migrating a WordPress site

Order matters: **instance → media → pages → menu**. Each step is re-runnable.

## 1. Instance
Deploy with `docker-compose.coolify.yaml` and set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
(otherwise the seed creates the public default admin). The API creates the media bucket on
startup if it is missing.

## 2. Media — `apps/api/scripts/wp-media-import.mjs`
Copies every attachment's **original file, byte-for-byte, at its original path** via
`POST /api/media/import`; the web app serves it at the same `/wp-content/uploads/…` URL, so
links already shared in print / WhatsApp keep working after the domain moves. (The normal
`/api/media/upload` is for editors: it re-encodes images to JPEG ≤1920px and renames files.)

```bash
WP_URL=https://example.org CMS_URL=https://cms.example.org \
CMS_EMAIL=admin@example.org CMS_PASSWORD='…' \
node apps/api/scripts/wp-media-import.mjs
```
Resumable (state file), verifies sizes, ~7 MB/s. `EXTRA_PATHS=2025/03/a.webp,…` imports files
that pages reference but WordPress' public media list hides (attachments of private posts).
Expect WordPress' `X-WP-Total` to exceed what the public API returns for that reason.

## 3. Pages — `apps/api/scripts/wp-pages-import.py`
Converts Gutenberg HTML into page-builder blocks (headings, rich text, image galleries, button
rows, 2–4 column layouts as cards, dividers, embeds), rewrites image / file / internal links to
local paths, **fails if any referenced file was not imported**, upserts by slug, then crawls the
result and checks every page, file and link returns 200.

```bash
pip install beautifulsoup4
WP_URL=… CMS_URL=… CMS_EMAIL=… CMS_PASSWORD=… MEDIA_STATE=./wp-media-import.state.json \
INCLUDE_POSTS=1 python3 apps/api/scripts/wp-pages-import.py     # MODE=dry to preview
```
`INCLUDE_POSTS=1` imports WordPress *posts* as pages at the same URL — use it when the menu links
to posts. Re-running overwrites CMS edits made to these pages. A column layout that can't be
represented as cards is stacked in reading order rather than dropping content.

## 4. Menu & settings
Set `nav_primary` / `nav_secondary` (Admin → Settings → Navigation) from the WordPress menu;
`type: "page"` items link to `/<slug>`, which resolves CMS pages.

## Operations notes
- **Pushes to `main` redeploy every Coolify app that tracks `main`** (webhook). Merging
  restarts those instances within seconds; data volumes are unaffected unless a migration or
  volume change is part of the merge.
- The object-storage gateway has no auth; the web app's `/s3/*` and `/wp-content/uploads/*`
  proxies are therefore read-only (`apps/web/src/middleware.ts`). Keep it that way.
