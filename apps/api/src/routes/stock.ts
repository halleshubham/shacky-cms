import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { uploadToS3 } from '../utils/s3.js';
import { authenticate } from '../middleware/auth.js';
import { createId } from '@paralleldrive/cuid2';

export interface StockPhoto {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
  downloadUrl: string; // URL to pass back to /stock/use
  alt: string;
  credit: string;
  creditUrl?: string;
  source: 'unsplash' | 'pexels' | 'pixabay' | 'wikimedia';
}

// ─── API key helpers ─────────────────────────────────────────────────────────

async function getKeys() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['stock_unsplash_key', 'stock_pexels_key', 'stock_pixabay_key'] } },
  });
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  return {
    unsplash: m['stock_unsplash_key'] || '',
    pexels: m['stock_pexels_key'] || '',
    pixabay: m['stock_pixabay_key'] || '',
  };
}

// ─── Source adapters ─────────────────────────────────────────────────────────

function mapUnsplashPhoto(p: any, fallbackAlt = ''): StockPhoto {
  return {
    id: `unsplash-${p.id}`,
    thumbnailUrl: p.urls.small,
    fullUrl: p.urls.regular,
    downloadUrl: p.links.download_location,
    alt: p.alt_description || p.description || fallbackAlt,
    credit: `Photo by ${p.user.name} on Unsplash`,
    creditUrl: p.user.links.html,
    source: 'unsplash',
  };
}

async function browseUnsplash(page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://api.unsplash.com/photos?page=${page}&per_page=20&order_by=popular`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (Array.isArray(data) ? data : []).map((p: any) => mapUnsplashPhoto(p));
}

async function searchUnsplash(query: string, page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=20&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.results || []).map((p: any) => mapUnsplashPhoto(p, query));
}

function mapPexelsPhoto(p: any, fallbackAlt = ''): StockPhoto {
  return {
    id: `pexels-${p.id}`,
    thumbnailUrl: p.src.medium,
    fullUrl: p.src.large2x,
    downloadUrl: p.src.original,
    alt: p.alt || fallbackAlt,
    credit: `Photo by ${p.photographer} on Pexels`,
    creditUrl: p.photographer_url,
    source: 'pexels',
  };
}

async function browsePexels(page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://api.pexels.com/v1/curated?page=${page}&per_page=20`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.photos || []).map((p: any) => mapPexelsPhoto(p));
}

async function searchPexels(query: string, page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=20&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.photos || []).map((p: any) => mapPexelsPhoto(p, query));
}

function mapPixabayPhoto(p: any, fallbackAlt = ''): StockPhoto {
  return {
    id: `pixabay-${p.id}`,
    thumbnailUrl: p.webformatURL,
    fullUrl: p.largeImageURL,
    downloadUrl: p.largeImageURL,
    alt: p.tags || fallbackAlt,
    credit: `Photo by ${p.user} on Pixabay`,
    creditUrl: `https://pixabay.com/users/${p.user}-${p.user_id}/`,
    source: 'pixabay',
  };
}

async function browsePixabay(page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://pixabay.com/api/?key=${key}&page=${page}&per_page=20&image_type=photo&orientation=horizontal&safesearch=true&order=popular`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.hits || []).map((p: any) => mapPixabayPhoto(p));
}

async function searchPixabay(query: string, page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&page=${page}&per_page=20&image_type=photo&orientation=horizontal&safesearch=true`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.hits || []).map((p: any) => mapPixabayPhoto(p, query));
}

async function searchWikimedia(query: string, page: number): Promise<StockPhoto[]> {
  const offset = (page - 1) * 20;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}%20filetype:bitmap&gsrnamespace=6&gsrlimit=20&gsroffset=${offset}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=400&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Shacky-CMS/1.0' } });
  if (!res.ok) return [];
  const data = await res.json() as any;
  const pages = Object.values(data?.query?.pages || {}) as any[];
  return pages
    .filter((p: any) => {
      const info = p.imageinfo?.[0];
      return info && info.mime?.startsWith('image/') && info.url;
    })
    .map((p: any): StockPhoto => {
      const info = p.imageinfo[0];
      const meta = info.extmetadata || {};
      const artist = meta.Artist?.value?.replace(/<[^>]+>/g, '') || 'Unknown';
      const license = meta.LicenseShortName?.value || 'CC';
      return {
        id: `wikimedia-${p.pageid}`,
        thumbnailUrl: info.thumburl || info.url,
        fullUrl: info.url,
        downloadUrl: info.url,
        alt: meta.ObjectName?.value || p.title?.replace('File:', '') || query,
        credit: `${artist} (${license}) via Wikimedia Commons`,
        creditUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title || '')}`,
        source: 'wikimedia',
      };
    });
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

const stockRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /stock/search?q=...&source=...&page=1  (q optional — omit for browse/popular)
  fastify.get('/search', { preHandler: [authenticate] }, async (req, reply) => {
    const { q, source = 'all', page = 1 } = z.object({
      q: z.string().optional(),
      source: z.enum(['unsplash', 'pexels', 'pixabay', 'wikimedia', 'all']).default('all'),
      page: z.coerce.number().int().positive().default(1),
    }).parse(req.query);

    const keys = await getKeys();
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
    const { downloadUrl, fullUrl, alt, credit, source } = z.object({
      downloadUrl: z.string().url(),
      fullUrl: z.string().url(),
      alt: z.string().default(''),
      credit: z.string().default(''),
      source: z.string().default(''),
    }).parse(req.body);

    // For Unsplash, we must hit the download_location URL first (API TOS requirement)
    // It returns a redirect to the actual download URL
    let imageUrl = fullUrl;
    if (source === 'unsplash' && downloadUrl !== fullUrl) {
      const keys = await getKeys();
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

    // Download the image
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!imgRes.ok) return reply.status(502).send({ statusCode: 502, error: 'Download Failed', message: `Could not fetch image: ${imgRes.status}` });

    const arrayBuffer = await imgRes.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    // Process via sharp
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

    // Create media record with credit in altText
    const altText = [alt, credit].filter(Boolean).join(' — ').slice(0, 500);
    const media = await prisma.media.create({
      data: {
        filename,
        originalName: filename,
        mimeType: 'image/jpeg',
        size: processed.data.length,
        width: processed.info.width,
        height: processed.info.height,
        url,
        altText,
        uploadedById: req.user!.id,
      },
    });

    return reply.send({ id: media.id, url: media.url, altText: media.altText, filename: media.filename });
  });

  // GET /stock/keys — check which sources are configured (no keys returned)
  fastify.get('/keys', { preHandler: [authenticate] }, async (_req, reply) => {
    const keys = await getKeys();
    return reply.send({
      unsplash: !!keys.unsplash,
      pexels: !!keys.pexels,
      pixabay: !!keys.pixabay,
      wikimedia: true,
    });
  });
};

export default stockRoutes;
