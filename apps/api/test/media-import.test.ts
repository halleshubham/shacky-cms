import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';

const prisma = vi.hoisted(() => ({
  media: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
const uploadToS3 = vi.hoisted(() => vi.fn());
const mockUser = vi.hoisted(() => ({ current: { id: 'u1', role: 'superadmin' as string } }));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../src/utils/env.js', () => ({ env: { S3_PUBLIC_URL: 'https://cms.test/s3' } }));
vi.mock('../src/utils/s3.js', () => ({ uploadToS3, deleteFromS3: vi.fn(), keyFromUrl: (u: string) => u }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = mockUser.current; },
  requireAdmin: async (req: any, reply: any) => {
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'editor') {
      reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
    }
  },
}));

import mediaRoutes, { normalizeImportPath } from '../src/routes/media';

const app = Fastify();
app.register(multipart);
app.register(mediaRoutes, { prefix: '/api/media' });
afterAll(() => app.close());

function form(fields: Record<string, string>, file: { name: string; type: string; body: Buffer }) {
  const b = 'XBOUNDARYX';
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
  parts.push(file.body, Buffer.from(`\r\n--${b}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${b}` } };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockUser.current = { id: 'u1', role: 'superadmin' };
  prisma.media.findFirst.mockResolvedValue(null);
  prisma.media.create.mockImplementation(async ({ data }: any) => ({ id: 'm1', ...data }));
});

describe('normalizeImportPath', () => {
  it('accepts normal and non-ASCII relative paths', () => {
    expect(normalizeImportPath('2025/07/poster.webp')).toBe('2025/07/poster.webp');
    expect(normalizeImportPath('/2025/02/संविधान-ज्ञान.pdf')).toBe('2025/02/संविधान-ज्ञान.pdf');
  });
  it.each(['', '  ', '../etc/passwd', 'a/../b', 'a//b', './a', 'a\\b', 'a/\u0000b'])('rejects %j', (p) => {
    expect(normalizeImportPath(p)).toBeNull();
  });
});

