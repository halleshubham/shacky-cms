#!/usr/bin/env node
/**
 * Copies a WordPress site's media library into a Shacky CMS instance, losslessly and at
 * the original URL path, via POST /api/media/import.
 *
 *   WP_URL=https://example.org CMS_URL=https://cms.example.org \
 *   CMS_EMAIL=admin@example.org CMS_PASSWORD='…' \
 *   node apps/api/scripts/wp-media-import.mjs
 *
 * Only the original upload of each attachment is copied (WordPress' generated resized
 * variants are skipped — the web app resizes on demand). Files keep their path under
 * wp-content/uploads, and the CMS serves them at the same /wp-content/uploads/… URL.
 *
 * Safe to re-run: finished items are recorded in STATE_FILE and the CMS import endpoint
 * is idempotent. Failures are retried, then reported at the end (exit code 1).
 *
 * Optional env: CONCURRENCY (3), STATE_FILE (./wp-media-import.state.json),
 *               LIMIT (only first N, for trials), DRY_RUN=1 (list, don't transfer),
 *               ONLY_MIME (prefix filter, e.g. "image/"),
 *               ROOT_PATHS (file with one site-root path per line, e.g. /books/x.pdf — files that
 *               sat loose in the old web root rather than in the media library; the CMS serves
 *               them at the same URL, see LEGACY_STATIC_DIRS in apps/web/next.config.mjs),
 *               EXTRA_PATHS (comma-separated paths under wp-content/uploads to import as well —
 *               for files that pages reference but WordPress' public media list hides, e.g.
 *               attachments of private posts).
 */
import { readFile, writeFile } from 'node:fs/promises';

const env = (k, d) => process.env[k] ?? d;
const WP_URL = env('WP_URL', '').replace(/\/+$/, '');
const CMS_URL = env('CMS_URL', '').replace(/\/+$/, '');
const CMS_EMAIL = env('CMS_EMAIL', '');
const CMS_PASSWORD = env('CMS_PASSWORD', '');
const CONCURRENCY = Math.max(1, Number(env('CONCURRENCY', '3')));
const STATE_FILE = env('STATE_FILE', './wp-media-import.state.json');
const LIMIT = Number(env('LIMIT', '0'));
const DRY_RUN = env('DRY_RUN', '') === '1';
const ONLY_MIME = env('ONLY_MIME', '');
const EXTRA_PATHS = env('EXTRA_PATHS', '').split(',').map((p) => p.trim()).filter(Boolean);
const ROOT_PATHS_FILE = env('ROOT_PATHS', '');
const UA = 'ShackyCMS-Migrator/1.0';
const MARKER = '/wp-content/uploads/';
const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  pdf: 'application/pdf', doc: 'application/msword', mp3: 'audio/mpeg', aac: 'audio/aac', mp4: 'video/mp4',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

if (!WP_URL || (!DRY_RUN && (!CMS_URL || !CMS_EMAIL || !CMS_PASSWORD))) {
  console.error('Set WP_URL, CMS_URL, CMS_EMAIL and CMS_PASSWORD (only WP_URL is needed with DRY_RUN=1).');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (n) => (n / 1e6).toFixed(1) + ' MB';

async function retry(label, fn, tries = 4) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await fn(i); } catch (e) {
      last = e;
      if (e.fatal || i === tries) break;
      await sleep(e.retryAfter ?? 1500 * 2 ** (i - 1));
    }
  }
  throw new Error(`${label}: ${last?.message ?? last}`);
}

// ── WordPress: list attachments (public REST API) ───────────────────────────────
async function listWpMedia() {
  const items = [];
  let totalPages = 1;
  // Page by X-WP-TotalPages, not "short page = last page": WordPress filters items out
  // *after* paginating, so a middle page can legitimately hold fewer than per_page.
  for (let page = 1; page <= totalPages; page++) {
    const url = `${WP_URL}/wp-json/wp/v2/media?per_page=100&page=${page}&_fields=id,slug,mime_type,source_url,alt_text,media_details`;
    const { rows, pages } = await retry(`list page ${page}`, async () => {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { rows: await r.json(), pages: Number(r.headers.get('x-wp-totalpages')) || 1 };
    });
    totalPages = pages;
    items.push(...rows);
  }
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));
}

