import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import path from 'node:path/posix';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { uploadToS3, deleteFromS3, keyFromUrl } from '../utils/s3.js';
import { audit } from '../utils/audit.js';
import { env } from '../utils/env.js';
import { escapeLikeWildcards } from '@shacky/shared';

// POST /media/upload is reachable by any authenticated role, and non-image
// files are stored and served back with whatever Content-Type the uploader
// claims in the multipart part header (processAndUpload's "upload as-is"
// branch below) — nothing re-checks it against the actual bytes. Without a
// list, an attacker could set Content-Type: text/html (or text/javascript,
// image/svg+xml bypassing the sharp re-encode path, etc) and get a same-
// origin stored-XSS payload served back as if it were an ordinary document.
// Images are already safe regardless of this list: every image/* upload is
// always re-encoded to real JPEG pixels by sharp before being stored, which
// cannot carry executable content through. This only needs to cover the
// non-image types that are actually safe to serve byte-for-byte.
const ALLOWED_NON_IMAGE_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const THUMBNAIL_SIZES = [
  { name: 'thumbnail', width: 150, height: 150 },
  { name: 'medium', width: 300, height: 300 },
  { name: 'large', width: 1024, height: 1024 },
];

async function processAndUpload(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<{
  url: string;
  filename: string;
  width: number | null;
  height: number | null;
  size: number;
  mimeType: string;
}> {
  const id = createId();
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const isImage = mimeType.startsWith('image/');

  if (isImage) {
    // Convert to JPEG, resize to max 1920px, compress to ~800KB
    let img = sharp(buffer).rotate(); // Auto-rotate from EXIF

    const meta = await img.metadata();
    if ((meta.width || 0) > 1920) {
      img = img.resize(1920, undefined, { withoutEnlargement: true });
    }

    const jpeg = await img
      .jpeg({ quality: 85, progressive: true })
      .toBuffer({ resolveWithObject: true });

    let finalBuffer = jpeg.data;
    // If still too large, reduce quality
    if (finalBuffer.length > 800 * 1024) {
      finalBuffer = await sharp(buffer)
        .rotate()
        .resize(1920, undefined, { withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
    }

    const filename = `${id}.jpg`;
    const url = await uploadToS3(`media/${filename}`, finalBuffer, 'image/jpeg');

    // Generate thumbnails
    await Promise.all(
      THUMBNAIL_SIZES.map(async (size) => {
        const thumb = await sharp(buffer)
          .rotate()
          .resize(size.width, size.height, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        await uploadToS3(`media/thumbnails/${size.name}/${filename}`, thumb, 'image/jpeg');
      }),
    );

    return {
      url,
      filename,
      width: jpeg.info.width,
      height: jpeg.info.height,
      size: finalBuffer.length,
      mimeType: 'image/jpeg',
    };
  }

  // Non-image: upload as-is
  const filename = `${id}.${ext}`;
  const url = await uploadToS3(`media/${filename}`, buffer, mimeType);
  return { url, filename, width: null, height: null, size: buffer.length, mimeType };
}

// Key prefix (inside media/) that mirrors WordPress's wp-content/uploads tree.
const LEGACY_PREFIX = 'wp-content/uploads';

/**
 * Validates a client-supplied relative path for /media/import. Returns the normalised
 * path, or null if it is empty, absolute, contains traversal or control characters.
 */
export function normalizeImportPath(input: string): string | null {
  const raw = input.trim().replace(/^\/+/, '');
  if (!raw || raw.length > 400 || raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  const parts = raw.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null;
  return path.normalize(raw);
}

const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /media
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const { page = 1, pageSize = 40, search, mimeType } = req.query as any;
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (search) where.originalName = { contains: escapeLikeWildcards(search), mode: 'insensitive' };
    if (mimeType) where.mimeType = { startsWith: mimeType };

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      }),
      prisma.media.count({ where }),
    ]);
    return reply.send({ data: media, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  });

  // GET /media/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const media = await prisma.media.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    if (!media) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Media not found' });
    return reply.send(media);
  });

  // POST /media/upload
  fastify.post('/upload', { preHandler: [authenticate] }, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
    }

    if (!data.mimetype.startsWith('image/') && !ALLOWED_NON_IMAGE_MIME_TYPES.has(data.mimetype)) {
      return reply.status(415).send({
        statusCode: 415,
        error: 'Unsupported Media Type',
        message: `File type "${data.mimetype}" is not allowed.`,
      });
    }

    const buffer = await data.toBuffer();
    const { url, filename, width, height, size, mimeType } = await processAndUpload(
      buffer,
      data.filename,
      data.mimetype,
    );

    const media = await prisma.media.create({
      data: {
        filename,
        originalName: data.filename,
        mimeType,
        size,
        width,
        height,
        url,
        uploadedById: req.user!.id,
      },
    });

    await audit(req, 'media.uploaded', { entity: 'media', entityId: media.id });
    return reply.status(201).send(media);
  });

  // POST /media/import — lossless import of an existing file at a fixed path.
  //
  // Unlike /upload this does NOT re-encode images or rename anything: the original bytes
  // are stored untouched at media/wp-content/uploads/<path>, which the web app serves at
  // /wp-content/uploads/<path> (see next.config.mjs). That keeps every link to the old
  // WordPress uploads working after a migration. Idempotent: re-importing the same path
  // returns the existing record (200) instead of creating a duplicate.
  //
  // Multipart fields must precede the file part: path (required), altText, mimeType.
  fastify.post('/import', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
    }
    const field = (name: string) => {
      const f = (data.fields as any)?.[name];
      return typeof f?.value === 'string' ? (f.value as string) : undefined;
    };

    const rel = normalizeImportPath(field('path') ?? '');
    if (!rel) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'A valid relative "path" field is required (sent before the file)' });
    }

    const key = `media/${LEGACY_PREFIX}/${rel}`;
    const url = `${env.S3_PUBLIC_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;

    const existing = await prisma.media.findFirst({ where: { url } });
    if (existing) return reply.status(200).send(existing);

    const buffer = await data.toBuffer();
    const mimeType = field('mimeType') || data.mimetype || 'application/octet-stream';

    let width: number | null = null;
    let height: number | null = null;
    if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') {
      try {
        const meta = await sharp(buffer).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch { /* leave dimensions empty for formats sharp can't read */ }
    }

    await uploadToS3(key, buffer, mimeType);

    const media = await prisma.media.create({
      data: {
        filename: rel,
        originalName: path.basename(rel),
        mimeType,
        size: buffer.length,
        width,
        height,
        url,
        altText: field('altText') || null,
        uploadedById: req.user!.id,
      },
    });

    await audit(req, 'media.imported', { entity: 'media', entityId: media.id });
    return reply.status(201).send(media);
  });

  // PATCH /media/:id — update alt text
  fastify.patch('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { altText } = req.body as { altText?: string };
    const media = await prisma.media.update({ where: { id }, data: { altText } });
    return reply.send(media);
  });

  // PUT /media/:id/replace — swap the file behind the media ID
  fastify.put('/:id/replace', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.media.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Media not found' });

    const data = await req.file();
    if (!data) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file' });

    // Delete old file
    try { await deleteFromS3(keyFromUrl(existing.url)); } catch {}

    const buffer = await data.toBuffer();
    const { url, filename, width, height, size, mimeType } = await processAndUpload(
      buffer,
      data.filename,
      data.mimetype,
    );

    const media = await prisma.media.update({
      where: { id },
      data: { filename, originalName: data.filename, mimeType, size, width, height, url },
    });

    await audit(req, 'media.replaced', { entity: 'media', entityId: id });
    return reply.send(media);
  });

  // DELETE /media/:id
  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Media not found' });

    // Check if in use
    const postsUsingIt = await prisma.post.count({ where: { featuredMediaId: id } });
    if (postsUsingIt > 0) {
      const { force } = req.query as { force?: string };
      if (force !== 'true') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: `Media is used in ${postsUsingIt} post(s). Use ?force=true to delete anyway.`,
          usedIn: postsUsingIt,
        });
      }
    }

    try { await deleteFromS3(keyFromUrl(media.url)); } catch {}
    await prisma.media.delete({ where: { id } });
    await audit(req, 'media.deleted', { entity: 'media', entityId: id });
    return reply.send({ success: true });
  });
};

export default mediaRoutes;