describe('POST /api/media/import', () => {
  it('stores the original bytes untouched at the legacy path and records the media', async () => {
    const body = Buffer.from('%PDF-1.4 not really a pdf');
    const { payload, headers } = form({ path: '2025/09/Booklet.pdf', altText: 'Booklet' }, { name: 'Booklet.pdf', type: 'application/pdf', body });
    const res = await app.inject({ method: 'POST', url: '/api/media/import', payload, headers });

    expect(res.statusCode).toBe(201);
    expect(uploadToS3).toHaveBeenCalledWith('media/wp-content/uploads/2025/09/Booklet.pdf', body, 'application/pdf');
    expect(res.json()).toMatchObject({
      url: 'https://cms.test/s3/media/wp-content/uploads/2025/09/Booklet.pdf',
      mimeType: 'application/pdf', size: body.length, altText: 'Booklet', originalName: 'Booklet.pdf',
    });
  });

  it('percent-encodes non-ASCII file names in the public URL but not in the storage key', async () => {
    const { payload, headers } = form({ path: '2025/02/संविधान.pdf' }, { name: 'x.pdf', type: 'application/pdf', body: Buffer.from('x') });
    const res = await app.inject({ method: 'POST', url: '/api/media/import', payload, headers });
    expect(res.statusCode).toBe(201);
    expect(uploadToS3.mock.calls[0][0]).toBe('media/wp-content/uploads/2025/02/संविधान.pdf');
    expect(res.json().url).toBe(`https://cms.test/s3/media/wp-content/uploads/2025/02/${encodeURIComponent('संविधान.pdf')}`);
  });

  it('is idempotent: an already-imported path returns the existing record without re-uploading', async () => {
    prisma.media.findFirst.mockResolvedValue({ id: 'old', url: 'u' });
    const { payload, headers } = form({ path: '2025/09/Booklet.pdf' }, { name: 'a.pdf', type: 'application/pdf', body: Buffer.from('x') });
    const res = await app.inject({ method: 'POST', url: '/api/media/import', payload, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('old');
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it('rejects traversal paths and a missing path', async () => {
    for (const p of ['../../secret', '']) {
      const { payload, headers } = form({ path: p }, { name: 'a.pdf', type: 'application/pdf', body: Buffer.from('x') });
      const res = await app.inject({ method: 'POST', url: '/api/media/import', payload, headers });
      expect(res.statusCode).toBe(400);
    }
    expect(uploadToS3).not.toHaveBeenCalled();
  });
});

// Regression coverage: PATCH /:id (alt text) had no ownership check at
// all beyond being logged in — any authenticated role, including
// subscriber_manager, could overwrite the alt text of ANY media item
// belonging to any other user. Non-admin roles can still edit alt text
// on media they uploaded themselves (the media library is open to every
// role, and authors routinely set alt text on their own uploads).
describe('PATCH /api/media/:id — alt text ownership', () => {
  beforeEach(() => {
    prisma.media.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
  });

  it('blocks a non-admin from editing alt text on media they did not upload', async () => {
    mockUser.current = { id: 'author1', role: 'author' };
    prisma.media.findUnique.mockResolvedValue({ uploadedById: 'someone-else' });
    const res = await app.inject({ method: 'PATCH', url: '/api/media/m1', payload: { altText: 'hijacked' } });
    expect(res.statusCode).toBe(403);
    expect(prisma.media.update).not.toHaveBeenCalled();
  });

  it('allows a non-admin to edit alt text on their own upload', async () => {
    mockUser.current = { id: 'author1', role: 'author' };
    prisma.media.findUnique.mockResolvedValue({ uploadedById: 'author1' });
    const res = await app.inject({ method: 'PATCH', url: '/api/media/m1', payload: { altText: 'mine' } });
    expect(res.statusCode).toBe(200);
    expect(prisma.media.update).toHaveBeenCalled();
  });

  it.each(['superadmin', 'editor'])('allows %s to edit alt text on any media with no ownership check', async (role) => {
    mockUser.current = { id: 'admin1', role };
    const res = await app.inject({ method: 'PATCH', url: '/api/media/m1', payload: { altText: 'any' } });
    expect(res.statusCode).toBe(200);
    expect(prisma.media.findUnique).not.toHaveBeenCalled();
  });
});

// Regression coverage: POST /upload stored non-image files with whatever
// Content-Type the uploader claimed, with no validation at all — an
// attacker could set Content-Type: text/html (or text/javascript,
// image/svg+xml, etc) on any file and get it served back from the same
// origin as if it were a real document, a stored-XSS vector. Only a fixed
// allowlist of document/media types may now pass through unmodified;
// anything else is rejected before it ever reaches uploadToS3.
describe('POST /api/media/upload — non-image content-type allowlist', () => {
  it('rejects text/html outright', async () => {
    const { payload, headers } = form({}, { name: 'evil.html', type: 'text/html', body: Buffer.from('<script>alert(1)</script>') });
    const res = await app.inject({ method: 'POST', url: '/api/media/upload', payload, headers });
    expect(res.statusCode).toBe(415);
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it('rejects an executable script content-type outright', async () => {
    const { payload, headers } = form({}, { name: 'evil.js', type: 'text/javascript', body: Buffer.from('alert(1)') });
    const res = await app.inject({ method: 'POST', url: '/api/media/upload', payload, headers });
    expect(res.statusCode).toBe(415);
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('allows an allowlisted document type through untouched', async () => {
    const body = Buffer.from('%PDF-1.4 real-ish pdf bytes');
    const { payload, headers } = form({}, { name: 'report.pdf', type: 'application/pdf', body });
    const res = await app.inject({ method: 'POST', url: '/api/media/upload', payload, headers });
    expect(res.statusCode).toBe(201);
    expect(uploadToS3).toHaveBeenCalledWith(expect.stringContaining('media/'), body, 'application/pdf');
  });
});
