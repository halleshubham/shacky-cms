import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';
import { slugify } from '@shacky/shared';

const authorBodySchema = z.object({
  displayName: z.string().min(1),
  slug: z.string().optional(),
  bio: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  email: z.string().email().optional().nullable(),
});

const authorsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const { search } = req.query as { search?: string };
    const authors = await prisma.author.findMany({
      where: search ? { displayName: { contains: search, mode: 'insensitive' } } : undefined,
      include: { _count: { select: { posts: true } } },
      orderBy: { displayName: 'asc' },
    });
    return reply.send(authors.map((a) => ({ ...a, postCount: a._count.posts })));
  });

  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const author = await prisma.author.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });
    if (!author) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Author not found' });
    return reply.send({ ...author, postCount: author._count.posts });
  });

  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = authorBodySchema.parse(req.body);
    const slug = body.slug || slugify(body.displayName);

    const existing = await prisma.author.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Slug already in use' });
    }

    const author = await prisma.author.create({
      data: { displayName: body.displayName, slug, bio: body.bio, avatarUrl: body.avatarUrl, email: body.email },
    });
    await audit(req, 'author.created', { entity: 'author', entityId: author.id });
    return reply.status(201).send(author);
  });

  fastify.patch('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = authorBodySchema.partial().parse(req.body);
    const author = await prisma.author.update({ where: { id }, data: body });
    await audit(req, 'author.updated', { entity: 'author', entityId: id });
    return reply.send(author);
  });

  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.author.delete({ where: { id } });
    await audit(req, 'author.deleted', { entity: 'author', entityId: id });
    return reply.send({ success: true });
  });

  // POST /authors/:id/merge/:targetId — merge source into target
  fastify.post('/:id/merge/:targetId', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id, targetId } = req.params as { id: string; targetId: string };

    await prisma.postAuthor.updateMany({
      where: { authorId: id },
      data: { authorId: targetId },
    });

    await prisma.author.delete({ where: { id } });
    await audit(req, 'author.merged', { entity: 'author', entityId: targetId, meta: { mergedFrom: id } });
    return reply.send({ success: true });
  });
};

export default authorsRoutes;
