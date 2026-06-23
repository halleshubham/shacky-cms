import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { uploadToS3, deleteFromS3, keyFromUrl } from '../utils/s3.js';
import { audit } from '../utils/audit.js';

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

const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /media
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const { page = 1, pageSize = 40, search, mimeType } = req.query as any;
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (search) where.originalName = { contains: search, mode: 'insensitive' };
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