// ── CMS: session ────────────────────────────────────────────────────────────────
let cookie = '';
async function login() {
  const r = await fetch(`${CMS_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ email: CMS_EMAIL, password: CMS_PASSWORD }),
  });
  if (!r.ok) throw Object.assign(new Error(`CMS login failed (HTTP ${r.status})`), { fatal: true });
  cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

// ── One item ────────────────────────────────────────────────────────────────────
async function transfer(item) {
  const area = item.area || 'uploads';
  const relPath = item.relPath ?? decodeURIComponent(item.source_url.slice(item.source_url.indexOf(MARKER) + MARKER.length));

  const body = await retry(`download ${relPath}`, async () => {
    const r = await fetch(item.source_url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { fatal: r.status === 404 });
    return Buffer.from(await r.arrayBuffer());
  });

  const expected = Number(item.media_details?.filesize) || 0; // WordPress sometimes sends this as a string
  if (expected && expected !== body.length) {
    console.warn(`  ! size differs from WordPress metadata for ${relPath}: ${body.length} vs ${expected}`);
  }

  const send = async () => {
    const fd = new FormData(); // fields first — the API reads them before the file part
    fd.append('path', relPath);
    if (area !== 'uploads') fd.append('area', area);
    fd.append('mimeType', item.mime_type);
    if (item.alt_text) fd.append('altText', item.alt_text);
    fd.append('file', new Blob([body], { type: item.mime_type }), relPath.split('/').pop());
    return fetch(`${CMS_URL}/api/media/import`, { method: 'POST', headers: { Cookie: cookie, 'User-Agent': UA }, body: fd });
  };

  const media = await retry(`upload ${relPath}`, async () => {
    let r = await send();
    if (r.status === 401) { await login(); r = await send(); }
    if (r.status === 429) throw Object.assign(new Error('rate limited'), { retryAfter: (Number(r.headers.get('retry-after')) || 15) * 1000 });
    if (r.status !== 200 && r.status !== 201) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    return r.json();
  });

  if (media.size !== body.length) throw new Error(`stored size ${media.size} != sent ${body.length} for ${relPath}`);
  return { wpId: item.id, oldUrl: item.source_url, newUrl: media.url, mediaId: media.id, path: relPath, mime: item.mime_type, size: body.length };
}

// ── Main ────────────────────────────────────────────────────────────────────────
if (ROOT_PATHS_FILE) {
  const rows = (await readFile(ROOT_PATHS_FILE, 'utf8')).split('\n').map((l) => l.trim().replace(/^\/+/, '')).filter(Boolean);
  for (const rel of rows) {
    items.push({
      id: `site:${rel}`, // state key; not a WordPress id
      source_url: WP_URL + '/' + rel.split('/').map(encodeURIComponent).join('/'),
      relPath: rel, area: 'site',
      mime_type: MIME_BY_EXT[rel.split('.').pop().toLowerCase()] ?? 'application/octet-stream',
      alt_text: '', media_details: {},
    });
  }
}

let state = { done: {}, failed: {} };
try { state = JSON.parse(await readFile(STATE_FILE, 'utf8')); } catch { /* fresh run */ }
const save = () => writeFile(STATE_FILE, JSON.stringify(state, null, 1));

let items = (await listWpMedia()).filter((i) => i.source_url?.includes(MARKER));
const known = new Set(items.map((i) => decodeURIComponent(i.source_url.split(MARKER)[1])));
EXTRA_PATHS.filter((p) => !known.has(p)).forEach((p, n) => items.push({
  id: `extra-${n}-${p}`, // state key; not a WordPress id
  source_url: WP_URL + MARKER + p.split('/').map(encodeURIComponent).join('/'),
  mime_type: MIME_BY_EXT[p.split('.').pop().toLowerCase()] ?? 'application/octet-stream',
  alt_text: '', media_details: {},
}));
if (ONLY_MIME) items = items.filter((i) => i.mime_type.startsWith(ONLY_MIME));
if (LIMIT) items = items.slice(0, LIMIT);
const totalBytes = items.reduce((n, i) => n + (Number(i.media_details?.filesize) || 0), 0);
console.log(`WordPress: ${items.length} attachments, ~${mb(totalBytes)}${DRY_RUN ? ' (dry run)' : ''}`);
if (DRY_RUN) process.exit(0);

await login();
const todo = items.filter((i) => !state.done[i.id]);
console.log(`Already done: ${items.length - todo.length}. To transfer: ${todo.length}. Concurrency: ${CONCURRENCY}`);

let n = 0, bytes = 0; const t0 = Date.now();
async function worker() {
  while (todo.length) {
    const item = todo.shift();
    try {
      const rec = await transfer(item);
      state.done[item.id] = rec; delete state.failed[item.id]; bytes += rec.size;
    } catch (e) {
      state.failed[item.id] = { url: item.source_url, error: String(e.message ?? e) };
      console.error(`  ✗ ${item.source_url.split(MARKER)[1]} — ${e.message ?? e}`);
    }
    n++;
    if (n % 10 === 0 || todo.length === 0) {
      await save();
      const s = (Date.now() - t0) / 1000;
      console.log(`[${n}/${n + todo.length}] ${mb(bytes)} in ${s.toFixed(0)}s (${(bytes / 1e6 / s).toFixed(2)} MB/s), failed so far: ${Object.keys(state.failed).length}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await save();

const failed = Object.keys(state.failed).length;
console.log(`\nDone. Imported/verified: ${Object.keys(state.done).length}/${items.length}. Failed: ${failed}. State: ${STATE_FILE}`);
if (failed) { console.log('Re-run to retry failures. See "failed" in the state file.'); process.exit(1); }
