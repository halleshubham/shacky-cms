FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ── Install workspace deps ────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
# NODE_ENV=development inline: overrides any build-arg injection from Coolify
# --no-frozen-lockfile: avoids strict CI-mode lockfile validation failures
RUN NODE_ENV=development pnpm install --no-frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @shacky/shared build

# NEXT_PUBLIC_* vars are baked into the bundle at build time.
# NEXT_PUBLIC_API_URL is used for server-side fetches only (api.ts uses ''
# in the browser so all browser calls go through the /api/* rewrite above).
# Set to the internal API hostname so SSR works inside Docker network.
ARG NEXT_PUBLIC_API_URL=http://api:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @shacky/web build

# ── Runtime image (Next.js standalone) ───────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone server + auto-traced node_modules
COPY --from=builder /monorepo/apps/web/.next/standalone ./
# Static assets (not included in standalone output)
COPY --from=builder /monorepo/apps/web/.next/static ./.next/static
# Public folder (favicon, robots.txt, etc.)
COPY --from=builder /monorepo/apps/web/public ./public

EXPOSE 3000
# The standalone entry is server.js at the root of the output,
# or apps/web/server.js when monorepo tracing is enabled.
CMD ["node", "apps/web/server.js"]
