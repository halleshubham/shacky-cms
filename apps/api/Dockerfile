FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

# ── Install workspace deps ────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /monorepo
# Force development so pnpm installs ALL deps including devDependencies
# (Coolify injects NODE_ENV=production as a build ARG which would skip devDeps)
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @shacky/shared build
# tsc + prisma generate
RUN pnpm --filter @shacky/api build

# Create self-contained deployment with only prod deps
RUN pnpm --filter @shacky/api --prod deploy /deploy

# pnpm deploy excludes .gitignored files (dist/), so copy it explicitly
RUN cp -r apps/api/dist /deploy/dist

# Prisma CLI is a devDep — copy it into the deployment (follow pnpm symlinks with -L)
RUN cp -rL node_modules/prisma /deploy/node_modules/prisma 2>/dev/null || \
    find node_modules -maxdepth 5 -name "prisma" -path "*/node_modules/prisma" -not -path "*/prisma/node_modules/*" \
      -exec cp -r {} /deploy/node_modules/prisma \; 2>/dev/null || true

# Shell wrapper so entrypoint.sh can call prisma as a command
RUN printf '#!/bin/sh\nexec node /app/node_modules/prisma/bin/prisma.js "$@"\n' \
      > /deploy/node_modules/.bin/prisma && chmod +x /deploy/node_modules/.bin/prisma

# Generate Prisma client inside the deploy dir (needed for runtime queries)
RUN cd /deploy && node node_modules/prisma/bin/prisma.js generate

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /deploy .
COPY apps/api/entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["./entrypoint.sh"]
