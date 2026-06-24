import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../plugins/prisma.js';
import { uploadToS3 } from '../utils/s3.js';
import { slugify } from '@shacky/shared';

export interface WPConfig {
  baseUrl: string;
  username: string;
  appPassword: string;
}

export interface MigrationOptions {
  importCategories: boolean;
  importTags: boolean;
  importAuthors: boolean;
  importPosts: boolean;
  postStatus: 'all' | 'publish' | 'draft';
  skipExisting: boolean;
  dateFrom?: string; // ISO 8601 date string, inclusive
  dateTo?: string;   // ISO 8601 date string, inclusive
}

export interface MigrationProgress {
  jobId: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  phase: string;
  total: number;
  done: number;
  skipped: number;
  errors: number;
  errorLog: string[];
  startedAt: string;
  finishedAt?: string;
}

// Decode numeric and common named HTML entities (WP REST API returns rendered HTML)
function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&lsquo;/g, '‘').replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”');
}

// In-memory job store — fine for single-server; jobs are short-lived
const jobs = new Map<string, MigrationProgress>();
const cancelled = new Set<string>();

function authHeader(cfg: WPConfig): string {
  // WP app passwords are displayed with spaces for readability — strip them before encoding
  const password = cfg.appPassword.replace(/\s+/g, '');
  return 'Basic ' + Buffer.from(`${cfg.username}:${password}`).toString('base64');
}

async function wpFetch(cfg: WPConfig, path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${cfg.baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader(cfg), 'User-Agent': 'ShackyCMS-Migrator/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error(`WordPress returned 401 Unauthorized — check username and application password`);
    if (res.status === 403) throw new Error(`WordPress returned 403 Forbidden — the application password may lack required permissions`);
    throw new Error(`WP API ${path} → ${res.status} ${res.statusText}`);
  }
  return { data: await res.json(), headers: res.headers };
}

async function fetchAllPages<T>(cfg: WPConfig, endpoint: string, extraParams: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  while (true) {
    const { data, headers } = await wpFetch(cfg, endpoint, { per_page: '100', page: String(page), ...extraParams });
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    const totalPages = parseInt(headers.get('x-wp-totalpages') || '1', 10);
    if (page >= totalPages) break;
    page++;
  }
  return results;
}

// ─── Connection test ────────────────────────────────────────────────────────

export async function testWPConnection(cfg: WPConfig): Promise<{
  siteTitle: string;
  posts: number;
  pages: number;
  categories: number;
  tags: number;
  authors: number;
  usersBlocked: boolean;
}> {
  // Users endpoint is often blocked by security plugins — treat failure as non-fatal
  const safeUserFetch = wpFetch(cfg, 'users', { per_page: '1' }).catch(() => null);

  const [postHead, pageHead, catHead, tagHead, authorHead, root] = await Promise.all([
    wpFetch(cfg, 'posts', { per_page: '1', status: 'publish' }),
    wpFetch(cfg, 'pages', { per_page: '1', status: 'publish' }),
    wpFetch(cfg, 'categories', { per_page: '1' }),
    wpFetch(cfg, 'tags', { per_page: '1' }),
    safeUserFetch,
    fetch(`${cfg.baseUrl.replace(/\/$/, '')}/wp-json/`, {
      headers: { Authorization: authHeader(cfg) },
      signal: AbortSignal.timeout(10_000),
    }).then((r) => r.json()).catch(() => ({})),
  ]);
  return {
    siteTitle: root.name || cfg.baseUrl,
    posts: parseInt(postHead.headers.get('x-wp-total') || '0', 10),
    pages: parseInt(pageHead.headers.get('x-wp-total') || '0', 10),
    categories: parseInt(catHead.headers.get('x-wp-total') || '0', 10),
    tags: parseInt(tagHead.headers.get('x-wp-total') || '0', 10),
    authors: authorHead ? parseInt(authorHead.headers.get('x-wp-total') || '0', 10) : 0,
    usersBlocked: !authorHead,
  };
}

