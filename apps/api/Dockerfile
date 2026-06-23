FROM node:22-alpine AS base
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

# Create self-contained deployment with only prod deps
# prisma is a prod dep so pnpm deploy includes it; @prisma/client postinstall runs prisma generate
RUN pnpm --filter @shacky/api --prod deploy /deploy

# pnpm deploy excludes .gitignored files (dist/), so copy it explicitly
RUN cp -r apps/api/dist /deploy/dist

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /deploy .
COPY apps/api/entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["./entrypoint.sh"]
