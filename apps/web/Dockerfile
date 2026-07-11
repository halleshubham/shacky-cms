FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ── Install workspace deps ────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
# Install only web + its workspace deps (shared) — halves RAM vs full workspace install
# NODE_ENV=development inline so Coolify's --build-arg NODE_ENV=production is ignored
RUN NODE_ENV=development pnpm install --no-frozen-lockfile --filter @shacky/web...

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
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ARG MINIO_INTERNAL_URL=http://minio:9000
ENV MINIO_INTERNAL_URL=$MINIO_INTERNAL_URL
# Cap heap to avoid OOM on constrained build hosts
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN pnpm --filter @shacky/web build

# ── Runtime image (Next.js standalone) ───────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone server + auto-traced node_modules
COPY --from=builder /monorepo/apps/web/.next/standalone ./
# Static assets — must land at apps/web/.next/static because server.js
# resolves paths relative to its own directory (/app/apps/web/)
COPY --from=builder /monorepo/apps/web/.next/static ./apps/web/.next/static
# Public folder — same reason, server.js serves it from apps/web/public
COPY --from=builder /monorepo/apps/web/public ./apps/web/public

EXPOSE 3000
# The standalone entry is server.js at the root of the output,
# or apps/web/server.js when monorepo tracing is enabled.
CMD ["node", "apps/web/server.js"]