// ─── Progress helpers ────────────────────────────────────────────────────────

function setProgress(jobId: string, p: Partial<MigrationProgress>): void {
  const current = jobs.get(jobId) ?? {
    jobId, status: 'running' as const, phase: '', total: 0, done: 0, skipped: 0, errors: 0, errorLog: [], startedAt: new Date().toISOString(),
  };
  jobs.set(jobId, { ...current, ...p });
}

export function getProgress(jobId: string): MigrationProgress | null {
  return jobs.get(jobId) ?? null;
}

export function cancelJob(jobId: string): void {
  cancelled.add(jobId);
}

function isCancelled(jobId: string): boolean {
  return cancelled.has(jobId);
}

// ─── Featured image import ────────────────────────────────────────────────────

async function importFeaturedImage(
  imageUrl: string,
  altText: string,
  userId: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const originalName = imageUrl.split('/').pop()?.split('?')[0] || 'image.jpg';

    // Process: max 1920px wide, JPEG 85%
    let img = sharp(buffer).rotate();
    const meta = await img.metadata();
    if ((meta.width || 0) > 1920) {
      img = img.resize(1920, undefined, { withoutEnlargement: true });
    }
    const jpeg = await img.jpeg({ quality: 85, progressive: true }).toBuffer({ resolveWithObject: true });
    let finalBuffer = jpeg.data;
    if (finalBuffer.length > 800 * 1024) {
      finalBuffer = await sharp(buffer).rotate()
        .resize(1920, undefined, { withoutEnlargement: true })
        .jpeg({ quality: 70 }).toBuffer();
    }

    const id = createId();
    const filename = `${id}.jpg`;
    const url = await uploadToS3(`media/${filename}`, finalBuffer, 'image/jpeg');

    const media = await prisma.media.create({
      data: {
        filename,
        originalName,
        mimeType: 'image/jpeg',
        size: finalBuffer.length,
        width: jpeg.info.width,
        height: jpeg.info.height,
        url,
        altText: altText || null,
        uploadedById: userId,
      },
    });
    return media.id;
  } catch {
    return null;
  }
}

// ─── Content image rewriter ──────────────────────────────────────────────────

async function downloadToS3(imageUrl: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());

    // SVGs: upload as-is
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('svg') || imageUrl.toLowerCase().endsWith('.svg')) {
      const id = createId();
      const filename = `${id}.svg`;
      return await uploadToS3(`media/content/${filename}`, buffer, 'image/svg+xml');
    }

    // Raster images: compress via sharp, max 1600px wide
    let img = sharp(buffer).rotate();
    const meta = await img.metadata();
    if ((meta.width || 0) > 1600) img = img.resize(1600, undefined, { withoutEnlargement: true });
    const jpeg = await img.jpeg({ quality: 82, progressive: true }).toBuffer();

    const id = createId();
    const filename = `${id}.jpg`;
    return await uploadToS3(`media/content/${filename}`, jpeg, 'image/jpeg');
  } catch {
    return null;
  }
}

