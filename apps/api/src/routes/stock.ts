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
      const plan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT p.id FROM posts p
        WHERE p.status = 'published' AND (
          p.title ILIKE '%' || ${term} || '%' OR
          p.excerpt ILIKE '%' || ${term} || '%' OR
          p.content ILIKE '%' || ${term} || '%' OR
          EXISTS (SELECT 1 FROM post_authors pa JOIN authors a ON a.id = pa."authorId" WHERE pa."postId" = p.id AND a."displayName" ILIKE '%' || ${term} || '%') OR
          EXISTS (SELECT 1 FROM post_categories pc JOIN categories c ON c.id = pc."categoryId" WHERE pc."postId" = p.id AND c.name ILIKE '%' || ${term} || '%') OR
          EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt."tagId" WHERE pt."postId" = p.id AND t.name ILIKE '%' || ${term} || '%')
        )
        ORDER BY p."publishedAt" DESC
        LIMIT 12
      `;

      // Count-shaped plan: same WHERE, no ORDER BY/LIMIT, matching what
      // prisma.post.count() executes for the /search endpoint's total.
      const countPlan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT count(*) FROM posts p
        WHERE p.status = 'published' AND (
          p.title ILIKE '%' || ${term} || '%' OR
          p.excerpt ILIKE '%' || ${term} || '%' OR
          p.content ILIKE '%' || ${term} || '%' OR
          EXISTS (SELECT 1 FROM post_authors pa JOIN authors a ON a.id = pa."authorId" WHERE pa."postId" = p.id AND a."displayName" ILIKE '%' || ${term} || '%') OR
          EXISTS (SELECT 1 FROM post_categories pc JOIN categories c ON c.id = pc."categoryId" WHERE pc."postId" = p.id AND c.name ILIKE '%' || ${term} || '%') OR
          EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt."tagId" WHERE pt."postId" = p.id AND t.name ILIKE '%' || ${term} || '%')
        )
      `;

      // Time the ACTUAL Prisma calls the /search route makes, including the
      // postInclude relation loads, to see where real wall-clock time goes
      // (the hand-written EXPLAINs above don't include Prisma's own relation
      // queries or query-building overhead).
      const where = {
        status: 'published' as const,
        OR: [
          { title: { contains: term, mode: 'insensitive' as const } },
          { excerpt: { contains: term, mode: 'insensitive' as const } },
          { content: { contains: term, mode: 'insensitive' as const } },
          { authors: { some: { author: { displayName: { contains: term, mode: 'insensitive' as const } } } } },
          { categories: { some: { category: { name: { contains: term, mode: 'insensitive' as const } } } } },
          { tags: { some: { tag: { name: { contains: term, mode: 'insensitive' as const } } } } },
        ],
      };
      const postInclude = {
        featuredMedia: true,
        authors: { include: { author: true }, orderBy: { order: 'asc' as const } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        issue: { select: { id: true, title: true, volumeNumber: true, issueNumber: true, publishDate: true } },
      };

      const t0 = Date.now();
      const findManyBare = await prisma.post.findMany({ where, skip: 0, take: 12, orderBy: { publishedAt: 'desc' } });
      const t1 = Date.now();
      const findManyWithInclude = await prisma.post.findMany({ where, include: postInclude, skip: 0, take: 12, orderBy: { publishedAt: 'desc' } });
      const t2 = Date.now();
      const count = await prisma.post.count({ where });
      const t3 = Date.now();

      const [postsTotal, tagsTotal, postTagsTotal] = await Promise.all([
        prisma.post.count(),
        prisma.tag.count(),
        prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM post_tags`.then((r) => r[0].count),
      ]);

      return reply.send({
        trigramIndexesPresent: indexes.map((i) => i.indexname),
        plan: plan.map((r) => r['QUERY PLAN']).join('\n'),
        countPlan: countPlan.map((r) => r['QUERY PLAN']).join('\n'),
        timingsMs: {
          findManyBareNoInclude: t1 - t0,
          findManyWithPostInclude: t2 - t1,
          count: t3 - t2,
        },
        resultCounts: { findManyBare: findManyBare.length, findManyWithInclude: findManyWithInclude.length, count },
        tableSizes: { postsTotal, tagsTotal, postTagsTotal: Number(postTagsTotal) },
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
