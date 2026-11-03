import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { uploadToS3 } from '../utils/s3.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { createId } from '@paralleldrive/cuid2';
import {
  type StockPhoto,
  getStockKeys,
  browseUnsplash, searchUnsplash,
  browsePexels, searchPexels,
  browsePixabay, searchPixabay,
  searchWikimedia,
} from '../services/stockSearch.js';

export type { StockPhoto };

// ─── Route plugin ─────────────────────────────────────────────────────────────

const stockRoutes: FastifyPluginAsync = async (fastify) => {
  // TEMP diagnostic for the search-performance fix — remove once confirmed.
  // Admin-only; runs EXPLAIN ANALYZE on the real search query shape so we can see
  // whether the new pg_trgm indexes are actually being used.
  fastify.get('/search-explain', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const term = String((req.query as any).q || 'farmer');
    try {
      const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
        SELECT indexname FROM pg_indexes WHERE tablename IN ('posts', 'authors', 'categories', 'tags') AND indexname LIKE '%trgm%'
      `;

      // #26 rewrote /search as a UNION of single-predicate sub-selects on the
      // theory that each branch gets its own cheap index scan. But production
      // latency didn't improve (still ~5-7s) for BOTH a common term ("farmer",
      // 1327/7335 matches) and a rare one ("xenophobia", 68 matches) — ruling
      // out "common term forces a seq scan" as the sole explanation. EXPLAIN
      // each branch individually plus the full UNION to see what Postgres is
      // actually doing now.
      const titlePlan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id FROM posts WHERE status = 'published' AND title ILIKE '%' || ${term} || '%'
      `;
      const excerptPlan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id FROM posts WHERE status = 'published' AND excerpt ILIKE '%' || ${term} || '%'
      `;
      const contentPlan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id FROM posts WHERE status = 'published' AND content ILIKE '%' || ${term} || '%'
      `;
      const tagPlan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT p.id FROM posts p
          JOIN post_tags pt ON pt."postId" = p.id
          JOIN tags t ON t.id = pt."tagId"
          WHERE p.status = 'published' AND t.name ILIKE '%' || ${term} || '%'
      `;
      const unionPlan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id FROM posts WHERE status = 'published' AND title ILIKE '%' || ${term} || '%'
        UNION
        SELECT id FROM posts WHERE status = 'published' AND excerpt ILIKE '%' || ${term} || '%'
        UNION
        SELECT id FROM posts WHERE status = 'published' AND content ILIKE '%' || ${term} || '%'
        UNION
        SELECT p.id FROM posts p
          JOIN post_authors pa ON pa."postId" = p.id
          JOIN authors a ON a.id = pa."authorId"
          WHERE p.status = 'published' AND a."displayName" ILIKE '%' || ${term} || '%'
        UNION
        SELECT p.id FROM posts p
          JOIN post_categories pc ON pc."postId" = p.id
          JOIN categories c ON c.id = pc."categoryId"
          WHERE p.status = 'published' AND c.name ILIKE '%' || ${term} || '%'
        UNION
        SELECT p.id FROM posts p
          JOIN post_tags pt ON pt."postId" = p.id
          JOIN tags t ON t.id = pt."tagId"
          WHERE p.status = 'published' AND t.name ILIKE '%' || ${term} || '%'
      `;

      // Time the real /search code path end-to-end (the $queryRaw UNION plus
      // the Prisma findMany hydration), exactly as the route executes it.
      const t0 = Date.now();
      const matches = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM posts WHERE status = 'published' AND title ILIKE '%' || ${term} || '%'
        UNION
        SELECT id FROM posts WHERE status = 'published' AND excerpt ILIKE '%' || ${term} || '%'
        UNION
        SELECT id FROM posts WHERE status = 'published' AND content ILIKE '%' || ${term} || '%'
        UNION
        SELECT p.id FROM posts p
          JOIN post_authors pa ON pa."postId" = p.id
          JOIN authors a ON a.id = pa."authorId"
          WHERE p.status = 'published' AND a."displayName" ILIKE '%' || ${term} || '%'
        UNION
        SELECT p.id FROM posts p
          JOIN post_categories pc ON pc."postId" = p.id
          JOIN categories c ON c.id = pc."categoryId"
          WHERE p.status = 'published' AND c.name ILIKE '%' || ${term} || '%'
        UNION
        SELECT p.id FROM posts p
          JOIN post_tags pt ON pt."postId" = p.id
          JOIN tags t ON t.id = pt."tagId"
          WHERE p.status = 'published' AND t.name ILIKE '%' || ${term} || '%'
      `;
      const t1 = Date.now();
      const posts = await prisma.post.findMany({
        where: { id: { in: matches.map((m) => m.id) } },
        skip: 0,
        take: 12,
        orderBy: { publishedAt: 'desc' },
      });
      const t2 = Date.now();

      const [postsTotal, tagsTotal, postTagsTotal, avgContentLen] = await Promise.all([
        prisma.post.count(),
        prisma.tag.count(),
        prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM post_tags`.then((r) => r[0].count),
        prisma.$queryRaw<{ avg: number }[]>`SELECT avg(length(content))::int as avg FROM posts`.then((r) => r[0].avg),
      ]);

      return reply.send({
        trigramIndexesPresent: indexes.map((i) => i.indexname),
        titlePlan: titlePlan.map((r) => r['QUERY PLAN']).join('\n'),
        excerptPlan: excerptPlan.map((r) => r['QUERY PLAN']).join('\n'),
        contentPlan: contentPlan.map((r) => r['QUERY PLAN']).join('\n'),
        tagPlan: tagPlan.map((r) => r['QUERY PLAN']).join('\n'),
        unionPlan: unionPlan.map((r) => r['QUERY PLAN']).join('\n'),
        timingsMs: { unionQuery: t1 - t0, hydrateFindMany: t2 - t1 },
        resultCounts: { matches: matches.length, posts: posts.length },
        tableSizes: { postsTotal, tagsTotal, postTagsTotal: Number(postTagsTotal), avgContentLenChars: avgContentLen },
      });
    } catch (e: any) {
      return reply.send({ error: `${e?.name}: ${e?.message}` });
    }
  });

  // GET /stock/search?q=...&source=...&page=1  (q optional — omit for browse/popular)
  fastify.get('/search', { preHandler: [authenticate] }, async (req, reply) => {
    const { q, source = 'all', page = 1 } = z.object({
      q: z.string().optional(),
      source: z.enum(['unsplash', 'pexels', 'pixabay', 'wikimedia', 'all']).default('all'),
      page: z.coerce.number().int().positive().default(1),
    }).parse(req.query);

    const keys = await getStockKeys();
    const browse = !q || !q.trim();
    const query = q?.trim() || '';

    let results: StockPhoto[] = [];

    if (source === 'all') {
      const [uns, pex, pix, wiki] = await Promise.all([
        browse ? browseUnsplash(page, keys.unsplash) : searchUnsplash(query, page, keys.unsplash),
        browse ? browsePexels(page, keys.pexels) : searchPexels(query, page, keys.pexels),
        browse ? browsePixabay(page, keys.pixabay) : searchPixabay(query, page, keys.pixabay),
        browse ? searchWikimedia('nature photography', page) : searchWikimedia(query, page),
      ]);
      const maxLen = Math.max(uns.length, pex.length, pix.length, wiki.length);
      for (let i = 0; i < maxLen; i++) {
        if (uns[i]) results.push(uns[i]);
        if (pex[i]) results.push(pex[i]);
        if (pix[i]) results.push(pix[i]);
        if (wiki[i]) results.push(wiki[i]);
      }
    } else if (source === 'unsplash') {
      results = browse ? await browseUnsplash(page, keys.unsplash) : await searchUnsplash(query, page, keys.unsplash);
    } else if (source === 'pexels') {
      results = browse ? await browsePexels(page, keys.pexels) : await searchPexels(query, page, keys.pexels);
    } else if (source === 'pixabay') {
      results = browse ? await browsePixabay(page, keys.pixabay) : await searchPixabay(query, page, keys.pixabay);
    } else {
      results = await searchWikimedia(browse ? 'nature photography' : query, page);
    }

    const configured = {
      unsplash: !!keys.unsplash,
      pexels: !!keys.pexels,
      pixabay: !!keys.pixabay,
      wikimedia: true,
    };

    return reply.send({ results, configured });
  });

  // POST /stock/use — download image, process, upload to S3, create media record
  fastify.post('/use', { preHandler: [authenticate] }, async (req, reply) => {
    const { downloadUrl, fullUrl, alt, credit, creditUrl, source } = z.object({
      downloadUrl: z.string().url(),
      fullUrl: z.string().url(),
      alt: z.string().default(''),
      credit: z.string().default(''),
      creditUrl: z.string().default(''),
      source: z.string().default(''),
    }).parse(req.body);

    // For Unsplash, we must hit the download_location URL first (API TOS requirement)
    let imageUrl = fullUrl;
    if (source === 'unsplash' && downloadUrl !== fullUrl) {
      const keys = await getStockKeys();
      if (keys.unsplash) {
        try {
          const dlRes = await fetch(downloadUrl, { headers: { Authorization: `Client-ID ${keys.unsplash}` } });
          if (dlRes.ok) {
            const dlData = await dlRes.json() as any;
            if (dlData.url) imageUrl = dlData.url;
          }
        } catch { /* fall back to fullUrl */ }
      }
    }

    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!imgRes.ok) return reply.status(502).send({ statusCode: 502, error: 'Download Failed', message: `Could not fetch image: ${imgRes.status}` });

    const arrayBuffer = await imgRes.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    const { default: sharp } = await import('sharp');
    let sharpInst = sharp(rawBuffer).rotate();

    const meta = await sharpInst.metadata();
    if ((meta.width || 0) > 1920) sharpInst = sharpInst.resize(1920, undefined, { withoutEnlargement: true });

    let processed = await sharpInst.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
    if (processed.data.length > 800 * 1024) {
      processed = await sharp(rawBuffer).rotate().resize(1920, undefined, { withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer({ resolveWithObject: true });
    }

    const filename = `stock-${source}-${createId()}.jpg`;
    const url = await uploadToS3(`media/${filename}`, processed.data, 'image/jpeg');

    const media = await prisma.media.create({
      data: {
        filename,
        originalName: filename,
        mimeType: 'image/jpeg',
        size: processed.data.length,
        width: processed.info.width,
        height: processed.info.height,
        url,
        altText: alt.slice(0, 500) || null,
        credit: credit || null,
        creditUrl: creditUrl || null,
        uploadedById: req.user!.id,
      },
    });

    return reply.send({ id: media.id, url: media.url, altText: media.altText, credit: media.credit, creditUrl: media.creditUrl, filename: media.filename });
  });

  // GET /stock/keys — check which sources are configured (no keys returned)
  fastify.get('/keys', { preHandler: [authenticate] }, async (_req, reply) => {
    const keys = await getStockKeys();
    return reply.send({
      unsplash: !!keys.unsplash,
      pexels: !!keys.pexels,
      pixabay: !!keys.pixabay,
      wikimedia: true,
    });
  });
};

export default stockRoutes;
