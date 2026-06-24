FROM node:22-alpine AS base
# openssl CLI is required by @prisma/get-platform to detect OpenSSL 3.x;
# without it Prisma defaults to openssl-1.1.x binaries which segfault on Alpine 3.20
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ── Install workspace deps ────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
# Install only api + its workspace deps (shared) — halves RAM vs full workspace install
# NODE_ENV=development inline so Coolify's --build-arg NODE_ENV=production is ignored
RUN NODE_ENV=development pnpm install --no-frozen-lockfile --filter @shacky/api...

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @shacky/shared build
# tsc + prisma generate
RUN pnpm --filter @shacky/api build
# Compile seed separately — it lives in prisma/ not src/, so rootDir=src excludes it
RUN cd /monorepo/apps/api && \
  node_modules/.bin/tsc --target ES2022 --module CommonJS \
  --moduleResolution Node --esModuleInterop true --skipLibCheck true \
  --outDir /tmp/seed-dist --rootDir . prisma/seed.ts && \
  mv /tmp/seed-dist/prisma/seed.js dist/seed.js

# Create self-contained deployment with only prod deps
# prisma is a prod dep so pnpm deploy includes it; @prisma/client postinstall runs prisma generate
RUN pnpm --filter @shacky/api --prod deploy /deploy

# pnpm deploy's postinstall runs prisma generate in the monorepo context, so
# the generated client lands in the monorepo's node_modules, not /deploy.
# Re-run from /deploy so .prisma/client/* ends up where Node.js can find it.
RUN cd /deploy && node_modules/.bin/prisma generate

# pnpm deploy excludes .gitignored files (dist/), so copy it explicitly
RUN cp -r apps/api/dist /deploy/dist

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /deploy .
COPY apps/api/entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["./entrypoint.sh"]
