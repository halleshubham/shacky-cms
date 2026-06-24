import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../plugins/prisma.js';
import { uploadToS3 } from '../utils/s3.js';

// Module-level concurrency limiter for Wikimedia requests.
// Wikimedia rate-limits aggressive crawlers; keeping ≤3 simultaneous requests avoids 429s.
let wikimediaActive = 0;
const wikimediaQueue: Array<() => void> = [];
function wikimediaSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (wikimediaActive < 3) {
        wikimediaActive++;
        resolve(() => {
          wikimediaActive--;
          if (wikimediaQueue.length > 0) wikimediaQueue.shift()!();
        });
      } else {
        wikimediaQueue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

// Fetch with automatic retry on HTTP 429 (rate limit), up to 3 attempts with backoff.
async function fetchRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    const wait = parseInt(res.headers.get('retry-after') || String(2 ** i)) * 1000;
    await new Promise((r) => setTimeout(r, wait));
  }
  return fetch(url, init);
}

export interface StockPhoto {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
  downloadUrl: string;
  alt: string;
  credit: string;
  creditUrl?: string;
  source: 'unsplash' | 'pexels' | 'pixabay' | 'wikimedia';
}

export async function getStockKeys() {
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

// ─── Source adapters ──────────────────────────────────────────────────────────

export function mapUnsplashPhoto(p: any, fallbackAlt = ''): StockPhoto {
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

export async function browseUnsplash(page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://api.unsplash.com/photos?page=${page}&per_page=20&order_by=popular`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (Array.isArray(data) ? data : []).map((p: any) => mapUnsplashPhoto(p));
}

export async function searchUnsplash(query: string, page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=20&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.results || []).map((p: any) => mapUnsplashPhoto(p, query));
}

export function mapPexelsPhoto(p: any, fallbackAlt = ''): StockPhoto {
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

export async function browsePexels(page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://api.pexels.com/v1/curated?page=${page}&per_page=20`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.photos || []).map((p: any) => mapPexelsPhoto(p));
}

export async function searchPexels(query: string, page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=20&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.photos || []).map((p: any) => mapPexelsPhoto(p, query));
}

export function mapPixabayPhoto(p: any, fallbackAlt = ''): StockPhoto {
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

export async function browsePixabay(page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://pixabay.com/api/?key=${key}&page=${page}&per_page=20&image_type=photo&orientation=horizontal&safesearch=true&order=popular`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.hits || []).map((p: any) => mapPixabayPhoto(p));
}

export async function searchPixabay(query: string, page: number, key: string): Promise<StockPhoto[]> {
  if (!key) return [];
  const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&page=${page}&per_page=20&image_type=photo&orientation=horizontal&safesearch=true`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.hits || []).map((p: any) => mapPixabayPhoto(p, query));
}

export async function searchWikimedia(query: string, page: number): Promise<StockPhoto[]> {
  const offset = (page - 1) * 20;
  // Request 1600px thumbnails — Wikimedia generates a JPEG for every source format
  // (including TIFF, SVG, PNG) so we always get a web-friendly file instead of the
  // multi-megabyte original.
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}%20filetype:bitmap&gsrnamespace=6&gsrlimit=20&gsroffset=${offset}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&format=json&origin=*`;
  const release = await wikimediaSlot();
  const res = await fetchRetry(url, { headers: { 'User-Agent': 'Shacky-CMS/1.0' } }).finally(() => release());
  if (!res.ok) return [];
  const data = await res.json() as any;
  const pages = Object.values(data?.query?.pages || {}) as any[];
  return pages
    .filter((p: any) => {
      const info = p.imageinfo?.[0];
      // Require a thumburl — files without one are usually non-rasterisable or too small
      return info && info.mime?.startsWith('image/') && info.thumburl;
    })
    .map((p: any): StockPhoto => {
      const info = p.imageinfo[0];
      const meta = info.extmetadata || {};
      const artist = meta.Artist?.value?.replace(/<[^>]+>/g, '') || 'Unknown';
      const license = meta.LicenseShortName?.value || 'CC';
      // Use thumburl for both download targets — it's a Wikimedia-generated JPEG at
      // ≤1600px, far smaller than the original (which can be 10–50 MB).
      return {
        id: `wikimedia-${p.pageid}`,
        thumbnailUrl: info.thumburl,
        fullUrl: info.thumburl,
        downloadUrl: info.thumburl,
        alt: meta.ObjectName?.value || p.title?.replace('File:', '') || query,
        credit: `${artist} (${license}) via Wikimedia Commons`,
        creditUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title || '')}`,
        source: 'wikimedia',
      };
    });
}

// ─── Search across all configured sources ─────────────────────────────────────

export async function searchAllStock(query: string, page = 1): Promise<StockPhoto[]> {
  const keys = await getStockKeys();
  const [uns, pex, pix, wiki] = await Promise.all([
    searchUnsplash(query, page, keys.unsplash),
    searchPexels(query, page, keys.pexels),
    searchPixabay(query, page, keys.pixabay),
    searchWikimedia(query, page),
  ]);
  const maxLen = Math.max(uns.length, pex.length, pix.length, wiki.length);
  const results: StockPhoto[] = [];
  for (let i = 0; i < maxLen; i++) {
    if (uns[i]) results.push(uns[i]);
    if (pex[i]) results.push(pex[i]);
    if (pix[i]) results.push(pix[i]);
    if (wiki[i]) results.push(wiki[i]);
  }
  return results;
}

// ─── Download, process and store a StockPhoto as a Media record ───────────────

export async function downloadAndStoreStockImage(
  photo: StockPhoto,
  uploadedById: string,
  source?: string,
): Promise<{ mediaId: string; url: string } | null> {
  try {
    // Unsplash TOS: hit download_location before fetching the real image
    let imageUrl = photo.fullUrl;
    if (photo.source === 'unsplash' && photo.downloadUrl !== photo.fullUrl) {
      const keys = await getStockKeys();
      if (keys.unsplash) {
        try {
          const dlRes = await fetch(photo.downloadUrl, { headers: { Authorization: `Client-ID ${keys.unsplash}` } });
          if (dlRes.ok) {
            const dlData = await dlRes.json() as any;
            if (dlData.url) imageUrl = dlData.url;
          }
        } catch { /* fall back to fullUrl */ }
      }
    }

    // Wikimedia image downloads share the same concurrency slot to stay within rate limits
    let imgRes: Response;
    if (photo.source === 'wikimedia') {
      const release = await wikimediaSlot();
      imgRes = await fetchRetry(imageUrl, { signal: AbortSignal.timeout(30000) }).finally(() => release());
    } else {
      imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    }
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null; // broken thumb URL (e.g. Wikimedia returns HTML)

    const rawBuffer = Buffer.from(await imgRes.arrayBuffer());

    const { default: sharp } = await import('sharp');
    let sharpInst = sharp(rawBuffer).rotate();
    const meta = await sharpInst.metadata();
    if ((meta.width || 0) > 1920) sharpInst = sharpInst.resize(1920, undefined, { withoutEnlargement: true });

    let processed = await sharpInst.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
    if (processed.data.length > 800 * 1024) {
      processed = await sharp(rawBuffer).rotate().resize(1920, undefined, { withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer({ resolveWithObject: true });
    }

    const src = source || photo.source;
    const filename = `stock-${src}-${createId()}.jpg`;
    const url = await uploadToS3(`media/${filename}`, processed.data, 'image/jpeg');

    const altText = photo.alt.slice(0, 500);
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
        credit: photo.credit || null,
        creditUrl: photo.creditUrl || null,
        uploadedById,
      },
    });

    return { mediaId: media.id, url: media.url };
  } catch {
    return null;
  }
}
