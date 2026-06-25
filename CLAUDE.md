# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development (from repo root)
```bash
# Start all services (infrastructure must already be running)
pnpm dev                          # runs api (port 4000) + web (port 3000) in parallel

# Individual apps
pnpm --filter api dev             # API only (tsx watch)
pnpm --filter web dev             # Next.js only

# Shared package (must build before api/web can consume it)
pnpm --filter @shacky/shared dev  # watch mode
pnpm --filter @shacky/shared build
```

### Database
```bash
pnpm db:generate    # prisma generate (after schema changes)
pnpm db:migrate     # prisma migrate dev (creates + applies migration)
pnpm db:seed        # seed initial data
pnpm db:studio      # open Prisma Studio
```

**Migration rule — always use `pnpm db:migrate`, never `prisma db push`.**
`db push` bypasses the migration files in `prisma/migrations/`. The Docker entrypoint runs `prisma migrate deploy`, so any schema change not represented as a migration file will silently be missing on production and cause 500 errors. Use `pnpm db:migrate --name <description>` for every schema change, including in development.

### Build & type-check
```bash
pnpm build          # builds shared → api → web in dependency order
pnpm typecheck      # tsc --noEmit across all packages
pnpm lint           # next lint (web only)
```

### Infrastructure (Docker)
```bash
# Spin up Postgres, Redis, MinIO only (dev: run api/web locally)
docker compose up postgres redis minio minio_init -d

# Full stack in Docker
docker compose up --build
```

## Architecture

### Monorepo layout
```
apps/api/     — Fastify REST API (port 4000)
apps/web/     — Next.js 14 App Router frontend (port 3000)
packages/shared/ — Shared TypeScript types + utilities (slugify, date helpers)
prisma/       — Schema lives at apps/api/prisma/schema.prisma
```

### API (`apps/api`)
- **Entry**: `src/server.ts` — registers plugins, all routes, starts background workers
- **Routes**: one file per resource under `src/routes/`, all prefixed `/api/<resource>`
- **Services**: business logic in `src/services/` (ai.ts, docxIngestion.ts, email.ts, botsab.ts, newsletter.ts, stockSearch.ts, wordpress.ts)
- **Middleware**: `src/middleware/auth.ts` — `authenticate` + `requireRoles` used as Fastify `preHandler` hooks
- **Workers**: `src/workers/scheduler.ts` (60s setInterval to publish scheduled posts), `src/workers/ingestWorker.ts` (BullMQ worker for async AI enhancements after ingest)
- **Jobs**: `src/jobs/ingestQueue.ts` — BullMQ queue named `ingest-enhancements`
- **Plugins**: `src/plugins/prisma.ts` (decorates fastify with `prisma`), `src/plugins/redis.ts`, `src/plugins/auth.ts`
- **Env**: `src/utils/env.ts` — Zod-validated, fails fast on startup if required vars are missing

### Web (`apps/web`)
- **Next.js App Router**: all pages under `src/app/`
  - `app/admin/*` — authenticated CMS admin (client components, SWR/direct fetch)
  - `app/(public)/*` — public reader-facing site
  - `app/login` — login page
- **API proxy**: `next.config.mjs` rewrites `/api/*` → `http://localhost:4000/api/*` and `/s3/*` → MinIO bucket. This keeps cookies same-origin; browser code always uses relative `/api/` paths, never the direct port.
- **Auth**: `src/lib/auth.ts` exports `AuthContext` + `useAuth`. `src/components/providers/AuthProvider.tsx` holds auth state, proactively refreshes access tokens every 7 hours.
- **API client**: `src/lib/api.ts` — thin `fetch` wrapper (`api.get/post/patch/put/delete/upload`). Throws `ApiError` on non-2xx. Server-side falls back to `NEXT_PUBLIC_API_URL`; browser always uses `''` (relative).
- **Editor**: TipTap rich text editor in `src/components/editor/RichTextEditor.tsx`. AI writing panel at `src/components/editor/AIWritingPanel.tsx`.
- **UI**: shadcn/ui components (`src/components/ui/`) + Tailwind CSS + Lucide icons

### Authentication & auth model
- **JWT**: short-lived access token (default 8h) in `HttpOnly` cookie + longer refresh token (30d). Cookie path means the browser sends them automatically.
- **Application Passwords**: stateless Bearer tokens for API/headless use. Format embeds the record ID so lookup is O(1) before bcrypt verify.
- **TOTP 2FA**: optional per-user, `totpEnabled` flag + `totpSecret` in `users` table.
- **Roles**: `superadmin | editor | author | subscriber_manager`. `requireAdmin` = superadmin or editor. `requireSuperAdmin` = superadmin only.

### Data model highlights (Prisma)
- **Post** has many Authors (via `PostAuthor`), Categories, Tags, optional `Issue` (for magazine/newsletter issues), optional featured `Media`.
- **Issue**: groups posts by `volumeNumber + issueNumber`. Linked to `Campaign`s for sending.
- **Campaign**: links an Issue to a `SubscriberList`. Tracks send/open/click/unsubscribe counts.
- **Subscriber**: supports `email`, `whatsapp`, or `both` channels.
- **Setting**: flat key/value store for all runtime config (site branding, AI credentials, Botsab credentials, email config, stock API keys). Admin UI in `/admin/settings`.

### DOCX Ingest pipeline
1. Upload ZIP file (containing `.docx` articles) to `POST /api/ingest`
2. Phase 1 (synchronous): `ingestIssue()` in `src/services/docxIngestion.ts` — parses DOCX, creates Posts in DB, uploads embedded images to MinIO
3. Phase 2 (async): enhancements job pushed to BullMQ `ingest-enhancements` queue — AI category mapping, tag generation, featured image generation or stock image search
4. Frontend polls `GET /api/ingest/jobs/:jobId` for completion status

### AI service
- `src/services/ai.ts` — provider-agnostic: supports OpenAI, Gemini, Ollama, Groq
- AI config (provider, API key, models) stored in `Setting` table, read at request time via `getAIConfig()`
- Functions: `generateContent`, `generateFeaturedImage`, `classifyCategories`, `generateArticleTags`, `buildImagePrompt`

### WhatsApp / Botsab integration
- `src/services/botsab.ts` — HTTP client for Botsab WhatsApp API
- Credentials stored in Settings (`botsab_base_url`, `botsab_api_key`, `botsab_instance_id`)
- Campaigns can send to WhatsApp subscriber lists via Botsab groups

### Media / object storage
- All uploads go to MinIO (`shacky-media` bucket, public read)
- In local dev: direct MinIO URL `http://localhost:9000/shacky-media/...`
- In Docker: proxied through Next.js `/s3/` rewrite (`S3_PUBLIC_URL=http://localhost:3000/s3`)
- `Media` records store `url`, `width`, `height`, `altText`, `credit`, `creditUrl`

### Webhooks
- Outbound only. Events fired on post.published etc. via `src/utils/webhooks.ts`
- Config stored in `Webhook` table; managed via `/admin/integrations`

## Environment variables

Copy `.env.example` to `apps/api/.env` and `apps/web/.env.local`.

Required for API: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` (≥32 chars), `JWT_REFRESH_SECRET` (≥32 chars).

Optional but needed for full functionality:
- `S3_*` — MinIO/S3 object storage (defaults work with docker-compose)
- `EMAIL_PROVIDER` + `RESEND_API_KEY` or `SMTP_*` — email sending
- AI keys, Botsab credentials, stock photo API keys — all stored in the DB Settings table at runtime, not in `.env`