async function rewriteContentImages(
  html: string,
  wpBaseUrl: string,
  userId: string,
  // Shared cache across all posts in one migration run
  urlCache: Map<string, string>,
): Promise<string> {
  const wpHostname = new URL(wpBaseUrl).hostname;
  // Match any absolute URL on the WP domain that ends with an image extension
  const imgExtPattern = /\.(jpe?g|png|gif|webp|svg|avif)(\?[^"'\s>]*)?/i;
  const urlPattern = new RegExp(
    `https?://${wpHostname.replace(/\./g, '\\.')}[^"'\\s>]+${imgExtPattern.source}`,
    'gi',
  );

  // Collect all unique WP image URLs in this post's HTML
  const found = new Set<string>();
  for (const match of html.matchAll(urlPattern)) found.add(match[0]);
  if (found.size === 0) return html;

  // Download + upload any URLs not already in the cache
  await Promise.all(
    [...found].map(async (url) => {
      if (urlCache.has(url)) return;
      const localUrl = await downloadToS3(url, userId);
      if (localUrl) urlCache.set(url, localUrl);
    }),
  );

  // Replace every occurrence (src, srcset, data-src, href, etc.) in the HTML
  let result = html;
  for (const [original, local] of urlCache) {
    if (found.has(original)) result = result.split(original).join(local);
  }
  return result;
}

// ─── Main migration runner ────────────────────────────────────────────────────

export async function runMigration(
  cfg: WPConfig,
  options: MigrationOptions,
  jobId: string,
  userId: string,
): Promise<void> {
  setProgress(jobId, { status: 'running', phase: 'Starting…', total: 0, done: 0, skipped: 0, errors: 0, errorLog: [] });

  const errorLog: string[] = [];
  const addError = (msg: string) => { errorLog.push(msg); if (errorLog.length > 50) errorLog.shift(); };
  // Shared image URL cache so the same WP image isn't downloaded more than once per run
  const imageUrlCache = new Map<string, string>();

  try {
    // ── Phase 1: Categories ──────────────────────────────────────────────────
    const wpCatToLocal = new Map<number, string>(); // WP cat ID → our category ID

    if (options.importCategories) {
      setProgress(jobId, { phase: 'Importing categories…' });
      if (isCancelled(jobId)) return;

      const wpCats = await fetchAllPages<any>(cfg, 'categories');
      for (const wc of wpCats) {
        try {
          const slug = wc.slug || slugify(wc.name);
          const cat = await prisma.category.upsert({
            where: { slug },
            update: {},
            create: { name: wc.name, slug, description: wc.description || null },
          });
          wpCatToLocal.set(wc.id, cat.id);
        } catch (e: any) { addError(`Category "${wc.name}": ${e.message}`); }
      }
    } else {
      // Still need to build the map for post category assignment
      const existing = await prisma.category.findMany({ select: { id: true, slug: true } });
      const wpCats = await fetchAllPages<any>(cfg, 'categories').catch(() => []);
      for (const wc of wpCats) {
        const match = existing.find((c) => c.slug === wc.slug);
        if (match) wpCatToLocal.set(wc.id, match.id);
      }
    }

    // ── Phase 2: Tags ────────────────────────────────────────────────────────
    const wpTagToLocal = new Map<number, string>();

    if (options.importTags) {
      setProgress(jobId, { phase: 'Importing tags…' });
      if (isCancelled(jobId)) return;

      const wpTags = await fetchAllPages<any>(cfg, 'tags');
      for (const wt of wpTags) {
        try {
          const slug = wt.slug || slugify(wt.name);
          const tag = await prisma.tag.upsert({
            where: { slug },
            update: {},
            create: { name: wt.name, slug, description: wt.description || null },
          });
          wpTagToLocal.set(wt.id, tag.id);
        } catch (e: any) { addError(`Tag "${wt.name}": ${e.message}`); }
      }
    } else {
      const existing = await prisma.tag.findMany({ select: { id: true, slug: true } });
      const wpTags = await fetchAllPages<any>(cfg, 'tags').catch(() => []);
      for (const wt of wpTags) {
        const match = existing.find((t) => t.slug === wt.slug);
        if (match) wpTagToLocal.set(wt.id, match.id);
      }
    }

    // ── Phase 3: Authors ─────────────────────────────────────────────────────
    const wpAuthorToLocal = new Map<number, string>();

    if (options.importAuthors) {
      setProgress(jobId, { phase: 'Importing authors…' });
      if (isCancelled(jobId)) return;

      let wpUsers: any[] = [];
      try {
        wpUsers = await fetchAllPages<any>(cfg, 'users');
      } catch (e: any) {
        addError(`Authors skipped — users endpoint blocked: ${e.message}`);
        setProgress(jobId, { errorLog });
      }
      for (const wu of wpUsers) {
        try {
          const slug = wu.slug || slugify(wu.name);
          const author = await prisma.author.upsert({
            where: { slug },
            update: {},
            create: {
              slug,
              displayName: wu.name,
              bio: wu.description || null,
              avatarUrl: wu.avatar_urls?.['96'] || null,
              email: wu.email || null,
            },
          });
          wpAuthorToLocal.set(wu.id, author.id);
        } catch (e: any) { addError(`Author "${wu.name}": ${e.message}`); }
      }
    } else {
      const existing = await prisma.author.findMany({ select: { id: true, slug: true } });
      const wpUsers = await fetchAllPages<any>(cfg, 'users').catch(() => []);
      for (const wu of wpUsers) {
        const match = existing.find((a) => a.slug === wu.slug);
        if (match) wpAuthorToLocal.set(wu.id, match.id);
      }
    }

    // ── Phase 4: Posts ───────────────────────────────────────────────────────
    if (!options.importPosts) {
      setProgress(jobId, { status: 'done', phase: 'Done', finishedAt: new Date().toISOString(), errorLog });
      return;
    }

    setProgress(jobId, { phase: 'Counting posts…' });

    // 'any' is the WP REST API keyword for all statuses (authenticated requests only)
    const statusParam = options.postStatus === 'all' ? 'any' : options.postStatus;
    const countParams: Record<string, string> = { per_page: '1', status: statusParam };
    if (options.dateFrom) countParams.after = new Date(options.dateFrom).toISOString();
    if (options.dateTo) {
      const to = new Date(options.dateTo);
      to.setHours(23, 59, 59, 999);
      countParams.before = to.toISOString();
    }
    let totalPosts = 0;
    try {
      const { headers: countHeaders } = await wpFetch(cfg, 'posts', countParams);
      totalPosts = parseInt(countHeaders.get('x-wp-total') || '0', 10);
    } catch (e: any) {
      throw new Error(`Failed to count posts (status="${statusParam}"): ${e.message}`);
    }

    setProgress(jobId, { phase: 'Importing posts…', total: totalPosts, done: 0, skipped: 0, errors: 0, errorLog });

    let done = 0;
    let skipped = 0;
    let errors = 0;
    const BATCH = 20;
    let page = 1;

    while (true) {
      if (isCancelled(jobId)) {
        setProgress(jobId, { status: 'cancelled', phase: 'Cancelled', finishedAt: new Date().toISOString(), errorLog });
        return;
      }

      const fetchParams: Record<string, string> = {
        per_page: String(BATCH),
        page: String(page),
        status: statusParam,
        _embed: 'wp:featuredmedia,author',
        orderby: 'date',
        order: 'asc',
      };
      if (options.dateFrom) fetchParams.after = new Date(options.dateFrom).toISOString();
      if (options.dateTo) {
        // Set to end of the day so the "to" date is inclusive
        const to = new Date(options.dateTo);
        to.setHours(23, 59, 59, 999);
        fetchParams.before = to.toISOString();
      }
      let wpPosts: any[];
      try {
        const result = await wpFetch(cfg, 'posts', fetchParams);
        wpPosts = result.data;
      } catch (e: any) {
        addError(`WP fetch page ${page}: ${e.message}`);
        setProgress(jobId, { errors: ++errors, errorLog });
        break;
      }

      if (!Array.isArray(wpPosts) || wpPosts.length === 0) break;

      for (const wp of wpPosts) {
        try {
          const slug = wp.slug;

          if (options.skipExisting) {
            const exists = await prisma.post.findUnique({ where: { slug }, select: { id: true } });
            if (exists) { skipped++; continue; }
          }

          // Featured image
          let featuredMediaId: string | null = null;
          const featuredEmbed = wp._embedded?.['wp:featuredmedia']?.[0];
          if (featuredEmbed?.source_url) {
            const alt = featuredEmbed.alt_text || featuredEmbed.title?.rendered || '';
            featuredMediaId = await importFeaturedImage(featuredEmbed.source_url, alt, userId);
          }

          // Map relations
          const categoryIds = (wp.categories || [])
            .map((id: number) => wpCatToLocal.get(id))
            .filter(Boolean) as string[];
          const tagIds = (wp.tags || [])
            .map((id: number) => wpTagToLocal.get(id))
            .filter(Boolean) as string[];
          let authorId = wpAuthorToLocal.get(wp.author);
          if (!authorId) {
            // Fall back to embedded author (available even when /users endpoint is blocked)
            const emb = wp._embedded?.author?.[0];
            if (emb?.name) {
              const aSlug = emb.slug || slugify(emb.name);
              const author = await prisma.author.upsert({
                where: { slug: aSlug },
                update: {},
                create: {
                  slug: aSlug,
                  displayName: emb.name,
                  bio: emb.description || null,
                  avatarUrl: emb.avatar_urls?.['96'] || null,
                },
              });
              authorId = author.id;
              wpAuthorToLocal.set(wp.author, author.id);
            }
          }

          // Dates
          const publishedAt = wp.date ? new Date(wp.date) : null;

          // Map WP status → our status
          let status: 'published' | 'draft' | 'scheduled' = 'draft';
          if (wp.status === 'publish') status = 'published';
          else if (wp.status === 'future') status = 'scheduled';

          // Rewrite inline content images to point to our MinIO storage
          const rawContent = wp.content?.rendered || '';
          const content = rawContent
            ? await rewriteContentImages(rawContent, cfg.baseUrl, userId, imageUrlCache)
            : rawContent;

          // Upsert post (update if slug exists and skipExisting is false)
          const postData = {
            title: decodeEntities(wp.title?.rendered || 'Untitled'),
            slug,
            content,
            excerpt: wp.excerpt?.rendered
              ? decodeEntities(wp.excerpt.rendered.replace(/<[^>]+>/g, '').trim())
              : null,
            status,
            publishedAt,
            featuredMediaId,
            seoTitle: wp.yoast_head_json?.title || null,
            seoDescription: wp.yoast_head_json?.description || null,
          };

          const post = await prisma.post.upsert({
            where: { slug },
            update: postData,
            create: postData,
          });

          // Sync categories
          if (categoryIds.length > 0) {
            await prisma.postCategory.deleteMany({ where: { postId: post.id } });
            await prisma.postCategory.createMany({
              data: categoryIds.slice(0, 3).map((categoryId) => ({ postId: post.id, categoryId })),
              skipDuplicates: true,
            });
          }

          // Sync tags
          if (tagIds.length > 0) {
            await prisma.postTag.deleteMany({ where: { postId: post.id } });
            await prisma.postTag.createMany({
              data: tagIds.map((tagId) => ({ postId: post.id, tagId })),
              skipDuplicates: true,
            });
          }

          // Sync author
          if (authorId) {
            await prisma.postAuthor.deleteMany({ where: { postId: post.id } });
            await prisma.postAuthor.create({ data: { postId: post.id, authorId, order: 0 } });
          }

          done++;
        } catch (e: any) {
          errors++;
          addError(`Post "${wp.slug}": ${e.message}`);
        }

        setProgress(jobId, { done, skipped, errors, errorLog });
      }

      page++;
      if (wpPosts.length < BATCH) break;
    }

    setProgress(jobId, {
      status: 'done',
      phase: `Done — ${done} imported, ${skipped} skipped, ${errors} errors`,
      done,
      skipped,
      errors,
      errorLog,
      finishedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    setProgress(jobId, {
      status: 'failed',
      phase: `Failed: ${e.message}`,
      errorLog,
      finishedAt: new Date().toISOString(),
    });
  }
}
