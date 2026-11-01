-- Public search (GET /api/public/search) and the /api/public/posts ?search=
-- filter use Prisma `contains` + `mode: 'insensitive'`, which compiles to
-- Postgres ILIKE '%term%'. A leading wildcard can't use a normal B-tree
-- index, so every search was a full sequential scan of posts.title,
-- posts.excerpt, and posts.content (the full article HTML body), plus the
-- joined authors/categories/tags tables in the same OR — on every keystroke
-- (debounced) and again in full for the separate COUNT query.
--
-- pg_trgm GIN indexes make ILIKE '%term%' use an index scan instead, with no
-- application code changes required. Not declared on the corresponding
-- Prisma models (schema.prisma) because trigram/GIN index types aren't
-- representable without the postgresqlExtensions preview feature; Postgres
-- doesn't need Prisma to be aware of an index to use it.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "posts_title_trgm_idx" ON "posts" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "posts_excerpt_trgm_idx" ON "posts" USING GIN ("excerpt" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "posts_content_trgm_idx" ON "posts" USING GIN ("content" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "authors_display_name_trgm_idx" ON "authors" USING GIN ("displayName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "categories_name_trgm_idx" ON "categories" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "tags_name_trgm_idx" ON "tags" USING GIN ("name" gin_trgm_ops);
